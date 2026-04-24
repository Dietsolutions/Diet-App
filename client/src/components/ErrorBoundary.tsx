import { Component, ReactNode } from 'react';
import { s2 } from '../theme/tokens';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div style={{
          border: `1px solid ${s2.line}`,
          background: s2.surface,
          padding: 14,
        }}>
          <p style={{ fontFamily: s2.sans, fontSize: 13, color: s2.textDim }}>
            Something went wrong rendering this section.
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            style={{
              marginTop: 8,
              background: 'transparent',
              border: 'none',
              padding: 0,
              fontFamily: s2.mono,
              fontSize: 9,
              letterSpacing: '0.15em',
              color: s2.accent,
              cursor: 'pointer',
              textTransform: 'uppercase',
            }}
          >
            RETRY
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}