import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import nodemailer from 'nodemailer';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthRequest, JWT_SECRET } from '../middleware/auth';
import { setAuthCookie, setRefreshCookie, clearAllAuthCookies } from '../utils/setAuthCookie';
import { generateRefreshToken, revokeAllUserRefreshTokens } from '../utils/refreshToken';
import { logSecurityEvent } from '../utils/securityLogger';


function sanitizeText(text: unknown): string {
  if (typeof text !== 'string') return '';
  return text.trim().replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

// SHA-256 hex of a token. We store only the hash of password-reset tokens
// in the database so that a DB read leak (e.g. via SQLi, backup dump, or
// compromised replica) does not let the attacker replay any reset link.
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

const router = Router();

// ── Account Lockout ───────────────────────────────────────────────────────
// Per-username lockout to prevent credential-stuffing across IPs.
// In-memory Map is fine for ~30 users; replace with Redis when scaling up.
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

interface LockoutEntry {
  count: number;
  lockedUntil: number;
}

const loginLockouts = new Map<string, LockoutEntry>();

function getLockoutRemainingMs(username: string): number {
  const entry = loginLockouts.get(username);
  if (!entry) return 0;
  const remaining = entry.lockedUntil - Date.now();
  if (remaining <= 0) {
    loginLockouts.delete(username);
    return 0;
  }
  return remaining;
}

function recordFailedAttempt(username: string): boolean {
  const now = Date.now();
  const entry = loginLockouts.get(username) || { count: 0, lockedUntil: 0 };
  // If lock expired, reset
  if (entry.lockedUntil && entry.lockedUntil <= now) {
    entry.count = 0;
    entry.lockedUntil = 0;
  }
  entry.count += 1;
  if (entry.count >= LOCKOUT_THRESHOLD) {
    entry.lockedUntil = now + LOCKOUT_DURATION_MS;
    loginLockouts.set(username, entry);
    return true;
  }
  loginLockouts.set(username, entry);
  return false;
}

function resetFailedAttempts(username: string): void {
  loginLockouts.delete(username);
}

// ── SMTP / Email ──────────────────────────────────────────────────────────
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@dietplan.app';

function createTransporter() {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

// ── Review demo account (App Store / Play Store reviewer) ─────────────────
// IMPORTANT: only created when BOTH env vars are explicitly set in production.
// This avoids shipping a hard-coded backdoor credential in any deployment
// that forgets to override the defaults.
const REVIEW_USERNAME = process.env.REVIEW_USERNAME;
const REVIEW_PASSWORD = process.env.REVIEW_PASSWORD;

// Minimal-but-complete UserProfile for the review account. Field set
// matches the UserProfile schema's required columns (no nullable defaults).
function REVIEW_PROFILE_DATA(userId: string) {
  return {
    userId,
    name: 'Reviewer',
    age: 30,
    gender: 'prefer_not_to_say',
    country: 'India',
    city: 'Bengaluru',
    heightCm: 170,
    weightKg: 70,
    targetWeightKg: 65,
    mealPreference: 'vegetarian',
    primaryGoal: 'maintain',
    activityLevel: 'moderate',
    // Macro targets for maintenance at 70 kg / moderate activity. These
    // are also visible to the reviewer as concrete numbers in the UI.
    tdee: 2200,
    targetCalories: 2200,
    proteinTarget: 110,
    fatTarget: 73,
    carbTarget: 275,
    fibreTarget: 30,
  };
}

async function ensureReviewAccount(): Promise<void> {
  if (!REVIEW_USERNAME || !REVIEW_PASSWORD) return;
  if (process.env.NODE_ENV !== 'production') return;
  // Retry with backoff so transient Neon cold-start failures don't leave
  // the reviewer unable to log in.
  const MAX_ATTEMPTS = 5;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const existing = await prisma.user.findUnique({ where: { username: REVIEW_USERNAME } });
      if (existing) {
        // Mark existing review account (idempotent).
        if (!existing.isReview) {
          await prisma.user.update({ where: { id: existing.id }, data: { isReview: true } });
        }
        // Make sure the UserProfile row exists (in case the account predates this code).
        const profile = await prisma.userProfile.findUnique({ where: { userId: existing.id } });
        if (!profile) {
          await prisma.userProfile.create({
            data: REVIEW_PROFILE_DATA(existing.id),
          });
        }
        return;
      }
      const passwordHash = await bcrypt.hash(REVIEW_PASSWORD, 12);
      const user = await prisma.user.create({
        data: {
          username: REVIEW_USERNAME,
          passwordHash,
          onboardingDone: true,
          isReview: true,
        },
      });

      // Create a complete UserProfile so the app shows real content for the reviewer.
      await prisma.userProfile.create({
        data: REVIEW_PROFILE_DATA(user.id),
      });
      console.log(`[Auth] Review account created: ${REVIEW_USERNAME}`);
      return;
    } catch (err) {
      const msg = (err as Error).message;
      if (attempt === MAX_ATTEMPTS) {
        console.error(`[Auth] Could not create review account after ${MAX_ATTEMPTS} attempts: ${msg}`);
        return;
      }
      // Exponential backoff: 200ms, 400ms, 800ms, 1600ms, 3200ms
      const delay = 200 * Math.pow(2, attempt - 1);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}
if (REVIEW_USERNAME && REVIEW_PASSWORD && process.env.NODE_ENV === 'production') {
  ensureReviewAccount();
}

const USERNAME_REGEX = /^[A-Za-z0-9_]{3,20}$/;
const RESERVED_USERNAMES = new Set([
  'admin', 'root', 'superuser', 'system', 'support', 'help', 'info',
  'dietplan', 'api', 'null', 'undefined', 'true', 'false', 'nan',
]);

function validateUsername(username: string): { valid: boolean; message?: string } {
  if (typeof username !== 'string' || username.length === 0) return { valid: false, message: 'Username is required' };
  if (/\s/.test(username)) return { valid: false, message: 'Username cannot contain spaces' };
  if (username.length < 3 || username.length > 20) return { valid: false, message: 'Username must be 3\u201320 characters' };
  if (!USERNAME_REGEX.test(username)) return { valid: false, message: 'Only letters, numbers and _ allowed' };
  if (RESERVED_USERNAMES.has(username.toLowerCase())) return { valid: false, message: 'This username is not available' };
  return { valid: true };
}

function validatePassword(password: string, username: string): { valid: boolean; message?: string } {
  if (typeof password !== 'string' || password.length === 0) return { valid: false, message: 'Password is required' };
  if (password.length < 6) return { valid: false, message: 'Password must be at least 6 characters' };
  if (password.length > 72) return { valid: false, message: 'Password is too long' };
  if (/^\d+$/.test(password)) return { valid: false, message: 'Password cannot be all numbers' };
  if (username && password.toLowerCase() === username.toLowerCase()) return { valid: false, message: 'Password cannot be your username' };
  return { valid: true };
}

// Rate limit: 100 login attempts per IP per 15 minutes
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error: 'rate_limit',
      message: 'Too many login attempts. Please wait 15 minutes before trying again.'
    });
  }
});

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
// Google redirects here with ?code=... — this must be the BACKEND origin (the server
// exchanges the code and redirects onward to FRONTEND_URL with the JWT).
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/api/auth/google/callback';
const FRONTEND_URL = process.env.FRONTEND_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5173');

