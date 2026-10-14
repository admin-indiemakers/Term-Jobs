import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { Analytics } from '@vercel/analytics/react'

import { ErrorBoundary } from './components/ErrorBoundary.jsx'
import { installChunkRecovery } from './utils/chunkRecovery.js'

try {
  installChunkRecovery(window, window.sessionStorage, import.meta.url)
} catch {
  // Storage may be disabled; keep the normal error boundary available.
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <App />
        <Analytics />
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
)
