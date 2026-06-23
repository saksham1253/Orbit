import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Log to console in development; swap for a real error service in prod
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary]', error, info);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    // Force a full page reload to recover from the error
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.inline) {
        return (
          <div className="flex flex-col items-center justify-center p-6 h-full text-center bg-surface border-l border-border-subtle">
            <AlertTriangle size={28} className="text-danger mb-3" />
            <p className="text-sm font-medium text-text-primary mb-1">Failed to load conversation</p>
            <p className="text-xs text-text-muted mb-4 max-w-[200px]">We encountered an error displaying this chat. Please try again.</p>
            <button 
              onClick={() => this.setState({ hasError: false, error: null })} 
              className="text-xs font-medium text-accent hover:text-accent-dark transition-colors"
            >
              Retry
            </button>
          </div>
        );
      }

      return (
        <div
          className="min-h-screen flex items-center justify-center p-6"
          role="alert"
          aria-live="assertive"
        >
          <div className="text-center max-w-md">
            {/* Icon */}
            <div
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6"
              style={{
                background: 'rgba(255,75,75,0.1)',
                border: '1px solid rgba(255,75,75,0.3)',
              }}
            >
              <AlertTriangle size={28} style={{ color: '#ff4b4b' }} />
            </div>

            <h1 className="text-2xl font-display font-bold text-text-primary mb-3">
              Something went wrong
            </h1>
            <p className="text-text-secondary text-sm mb-8 leading-relaxed">
              An unexpected error occurred. You can try refreshing the page, or
              click below to recover without a full reload.
            </p>

            {import.meta.env.DEV && this.state.error && (
              <pre
                className="text-left text-xs text-danger/80 bg-danger/05 border border-danger/20 rounded-xl p-4 mb-6 overflow-auto max-h-40"
              >
                {this.state.error.message}
              </pre>
            )}

            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all"
                style={{
                  background: 'rgba(0,198,255,0.1)',
                  border: '1px solid rgba(0,198,255,0.3)',
                  color: '#00c6ff',
                }}
              >
                <RefreshCw size={15} />
                Try Again
              </button>
              <button
                onClick={() => window.location.assign('/')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-text-secondary hover:text-text-primary transition-all"
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
