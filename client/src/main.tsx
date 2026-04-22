import React from 'react';
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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
