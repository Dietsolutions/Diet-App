/**
 * Centralised API helpers.
 *
 * In development we rely on the Vite proxy (see vite.config.ts) so the
 * frontend can use plain `/api/...` paths and same-origin cookies just work.
 *
 * In production on Vercel the API and the SPA are served from the same origin
 * (rewrites in vercel.json), so `/api/...` paths still work without
 * `VITE_API_URL`. The env variable is supported for the case where the API is
 * deployed to a different origin (e.g. preview environments).
 */
import axios from 'axios';
import { getStoredToken } from './auth';

const RAW_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

/**
 * Configure axios defaults once so every call in every hook automatically
 * uses the correct base URL and sends credentials (cookies).
 */
axios.defaults.baseURL = RAW_BASE || undefined;
axios.defaults.withCredentials = true;
axios.defaults.timeout = 15000;

/**
 * iOS Safari PWA fallback: attach stored JWT as Authorization header.
 * The server accepts both httpOnly cookie AND this header, so the first
 * mechanism that delivers a valid token wins.
 */
axios.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token && config.headers) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

/**
 * Global response interceptor: handle 401 (session expired), network errors.
 */
axios.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.code === 'ECONNABORTED') {
      return Promise.reject(new Error('Request timed out. Please check your connection.'));
    }
    if (!err.response) {
      return Promise.reject(new Error('Network error. Please check your connection.'));
    }
    return Promise.reject(err);
  }
);

export function apiUrl(path: string): string {
  const normalised = path.startsWith('/') ? path : `/${path}`;
  return `${RAW_BASE}${normalised}`;
}

/**
 * Thin fetch wrapper that always sends credentials and JSON headers and
 * resolves the path through `apiUrl`. Use this for any new fetch call so the
 * API base is consistent across environments.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers || {});
  if (!headers.has('Content-Type') && init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(apiUrl(path), {
    credentials: 'include',
    ...init,
    headers
  });
}

export const API_BASE = RAW_BASE;
