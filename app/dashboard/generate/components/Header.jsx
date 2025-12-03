"use client";

import UserMenu from "@/components/UserMenu";

/**
 * Header component with wake lock status and user menu.
 */
export default function Header({
  user,
  isGeneratingDesc,
  isGeneratingMLS,
  isWakeLockActive,
}) {
  return (
    <header className="sticky top-0 z-40 bg-base-100/80 backdrop-blur-lg border-b border-base-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Page Title */}
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-base-content">
              New Listing
            </h1>
          </div>

          {/* Wake Lock Status & User Menu */}
          <div className="flex items-center gap-3">
            {/* Wake Lock Status Indicator - only shows during generation */}
            {(isGeneratingDesc || isGeneratingMLS) && isWakeLockActive && (
              <div className="badge badge-success gap-1.5 badge-sm">
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
                Tab Protected
              </div>
            )}
            <UserMenu user={user} />
          </div>
        </div>
      </div>
    </header>
  );
}
