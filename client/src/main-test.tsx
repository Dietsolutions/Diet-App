// Layer 1 — import every Zustand store + axios config, no app UI
// If this crashes: the bug is in a store's module-level initialisation code.
// If this passes: the bug is in a React component or hook.

import React from 'react'
import ReactDOM from 'react-dom/client'

// Axios defaults (baseURL, credentials, interceptors)
import './lib/api'

// Every Zustand store in client/src/store/
import './store/authStore'
import './store/appStore'
import './store/mealReplacerStore'
import './store/additionalMealsStore'
import './store/weightStore'

function TestApp() {
  return (
    <div style={{
      background: '#0a0a0f',
      color: 'white',
      padding: '40px',
      minHeight: '100vh',
      fontFamily: 'monospace',
      fontSize: '16px',
    }}>
      <h1 style={{ color: '#C4713A' }}>✓ Layer 1 — Stores OK</h1>
      <p style={{ color: 'rgba(255,255,255,0.6)', marginTop: 12 }}>
        All Zustand stores + axios initialised without crashing.
      </p>
      <p style={{ color: 'rgba(255,255,255,0.4)', marginTop: 8, fontSize: 13 }}>
        Bug is NOT in store initialisation — it is in a React component.
      </p>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(<TestApp />)
