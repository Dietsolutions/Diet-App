import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logSecurityEvent } from '../utils/securityLogger';

// Reject the dev fallback and any secret shorter than 32 bytes in production.
// In dev, a 32+ char secret is recommended but a 16+ char string still works.
function resolveSecret(): string {
  const raw = process.env.JWT_SECRET;
  const isProd = process.env.NODE_ENV === 'production';
  if (!raw) {
    if (isProd) {
      // Throw at module load — this kills the function cold start. Better
      // than letting the service sign tokens with a known public string.
      throw new Error(
        '[CRITICAL] JWT_SECRET is not set in production. ' +
        'Set it in Vercel Project → Settings → Environment Variables.'
      );
    }
    console.warn('[DEV] JWT_SECRET not set — generating ephemeral dev secret for this process.');
    // Each cold start gets a fresh dev secret — sessions do not persist.
    return require('crypto').randomBytes(48).toString('base64');
  }
  if (isProd && raw.length < 32) {
    throw new Error(
      `[CRITICAL] JWT_SECRET is too short (${raw.length} chars). Use at least 32 bytes. ` +
      'Run `openssl rand -base64 48` to generate one.'
    );
  }
  if (isProd && /^change-?me|^dev-jwt|^secret$|^test$|^default$/i.test(raw)) {
    throw new Error(
      '[CRITICAL] JWT_SECRET matches a known placeholder. ' +
      'Set a unique secret in Vercel Project → Settings → Environment Variables.'
    );
  }
  return raw;
}

const JWT_SECRET = resolveSecret();

export interface AuthRequest extends Request {
  userId?: string;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  // Primary: httpOnly cookie (works on Chrome, Android, desktop Safari, and
  // the Capacitor WebView on the same origin).
  let token = req.cookies?.token;

  // Fallback: Authorization header. This is kept for clients that legitimately
  // cannot share httpOnly cookies (e.g. iOS Safari PWA in private mode).
  // The client should prefer cookies; using Authorization is a documented
  // fallback only.
  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }
  }

  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string | number };
    req.userId = String(payload.userId);
    next();
  } catch {
    logSecurityEvent('invalid_token', { ip: req.ip, path: req.path });
    res.status(401).json({ error: 'Invalid token' });
  }
}

export { JWT_SECRET };
