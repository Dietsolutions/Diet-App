import React from 'react'
import ReactDOM from 'react-dom/client'

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
      <h1 style={{ color: '#C4713A' }}>✓ React Works on iPhone</h1>
      <p style={{ color: 'rgba(255,255,255,0.5)' }}>
        The bug is in a specific component or store.
      </p>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(<TestApp />)