// Validate and sanitize OAuth post-login redirect targets.
// Allows: relative paths (/tab, /profile) and same-origin absolute URLs.
// Rejects: any other-origin URL (open redirect attack vector).
function sanitizeOAuthRedirect(redirect: string): string {
  if (!redirect) return FRONTEND_URL;
  if (/^\/[a-zA-Z0-9\-._~!$&'()*+,;=:@/?#%]*$/.test(redirect)) {
    return `${FRONTEND_URL}${redirect}`;
  }
  try {
    const target = new URL(redirect);
    const base = new URL(FRONTEND_URL);
    if (target.origin === base.origin) return redirect;
  } catch {}
  return FRONTEND_URL;
}

function issueToken(userId: string): string {
  // 7 days, not 15m. The client has no auto-refresh, and the native build can't
  // use the refresh-token cookie at all (cross-origin WebView), so a 15-minute
  // access token meant any idle gap (e.g. pausing on the plan-confirm screen)
  // logged the user out with "Token expired". 7d matches the refresh-token
  // lifetime and covers normal multi-hour/day usage. See DECISIONS — the more
  // secure long-term fix is wiring real auto-refresh (return the refresh token
  // to native, retry on 401), but this removes the broken-session UX now.
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

async function issueTokenPair(userId: string): Promise<{ accessToken: string; refreshToken: string }> {
  const accessToken = issueToken(userId);
  const refreshToken = await generateRefreshToken(userId);
  return { accessToken, refreshToken };
}

function setTokenCookies(res: Response, accessToken: string, refreshToken: string): void {
  setAuthCookie(res, accessToken);
  setRefreshCookie(res, refreshToken);
}

// POST /api/auth/login (username + password)
router.post('/login', loginLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body;
    const cleanUsername = sanitizeText(username);
    const cleanPassword = sanitizeText(password);

    if (!cleanUsername || !cleanPassword) {
      res.status(400).json({ error: 'Username and password required' });
      return;
    }

    // Case-insensitive lookup (usernames are stored lowercase for new accounts)
    const normalisedUsername = cleanUsername.toLowerCase();

    // Check per-account lockout before verifying credentials
    const lockMs = getLockoutRemainingMs(normalisedUsername);
    if (lockMs > 0) {
      const remainingMinutes = Math.ceil(lockMs / 60000);
      logSecurityEvent('account_locked', {
        ip: req.ip,
        path: req.path,
        username: normalisedUsername,
        remainingMinutes,
      });
      res.status(429).json({
        error: 'account_locked',
        message: `Account temporarily locked due to too many failed attempts. Try again in ${remainingMinutes} minute${remainingMinutes === 1 ? '' : 's'}.`
      });
      return;
    }
    let user = await prisma.user.findUnique({ where: { username: normalisedUsername } });
    // Fallback: check original case for legacy accounts stored with mixed case
    if (!user && normalisedUsername !== cleanUsername) {
      user = await prisma.user.findUnique({ where: { username: cleanUsername } });
    }

    if (!user || !user.passwordHash) {
      logSecurityEvent('login_failed', {
        ip: req.ip,
        path: req.path,
        reason: 'user_not_found',
        username: normalisedUsername,
      });
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const valid = await bcrypt.compare(cleanPassword, user.passwordHash);

    if (!valid) {
      logSecurityEvent('login_failed', {
        ip: req.ip,
        path: req.path,
        reason: 'wrong_password',
        userId: user.id,
      });
      const locked = recordFailedAttempt(normalisedUsername);
      if (locked) {
        logSecurityEvent('account_locked', {
          ip: req.ip,
          path: req.path,
          username: normalisedUsername,
          durationMinutes: 15,
        });
      }
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    resetFailedAttempts(normalisedUsername);

    const { accessToken, refreshToken } = await issueTokenPair(user.id);
    setTokenCookies(res, accessToken, refreshToken);

    res.json({
      // Return the JWT in the body too — native (Capacitor) builds can't rely on
      // the cross-origin auth cookie, so the client keeps this as a Bearer token.
      token: accessToken,
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
    const msg = err instanceof Error ? err.message : 'unknown';
    console.error('Login error:', msg);
    if (msg.includes('Can\'t reach database server') || msg.includes('connect ETIMEDOUT') || msg.includes('Connection timed out')) {
      res.status(503).json({ error: 'database_unavailable', message: 'Database is waking up. Please try again in a few seconds.' });
    } else {
      res.status(500).json({ error: 'server_error', message: 'Something went wrong. Please try again.' });
    }
  }
});

// POST /api/auth/signup
router.post('/signup', signupLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password, confirmPassword } = req.body || {};
    // Strip NUL bytes / control chars that Postgres TEXT cannot store
    const cleanUsername     = sanitizeText(username);
    const cleanPassword     = sanitizeText(password);
    const cleanConfirm      = sanitizeText(confirmPassword);

    // Server-side validation (mirror client rules)
    const usernameCheck = validateUsername(cleanUsername);
    if (!usernameCheck.valid) {
      res.status(400).json({ error: 'validation_error', field: 'username', message: usernameCheck.message });
      return;
    }

    const passwordCheck = validatePassword(cleanPassword, cleanUsername);
    if (!passwordCheck.valid) {
      res.status(400).json({ error: 'validation_error', field: 'password', message: passwordCheck.message });
      return;
    }

    if (cleanPassword !== cleanConfirm) {
      res.status(400).json({ error: 'validation_error', field: 'confirmPassword', message: 'Passwords do not match' });
      return;
    }

    // Case-insensitive uniqueness check — usernames stored lowercase.
    // We check optimistically to give a clean 409 for the common case, but
    // a TOCTOU race between two concurrent signups for the same username
    // is still possible. The unique constraint + Prisma P2002 catch
    // below handles that case so the second request gets a clean 409 too
    // (not a 500).
    const normalisedUsername = cleanUsername.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { username: normalisedUsername } });
    if (existing) {
      res.status(409).json({ error: 'username_taken', message: 'This username is already taken' });
      return;
    }

    // Hash password with bcrypt (saltRounds: 12)
    const passwordHash = await bcrypt.hash(cleanPassword, 12);

    // Create user. If a concurrent signup won the race, Prisma throws
    // P2002 (unique constraint violation) — we translate to 409 instead
    // of a 500.
    let user;
    try {
      user = await prisma.user.create({
        data: {
          username: normalisedUsername,
          passwordHash,
          onboardingDone: false
        }
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        res.status(409).json({ error: 'username_taken', message: 'This username is already taken' });
        return;
      }
      throw err;
    }

    const { accessToken, refreshToken } = await issueTokenPair(user.id);
    setTokenCookies(res, accessToken, refreshToken);

    res.status(201).json({
      // Return the JWT in the body too — native (Capacitor) builds can't rely on
      // the cross-origin auth cookie, so the client keeps this as a Bearer token.
      token: accessToken,
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
    const msg = err instanceof Error ? err.message : 'unknown';
    console.error('Signup error:', msg);
    if (msg.includes('Can\'t reach database server') || msg.includes('connect ETIMEDOUT') || msg.includes('Connection timed out')) {
      res.status(503).json({ error: 'database_unavailable', message: 'Database is waking up. Please try again in a few seconds.' });
    } else {
      res.status(500).json({ error: 'server_error', message: 'Something went wrong. Please try again.' });
    }
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
router.post('/logout', async (req: Request, res: Response): Promise<void> => {
  try {
    const refreshTokenValue = req.cookies?.refreshToken;
    if (refreshTokenValue) {
      const tokenHash = crypto.createHash('sha256').update(refreshTokenValue, 'utf8').digest('hex');
      await prisma.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
  } catch (err) {
    console.warn('[Logout] DB revocation failed (non-fatal):', (err as Error).message);
  } finally {
    clearAllAuthCookies(res);
    res.json({ ok: true });
  }
});

// POST /api/auth/refresh — rotate refresh token and issue new access token
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  const refreshTokenValue = req.cookies?.refreshToken;
  if (!refreshTokenValue) {
    res.status(401).json({ error: 'Refresh token required' });
    return;
  }

  try {
    const { rotateRefreshToken } = await import('../utils/refreshToken');
    const result = await rotateRefreshToken(refreshTokenValue);
    if (!result) {
      clearAllAuthCookies(res);
      res.status(401).json({ error: 'Invalid or expired refresh token' });
      return;
    }
    setTokenCookies(res, result.accessToken, result.refreshToken);
    res.json({ ok: true });
  } catch {
    clearAllAuthCookies(res);
    res.status(500).json({ error: 'server_error' });
  }
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

// ── Apple Sign-In ────────────────────────────────────────────────────────────
// Apple's identity token is a JWT signed with ES256 by one of Apple's JWKS keys.
// We MUST verify the signature cryptographically — decoding without verification
// lets any attacker forge a valid token and impersonate any Apple user.
//
// Apple rotates keys; we cache the JWKS for 24h.
const APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID || ''; // e.g. com.dietplan.tracker.signin (Service ID)
const APPLE_JWKS_URL  = 'https://appleid.apple.com/auth/keys';
const APPLE_ISSUER    = 'https://appleid.apple.com';

let appleJwksCache: { keys: any[]; fetchedAt: number } | null = null;
const APPLE_JWKS_TTL_MS = 24 * 60 * 60 * 1000;

async function getAppleJwks(forceRefresh = false): Promise<any[]> {
  if (!forceRefresh && appleJwksCache && Date.now() - appleJwksCache.fetchedAt < APPLE_JWKS_TTL_MS) {
    return appleJwksCache.keys;
  }
  const res = await fetch(APPLE_JWKS_URL);
  if (!res.ok) throw new Error(`Apple JWKS fetch failed: ${res.status}`);
  const data = (await res.json()) as { keys: any[] };
  appleJwksCache = { keys: data.keys, fetchedAt: Date.now() };
  return data.keys;
}

function base64UrlDecode(input: string): Buffer {
  const pad = input.length % 4 === 0 ? 0 : 4 - (input.length % 4);
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad), 'base64');
}

function ecdsaSigDerToRaw(sig: Buffer, keySizeBytes: number): Buffer {
  // Convert ASN.1 DER signature (used by Node crypto) to raw r||s (used by JWT/JWKS)
  if (sig[0] !== 0x30) throw new Error('Invalid DER signature');
  let offset = 2;
  if (sig[1] & 0x80) offset += (sig[1] & 0x7f);
  if (sig[offset] !== 0x02) throw new Error('Invalid DER signature (r)');
  let rLen = sig[offset + 1];
  let rStart = offset + 2;
  if (rLen & 0x80) { rStart += (rLen & 0x7f); rLen = sig[rStart - 1]; }
  let r = sig.subarray(rStart, rStart + rLen);
  if (r.length > keySizeBytes) r = r.subarray(r.length - keySizeBytes);
  offset = rStart + rLen;
  if (sig[offset] !== 0x02) throw new Error('Invalid DER signature (s)');
  let sLen = sig[offset + 1];
  let sStart = offset + 2;
  if (sLen & 0x80) { sStart += (sLen & 0x7f); sLen = sig[sStart - 1]; }
  let s = sig.subarray(sStart, sStart + sLen);
  if (s.length > keySizeBytes) s = s.subarray(s.length - keySizeBytes);
  return Buffer.concat([r, s]);
}

interface AppleClaims {
  iss: string;
  aud: string;
  exp: number;
  iat: number;
  sub: string;   // stable Apple user ID for this app
  email?: string;
  email_verified?: boolean | string;
  is_private_email?: boolean | string;
  nonce?: string;
  nonce_supported?: boolean;
  c_hash?: string;
  auth_time?: number;
}

async function verifyAppleIdentityToken(identityToken: string): Promise<AppleClaims> {
  const parts = identityToken.split('.');
  if (parts.length !== 3) throw new Error('Malformed identity token');

  const header = JSON.parse(base64UrlDecode(parts[0]).toString('utf8')) as { kid: string; alg: string };
  if (header.alg !== 'ES256') throw new Error('Unexpected alg: ' + header.alg);

  const claims = JSON.parse(base64UrlDecode(parts[1]).toString('utf8')) as AppleClaims;

  // Find the matching JWKS key. If not found in cache, force-refresh once
  // (Apple may have rotated keys since the last fetch).
  let keys = await getAppleJwks();
  let key = keys.find((k: any) => k.kid === header.kid);
  if (!key) {
    keys = await getAppleJwks(true);
    key = keys.find((k: any) => k.kid === header.kid);
    if (!key) throw new Error('No matching JWKS key for kid ' + header.kid);
  }
  if (key.kty !== 'EC' || key.crv !== 'P-256' || !key.x || !key.y) {
    throw new Error('JWKS key is not P-256 EC');
  }

  // Build a Node KeyObject from the JWK. The JWK object must NOT include
  // a 'd' (private) component — Node's createPublicKey treats that as an
  // error in some versions. Build the JWK explicitly without 'd'.
  const crypto = await import('crypto');
  const pubKey = crypto.createPublicKey({
    key: {
      kty: 'EC',
      crv: 'P-256',
      x: base64UrlDecode(key.x),
      y: base64UrlDecode(key.y),
    } as any,
    format: 'jwk',
  });

  // Verify ES256 signature
  const signedData = Buffer.from(parts[0] + '.' + parts[1], 'utf8');
  const derSig = base64UrlDecode(parts[2]);
  const rawSig = ecdsaSigDerToRaw(derSig, 32);
  const ok = crypto.verify('SHA256', signedData, { key: pubKey, dsaEncoding: 'ieee-p1363' }, rawSig);
  if (!ok) throw new Error('Invalid identity token signature');

  // Validate standard claims
  const now = Math.floor(Date.now() / 1000);
  if (claims.iss !== APPLE_ISSUER) throw new Error('Invalid issuer');
  if (claims.aud !== APPLE_CLIENT_ID) throw new Error('Invalid audience (aud=' + claims.aud + ')');
  if (claims.exp < now) throw new Error('Identity token expired');
  if (claims.iat > now + 60) throw new Error('Identity token issued in the future');
  if (!claims.sub) throw new Error('Missing sub claim');

  return claims;
}

// GET /api/auth/apple/check — check if Apple Sign-In is properly configured on the server
router.get('/apple/check', (_req: Request, res: Response): void => {
  res.json({ configured: !!APPLE_CLIENT_ID });
});

// POST /api/auth/apple/callback — verify Apple identity token and create/link the user account
router.post('/apple/callback', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!APPLE_CLIENT_ID) {
      res.status(503).json({ error: 'apple_not_configured', message: 'Apple Sign-In is not configured on this server. Set APPLE_CLIENT_ID.' });
      return;
    }

    const { identityToken, fullName, email: providedEmail } = req.body || {};
    if (!identityToken) {
      res.status(400).json({ error: 'Identity token required' });
      return;
    }

    let claims: AppleClaims;
    try {
      claims = await verifyAppleIdentityToken(identityToken);
    } catch (err) {
      console.warn('[Apple] Identity token verification failed:', (err as Error).message);
      res.status(401).json({ error: 'invalid_identity_token', message: 'Apple identity token could not be verified.' });
      return;
    }

    const appleUserId = claims.sub;
    // Apple only sends the user's email on the FIRST sign-in. On subsequent sign-ins,
    // the iOS app must supply it from its local cache (we accept `providedEmail`).
    const appleEmail = (claims.email || providedEmail || '').toLowerCase();
    // Apple's email_verified claim may be a boolean or the string "true"/"false".
    // Treat only strict `true` as verified. Anything else → do NOT auto-link.
    const emailVerified = claims.email_verified === true || claims.email_verified === 'true';

    // Find or create the user. Look up by appleId first.
    let user = await prisma.user.findUnique({ where: { appleId: appleUserId } });

    // If no appleId match, attempt to link to an existing account with the
    // same email — BUT only if the Apple-asserted email is verified. This
    // prevents account takeover via the email-auto-link vector.
    if (!user && appleEmail && emailVerified) {
      const byEmail = await prisma.user.findUnique({ where: { email: appleEmail } });
      if (byEmail) {
        user = await prisma.user.update({
          where: { id: byEmail.id },
          data: {
            appleId: appleUserId,
            name: fullName?.givenName ? `${fullName.givenName} ${fullName.familyName || ''}`.trim() : byEmail.name,
          },
        });
      }
    }

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: appleEmail || null,
          appleId: appleUserId,
          name: fullName?.givenName ? `${fullName.givenName} ${fullName.familyName || ''}`.trim() : '',
          onboardingDone: false,
        }
      });
    }

    const { accessToken, refreshToken } = await issueTokenPair(user.id);
    setTokenCookies(res, accessToken, refreshToken);
    res.json({
      user: { id: user.id, username: user.username, email: user.email, name: user.name, avatar: user.avatar, onboardingDone: user.onboardingDone }
    });
  } catch (err) {
    console.error('Apple sign-in error:', err);
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

  const csrfToken = crypto.randomBytes(16).toString('hex');
  // Validate before embedding — prevents open-redirect if state is replayed
  const rawRedirect = typeof req.query.redirect === 'string' ? req.query.redirect : '';
  const redirectTo = rawRedirect && /^\/[a-zA-Z0-9\-._~!$&'()*+,;=:@/?#%]*$/.test(rawRedirect) ? rawRedirect : '';
  res.cookie('oauth_state', JSON.stringify({ state: csrfToken }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600_000,
  });

  // Embed the redirect URL inside the state parameter so it survives
  // across browser contexts (e.g., Chrome opened from Capacitor WebView).
  // Google returns this verbatim in the callback.
  const statePayload = Buffer.from(JSON.stringify({ csrf: csrfToken, redirect: redirectTo })).toString('base64url');

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_CALLBACK_URL,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
    state: statePayload,
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

// GET /api/auth/google/callback
router.get('/google/callback', async (req: Request, res: Response): Promise<void> => {
  const { code, state: stateRaw } = req.query;

  // Decode the state payload (JSON embedded in OAuth state parameter)
  let csrfToken = '';
  let redirectTo = FRONTEND_URL;
  try {
    const decoded = JSON.parse(Buffer.from(stateRaw as string, 'base64url').toString());
    csrfToken = decoded.csrf || '';
    if (decoded.redirect) redirectTo = sanitizeOAuthRedirect(decoded.redirect);
  } catch { /* fall through — will check CSRF below */ }

  // Verify CSRF from cookie (cross-check against decoded state)
  let storedCsrf: string | undefined;
  try { storedCsrf = JSON.parse(req.cookies?.oauth_state || 'null').state; } catch {}

  if (!csrfToken || !storedCsrf || csrfToken !== storedCsrf) {
    res.clearCookie('oauth_state');
    res.redirect(`${FRONTEND_URL}?error=invalid_state`);
    return;
  }
  res.clearCookie('oauth_state');

  const baseRedirect = (s: string) => `${redirectTo}${s.startsWith('?') ? s : `?${s}`}`;

  if (!code || typeof code !== 'string') {
    res.redirect(baseRedirect('error=google_auth_failed'));
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
      res.redirect(baseRedirect('error=google_token_failed'));
      return;
    }

    // Get user info
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });

    const googleUser = (await userInfoRes.json()) as {
      id: string;
      email?: string;
      verified_email?: boolean;
      name?: string;
      picture?: string;
    };

    if (!googleUser.email) {
      res.redirect(baseRedirect('error=google_no_email'));
      return;
    }

    // Google marks the email verified when it is. The userinfo endpoint
    // returns verified_email as a boolean. If false, do NOT auto-link to
    // an existing account by email — the request might be impersonation.
    const emailVerified = googleUser.verified_email === true;

    // Find or create user
    let user = await prisma.user.findUnique({ where: { googleId: googleUser.id } });

    if (!user) {
      user = await prisma.user.findUnique({ where: { email: googleUser.email } });
      if (user) {
        if (!emailVerified) {
          // Refuse to link unverified Google account to existing email.
          // The user must sign in with the original method to claim it.
          res.redirect(baseRedirect('error=google_email_not_verified'));
          return;
        }
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

    const { accessToken, refreshToken } = await issueTokenPair(user.id);
    setTokenCookies(res, accessToken, refreshToken);

    // For native app deep links (dietplan://), use an HTML page with JS
    // redirect instead of an HTTP 302.  Chrome/Safari on mobile may
    // ignore 302 redirects to custom URL schemes (especially iOS Safari).
    // The JS-based redirect reliably triggers the OS to open the app.
    // We also pass the token in the URL since the httpOnly cookie was set
    // in the system browser (not the WebView), and the app needs it to
    // authenticate on return.
    if (redirectTo.startsWith('dietplan://')) {
      const delim = redirectTo.includes('?') ? '&' : '?';
      // JSON.stringify escapes all JS metacharacters — safe to inline in a script block
      const safeHref = JSON.stringify(`${redirectTo}${delim}token=${encodeURIComponent(accessToken)}`);
      res.send(`<!doctype html><html><body><script>
window.location.href = ${safeHref};
<\/script></body></html>`);
      return;
    }

    res.redirect(redirectTo);
    return;
  } catch (err) {
    console.error('Google OAuth error:', err);
    res.redirect(baseRedirect('error=google_auth_error'));
  }
});

// Rate limit: 2 account deletion attempts per user per hour
const deleteAccountLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 2,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req) => (req as AuthRequest).userId || req.ip || 'unknown',
  handler: (_req, res) => {
    res.status(429).json({ error: 'rate_limit', message: 'Too many deletion attempts. Try again in an hour.' });
  }
});

