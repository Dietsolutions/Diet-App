import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fat-loss-secret-key-change-in-prod';

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
    res.status(401).json({ error: 'Invalid token' });
  }
}

export { JWT_SECRET };
