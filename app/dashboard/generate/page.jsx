"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import toast from "react-hot-toast";
import UserMenu from "@/components/UserMenu";
import PhotoUploader from "@/components/listing-magic/PhotoUploader";
import AddressInput from "@/components/listing-magic/AddressInput";
import GeneratedSection from "@/components/listing-magic/GeneratedSection";
import MLSPlaceholder from "@/components/listing-magic/MLSPlaceholder";
import { supabase } from "@/libs/supabase";
import {
  generateFeatures,
  generateWalkthruScript,
  generatePublicRemarks,
  generateAllContentMock,
  convertPhotosToImageInputs,
  formatGenerationTime,
  formatCost,
  copyToClipboard,
  getFriendlyErrorMessage,
  isRateLimitError,
} from "@/libs/generate-api";
import { saveListing } from "@/libs/listings";

export default function GeneratePage() {
  const [activeTab, setActiveTab] = useState("descriptions");

  // Refs for child components
  const photoUploaderRef = useRef(null);
  const addressInputRef = useRef(null);

  // User state
  const [user, setUser] = useState(null);

  // Form state
  const [photos, setPhotos] = useState([]);
  const [address, setAddress] = useState(null);

  // Get current user on mount
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState({ step: 0, total: 3, label: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [savedListingId, setSavedListingId] = useState(null);
  const [generationState, setGenerationState] = useState({
    publicRemarks: { status: "idle", data: null, error: null },
    walkthruScript: { status: "idle", data: null, error: null },
    features: { status: "idle", data: null, error: null },
  });

  // Handle photo changes
  const handlePhotosChange = useCallback((newPhotos) => {
    setPhotos(newPhotos);
  }, []);

  // Handle address changes
  const handleAddressChange = useCallback((newAddress) => {
    setAddress(newAddress);
  }, []);

  // Check if form is ready
  const isFormReady = photos.length > 0 && address?.street && address?.zip_code?.length === 5;

  // Check if any content has been generated (for save button visibility)
  const hasGeneratedContent =
    generationState.publicRemarks.data ||
    generationState.walkthruScript.data ||
    generationState.features.data;

  // Handle generate all content - SEQUENTIAL to avoid rate limits
  const handleGenerateAll = async () => {
    if (!isFormReady) {
      toast.error("Please upload photos and enter a complete address");
      return;
    }

    setIsGenerating(true);
    let successCount = 0;
    let rateLimitHit = false;

    // Reset all states
    setGenerationState({
      publicRemarks: { status: "idle", data: null, error: null },
      walkthruScript: { status: "idle", data: null, error: null },
      features: { status: "idle", data: null, error: null },
    });

    try {
      // Convert photos to base64
      setGenerationProgress({ step: 0, total: 3, label: "Preparing photos..." });
      toast.loading("Preparing photos...", { id: "generating" });
      const imageInputs = await convertPhotosToImageInputs(photos);

      // Build property details
      const propertyDetails = {
        address,
        photos: imageInputs,
        property_type: "single_family",
      };

      // STEP 1: Features (Gemini - fast & cheap)
      setGenerationProgress({ step: 1, total: 3, label: "Generating features..." });
      toast.loading("Generating features... (1/3)", { id: "generating" });
      setGenerationState(prev => ({
        ...prev,
        features: { status: "loading", data: null, error: null },
      }));

      try {
        const featuresResult = await generateFeatures(propertyDetails);
        setGenerationState(prev => ({
          ...prev,
          features: { status: "success", data: featuresResult, error: null },
        }));
        successCount++;
      } catch (error) {
        const friendlyError = getFriendlyErrorMessage(error);
        setGenerationState(prev => ({
          ...prev,
          features: { status: "error", data: null, error: friendlyError },
        }));
        if (isRateLimitError(error)) {
          rateLimitHit = true;
        }
      }

      // STEP 2: Walk-thru Script (Claude) - only if no rate limit
      if (!rateLimitHit) {
        setGenerationProgress({ step: 2, total: 3, label: "Generating walk-thru script..." });
        toast.loading("Generating walk-thru script... (2/3)", { id: "generating" });
        setGenerationState(prev => ({
          ...prev,
          walkthruScript: { status: "loading", data: null, error: null },
        }));

        try {
          const walkthruResult = await generateWalkthruScript(propertyDetails);
          setGenerationState(prev => ({
            ...prev,
            walkthruScript: { status: "success", data: walkthruResult, error: null },
          }));
          successCount++;
        } catch (error) {
          const friendlyError = getFriendlyErrorMessage(error);
          setGenerationState(prev => ({
            ...prev,
            walkthruScript: { status: "error", data: null, error: friendlyError },
          }));
          if (isRateLimitError(error)) {
            rateLimitHit = true;
          }
        }
      }

      // STEP 3: Public Remarks (GPT-4.1 - might hit rate limits) - only if no rate limit
      if (!rateLimitHit) {
        setGenerationProgress({ step: 3, total: 3, label: "Generating public remarks..." });
        toast.loading("Generating public remarks... (3/3)", { id: "generating" });
        setGenerationState(prev => ({
          ...prev,
          publicRemarks: { status: "loading", data: null, error: null },
        }));

        try {
          const publicRemarksResult = await generatePublicRemarks(propertyDetails);
          setGenerationState(prev => ({
            ...prev,
            publicRemarks: { status: "success", data: publicRemarksResult, error: null },
          }));
          successCount++;
        } catch (error) {
          const friendlyError = getFriendlyErrorMessage(error);
          setGenerationState(prev => ({
            ...prev,
            publicRemarks: { status: "error", data: null, error: friendlyError },
          }));
          if (isRateLimitError(error)) {
            rateLimitHit = true;
          }
        }
      }

      // Show appropriate toast
      if (rateLimitHit) {
        toast.error("Rate limit hit. Please wait 1 minute and try again.", { id: "generating" });
      } else if (successCount === 3) {
        toast.success("All content generated successfully!", { id: "generating" });
      } else if (successCount > 0) {
        toast.success(`Generated ${successCount}/3 sections`, { id: "generating" });
      } else {
        toast.error("Failed to generate content", { id: "generating" });
      }
    } catch (error) {
      console.error("Generation error:", error);
      const friendlyError = getFriendlyErrorMessage(error);
      toast.error(friendlyError, { id: "generating" });
    } finally {
      setIsGenerating(false);
      setGenerationProgress({ step: 0, total: 3, label: "" });
    }
  };

  // Handle test with mock data
  const handleTestWithMockData = async () => {
    setIsGenerating(true);

    // Set all sections to loading
    setGenerationState({
      publicRemarks: { status: "loading", data: null, error: null },
      walkthruScript: { status: "loading", data: null, error: null },
      features: { status: "loading", data: null, error: null },
    });

    toast.loading("Testing with mock data...", { id: "generating" });

    try {
      const result = await generateAllContentMock();

      setGenerationState({
        publicRemarks: { status: "success", data: result.publicRemarks, error: null },
        walkthruScript: { status: "success", data: result.walkthruScript, error: null },
        features: { status: "success", data: result.features, error: null },
      });

      toast.success("Mock content generated!", { id: "generating" });
    } catch (error) {
      console.error("Mock generation error:", error);
      toast.error("Mock generation failed", { id: "generating" });
    } finally {
      setIsGenerating(false);
    }
  };

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

  // Handle save listing to database
  const handleSaveListing = async () => {
    if (!hasGeneratedContent) {
      toast.error("No content to save. Generate content first.");
      return;
    }

    setIsSaving(true);
    toast.loading("Saving listing...", { id: "saving" });

    try {
      // Calculate total AI cost and generation time
      const totalCost =
        (generationState.publicRemarks.data?.usage?.cost_usd || 0) +
        (generationState.walkthruScript.data?.usage?.cost_usd || 0) +
        (generationState.features.data?.usage?.cost_usd || 0);

      const totalTime =
        (generationState.publicRemarks.data?.usage?.generation_time_ms || 0) +
        (generationState.walkthruScript.data?.usage?.generation_time_ms || 0) +
        (generationState.features.data?.usage?.generation_time_ms || 0);

      // Format address
      const propertyAddress = address
        ? `${address.street}, ${address.city || ""}, ${address.state || ""} ${address.zip_code}`.trim()
        : "";

      // Prepare listing data
      const listingData = {
        user_id: user?.id || null,
        property_address: propertyAddress,
        property_type: "single_family",
        bedrooms: null,
        bathrooms: null,
        public_remarks: generationState.publicRemarks.data?.text || null,
        walkthru_script: generationState.walkthruScript.data?.script || null,
        features: generationState.features.data
          ? JSON.stringify(generationState.features.data.categorized_features || generationState.features.data.features_list)
          : null,
        photo_urls: photos.map((p) => p.preview || null).filter(Boolean),
        ai_cost: totalCost,
        generation_time: totalTime,
      };

      const result = await saveListing(listingData);

      if (result.success) {
        setSavedListingId(result.id);
        toast.success("Listing saved successfully!", { id: "saving" });
      } else {
        toast.error(result.error || "Failed to save listing", { id: "saving" });
      }
    } catch (error) {
      console.error("Save listing error:", error);
      toast.error("Failed to save listing", { id: "saving" });
    } finally {
      setIsSaving(false);
    }
  };

  // Format features for display
  const formatFeaturesText = (featuresData) => {
    if (!featuresData) return null;

    if (featuresData.categorized_features?.length > 0) {
      return featuresData.categorized_features
        .map((category) => {
          const features = category.features.map((f) => `  - ${f}`).join("\n");
          return `${category.name}:\n${features}`;
        })
        .join("\n\n");
    }

    return featuresData.features_list?.join("\n") || null;
  };

  // Button configurations for each section
  const publicRemarksButtons = [
    {
      label: "Regenerate",
      variant: "ghost",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
        </svg>
      ),
      onClick: () => console.log("Regenerate public remarks"),
    },
    {
      label: "Add to MLS Data",
      variant: "primary",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      ),
      onClick: () => console.log("Add to MLS"),
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
      onClick: () => console.log("Regenerate walkthru"),
    },
    {
      label: "Add to MLS Data",
      variant: "secondary",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      ),
      onClick: () => console.log("Add to MLS"),
    },
    {
      label: "Generate Video",
      variant: "primary",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
        </svg>
      ),
      onClick: () => console.log("Generate video"),
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
      onClick: () => console.log("Regenerate features"),
    },
    {
      label: "Add to MLS Data",
      variant: "primary",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      ),
      onClick: () => console.log("Add to MLS"),
    },
  ];

  return (
    <main className="min-h-screen bg-base-100">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-base-100/80 backdrop-blur-lg border-b border-base-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Page Title */}
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-base-content">
                Generate Content
              </h1>
            </div>

            {/* User Menu */}
            <UserMenu user={user} />
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="sticky top-16 z-30 bg-base-100 border-b border-base-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-1" aria-label="Tabs">
            <button
              onClick={() => setActiveTab("descriptions")}
              className={`
                relative px-4 py-3 text-sm font-medium transition-colors
                ${activeTab === "descriptions"
                  ? "text-primary"
                  : "text-base-content/60 hover:text-base-content"
                }
              `}
            >
              <span className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                Property Descriptions
              </span>
              {activeTab === "descriptions" && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
              )}
            </button>

            <button
              onClick={() => setActiveTab("mls")}
              className={`
                relative px-4 py-3 text-sm font-medium transition-colors
                ${activeTab === "mls"
                  ? "text-primary"
                  : "text-base-content/60 hover:text-base-content"
                }
              `}
            >
              <span className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 1.5v-1.5m0 0c0-.621.504-1.125 1.125-1.125m0 0h7.5" />
                </svg>
                Data for MLS
              </span>
              {activeTab === "mls" && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === "descriptions" ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Sidebar - Photos & Address */}
            <aside className="lg:col-span-4 space-y-6">
              <div className="sticky top-40">
                {/* Card wrapper for sidebar content */}
                <div className="bg-base-100 border border-base-200 rounded-2xl p-6 space-y-6 shadow-sm">
                  <PhotoUploader
                    ref={photoUploaderRef}
                    onPhotosChange={handlePhotosChange}
                    disabled={isGenerating}
                  />
                  <div className="border-t border-base-200 pt-6">
                    <AddressInput
                      ref={addressInputRef}
                      onAddressChange={handleAddressChange}
                      disabled={isGenerating}
                    />
                  </div>

                  {/* Generate All Button */}
                  <div className="border-t border-base-200 pt-6 space-y-3">
                    <button
                      onClick={handleGenerateAll}
                      disabled={isGenerating || !isFormReady}
                      className="btn btn-primary w-full gap-2"
                    >
                      {isGenerating ? (
                        <>
                          <span className="loading loading-spinner loading-sm"></span>
                          <span className="flex flex-col items-start">
                            <span className="text-sm">
                              {generationProgress.label || "Generating..."}
                            </span>
                            {generationProgress.step > 0 && (
                              <span className="text-xs opacity-70">
                                Step {generationProgress.step} of {generationProgress.total}
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

                    {!isFormReady && (
                      <p className="text-xs text-base-content/40 text-center">
                        Upload photos and enter address first
                      </p>
                    )}

                    {/* Test with Mock Data button */}
                    <button
                      onClick={handleTestWithMockData}
                      disabled={isGenerating}
                      className="btn btn-ghost btn-sm w-full gap-2 text-base-content/60"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                      </svg>
                      Test with Mock Data
                    </button>
                  </div>
                </div>
              </div>
            </aside>

            {/* Main Content - Generated Sections */}
            <main className="lg:col-span-8 space-y-4">
              <GeneratedSection
                title="Public Remarks"
                description="250-word property description for MLS listing"
                generatedText={generationState.publicRemarks.data?.text}
                buttons={publicRemarksButtons}
                defaultOpen={generationState.publicRemarks.status === "loading" || generationState.publicRemarks.status === "success"}
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
              />

              <GeneratedSection
                title="Walk-thru Script"
                description="Video narration script for property tour"
                generatedText={generationState.walkthruScript.data?.script}
                buttons={walkthruButtons}
                defaultOpen={generationState.walkthruScript.status === "loading" || generationState.walkthruScript.status === "success"}
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
              />

              <GeneratedSection
                title="Features Sheet"
                description="Detailed property features and highlights"
                generatedText={formatFeaturesText(generationState.features.data)}
                buttons={featuresButtons}
                defaultOpen={generationState.features.status === "loading" || generationState.features.status === "success"}
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
              />

              {/* Save Listing Button - shown when content is generated */}
              {hasGeneratedContent && (
                <div className="border border-base-300 rounded-xl overflow-hidden bg-base-100 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-base-content">Save This Listing</h3>
                      <p className="text-sm text-base-content/60 mt-1">
                        Save all generated content to your account
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {savedListingId && (
                        <span className="flex items-center gap-1.5 text-xs text-success bg-success/10 px-3 py-1.5 rounded-full">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                          Saved
                        </span>
                      )}
                      <button
                        onClick={handleSaveListing}
                        disabled={isSaving || savedListingId}
                        className={`btn gap-2 ${savedListingId ? "btn-ghost" : "btn-primary"}`}
                      >
                        {isSaving ? (
                          <>
                            <span className="loading loading-spinner loading-sm"></span>
                            Saving...
                          </>
                        ) : savedListingId ? (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                            Saved
                          </>
                        ) : (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                            </svg>
                            Save Listing
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </main>
          </div>
        ) : (
          /* MLS Tab Content */
          <div className="bg-base-100 border border-base-200 rounded-2xl shadow-sm">
            <MLSPlaceholder />
          </div>
        )}
      </div>
    </main>
  );
}
