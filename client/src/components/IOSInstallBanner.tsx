/**
 * IOSInstallBanner — iOS Safari "Add to Home Screen" guidance.
 *
 * iOS Safari never fires `beforeinstallprompt`, so we can't use the standard
 * Chrome PWA install flow. Instead we show a bottom sheet with a short
 * instruction ("tap Share → Add to Home Screen") after a brief delay.
 *
 * Shown only when:
 *   - User agent is iOS Safari (not already in standalone/PWA mode)
 *   - User has NOT previously dismissed it (localStorage flag)
 *   - 4 seconds have passed since mount (to avoid flashing on load)
 *
 * Dismissing sets a localStorage flag so it doesn't reappear.
 */

import { useEffect, useState } from 'react';

const DISMISSED_KEY = 'ios_install_banner_dismissed';

function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  // `standalone` is true when already installed as PWA
  const isStandalone = (window.navigator as any).standalone === true;
  return isIOS && !isStandalone;
}

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

function setDismissed(): void {
  try {
    localStorage.setItem(DISMISSED_KEY, '1');
  } catch {}
}

export function IOSInstallBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isIosSafari() || wasDismissed()) return;

    const timer = setTimeout(() => setVisible(true), 4000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  const handleDismiss = () => {
    setDismissed();
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Install app"
      className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-safe-bottom"
      style={{ maxWidth: '430px', margin: '0 auto' }}
    >
      <div className="bg-surface border border-border rounded-2xl p-4 mb-4 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">📱</span>
            <p className="text-primary text-sm font-semibold font-sans">Add to Home Screen</p>
          </div>
          <button
            onClick={handleDismiss}
            aria-label="Dismiss"
            className="text-secondary text-xl leading-none w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/10 active:bg-white/20"
          >
            ×
          </button>
        </div>

        {/* Steps */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="w-6 h-6 rounded-full bg-accent/20 text-accent text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
            <p className="text-secondary text-xs font-sans">
              Tap the <span className="text-primary font-semibold">Share</span> button{' '}
              <span className="inline-block align-middle">
                {/* iOS share icon approximation */}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="inline text-accent">
                  <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/>
                  <polyline points="16 6 12 2 8 6"/>
                  <line x1="12" y1="2" x2="12" y2="15"/>
                </svg>
              </span>{' '}
              at the bottom of Safari
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="w-6 h-6 rounded-full bg-accent/20 text-accent text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
            <p className="text-secondary text-xs font-sans">
              Scroll down and tap{' '}
              <span className="text-primary font-semibold">"Add to Home Screen"</span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="w-6 h-6 rounded-full bg-accent/20 text-accent text-xs font-bold flex items-center justify-center flex-shrink-0">3</span>
            <p className="text-secondary text-xs font-sans">
              Tap <span className="text-primary font-semibold">"Add"</span> in the top-right corner
            </p>
          </div>
        </div>

        {/* Arrow pointing down toward Safari UI */}
        <div className="mt-3 flex justify-center">
          <div className="flex flex-col items-center gap-1 text-accent/60">
            <div className="w-px h-4 bg-accent/40" />
            <svg width="12" height="8" viewBox="0 0 12 8" fill="currentColor">
              <path d="M6 8L0 0h12L6 8z"/>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
