/**
 * iOS Safari PWA auth token fallback.
 *
 * iOS standalone PWA contexts don't reliably share httpOnly cookies with the
 * main Safari browser session. We store the JWT in sessionStorage and send it
 * as an Authorization: Bearer header so every API request works regardless of
 * cookie availability.
 *
 * Security notes:
 *  - sessionStorage is cleared when the PWA tab is closed (unlike localStorage)
 *  - httpOnly cookies are still the primary auth mechanism; this is a fallback
 *  - The server accepts both cookie AND Authorization header (auth middleware)
 */

const KEY = 'app_at'; // auth token key

/** Store token in sessionStorage (safe on iOS even in private mode) */
export function storeToken(token: string): void {
  try {
    sessionStorage.setItem(KEY, token);
  } catch {
    // sessionStorage unavailable (extremely rare) — cookie fallback still works
  }
}

/** Retrieve token from sessionStorage */
export function getStoredToken(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** Clear stored token (on logout) */
export function clearStoredToken(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {}
}
