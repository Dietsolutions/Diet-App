import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logSecurityEvent } from '../utils/securityLogger';
import { rotateRefreshToken } from '../utils/refreshToken';
import { setAuthCookie, setRefreshCookie, clearAllAuthCookies } from '../utils/setAuthCookie';

function resolveSecret(): string {
  const raw = process.env.JWT_SECRET;
  const isProd = process.env.NODE_ENV === 'production';
  if (!raw) {
    if (isProd) {
      throw new Error(
        '[CRITICAL] JWT_SECRET is not set in production. ' +
        'Set it in Vercel Project → Settings → Environment Variables.'
      );
    }
    console.warn('[DEV] JWT_SECRET not set — generating ephemeral dev secret for this process.');
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

function extractToken(req: Request): string | null {
  let token = req.cookies?.token;

  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }
  }

  return token || null;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = extractToken(req);

  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string | number };
    req.userId = String(payload.userId);
    next();
    return;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      attemptRefresh(req, res, next);
      return;
    }
    logSecurityEvent('invalid_token', { ip: req.ip, path: req.path });
    res.status(401).json({ error: 'Invalid token' });
  }
}

async function attemptRefresh(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const refreshToken = req.cookies?.refreshToken;
  if (!refreshToken) {
    res.status(401).json({ error: 'Token expired' });
    return;
  }

  try {
    const result = await rotateRefreshToken(refreshToken);
    if (!result) {
      clearAllAuthCookies(res);
      res.status(401).json({ error: 'Session expired. Please log in again.' });
      return;
    }

    setAuthCookie(res, result.accessToken);
    setRefreshCookie(res, result.refreshToken);

    const payload = jwt.verify(result.accessToken, JWT_SECRET) as { userId: string | number };
    if (!payload?.userId) {
      clearAllAuthCookies(res);
      res.status(401).json({ error: 'Session error. Please log in again.' });
      return;
    }
    req.userId = String(payload.userId);
    next();
  } catch {
    clearAllAuthCookies(res);
    res.status(401).json({ error: 'Session error. Please log in again.' });
  }
}

export { JWT_SECRET };
