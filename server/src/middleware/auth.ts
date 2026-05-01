import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logSecurityEvent } from '../utils/securityLogger';

// JWT_SECRET must be set in env — no insecure fallback.
// app.ts exits on startup if it's missing in production.
const JWT_SECRET = process.env.JWT_SECRET || (
  process.env.NODE_ENV === 'production'
    ? (() => { throw new Error('JWT_SECRET is not set'); })()
    : 'dev-only-insecure-secret-do-not-use-in-prod'
);

export interface AuthRequest extends Request {
  userId?: string;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  // Primary: httpOnly cookie (works on Chrome, Android, desktop Safari)
  let token = req.cookies?.token;

  // Fallback: Authorization header (iOS Safari PWA standalone / private mode)
  // iOS PWA contexts don't always share cookies with Safari, so the client
  // stores the token in sessionStorage and sends it as a Bearer token.
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
