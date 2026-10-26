import React from 'react';
import { isChunkRecoveryInProgress } from '../utils/chunkRecovery.js';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[Global ErrorBoundary caught error]:', error, errorInfo);
    this.setState({ errorInfo });

    const isChunkLoadError =
      error?.message &&
      (error.message.includes('Failed to fetch dynamically imported module') ||
       error.message.includes('Importing a module script failed') ||
       error.message.includes('error loading dynamically imported module') ||
       error.message.includes('Loading chunk') ||
       error.name === 'ChunkLoadError');

    if (isChunkLoadError && typeof window !== 'undefined') {
      const reloadKey = 'tj_last_chunk_reload';
      const lastReload = window.sessionStorage?.getItem(reloadKey);
      const now = Date.now();
      // Auto-reload once if not attempted in the last 30s
      if (!lastReload || now - Number(lastReload) > 30000) {
        try {
          window.sessionStorage?.setItem(reloadKey, String(now));
        } catch {}
        window.location.reload();
      }
    }
  }

  render() {
    if (this.state.hasError && isChunkRecoveryInProgress()) {
      return <div role="status" style={{ padding: '40px', textAlign: 'center' }}>Updating your workspace…</div>;
    }
    if (this.state.hasError) {
      const isChunkLoadError =
        this.state.error?.message &&
        (this.state.error.message.includes('Failed to fetch dynamically imported module') ||
         this.state.error.message.includes('Importing a module script failed') ||
         this.state.error.message.includes('error loading dynamically imported module') ||
         this.state.error.message.includes('Loading chunk') ||
         this.state.error.name === 'ChunkLoadError');

      if (isChunkLoadError) {
        return (
          <div style={{ padding: '40px', fontFamily: "'Inter', -apple-system, sans-serif", maxWidth: '580px', margin: '80px auto', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '20px', boxShadow: '0 20px 40px rgba(0,0,0,0.06)', textAlign: 'center' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto', fontSize: '22px' }}>
              🔄
            </div>
            <h2 style={{ color: '#0f172a', fontSize: '20px', fontWeight: 800, margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>
              Application Update Available
            </h2>
            <p style={{ color: '#64748b', fontSize: '13.5px', lineHeight: '1.6', margin: '0 0 24px 0' }}>
              A new version of Term Jobs has been deployed. Please reload the page to load the latest module assets.
            </p>
            <button
              onClick={() => {
                try {
                  window.sessionStorage?.removeItem('tj_last_chunk_reload');
                } catch {}
                window.location.reload();
              }}
              style={{ padding: '10px 24px', background: '#0a0a0a', color: '#fff', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 700, fontSize: '13px', transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
            >
              Reload Application
            </button>
          </div>
        );
      }

      return (
        <div style={{ padding: '40px', fontFamily: 'monospace', maxWidth: '800px', margin: '40px auto', background: '#fff', border: '2px solid #e11d48', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
          <h2 style={{ color: '#e11d48', marginTop: 0 }}>Application Render Error</h2>
          <p style={{ color: '#4b5563', fontSize: '14px' }}>An unexpected error occurred while rendering the page:</p>
          <div style={{ background: '#fef2f2', border: '1px solid #fecdd3', padding: '15px', borderRadius: '8px', color: '#9f1239', whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginBottom: '20px' }}>
            {this.state.error?.toString()}
          </div>
          {this.state.errorInfo?.componentStack && (
            <details style={{ marginTop: '10px', color: '#6b7280' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>Component Stack</summary>
              <pre style={{ fontSize: '11px', background: '#f3f4f6', padding: '10px', borderRadius: '6px', overflowX: 'auto' }}>
                {this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: '20px', padding: '10px 20px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

