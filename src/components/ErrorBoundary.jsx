import React from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Antigravity Caught Error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleResetStorage = () => {
    try {
      localStorage.removeItem('chatz_contacts_v1');
      localStorage.removeItem('chatz_stories_v1');
    } catch (e) {
      console.warn(e);
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          width: '100vw',
          backgroundColor: '#111b21',
          color: '#e9edef',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          padding: 24,
          textAlign: 'center',
          boxSizing: 'border-box'
        }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20,
            color: '#ef4444'
          }}>
            <AlertCircle size={36} />
          </div>

          <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>
            Chat Screen Refresh Required
          </h2>
          <p style={{ fontSize: 14, color: '#8696a0', maxWidth: 420, marginBottom: 24, lineHeight: 1.5 }}>
            Kuch data render karte waqt issue aaya tha. Aap niche diye gaye button se page refresh kar sakte hain.
          </p>

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={this.handleReload}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 20px',
                borderRadius: 24,
                backgroundColor: '#00a884',
                color: '#111b21',
                fontWeight: 600,
                fontSize: 14,
                border: 'none',
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={16} /> Refresh App
            </button>

            <button
              onClick={this.handleResetStorage}
              style={{
                padding: '10px 18px',
                borderRadius: 24,
                backgroundColor: 'transparent',
                color: '#8696a0',
                border: '1px solid #2a3942',
                fontWeight: 500,
                fontSize: 13,
                cursor: 'pointer'
              }}
            >
              Clear Cache & Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
