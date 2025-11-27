"use client";

import { useState } from "react";
import ChatbotInput from "./ChatbotInput";

const GeneratedSection = ({
  title,
  description,
  generatedText,
  buttons = [],
  defaultOpen = false
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const handleRefinement = (message) => {
    // Placeholder for refinement functionality
    console.log(`Refinement for ${title}:`, message);
  };

  return (
    <div className="border border-base-300 rounded-xl overflow-hidden bg-base-100 transition-shadow hover:shadow-sm">
      {/* Header - Clickable to toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-base-200/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {/* Chevron indicator */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className={`w-5 h-5 text-base-content/50 transition-transform duration-200 ${
              isOpen ? "rotate-90" : ""
            }`}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.25 4.5l7.5 7.5-7.5 7.5"
            />
          </svg>

          <div className="text-left">
            <h3 className="font-semibold text-base-content">{title}</h3>
            {description && (
              <p className="text-sm text-base-content/50">{description}</p>
            )}
          </div>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-2">
          {generatedText ? (
            <span className="flex items-center gap-1.5 text-xs text-success bg-success/10 px-2 py-1 rounded-full">
              <span className="w-1.5 h-1.5 bg-success rounded-full"></span>
              Generated
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-base-content/40 bg-base-200 px-2 py-1 rounded-full">
              <span className="w-1.5 h-1.5 bg-base-content/30 rounded-full"></span>
              Pending
            </span>
          )}
        </div>
      </button>

      {/* Collapsible Content */}
      <div
        className={`
          overflow-hidden transition-all duration-300 ease-in-out
          ${isOpen ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"}
        `}
      >
        <div className="px-4 pb-4 space-y-4">
          {/* Divider */}
          <div className="border-t border-base-200"></div>

          {/* Generated Text Display */}
          <div className="bg-base-200/30 rounded-lg p-4 border border-base-200">
            <div className="flex items-center gap-2 mb-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-4 h-4 text-base-content/50"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                />
              </svg>
              <span className="text-xs font-medium text-base-content/50 uppercase tracking-wide">
                Generated Content
              </span>
            </div>

            {generatedText ? (
              <div className="prose prose-sm max-w-none text-base-content/80 leading-relaxed">
                {generatedText}
              </div>
            ) : (
              <div className="text-center py-8">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1}
                  stroke="currentColor"
                  className="w-12 h-12 mx-auto text-base-content/20 mb-3"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
                  />
                </svg>
                <p className="text-sm text-base-content/40">
                  Content will appear here once generated
                </p>
                <p className="text-xs text-base-content/30 mt-1">
                  Upload photos and enter address to begin
                </p>
              </div>
            )}
          </div>

          {/* Chatbot Input for Refinements */}
          <div>
            <label className="block text-xs font-medium text-base-content/50 uppercase tracking-wide mb-2">
              Refine Content
            </label>
            <ChatbotInput
              placeholder={`Refine the ${title.toLowerCase()}...`}
              onSubmit={handleRefinement}
            />
          </div>

          {/* Action Buttons */}
          {buttons.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {buttons.map((button, index) => (
                <button
                  key={index}
                  onClick={button.onClick}
                  className={`
                    btn btn-sm gap-2
                    ${button.variant === "primary" ? "btn-primary" : ""}
                    ${button.variant === "secondary" ? "btn-outline" : ""}
                    ${button.variant === "ghost" ? "btn-ghost" : ""}
                    ${!button.variant ? "btn-outline" : ""}
                  `}
                >
                  {button.icon && button.icon}
                  {button.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GeneratedSection;
