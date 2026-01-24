"use client";

import { useState, useEffect, useRef } from "react";
import PhotoUploader from "@/components/listing-magic/PhotoUploader";
import DocumentUploader from "@/components/listing-magic/DocumentUploader";
import AddressInput from "@/components/listing-magic/AddressInput";
import ListingLoader from "@/components/listing-magic/ListingLoader";
import ErrorBoundary from "@/components/ErrorBoundary";
import NarrativeLoader from "@/components/NarrativeLoader";
import NameListingModal from "@/components/listing-magic/NameListingModal";
import { copyToClipboard } from "@/libs/generate-api";
import toast from "react-hot-toast";
import { FileText, ClipboardCheck, ListChecks, Copy, Loader2, Sparkles, Video } from "lucide-react";

// Example prompts for each tab
const EXAMPLE_PROMPTS = {
  draft: [
    "Draft MLS public remarks",
    "Draft a response to the following question from a prospective buyer: \"Why is your property higher priced than the property on Oak Street?\"",
  ],
  review: [
    "Review the Property Fact Sheet for missing information and for inconsistencies",
    "Review the CMA to find issues if there is any new information from the past week",
  ],
  walkthru: [
    "Draft a walk-thru script for showing the property",
    "Draft a video tour script highlighting key features",
  ],
  summary: [
    "Summarize the most important conclusions in the CMA",
    "Identify the most important findings in the Inspection Report",
  ],
};

// Tab help text (shown above prompt area)
const TAB_HELP_TEXT = {
  draft: "Ask ListingGopher to help you draft some text",
  review: "Ask ListingGopher to help you review documents for readiness",
  walkthru: "Ask ListingGopher to help you draft a walk-thru script",
  summary: "Ask ListingGopher to help you summarize key points",
};

// Follow-up placeholders per tab
const FOLLOW_UP_PLACEHOLDERS = {
  draft: "Do you have changes you want me to make?",
  review: "Do you have any questions?",
  walkthru: "Do you have changes you want me to make?",
  summary: "Do you want me to say more?",
};

// Tab configuration (order matches demo slides)
const TABS = [
  { id: 'draft', label: 'Draft some text', icon: FileText },
  { id: 'review', label: 'Review for readiness', icon: ClipboardCheck },
  { id: 'walkthru', label: 'Draft a walk-thru', icon: Video },
  { id: 'summary', label: 'Summarize key points', icon: ListChecks },
];

