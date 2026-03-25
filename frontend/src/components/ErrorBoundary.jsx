/**
 * Error boundary — catches React render errors and shows a friendly recovery UI.
 *
 * Usage (class component required by React):
 *   <ErrorBoundary>
 *     <MyPage />
 *   </ErrorBoundary>
 */

import React from 'react';
import { AlertOctagon, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // In production you could send to a logging service
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-5">
            <AlertOctagon className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
          <p className="text-slate-400 text-sm mb-1">
            An unexpected error occurred in this panel. Your data is safe.
          </p>
          {this.state.error?.message && (
            <p className="text-xs text-red-400 font-mono bg-red-900/20 rounded px-3 py-2 mt-3 text-left break-all">
              {this.state.error.message}
            </p>
          )}
          <button
            onClick={this.reset}
            className="btn-primary flex items-center gap-2 mx-auto mt-5"
          >
            <RefreshCw className="w-4 h-4" />
            Try again
          </button>
        </div>
      </div>
    );
  }
}
