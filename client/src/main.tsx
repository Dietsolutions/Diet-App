// ── iOS Safari polyfills — must run before any other import ──────────────────
// Minimal set: only patch what iOS 13–15.3 genuinely lacks.
// iOS 18 is a fully modern engine — these guards ensure we never overwrite
// a native implementation, eliminating any risk of polyfill recursion.

// structuredClone — missing on iOS < 15.4
// Safe guard: checks typeof === 'function' so a partial native
// implementation is never overwritten.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (typeof (window as any).structuredClone !== 'function') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).structuredClone = function deepClone(obj: unknown): unknown {
    if (obj === null || typeof obj !== 'object') return obj;
    try {
      return JSON.parse(JSON.stringify(obj));
    } catch {
      return obj;
    }
  };
}

// Array.prototype.at — missing on iOS < 15.4
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (typeof (Array.prototype as any).at !== 'function') {
  // eslint-disable-next-line no-extend-native, @typescript-eslint/no-explicit-any
  (Array.prototype as any).at = function (index: number) {
    const i = index < 0 ? this.length + index : index;
    return this[i];
  };
}

// ── Now safe to import React and the rest of the app ─────────────────────────
import React, { Component, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
// Configure axios defaults (baseURL, withCredentials) before any component mounts.
import './lib/api';
import App from './App';
import './index.css';

/**
 * iOS Safari 100vh fix.
 *
 * On iOS Safari the document height includes the collapsible address bar, so
 * `100vh` overflows the visible viewport. We measure the real inner height and
 * expose it as `--app-height` so CSS can use `height: var(--app-height)` instead
 * of `height: 100vh`.
 *
 * `isSettingHeight` guards against any browser that re-fires resize during a
 * style.setProperty call, which would cause infinite recursion.
 */
let isSettingHeight = false;
function setAppHeight(): void {
  if (isSettingHeight) return;
  isSettingHeight = true;
  document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
  isSettingHeight = false;
}
setAppHeight();
window.addEventListener('resize', setAppHeight);
window.addEventListener('orientationchange', () => setTimeout(setAppHeight, 100));

/**
 * Service-worker registration + update detection.
 *
 * updateViaCache: 'none' forces the browser to always re-fetch the SW script
 * from the network (ignoring HTTP cache) so iOS Safari picks up new SW versions
 * immediately rather than serving a stale SW from the browser cache.
 *
 * When a new SW activates (skipWaiting + clientsClaim), controllerchange fires
 * and we reload the page so the user gets the new app shell.
 *
 * NOTE: reg.update() was removed — Workbox's autoUpdate + skipWaiting already
 * handles SW lifecycle. Calling update() on every registration triggered an
 * extra controllerchange → reload cycle that caused a reload loop on some
 * browsers.
 */
let swRefreshPending = false;
if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('/sw.js', { updateViaCache: 'none' })
    .catch((err) => {
      console.warn('[SW] Registration failed:', err);
    });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (swRefreshPending) return;
    swRefreshPending = true;
    // Small delay avoids a reload loop on the very first SW install
    setTimeout(() => window.location.reload(), 100);
  });
}

/**
 * Top-level error boundary.
 *
 * If anything inside <App> throws during render (e.g. a Zustand selector,
 * a broken hook, or a third-party import), React 18 silently unmounts the
 * entire tree and shows only the black body background.
 * This boundary catches those errors and renders a detailed debug screen
 * showing the error message, stack trace, and User-Agent string so we can
 * diagnose iOS-specific failures without needing a debugger attached.
 */
interface BoundaryState {
  hasError: boolean;
  error: Error | null;
}

class RootErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[RootErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      const err = this.state.error;
      return (
        <div style={{
          background:   '#0a0000',
          color:        '#ff6b6b',
          padding:      '20px',
          fontFamily:   'monospace',
          fontSize:     '13px',
          minHeight:    '100vh',
          lineHeight:   1.6,
          overflowY:    'auto',
          boxSizing:    'border-box',
        }}>
          <h2 style={{ color: '#ff4444', margin: '0 0 12px', fontSize: '16px' }}>
            App crashed
          </h2>
          <p style={{ margin: '4px 0' }}>
            <strong>Error:</strong> {err.message}
          </p>
          <pre style={{
            background:    'rgba(255,0,0,0.1)',
            padding:       '10px',
            marginTop:     '10px',
            overflow:      'auto',
            fontSize:      '11px',
            whiteSpace:    'pre-wrap',
            wordBreak:     'break-all',
          }}>
            {err.stack || 'No stack trace'}
          </pre>
          <p style={{ marginTop: '12px', fontSize: '11px', color: '#ff9999' }}>
            <strong>UA:</strong> {navigator.userAgent}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop:   '16px',
              padding:     '10px 22px',
              background:  '#C4713A',
              border:      'none',
              color:       '#fff',
              fontSize:    '14px',
              cursor:      'pointer',
            }}
          >
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </React.StrictMode>,
);