// ── Deletion confirmation tokens (DB-backed) ────────────────────────────────
// For OAuth-only users (no passwordHash), a short-lived token is sent via
// email and must be confirmed before the account is deleted. Tokens are stored
// as SHA-256 hashes in the database, same pattern as PasswordResetToken.

// ── Account Deletion ─────────────────────────────────────────────────────────
router.delete('/delete-account', requireAuth, deleteAccountLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { password, deletionToken } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.userId! } });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    if (user.passwordHash) {
      // Password-authenticated users must re-enter their password
      if (!password) { res.status(400).json({ error: 'Password required' }); return; }
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) { res.status(403).json({ error: 'Invalid password' }); return; }
    } else {
      // OAuth-only users (Google/Apple) must provide a deletion confirmation token
      if (!deletionToken) {
        res.status(403).json({
          error: 'deletion_token_required',
          message: 'OAuth accounts require email confirmation. Use POST /api/auth/request-deletion to get a confirmation link.',
        });
        return;
      }
      const stored = await prisma.deletionConfirmToken.findUnique({ where: { tokenHash: hashToken(deletionToken) } });
      if (!stored || stored.userId !== req.userId! || stored.expiresAt < new Date() || stored.usedAt) {
        res.status(403).json({ error: 'Invalid or expired deletion token. Request a new one.' });
        return;
      }
      await prisma.deletionConfirmToken.update({ where: { id: stored.id }, data: { usedAt: new Date() } });
    }

    await revokeAllUserRefreshTokens(req.userId!);
    await prisma.user.delete({ where: { id: req.userId! } });

    clearAllAuthCookies(res);
    res.json({ success: true });
  } catch (err) {
    console.error('Account deletion error:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// ── Request Deletion Confirmation (OAuth users) ──────────────────────────────
// Generates a short-lived token and sends it to the user's registered email.
// Rate-limited to 2 requests per user per hour (same as delete endpoint).
router.post('/request-deletion', requireAuth, deleteAccountLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId! } });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    // Only needed for OAuth-only users
    if (user.passwordHash) {
      res.status(400).json({ error: 'Password users should use DELETE /api/auth/delete-account with password field.' });
      return;
    }

    // Check SMTP is configured
    const transporter = createTransporter();
    if (!transporter || !user.email) {
      res.status(400).json({
        error: 'email_not_configured',
        message: 'Account deletion requires email confirmation, but no email is on file or SMTP is not configured. Please contact support@dietplan.app.',
      });
      return;
    }

    // Generate short-lived token (15 minutes) — store SHA-256 hash
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Clean up expired tokens for this user before creating a new one
    await prisma.deletionConfirmToken.deleteMany({
      where: { userId: req.userId!, expiresAt: { lt: new Date() } }
    });

    await prisma.deletionConfirmToken.create({
      data: { userId: req.userId!, tokenHash, expiresAt }
    });

    // Build confirmation link
    const confirmUrl = `${FRONTEND_URL || 'http://localhost:5173'}/confirm-deletion?token=${token}`;

    try {
      await transporter.sendMail({
        from: EMAIL_FROM,
        to: user.email,
        subject: 'Confirm Account Deletion — Diet Plan & Tracker',
        text: `You requested to delete your Diet Plan & Tracker account.\n\nClick this link to confirm deletion — this link expires in 15 minutes:\n${confirmUrl}\n\nIf you did not request this, you can ignore this email. No changes have been made to your account.\n\n— Diet Plan & Tracker`,
        html: `<p>You requested to delete your Diet Plan & Tracker account.</p><p>Click the link below to confirm deletion — this link expires in <strong>15 minutes</strong>:</p><p><a href="${confirmUrl}">${confirmUrl}</a></p><p>If you did not request this, you can ignore this email. No changes have been made to your account.</p><p>— Diet Plan & Tracker</p>`,
      });
    } catch (mailErr) {
      // Leave the token record — it will expire naturally. No rollback needed.
      console.error('[Account Deletion] Confirmation email failed:', (mailErr as Error).message);
      res.status(500).json({ error: 'Failed to send confirmation email. Please try again or contact support.' });
      return;
    }

    res.json({ success: true, message: 'Confirmation email sent. Check your inbox (and spam folder).' });
  } catch (err) {
    console.error('Account deletion request error:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

// Rate limit: 3 forgot-password requests per IP per hour
const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ error: 'rate_limit', message: 'Too many password reset requests. Try again in an hour.' });
  }
});

