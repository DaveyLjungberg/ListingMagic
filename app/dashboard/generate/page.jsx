"use client";

import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { supabase } from "@/libs/supabase";
import OnboardingModal from "@/components/OnboardingModal";
import {
  generateFeatures,
  generatePublicRemarks,
  generateMLSDataWithStorage,
  convertPhotosToImageInputs,
  getFriendlyErrorMessage,
  isRateLimitError,
  orderPhotosForWalkthrough,
} from "@/libs/generate-api";
import { uploadPhotosToStorage } from "@/libs/supabase-storage-upload";
import { saveListing, updateListing } from "@/libs/listings";

// Local hooks
import {
  useWakeLockGeneration,
  useDescriptionsState,
  useMLSState,
  useVideoGeneration,
  useRefinement,
} from "./hooks";

// Local components
import {
  TabNavigation,
  DescriptionsTab,
  MLSDataTab,
} from "./components";

// Dashboard Header
import DashboardHeader from "@/components/DashboardHeader";

/**
 * Generate Page - Main orchestrator component.
 *
 * This page coordinates all generation functionality through modular hooks and components.
 * Each hook manages its own state and handlers, while this component orchestrates them.
 */
export default function GeneratePage() {
  // =========================================================================
  // ONBOARDING STATE
  // =========================================================================
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [userEmail, setUserEmail] = useState(null);

  // =========================================================================
  // TAB STATE
  // =========================================================================
  const [activeTab, setActiveTab] = useState("descriptions");

  // =========================================================================
  // USER STATE
  // =========================================================================
  const [user, setUser] = useState(null);

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

  // Check if user needs onboarding (no source set)
  useEffect(() => {
    const checkOnboarding = async () => {
      if (!user?.email) return;

      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('source')
          .eq('user_id', user.id)
          .maybeSingle(); // Use maybeSingle instead of single to handle missing profiles

        // If profile doesn't exist, create it
        if (!data && !error) {
          console.log('[Onboarding] No profile found, creating one');
          const emailDomain = user.email.split('@')[1];
          
          const { error: insertError } = await supabase
            .from('user_profiles')
            .insert({
              user_id: user.id,
              brokerage_domain: emailDomain,
              created_at: new Date().toISOString()
            });

          if (insertError) {
            console.error('Failed to create profile:', insertError);
            // Still show onboarding modal even if insert fails
            setUserEmail(user.email);
            setShowOnboarding(true);
            return;
          }

          // Profile created, show onboarding
          setUserEmail(user.email);
          setShowOnboarding(true);
          return;
        }

        if (error) {
          console.error('Error checking onboarding:', error);
          // Show modal anyway on error - better than blocking user
          setUserEmail(user.email);
          setShowOnboarding(true);
          return;
        }

        // Show modal if no source is set
        if (!data?.source) {
          setUserEmail(user.email);
          setShowOnboarding(true);
        }
      } catch (error) {
        console.error('Onboarding check failed:', error);
        // Show modal on unexpected error
        setUserEmail(user.email);
        setShowOnboarding(true);
      }
    };

    checkOnboarding();
  }, [user]);

  // =========================================================================
  // HOOKS
  // =========================================================================

  // Wake lock and progress management
  const wakeLock = useWakeLockGeneration();

  // Descriptions tab state
  const descState = useDescriptionsState();

  // MLS tab state
  const mlsState = useMLSState();

  // Video generation
  const video = useVideoGeneration();

  // Content refinement
  const refinement = useRefinement();

  // Generation attempt tracking (for idempotent refunds)
  const [currentAttemptId, setCurrentAttemptId] = useState(null);

  // =========================================================================
  // AUTO-SAVE EFFECTS
  // =========================================================================

  // Auto-save descriptions listing when generation completes
  useEffect(() => {
    if (descState.currentListingIdDesc) {
      console.log("[Auto-save Desc] Skipping - already have listing ID:", descState.currentListingIdDesc);
      return;
    }

    const allGenerated =
      descState.generationState.publicRemarks.status === "success" &&
      descState.generationState.features.status === "success";

    const hasValidPhotoUrls = descState.photoUrlsDesc.length > 0 &&
      descState.photoUrlsDesc.every(url => url.startsWith('http') && !url.startsWith('blob:'));

    if (allGenerated && user && descState.addressDesc && hasValidPhotoUrls) {
      const autoSaveDesc = async () => {
        try {
          const totalCost =
            (descState.generationState.publicRemarks.data?.usage?.cost_usd || 0) +
            (descState.generationState.features.data?.usage?.cost_usd || 0);

          const totalTime =
            (descState.generationState.publicRemarks.data?.usage?.generation_time_ms || 0) +
            (descState.generationState.features.data?.usage?.generation_time_ms || 0);

          const propertyAddress = descState.addressDesc
            ? `${descState.addressDesc.street}, ${descState.addressDesc.city || ""}, ${descState.addressDesc.state || ""} ${descState.addressDesc.zip_code}`.trim()
            : "";

          const listingData = {
            user_id: user.id,
            listing_type: "descriptions",
            property_address: propertyAddress,
            address_json: {
              street: descState.addressDesc.street,
              city: descState.addressDesc.city || "",
              state: descState.addressDesc.state || "",
              zip_code: descState.addressDesc.zip_code,
              apn: descState.addressDesc.apn || null,
              yearBuilt: descState.addressDesc.yearBuilt || null,
              lotSize: descState.addressDesc.lotSize || null,
              county: descState.addressDesc.county || null,
              attempt_id: currentAttemptId,
            },
            property_type: "single_family",
            bedrooms: mlsState.mlsData?.mls_fields?.bedrooms || null,
            bathrooms: mlsState.mlsData?.mls_fields?.bathrooms || null,
            public_remarks: descState.generationState.publicRemarks.data?.text || null,
            features: descState.generationState.features.data
              ? JSON.stringify(descState.generationState.features.data.categorized_features || descState.generationState.features.data.features_list)
              : null,
            mls_data: mlsState.mlsData || null,
            photo_urls: descState.photoUrlsDesc,
            ai_cost: totalCost,
            generation_time: totalTime,
          };

          console.log("[Auto-save Desc] Saving with photo URLs:", descState.photoUrlsDesc);
          const result = await saveListing(listingData);

          if (result.success) {
            descState.setCurrentListingIdDesc(result.id);
            toast.success("Listing saved automatically", { duration: 3000, icon: "✓" });
          }
        } catch (error) {
          console.error("Auto-save error:", error);
        }
      };

      autoSaveDesc();
    }
  }, [
    descState.generationState.publicRemarks.status,
    descState.generationState.features.status,
    descState.photoUrlsDesc,
    descState.currentListingIdDesc,
    user,
    descState.addressDesc,
    descState,
    mlsState.mlsData,
    mlsState,
    currentAttemptId,
  ]);

  // Auto-save or update MLS data
  useEffect(() => {
    if (mlsState.currentListingIdMLS) {
      console.log("[Auto-save MLS] Skipping - already have MLS listing ID:", mlsState.currentListingIdMLS);
      return;
    }

    if (!mlsState.mlsData) {
      return;
    }

    // If we have a descriptions listing ID, UPDATE it with MLS data
    // Otherwise, create a new MLS-only listing
    if (descState.currentListingIdDesc) {
      console.log("[Auto-save MLS] Updating descriptions listing with MLS data:", descState.currentListingIdDesc);
      const updateMLS = async () => {
        try {
          const result = await updateListing(descState.currentListingIdDesc, {
            mls_data: mlsState.mlsData,
            bedrooms: mlsState.mlsData.mls_fields?.bedrooms || null,
            bathrooms: mlsState.mlsData.mls_fields?.bathrooms || null,
          });

          if (result.success) {
            mlsState.setCurrentListingIdMLS(descState.currentListingIdDesc);
            toast.success("MLS data saved", { duration: 2000, icon: "✓" });
          }
        } catch (error) {
          console.error("Update MLS error:", error);
        }
      };
      updateMLS();
    } else {
      // Create standalone MLS listing (for MLS-only generation)
      const hasValidPhotoUrls = mlsState.photoUrlsMLS.length > 0 &&
        mlsState.photoUrlsMLS.every(url => url.startsWith('http') && !url.startsWith('blob:'));

      if (user && mlsState.addressMLS && hasValidPhotoUrls) {
        const autoSaveMLS = async () => {
          try {
            const propertyAddress = mlsState.addressMLS
              ? `${mlsState.addressMLS.street}, ${mlsState.addressMLS.city || ""}, ${mlsState.addressMLS.state || ""} ${mlsState.addressMLS.zip_code}`.trim()
              : "";

            const listingData = {
              user_id: user.id,
              listing_type: "mls_data",
              property_address: propertyAddress,
              address_json: {
                street: mlsState.addressMLS.street,
                city: mlsState.addressMLS.city || "",
                state: mlsState.addressMLS.state || "",
                zip_code: mlsState.addressMLS.zip_code,
                apn: mlsState.addressMLS.apn || null,
                yearBuilt: mlsState.addressMLS.yearBuilt || null,
                lotSize: mlsState.addressMLS.lotSize || null,
                county: mlsState.addressMLS.county || null,
                attempt_id: currentAttemptId,
              },
              property_type: "single_family",
              bedrooms: mlsState.mlsData.mls_fields?.bedrooms || null,
              bathrooms: mlsState.mlsData.mls_fields?.bathrooms || null,
              public_remarks: null,
              features: null,
              mls_data: mlsState.mlsData,
              photo_urls: mlsState.photoUrlsMLS,
              ai_cost: 0,
              generation_time: mlsState.mlsData.processing_time_ms || 0,
            };

            console.log("[Auto-save MLS] Creating standalone MLS listing");
            const result = await saveListing(listingData);

            if (result.success) {
              mlsState.setCurrentListingIdMLS(result.id);
              toast.success("MLS data saved automatically", { duration: 3000, icon: "✓" });
            }
          } catch (error) {
            console.error("Auto-save MLS error:", error);
          }
        };

        autoSaveMLS();
      }
    }
  }, [mlsState.mlsData, mlsState.photoUrlsMLS, mlsState.currentListingIdMLS, user, mlsState.addressMLS, mlsState, descState.currentListingIdDesc, currentAttemptId]);

  // =========================================================================
  // HELPER FUNCTIONS
  // =========================================================================

  /**
   * Get credit balance for the current user
   * Calls Supabase RPC to fetch domain + personal credits
   */
  const getCreditBalance = async () => {
    if (!user?.email) {
      return { success: false };
    }

    const { data, error } = await supabase.rpc('get_credit_balance', { 
      user_email: user.email 
    });

    if (error) {
      console.error('Error fetching credits:', error);
      return { success: false, error };
    }

    return { success: true, data };
  };

  /**
   * Helper to log actionable RPC error details
   */
  const logRpcError = (rpcName, params, error, status, statusText) => {
    console.error(`[page.jsx] RPC '${rpcName}' failed:`, {
      code: error?.code,
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      status,
      statusText,
      paramKeys: Object.keys(params),
    });
  };

  /**
   * Refund a credit to the user (for failed generations)
   * Uses idempotent refund_credit_attempt RPC with attempt_id
   * @param {string} attemptId - UUID of the generation attempt
   */
  const refundCredit = async (attemptId) => {
    if (!user?.email) {
      console.warn('Cannot refund credit: user email not found');
      return { success: false };
    }

    if (!attemptId) {
      console.warn('Cannot refund credit: no attempt_id provided');
      // Fall back to legacy increment_credits for safety
      try {
        const params = { user_email: user.email, amount: 1 };
        const { data, error, status, statusText } = await supabase.rpc('increment_credits', params);

        if (error) {
          logRpcError('increment_credits', params, error, status, statusText);
          return { success: false, error };
        }

        console.log('✅ Credit refunded successfully (legacy):', data);
        return { success: true, data };
      } catch (error) {
        console.error('Exception while refunding credit (legacy):', error);
        return { success: false, error };
      }
    }

    try {
      // Use idempotent refund RPC with attempt_id
      const params = {
        user_email: user.email,
        attempt_id: attemptId,
        amount: 1
      };
      const { data, error, status, statusText } = await supabase.rpc('refund_credit_attempt', params);

      if (error) {
        const errorCode = error?.code;

        // Only fall back to legacy RPC if the function is missing (PGRST202)
        if (errorCode === "PGRST202") {
          console.warn(
            "[refundCredit] refund_credit_attempt not found (PGRST202). Falling back to legacy increment_credits."
          );
          const legacyParams = { user_email: user.email, amount: 1 };
          const legacy = await supabase.rpc('increment_credits', legacyParams);
          
          if (legacy.error) {
            logRpcError('increment_credits', legacyParams, legacy.error, legacy.status, legacy.statusText);
            return { success: false, error: legacy.error };
          }
          return { success: true, data: legacy.data };
        }

        // RPC exists but returned an error - log it and surface to user
        logRpcError('refund_credit_attempt', params, error, status, statusText);
        
        // Show user-facing error toast with code if available
        const errorMsg = errorCode ? `Credit refund failed (${errorCode})` : "Credit refund failed";
        toast.error(errorMsg, { duration: 5000 });
        
        return { success: false, error };
      }

      if (data.already_refunded) {
        console.log('⚠️ Credit was already refunded for this attempt:', data);
      } else {
        console.log('✅ Credit refunded successfully:', data);
      }
      
      return { success: true, data };
    } catch (error) {
      console.error('Exception while refunding credit:', error);
      return { success: false, error };
    }
  };

  // =========================================================================
  // GENERATION HANDLERS
  // =========================================================================

  // Handle generate all content - PROGRESSIVE: Public Remarks (overlay) → Features/MLS/Video (background)
  const handleGenerateAllDesc = useCallback(async () => {
    if (!descState.isFormReadyDesc) {
      toast.error("Please upload photos and enter a complete address");
      return;
    }

    // Check credits first (without consuming) - only charge after successful generation
    const balanceResult = await getCreditBalance();
    if (!balanceResult.success || (balanceResult.data?.total_credits ?? 0) === 0) {
      toast.error(
        <div>
          <strong>No credits available</strong>
          <p className="text-sm mt-1">Purchase credits to generate listings</p>
        </div>,
        { duration: 5000 }
      );
      return;
    }

    // CRITICAL: Deduct credit NOW (before generation starts)
    console.log("[handleGenerateAllDesc] Deducting credit for attempt:", currentAttemptId);
    const creditParams = {
      user_email: user.email,
      attempt_id: currentAttemptId,
    };
    
    let creditResult = await supabase.rpc("check_and_decrement_credits_with_attempt", creditParams);
    
    // Fallback to legacy if function not found
    if (creditResult.error?.code === "PGRST202") {
      console.warn("[handleGenerateAllDesc] Using legacy credit deduction");
      creditResult = await supabase.rpc("check_and_decrement_credits", { user_email: user.email });
    }
    
    if (creditResult.error || !creditResult.data?.success) {
      toast.error(creditResult.error?.message || "Failed to deduct credit");
      return;
    }
    
    const source = creditResult.data.source === "domain" ? "team pool" : "personal balance";
    toast.success(
      `1 Credit Used from ${source} (${creditResult.data.remaining} remaining)`,
      { duration: 4000, icon: "💳" }
    );


    // Set overlay flag for Public Remarks only
    descState.setIsGeneratingDesc(true);
    descState.setIsGeneratingBackground(true);

    // Start wake lock for overlay
    await wakeLock.startGeneration("Initializing...");

    // Cleanup tracking flags (single-shot cleanup)
    let didEndWakeLock = false;
    let didCloseOverlay = false;
    
    const cleanupOnce = async () => {
      if (!didCloseOverlay) {
        descState.setIsGeneratingDesc(false);
        descState.setGenerationProgressDesc({ 
          phase: "uploadingPhotos", 
          current: 0, 
          total: 0, 
          label: "" 
        });
        didCloseOverlay = true;
      }
      
      if (!didEndWakeLock) {
        await wakeLock.endGeneration();
        didEndWakeLock = true;
      }
    };

    // Reset all states
    descState.setGenerationState({
      publicRemarks: { status: "idle", data: null, error: null },
      features: { status: "idle", data: null, error: null },
    });
    mlsState.setMlsData(null);
    mlsState.setMlsDataEditable(null);
    video.setVideoData(null);

    try {
      // Step 0: Upload photos to Supabase Storage
      descState.setGenerationProgressDesc({ 
        phase: "uploadingPhotos", 
        current: 0, 
        total: 0, 
        label: "Uploading photos..." 
      });
      wakeLock.setCurrentOperationLabel("Uploading photos to storage...");
      toast.loading("Uploading photos...", { id: "generating-desc" });

      let currentPhotoUrls = descState.photoUrlsDesc;

      const hasFileObjects = descState.photosDesc.some(p => p.file && p.file instanceof File);
      if (hasFileObjects && user?.id) {
        const { urls: uploadedUrls, errors: uploadErrors } = await uploadPhotosToStorage(
          descState.photosDesc.filter(p => p.file && p.file instanceof File),
          user.id
        );
        if (uploadErrors.length > 0) {
          console.warn("Some photos failed to upload:", uploadErrors);
        }
        if (uploadedUrls.length > 0) {
          descState.setPhotoUrlsDesc(uploadedUrls);
          currentPhotoUrls = uploadedUrls;
          console.log("[handleGenerateAllDesc] Uploaded photos to Supabase:", uploadedUrls);
        }
      }

      // Convert photos to base64 for API calls with real-time progress
      const totalPhotos = descState.photosDesc.length;
      descState.setGenerationProgressDesc({ 
        phase: "analyzingPhotos", 
        current: 0, 
        total: totalPhotos, 
        label: "Analyzing photos..." 
      });
      wakeLock.setCurrentOperationLabel("Analyzing photos for AI processing...");
      toast.loading("Analyzing photos...", { id: "generating-desc" });
      
      const imageInputs = await convertPhotosToImageInputs(
        descState.photosDesc, 
        currentPhotoUrls,
        (current, total) => {
          // Update progress in real-time as each photo is processed
          descState.setGenerationProgressDesc({ 
            phase: "analyzingPhotos", 
            current, 
            total, 
            label: `Analyzing photo ${current} of ${total}...` 
          });
          wakeLock.setCurrentOperationLabel(`Analyzing photo ${current} of ${total}...`);
        }
      );

      const propertyDetails = {
        address: descState.addressDesc,
        photos: imageInputs,
        property_type: "single_family",
      };

      // STEP 1 (AWAITED): Public Remarks - this is the only step that blocks the overlay
      console.log("[Generation] Step 1: Public Remarks (awaited)");
      descState.setGenerationProgressDesc({ 
        phase: "generatingPublicRemarks", 
        current: 0, 
        total: 0, 
        label: "Generating public remarks..." 
      });
      wakeLock.setCurrentOperationLabel("Generating public remarks...");
      toast.loading("Generating public remarks...", { id: "generating-desc" });
      descState.setGenerationState(prev => ({
        ...prev,
        publicRemarks: { status: "loading", data: null, error: null },
      }));

      let publicRemarksSuccess = false;
      try {
        const publicRemarksResult = await generatePublicRemarks(propertyDetails);
        descState.setGenerationState(prev => ({
          ...prev,
          publicRemarks: { status: "success", data: publicRemarksResult, error: null },
        }));
        publicRemarksSuccess = true;

        toast.success("Public remarks ready! Running background tasks...", { id: "generating-desc" });
      } catch (error) {
        // Generation failed - refund credit
        const friendlyError = getFriendlyErrorMessage(error);
        descState.setGenerationState(prev => ({
          ...prev,
          publicRemarks: { status: "error", data: null, error: friendlyError },
        }));
        toast.error(`Public remarks failed: ${friendlyError}`, { id: "generating-desc" });

        // Refund the credit since Step 1 failed (idempotent by attempt_id)
        const refundResult = await refundCredit(currentAttemptId);
        if (refundResult.success) {
          const alreadyRefunded = refundResult.data?.already_refunded;
          if (!alreadyRefunded) {
            toast.error("Generation failed. Credit refunded.", { 
              id: "generating-desc-refund",
              duration: 5000,
              icon: "🔄"
            });
          }
        }
        
        // Close overlay and stop - do NOT proceed to background tasks
        console.log("[Generation] Public Remarks failed - stopping generation");
        descState.setIsGeneratingBackground(false);
        await cleanupOnce();  // Single-shot cleanup
        return; // Stop the pipeline
      }

      // STEP 1 SUCCEEDED - close overlay and proceed to background tasks
      console.log("[Generation] Public Remarks succeeded - closing overlay, starting background tasks");
      await cleanupOnce();  // Single-shot cleanup

      // BACKGROUND TASKS (not awaited) - Features, MLS, and Video
      // These run without blocking the UI
      if (publicRemarksSuccess) {
        console.log("[Generation] Starting background tasks (Features, MLS, Video)");
        
        // Kick off background generation (fire and forget)
        runBackgroundGeneration(
          propertyDetails,
          currentPhotoUrls,
          imageInputs,
          descState,
          mlsState,
          video,
          user
        );
      }
    } catch (error) {
      // Top-level catch for unexpected errors (photo upload, etc.)
      console.error("❌ Unexpected generation error:", error);
      
      const friendlyError = getFriendlyErrorMessage(error);
      toast.error(friendlyError, { 
        id: "generating-desc",
        duration: 5000
      });
      
      descState.setIsGeneratingBackground(false);
    } finally {
      // Ensure cleanup runs even if we didn't hit the early return
      await cleanupOnce();
    }
  }, [descState, mlsState, video, wakeLock, user, currentAttemptId]);

  // Background generation runner (not awaited)
  const runBackgroundGeneration = async (
    propertyDetails,
    currentPhotoUrls,
    imageInputs,
    descState,
    mlsState,
    video,
    user
  ) => {
    try {
      // Features uses the SAME selected photos as Public Remarks (quality over quantity)
      // MLS uses ALL photos for comprehensive analysis
      console.log(`[Background] Features will use ${propertyDetails.photos.length} selected photos`);
      console.log(`[Background] MLS will use ${currentPhotoUrls.length} photos (all uploaded)`);
      
      // SEQUENTIAL ORDERING: Features → Video → MLS
      
      // Task 1: Generate Features (AWAIT) - Use selected photos from propertyDetails
      console.log("[Background] Starting Features generation");
      descState.setIsGeneratingFeatures(true);
      descState.setGenerationState(prev => ({
        ...prev,
        features: { status: "loading", data: null, error: null },
      }));

      let featuresResult = null;
      try {
        featuresResult = await generateFeatures(propertyDetails); // Uses same 20 photos as Public Remarks
        descState.setGenerationState(prev => ({
          ...prev,
          features: { status: "success", data: featuresResult, error: null },
        }));
        console.log("[Background] Features complete");
      } catch (error) {
        const friendlyError = getFriendlyErrorMessage(error);
        descState.setGenerationState(prev => ({
          ...prev,
          features: { status: "error", data: null, error: friendlyError },
        }));
        console.error("[Background] Features failed:", friendlyError);
      } finally {
        descState.setIsGeneratingFeatures(false);
      }

      // Task 2: Generate Video (AWAIT - only if features succeeded)
      let videoSucceeded = false;
      if (featuresResult && currentPhotoUrls.length > 0) {
        console.log("[Background] Starting auto-video generation");

        // Ensure we have a listing ID for video storage
        let listingId = descState.currentListingIdDesc;
        
        if (!listingId && user) {
          console.log("[Background] Creating listing for video storage");
          try {
            const totalCost =
              (descState.generationState.publicRemarks.data?.usage?.cost_usd || 0) +
              (featuresResult.usage?.cost_usd || 0);

            const totalTime =
              (descState.generationState.publicRemarks.data?.usage?.generation_time_ms || 0) +
              (featuresResult.usage?.generation_time_ms || 0);

            const propertyAddress = descState.addressDesc
              ? `${descState.addressDesc.street}, ${descState.addressDesc.city || ""}, ${descState.addressDesc.state || ""} ${descState.addressDesc.zip_code}`.trim()
              : "";

            const listingData = {
              user_id: user.id,
              listing_type: "descriptions",
              property_address: propertyAddress,
              address_json: {
                street: descState.addressDesc.street,
                city: descState.addressDesc.city || "",
                state: descState.addressDesc.state || "",
                zip_code: descState.addressDesc.zip_code,
                apn: descState.addressDesc.apn || null,
                yearBuilt: descState.addressDesc.yearBuilt || null,
                lotSize: descState.addressDesc.lotSize || null,
                county: descState.addressDesc.county || null,
                attempt_id: currentAttemptId,
              },
              property_type: "single_family",
              bedrooms: null, // MLS hasn't run yet
              bathrooms: null, // MLS hasn't run yet
              public_remarks: descState.generationState.publicRemarks.data?.text || null,
              features: JSON.stringify(featuresResult.categorized_features || featuresResult.features_list),
              mls_data: null, // MLS hasn't run yet
              photo_urls: currentPhotoUrls,
              ai_cost: totalCost,
              generation_time: totalTime,
            };

            const result = await saveListing(listingData);
            if (result.success) {
              listingId = result.id;
              descState.setCurrentListingIdDesc(result.id);
              console.log("[Background] Listing created for video:", result.id);
            }
          } catch (error) {
            console.error("[Background] Failed to create listing for video:", error);
          }
        }

        // Generate video if we have a listing ID
        if (listingId) {
          try {
            // Order photos for walkthrough (with timeout fallback)
            console.log("[Background] Ordering photos for walkthrough");
            const orderedPhotoUrls = await orderPhotosForWalkthrough(currentPhotoUrls, 15000);

            // Auto-generate video with 4 seconds per photo
            const videoResult = await video.handleGenerateVideo(orderedPhotoUrls, listingId);
            console.log("[Background] Video generation complete");
            videoSucceeded = true;

            // Save video URL to listing for future retrieval
            if (videoResult?.video_url) {
              await updateListing(listingId, { video_url: videoResult.video_url });
              console.log("[Background] Video URL saved to listing");
            }
          } catch (error) {
            console.error("[Background] Video generation failed:", error);
            // Continue to MLS generation even if video fails
          }
        }
      }

      // Task 3: Generate MLS Data (ALWAYS RUN, even if video failed)
      console.log("[Background] Starting MLS extraction");
      mlsState.setIsGeneratingMLS(true);

      try {
        const addressString = descState.addressDesc
          ? `${descState.addressDesc.street}, ${descState.addressDesc.city || ""}, ${descState.addressDesc.state || ""} ${descState.addressDesc.zip_code}`.trim()
          : "";

        const taxData = descState.addressInputDescRef.current?.getTaxData?.();

        // Use existing photo URLs instead of re-uploading
        const { mlsData: mlsResult } = await generateMLSDataWithStorage(
          [], // Empty array - we'll use existingUrls instead
          addressString,
          user?.id,
          () => { }, // No progress callback for background
          taxData,
          currentPhotoUrls // Use already-uploaded URLs
        );

        mlsState.setMlsData(mlsResult);
        mlsState.setPhotoUrlsMLS(currentPhotoUrls);
        mlsState.setAddressMLS(descState.addressDesc);
        console.log("[Background] MLS extraction complete");

        // Update listing with MLS data if we have a listing ID
        if (descState.currentListingIdDesc) {
          try {
            await updateListing(descState.currentListingIdDesc, {
              mls_data: mlsResult,
              bedrooms: mlsResult.mls_fields?.bedrooms || null,
              bathrooms: mlsResult.mls_fields?.bathrooms || null,
            });
            console.log("[Background] Updated listing with MLS data");
          } catch (error) {
            console.error("[Background] Failed to update listing with MLS data:", error);
          }
        }
      } catch (error) {
        console.error("[Background] MLS extraction failed:", error);
      } finally {
        mlsState.setIsGeneratingMLS(false);
      }

      // All background tasks complete
      descState.setIsGeneratingBackground(false);
      console.log("[Background] All tasks complete");
      
    } catch (error) {
      console.error("[Background] Background generation error:", error);
      descState.setIsGeneratingBackground(false);
    }
  };

  // Handle generate MLS data
  const handleGenerateMLS = useCallback(async () => {
    const hasPhotos = descState.photoUrlsDesc.length > 0 || descState.photosDesc.length > 0;
    const hasAddress = descState.addressDesc?.street && descState.addressDesc?.zip_code;

    if (!hasPhotos || !hasAddress) {
      toast.error("Please upload photos and enter an address on the Descriptions tab first");
      return;
    }

    if (!user) {
      toast.error("Please log in to generate MLS data");
      return;
    }

    console.log("[MLS Generation] Started, requesting wake lock...");
    mlsState.setIsGeneratingMLS(true);
    descState.setGenerationProgressDesc({ 
      phase: "generatingPublicRemarks", // Reuse this phase for standalone MLS generation
      current: 0, 
      total: 0, 
      label: "Extracting MLS data..." 
    });

    await wakeLock.startGeneration("Generating MLS data from photos...");

    try {
      const addressString = `${descState.addressDesc.street}, ${descState.addressDesc.city || ""}, ${descState.addressDesc.state || ""} ${descState.addressDesc.zip_code}`.trim();

      const taxData = descState.addressInputDescRef.current?.getTaxData?.();
      console.log("[handleGenerateMLS] Tax data:", taxData);

      const photosToUse = descState.photoUrlsDesc.length === 0 ? descState.photosDesc : [];
      const existingUrls = descState.photoUrlsDesc.length > 0 ? descState.photoUrlsDesc : [];

      const { mlsData: result, photoUrls } = await generateMLSDataWithStorage(
        photosToUse,
        addressString,
        user.id,
        (message) => {
          wakeLock.setCurrentOperationLabel(message);
          toast.loading(message, { id: "mls-generating" });
        },
        taxData,
        existingUrls
      );

      mlsState.setMlsData(result);
      if (photoUrls.length > 0 && descState.photoUrlsDesc.length === 0) {
        descState.setPhotoUrlsDesc(photoUrls);
        console.log("[handleGenerateMLS] Saved photo URLs to Descriptions state:", photoUrls);
      }

      // Save or update MLS data in the listing
      if (descState.currentListingIdDesc) {
        // Update existing descriptions listing with MLS data
        console.log("[handleGenerateMLS] Updating listing with MLS data:", descState.currentListingIdDesc);
        const updateResult = await updateListing(descState.currentListingIdDesc, {
          mls_data: result,
          bedrooms: result.mls_fields?.bedrooms || null,
          bathrooms: result.mls_fields?.bathrooms || null,
        });
        if (updateResult.success) {
          mlsState.setCurrentListingIdMLS(descState.currentListingIdDesc);
        }
      }
      // Note: If no descState.currentListingIdDesc, the auto-save effect will create a standalone MLS listing

      toast.success(`Extracted MLS data from ${photoUrls.length} photos!`, { id: "mls-generating" });
      wakeLock.sendCompletionNotification("MLS data extraction complete!");
    } catch (error) {
      console.error("MLS generation error:", error);
      toast.error(getFriendlyErrorMessage(error), { id: "mls-generating" });
    } finally {
      console.log("[MLS Generation] Complete, releasing wake lock");
      await wakeLock.endGeneration();
      mlsState.setIsGeneratingMLS(false);
      descState.setGenerationProgressDesc({ 
        phase: "uploadingPhotos", 
        current: 0, 
        total: 0, 
        label: "" 
      });
    }
  }, [descState, mlsState, wakeLock, user]);

  // =========================================================================
  // REGENERATE HANDLERS
  // =========================================================================

  const handleRegeneratePublicRemarks = useCallback(async () => {
    if (!descState.currentListingIdDesc) {
      toast.error("Please generate content first");
      return;
    }

    console.log("[Regenerate] Public Remarks - requesting wake lock...");
    descState.setIsGeneratingDesc(true);
    descState.setGenerationProgressDesc({ 
      phase: "generatingPublicRemarks", 
      current: 0, 
      total: 0, 
      label: "Regenerating public remarks..." 
    });

    await wakeLock.startGeneration("Regenerating public remarks...");

    descState.setGenerationState(prev => ({
      ...prev,
      publicRemarks: { status: "loading", data: null, error: null },
    }));

    try {
      const imageInputs = await convertPhotosToImageInputs(descState.photosDesc, descState.photoUrlsDesc);

      const propertyDetails = {
        address: descState.addressDesc,
        photos: imageInputs,
        property_type: "single_family",
      };

      const publicRemarksResult = await generatePublicRemarks(propertyDetails);

      descState.setGenerationState(prev => ({
        ...prev,
        publicRemarks: { status: "success", data: publicRemarksResult, error: null },
      }));

      const updateResult = await updateListing(descState.currentListingIdDesc, {
        public_remarks: publicRemarksResult.text,
        ai_cost: publicRemarksResult.usage?.cost_usd || 0,
      });

      if (updateResult.success) {
        toast.success("Public Remarks regenerated and saved");
        wakeLock.sendCompletionNotification("Public Remarks regenerated!");
      } else {
        toast.error("Regenerated but failed to save");
      }
    } catch (error) {
      const friendlyError = getFriendlyErrorMessage(error);
      descState.setGenerationState(prev => ({
        ...prev,
        publicRemarks: { status: "error", data: null, error: friendlyError },
      }));
      toast.error(friendlyError);
    } finally {
      console.log("[Regenerate] Public Remarks complete, releasing wake lock");
      await wakeLock.endGeneration();
      descState.setIsGeneratingDesc(false);
      descState.setGenerationProgressDesc({ 
        phase: "uploadingPhotos", 
        current: 0, 
        total: 0, 
        label: "" 
      });
    }
  }, [descState, wakeLock]);

  const handleRegenerateFeatures = useCallback(async () => {
    if (!descState.currentListingIdDesc) {
      toast.error("Please generate content first");
      return;
    }

    console.log("[Regenerate] Features - requesting wake lock...");
    descState.setIsGeneratingDesc(true);
    descState.setGenerationProgressDesc({ 
      phase: "generatingPublicRemarks", 
      current: 0, 
      total: 0, 
      label: "Regenerating features..." 
    });

    await wakeLock.startGeneration("Regenerating features...");

    descState.setGenerationState(prev => ({
      ...prev,
      features: { status: "loading", data: null, error: null },
    }));

    try {
      const imageInputs = await convertPhotosToImageInputs(descState.photosDesc, descState.photoUrlsDesc);

      const propertyDetails = {
        address: descState.addressDesc,
        photos: imageInputs,
        property_type: "single_family",
      };

      const featuresResult = await generateFeatures(propertyDetails);

      descState.setGenerationState(prev => ({
        ...prev,
        features: { status: "success", data: featuresResult, error: null },
      }));

      const updateResult = await updateListing(descState.currentListingIdDesc, {
        features: JSON.stringify(featuresResult.categorized_features || featuresResult.features_list),
      });

      if (updateResult.success) {
        toast.success("Features Sheet regenerated and saved");
        wakeLock.sendCompletionNotification("Features Sheet regenerated!");
      } else {
        toast.error("Regenerated but failed to save");
      }
    } catch (error) {
      const friendlyError = getFriendlyErrorMessage(error);
      descState.setGenerationState(prev => ({
        ...prev,
        features: { status: "error", data: null, error: friendlyError },
      }));
      toast.error(friendlyError);
    } finally {
      console.log("[Regenerate] Features complete, releasing wake lock");
      await wakeLock.endGeneration();
      descState.setIsGeneratingDesc(false);
      descState.setGenerationProgressDesc({ 
        phase: "uploadingPhotos", 
        current: 0, 
        total: 0, 
        label: "" 
      });
    }
  }, [descState, wakeLock]);

  // =========================================================================
  // LISTING LOAD HANDLER
  // =========================================================================

  const handleLoadDescListing = useCallback((listing) => {
    // CRITICAL: Clear ALL state first to prevent data from previous listing bleeding through
    console.log("[handleLoadDescListing] Clearing all state before loading listing:", listing.id);
    
    // Clear descriptions state
    descState.setGenerationState({
      publicRemarks: { status: "idle", data: null, error: null },
      features: { status: "idle", data: null, error: null },
    });
    descState.setExpandedSections({
      publicRemarks: false,
      features: false,
    });
    descState.setComplianceReportDesc(null);
    descState.setGenerationProgressDesc({
      phase: "uploadingPhotos",
      current: 0,
      total: 0,
      label: "",
    });
    
    // Clear MLS state
    mlsState.setMlsData(null);
    mlsState.setMlsDataEditable(null);
    mlsState.setCurrentListingIdMLS(null);
    mlsState.setPhotoUrlsMLS([]);
    mlsState.setAddressMLS(null);
    
    // Clear video state
    video.setVideoData(null);
    
    // Now load the new listing data
    console.log("[handleLoadDescListing] Loading listing data:", listing.id);
    
    // Set address via ref
    if (listing.address_json && descState.addressInputDescRef.current) {
      descState.addressInputDescRef.current.setAddress({
        street: listing.address_json.street,
        city: listing.address_json.city,
        state: listing.address_json.state,
        zip_code: listing.address_json.zip_code,
        apn: listing.address_json.apn || "",
        yearBuilt: listing.address_json.yearBuilt || "",
        lotSize: listing.address_json.lotSize || "",
        county: listing.address_json.county || "",
      });
    }

    // Set photo URLs and populate photo grid
    const urls = listing.photo_urls ?? [];
    descState.setPhotoUrlsDesc(urls);
    
    // Populate the photo uploader UI so images appear in the grid
    if (descState.photoUploaderDescRef.current) {
      descState.photoUploaderDescRef.current.setPhotosFromUrls(urls);
    }

    // Set generated content states (build fresh object, don't merge with prev)
    const newGenerationState = {
      publicRemarks: { status: "idle", data: null, error: null },
      features: { status: "idle", data: null, error: null },
    };
    
    if (listing.public_remarks) {
      newGenerationState.publicRemarks = {
        status: "success",
        data: { text: listing.public_remarks },
        error: null,
      };
    }
    
    if (listing.features) {
      try {
        const featuresData = typeof listing.features === "string" ? JSON.parse(listing.features) : listing.features;
        newGenerationState.features = {
          status: "success",
          data: { categorized_features: featuresData },
          error: null,
        };
      } catch {
        newGenerationState.features = {
          status: "success",
          data: { features_list: [listing.features] },
          error: null,
        };
      }
    }
    
    // Set the complete state at once (not merging with prev)
    descState.setGenerationState(newGenerationState);

    // Auto-expand Public Remarks
    if (listing.public_remarks) {
      descState.setExpandedSections({
        publicRemarks: true,
        features: false,
      });
    }

    // Track listing ID for future updates
    descState.setCurrentListingIdDesc(listing.id);

    // Restore video if available
    if (listing.video_url) {
      video.setVideoData({
        video_url: listing.video_url,
        duration_seconds: 0, // Duration unknown from stored listing
        photos_used: urls.length,
      });
      console.log("[handleLoadDescListing] Restored video from listing:", listing.video_url);
    } else {
      // Clear video state if no video in listing
      video.setVideoData(null);
    }

    // Handle MLS state based on whether listing has MLS data
    // (MLS state was already cleared above, only load if present)
    if (listing.mls_data) {
      // Hydrate MLS state from the selected listing
      console.log("[handleLoadDescListing] Loading MLS data from listing:", listing.mls_data);
      mlsState.setMlsData(listing.mls_data);
      mlsState.setCurrentListingIdMLS(listing.id);
      
      // Set photo URLs and address for MLS context (for auto-save effect consistency)
      if (listing.photo_urls && listing.photo_urls.length > 0) {
        mlsState.setPhotoUrlsMLS(listing.photo_urls);
      }
      if (listing.address_json) {
        mlsState.setAddressMLS(listing.address_json);
      }
    }
    
    console.log("[handleLoadDescListing] Listing loaded successfully:", listing.id);
  }, [descState, mlsState, video]);

  // =========================================================================
  // REFINEMENT HANDLER WRAPPERS
  // =========================================================================

  const handleRefineRemarks = useCallback(async (instruction) => {
    await refinement.handleRefineRemarks(
      instruction,
      descState.generationState.publicRemarks.data?.text,
      descState.addressDesc,
      descState.currentListingIdDesc,
      descState.setGenerationState
    );
  }, [refinement, descState]);


  const handleRefineFeatures = useCallback(async (instruction) => {
    await refinement.handleRefineFeatures(
      instruction,
      descState.generationState.features.data,
      descState.addressDesc,
      descState.currentListingIdDesc,
      descState.setGenerationState
    );
  }, [refinement, descState]);

  // =========================================================================
  // RENDER
  // =========================================================================

  // Derive property address for header
  const propertyAddress = descState.addressDesc
    ? `${descState.addressDesc.street}, ${descState.addressDesc.city || ""}, ${descState.addressDesc.state || ""} ${descState.addressDesc.zip_code}`.trim()
    : "";

  return (
    <main className="min-h-screen bg-base-100">
      {/* Header */}
      <DashboardHeader
        user={user}
        propertyAddress={propertyAddress}
      />

      {/* Tab Navigation */}
      <TabNavigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === "descriptions" ? (
          <DescriptionsTab
            // User
            user={user}

            // Refs
            photoUploaderDescRef={descState.photoUploaderDescRef}
            addressInputDescRef={descState.addressInputDescRef}

            // Photo state
            photosDesc={descState.photosDesc}
            photoUrlsDesc={descState.photoUrlsDesc}

            // Address state
            addressDesc={descState.addressDesc}

            // Generation state
            isGeneratingDesc={descState.isGeneratingDesc}
            isGeneratingFeatures={descState.isGeneratingFeatures}
            isGeneratingBackground={descState.isGeneratingBackground}
            generationProgressDesc={descState.generationProgressDesc}
            generationState={descState.generationState}
            expandedSections={descState.expandedSections}
            setExpandedSections={descState.setExpandedSections}

            // Listing state
            currentListingIdDesc={descState.currentListingIdDesc}

            // Compliance state
            complianceReportDesc={descState.complianceReportDesc}
            scanningComplianceDesc={descState.scanningComplianceDesc}

            // Computed values
            isFormReadyDesc={descState.isFormReadyDesc}
            hasDescDataToClear={descState.hasDescDataToClear}

            // Photo handlers
            handlePhotosChangeDesc={descState.handlePhotosChangeDesc}
            handleScanComplianceDesc={descState.handleScanComplianceDesc}
            handleRemovePhotoDesc={descState.handleRemovePhotoDesc}

            // Address handlers
            handleAddressChangeDesc={descState.handleAddressChangeDesc}

            // Generation handlers
            handleGenerateAllDesc={handleGenerateAllDesc}
            handleRegeneratePublicRemarks={handleRegeneratePublicRemarks}
            handleRegenerateFeatures={handleRegenerateFeatures}
            handleLoadDescListing={handleLoadDescListing}
            handleClearDescData={descState.handleClearDescData}
            
            // Attempt tracking (for idempotent refunds)
            setCurrentAttemptId={setCurrentAttemptId}

            // Refinement handlers
            handleRefineRemarks={handleRefineRemarks}
            handleRefineFeatures={handleRefineFeatures}
            isRefiningRemarks={refinement.isRefiningRemarks}
            isRefiningScript={refinement.isRefiningScript}
            isRefiningFeatures={refinement.isRefiningFeatures}
            remarksComplianceError={refinement.remarksComplianceError}
            scriptComplianceError={refinement.scriptComplianceError}
            featuresComplianceError={refinement.featuresComplianceError}
            setRemarksComplianceError={refinement.setRemarksComplianceError}
            setScriptComplianceError={refinement.setScriptComplianceError}
            setFeaturesComplianceError={refinement.setFeaturesComplianceError}

            // Video state and handlers (silent videos only)
            isGeneratingVideo={video.isGeneratingVideo}
            videoData={video.videoData}
            secondsPerPhoto={video.secondsPerPhoto}
            setSecondsPerPhoto={video.setSecondsPerPhoto}
            handleGenerateVideo={video.handleGenerateVideo}
            handleDownloadVideo={video.handleDownloadVideo}
            handlePreviewVideo={video.handlePreviewVideo}

            // Helpers
            formatFeaturesText={descState.formatFeaturesText}
          />
        ) : (
          <MLSDataTab
            // Generation state
            isGeneratingMLS={mlsState.isGeneratingMLS}
            mlsData={mlsState.mlsData}
            mlsDataEditable={mlsState.mlsDataEditable}

            // Listing state
            currentListingIdMLS={mlsState.currentListingIdMLS}

            // Descriptions tab data
            photoUrlsDesc={descState.photoUrlsDesc}
            photosDesc={descState.photosDesc}
            addressDesc={descState.addressDesc}

            // Handlers
            handleMLSFieldChange={mlsState.handleMLSFieldChange}
            handleSaveMLSEdits={mlsState.handleSaveMLSEdits}
            handleGenerateMLS={handleGenerateMLS}

            // Tab switch
            setActiveTab={setActiveTab}
          />
        )}
      </div>

      {/* Onboarding Modal - shown once for OAuth users without source */}
      {showOnboarding && userEmail && (
        <OnboardingModal
          userEmail={userEmail}
          onComplete={() => setShowOnboarding(false)}
        />
      )}
    </main>
  );
}
