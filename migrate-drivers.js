/**
 * migrate-drivers.js — Script de migração one-off (Node.js, roda localmente)
 * Projeto: rotogramas-confianca
 *
 * O que faz:
 *   1. Lê todos os registros de /motoristas no RTDB
 *   2. Para cada registro, decifra cpfEnc (chave antiga hardcoded) para obter o CPF bruto
 *   3. Cria usuário no Firebase Auth (sem e-mail) se ainda não existir
 *   4. Calcula HMAC-SHA256(cpf, HMAC_SECRET) e hash scrypt do PIN provisório
 *   5. Grava novo formato em /motoristas/$uid e CPF cifrado em /motoristas-secure/$uid
 *   6. Marca pinResetRequired=true e apaga cpfEnc/cpfHash/pinHash antigos
 *
 * Pré-requisitos:
 *   npm install firebase-admin
 *   export GOOGLE_APPLICATION_CREDENTIALS=/caminho/para/service-account.json
 *   export HMAC_SECRET=<valor do Secret Manager>
 *   export CPF_ENC_KEY=<valor do Secret Manager — 64 hex chars>
 *
 * Executar:
 *   node migrate-drivers.js [--dry-run]
 *
 * --dry-run: mostra o que seria feito sem gravar nada no Firebase.
 */

'use strict';

const admin = require('firebase-admin');
const { getDatabase } = require('firebase-admin/database');
const { getAuth } = require('firebase-admin/auth');
const crypto = require('crypto');

// ── Verificar variáveis de ambiente ────────────────────────────────────────
const HMAC_SECRET = process.env.HMAC_SECRET;
const CPF_ENC_KEY = process.env.CPF_ENC_KEY;

if (!HMAC_SECRET || !CPF_ENC_KEY) {
  console.error('ERRO: HMAC_SECRET e CPF_ENC_KEY devem estar definidos como variáveis de ambiente.');
  console.error('  export HMAC_SECRET=$(gcloud secrets versions access latest --secret=HMAC_SECRET)');
  console.error('  export CPF_ENC_KEY=$(gcloud secrets versions access latest --secret=CPF_ENC_KEY)');
  process.exit(1);
}

if (Buffer.from(CPF_ENC_KEY, 'hex').length !== 32) {
  console.error('ERRO: CPF_ENC_KEY deve ter exatamente 64 hex chars (32 bytes).');
  process.exit(1);
}

const DRY_RUN = process.argv.includes('--dry-run');
if (DRY_RUN) console.log('🔍 MODO DRY-RUN — nenhuma alteração será gravada.\n');

// ── Chave antiga (hardcoded no app) ────────────────────────────────────────
const LEGACY_KEY_STRING = 'rotograma-confianca-2026';

admin.initializeApp({ databaseURL: 'https://rotogramas-confianca-default-rtdb.firebaseio.com' });
const db = getDatabase();

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Decifra cpfEnc do formato legado (AES-GCM com chave derivada da string hardcoded) */
async function decryptLegacyCpf(cpfEncB64) {
  try {
    // Derivar chave da mesma forma que o app faz (SHA-256 da string literal)
    const rawKey = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(LEGACY_KEY_STRING)
    );
    const cryptoKey = await crypto.subtle.importKey(
      'raw', rawKey, { name: 'AES-GCM' }, false, ['decrypt']
    );
    const combined = Buffer.from(cpfEncB64, 'base64');
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      ciphertext
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    return null;
  }
}

/** Tenta decifrar cpfEnc como btoa simples (fallback do app) */
function decryptFallbackCpf(cpfEncB64) {
  try {
    const decoded = Buffer.from(cpfEncB64, 'base64').toString('utf8');
    // Verifica se parece um CPF (11 dígitos)
    if (/^\d{11}$/.test(decoded)) return decoded;
    return null;
  } catch {
    return null;
  }
}

/** Computa HMAC-SHA256 (novo formato) */
function computeHmac(data) {
  return crypto.createHmac('sha256', HMAC_SECRET).update(data, 'utf8').digest('hex');
}

/** Hash scrypt do PIN provisório '0000' — motorista será forçado a trocar */
function hashPin(pin, salt) {
  return new Promise((resolve, reject) => {
    const s = salt || crypto.randomBytes(16).toString('hex');
    crypto.scrypt(pin, s, 64, { N: 16384, r: 8, p: 1 }, (err, key) => {
      if (err) return reject(err);
      resolve({ hash: key.toString('hex'), salt: s });
    });
  });
}

