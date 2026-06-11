import { Response, CookieOptions } from 'express';
import { REFRESH_TOKEN_EXPIRY_MS } from './refreshToken';

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

const isProd = () => process.env.NODE_ENV === 'production';

/**
 * Set the access token (short-lived JWT) cookie.
 * Path: '/' — all routes require auth.
 */
export function setAuthCookie(res: Response, token: string): void {
  const options: CookieOptions = {
    httpOnly: true,
    secure: isProd(),
    sameSite: 'lax',
    maxAge: FIFTEEN_MINUTES_MS,
    path: '/',
  };

  res.cookie('token', token, options);
}

/**
 * Set the refresh token (long-lived, DB-backed) cookie.
 * Path: '/api/auth' — only auth endpoints can read it.
 */
export function setRefreshCookie(res: Response, token: string): void {
  const options: CookieOptions = {
    httpOnly: true,
    secure: isProd(),
    sameSite: 'lax',
    maxAge: REFRESH_TOKEN_EXPIRY_MS,
    path: '/api/auth',
  };

  res.cookie('refreshToken', token, options);
}

export function clearAuthCookie(res: Response): void {
  const options: CookieOptions = {
    httpOnly: true,
    secure: isProd(),
    sameSite: 'lax',
    path: '/',
  };

  res.clearCookie('token', options);
}

export function clearRefreshCookie(res: Response): void {
  const options: CookieOptions = {
    httpOnly: true,
    secure: isProd(),
    sameSite: 'lax',
    path: '/api/auth',
  };

  res.clearCookie('refreshToken', options);
}

export function clearAllAuthCookies(res: Response): void {
  clearAuthCookie(res);
  clearRefreshCookie(res);
}
