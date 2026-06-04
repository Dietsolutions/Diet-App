/**
 * Auth token storage shim — cookie-only.
 *
 * As of Batch 5 we no longer mirror the JWT in sessionStorage. The httpOnly
 * cookie set by the server is the only auth channel. This eliminates the
 * XSS-token-theft surface entirely.
 *
 * The exported functions are kept as no-ops so that any leftover call site
 * (e.g. from a half-merged code path) compiles and runs without error, but
 * they no longer read or write any storage. If you find a caller using
 * these, that caller is dead code and can be removed.
 */

const STORAGE_REMOVED_MSG = '[auth] storeToken/getStoredToken/clearStoredToken are no-ops. Auth is httpOnly cookie only.';

export function storeToken(_token: string): void {
  if (typeof console !== 'undefined') console.warn(STORAGE_REMOVED_MSG);
}

export function getStoredToken(): string | null {
  if (typeof console !== 'undefined') console.warn(STORAGE_REMOVED_MSG);
  return null;
}

export function clearStoredToken(): void {
  if (typeof console !== 'undefined') console.warn(STORAGE_REMOVED_MSG);
}