/** Cifra CPF com AES-256-GCM (novo formato) */
function encryptNewCpf(cpf) {
  const key = Buffer.from(CPF_ENC_KEY, 'hex');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(cpf, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${encrypted.toString('hex')}:${authTag.toString('hex')}`;
}

// ── Script principal ─────────────────────────────────────────────────────────

async function run() {
  console.log('📡 Lendo /motoristas do Firebase RTDB...\n');
  const snap = await db.ref('motoristas').once('value');
  const all = snap.val() || {};
  const entries = Object.entries(all);
  console.log(`📋 Total de registros encontrados: ${entries.length}\n`);

  const results = { ok: [], skip: [], error: [] };

  for (const [oldId, driver] of entries) {
    const { nome, cpfEnc, cpfHash, pinHash, bloqueado, criadoEm } = driver;
    process.stdout.write(`⚙️  [${oldId}] ${nome || '(sem nome)'} ... `);

    // ── 1. Obter CPF bruto ─────────────────────────────────────────────
    let cpfRaw = null;

    if (cpfEnc) {
      // Tentar decifragem AES-GCM legada
      cpfRaw = await decryptLegacyCpf(cpfEnc);
      if (!cpfRaw) {
        // Tentar btoa fallback
        cpfRaw = decryptFallbackCpf(cpfEnc);
      }
    }

    if (!cpfRaw || !/^\d{11}$/.test(cpfRaw)) {
      console.log('❌ PULADO — não foi possível obter CPF bruto');
      results.error.push({ oldId, nome, motivo: 'CPF não recuperável' });
      continue;
    }

    // ── 2. Verificar se usuário já existe no Auth ─────────────────────
    let uid = null;
    let authUserExists = false;

    // Verificar se o ID antigo já é um UID do Firebase Auth
    try {
      await getAuth().getUser(oldId);
      uid = oldId;
      authUserExists = true;
      console.log('(Auth já existe)');
    } catch {
      // Não existe — criar novo
    }

    if (!authUserExists) {
      if (DRY_RUN) {
        uid = `DRY_RUN_UID_${oldId}`;
        console.log(`(dry-run: criaria Auth user, uid seria ${uid})`);
      } else {
        try {
          const userRecord = await getAuth().createUser({ displayName: nome || 'Motorista' });
          uid = userRecord.uid;
          console.log(`(novo uid: ${uid})`);
        } catch (err) {
          console.log(`❌ ERRO ao criar Auth user: ${err.message}`);
          results.error.push({ oldId, nome, motivo: err.message });
          continue;
        }
      }
    }

    // ── 3. Computar HMAC e novo hash do PIN ───────────────────────────
    const cpfHmac = computeHmac(cpfRaw);
    // PIN provisório '0000' — pinResetRequired força troca no primeiro login
    const { hash: newPinHash, salt: newPinSalt } = await hashPin('0000');
    const cpfEncNew = encryptNewCpf(cpfRaw);

    // ── 4. Novo registro /motoristas/$uid ─────────────────────────────
    const newDriverRecord = {
      nome: nome || 'Motorista',
      cpfHmac,
      pinHash: newPinHash,
      pinSalt: newPinSalt,
      pinResetRequired: true,   // força troca de PIN no primeiro login
      bloqueado: Boolean(bloqueado),
      criadoEm: criadoEm || Date.now(),
      ultimoAcesso: driver.ultimoAcesso || 0,
      migradoEm: Date.now(),
      migradoDe: oldId,         // rastreabilidade
    };

    if (!DRY_RUN) {
      try {
        // Gravar novo nó do motorista
        await db.ref(`motoristas/${uid}`).set(newDriverRecord);

        // CPF cifrado em nó separado
        await db.ref(`motoristas-secure/${uid}`).set({ cpfEnc: cpfEncNew });

        // Se o id mudou (oldId !== uid), remover o nó antigo
        if (oldId !== uid) {
          await db.ref(`motoristas/${oldId}`).remove();
          console.log(`  → nó antigo ${oldId} removido`);
        }

        console.log(`  ✅ OK → uid ${uid}`);
        results.ok.push({ oldId, uid, nome });
      } catch (err) {
        console.log(`❌ ERRO ao gravar: ${err.message}`);
        results.error.push({ oldId, nome, motivo: err.message });
      }
    } else {
      console.log(`  ✅ [dry-run] OK → uid ${uid}`);
      results.ok.push({ oldId, uid, nome });
    }
  }

  // ── Relatório final ───────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════');
  console.log('RELATÓRIO DE MIGRAÇÃO');
  console.log('═══════════════════════════════════════');
  console.log(`✅ Migrados com sucesso : ${results.ok.length}`);
  console.log(`❌ Erros / pulados      : ${results.error.length}`);
  console.log('');

  if (results.error.length > 0) {
    console.log('Registros com erro:');
    results.error.forEach(r => console.log(`  - [${r.oldId}] ${r.nome}: ${r.motivo}`));
  }

  if (DRY_RUN) {
    console.log('\n⚠️  Dry-run concluído. Para aplicar a migração, execute sem --dry-run.');
  } else {
    console.log('\n✅ Migração concluída.');
    console.log('Próximo passo: publique as novas regras do RTDB (firebase deploy --only database)');
    console.log('e habilite USE_NEW_AUTH = true no app-config.js após validar os logins.');
  }

  process.exit(0);
}

run().catch(err => {
  console.error('ERRO FATAL:', err);
  process.exit(1);
});
