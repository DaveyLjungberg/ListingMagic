"use client";

/**
 * GenerationProgress component displays a prominent progress indicator
 * during long-running AI generation operations.
 *
 * Shows:
 * - Warning to stay on tab
 * - Current operation being performed
 * - Progress bar with step count
 * - Estimated time remaining
 * - Wake lock status indicator
 */
export default function GenerationProgress({
  currentStep,
  totalSteps,
  currentOperation,
  estimatedTimeRemaining,
  isWakeLockActive,
  startTime,
}) {
  const progress = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0;

  // Calculate elapsed time if startTime is provided
  const elapsedSeconds = startTime
    ? Math.round((Date.now() - startTime) / 1000)
    : 0;
  const elapsedDisplay =
    elapsedSeconds > 60
      ? `${Math.floor(elapsedSeconds / 60)}m ${elapsedSeconds % 60}s`
      : `${elapsedSeconds}s`;

  return (
    <div className="alert alert-warning shadow-lg mb-6">
      <div className="flex items-start gap-4 w-full">
        {/* Animated Spinner */}
        <svg
          className="animate-spin h-6 w-6 flex-shrink-0 text-warning-content"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>

        <div className="flex-1 min-w-0">
          {/* Warning Message */}
          <h3 className="font-bold text-lg flex items-center gap-2">
            <span>Please stay on this tab</span>
            {isWakeLockActive && (
              <span className="badge badge-success badge-sm gap-1">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-3 h-3"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
                    clipRule="evenodd"
                  />
                </svg>
                Protected
              </span>
            )}
          </h3>

          {/* Current Operation */}
          <p className="text-sm mt-1 opacity-90">{currentOperation}</p>

          {/* Progress Bar */}
          <progress
            className="progress progress-warning w-full mt-3"
            value={progress}
            max="100"
          />

          {/* Status Line */}
          <div className="flex justify-between text-xs mt-2 opacity-75">
            <span>
              Step {currentStep} of {totalSteps}
            </span>
            <span className="flex items-center gap-3">
              <span>Elapsed: {elapsedDisplay}</span>
              {estimatedTimeRemaining && (
                <span>{estimatedTimeRemaining}</span>
              )}
            </span>
          </div>

          {/* Wake Lock Warning for unsupported browsers */}
          {!isWakeLockActive && (
            <p className="text-xs mt-3 bg-warning-content/10 p-2 rounded">
              Your browser doesn&apos;t support automatic tab protection.
              Please keep this tab active and in the foreground to avoid
              interruption.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