/**
 * Property Descriptions Tab component.
 * Contains photo upload, document upload, address input, and new 4-tab structure.
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
  handleLoadDescListing,
  handleClearDescData,

  // Refinement handlers
  handleRefineRemarks,
  handleRefineScript,
  handleRefineFeatures,

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
  // Document uploader ref
  const documentUploaderRef = useRef(null);

  // Active tab state
  const [activeTab, setActiveTab] = useState('draft');

  // Per-tab content state
  const [tabContent, setTabContent] = useState({
    draft: { prompt: '', response: '', followUp: '' },
    review: { prompt: '', response: '', followUp: '' },
    walkthru: { prompt: '', response: '', followUp: '' },
    summary: { prompt: '', response: '', followUp: '' },
  });

  // Per-tab loading state
  const [tabLoading, setTabLoading] = useState({
    draft: false,
    review: false,
    walkthru: false,
    summary: false,
  });

  // Documents state
  const [uploadedDocuments, setUploadedDocuments] = useState([]);

  // Name listing modal state
  const [showNameModal, setShowNameModal] = useState(false);

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

  // Update tab content helper
  const updateTabContent = (tab, field, value) => {
    setTabContent(prev => ({
      ...prev,
      [tab]: { ...prev[tab], [field]: value }
    }));
  };

  // Map tab names to API endpoints
  const TAB_ENDPOINTS = {
    draft: 'draft-text',
    review: 'review',
    walkthru: 'walkthru',
    summary: 'summarize',
  };

  // Handle generate - calls real API
  const handleGenerate = async (tab) => {
    if (!tabContent[tab].prompt.trim()) return;

    setTabLoading(prev => ({ ...prev, [tab]: true }));

    try {
      const endpoint = TAB_ENDPOINTS[tab];
      if (!endpoint) {
        throw new Error('Invalid tab type');
      }

      const response = await fetch(`/api/listinggopher/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId: currentListingIdDesc,
          userPrompt: tabContent[tab].prompt,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle specific error types
        if (data.error === 'no_documents') {
          throw new Error('Please upload documents first');
        }
        throw new Error(data.message || data.error || 'Generation failed');
      }

      updateTabContent(tab, 'response', data.generatedText);
      toast.success('Content generated!');

    } catch (error) {
      console.error('Generation error:', error);
      toast.error(error.message || 'Failed to generate content');
    } finally {
      setTabLoading(prev => ({ ...prev, [tab]: false }));
    }
  };

  // Handle follow-up refinement - calls API with combined prompt
  const handleFollowUp = async (tab) => {
    if (!tabContent[tab].followUp.trim()) return;

    setTabLoading(prev => ({ ...prev, [tab]: true }));

    try {
      const endpoint = TAB_ENDPOINTS[tab];
      if (!endpoint) {
        throw new Error('Invalid tab type');
      }

      // Combine original prompt with follow-up instruction
      const combinedPrompt = `Original request: ${tabContent[tab].prompt}\n\nPrevious response:\n${tabContent[tab].response}\n\nRefinement request: ${tabContent[tab].followUp}`;

      const response = await fetch(`/api/listinggopher/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId: currentListingIdDesc,
          userPrompt: combinedPrompt,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Refinement failed');
      }

      updateTabContent(tab, 'response', data.generatedText);
      updateTabContent(tab, 'followUp', '');
      toast.success('Content refined!');

    } catch (error) {
      console.error('Refinement error:', error);
      toast.error(error.message || 'Failed to refine content');
    } finally {
      setTabLoading(prev => ({ ...prev, [tab]: false }));
    }
  };

  // Handle document upload complete
  const handleDocumentUploadComplete = (docs) => {
    setUploadedDocuments(prev => [...prev, ...docs]);
    toast.success(`${docs.length} document(s) uploaded`);
  };

  // Disable inputs while generation is active (overlay or background)
  const isGeneratingAny = isGeneratingDesc || isGeneratingBackground;

  // Render tab content for draft/review/walkthru/summary tabs
  const renderTabContent = (tab) => {
    const content = tabContent[tab];
    const isLoading = tabLoading[tab];
    const examples = EXAMPLE_PROMPTS[tab];
    const helpText = TAB_HELP_TEXT[tab];
    const followUpPlaceholder = FOLLOW_UP_PLACEHOLDERS[tab];

    return (
      <div className="space-y-4">
        {/* Tab Help Text */}
        {helpText && (
          <p className="text-sm text-slate-500 italic">{helpText}</p>
        )}

        {/* Example Prompts (shown when no response yet) */}
        {!content.response && (
          <div className="space-y-3">
            <p className="text-sm text-slate-400">Example prompts:</p>
            <div className="flex flex-col gap-2">
              {examples.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => updateTabContent(tab, 'prompt', prompt)}
                  className="text-left px-4 py-3 text-sm text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Prompt Textarea */}
        <div>
          <textarea
            value={content.prompt}
            onChange={(e) => updateTabContent(tab, 'prompt', e.target.value)}
            placeholder="Enter your prompt..."
            disabled={isLoading}
            className="w-full min-h-[120px] p-4 border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm text-slate-700 placeholder:text-slate-400 disabled:opacity-50"
          />
        </div>

        {/* Generate Button */}
        <div>
          <button
            onClick={() => handleGenerate(tab)}
            disabled={!content.prompt.trim() || isLoading}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate
              </>
            )}
          </button>
        </div>

        {/* Generated Response */}
        {content.response && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {/* Response Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
              <span className="text-sm font-medium text-slate-700">Generated Response</span>
              <button
                onClick={() => handleCopy(content.response)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                Copy
              </button>
            </div>

            {/* Response Content */}
            <div className="p-4">
              <div className="prose prose-slate prose-sm max-w-none whitespace-pre-wrap">
                {content.response}
              </div>
            </div>
          </div>
        )}

        {/* Follow-up Input (shown after generation) */}
        {content.response && (
          <div className="space-y-3 pt-2">
            <div className="flex gap-3">
              <input
                value={content.followUp}
                onChange={(e) => updateTabContent(tab, 'followUp', e.target.value)}
                placeholder={followUpPlaceholder}
                disabled={isLoading}
                className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent placeholder:text-slate-400 disabled:opacity-50"
                onKeyDown={(e) => e.key === 'Enter' && handleFollowUp(tab)}
              />
              <button
                onClick={() => handleFollowUp(tab)}
                disabled={!content.followUp.trim() || isLoading}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Update'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

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

            {/* Document Uploader */}
            <div className="border-t border-slate-200 pt-4">
              <label className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
                <FileText className="w-4 h-4" />
                Property Documents
              </label>
              <div className="mt-3">
                <DocumentUploader
                  ref={documentUploaderRef}
                  listingId={currentListingIdDesc}
                  userId={user?.id}
                  onUploadComplete={handleDocumentUploadComplete}
                  disabled={isGeneratingAny}
                />
              </div>
            </div>

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
          </div>
        </aside>

        {/* Right Column - New Tab Structure */}
        <main className="lg:col-span-8 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Tab Navigation */}
            <div className="flex gap-1 p-3 bg-slate-50 border-b border-slate-200 overflow-x-auto">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${
                      activeTab === tab.id
                        ? 'bg-violet-600 text-white shadow-sm'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Tab Content */}
            <div className="p-5">
              {activeTab === 'draft' && renderTabContent('draft')}
              {activeTab === 'review' && renderTabContent('review')}
              {activeTab === 'walkthru' && renderTabContent('walkthru')}
              {activeTab === 'summary' && renderTabContent('summary')}
            </div>
          </div>
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
    </>
  );
}
