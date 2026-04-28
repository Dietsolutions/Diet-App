// Layer 2 — mount full App.tsx with a render-count guard
// If this crashes: the bug is inside App.tsx or a component it renders on first mount.
// If this passes (shows the real app): something in the polyfills / SW setup
//   in the real main.tsx is the trigger — not the components.

import React, { useRef } from 'react'
import ReactDOM from 'react-dom/client'
import './lib/api'
import App from './App'

let globalRenderCount = 0

function WrappedApp() {
  globalRenderCount++

  if (globalRenderCount > 200) {
    return (
      <div style={{
        background: '#0a0000', color: '#ff4444',
        padding: '24px', minHeight: '100vh',
        fontFamily: 'monospace', fontSize: '13px',
      }}>
        <h2 style={{ margin: '0 0 12px' }}>🔴 Infinite loop detected in App</h2>
        <p>WrappedApp rendered {globalRenderCount} times.</p>
        <p style={{ marginTop: 8, color: 'rgba(255,100,100,0.8)' }}>
          The bug is inside App.tsx or one of the components it renders
          on first mount (auth check, AppBar, BottomNav, IOSInstallBanner,
          Toast, or the active tab).
        </p>
      </div>
    )
  }

  return <App />
}

ReactDOM.createRoot(document.getElementById('root')!).render(<WrappedApp />)
