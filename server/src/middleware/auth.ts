import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logSecurityEvent } from '../utils/securityLogger';

// Use the explicit env var when set. Fall back to the legacy hardcoded value so
// existing sessions (signed with that value) remain valid after deploy.
// A module-level throw here would crash the serverless cold-start and return 500
// on *every* request — never throw or call process.exit at module scope.
const JWT_SECRET = process.env.JWT_SECRET || (() => {
  if (process.env.NODE_ENV === 'production') {
    console.error(
      '[CRITICAL] JWT_SECRET env var is not set. ' +
      'Add it to your Vercel project environment variables immediately. ' +
      'Falling back to the legacy default — this is insecure.'
    );
  }
  // Must match the pre-security-audit fallback so existing JWTs remain valid.
  return 'fat-loss-secret-key-change-in-prod';
})();

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
