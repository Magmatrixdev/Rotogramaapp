/**
 * index.ts — Cloud Functions 2nd gen (Node 20 / TypeScript)
 * Projeto: rotogramas-confianca
 *
 * Funções exportadas:
 *   registerDriver  — cadastra motorista, retorna custom token
 *   loginDriver     — autentica com CPF+PIN, retorna custom token + rate limit
 *   setAdminClaim   — seta custom claim admin=true (requer admin caller)
 *   getDriverCPF    — retorna CPF formatado para admin + auditoria
 *   changePIN       — motorista autenticado troca o próprio PIN
 *
 * Secrets (Secret Manager):
 *   HMAC_SECRET  — chave HMAC para deduplicação do CPF (32+ bytes aleatórios)
 *   CPF_ENC_KEY  — chave AES-256-GCM para cifrar CPF (32 bytes → 64 hex chars)
 *
 * Como gerar os secrets antes do primeiro deploy:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *   echo -n "<valor>" | gcloud secrets create HMAC_SECRET --data-file=-
 *   echo -n "<valor>" | gcloud secrets create CPF_ENC_KEY --data-file=-
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';

import { cleanCPF, validateCPF } from './helpers/cpf';
import { computeHmac, hashPin, verifyPin, encryptData, decryptData } from './helpers/crypto';
import { checkAndIncrementRateLimit, clearRateLimit } from './helpers/rateLimit';

admin.initializeApp();

// Secrets declarados — o SDK injeta automaticamente em runtime, sem necessidade
// de chamar o Secret Manager diretamente no código.
const HMAC_SECRET = defineSecret('HMAC_SECRET');
const CPF_ENC_KEY = defineSecret('CPF_ENC_KEY');

// ─────────────────────────────────────────────────────────────────────────────
// registerDriver
// Callable: { nome: string, cpf: string, pin: string }
// Retorna:  { token: string }
// ─────────────────────────────────────────────────────────────────────────────
export const registerDriver = onCall(
  { secrets: [HMAC_SECRET, CPF_ENC_KEY], region: 'us-central1' },
  async (request) => {
    const { nome, cpf, pin } = request.data as {
      nome?: string;
      cpf?: string;
      pin?: string;
    };

    // ── Validações ──────────────────────────────────────────────────────────
    const nomeTrimmed = (nome ?? '').trim();
    if (!nomeTrimmed || nomeTrimmed.length < 2 || nomeTrimmed.length > 100) {
      throw new HttpsError('invalid-argument', 'Nome inválido (mínimo 2, máximo 100 caracteres).');
    }

    const cpfClean = cleanCPF(cpf ?? '');
    if (!validateCPF(cpfClean)) {
      throw new HttpsError('invalid-argument', 'CPF inválido. Verifique os dígitos.');
    }

    if (!pin || !/^\d{4}$/.test(pin)) {
      throw new HttpsError('invalid-argument', 'PIN deve ter exatamente 4 dígitos numéricos.');
    }

    // ── Deduplicação por HMAC ─────────────────────────────────────────────
    const db = admin.database();
    const cpfHmac = computeHmac(cpfClean, HMAC_SECRET.value());

    const dupSnap = await db
      .ref('motoristas')
      .orderByChild('cpfHmac')
      .equalTo(cpfHmac)
      .once('value');

    if (dupSnap.exists()) {
      throw new HttpsError('already-exists', 'CPF já cadastrado. Faça login na aba Entrar.');
    }

    // ── Hash do PIN ───────────────────────────────────────────────────────
    const { hash: pinHash, salt: pinSalt } = await hashPin(pin);

    // ── Criar usuário no Firebase Auth (sem e-mail) ───────────────────────
    const userRecord = await admin.auth().createUser({
      displayName: nomeTrimmed,
    });
    const uid = userRecord.uid;

    // ── Gravar no RTDB (CPF nunca em claro neste nó) ─────────────────────
    const now = Date.now();
    await db.ref(`motoristas/${uid}`).set({
      nome: nomeTrimmed,
      cpfHmac,       // apenas para busca — não reverte ao CPF
      pinHash,
      pinSalt,
      pinResetRequired: false,
      bloqueado: false,
      criadoEm: now,
      ultimoAcesso: now,
    });

    // ── CPF cifrado — nó separado, acesso restrito a Cloud Functions ─────
    const cpfEnc = encryptData(cpfClean, CPF_ENC_KEY.value());
    await db.ref(`motoristas-secure/${uid}`).set({ cpfEnc });

    // ── Custom token para signInWithCustomToken no cliente ────────────────
    const token = await admin.auth().createCustomToken(uid);
    return { token };
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// loginDriver
// Callable: { cpf: string, pin: string }
// Retorna:  { token: string, pinResetRequired: boolean }
// ─────────────────────────────────────────────────────────────────────────────
export const loginDriver = onCall(
  { secrets: [HMAC_SECRET], region: 'us-central1' },
  async (request) => {
    const { cpf, pin } = request.data as { cpf?: string; pin?: string };

    // Validação mínima — mensagem genérica para não revelar qual campo falhou
    const cpfClean = cleanCPF(cpf ?? '');
    if (!validateCPF(cpfClean) || !pin || !/^\d{4}$/.test(pin)) {
      throw new HttpsError('unauthenticated', 'CPF ou PIN incorretos.');
    }

    const cpfHmac = computeHmac(cpfClean, HMAC_SECRET.value());

    // ── Rate limit — incrementa ANTES da consulta ao banco ───────────────
    try {
      await checkAndIncrementRateLimit(cpfHmac);
    } catch (e: unknown) {
      const msg = (e as Error).message ?? '';
      if (msg.startsWith('RATE_LIMIT:')) {
        const min = msg.split(':')[1] ?? '15';
        throw new HttpsError(
          'resource-exhausted',
          `Muitas tentativas. Aguarde ${min} minuto(s) e tente novamente.`
        );
      }
      throw e;
    }

    // ── Buscar motorista pelo cpfHmac (requer .indexOn: ["cpfHmac"]) ────
    const db = admin.database();
    const snap = await db
      .ref('motoristas')
      .orderByChild('cpfHmac')
      .equalTo(cpfHmac)
      .once('value');

    // CPF não encontrado — rata limit já foi incrementado acima
    if (!snap.exists()) {
      throw new HttpsError('unauthenticated', 'CPF ou PIN incorretos.');
    }

    // Extrair primeiro (e único esperado) resultado
    let uid = '';
    let driver: Record<string, unknown> = {};
    snap.forEach((child) => {
      uid = child.key ?? '';
      driver = (child.val() as Record<string, unknown>) ?? {};
    });

    if (driver['bloqueado']) {
      throw new HttpsError('permission-denied', 'Conta bloqueada. Contate o administrador.');
    }

    // ── Verificar PIN em tempo constante ──────────────────────────────────
    const pinOk = await verifyPin(
      pin,
      driver['pinHash'] as string,
      driver['pinSalt'] as string
    );

    if (!pinOk) {
      // Rate limit já incrementado — não incrementa de novo
      throw new HttpsError('unauthenticated', 'CPF ou PIN incorretos.');
    }

    // ── Sucesso: limpar rate limit e atualizar último acesso ─────────────
    await clearRateLimit(cpfHmac);
    await db.ref(`motoristas/${uid}/ultimoAcesso`).set(Date.now());

    const token = await admin.auth().createCustomToken(uid);
    return {
      token,
      pinResetRequired: Boolean(driver['pinResetRequired']),
    };
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// setAdminClaim
// Callable: { uid: string }
// Requer: caller com custom claim admin===true
// Retorna: { success: true }
// ─────────────────────────────────────────────────────────────────────────────
export const setAdminClaim = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (!request.auth?.token?.['admin']) {
      throw new HttpsError(
        'permission-denied',
        'Apenas administradores podem definir claims admin.'
      );
    }

    const { uid } = request.data as { uid?: string };
    if (!uid || typeof uid !== 'string' || uid.trim().length === 0) {
      throw new HttpsError('invalid-argument', 'UID inválido.');
    }

    // Verificar que o uid existe no Auth antes de setar claim
    try {
      await admin.auth().getUser(uid);
    } catch {
      throw new HttpsError('not-found', 'Usuário não encontrado no Firebase Auth.');
    }

    await admin.auth().setCustomUserClaims(uid, { admin: true });

    // Auditoria
    await admin.database().ref(`audit/${uid}`).push({
      action: 'setAdminClaim',
      byUid: request.auth.uid,
      ts: Date.now(),
    });

    return { success: true };
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// getDriverCPF
// Callable: { uid: string }
// Requer: caller com custom claim admin===true
// Retorna: { cpf: string }  — formatado "000.000.000-00"
// Registra auditoria em /audit/$uid
// ─────────────────────────────────────────────────────────────────────────────
export const getDriverCPF = onCall(
  { secrets: [CPF_ENC_KEY], region: 'us-central1' },
  async (request) => {
    if (!request.auth?.token?.['admin']) {
      throw new HttpsError('permission-denied', 'Requer claim admin.');
    }

    const { uid } = request.data as { uid?: string };
    if (!uid || typeof uid !== 'string') {
      throw new HttpsError('invalid-argument', 'UID inválido.');
    }

    const db = admin.database();
    const snap = await db.ref(`motoristas-secure/${uid}`).once('value');

    if (!snap.exists()) {
      throw new HttpsError('not-found', 'CPF não encontrado para este motorista.');
    }

    const { cpfEnc } = snap.val() as { cpfEnc: string };

    let cpfClean: string;
    try {
      cpfClean = decryptData(cpfEnc, CPF_ENC_KEY.value());
    } catch {
      throw new HttpsError('internal', 'Erro ao decifrar CPF. Contate o suporte.');
    }

    // Formatar: 000.000.000-00
    const formatted = [
      cpfClean.slice(0, 3),
      '.',
      cpfClean.slice(3, 6),
      '.',
      cpfClean.slice(6, 9),
      '-',
      cpfClean.slice(9),
    ].join('');

    // Auditoria — quem pediu o CPF, quando, de qual motorista
    await db.ref(`audit/${uid}`).push({
      action: 'getDriverCPF',
      byUid: request.auth.uid,
      ts: Date.now(),
    });

    return { cpf: formatted };
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// changePIN
// Callable: { pinAtual: string, pinNovo: string }
// Requer: motorista autenticado (request.auth != null)
// Retorna: { success: true }
// ─────────────────────────────────────────────────────────────────────────────
export const changePIN = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Login necessário.');
    }

    const { pinAtual, pinNovo } = request.data as {
      pinAtual?: string;
      pinNovo?: string;
    };

    if (!pinAtual || !pinNovo) {
      throw new HttpsError('invalid-argument', 'PINs obrigatórios.');
    }
    if (!/^\d{4}$/.test(pinNovo)) {
      throw new HttpsError(
        'invalid-argument',
        'Novo PIN deve ter exatamente 4 dígitos numéricos.'
      );
    }
    if (pinAtual === pinNovo) {
      throw new HttpsError('invalid-argument', 'O novo PIN deve ser diferente do atual.');
    }

    const uid = request.auth.uid;
    const db = admin.database();
    const snap = await db.ref(`motoristas/${uid}`).once('value');

    if (!snap.exists()) {
      throw new HttpsError('not-found', 'Motorista não encontrado.');
    }

    const driver = snap.val() as { pinHash: string; pinSalt: string };

    const pinOk = await verifyPin(pinAtual, driver.pinHash, driver.pinSalt);
    if (!pinOk) {
      throw new HttpsError('unauthenticated', 'PIN atual incorreto.');
    }

    const { hash: newHash, salt: newSalt } = await hashPin(pinNovo);
    await db.ref(`motoristas/${uid}`).update({
      pinHash: newHash,
      pinSalt: newSalt,
      pinResetRequired: false,
      updatedAt: Date.now(),
    });

    return { success: true };
  }
);
