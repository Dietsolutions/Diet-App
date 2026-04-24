/**
 * IOSInstallBanner — Strain v2. All detection + localStorage logic preserved.
 *
 * Shown only when:
 *   - User agent is iOS Safari (not already in standalone/PWA mode)
 *   - User has NOT previously dismissed it (localStorage flag)
 *   - 4 seconds have passed since mount
 */

import { useEffect, useState } from 'react';
import { s2 } from '../theme/tokens';
import { HairLabel } from './ui';

const DISMISSED_KEY = 'ios_install_banner_dismissed';

function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  const isStandalone = (window.navigator as any).standalone === true;
  return isIOS && !isStandalone;
}

function wasDismissed(): boolean {
  try { return localStorage.getItem(DISMISSED_KEY) === '1'; } catch { return false; }
}

function setDismissed(): void {
  try { localStorage.setItem(DISMISSED_KEY, '1'); } catch {}
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

  const stepStyle = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    padding: '10px 0',
    borderBottom: `1px solid ${s2.line}`,
  };

  const numStyle = {
    width: 20,
    height: 20,
    background: s2.accentFill,
    border: `1px solid ${s2.accent}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: s2.mono,
    fontSize: 9,
    color: s2.accent,
    flexShrink: 0,
    marginTop: 1,
  };

  return (
    <div
      role="dialog"
      aria-label="Install app"
      style={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 480,
        zIndex: 55,
        padding: '0 0 max(env(safe-area-inset-bottom, 0px), 12px)',
      }}
    >
      <div style={{
        background: s2.surface,
        borderTop: `1px solid ${s2.lineStrong}`,
        padding: '16px 20px',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}>
          <div>
            <HairLabel>INSTALL APP</HairLabel>
            <div style={{
              fontFamily: s2.sans,
              fontSize: 16,
              fontWeight: 400,
              letterSpacing: '-0.02em',
              marginTop: 4,
            }}>
              Add to Home Screen
            </div>
          </div>
          <button
            onClick={handleDismiss}
            aria-label="Dismiss"
            style={{
              background: 'transparent',
              border: `1px solid ${s2.lineStrong}`,
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: s2.textDim,
              fontSize: 18,
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        {/* Steps */}
        <div>
          <div style={stepStyle}>
            <div style={numStyle}>1</div>
            <div style={{ fontFamily: s2.sans, fontSize: 13, color: s2.textDim, lineHeight: 1.45 }}>
              Tap the{' '}
              <span style={{ color: s2.text, fontWeight: 500 }}>Share</span>{' '}
              <svg
                width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke={s2.accent} strokeWidth="2.5" strokeLinecap="square" strokeLinejoin="miter"
                style={{ display: 'inline', verticalAlign: 'middle', marginBottom: 1 }}
              >
                <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/>
                <polyline points="16 6 12 2 8 6"/>
                <line x1="12" y1="2" x2="12" y2="15"/>
              </svg>{' '}
              button at the bottom of Safari
            </div>
          </div>

          <div style={stepStyle}>
            <div style={numStyle}>2</div>
            <div style={{ fontFamily: s2.sans, fontSize: 13, color: s2.textDim, lineHeight: 1.45 }}>
              Scroll down and tap{' '}
              <span style={{ color: s2.text, fontWeight: 500 }}>"Add to Home Screen"</span>
            </div>
          </div>

          <div style={{ ...stepStyle, borderBottom: 'none' }}>
            <div style={numStyle}>3</div>
            <div style={{ fontFamily: s2.sans, fontSize: 13, color: s2.textDim, lineHeight: 1.45 }}>
              Tap <span style={{ color: s2.text, fontWeight: 500 }}>"Add"</span> in the top-right corner
            </div>
          </div>
        </div>

        {/* Down arrow */}
        <div style={{ textAlign: 'center', marginTop: 10, color: s2.accentSoft, opacity: 0.5 }}>
          <div style={{ width: 1, height: 12, background: 'currentColor', margin: '0 auto' }} />
          <svg width="10" height="7" viewBox="0 0 10 7" fill="currentColor">
            <path d="M5 7L0 0h10L5 7z" />
          </svg>
        </div>
      </div>
    </div>
  );
}
