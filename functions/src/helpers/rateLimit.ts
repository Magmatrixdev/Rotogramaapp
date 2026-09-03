/**
 * helpers/rateLimit.ts
 * Rate limiting por cpfHmac usando transação atômica no Firebase RTDB.
 *
 * Regra: máximo MAX_ATTEMPTS tentativas em uma janela de WINDOW_MS.
 * A partir de WARNING_FROM tentativas, o caller recebe o número restante
 * para exibir avisos progressivos ao usuário.
 * Em caso de sucesso, o caller chama clearRateLimit() para resetar.
 *
 * Nó RTDB: /rateLimits/$cpfHmac  → { attempts: number, windowStart: number }
 */

import * as admin from 'firebase-admin';

const WINDOW_MS    = 15 * 60 * 1000; // 15 minutos
const MAX_ATTEMPTS = 5;
export const WARNING_FROM = 3; // avisa a partir da Nª tentativa

interface RateLimitEntry {
  attempts: number;
  windowStart: number;
}

export interface RateLimitResult {
  attemptsUsed: number;
  attemptsRemaining: number;
}

/**
 * Verifica e incrementa o contador de tentativas.
 * Retorna { attemptsUsed, attemptsRemaining } em caso de sucesso.
 * Lança Error("RATE_LIMIT:<minutos>") quando o limite é atingido.
 */
export async function checkAndIncrementRateLimit(cpfHmac: string): Promise<RateLimitResult> {
  const db  = admin.database();
  const ref = db.ref(`rateLimits/${cpfHmac}`);
  const now = Date.now();

  let blocked     = false;
  let waitMin     = 0;
  let attemptsUsed = 0;

  await ref.transaction((current: RateLimitEntry | null) => {
    const entry: RateLimitEntry = current ?? { attempts: 0, windowStart: now };

    // Janela expirou → reinicia
    if (now - entry.windowStart > WINDOW_MS) {
      attemptsUsed = 1;
      return { attempts: 1, windowStart: now };
    }

    // Já bloqueado — não incrementa, apenas sinaliza
    if (entry.attempts >= MAX_ATTEMPTS) {
      blocked = true;
      waitMin = Math.ceil((WINDOW_MS - (now - entry.windowStart)) / 60_000);
      return undefined; // aborta transação sem alterar
    }

    attemptsUsed = entry.attempts + 1;
    return { attempts: attemptsUsed, windowStart: entry.windowStart };
  });

  if (blocked) {
    throw new Error(`RATE_LIMIT:${waitMin}`);
  }

  return {
    attemptsUsed,
    attemptsRemaining: MAX_ATTEMPTS - attemptsUsed,
  };
}

/**
 * Remove o nó de rate limit após login bem-sucedido.
 */
export async function clearRateLimit(cpfHmac: string): Promise<void> {
  await admin.database().ref(`rateLimits/${cpfHmac}`).remove();
}
