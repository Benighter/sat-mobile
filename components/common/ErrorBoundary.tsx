import React from 'react';

type Props = {
  children: React.ReactNode;
  // When this value changes, the boundary will reset its error state
  resetKey?: any;
};
type State = { hasError: boolean; error?: any };

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, info: any) {
    // Log detailed info to help diagnose the exact source
    try {
      // eslint-disable-next-line no-console
      console.error('[ErrorBoundary] Unhandled UI error:', error, info);
      if (error?.stack) {
        // eslint-disable-next-line no-console
        console.error('[ErrorBoundary] Stack:', error.stack);
      }
    } catch {}
  }

  handleReload = () => {
    try {
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    } catch {}
  };

  handleRetry = () => {
    // Allow attempting to re-render without a full reload
    this.setState({ hasError: false, error: undefined });
  };

  componentDidUpdate(prevProps: Props) {
    // If the reset key changes, clear the error state so children can render again
    if (this.props.resetKey !== prevProps.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: undefined });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 via-white to-orange-50 p-6">
          <div className="glass rounded-3xl p-8 shadow-2xl max-w-md w-full">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <span className="text-red-500 text-xl">⚠️</span>
              </div>
              <h3 className="font-semibold text-red-800">Something went wrong</h3>
            </div>
            <p className="text-sm text-gray-700 mb-4">The app hit an unexpected error. You can try reloading the app. If the problem persists, please contact support.</p>
            <div className="flex gap-2">
              <button onClick={this.handleRetry} className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm font-semibold shadow">
                Try again
              </button>
              <button onClick={this.handleReload} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold shadow">
                Reload App
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
