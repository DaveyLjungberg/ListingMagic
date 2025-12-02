"use client";

import React from "react";

/**
 * ErrorBoundary - Catches JavaScript errors in child components
 *
 * Prevents the entire app from crashing when a component fails.
 * Shows a fallback UI and allows users to retry.
 *
 * Usage:
 *   <ErrorBoundary fallback={<p>Something went wrong</p>}>
 *     <YourComponent />
 *   </ErrorBoundary>
 *
 * Or with section name for better error messages:
 *   <ErrorBoundary section="Photo Gallery">
 *     <PhotoUploader />
 *   </ErrorBoundary>
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render shows the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log error for debugging (could send to error tracking service)
    console.error(
      `[ErrorBoundary] Error in ${this.props.section || "component"}:`,
      error,
      errorInfo.componentStack
    );
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      const sectionName = this.props.section || "This section";

      return (
        <div className="flex flex-col items-center justify-center p-6 bg-base-200 rounded-lg border border-error/20">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-10 h-10 text-error mb-3"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>

          <h3 className="text-lg font-semibold text-base-content mb-1">
            Something went wrong
          </h3>

          <p className="text-sm text-base-content/60 mb-4 text-center">
            {sectionName} encountered an error.
          </p>

          <button
            onClick={this.handleRetry}
            className="btn btn-sm btn-outline btn-error"
          >
            Try Again
          </button>

          {process.env.NODE_ENV === "development" && this.state.error && (
            <details className="mt-4 w-full max-w-md">
              <summary className="text-xs text-base-content/40 cursor-pointer">
                Error details (dev only)
              </summary>
              <pre className="mt-2 p-2 bg-base-300 rounded text-xs overflow-auto max-h-32">
                {this.state.error.toString()}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
