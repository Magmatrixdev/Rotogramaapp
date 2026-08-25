/**
 * helpers/rateLimit.ts
 * Rate limiting por cpfHmac usando transação atômica no Firebase RTDB.
 *
 * Regra: máximo MAX_ATTEMPTS tentativas em uma janela de WINDOW_MS.
 * A janela reinicia automaticamente após expirar (não é rolling window).
 * Em caso de sucesso, o caller chama clearRateLimit() para resetar.
 *
 * Nó RTDB: /rateLimits/$cpfHmac  → { attempts: number, windowStart: number }
 * Acesso bloqueado ao cliente pelas regras do banco.
 */

import * as admin from 'firebase-admin';

const WINDOW_MS = 15 * 60 * 1000; // 15 minutos
const MAX_ATTEMPTS = 5;

interface RateLimitEntry {
  attempts: number;
  windowStart: number;
}

/**
 * Verifica e incrementa o contador de tentativas para o cpfHmac dado.
 * - Se a janela expirou, reinicia o contador.
 * - Se o limite foi atingido, lança Error com message "RATE_LIMIT:<minutos>".
 * - Usa transação RTDB para garantir atomicidade mesmo com concorrência.
 */
export async function checkAndIncrementRateLimit(cpfHmac: string): Promise<void> {
  const db = admin.database();
  const ref = db.ref(`rateLimits/${cpfHmac}`);
  const now = Date.now();

  let blocked = false;
  let waitMin = 0;

  await ref.transaction((current: RateLimitEntry | null) => {
    const entry: RateLimitEntry = current ?? { attempts: 0, windowStart: now };

    // Janela expirou → reinicia
    if (now - entry.windowStart > WINDOW_MS) {
      return { attempts: 1, windowStart: now };
    }

    // Já bloqueado — não incrementa, apenas sinaliza
    if (entry.attempts >= MAX_ATTEMPTS) {
      blocked = true;
      waitMin = Math.ceil((WINDOW_MS - (now - entry.windowStart)) / 60_000);
      return undefined; // aborta transação sem alterar o valor
    }

    return { attempts: entry.attempts + 1, windowStart: entry.windowStart };
  });

  if (blocked) {
    throw new Error(`RATE_LIMIT:${waitMin}`);
  }
}

/**
 * Remove o nó de rate limit após login bem-sucedido.
 * Deve ser chamado ANTES de retornar o token ao cliente.
 */
export async function clearRateLimit(cpfHmac: string): Promise<void> {
  const db = admin.database();
  await db.ref(`rateLimits/${cpfHmac}`).remove();
}
