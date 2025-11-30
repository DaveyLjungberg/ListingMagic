"use client";

import { useState } from "react";

const ChatbotInput = ({
  placeholder = "Type refinement instructions...",
  onSubmit,
  isLoading = false,
  complianceError = null,
  onClearError = null,
}) => {
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (message.trim() && onSubmit && !isLoading) {
      await onSubmit(message);
      setMessage("");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleMessageChange = (e) => {
    setMessage(e.target.value);
    // Clear compliance error when user starts typing
    if (complianceError && onClearError) {
      onClearError();
    }
  };

  return (
    <div className="space-y-2">
      {/* Compliance Error Alert */}
      {complianceError && (
        <div className="bg-error/10 border border-error/30 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-5 h-5 text-error flex-shrink-0 mt-0.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
            <div className="flex-1">
              <h4 className="font-semibold text-sm text-error">
                Fair Housing Compliance Issue
              </h4>
              <p className="text-xs text-error/80 mt-0.5">
                {complianceError.message}
              </p>
              {complianceError.violations?.length > 0 && (
                <div className="mt-2 text-xs">
                  <p className="font-medium text-error/70">Flagged terms:</p>
                  <ul className="list-disc list-inside text-error/70 mt-1">
                    {complianceError.violations.map((v, i) => (
                      <li key={i}>
                        {v.category?.replace("_", " ")}: {v.matches?.join(", ")}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-xs text-base-content/60 mt-2">
                Tip: Describe the property features, not the people who might
                live there.
              </p>
            </div>
            {onClearError && (
              <button
                onClick={onClearError}
                className="text-error/60 hover:text-error"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="w-4 h-4"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="relative">
        <div className="flex items-start gap-3 p-3 bg-base-200/50 rounded-xl border border-base-300">
          {/* Chat icon */}
          <div className="flex-shrink-0 mt-1">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-5 h-5 text-primary/60"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
              />
            </svg>
          </div>

          {/* Input area */}
          <div className="flex-grow">
            <textarea
              value={message}
              onChange={handleMessageChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              rows={2}
              disabled={isLoading}
              className="w-full bg-transparent border-none resize-none focus:outline-none text-sm placeholder:text-base-content/40 disabled:opacity-50"
            />
          </div>

          {/* Send button */}
          <button
            onClick={handleSubmit}
            disabled={!message.trim() || isLoading}
            className={`
              flex-shrink-0 p-2 rounded-lg transition-all duration-200
              ${
                message.trim() && !isLoading
                  ? "bg-primary text-primary-content hover:bg-primary/90"
                  : "bg-base-300 text-base-content/30 cursor-not-allowed"
              }
            `}
          >
            {isLoading ? (
              <svg
                className="animate-spin w-4 h-4"
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
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-4 h-4"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
                />
              </svg>
            )}
          </button>
        </div>

        <p className="text-xs text-base-content/40 mt-2">
          {isLoading
            ? "Refining content..."
            : "Press Enter to send, Shift+Enter for new line"}
        </p>
      </div>
    </div>
  );
};

export default ChatbotInput;