// Rate limit: 10 reset-password attempts per IP per hour
const resetPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ error: 'rate_limit', message: 'Too many reset attempts. Try again in an hour.' });
  }
});

// ── Password Reset ───────────────────────────────────────────────────────────
router.post('/forgot-password', forgotPasswordLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    if (!email) { res.status(400).json({ error: 'Email required' }); return; }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.json({ success: true });
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    // Store the SHA-256 hash of the token, not the token itself, so a
    // DB compromise cannot grant the attacker any reset capability.
    const tokenHash = hashToken(token);
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt }
    });

    const resetUrl = `${FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${token}`;

    // Send email via SMTP if configured, otherwise log to console
    const transporter = createTransporter();
    if (transporter) {
      try {
        await transporter.sendMail({
          from: EMAIL_FROM,
          to: email,
          subject: 'Reset Your Diet Plan Password',
          text: `Click this link to reset your password: ${resetUrl}\n\nThis link expires in 1 hour.\n\nIf you did not request this, you can ignore this email.`,
          html: `<p>Click the link below to reset your password:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>This link expires in 1 hour.</p><p>If you did not request this, you can ignore this email.</p>`,
        });
        console.log('[Password Reset] Email dispatched');
      } catch (mailErr) {
        console.error('[Password Reset] SMTP send failed:', (mailErr as Error).message);
        res.status(500).json({ error: 'Failed to send email. SMTP configuration may be incorrect.' });
        return;
      }
    } else {
      // SECURITY: never log the plaintext token or the full reset URL.
      // A Vercel log reader would be able to replay the link and reset
      // any user's password. The dev-only hint below tells the developer
      // to check their Mailtrap / local SMTP setup.
      console.log('[Password Reset] SMTP not configured — token generated but not delivered. Set SMTP_HOST etc. to enable email delivery.');
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

router.get('/check-reset-token', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.query;
    if (!token || typeof token !== 'string') { res.json({ valid: false }); return; }

    const resetToken = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!resetToken) { res.json({ valid: false }); return; }
    if (resetToken.usedAt) { res.json({ valid: false, reason: 'already_used' }); return; }
    if (resetToken.expiresAt < new Date()) { res.json({ valid: false, reason: 'expired' }); return; }

    res.json({ valid: true });
  } catch (err) {
    console.warn('Check reset token failed:', (err as Error)?.message);
    res.json({ valid: false });
  }
});

router.post('/reset-password', resetPasswordLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, password } = req.body;
    if (!token || !password) { res.status(400).json({ error: 'Token and password required' }); return; }
    if (password.length < 6) { res.status(400).json({ error: 'Password must be at least 6 characters' }); return; }

    const resetToken = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!resetToken) { res.status(400).json({ error: 'Invalid or expired token' }); return; }
    if (resetToken.usedAt) { res.status(400).json({ error: 'Token already used' }); return; }
    if (resetToken.expiresAt < new Date()) { res.status(400).json({ error: 'Token expired' }); return; }

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.$transaction([
      prisma.user.update({ where: { id: resetToken.userId }, data: { passwordHash } }),
      prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } })
    ]);

    res.json({ success: true });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

export default router;
