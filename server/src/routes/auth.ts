import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import prisma from '../lib/prisma';
import { requireAuth, AuthRequest, JWT_SECRET } from '../middleware/auth';
import { setAuthCookie, clearAuthCookie } from '../utils/setAuthCookie';

const router = Router();

// Reserved usernames that cannot be registered
const RESERVED_USERNAMES = new Set([
  'admin', 'root', 'system', 'support', 'help',
  'dietplan', 'api', 'null', 'undefined'
]);

// Username format: 3-20 chars, letters/numbers/underscore only
const USERNAME_REGEX = /^[A-Za-z0-9_]{3,20}$/;

function validateUsername(username: string): { valid: boolean; message?: string } {
  if (typeof username !== 'string' || username.length === 0) {
    return { valid: false, message: 'Username is required' };
  }
  if (/\s/.test(username)) {
    return { valid: false, message: 'Username cannot contain spaces' };
  }
  if (username.length < 3 || username.length > 20) {
    return { valid: false, message: 'Username must be 3–20 characters' };
  }
  if (!USERNAME_REGEX.test(username)) {
    return { valid: false, message: 'Only letters, numbers and _ allowed' };
  }
  if (RESERVED_USERNAMES.has(username.toLowerCase())) {
    return { valid: false, message: 'This username is not available' };
  }
  return { valid: true };
}

function validatePassword(password: string, username: string): { valid: boolean; message?: string } {
  if (typeof password !== 'string' || password.length === 0) {
    return { valid: false, message: 'Password is required' };
  }
  if (password.length < 6) {
    return { valid: false, message: 'Password must be at least 6 characters' };
  }
  if (password.length > 72) {
    return { valid: false, message: 'Password is too long' };
  }
  if (/^\d+$/.test(password)) {
    return { valid: false, message: 'Password cannot be all numbers' };
  }
  if (username && password.toLowerCase() === username.toLowerCase()) {
    return { valid: false, message: 'Password cannot be your username' };
  }
  return { valid: true };
}

// Rate limit: 5 signup attempts per IP per hour
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error: 'rate_limit',
      message: 'Too many signup attempts. Please try again in an hour.'
    });
  }
});

// Rate limit: 30 username checks per IP per minute
const checkUsernameLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error: 'rate_limit',
      message: 'Too many requests. Slow down.'
    });
  }
});

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5173/api/auth/google/callback';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

function issueToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
}

// POST /api/auth/login (username + password)
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password required' });
      return;
    }

    // Case-insensitive lookup (usernames are stored lowercase for new accounts)
    const normalisedUsername = typeof username === 'string' ? username.toLowerCase() : '';
    let user = await prisma.user.findUnique({ where: { username: normalisedUsername } });
    // Fallback: check original case for legacy accounts stored with mixed case
    if (!user && normalisedUsername !== username) {
      user = await prisma.user.findUnique({ where: { username } });
    }

    if (!user || !user.passwordHash) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);

    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = issueToken(user.id);
    setAuthCookie(res, token);

    // Return token in body as well — iOS Safari PWA fallback (sessionStorage)
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        onboardingDone: user.onboardingDone
      }
    });
  } catch (err) {
    console.error('Login error:', err instanceof Error ? err.message : 'unknown');
    res.status(500).json({ error: 'server_error', message: 'Something went wrong. Please try again.' });
  }
});

// POST /api/auth/signup
router.post('/signup', signupLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password, confirmPassword } = req.body || {};

    // Server-side validation (mirror client rules)
    const usernameCheck = validateUsername(username);
    if (!usernameCheck.valid) {
      res.status(400).json({ error: 'validation_error', field: 'username', message: usernameCheck.message });
      return;
    }

    const passwordCheck = validatePassword(password, username);
    if (!passwordCheck.valid) {
      res.status(400).json({ error: 'validation_error', field: 'password', message: passwordCheck.message });
      return;
    }

    if (password !== confirmPassword) {
      res.status(400).json({ error: 'validation_error', field: 'confirmPassword', message: 'Passwords do not match' });
      return;
    }

    // Case-insensitive uniqueness check — usernames stored lowercase
    const normalisedUsername = username.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { username: normalisedUsername } });
    if (existing) {
      res.status(409).json({ error: 'username_taken', message: 'This username is already taken' });
      return;
    }

    // Hash password with bcrypt (saltRounds: 12)
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        username: normalisedUsername,
        passwordHash,
        onboardingDone: false
      }
    });

    // Issue JWT using the same flow as login
    const token = issueToken(user.id);
    setAuthCookie(res, token);

    // Return token in body as well — iOS Safari PWA fallback (sessionStorage)
    res.status(201).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        onboardingDone: user.onboardingDone
      }
    });
  } catch (err) {
    console.error('Signup error:', err instanceof Error ? err.message : 'unknown');
    res.status(500).json({ error: 'server_error', message: 'Something went wrong. Please try again.' });
  }
});

