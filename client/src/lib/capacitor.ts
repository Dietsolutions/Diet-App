/**
 * Capacitor runtime initialization.
 *
 * Importing this module is a no-op on web, and on iOS/Android it:
 *   - Configures the StatusBar to match the app's dark theme
 *   - Hides the native splash after the React tree is ready
 *   - Routes "App" lifecycle events (resume, pause, back button) into
 *     a custom DOM event so the rest of the app can react without
 *     importing Capacitor directly.
 *
 * The store review teams want visible platform behavior — without
 * splash/statusbar config the webview feels like a website in a frame.
 */

import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { App as CapApp } from '@capacitor/app';

let initialized = false;

export async function initCapacitor(): Promise<void> {
  if (initialized) return;
  initialized = true;

  if (!Capacitor.isNativePlatform()) return;

  // StatusBar — Fresh Light theme: light bar background, dark content
  try {
    await StatusBar.setStyle({ style: Style.Light });
    await StatusBar.setBackgroundColor({ color: '#F2F1EC' });
    await StatusBar.setOverlaysWebView({ overlay: false });
  } catch (e) {
    console.warn('[Capacitor] StatusBar setup failed:', e);
  }

  // SplashScreen — hide once the React tree is ready
  // (we leave show() to the platform default; this just guarantees hide).
  try {
    await SplashScreen.hide();
  } catch (e) {
    console.warn('[Capacitor] SplashScreen hide failed:', e);
  }

  // App lifecycle — Android back button + iOS resume/pause
  CapApp.addListener('appStateChange', ({ isActive }) => {
    window.dispatchEvent(new CustomEvent('capacitor:appStateChange', { detail: { isActive } }));
  });

  CapApp.addListener('backButton', ({ canGoBack }) => {
    const event = new CustomEvent('capacitor:backButton', { detail: { canGoBack } });
    window.dispatchEvent(event);
    // If no handler called preventDefault on the event, default behaviour
    // (exit app) is what we want on Android.
  });

  CapApp.addListener('pause', () => {
    window.dispatchEvent(new CustomEvent('capacitor:pause'));
  });

  CapApp.addListener('resume', () => {
    window.dispatchEvent(new CustomEvent('capacitor:resume'));
  });
}

export const isNative = (): boolean => Capacitor.isNativePlatform();
export const platform = (): string => Capacitor.getPlatform();

export interface AppleSignInPayload {
  identityToken: string;
  fullName: { givenName?: string; familyName?: string };
  email: string;
  user: string;
}

/**
 * Sign in with Apple on iOS via the native AppDelegate handler.
 *
 * Returns a promise that resolves with the Apple identity token + user info.
 * The server endpoint /api/auth/apple/callback verifies the JWT signature
 * against Apple's JWKS and issues a session JWT.
 */
export function signInWithApple(): Promise<AppleSignInPayload> {
  return new Promise((resolve, reject) => {
    if (!isNative() || platform() !== 'ios') {
      reject(new Error('Apple Sign-In is only available on iOS devices'));
      return;
    }

    let settled = false;

    // Declared before use in onSuccess/onError (populated after timeout is created).
    let timeoutId: ReturnType<typeof setTimeout>;

    const cleanup = () => {
      clearTimeout(timeoutId);
      window.removeEventListener('apple-signin-success', onSuccess as EventListener);
      window.removeEventListener('apple-signin-error', onError as EventListener);
    };

    const onSuccess = (event: Event) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve((event as CustomEvent<AppleSignInPayload>).detail);
    };

    const onError = (event: Event) => {
      if (settled) return;
      settled = true;
      cleanup();
      const detail = (event as CustomEvent<{ error: string }>).detail;
      reject(new Error(detail?.error || 'Apple Sign-In was cancelled'));
    };

    // Safety valve: reject if the native flow never fires either event.
    timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('Apple Sign-In timed out. Please try again.'));
    }, 90_000);

    window.addEventListener('apple-signin-success', onSuccess as EventListener, { once: true });
    window.addEventListener('apple-signin-error', onError as EventListener, { once: true });

    // Use setTimeout(0) so the navigation fires outside the synchronous JS stack.
    // This prevents WKWebView from silently dropping custom-scheme navigations
    // triggered within a synchronous event dispatch on some iOS versions.
    setTimeout(() => { window.location.href = 'dietplan://apple-signin'; }, 0);
  });
}
