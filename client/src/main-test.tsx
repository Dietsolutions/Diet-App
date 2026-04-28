// Layer 3 — real main.tsx content minus the SW registration block
//
// Added vs Layer 2:
//   ✓ structuredClone polyfill
//   ✓ Array.prototype.at polyfill
//   ✓ setAppHeight() + resize / orientationchange listeners
//   ✓ React.StrictMode wrapper
//   ✓ RootErrorBoundary class component
//
// Deliberately excluded:
//   ✗ navigator.serviceWorker.getRegistrations() + unregister + re-register
//   ✗ controllerchange → window.location.reload() listener
//
// If this PASSES → the SW code in main.tsx is causing the crash (reload loop).
// If this CRASHES → the bug is in the polyfills, setAppHeight, or ErrorBoundary.

// ── polyfills ────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (typeof (window as any).structuredClone !== 'function') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).structuredClone = function deepClone(obj: unknown): unknown {
    if (obj === null || typeof obj !== 'object') return obj;
    try { return JSON.parse(JSON.stringify(obj)); } catch { return obj; }
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (typeof (Array.prototype as any).at !== 'function') {
  // eslint-disable-next-line no-extend-native, @typescript-eslint/no-explicit-any
  (Array.prototype as any).at = function (index: number) {
    const i = index < 0 ? this.length + index : index;
    return this[i];
  };
}

// ── now safe to import React ──────────────────────────────────────────────────
import React, { Component, ReactNode } from 'react'
import ReactDOM from 'react-dom/client'
import './lib/api'
import App from './App'

// ── setAppHeight ─────────────────────────────────────────────────────────────
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

// ── RootErrorBoundary ─────────────────────────────────────────────────────────
interface BoundaryState { hasError: boolean; error: Error | null; }
class RootErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error): BoundaryState {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError && this.state.error) {
      const err = this.state.error;
      return (
        <div style={{ background: '#0a0000', color: '#ff6b6b', padding: '20px',
                      fontFamily: 'monospace', fontSize: '13px', minHeight: '100vh' }}>
          <h2 style={{ color: '#ff4444' }}>App crashed</h2>
          <p><strong>Error:</strong> {err.message}</p>
          <pre style={{ fontSize: '11px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {err.stack || 'No stack trace'}
          </pre>
          <p style={{ fontSize: '11px' }}><strong>UA:</strong> {navigator.userAgent}</p>
          <button onClick={() => window.location.reload()}
            style={{ marginTop: 16, padding: '10px 22px', background: '#C4713A',
                     border: 'none', color: '#fff', cursor: 'pointer' }}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── mount ─────────────────────────────────────────────────────────────────────
const rootEl = document.getElementById('root')!;
ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </React.StrictMode>
);
