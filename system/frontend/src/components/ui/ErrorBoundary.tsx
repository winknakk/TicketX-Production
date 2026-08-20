import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught Error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', fontFamily: 'sans-serif', background: '#09090b', color: '#fff', minHeight: '100vh' }}>
          <h1 style={{ fontSize: '1.5rem', color: '#ef4444', marginBottom: '1rem' }}>Workspace Application Error</h1>
          <p style={{ marginBottom: '1rem', color: '#a1a1aa' }}>An unexpected error occurred during rendering.</p>
          <pre style={{ background: '#18181b', padding: '1rem', borderRadius: '8px', overflowX: 'auto', color: '#f43f5e', fontSize: '0.85rem' }}>
            {this.state.error?.toString()}
          </pre>
          {this.state.errorInfo && (
            <details style={{ marginTop: '1rem', color: '#71717a' }}>
              <summary style={{ cursor: 'pointer', marginBottom: '0.5rem' }}>Component Stack Trace</summary>
              <pre style={{ background: '#18181b', padding: '1rem', borderRadius: '8px', overflowX: 'auto', color: '#a1a1aa', fontSize: '0.75rem' }}>
                {this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null, errorInfo: null });
              window.location.reload();
            }}
            style={{ marginTop: '1.5rem', padding: '0.6rem 1.2rem', background: '#ffffff', color: '#000000', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
