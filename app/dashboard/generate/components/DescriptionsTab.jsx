"use client";

import { useState, useEffect } from "react";
import PhotoUploader from "@/components/listing-magic/PhotoUploader";
import AddressInput from "@/components/listing-magic/AddressInput";
import ListingLoader from "@/components/listing-magic/ListingLoader";
import ContextSwitcher from "@/components/listing-magic/ContextSwitcher";
import AddBuyerModal from "@/components/listing-magic/AddBuyerModal";
import ErrorBoundary from "@/components/ErrorBoundary";
import NarrativeLoader from "@/components/NarrativeLoader";
import ResultsTabs from "@/components/ResultsTabs";
import NameListingModal from "@/components/listing-magic/NameListingModal";
import { copyToClipboard } from "@/libs/generate-api";
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
  isGeneratingFeatures,
  isGeneratingBackground,
  generationProgressDesc,
  generationState,
  // expandedSections, // unused
  // setExpandedSections, // unused

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
  // handleRegeneratePublicRemarks, // unused
  // handleRegenerateWalkthruScript, // unused
  // handleRegenerateFeatures, // unused
  handleLoadDescListing,
  handleClearDescData,

  // Refinement handlers
  handleRefineRemarks,
  handleRefineScript,
  handleRefineFeatures,
  // isRefiningRemarks, // unused
  // isRefiningScript, // unused
  // isRefiningFeatures, // unused
  // remarksComplianceError, // unused
  // scriptComplianceError, // unused
  // featuresComplianceError, // unused
  // setRemarksComplianceError, // unused
  // setScriptComplianceError, // unused
  // setFeaturesComplianceError, // unused

  // Video state and handlers (silent videos only)
  isGeneratingVideo,
  videoData,
  secondsPerPhoto,
  setSecondsPerPhoto,
  handleGenerateVideo,
  handleDownloadVideo,
  handlePreviewVideo,

  // Helpers
  formatFeaturesText,
  
  // Attempt tracking (for idempotent refunds)
  setCurrentAttemptId,
}) {
  // Results tab state
  const [resultsTab, setResultsTab] = useState("Public Remarks");

  // Name listing modal state
  const [showNameModal, setShowNameModal] = useState(false);

  // Context/Buyer state (local only, session-based)
  const [currentContext, setCurrentContext] = useState("Generic");
  const [buyers, setBuyers] = useState([]); // [{ id, name, documents: [] }]
  const [genericDocuments, setGenericDocuments] = useState([]); // Property-level docs
  const [showAddBuyerModal, setShowAddBuyerModal] = useState(false);

  // Auto-show modal when photos uploaded without address
  useEffect(() => {
    if (photosDesc.length > 0 && !addressDesc) {
      setShowNameModal(true);
    }
  }, [photosDesc, addressDesc]);

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

  // Handle refine routing based on active tab
  const handleRefine = (tabName) => {
    switch (tabName) {
      case "Public Remarks": {
        // Prompt user for instruction or use default
        const remarksInstruction = prompt("How would you like to refine the public remarks?");
        if (remarksInstruction) handleRefineRemarks(remarksInstruction);
        break;
      }
      case "Features Sheet": {
        const featuresInstruction = prompt("How would you like to refine the features?");
        if (featuresInstruction) handleRefineFeatures(featuresInstruction);
        break;
      }
    }
  };

  // Compute results object for ResultsTabs
  const results = {
    publicRemarks: generationState.publicRemarks.data?.text || "",
    features: formatFeaturesText(generationState.features.data) || "",
  };

  // Disable inputs while generation is active (overlay or background)
  const isGeneratingAny = isGeneratingDesc || isGeneratingBackground;

  return (
    <>
      {/* Narrative Loader Overlay */}
      <NarrativeLoader 
        isGenerating={isGeneratingDesc}
        progress={generationProgressDesc}
      />
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Column - Inputs */}
      <aside className="lg:col-span-4 space-y-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          {/* Listing Loader & Clear Button */}
          <div className="flex justify-end gap-2">
            <button
              onClick={handleClearDescData}
              disabled={isGeneratingAny || !hasDescDataToClear}
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
              disabled={isGeneratingAny}
            />
          </div>

          {/* Photo Uploader */}
          <ErrorBoundary section="Photo Uploader">
            <PhotoUploader
              ref={photoUploaderDescRef}
              photos={photosDesc}
              onPhotosChange={handlePhotosChangeDesc}
              disabled={isGeneratingAny}
            />
          </ErrorBoundary>

          {/* Photo Compliance Scanner */}
          {photosDesc.length > 0 && (
            <div className="border-t border-slate-200 pt-4 space-y-3">
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

          {/* Address Input */}
          <div className="border-t border-slate-200 pt-4">
            <AddressInput
              ref={addressInputDescRef}
              value={addressDesc}
              onAddressChange={handleAddressChangeDesc}
              disabled={isGeneratingAny}
              hideTaxFields={true}
              autoFetchTaxRecords={true}
            />
          </div>

          {/* Generate All Button */}
          <div className="border-t border-slate-200 pt-4">
            <button
              onClick={handleGenerateAllDesc}
              disabled={isGeneratingAny || !isFormReadyDesc}
              className="btn btn-primary w-full gap-2"
            >
              {isGeneratingAny ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  <span className="flex flex-col items-start">
                    <span className="text-sm">
                      {generationProgressDesc.label || "Generating..."}
                    </span>
                    {generationProgressDesc.phase === "analyzingPhotos" && generationProgressDesc.total > 0 && (
                      <span className="text-xs opacity-70">
                        Photo {generationProgressDesc.current} of {generationProgressDesc.total}
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
              <p className="text-xs text-base-content/40 text-center mt-3">
                Upload photos and enter address first
              </p>
            )}
          </div>
        </div>
      </aside>

      {/* Right Column - Results */}
      <main className="lg:col-span-8 space-y-4">
        {/* Context Switcher - Above Results Tabs */}
        <ContextSwitcher
          currentContext={currentContext}
          setCurrentContext={setCurrentContext}
          buyers={buyers}
          setBuyers={setBuyers}
          genericDocuments={genericDocuments}
          onAddBuyer={() => setShowAddBuyerModal(true)}
        />

        <ResultsTabs
          activeTab={resultsTab}
          setActiveTab={setResultsTab}
          results={results}
          onCopy={handleCopy}
          onRefine={handleRefine}
          isGeneratingFeatures={isGeneratingFeatures}
          videoData={videoData}
          secondsPerPhoto={secondsPerPhoto}
          setSecondsPerPhoto={setSecondsPerPhoto}
          isGeneratingVideo={isGeneratingVideo}
          onGenerateVideo={() => handleGenerateVideo(photoUrlsDesc, currentListingIdDesc)}
          onPreviewVideo={handlePreviewVideo}
          onDownloadVideo={(url) => handleDownloadVideo(url, currentListingIdDesc)}
          photoUrlsDesc={photoUrlsDesc}
          // Buyer mode props
          isBuyerMode={currentContext !== "Generic"}
          buyerName={currentContext}
          buyerDocCount={buyers.find((b) => b.name === currentContext)?.documents?.length || 0}
        />
      </main>
    </div>

    {/* Name Listing Modal (Credit Gatekeeper) */}
    <NameListingModal
      isOpen={showNameModal}
      onClose={() => setShowNameModal(false)}
      onSubmit={(addressData) => {
        // addressData now contains { street, zip_code, attempt_id }
        handleAddressChangeDesc(addressData);
        // Pass attempt_id up to parent for potential refund
        if (setCurrentAttemptId) {
          setCurrentAttemptId(addressData.attempt_id);
        }
        setShowNameModal(false);
      }}
      user={user}
    />

    {/* Add Buyer Modal */}
    <AddBuyerModal
      isOpen={showAddBuyerModal}
      onClose={() => setShowAddBuyerModal(false)}
      onSave={(name) => {
        setBuyers([
          ...buyers,
          { id: crypto.randomUUID(), name, documents: [] },
        ]);
        setShowAddBuyerModal(false);
      }}
    />
    </>
  );
}
