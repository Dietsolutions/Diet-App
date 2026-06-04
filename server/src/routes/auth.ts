import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import nodemailer from 'nodemailer';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { setAuthCookie, clearAuthCookie } from '../utils/setAuthCookie';
import { logSecurityEvent } from '../utils/securityLogger';

function sanitizeText(text: string): string {
  return text.trim().replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

// SHA-256 hex of a token. We store only the hash of password-reset tokens
// in the database so that a DB read leak (e.g. via SQLi, backup dump, or
// compromised replica) does not let the attacker replay any reset link.
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

const router = Router();

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
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

function issueToken(userId: string): string {
  if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET not set');
  }
  const secret = process.env.JWT_SECRET || 'dev-jwt-secret-not-for-production';
  return jwt.sign({ userId }, secret, { expiresIn: '30d' });
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
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = issueToken(user.id);
    setAuthCookie(res, token);

    // The httpOnly cookie set above is the canonical auth channel.
    res.json({
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

    // Issue JWT using the same flow as login
    const token = issueToken(user.id);
    setAuthCookie(res, token);

    // The httpOnly cookie set above is the canonical auth channel.
    // We still return a non-secret user object in the body so the client
    // can hydrate state without an extra /me round-trip.
    res.status(201).json({
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

function base64UrlToBigInt(input: string): bigint {
  return BigInt('0x' + base64UrlDecode(input).toString('hex'));
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

    const token = issueToken(user.id);
    setAuthCookie(res, token);
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
      verified_email?: boolean;
      name?: string;
      picture?: string;
    };

    if (!googleUser.email) {
      res.redirect(`${FRONTEND_URL}?error=google_no_email`);
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
          res.redirect(`${FRONTEND_URL}?error=google_email_not_verified`);
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

    const token = issueToken(user.id);
    setAuthCookie(res, token);

    // Do NOT put the JWT in the redirect URL — Vercel edge logs capture
    // full request URLs, and the token would leak via Referer headers to
    // any third-party resource loaded by the SPA. The httpOnly cookie set
    // above is sufficient — the client picks up the session via
    // /api/auth/me on next render.
  } catch (err) {
    console.error('Google OAuth error:', err);
    res.redirect(`${FRONTEND_URL}?error=google_auth_error`);
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

// ── Account Deletion ─────────────────────────────────────────────────────────
router.delete('/delete-account', requireAuth, deleteAccountLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { password } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.userId! } });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    if (user.passwordHash) {
      if (!password) { res.status(400).json({ error: 'Password required' }); return; }
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) { res.status(403).json({ error: 'Invalid password' }); return; }
    }

    await prisma.user.delete({ where: { id: req.userId! } });

    clearAuthCookie(res);
    res.json({ success: true });
  } catch (err) {
    console.error('Account deletion error:', err);
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
        console.log(`[Password Reset] Email sent to ${email}`);
      } catch (mailErr) {
        console.error(`[Password Reset] Failed to send email to ${email}:`, (mailErr as Error).message);
        res.status(500).json({ error: 'Failed to send email. SMTP configuration may be incorrect.' });
        return;
      }
    } else {
      console.log(`[Password Reset] Token for ${email}: ${token}`);
      console.log(`[Password Reset] URL: ${resetUrl}`);
      console.log(`[Password Reset] SMTP not configured — token logged to console only`);
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
