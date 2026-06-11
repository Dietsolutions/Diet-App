import crypto from 'crypto';
import { prisma } from '../lib/prisma';

const REFRESH_TOKEN_BYTES = 48;
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

export async function generateRefreshToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);

  await prisma.refreshToken.create({
    data: { userId, tokenHash, expiresAt },
  });

  return token;
}

export async function verifyRefreshToken(token: string): Promise<string | null> {
  const tokenHash = hashToken(token);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });

  if (!stored) return null;
  if (stored.revokedAt) return null;
  if (stored.expiresAt < new Date()) return null;

  return stored.userId;
}

export async function rotateRefreshToken(oldToken: string): Promise<{ accessToken: string; refreshToken: string } | null> {
  const userId = await verifyRefreshToken(oldToken);
  if (!userId) return null;

  const tokenHash = hashToken(oldToken);
  await prisma.refreshToken.update({
    where: { tokenHash },
    data: { revokedAt: new Date() },
  });

  const newRefreshToken = await generateRefreshToken(userId);

  const jwt = await import('jsonwebtoken');
  const secret = process.env.JWT_SECRET || 'dev-jwt-secret-not-for-production';
  const accessToken = jwt.default.sign({ userId }, secret, { expiresIn: '15m' });

  return { accessToken, refreshToken: newRefreshToken };
}

export async function revokeAllUserRefreshTokens(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export { REFRESH_TOKEN_EXPIRY_MS };
