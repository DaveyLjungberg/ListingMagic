"use client";

import PhotoUploader from "@/components/listing-magic/PhotoUploader";
import AddressInput from "@/components/listing-magic/AddressInput";
import GeneratedSection from "@/components/listing-magic/GeneratedSection";
import ListingLoader from "@/components/listing-magic/ListingLoader";
import ErrorBoundary from "@/components/ErrorBoundary";
import { formatGenerationTime, formatCost, copyToClipboard } from "@/libs/generate-api";
import { VOICE_OPTIONS } from "@/config/elevenlabs";
import toast from "react-hot-toast";

/**
 * Property Descriptions Tab component.
 * Contains photo upload, address input, and generated content sections.
 */
export default function DescriptionsTab({
  // User
  user,

  // Refs
  photoUploaderDescRef,
  addressInputDescRef,

  // Photo state
  photosDesc,
  photoUrlsDesc,

  // Address state
  addressDesc,

  // Generation state
  isGeneratingDesc,
  generationProgressDesc,
  generationState,
  expandedSections,
  setExpandedSections,

  // Listing state
  currentListingIdDesc,

  // Compliance state
  complianceReportDesc,
  scanningComplianceDesc,

  // Computed values
  isFormReadyDesc,
  hasDescDataToClear,

  // Photo handlers
  handlePhotosChangeDesc,
  handleScanComplianceDesc,
  handleRemovePhotoDesc,

  // Address handlers
  handleAddressChangeDesc,

  // Generation handlers
  handleGenerateAllDesc,
  handleRegeneratePublicRemarks,
  handleRegenerateWalkthruScript,
  handleRegenerateFeatures,
  handleLoadDescListing,
  handleClearDescData,

  // Refinement handlers
  handleRefineRemarks,
  handleRefineScript,
  handleRefineFeatures,
  isRefiningRemarks,
  isRefiningScript,
  isRefiningFeatures,
  remarksComplianceError,
  scriptComplianceError,
  featuresComplianceError,
  setRemarksComplianceError,
  setScriptComplianceError,
  setFeaturesComplianceError,

  // Video state and handlers
  isGeneratingVideo,
  videoData,
  includeVoiceover,
  setIncludeVoiceover,
  selectedVoice,
  setSelectedVoice,
  isPreviewingVoice,
  handleGenerateVideo,
  handleDownloadVideo,
  handlePreviewVideo,
  handlePreviewVoice,

  // Helpers
  formatFeaturesText,
}) {
  const voiceOptions = VOICE_OPTIONS;

  // Handle copy to clipboard
  const handleCopy = async (text) => {
    const success = await copyToClipboard(text);
    if (success) {
      toast.success("Copied to clipboard!");
    } else {
      toast.error("Failed to copy");
    }
    return success;
  };

  // Button configurations
  const publicRemarksButtons = [
    {
      label: "Regenerate",
      variant: "ghost",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
        </svg>
      ),
      onClick: handleRegeneratePublicRemarks,
      disabled: generationState.publicRemarks.status === "loading",
    },
  ];

  const walkthruButtons = [
    {
      label: "Regenerate",
      variant: "ghost",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
        </svg>
      ),
      onClick: handleRegenerateWalkthruScript,
      disabled: generationState.walkthruScript.status === "loading",
    },
    {
      label: isGeneratingVideo ? "Generating Video..." : "Generate Video",
      variant: "primary",
      icon: isGeneratingVideo ? (
        <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
        </svg>
      ),
      onClick: () => handleGenerateVideo(generationState.walkthruScript.data?.script, photoUrlsDesc, currentListingIdDesc),
      disabled: isGeneratingVideo || !generationState.walkthruScript.data?.script || photoUrlsDesc.length === 0,
    },
  ];

  const featuresButtons = [
    {
      label: "Regenerate",
      variant: "ghost",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
        </svg>
      ),
      onClick: handleRegenerateFeatures,
      disabled: generationState.features.status === "loading",
    },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Left Sidebar - Photos & Address */}
      <aside className="lg:col-span-4 space-y-6 relative z-10">
        <div className="sticky top-40">
          {/* Card wrapper for sidebar content */}
          <div className="bg-base-100 border border-base-200 rounded-2xl p-6 space-y-6 shadow-sm">
            {/* Listing Loader & Clear Button */}
            <div className="flex justify-end gap-2 -mt-2 -mr-2 relative z-10">
              <button
                onClick={handleClearDescData}
                disabled={isGeneratingDesc || !hasDescDataToClear}
                className="btn btn-ghost btn-sm gap-1 text-base-content/60 hover:text-error hover:bg-error/10 disabled:opacity-40"
                title="Clear all data and start fresh"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
                Clear
              </button>
              <ListingLoader
                listingType="descriptions"
                userId={user?.id}
                onSelectListing={handleLoadDescListing}
                disabled={isGeneratingDesc}
              />
            </div>

            <ErrorBoundary section="Photo Uploader">
              <PhotoUploader
                ref={photoUploaderDescRef}
                photos={photosDesc}
                onPhotosChange={handlePhotosChangeDesc}
                disabled={isGeneratingDesc}
              />
            </ErrorBoundary>

            {/* Photo Compliance Scanner */}
            {photosDesc.length > 0 && (
              <div className="border-t border-base-200 pt-4 space-y-3">
                {/* Scan Button */}
                {!complianceReportDesc && !scanningComplianceDesc && (
                  <button
                    onClick={handleScanComplianceDesc}
                    className="btn btn-outline btn-sm w-full gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                    </svg>
                    Scan for Compliance Issues
                  </button>
                )}

                {/* Scanning Progress */}
                {scanningComplianceDesc && (
                  <div className="alert alert-info">
                    <span className="loading loading-spinner loading-sm"></span>
                    <span>Scanning {photosDesc.length} photos for compliance issues...</span>
                  </div>
                )}

                {/* Compliance Results */}
                {complianceReportDesc && !scanningComplianceDesc && (
                  <div className="space-y-3">
                    {complianceReportDesc.hasViolations ? (
                      <>
                        <div className="alert alert-warning">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                          </svg>
                          <span>{complianceReportDesc.violations.length} photo(s) have potential issues</span>
                        </div>

                        {/* Violation List */}
                        <div className="space-y-2">
                          {complianceReportDesc.violations.map((v) => (
                            <div key={v.photoIndex} className="flex items-start gap-3 p-3 bg-warning/10 rounded-lg border border-warning/20">
                              {/* Photo Thumbnail */}
                              <div className="w-12 h-12 rounded overflow-hidden flex-shrink-0 bg-base-200">
                                <img
                                  src={photosDesc[v.photoIndex]?.preview || photosDesc[v.photoIndex]}
                                  alt={v.photoName}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              {/* Issue Details */}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-base-content">{v.photoName}</p>
                                <ul className="text-xs text-warning-content/70 mt-1 space-y-0.5">
                                  {v.issues.map((issue, idx) => (
                                    <li key={idx}>• {issue}</li>
                                  ))}
                                </ul>
                              </div>
                              {/* Remove Button */}
                              <button
                                onClick={() => handleRemovePhotoDesc(v.photoIndex)}
                                className="btn btn-ghost btn-xs text-error"
                                title="Remove photo"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>

                        {/* Rescan Button */}
                        <button
                          onClick={handleScanComplianceDesc}
                          className="btn btn-ghost btn-xs w-full"
                        >
                          Scan Again
                        </button>
                      </>
                    ) : (
                      <div className="alert alert-success">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>All {complianceReportDesc.totalPhotos} photos are compliant!</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="border-t border-base-200 pt-6">
              <AddressInput
                ref={addressInputDescRef}
                onAddressChange={handleAddressChangeDesc}
                disabled={isGeneratingDesc}
                hideTaxFields={true}
                autoFetchTaxRecords={true}
              />
            </div>

            {/* Generate All Button */}
            <div className="border-t border-base-200 pt-6 space-y-3">
              <button
                onClick={handleGenerateAllDesc}
                disabled={isGeneratingDesc || !isFormReadyDesc}
                className="btn btn-primary w-full gap-2"
              >
                {isGeneratingDesc ? (
                  <>
                    <span className="loading loading-spinner loading-sm"></span>
                    <span className="flex flex-col items-start">
                      <span className="text-sm">
                        {generationProgressDesc.label || "Generating..."}
                      </span>
                      {generationProgressDesc.step > 0 && (
                        <span className="text-xs opacity-70">
                          Step {generationProgressDesc.step} of {generationProgressDesc.total}
                        </span>
                      )}
                    </span>
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                    </svg>
                    Generate All Content
                  </>
                )}
              </button>

              {!isFormReadyDesc && (
                <p className="text-xs text-base-content/40 text-center">
                  Upload photos and enter address first
                </p>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content - Generated Sections */}
      <main className="lg:col-span-8 space-y-4">
        <ErrorBoundary section="Public Remarks">
          <GeneratedSection
            title="Public Remarks"
            description="250-word property description for MLS listing"
            generatedText={generationState.publicRemarks.data?.text}
            buttons={publicRemarksButtons}
            isExpanded={expandedSections.publicRemarks}
            onToggle={() => setExpandedSections(prev => ({ ...prev, publicRemarks: !prev.publicRemarks }))}
            isLoading={generationState.publicRemarks.status === "loading"}
            error={generationState.publicRemarks.error}
            generationTime={
              generationState.publicRemarks.data?.usage?.generation_time_ms
                ? formatGenerationTime(generationState.publicRemarks.data.usage.generation_time_ms)
                : null
            }
            cost={
              generationState.publicRemarks.data?.usage?.cost_usd
                ? formatCost(generationState.publicRemarks.data.usage.cost_usd)
                : null
            }
            onCopy={handleCopy}
            onRefine={handleRefineRemarks}
            isRefining={isRefiningRemarks}
            complianceError={remarksComplianceError}
            onClearComplianceError={() => setRemarksComplianceError(null)}
          />
        </ErrorBoundary>

        <ErrorBoundary section="Walk-thru Script">
          <GeneratedSection
            title="Walk-thru Script"
            description="Video narration script for property tour"
            generatedText={generationState.walkthruScript.data?.script}
            buttons={walkthruButtons}
            isExpanded={expandedSections.walkthruScript}
            onToggle={() => setExpandedSections(prev => ({ ...prev, walkthruScript: !prev.walkthruScript }))}
            isLoading={generationState.walkthruScript.status === "loading"}
            error={generationState.walkthruScript.error}
            generationTime={
              generationState.walkthruScript.data?.usage?.generation_time_ms
                ? formatGenerationTime(generationState.walkthruScript.data.usage.generation_time_ms)
                : null
            }
            cost={
              generationState.walkthruScript.data?.usage?.cost_usd
                ? formatCost(generationState.walkthruScript.data.usage.cost_usd)
                : null
            }
            onCopy={handleCopy}
            onRefine={handleRefineScript}
            isRefining={isRefiningScript}
            complianceError={scriptComplianceError}
            onClearComplianceError={() => setScriptComplianceError(null)}
          >
            {/* Video Options - integrated into script section */}
            {!videoData && (
              <div className="space-y-4">
                {/* Voiceover Toggle */}
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeVoiceover}
                    onChange={(e) => setIncludeVoiceover(e.target.checked)}
                    className="checkbox checkbox-primary checkbox-sm"
                  />
                  <span className="text-sm font-medium">Include professional voiceover</span>
                  <span className="text-xs text-base-content/50">
                    {includeVoiceover ? "(~2 minutes)" : "(5 sec/photo, instant)"}
                  </span>
                </label>

                {/* Voice Selection - only visible when voiceover enabled */}
                <div className={`transition-all duration-300 overflow-hidden ${includeVoiceover ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"}`}>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-base-content/70">Select Voice</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {voiceOptions.map((voice) => (
                        <button
                          key={voice.id}
                          onClick={() => setSelectedVoice(voice.id)}
                          className={`relative p-3 border-2 rounded-lg text-left transition-all ${selectedVoice === voice.id
                            ? "border-primary bg-primary/5"
                            : "border-base-300 hover:border-base-content/30"
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium text-sm">{voice.name}</span>
                                <span className={`text-xs px-1.5 py-0.5 rounded ${voice.gender === "Female"
                                  ? "bg-pink-100 text-pink-700"
                                  : "bg-blue-100 text-blue-700"
                                }`}>
                                  {voice.gender === "Female" ? "F" : "M"}
                                </span>
                                {voice.age && (
                                  <span className="text-xs text-base-content/40">{voice.age}</span>
                                )}
                              </div>
                              <p className="text-xs text-base-content/60 mt-0.5">{voice.description}</p>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePreviewVoice(voice.id);
                              }}
                              disabled={isPreviewingVoice === voice.id}
                              className="ml-1 p-1.5 text-base-content/40 hover:text-primary transition-colors"
                              title="Preview voice"
                            >
                              {isPreviewingVoice === voice.id ? (
                                <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                                </svg>
                              )}
                            </button>
                          </div>
                          {selectedVoice === voice.id && (
                            <div className="absolute top-1.5 right-1.5">
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-primary">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </GeneratedSection>
        </ErrorBoundary>

        {/* Video Download Links */}
        {videoData && (
          <div className="card bg-base-100 border border-success/30 animate-fade-in">
            <div className="card-body py-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-success/10 rounded-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-success">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-sm">Video Ready!</p>
                    <p className="text-xs text-base-content/60">
                      {Math.round(videoData.duration_seconds)}s {videoData.has_voiceover ? "with voiceover" : "(silent)"} • {videoData.photos_used} photos
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDownloadVideo(videoData.video_url, currentListingIdDesc)}
                    className="btn btn-success btn-sm gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                    Download MP4
                  </button>
                  <button
                    onClick={() => handlePreviewVideo(videoData.video_url)}
                    className="btn btn-outline btn-sm gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                    </svg>
                    Preview
                  </button>
                  {videoData.script_url && (
                    <a
                      href={videoData.script_url}
                      download="walkthrough_script.txt"
                      className="btn btn-ghost btn-sm gap-2"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                      Script
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <ErrorBoundary section="Features Sheet">
          <GeneratedSection
            title="Features Sheet"
            description="Detailed property features and highlights"
            generatedText={formatFeaturesText(generationState.features.data)}
            buttons={featuresButtons}
            isExpanded={expandedSections.features}
            onToggle={() => setExpandedSections(prev => ({ ...prev, features: !prev.features }))}
            isLoading={generationState.features.status === "loading"}
            error={generationState.features.error}
            generationTime={
              generationState.features.data?.usage?.generation_time_ms
                ? formatGenerationTime(generationState.features.data.usage.generation_time_ms)
                : null
            }
            cost={
              generationState.features.data?.usage?.cost_usd
                ? formatCost(generationState.features.data.usage.cost_usd)
                : null
            }
            onCopy={handleCopy}
            onRefine={handleRefineFeatures}
            isRefining={isRefiningFeatures}
            complianceError={featuresComplianceError}
            onClearComplianceError={() => setFeaturesComplianceError(null)}
          />
        </ErrorBoundary>
      </main>
    </div>
  );
}
