"use client";

import { ShieldCheck, Copy, Sparkles, Play, Download } from "lucide-react";

/**
 * ResultsTabs - Tabbed interface for displaying generated content
 * Shows public remarks, walk-thru script, features, and video generation
 */
export default function ResultsTabs({
  activeTab,
  setActiveTab,
  results,
  onCopy,
  onRefine,
  // Features loading state
  isGeneratingFeatures = false,
  // Video props
  videoData = null,
  secondsPerPhoto = 4,
  setSecondsPerPhoto = () => {},
  isGeneratingVideo = false,
  onGenerateVideo = () => {},
  onPreviewVideo = () => {},
  onDownloadVideo = () => {},
  photoUrlsDesc = [],
}) {
  const tabs = ["Public Remarks", "Features Sheet", "Video Tour"];

  // Get active content based on selected tab
  const getActiveContent = () => {
    switch (activeTab) {
      case "Public Remarks":
        return results.publicRemarks;
      case "Features Sheet":
        return results.features;
      default:
        return null;
    }
  };

  const activeContent = getActiveContent();
  const hasContent = activeContent && activeContent.trim().length > 0;
  const isVideoTab = activeTab === "Video Tour";

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-200">
      {/* Header with Tab Navigation */}
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="flex gap-2 flex-wrap">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                activeTab === tab
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="px-5 py-4">
        {/* Fair Housing Safe Badge - Hide on Video Tab */}
        {!isVideoTab && (
          <div className="mb-4 flex items-center justify-between">
            <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-teal-50 text-teal-700 border border-teal-100 rounded-full text-xs font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              Fair Housing Safe
            </div>

            {/* Action Buttons */}
            {hasContent && (
              <div className="flex gap-2">
                <button
                  onClick={() => onCopy(activeContent)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copy
                </button>
                <button
                  onClick={() => onRefine(activeTab)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Refine
                </button>
              </div>
            )}
          </div>
        )}

        {/* Video Tour Content */}
        {isVideoTab ? (
          <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 space-y-4">
            {/* Generating State */}
            {isGeneratingVideo && !videoData && (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center">
                    <Play className="w-8 h-8 text-indigo-600" />
                  </div>
                  <svg className="absolute inset-0 w-16 h-16 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
                <div className="text-center">
                  <h4 className="text-base font-semibold text-slate-900 mb-1">Generating Video...</h4>
                  <p className="text-sm text-slate-500">Creating walkthrough from {photoUrlsDesc.length} photos</p>
                  <p className="text-xs text-slate-400 mt-1">This may take 30-60 seconds</p>
                </div>
              </div>
            )}

            {/* Video Ready - Preview & Download */}
            {videoData && videoData.video_url && (
              <div className="space-y-4">
                {/* Video Preview */}
                <div className="rounded-lg overflow-hidden border border-slate-200 bg-black">
                  <video 
                    controls 
                    className="w-full"
                    src={videoData.video_url}
                    poster=""
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>

                {/* Video Info & Actions */}
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">Walkthrough Video Ready</h4>
                    <p className="text-xs text-slate-500">
                      {Math.round(videoData.duration_seconds || 0)}s • {videoData.photos_used || 0} photos
                    </p>
                  </div>
                  <button
                    onClick={() => onDownloadVideo(videoData.video_url)}
                    className="btn btn-primary btn-sm gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download Video
                  </button>
                </div>
              </div>
            )}

            {/* Waiting State (before generation starts) */}
            {!isGeneratingVideo && !videoData && (
              <div className="flex flex-col items-center justify-center py-12 space-y-3">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
                  <Play className="w-8 h-8 text-slate-400" />
                </div>
                <div className="text-center">
                  <h4 className="text-sm font-medium text-slate-600 mb-1">Video will generate automatically</h4>
                  <p className="text-xs text-slate-400">After property features are complete</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Text Content for other tabs */
          <>
            {/* Features Tab - Show skeleton if generating */}
            {activeTab === "Features Sheet" && isGeneratingFeatures ? (
              <div className="space-y-3 animate-pulse">
                <p className="text-sm text-slate-400 mb-4">Extracting property features...</p>
                <div className="space-y-3">
                  {/* Category headers and items skeleton */}
                  <div className="h-4 bg-slate-200 rounded w-32" />
                  <div className="pl-4 space-y-2">
                    <div className="h-3 bg-slate-100 rounded w-full" />
                    <div className="h-3 bg-slate-100 rounded w-11/12" />
                    <div className="h-3 bg-slate-100 rounded w-10/12" />
                  </div>
                  <div className="h-4 bg-slate-200 rounded w-40 mt-4" />
                  <div className="pl-4 space-y-2">
                    <div className="h-3 bg-slate-100 rounded w-full" />
                    <div className="h-3 bg-slate-100 rounded w-9/12" />
                  </div>
                  <div className="h-4 bg-slate-200 rounded w-36 mt-4" />
                  <div className="pl-4 space-y-2">
                    <div className="h-3 bg-slate-100 rounded w-full" />
                    <div className="h-3 bg-slate-100 rounded w-10/12" />
                    <div className="h-3 bg-slate-100 rounded w-11/12" />
                  </div>
                </div>
              </div>
            ) : hasContent ? (
              <div className="prose prose-slate max-w-none">
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                  {activeContent}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-400 mb-4">Waiting for content...</p>
                <div className="space-y-2">
                  <div className="h-3 bg-slate-100 rounded animate-pulse w-full" />
                  <div className="h-3 bg-slate-100 rounded animate-pulse w-11/12" />
                  <div className="h-3 bg-slate-100 rounded animate-pulse w-4/5" />
                  <div className="h-3 bg-slate-100 rounded animate-pulse w-full" />
                  <div className="h-3 bg-slate-100 rounded animate-pulse w-3/4" />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
