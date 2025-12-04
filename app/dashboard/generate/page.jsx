"use client";

import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { supabase } from "@/libs/supabase";
import {
  generateFeatures,
  generateWalkthruScript,
  generatePublicRemarks,
  generateMLSDataWithStorage,
  convertPhotosToImageInputs,
  getFriendlyErrorMessage,
  isRateLimitError,
} from "@/libs/generate-api";
import { uploadPhotosToStorage } from "@/libs/supabase-storage-upload";
import { saveListing, updateListing } from "@/libs/listings";
import GenerationProgress from "@/components/GenerationProgress";

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
  Header,
  TabNavigation,
  DescriptionsTab,
  MLSDataTab,
} from "./components";

/**
 * Generate Page - Main orchestrator component.
 *
 * This page coordinates all generation functionality through modular hooks and components.
 * Each hook manages its own state and handlers, while this component orchestrates them.
 */
export default function GeneratePage() {
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
      descState.generationState.walkthruScript.status === "success" &&
      descState.generationState.features.status === "success";

    const hasValidPhotoUrls = descState.photoUrlsDesc.length > 0 &&
      descState.photoUrlsDesc.every(url => url.startsWith('http') && !url.startsWith('blob:'));

    if (allGenerated && user && descState.addressDesc && hasValidPhotoUrls) {
      const autoSaveDesc = async () => {
        try {
          const totalCost =
            (descState.generationState.publicRemarks.data?.usage?.cost_usd || 0) +
            (descState.generationState.walkthruScript.data?.usage?.cost_usd || 0) +
            (descState.generationState.features.data?.usage?.cost_usd || 0);

          const totalTime =
            (descState.generationState.publicRemarks.data?.usage?.generation_time_ms || 0) +
            (descState.generationState.walkthruScript.data?.usage?.generation_time_ms || 0) +
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
            },
            property_type: "single_family",
            bedrooms: mlsState.mlsData?.mls_fields?.bedrooms || null,
            bathrooms: mlsState.mlsData?.mls_fields?.bathrooms || null,
            public_remarks: descState.generationState.publicRemarks.data?.text || null,
            walkthru_script: descState.generationState.walkthruScript.data?.script || null,
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
    descState.generationState.walkthruScript.status,
    descState.generationState.features.status,
    descState.photoUrlsDesc,
    descState.currentListingIdDesc,
    user,
    descState.addressDesc,
    descState,
    mlsState.mlsData,
    mlsState,
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
              },
              property_type: "single_family",
              bedrooms: mlsState.mlsData.mls_fields?.bedrooms || null,
              bathrooms: mlsState.mlsData.mls_fields?.bathrooms || null,
              public_remarks: null,
              walkthru_script: null,
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
  }, [mlsState.mlsData, mlsState.photoUrlsMLS, mlsState.currentListingIdMLS, user, mlsState.addressMLS, mlsState, descState.currentListingIdDesc]);

  // =========================================================================
  // GENERATION HANDLERS
  // =========================================================================

  // Handle generate all content - SEQUENTIAL to avoid rate limits
  const handleGenerateAllDesc = useCallback(async () => {
    if (!descState.isFormReadyDesc) {
      toast.error("Please upload photos and enter a complete address");
      return;
    }

    descState.setIsGeneratingDesc(true);
    let successCount = 0;
    let rateLimitHit = false;
    const totalSteps = 4;

    // Start wake lock
    await wakeLock.startGeneration("Initializing...");

    // Reset all states
    descState.setGenerationState({
      publicRemarks: { status: "idle", data: null, error: null },
      walkthruScript: { status: "idle", data: null, error: null },
      features: { status: "idle", data: null, error: null },
    });
    mlsState.setMlsData(null);
    mlsState.setMlsDataEditable(null);

    try {
      // Step 0: Upload photos to Supabase Storage
      descState.setGenerationProgressDesc({ step: 0, total: totalSteps, label: "Uploading photos..." });
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

      // Convert photos to base64 for API calls
      descState.setGenerationProgressDesc({ step: 0, total: totalSteps, label: "Preparing photos..." });
      wakeLock.setCurrentOperationLabel("Preparing photos for AI analysis...");
      toast.loading("Preparing photos...", { id: "generating-desc" });
      const imageInputs = await convertPhotosToImageInputs(descState.photosDesc, currentPhotoUrls);

      const propertyDetails = {
        address: descState.addressDesc,
        photos: imageInputs,
        property_type: "single_family",
      };

      // STEP 1: Public Remarks (GPT-4.1)
      console.log("[Generation] Step 1/4: Public Remarks");
      descState.setGenerationProgressDesc({ step: 1, total: totalSteps, label: "Generating public remarks..." });
      wakeLock.setCurrentOperationLabel("Analyzing photos and generating public remarks with GPT-4.1...");
      toast.loading(`Generating public remarks... (1/${totalSteps})`, { id: "generating-desc" });
      descState.setGenerationState(prev => ({
        ...prev,
        publicRemarks: { status: "loading", data: null, error: null },
      }));

      try {
        const publicRemarksResult = await generatePublicRemarks(propertyDetails);
        descState.setGenerationState(prev => ({
          ...prev,
          publicRemarks: { status: "success", data: publicRemarksResult, error: null },
        }));
        successCount++;
      } catch (error) {
        const friendlyError = getFriendlyErrorMessage(error);
        descState.setGenerationState(prev => ({
          ...prev,
          publicRemarks: { status: "error", data: null, error: friendlyError },
        }));
        if (isRateLimitError(error)) {
          rateLimitHit = true;
        }
      }

      // STEP 2: Walk-thru Script (Claude)
      if (!rateLimitHit) {
        console.log("[Generation] Step 2/4: Walk-thru Script");
        descState.setGenerationProgressDesc({ step: 2, total: totalSteps, label: "Generating walk-thru script..." });
        wakeLock.setCurrentOperationLabel("Creating walk-through video script with Claude...");
        toast.loading(`Generating walk-thru script... (2/${totalSteps})`, { id: "generating-desc" });
        descState.setGenerationState(prev => ({
          ...prev,
          walkthruScript: { status: "loading", data: null, error: null },
        }));

        try {
          const walkthruResult = await generateWalkthruScript(propertyDetails);
          descState.setGenerationState(prev => ({
            ...prev,
            walkthruScript: { status: "success", data: walkthruResult, error: null },
          }));
          successCount++;
        } catch (error) {
          const friendlyError = getFriendlyErrorMessage(error);
          descState.setGenerationState(prev => ({
            ...prev,
            walkthruScript: { status: "error", data: null, error: friendlyError },
          }));
          if (isRateLimitError(error)) {
            rateLimitHit = true;
          }
        }
      }

      // STEP 3: Features (Gemini)
      if (!rateLimitHit) {
        console.log("[Generation] Step 3/4: Features");
        descState.setGenerationProgressDesc({ step: 3, total: totalSteps, label: "Generating features..." });
        wakeLock.setCurrentOperationLabel("Extracting property features with Gemini...");
        toast.loading(`Generating features... (3/${totalSteps})`, { id: "generating-desc" });
        descState.setGenerationState(prev => ({
          ...prev,
          features: { status: "loading", data: null, error: null },
        }));

        try {
          const featuresResult = await generateFeatures(propertyDetails);
          descState.setGenerationState(prev => ({
            ...prev,
            features: { status: "success", data: featuresResult, error: null },
          }));
          successCount++;
        } catch (error) {
          const friendlyError = getFriendlyErrorMessage(error);
          descState.setGenerationState(prev => ({
            ...prev,
            features: { status: "error", data: null, error: friendlyError },
          }));
          if (isRateLimitError(error)) {
            rateLimitHit = true;
          }
        }
      }

      // STEP 4: MLS Data (Claude)
      if (!rateLimitHit) {
        console.log("[Generation] Step 4/4: MLS Data");
        descState.setGenerationProgressDesc({ step: 4, total: totalSteps, label: "Extracting MLS data..." });
        wakeLock.setCurrentOperationLabel("Generating RESO-formatted MLS data with Claude...");
        toast.loading(`Extracting MLS data... (4/${totalSteps})`, { id: "generating-desc" });

        try {
          const addressString = descState.addressDesc
            ? `${descState.addressDesc.street}, ${descState.addressDesc.city || ""}, ${descState.addressDesc.state || ""} ${descState.addressDesc.zip_code}`.trim()
            : "";

          const taxData = descState.addressInputDescRef.current?.getTaxData?.();

          const { mlsData: mlsResult, photoUrls: mlsPhotoUrls } = await generateMLSDataWithStorage(
            descState.photosDesc,
            addressString,
            user?.id,
            "claude",
            () => { },
            taxData
          );

          mlsState.setMlsData(mlsResult);
          if (mlsPhotoUrls.length > 0) {
            mlsState.setPhotoUrlsMLS(mlsPhotoUrls);
          } else if (currentPhotoUrls.length > 0) {
            mlsState.setPhotoUrlsMLS(currentPhotoUrls);
          }
          mlsState.setAddressMLS(descState.addressDesc);
          successCount++;
        } catch (error) {
          console.error("MLS generation error:", error);
          const friendlyError = getFriendlyErrorMessage(error);
          console.warn(`MLS generation failed: ${friendlyError}`);
        }
      }

      // Show appropriate toast
      if (rateLimitHit) {
        toast.error("Rate limit hit. Please wait 1 minute and try again.", { id: "generating-desc" });
      } else if (successCount === totalSteps) {
        toast.success("All content generated successfully!", { id: "generating-desc" });
        wakeLock.sendCompletionNotification("All property content generated successfully!");
      } else if (successCount > 0) {
        toast.success(`Generated ${successCount}/${totalSteps} sections`, { id: "generating-desc" });
        wakeLock.sendCompletionNotification(`Generated ${successCount}/${totalSteps} sections`);
      } else {
        toast.error("Failed to generate content", { id: "generating-desc" });
      }
    } catch (error) {
      console.error("Generation error:", error);
      const friendlyError = getFriendlyErrorMessage(error);
      toast.error(friendlyError, { id: "generating-desc" });
    } finally {
      await wakeLock.endGeneration();
      descState.setIsGeneratingDesc(false);
      descState.setGenerationProgressDesc({ step: 0, total: totalSteps, label: "" });
    }
  }, [descState, mlsState, wakeLock, user]);

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
    descState.setGenerationProgressDesc({ step: 1, total: 1, label: "Extracting MLS data..." });

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
        "claude",
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
      descState.setGenerationProgressDesc({ step: 0, total: 1, label: "" });
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
    descState.setGenerationProgressDesc({ step: 1, total: 1, label: "Regenerating public remarks..." });

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
      descState.setGenerationProgressDesc({ step: 0, total: 1, label: "" });
    }
  }, [descState, wakeLock]);

  const handleRegenerateWalkthruScript = useCallback(async () => {
    if (!descState.currentListingIdDesc) {
      toast.error("Please generate content first");
      return;
    }

    console.log("[Regenerate] Walk-thru Script - requesting wake lock...");
    descState.setIsGeneratingDesc(true);
    descState.setGenerationProgressDesc({ step: 1, total: 1, label: "Regenerating walk-thru script..." });

    await wakeLock.startGeneration("Regenerating walk-thru script...");

    descState.setGenerationState(prev => ({
      ...prev,
      walkthruScript: { status: "loading", data: null, error: null },
    }));

    try {
      const imageInputs = await convertPhotosToImageInputs(descState.photosDesc, descState.photoUrlsDesc);

      const propertyDetails = {
        address: descState.addressDesc,
        photos: imageInputs,
        property_type: "single_family",
      };

      const publicRemarks = descState.generationState.publicRemarks.data?.text;
      const walkthruResult = await generateWalkthruScript(propertyDetails, publicRemarks);

      descState.setGenerationState(prev => ({
        ...prev,
        walkthruScript: { status: "success", data: walkthruResult, error: null },
      }));

      const updateResult = await updateListing(descState.currentListingIdDesc, {
        walkthru_script: walkthruResult.script,
      });

      if (updateResult.success) {
        toast.success("Walk-thru Script regenerated and saved");
        wakeLock.sendCompletionNotification("Walk-thru Script regenerated!");
      } else {
        toast.error("Regenerated but failed to save");
      }
    } catch (error) {
      const friendlyError = getFriendlyErrorMessage(error);
      descState.setGenerationState(prev => ({
        ...prev,
        walkthruScript: { status: "error", data: null, error: friendlyError },
      }));
      toast.error(friendlyError);
    } finally {
      console.log("[Regenerate] Walk-thru Script complete, releasing wake lock");
      await wakeLock.endGeneration();
      descState.setIsGeneratingDesc(false);
      descState.setGenerationProgressDesc({ step: 0, total: 1, label: "" });
    }
  }, [descState, wakeLock]);

  const handleRegenerateFeatures = useCallback(async () => {
    if (!descState.currentListingIdDesc) {
      toast.error("Please generate content first");
      return;
    }

    console.log("[Regenerate] Features - requesting wake lock...");
    descState.setIsGeneratingDesc(true);
    descState.setGenerationProgressDesc({ step: 1, total: 1, label: "Regenerating features..." });

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
      descState.setGenerationProgressDesc({ step: 0, total: 1, label: "" });
    }
  }, [descState, wakeLock]);

  // =========================================================================
  // LISTING LOAD HANDLER
  // =========================================================================

  const handleLoadDescListing = useCallback((listing) => {
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

    // Set photo URLs
    descState.setPhotoUrlsDesc(listing.photo_urls);

    // Set generated content states
    if (listing.public_remarks) {
      descState.setGenerationState(prev => ({
        ...prev,
        publicRemarks: { status: "success", data: { text: listing.public_remarks }, error: null },
      }));
    }
    if (listing.walkthru_script) {
      descState.setGenerationState(prev => ({
        ...prev,
        walkthruScript: { status: "success", data: { script: listing.walkthru_script }, error: null },
      }));
    }
    if (listing.features) {
      try {
        const featuresData = typeof listing.features === "string" ? JSON.parse(listing.features) : listing.features;
        descState.setGenerationState(prev => ({
          ...prev,
          features: { status: "success", data: { categorized_features: featuresData }, error: null },
        }));
      } catch {
        descState.setGenerationState(prev => ({
          ...prev,
          features: { status: "success", data: { features_list: [listing.features] }, error: null },
        }));
      }
    }

    // Auto-expand Public Remarks
    if (listing.public_remarks) {
      descState.setExpandedSections({
        publicRemarks: true,
        walkthruScript: false,
        features: false,
      });
    }

    // Track listing ID for future updates
    descState.setCurrentListingIdDesc(listing.id);

    // Handle MLS state based on whether listing has MLS data
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
    } else {
      // Clear MLS state when listing has no MLS data
      // This ensures the MLS Data tab shows empty state for listings without MLS data
      console.log("[handleLoadDescListing] No MLS data in listing, clearing MLS state");
      mlsState.setMlsData(null);
      mlsState.setMlsDataEditable(null);
      mlsState.setCurrentListingIdMLS(null);
      mlsState.setPhotoUrlsMLS([]);
      mlsState.setAddressMLS(null);
    }
  }, [descState, mlsState]);

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

  const handleRefineScript = useCallback(async (instruction) => {
    await refinement.handleRefineScript(
      instruction,
      descState.generationState.walkthruScript.data?.script,
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

  return (
    <main className="min-h-screen bg-base-100">
      {/* Header */}
      <Header
        user={user}
        isGeneratingDesc={descState.isGeneratingDesc}
        isGeneratingMLS={mlsState.isGeneratingMLS}
        isWakeLockActive={wakeLock.isWakeLockActive}
      />

      {/* Tab Navigation */}
      <TabNavigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Generation Progress Indicator */}
        {(descState.isGeneratingDesc || mlsState.isGeneratingMLS) && (
          <GenerationProgress
            currentStep={descState.generationProgressDesc.step}
            totalSteps={descState.generationProgressDesc.total}
            currentOperation={wakeLock.currentOperationLabel}
            estimatedTimeRemaining={wakeLock.getEstimatedTimeRemaining(descState.generationProgressDesc.step, descState.generationProgressDesc.total)}
            isWakeLockActive={wakeLock.isWakeLockActive}
            startTime={wakeLock.generationStartTime}
          />
        )}

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
            handleRegenerateWalkthruScript={handleRegenerateWalkthruScript}
            handleRegenerateFeatures={handleRegenerateFeatures}
            handleLoadDescListing={handleLoadDescListing}
            handleClearDescData={descState.handleClearDescData}

            // Refinement handlers
            handleRefineRemarks={handleRefineRemarks}
            handleRefineScript={handleRefineScript}
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
    </main>
  );
}
