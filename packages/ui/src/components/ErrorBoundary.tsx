import { Component, type ReactNode } from 'react';
import { ErrorState } from './ErrorState';

interface State {
  error: Error | null;
}

/**
 * App-level boundary so an uncaught render error shows our ErrorState
 * instead of a white screen. React still needs a class for componentDidCatch
 * — no hooks equivalent exists.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(error);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '2rem' }}>
          <ErrorState error={this.state.error} retry={() => this.setState({ error: null })} />
        </div>
      );
    }
    return this.props.children;
  }
}
