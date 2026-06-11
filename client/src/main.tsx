// ── Sentry error tracking ─────────────────────────────────────────────────────
// Initialised before React mounts so render crashes are captured.
import * as Sentry from '@sentry/react';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || '';
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,           // 10% of sessions get performance traces
    replaysSessionSampleRate: 0,     // no session replays (privacy)
    replaysOnErrorSampleRate: 0.1,   // capture replay on 10% of errors
    integrations: [],
    beforeSend(event) {
      // Strip PostHog API key if it leaks into an error context
      if (event.extra) {
        const sanitized: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(event.extra)) {
          sanitized[k] = typeof v === 'string' && v.length > 100 ? '[truncated]' : v;
        }
        event.extra = sanitized;
      }
      return event;
    },
  });
} else if (import.meta.env.DEV) {
  console.warn('[Sentry] VITE_SENTRY_DSN not set — errors will not be tracked');
}

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
import { Capacitor } from '@capacitor/core';
// Configure axios defaults (baseURL, withCredentials) before any component mounts.
import './lib/api';
import { initAnalytics } from './lib/analytics';
import { initCapacitor } from './lib/capacitor';
import App from './App';
import './index.css';

// Initialise analytics before React mounts so the first events are captured.
initAnalytics();

// Initialise native platform plugins (StatusBar, SplashScreen, App lifecycle).
// No-op on web.
void initCapacitor();

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
 * Service-worker registration.
 *
 * Simple, safe registration — no getRegistrations() / unregister() calls.
 *
 * WHY the previous approach was wrong:
 *   Calling getRegistrations() → unregister all → re-register on every page
 *   load forced the SW through install → activate on every load. Each activate
 *   fired skipWaiting + clients.claim(), which fired controllerchange, which
 *   called window.location.reload(). On the next load the cycle repeated:
 *   unregister → re-register → controllerchange → reload → forever.
 *   On iOS Safari the rapid-reload loop surfaced as
 *   RangeError: Maximum call stack size exceeded.
 *
 * The fix: just register normally. The SW in public/sw.js uses skipWaiting
 * so a new version always takes over immediately on the next deploy.
 * controllerchange fires only when the SW actually changes (i.e. a new
 * deploy), not on every page load — so the one-reload behaviour is correct.
 *
 * updateViaCache: 'none' ensures the browser always re-fetches the SW script
 * from the network (bypasses HTTP cache) so iOS Safari gets new versions fast.
 */
if ('serviceWorker' in navigator && !Capacitor.isNativePlatform()) {
  navigator.serviceWorker
    .register('/sw.js', { updateViaCache: 'none' })
    .catch((err) => { console.warn('[SW] Registration failed:', err); });

  // Reload once when a new SW activates so users immediately get the latest
  // app shell. The pending flag prevents a second reload in the same session.
  let swRefreshPending = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (swRefreshPending) return;
    swRefreshPending = true;
    setTimeout(() => window.location.reload(), 300);
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
    if (SENTRY_DSN) {
      Sentry.captureException(error, { contexts: { react: { componentStack: info.componentStack } } });
    }
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
          minHeight:    '100dvh',
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

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('[main] #root element not found in DOM');

try {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <RootErrorBoundary>
        <App />
      </RootErrorBoundary>
    </React.StrictMode>,
  );
} catch (mountErr) {
  // createRoot itself threw — this is a synchronous crash before React
  // has a chance to call componentDidCatch or getDerivedStateFromError.
  // Re-throw so the window.onerror handler in index.html can display it.
  console.error('[main] ReactDOM.createRoot failed:', mountErr);
  throw mountErr;
}
