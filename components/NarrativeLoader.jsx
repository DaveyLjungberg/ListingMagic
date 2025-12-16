"use client";

import { UploadCloud, ScanEye, PenTool } from "lucide-react";

/**
 * NarrativeLoader - Full-screen generation overlay
 * Shows real-time progress during photo preparation and public remarks generation
 * 
 * Progress prop structure:
 * - phase: "uploadingPhotos" | "analyzingPhotos" | "generatingPublicRemarks"
 * - current: current photo number (for analyzingPhotos phase)
 * - total: total number of photos (for analyzingPhotos phase)
 */
export default function NarrativeLoader({ isGenerating, progress }) {
  if (!isGenerating) return null;

  // Default progress if not provided
  const currentProgress = progress || { phase: "uploadingPhotos", current: 0, total: 0 };

  // Define phases
  const phases = {
    uploadingPhotos: {
      icon: UploadCloud,
      title: "Uploading photos to storage...",
      color: "text-blue-600",
      bgColor: "bg-blue-100",
      showProgress: false,
    },
    analyzingPhotos: {
      icon: ScanEye,
      title: currentProgress.total > 0 
        ? `Analyzing photo ${currentProgress.current} of ${currentProgress.total}...`
        : "Analyzing photos...",
      color: "text-indigo-600",
      bgColor: "bg-indigo-100",
      showProgress: true,
      progressPercent: currentProgress.total > 0 
        ? Math.round((currentProgress.current / currentProgress.total) * 100)
        : 0,
    },
    generatingPublicRemarks: {
      icon: PenTool,
      title: "Generating public remarks...",
      color: "text-violet-600",
      bgColor: "bg-violet-100",
      showProgress: false,
    },
  };

  const activePhase = phases[currentProgress.phase] || phases.uploadingPhotos;
  const Icon = activePhase.icon;

  return (
    <div className="fixed inset-0 z-50 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center">
      {/* Main Content */}
      <div className="flex flex-col items-center gap-6 max-w-md mx-auto px-4">
        {/* Pulsing Icon Circle */}
        <div className={`p-8 rounded-full ${activePhase.bgColor} animate-pulse shadow-lg transition-all duration-300`}>
          <Icon className={`w-16 h-16 ${activePhase.color}`} strokeWidth={1.5} />
        </div>

        {/* Title */}
        <h2 className="text-2xl font-serif font-semibold text-primary-navy text-center">
          {activePhase.title}
        </h2>

        {/* Progress Bar (only for analyzingPhotos phase) */}
        {activePhase.showProgress && (
          <div className="w-full max-w-md">
            <div className="w-full h-2 bg-base-200 rounded-full overflow-hidden">
              <div
                className={`h-full ${activePhase.bgColor} transition-all duration-300 ease-out`}
                style={{ width: `${activePhase.progressPercent}%` }}
              />
            </div>
            <p className="text-xs text-base-content/50 text-center mt-2">
              {activePhase.progressPercent}% complete
            </p>
          </div>
        )}

        {/* Spinner for indeterminate phases */}
        {!activePhase.showProgress && (
          <div className="flex items-center gap-2">
            <span className="loading loading-spinner loading-md"></span>
            <span className="text-sm text-base-content/60">Please wait...</span>
          </div>
        )}
      </div>
    </div>
  );
}