// GET /api/auth/check-username?username=...
router.get('/check-username', checkUsernameLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const username = typeof req.query.username === 'string' ? req.query.username : '';

    const check = validateUsername(username);
    if (!check.valid) {
      res.status(400).json({ error: 'validation_error', message: check.message, available: false, username });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { username: username.toLowerCase() } });

    res.json({ available: !existing, username });
  } catch (err) {
    console.error('Check username error:', err instanceof Error ? err.message : 'unknown');
    res.status(500).json({ error: 'server_error', message: 'Something went wrong.' });
  }
});

// POST /api/auth/logout
router.post('/logout', (_req: Request, res: Response): void => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, username: true, email: true, name: true, avatar: true, onboardingDone: true }
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user });
  } catch (err) {
    console.error('Auth me error:', err instanceof Error ? err.message : 'unknown');
    res.status(500).json({ error: 'server_error' });
  }
});

// GET /api/auth/google/check — check if Google OAuth is configured
router.get('/google/check', (_req: Request, res: Response): void => {
  res.json({ configured: !!GOOGLE_CLIENT_ID && !!GOOGLE_CLIENT_SECRET });
});

// GET /api/auth/google — redirect to Google
router.get('/google', (req: Request, res: Response): void => {
  if (!GOOGLE_CLIENT_ID) {
    res.status(500).json({ error: 'Google OAuth not configured' });
    return;
  }

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_CALLBACK_URL,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent'
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

// GET /api/auth/google/callback
router.get('/google/callback', async (req: Request, res: Response): Promise<void> => {
  const { code } = req.query;

  if (!code || typeof code !== 'string') {
    res.redirect(`${FRONTEND_URL}?error=google_auth_failed`);
    return;
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_CALLBACK_URL,
        grant_type: 'authorization_code'
      })
    });

    const tokenData = (await tokenRes.json()) as { access_token?: string };

    if (!tokenData.access_token) {
      res.redirect(`${FRONTEND_URL}?error=google_token_failed`);
      return;
    }

    // Get user info
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });

    const googleUser = (await userInfoRes.json()) as {
      id: string;
      email?: string;
      name?: string;
      picture?: string;
    };

    if (!googleUser.email) {
      res.redirect(`${FRONTEND_URL}?error=google_no_email`);
      return;
    }

    // Find or create user
    let user = await prisma.user.findUnique({ where: { googleId: googleUser.id } });

    if (!user) {
      user = await prisma.user.findUnique({ where: { email: googleUser.email } });
      if (user) {
        // Link google to existing account
        user = await prisma.user.update({
          where: { id: user.id },
          data: { googleId: googleUser.id, avatar: googleUser.picture, name: googleUser.name || user.name }
        });
      } else {
        user = await prisma.user.create({
          data: {
            email: googleUser.email,
            googleId: googleUser.id,
            name: googleUser.name || '',
            avatar: googleUser.picture || '',
            onboardingDone: false
          }
        });
      }
    }

    const token = issueToken(user.id);
    setAuthCookie(res, token);

    // Pass token in URL for iOS Safari PWA fallback — frontend reads + removes it
    res.redirect(`${FRONTEND_URL}?_at=${encodeURIComponent(token)}`);
  } catch (err) {
    console.error('Google OAuth error:', err);
    res.redirect(`${FRONTEND_URL}?error=google_auth_error`);
  }
});

export default router;
