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
 * We also fire on `orientationchange` (with a small delay to let the browser
 * finish resizing) so the value stays accurate after rotation.
 */
function setAppHeight(): void {
  document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
}

setAppHeight();
window.addEventListener('resize', setAppHeight);
window.addEventListener('orientationchange', () => setTimeout(setAppHeight, 100));

/**
 * Service-worker update detection.
 *
 * When a new SW activates (skipWaiting + clientsClaim), this controller-change
 * event fires. We reload the page so the user immediately gets the new app
 * shell instead of running old JS with a new SW.
 */
let swRefreshPending = false;
if ('serviceWorker' in navigator) {
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
 * a broken hook, or a third-party import), React 18 would silently unmount
 * the entire tree and show only the black body background.
 * This boundary catches those errors and renders a visible "Reload" prompt.
 */
interface BoundaryState { hasError: boolean; message: string }
class RootErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { hasError: true, message: error?.message || 'Unknown error' };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[RootErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          backgroundColor: '#0F1117',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily: 'Inter, DM Sans, sans-serif',
          color: '#F0EDE8',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>⚠️</div>
          <p style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
            Something went wrong
          </p>
          <p style={{ fontSize: '13px', color: '#9A95A0', marginBottom: '24px', maxWidth: '280px' }}>
            {this.state.message}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              backgroundColor: '#E8845A',
              color: '#fff',
              border: 'none',
              borderRadius: '12px',
              padding: '12px 28px',
              fontSize: '15px',
              fontWeight: 600,
              cursor: 'pointer'
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
  </React.StrictMode>
);
