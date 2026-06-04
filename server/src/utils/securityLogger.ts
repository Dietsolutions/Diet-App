/**
 * Security event logger.
 *
 * Centralises logging of auth failures, rate-limit hits, and ownership
 * violations so they can be grep'd or aggregated in Vercel logs.
 *
 * Format: [SECURITY] <event> <json-context>
 * All fields are logged at INFO level — use console.warn so they stand out
 * without crashing the process.
 */

type SecurityEvent =
  | 'login_failed'
  | 'rate_limit_hit'
  | 'invalid_token'
  | 'ownership_violation'
  | 'validation_failed'
  | 'ai_fallback_rate_limited';

interface SecurityContext {
  userId?: string;
  ip?: string;
  path?: string;
  reason?: string;
  [key: string]: unknown;
}

export function logSecurityEvent(event: SecurityEvent, ctx: SecurityContext = {}): void {
  const payload = { event, ts: new Date().toISOString(), ...ctx };
  console.warn('[SECURITY]', JSON.stringify(payload));
}
