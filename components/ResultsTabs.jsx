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
  const tabs = ["Public Remarks", "Walk-thru Script", "Features Sheet", "Video Tour"];

  // Get active content based on selected tab
  const getActiveContent = () => {
    switch (activeTab) {
      case "Public Remarks":
        return results.publicRemarks;
      case "Walk-thru Script":
        return results.walkthruScript;
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
            {/* Duration Slider */}
            {!videoData && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-slate-900">Video Settings</h4>
                <div className="flex items-center gap-3">
                  <label className="text-xs font-medium text-slate-600 whitespace-nowrap">
                    Duration per photo:
                  </label>
                  <input
                    type="range"
                    min="2"
                    max="10"
                    step="0.5"
                    value={secondsPerPhoto}
                    onChange={(e) => setSecondsPerPhoto(parseFloat(e.target.value))}
                    className="range range-primary range-xs flex-1"
                  />
                  <span className="text-xs font-medium text-slate-700 w-12 text-right">
                    {secondsPerPhoto}s
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Estimated video length: ~{Math.round(photoUrlsDesc.length * secondsPerPhoto)} seconds ({photoUrlsDesc.length} photos)
                </p>
              </div>
            )}

            {/* Generate Button */}
            {!videoData && (
              <button
                onClick={onGenerateVideo}
                disabled={isGeneratingVideo}
                className="btn btn-primary w-full gap-2"
              >
                {isGeneratingVideo ? (
                  <>
                    <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating Video...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Generate Video
                  </>
                )}
              </button>
            )}

            {/* Video Preview & Download */}
            {videoData && videoData.video_url && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">Video Ready</h4>
                    <p className="text-xs text-slate-500">
                      {Math.round(videoData.duration_seconds || 0)}s • {videoData.photos_used || 0} photos
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onDownloadVideo(videoData.video_url)}
                      className="btn btn-success btn-sm gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                    <button
                      onClick={() => onPreviewVideo(videoData.video_url)}
                      className="btn btn-outline btn-sm gap-2"
                    >
                      <Play className="w-4 h-4" />
                      Preview
                    </button>
                  </div>
                </div>
                
                <video 
                  controls 
                  className="w-full rounded-lg border border-slate-200"
                  src={videoData.video_url}
                >
                  Your browser does not support the video tag.
                </video>
              </div>
            )}
          </div>
        ) : (
          /* Text Content for other tabs */
          <>
            {hasContent ? (
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
