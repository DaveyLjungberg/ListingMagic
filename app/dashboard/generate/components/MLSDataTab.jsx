"use client";

import MLSDataDisplay from "@/components/listing-magic/MLSDataDisplay";
import ErrorBoundary from "@/components/ErrorBoundary";

/**
 * MLS Data Tab component.
 * Displays extracted MLS data with editing capabilities.
 */
export default function MLSDataTab({
  // Generation state
  isGeneratingMLS,
  mlsData,
  mlsDataEditable,

  // Listing state
  currentListingIdMLS,

  // Descriptions tab data (for checking if data exists)
  photoUrlsDesc,
  photosDesc,
  addressDesc,

  // Handlers
  handleMLSFieldChange,
  handleSaveMLSEdits,
  handleGenerateMLS,

  // Tab switch handler
  setActiveTab,
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Main Content - MLS Data Display (full width) */}
      <main className="lg:col-span-12">
        <div className="bg-base-100 border border-base-200 rounded-2xl shadow-sm p-6">
          {isGeneratingMLS ? (
            /* Loading State with Skeleton Animation */
            <div className="space-y-6 animate-pulse">
              {/* Header Skeleton */}
              <div className="flex justify-between items-center mb-6">
                <div className="h-8 bg-base-300 rounded w-48"></div>
                <div className="h-8 bg-base-300 rounded w-32"></div>
              </div>

              {/* High Confidence Fields Skeleton */}
              <div className="h-64 bg-base-200 rounded-xl"></div>

              {/* Moderate Confidence Fields Skeleton */}
              <div className="h-48 bg-base-200 rounded-xl"></div>

              <div className="flex flex-col items-center justify-center py-8">
                <span className="loading loading-spinner loading-lg text-primary"></span>
                <p className="text-base-content/60 mt-4">Extracting MLS data from photos...</p>
                <p className="text-base-content/40 text-sm mt-1">This may take 10-30 seconds</p>
              </div>
            </div>
          ) : mlsData ? (
            /* MLS Data Display */
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">Extracted MLS Data</h2>
                <div className="flex gap-2">
                  {/* Re-Extract Button */}
                  <button
                    onClick={handleGenerateMLS}
                    disabled={isGeneratingMLS}
                    className="btn btn-outline btn-sm gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                    Re-Extract
                  </button>

                  <button
                    onClick={handleSaveMLSEdits}
                    disabled={!currentListingIdMLS}
                    className="btn btn-primary btn-sm gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 3.75H6.912a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H15M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859M12 3v8.25m0 0l-3-3m3 3l3-3" />
                    </svg>
                    Save Changes
                  </button>
                </div>
              </div>
              <ErrorBoundary section="MLS Data Display">
                <MLSDataDisplay
                  data={mlsData}
                  editableData={mlsDataEditable}
                  onFieldChange={handleMLSFieldChange}
                  isEditable={true}
                />
              </ErrorBoundary>
            </div>
          ) : (
            /* Empty State */
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-20 h-20 rounded-2xl bg-base-200 flex items-center justify-center mb-6">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-10 h-10 text-base-content/30">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 1.5v-1.5m0 0c0-.621.504-1.125 1.125-1.125m0 0h7.5" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-base-content mb-2">Extract MLS Data</h3>
              <p className="text-base-content/60 text-center max-w-md mb-4">
                AI will analyze your property photos and extract 22 MLS-compliant fields including bedrooms, bathrooms, flooring, appliances, and more.
              </p>
              {/* Show button to go to Descriptions if no data */}
              {!((photoUrlsDesc.length > 0 || photosDesc.length > 0) && addressDesc?.street) && (
                <button
                  onClick={() => setActiveTab("descriptions")}
                  className="btn btn-primary gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                  </svg>
                  Upload Photos on Descriptions Tab
                </button>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
