/**
 * helpers/crypto.ts
 * Primitivas criptográficas usadas pelas Cloud Functions:
 *   - HMAC-SHA256 para deduplicação do CPF (sem armazenar o CPF em claro)
 *   - scrypt para hash do PIN (memory-hard, nativo do Node.js — sem deps externas)
 *   - AES-256-GCM para armazenamento do CPF cifrado (acesso restrito a admin)
 */

import * as crypto from 'crypto';

// ─── HMAC ────────────────────────────────────────────────────────────────────

/**
 * Computa HMAC-SHA256 do dado com a chave do Secret Manager.
 * Usado como índice de deduplicação do CPF em /motoristas.
 * Nunca reverte ao CPF original.
 */
export function computeHmac(data: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(data, 'utf8').digest('hex');
}

// ─── SCRYPT (PIN) ─────────────────────────────────────────────────────────────

/**
 * Parâmetros scrypt calibrados para PINs de 4 dígitos + cold start aceitável.
 * N=16384 (2^14) r=8 p=1 → ~16 MB RAM, ~50 ms em instância padrão.
 * Para PINs curtos qualquer N > 2^12 já impede brute-force em escala.
 */
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };
const SCRYPT_KEY_LEN = 64; // bytes → 128 hex chars

/**
 * Gera hash do PIN com scrypt.
 * Se `salt` for omitido, gera 16 bytes aleatórios (uso em registro/troca de PIN).
 * Se `salt` for fornecido, reproduz o hash para verificação.
 */
export function hashPin(
  pin: string,
  salt?: string
): Promise<{ hash: string; salt: string }> {
  return new Promise((resolve, reject) => {
    const s = salt ?? crypto.randomBytes(16).toString('hex');
    crypto.scrypt(pin, s, SCRYPT_KEY_LEN, SCRYPT_PARAMS, (err, key) => {
      if (err) return reject(err);
      resolve({ hash: key.toString('hex'), salt: s });
    });
  });
}

/**
 * Verifica o PIN em tempo constante (timingSafeEqual) para evitar timing attacks.
 * Retorna false em qualquer erro — nunca lança exceção.
 */
export async function verifyPin(
  pin: string,
  storedHash: string,
  storedSalt: string
): Promise<boolean> {
  try {
    const { hash } = await hashPin(pin, storedSalt);
    const a = Buffer.from(hash, 'hex');
    const b = Buffer.from(storedHash, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ─── AES-256-GCM (CPF cifrado para admin) ────────────────────────────────────

/**
 * Cifra plaintext com AES-256-GCM.
 * A chave `keyHex` deve ser 64 hex chars (32 bytes) gerada com:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 * e armazenada no Secret Manager como CPF_ENC_KEY.
 *
 * Retorna string "ivHex:ciphertextHex:authTagHex" — auto-contida para decifrar.
 */
export function encryptData(plaintext: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    iv.toString('hex'),
    encrypted.toString('hex'),
    authTag.toString('hex'),
  ].join(':');
}

/**
 * Decifra string produzida por encryptData.
 * Lança erro se a integridade (auth tag) falhar — proteção contra adulteração.
 */
export function decryptData(encoded: string, keyHex: string): string {
  const parts = encoded.split(':');
  if (parts.length !== 3) throw new Error('Formato inválido de CPF cifrado');
  const [ivHex, cipherHex, tagHex] = parts;
  const key = Buffer.from(keyHex, 'hex');
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(ivHex, 'hex')
  );
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(cipherHex, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}
