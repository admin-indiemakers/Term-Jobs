import React from 'react';

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
  }

  render() {
    if (this.state.hasError) {
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
            onClick={() => {
              localStorage.clear();
              window.location.href = '/#jobs';
            }}
            style={{ marginTop: '20px', padding: '10px 20px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Clear Session & Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
