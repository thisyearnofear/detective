// src/components/ErrorBoundary.tsx
/**
 * Error Boundary Component
 * 
 * Catches React errors in the component tree and displays a recovery UI.
 * Prevents the entire app from crashing due to isolated errors.
 */

"use client";

import { Component, ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  resetKeys?: any[];
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Global error boundary for the entire app
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
    
    // Call optional error handler
    this.props.onError?.(error, errorInfo);
    
    // Report to analytics (if available)
    if (typeof window !== "undefined" && "analytics" in window) {
      // @ts-ignore - analytics may be loaded dynamically
      window.analytics?.capture?.("react_error", {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
      });
    }
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error recovery UI
      return (
        <div className="min-h-[400px] flex items-center justify-center p-8">
          <div className="max-w-md text-center">
            <div className="text-6xl mb-4">😵</div>
            <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
            <p className="text-gray-400 text-sm mb-6">
              {this.state.error?.message || "An unexpected error occurred"}
            </p>
            <button
              onClick={this.handleReset}
              className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full font-semibold transition-all border border-white/20"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook to access error boundary state from children
 */
export function useErrorBoundary() {
  // This would require context, simplified for now
  return {
    showError: (error: Error) => {
      console.error("[useErrorBoundary]", error);
      // In production, would trigger error boundary via context
    },
  };
}

export default ErrorBoundary;