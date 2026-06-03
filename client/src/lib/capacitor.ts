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

  // StatusBar
  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#0F1117' });
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
