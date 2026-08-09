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

const RAW_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

/**
 * Bearer token for auth.
 *
 * On the web, auth is httpOnly cookie only (no token kept in JS — no XSS surface).
 * But in the native (Capacitor) build the app and API are different origins, so
 * the auth cookie is third-party and the iOS/Android WebView won't store it.
 * There we keep the JWT and send it as `Authorization: Bearer`, and persist it
 * in localStorage so the session survives app restarts. Persistence is gated to
 * native only, so the web build keeps its cookie-only, storage-free posture.
 */
const BEARER_STORAGE_KEY = 'dpt_auth_token';

function isNativeRuntime(): boolean {
  try {
    return !!(window as any).Capacitor?.isNativePlatform?.();
  } catch {
    return false;
  }
}

// Restore a persisted token on startup (native only) so the first /api/auth/me
// check carries it and the user stays logged in across app launches.
let _bearerToken: string | null = (() => {
  try {
    return isNativeRuntime() ? localStorage.getItem(BEARER_STORAGE_KEY) : null;
  } catch {
    return null;
  }
})();

export function setBearerToken(token: string | null): void {
  _bearerToken = token;
  try {
    if (isNativeRuntime()) {
      if (token) localStorage.setItem(BEARER_STORAGE_KEY, token);
      else localStorage.removeItem(BEARER_STORAGE_KEY);
    }
  } catch {
    // storage unavailable — in-memory token still works for this session
  }
}

export function getBearerToken(): string | null {
  return _bearerToken;
}

/**
 * Configure axios defaults once so every call in every hook automatically
 * uses the correct base URL and sends credentials (cookies).
 *
 * Auth is httpOnly cookie first (same-origin). For OAuth deep-link returns
 * (native apps), we fall back to an in-memory Bearer token set by the
 * Capacitor appUrlOpen handler.
 */
axios.defaults.baseURL = RAW_BASE || undefined;
axios.defaults.withCredentials = true;
axios.defaults.timeout = 15000;

// Attach Bearer token if set (OAuth deep-link on native)
axios.interceptors.request.use((config) => {
  if (_bearerToken) {
    config.headers.Authorization = `Bearer ${_bearerToken}`;
  }
  return config;
});

/**
 * Global response interceptor: handle 401 (session expired), network errors.
 */
axios.interceptors.response.use(
  (res) => {
    // Misroute guard. In the native (Capacitor) build a missing/incorrect
    // VITE_API_URL makes /api/... calls resolve to the WebView's own SPA host,
    // which answers with index.html and status 200. Without this, callers read
    // undefined fields off an HTML string (e.g. signup saw no `user`, the
    // username check saw no `available`). Detect the misroute and fail loudly
    // so the real problem — the API base URL — is obvious.
    const url = typeof res.config?.url === 'string' ? res.config.url : '';
    const contentType = String(res.headers?.['content-type'] || '');
    const looksLikeHtml = typeof res.data === 'string' && /^\s*<(!doctype|html)/i.test(res.data);
    if (url.includes('/api/') && (contentType.includes('text/html') || looksLikeHtml)) {
      const e: any = new Error('Cannot reach the server. Check your connection and try again.');
      e.code = 'API_UNREACHABLE';
      return Promise.reject(e);
    }
    return res;
  },
  (err) => {
    // Pass cancellations through untouched. A cancelled request has no
    // `err.response`, so the generic branch below used to rewrite it into a plain
    // Error — destroying the marker `axios.isCancel()` looks for. Callers that
    // abort on unmount (useAuth's /auth/me, MealDetailSheet's instructions fetch)
    // then treated a deliberate abort as a real failure: useAuth called
    // setUser(null), showing the login screen despite a valid session.
    if (axios.isCancel(err) || err.code === 'ERR_CANCELED') {
      return Promise.reject(err);
    }
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
 * POST to an SSE endpoint (meal-plan generate / validate) and resolve with the
 * `done` event payload. `onStep` receives each `progress` step for the UI.
 * Mirrors the XHR pattern used for generation so native (Capacitor) requests
 * carry the Bearer token — EventSource can't POST or set headers.
 */
export function streamSSE(
  path: string,
  body: Record<string, unknown>,
  onStep?: (step: string) => void,
): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', apiUrl(path));
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.withCredentials = true;
    const _bt = getBearerToken();
    if (_bt) xhr.setRequestHeader('Authorization', `Bearer ${_bt}`);
    xhr.timeout = 300000; // matches Vercel maxDuration
    let processed = 0;
    let settled = false;
    const parseSSE = () => {
      const text = xhr.responseText.substring(processed);
      processed = xhr.responseText.length;
      for (const block of text.split('\n\n')) {
        const eventMatch = block.match(/^event: (\w+)/);
        const dataMatch  = block.match(/^data: (.+)$/m);
        if (!eventMatch || !dataMatch) continue;
        try {
          const parsed = JSON.parse(dataMatch[1]);
          if (eventMatch[1] === 'progress' && !settled) onStep?.(parsed.step);
          else if (eventMatch[1] === 'done'  && !settled) { settled = true; resolve(parsed); }
          else if (eventMatch[1] === 'error' && !settled) { settled = true; reject(new Error(parsed.error)); }
        } catch {}
      }
    };
    xhr.onprogress = parseSSE;
    xhr.onload = () => {
      parseSSE();
      if (!settled) {
        if (xhr.status >= 400) {
          try { reject(new Error(JSON.parse(xhr.responseText).error || 'Request failed')); }
          catch { reject(new Error('Request failed')); }
        } else { reject(new Error('No response received')); }
      }
    };
    xhr.onerror   = () => { if (!settled) reject(new Error('Network error')); };
    xhr.ontimeout = () => { if (!settled) reject(new Error('Request timed out')); };
    xhr.send(JSON.stringify(body));
  });
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
  // Mirror the Axios interceptor: attach Bearer token for OAuth native deep-link sessions
  if (_bearerToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${_bearerToken}`);
  }

  return fetch(apiUrl(path), {
    credentials: 'include',
    ...init,
    headers
  });
}

export const API_BASE = RAW_BASE;
