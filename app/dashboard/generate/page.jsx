"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import UserMenu from "@/components/UserMenu";
import PhotoUploader from "@/components/listing-magic/PhotoUploader";
import AddressInput from "@/components/listing-magic/AddressInput";
import GeneratedSection from "@/components/listing-magic/GeneratedSection";
import MLSDataDisplay from "@/components/listing-magic/MLSDataDisplay";
import ListingLoader from "@/components/listing-magic/ListingLoader";
import { supabase } from "@/libs/supabase";
import {
  generateFeatures,
  generateWalkthruScript,
  generatePublicRemarks,
  generateMLSDataWithStorage,
  generateAllContentMock,
  convertPhotosToImageInputs,
  formatGenerationTime,
  formatCost,
  copyToClipboard,
  getFriendlyErrorMessage,
  isRateLimitError,
} from "@/libs/generate-api";
import { uploadPhotosToStorage } from "@/libs/supabase-storage-upload";
import { saveListing, updateListing } from "@/libs/listings";

export default function GeneratePage() {
  const [activeTab, setActiveTab] = useState("descriptions");

  // User state
  const [user, setUser] = useState(null);

  // =========================================================================
  // PROPERTY DESCRIPTIONS TAB STATE (Independent)
  // =========================================================================
  const photoUploaderDescRef = useRef(null);
  const addressInputDescRef = useRef(null);
  const [photosDesc, setPhotosDesc] = useState([]);
  const [addressDesc, setAddressDesc] = useState(null);
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);
  const [generationProgressDesc, setGenerationProgressDesc] = useState({ step: 0, total: 3, label: "" });
  const [photoUrlsDesc, setPhotoUrlsDesc] = useState([]); // For storing Supabase URLs after load
  const [generationState, setGenerationState] = useState({
    publicRemarks: { status: "idle", data: null, error: null },
    walkthruScript: { status: "idle", data: null, error: null },
    features: { status: "idle", data: null, error: null },
  });
  // Track which sections are expanded (for auto-expand after generation)
  const [expandedSections, setExpandedSections] = useState({
    publicRemarks: false,
    walkthruScript: false,
    features: false,
  });
  // Track current listing ID for updates (regenerate overwrites instead of creating new)
  const [currentListingIdDesc, setCurrentListingIdDesc] = useState(null);

  // =========================================================================
  // MLS DATA TAB STATE (Independent)
  // =========================================================================
  const photoUploaderMLSRef = useRef(null);
  const addressInputMLSRef = useRef(null);
  const [photosMLS, setPhotosMLS] = useState([]);
  const [addressMLS, setAddressMLS] = useState(null);
  const [isGeneratingMLS, setIsGeneratingMLS] = useState(false);
  const [mlsData, setMlsData] = useState(null);
  const [photoUrlsMLS, setPhotoUrlsMLS] = useState([]); // For storing Supabase URLs after load

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

  // Auto-save descriptions listing when generation completes
  // Only save when we have valid photo URLs (not blob URLs)
  useEffect(() => {
    const allGenerated =
      generationState.publicRemarks.status === "success" &&
      generationState.walkthruScript.status === "success" &&
      generationState.features.status === "success";

    // Only save if we have valid Supabase URLs (not blob URLs)
    const hasValidPhotoUrls = photoUrlsDesc.length > 0 &&
      photoUrlsDesc.every(url => url.startsWith('http') && !url.startsWith('blob:'));

    if (allGenerated && user && addressDesc && hasValidPhotoUrls) {
      // Auto-save the listing
      const autoSaveDesc = async () => {
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
          const propertyAddress = addressDesc
            ? `${addressDesc.street}, ${addressDesc.city || ""}, ${addressDesc.state || ""} ${addressDesc.zip_code}`.trim()
            : "";

          // Prepare listing data
          const listingData = {
            user_id: user.id,
            listing_type: "descriptions",
            property_address: propertyAddress,
            address_json: {
              street: addressDesc.street,
              city: addressDesc.city || "",
              state: addressDesc.state || "",
              zip_code: addressDesc.zip_code,
            },
            property_type: "single_family",
            bedrooms: null,
            bathrooms: null,
            public_remarks: generationState.publicRemarks.data?.text || null,
            walkthru_script: generationState.walkthruScript.data?.script || null,
            features: generationState.features.data
              ? JSON.stringify(generationState.features.data.categorized_features || generationState.features.data.features_list)
              : null,
            photo_urls: photoUrlsDesc,
            ai_cost: totalCost,
            generation_time: totalTime,
          };

          console.log("[Auto-save Desc] Saving with photo URLs:", photoUrlsDesc);
          const result = await saveListing(listingData);

          if (result.success) {
            setCurrentListingIdDesc(result.id); // Store listing ID for future updates
            toast.success("Listing saved automatically", { duration: 3000, icon: "✓" });
          }
        } catch (error) {
          console.error("Auto-save error:", error);
        }
      };

      autoSaveDesc();
    }
  }, [generationState.publicRemarks.status, generationState.walkthruScript.status, generationState.features.status, photoUrlsDesc]);

  // Auto-expand Public Remarks immediately when it finishes (don't wait for others)
  const hasAutoExpandedRef = useRef(false);

  useEffect(() => {
    const publicRemarksReady = generationState.publicRemarks.data?.text;

    // Expand Public Remarks the moment it has content
    if (publicRemarksReady && !hasAutoExpandedRef.current) {
      console.log("[Auto-expand] Expanding Public Remarks immediately!");
      hasAutoExpandedRef.current = true;
      setExpandedSections(prev => ({
        ...prev,
        publicRemarks: true,
      }));
    }
  }, [generationState.publicRemarks.data]);

  // Reset auto-expand flag when generation starts
  useEffect(() => {
    if (isGeneratingDesc) {
      hasAutoExpandedRef.current = false;
    }
  }, [isGeneratingDesc]);

  // Auto-save MLS listing when extraction completes
  // Only save when we have both mlsData AND valid photo URLs (not blob URLs)
  useEffect(() => {
    // Only save if we have MLS data and valid Supabase URLs (not blob URLs)
    const hasValidPhotoUrls = photoUrlsMLS.length > 0 &&
      photoUrlsMLS.every(url => url.startsWith('http') && !url.startsWith('blob:'));

    if (mlsData && user && addressMLS && hasValidPhotoUrls) {
      const autoSaveMLS = async () => {
        try {
          // Format address
          const propertyAddress = addressMLS
            ? `${addressMLS.street}, ${addressMLS.city || ""}, ${addressMLS.state || ""} ${addressMLS.zip_code}`.trim()
            : "";

          const listingData = {
            user_id: user.id,
            listing_type: "mls_data",
            property_address: propertyAddress,
            address_json: {
              street: addressMLS.street,
              city: addressMLS.city || "",
              state: addressMLS.state || "",
              zip_code: addressMLS.zip_code,
            },
            property_type: "single_family",
            bedrooms: mlsData.mls_fields?.bedrooms || null,
            bathrooms: mlsData.mls_fields?.bathrooms || null,
            public_remarks: null,
            walkthru_script: null,
            features: null,
            mls_data: mlsData,
            photo_urls: photoUrlsMLS,
            ai_cost: 0,
            generation_time: mlsData.processing_time_ms || 0,
          };

          console.log("[Auto-save MLS] Saving with photo URLs:", photoUrlsMLS);
          const result = await saveListing(listingData);

          if (result.success) {
            toast.success("MLS data saved automatically", { duration: 3000, icon: "✓" });
          }
        } catch (error) {
          console.error("Auto-save MLS error:", error);
        }
      };

      autoSaveMLS();
    }
  }, [mlsData, photoUrlsMLS]);

  // =========================================================================
  // PROPERTY DESCRIPTIONS TAB HANDLERS
  // =========================================================================

  const handlePhotosChangeDesc = useCallback((newPhotos) => {
    setPhotosDesc(newPhotos);
  }, []);

  const handleAddressChangeDesc = useCallback((newAddress) => {
    setAddressDesc(newAddress);
  }, []);

  const isFormReadyDesc = photosDesc.length > 0 && addressDesc?.street && addressDesc?.zip_code?.length === 5;

  const hasGeneratedContent =
    generationState.publicRemarks.data ||
    generationState.walkthruScript.data ||
    generationState.features.data;

  // Handle generate all content - SEQUENTIAL to avoid rate limits
  const handleGenerateAllDesc = async () => {
    if (!isFormReadyDesc) {
      toast.error("Please upload photos and enter a complete address");
      return;
    }

    setIsGeneratingDesc(true);
    let successCount = 0;
    let rateLimitHit = false;
    const totalSteps = 3; // Public Remarks, Walk-thru, Features

    // Reset all states
    setGenerationState({
      publicRemarks: { status: "idle", data: null, error: null },
      walkthruScript: { status: "idle", data: null, error: null },
      features: { status: "idle", data: null, error: null },
    });

    try {
      // Step 0: Upload photos to Supabase Storage (for saving later)
      setGenerationProgressDesc({ step: 0, total: totalSteps, label: "Uploading photos..." });
      toast.loading("Uploading photos...", { id: "generating-desc" });

      // Only upload if we have File objects (fresh uploads), not if photos are already URLs
      const hasFileObjects = photosDesc.some(p => p.file && p.file instanceof File);
      if (hasFileObjects && user?.id) {
        const { urls: uploadedUrls, errors: uploadErrors } = await uploadPhotosToStorage(
          photosDesc.filter(p => p.file && p.file instanceof File),
          user.id
        );
        if (uploadErrors.length > 0) {
          console.warn("Some photos failed to upload:", uploadErrors);
        }
        if (uploadedUrls.length > 0) {
          setPhotoUrlsDesc(uploadedUrls);
          console.log("[handleGenerateAllDesc] Uploaded photos to Supabase:", uploadedUrls);
        }
      } else if (!hasFileObjects && photoUrlsDesc.length > 0) {
        // Photos are already URLs (loaded from previous listing)
        console.log("[handleGenerateAllDesc] Using existing photo URLs:", photoUrlsDesc);
      }

      // Convert photos to base64 for API calls
      setGenerationProgressDesc({ step: 0, total: totalSteps, label: "Preparing photos..." });
      toast.loading("Preparing photos...", { id: "generating-desc" });
      const imageInputs = await convertPhotosToImageInputs(photosDesc);

      // Build property details
      const propertyDetails = {
        address: addressDesc,
        photos: imageInputs,
        property_type: "single_family",
      };

      // STEP 1: Public Remarks (GPT-4.1)
      setGenerationProgressDesc({ step: 1, total: totalSteps, label: "Generating public remarks..." });
      toast.loading(`Generating public remarks... (1/${totalSteps})`, { id: "generating-desc" });
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

      // STEP 2: Walk-thru Script (Claude) - only if no rate limit
      if (!rateLimitHit) {
        setGenerationProgressDesc({ step: 2, total: totalSteps, label: "Generating walk-thru script..." });
        toast.loading(`Generating walk-thru script... (2/${totalSteps})`, { id: "generating-desc" });
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

      // STEP 3: Features (Gemini - fast & cheap) - only if no rate limit
      if (!rateLimitHit) {
        setGenerationProgressDesc({ step: 3, total: totalSteps, label: "Generating features..." });
        toast.loading(`Generating features... (3/${totalSteps})`, { id: "generating-desc" });
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
      }

      // Show appropriate toast
      if (rateLimitHit) {
        toast.error("Rate limit hit. Please wait 1 minute and try again.", { id: "generating-desc" });
      } else if (successCount === totalSteps) {
        toast.success("All content generated successfully!", { id: "generating-desc" });
      } else if (successCount > 0) {
        toast.success(`Generated ${successCount}/${totalSteps} sections`, { id: "generating-desc" });
      } else {
        toast.error("Failed to generate content", { id: "generating-desc" });
      }
    } catch (error) {
      console.error("Generation error:", error);
      const friendlyError = getFriendlyErrorMessage(error);
      toast.error(friendlyError, { id: "generating-desc" });
    } finally {
      setIsGeneratingDesc(false);
      setGenerationProgressDesc({ step: 0, total: totalSteps, label: "" });
    }
  };

  // Handle test with mock data
  const handleTestWithMockData = async () => {
    setIsGeneratingDesc(true);

    // Set all sections to loading
    setGenerationState({
      publicRemarks: { status: "loading", data: null, error: null },
      walkthruScript: { status: "loading", data: null, error: null },
      features: { status: "loading", data: null, error: null },
    });

    toast.loading("Testing with mock data...", { id: "generating-desc" });

    try {
      const result = await generateAllContentMock();

      setGenerationState({
        publicRemarks: { status: "success", data: result.publicRemarks, error: null },
        walkthruScript: { status: "success", data: result.walkthruScript, error: null },
        features: { status: "success", data: result.features, error: null },
      });

      toast.success("Mock content generated!", { id: "generating-desc" });
    } catch (error) {
      console.error("Mock generation error:", error);
      toast.error("Mock generation failed", { id: "generating-desc" });
    } finally {
      setIsGeneratingDesc(false);
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

  // Handle loading a previous descriptions listing
  const handleLoadDescListing = (listing) => {
    // Set address via ref (to avoid circular updates)
    if (listing.address_json && addressInputDescRef.current) {
      addressInputDescRef.current.setAddress({
        street: listing.address_json.street,
        city: listing.address_json.city,
        state: listing.address_json.state,
        zip_code: listing.address_json.zip_code,
      });
    }

    // Set photo URLs via ref (these are Supabase storage URLs)
    if (listing.photo_urls?.length > 0 && photoUploaderDescRef.current) {
      setPhotoUrlsDesc(listing.photo_urls);
      photoUploaderDescRef.current.setPhotosFromUrls(listing.photo_urls);
    }

    // Set generated content states
    if (listing.public_remarks) {
      setGenerationState(prev => ({
        ...prev,
        publicRemarks: { status: "success", data: { text: listing.public_remarks }, error: null },
      }));
    }
    if (listing.walkthru_script) {
      setGenerationState(prev => ({
        ...prev,
        walkthruScript: { status: "success", data: { script: listing.walkthru_script }, error: null },
      }));
    }
    if (listing.features) {
      try {
        const featuresData = typeof listing.features === "string" ? JSON.parse(listing.features) : listing.features;
        setGenerationState(prev => ({
          ...prev,
          features: { status: "success", data: { categorized_features: featuresData }, error: null },
        }));
      } catch {
        setGenerationState(prev => ({
          ...prev,
          features: { status: "success", data: { features_list: [listing.features] }, error: null },
        }));
      }
    }

    // Auto-expand Public Remarks when loading a listing with content
    if (listing.public_remarks) {
      setExpandedSections({
        publicRemarks: true,
        walkthruScript: false,
        features: false,
      });
    }

    // Track listing ID for future updates (regenerate)
    setCurrentListingIdDesc(listing.id);
  };

  // Handle loading a previous MLS listing
  const handleLoadMLSListing = (listing) => {
    console.log("[handleLoadMLSListing] Loading listing:", listing);
    console.log("[handleLoadMLSListing] address_json:", listing.address_json);
    console.log("[handleLoadMLSListing] photo_urls:", listing.photo_urls);
    console.log("[handleLoadMLSListing] mls_data:", listing.mls_data);
    console.log("[handleLoadMLSListing] addressInputMLSRef.current:", addressInputMLSRef.current);
    console.log("[handleLoadMLSListing] photoUploaderMLSRef.current:", photoUploaderMLSRef.current);

    // Set address via ref (to avoid circular updates)
    if (listing.address_json && addressInputMLSRef.current) {
      console.log("[handleLoadMLSListing] Setting address...");
      addressInputMLSRef.current.setAddress({
        street: listing.address_json.street,
        city: listing.address_json.city,
        state: listing.address_json.state,
        zip_code: listing.address_json.zip_code,
      });
    } else {
      console.log("[handleLoadMLSListing] Skipping address - no data or no ref");
    }

    // Set photo URLs via ref
    if (listing.photo_urls?.length > 0 && photoUploaderMLSRef.current) {
      console.log("[handleLoadMLSListing] Setting photos...");
      setPhotoUrlsMLS(listing.photo_urls);
      photoUploaderMLSRef.current.setPhotosFromUrls(listing.photo_urls);
    } else {
      console.log("[handleLoadMLSListing] Skipping photos - no URLs or no ref");
    }

    // Set MLS data
    if (listing.mls_data) {
      console.log("[handleLoadMLSListing] Setting MLS data...");
      setMlsData(listing.mls_data);
    } else {
      console.log("[handleLoadMLSListing] No MLS data in listing");
    }
  };

  // Clear all property data for Descriptions tab
  const handleClearDescData = () => {
    // Clear photos
    if (photoUploaderDescRef.current) {
      photoUploaderDescRef.current.clearPhotos();
    }
    setPhotosDesc([]);
    setPhotoUrlsDesc([]);

    // Clear address
    if (addressInputDescRef.current) {
      addressInputDescRef.current.clearAddress();
    }
    setAddressDesc(null);

    // Clear generated content
    setGenerationState({
      publicRemarks: { status: "idle", data: null, error: null },
      walkthruScript: { status: "idle", data: null, error: null },
      features: { status: "idle", data: null, error: null },
    });

    // Reset expanded sections and auto-expand flag
    setExpandedSections({
      publicRemarks: false,
      walkthruScript: false,
      features: false,
    });
    hasAutoExpandedRef.current = false;

    // Reset listing ID (new generation will create new listing)
    setCurrentListingIdDesc(null);

    toast.success("Property data cleared");
  };

  // Clear all property data for MLS tab
  const handleClearMLSData = () => {
    // Clear photos
    if (photoUploaderMLSRef.current) {
      photoUploaderMLSRef.current.clearPhotos();
    }
    setPhotosMLS([]);
    setPhotoUrlsMLS([]);

    // Clear address
    if (addressInputMLSRef.current) {
      addressInputMLSRef.current.clearAddress();
    }
    setAddressMLS(null);

    // Clear MLS data
    setMlsData(null);

    toast.success("MLS data cleared");
  };

  // Check if there's data to clear (for button disabled state)
  const hasDescDataToClear = photosDesc.length > 0 || addressDesc?.street ||
    generationState.publicRemarks.data || generationState.walkthruScript.data || generationState.features.data;

  const hasMLSDataToClear = photosMLS.length > 0 || addressMLS?.street || mlsData;

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

  // =========================================================================
  // MLS DATA TAB HANDLERS
  // =========================================================================

  const handlePhotosChangeMLS = useCallback((newPhotos) => {
    setPhotosMLS(newPhotos);
  }, []);

  const handleAddressChangeMLS = useCallback((newAddress) => {
    setAddressMLS(newAddress);
  }, []);

  const isFormReadyMLS = photosMLS.length > 0 && addressMLS?.street && addressMLS?.zip_code?.length === 5;

  // Handle generate MLS data
  const handleGenerateMLS = async () => {
    if (!isFormReadyMLS) {
      toast.error("Please upload photos and enter a complete address");
      return;
    }

    if (!user) {
      toast.error("Please log in to generate MLS data");
      return;
    }

    setIsGeneratingMLS(true);

    try {
      // Format address string
      const addressString = addressMLS
        ? `${addressMLS.street}, ${addressMLS.city || ""}, ${addressMLS.state || ""} ${addressMLS.zip_code}`.trim()
        : "";

      // Upload photos to Supabase Storage first, then send URLs to Claude
      // This bypasses Vercel's 4.5MB payload limit
      const { mlsData: result, photoUrls } = await generateMLSDataWithStorage(
        photosMLS,
        addressString,
        user.id,
        "claude",
        (message) => toast.loading(message, { id: "mls-generating" })
      );

      setMlsData(result);
      // Save the uploaded photo URLs for database storage
      if (photoUrls.length > 0) {
        setPhotoUrlsMLS(photoUrls);
        console.log("[handleGenerateMLS] Saved photo URLs:", photoUrls);
      }
      toast.success(`Extracted MLS data from ${photoUrls.length} photos!`, { id: "mls-generating" });
    } catch (error) {
      console.error("MLS generation error:", error);
      toast.error(getFriendlyErrorMessage(error), { id: "mls-generating" });
    } finally {
      setIsGeneratingMLS(false);
    }
  };

  // =========================================================================
  // REGENERATE HANDLERS
  // =========================================================================

  const handleRegeneratePublicRemarks = async () => {
    if (!currentListingIdDesc) {
      toast.error("Please generate content first");
      return;
    }

    setGenerationState(prev => ({
      ...prev,
      publicRemarks: { status: "loading", data: null, error: null },
    }));

    try {
      // Convert photos to base64 for API
      const imageInputs = await convertPhotosToImageInputs(photosDesc);

      const propertyDetails = {
        address: addressDesc,
        photos: imageInputs,
        property_type: "single_family",
      };

      const publicRemarksResult = await generatePublicRemarks(propertyDetails);

      setGenerationState(prev => ({
        ...prev,
        publicRemarks: { status: "success", data: publicRemarksResult, error: null },
      }));

      // Update database (overwrite existing listing)
      const updateResult = await updateListing(currentListingIdDesc, {
        public_remarks: publicRemarksResult.text,
        ai_cost: publicRemarksResult.usage?.cost_usd || 0,
      });

      if (updateResult.success) {
        toast.success("Public Remarks regenerated and saved");
      } else {
        toast.error("Regenerated but failed to save");
      }
    } catch (error) {
      const friendlyError = getFriendlyErrorMessage(error);
      setGenerationState(prev => ({
        ...prev,
        publicRemarks: { status: "error", data: null, error: friendlyError },
      }));
      toast.error(friendlyError);
    }
  };

  const handleRegenerateWalkthruScript = async () => {
    if (!currentListingIdDesc) {
      toast.error("Please generate content first");
      return;
    }

    setGenerationState(prev => ({
      ...prev,
      walkthruScript: { status: "loading", data: null, error: null },
    }));

    try {
      const imageInputs = await convertPhotosToImageInputs(photosDesc);

      const propertyDetails = {
        address: addressDesc,
        photos: imageInputs,
        property_type: "single_family",
      };

      // Include public remarks for context if available
      const publicRemarks = generationState.publicRemarks.data?.text;
      const walkthruResult = await generateWalkthruScript(propertyDetails, publicRemarks);

      setGenerationState(prev => ({
        ...prev,
        walkthruScript: { status: "success", data: walkthruResult, error: null },
      }));

      // Update database
      const updateResult = await updateListing(currentListingIdDesc, {
        walkthru_script: walkthruResult.script,
      });

      if (updateResult.success) {
        toast.success("Walk-thru Script regenerated and saved");
      } else {
        toast.error("Regenerated but failed to save");
      }
    } catch (error) {
      const friendlyError = getFriendlyErrorMessage(error);
      setGenerationState(prev => ({
        ...prev,
        walkthruScript: { status: "error", data: null, error: friendlyError },
      }));
      toast.error(friendlyError);
    }
  };

  const handleRegenerateFeatures = async () => {
    if (!currentListingIdDesc) {
      toast.error("Please generate content first");
      return;
    }

    setGenerationState(prev => ({
      ...prev,
      features: { status: "loading", data: null, error: null },
    }));

    try {
      const imageInputs = await convertPhotosToImageInputs(photosDesc);

      const propertyDetails = {
        address: addressDesc,
        photos: imageInputs,
        property_type: "single_family",
      };

      const featuresResult = await generateFeatures(propertyDetails);

      setGenerationState(prev => ({
        ...prev,
        features: { status: "success", data: featuresResult, error: null },
      }));

      // Update database
      const updateResult = await updateListing(currentListingIdDesc, {
        features: JSON.stringify(featuresResult.categorized_features || featuresResult.features_list),
      });

      if (updateResult.success) {
        toast.success("Features Sheet regenerated and saved");
      } else {
        toast.error("Regenerated but failed to save");
      }
    } catch (error) {
      const friendlyError = getFriendlyErrorMessage(error);
      setGenerationState(prev => ({
        ...prev,
        features: { status: "error", data: null, error: friendlyError },
      }));
      toast.error(friendlyError);
    }
  };

  // =========================================================================
  // BUTTON CONFIGURATIONS
  // =========================================================================

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
      onClick: handleRegenerateFeatures,
      disabled: generationState.features.status === "loading",
    },
  ];

  // =========================================================================
  // RENDER
  // =========================================================================

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

            {/* Navigation Links */}
            <nav className="hidden md:flex items-center gap-6">
              <Link
                href="/dashboard/generate"
                className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
              >
                Generate
              </Link>
            </nav>

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
          /* =============================================================== */
          /* PROPERTY DESCRIPTIONS TAB                                       */
          /* =============================================================== */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Sidebar - Photos & Address */}
            <aside className="lg:col-span-4 space-y-6">
              <div className="sticky top-40">
                {/* Card wrapper for sidebar content */}
                <div className="bg-base-100 border border-base-200 rounded-2xl p-6 space-y-6 shadow-sm">
                  {/* Listing Loader & Clear Button */}
                  <div className="flex justify-end gap-2 -mt-2 -mr-2">
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

                  <PhotoUploader
                    ref={photoUploaderDescRef}
                    onPhotosChange={handlePhotosChangeDesc}
                    disabled={isGeneratingDesc}
                    initialPhotos={photosDesc}
                  />
                  <div className="border-t border-base-200 pt-6">
                    <AddressInput
                      ref={addressInputDescRef}
                      onAddressChange={handleAddressChangeDesc}
                      disabled={isGeneratingDesc}
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

                    {/* Test with Mock Data button */}
                    <button
                      onClick={handleTestWithMockData}
                      disabled={isGeneratingDesc}
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
              />

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
              />

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
              />

            </main>
          </div>
        ) : (
          /* =============================================================== */
          /* MLS DATA TAB                                                    */
          /* =============================================================== */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Sidebar - Photos & Address for MLS */}
            <aside className="lg:col-span-4 space-y-6">
              <div className="sticky top-40">
                {/* Card wrapper for sidebar content */}
                <div className="bg-base-100 border border-base-200 rounded-2xl p-6 space-y-6 shadow-sm">
                  {/* Listing Loader & Clear Button */}
                  <div className="flex justify-end gap-2 -mt-2 -mr-2">
                    <button
                      onClick={handleClearMLSData}
                      disabled={isGeneratingMLS || !hasMLSDataToClear}
                      className="btn btn-ghost btn-sm gap-1 text-base-content/60 hover:text-error hover:bg-error/10 disabled:opacity-40"
                      title="Clear all data and start fresh"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                      </svg>
                      Clear
                    </button>
                    <ListingLoader
                      listingType="mls_data"
                      userId={user?.id}
                      onSelectListing={handleLoadMLSListing}
                      disabled={isGeneratingMLS}
                    />
                  </div>

                  <PhotoUploader
                    ref={photoUploaderMLSRef}
                    onPhotosChange={handlePhotosChangeMLS}
                    disabled={isGeneratingMLS}
                    initialPhotos={photosMLS}
                  />
                  <div className="border-t border-base-200 pt-6">
                    <AddressInput
                      ref={addressInputMLSRef}
                      onAddressChange={handleAddressChangeMLS}
                      disabled={isGeneratingMLS}
                    />
                  </div>

                  {/* Generate MLS Data Button */}
                  <div className="border-t border-base-200 pt-6 space-y-3">
                    <button
                      onClick={handleGenerateMLS}
                      disabled={isGeneratingMLS || !isFormReadyMLS}
                      className="btn btn-primary w-full gap-2"
                    >
                      {isGeneratingMLS ? (
                        <>
                          <span className="loading loading-spinner loading-sm"></span>
                          <span className="text-sm">Extracting MLS Data...</span>
                        </>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 1.5v-1.5m0 0c0-.621.504-1.125 1.125-1.125m0 0h7.5" />
                          </svg>
                          Generate MLS Data
                        </>
                      )}
                    </button>

                    {!isFormReadyMLS && (
                      <p className="text-xs text-base-content/40 text-center">
                        Upload photos and enter address first
                      </p>
                    )}

                    {!user && isFormReadyMLS && (
                      <p className="text-xs text-warning text-center">
                        Please log in to generate MLS data
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </aside>

            {/* Main Content - MLS Data Display */}
            <main className="lg:col-span-8">
              <div className="bg-base-100 border border-base-200 rounded-2xl shadow-sm p-6">
                {isGeneratingMLS ? (
                  /* Loading State */
                  <div className="flex flex-col items-center justify-center py-16">
                    <span className="loading loading-spinner loading-lg text-primary"></span>
                    <p className="text-base-content/60 mt-4">Extracting MLS data from photos...</p>
                    <p className="text-base-content/40 text-sm mt-1">This may take 10-30 seconds</p>
                  </div>
                ) : mlsData ? (
                  /* MLS Data Display */
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-xl font-semibold">Extracted MLS Data</h2>
                      <button
                        onClick={() => setMlsData(null)}
                        className="btn btn-ghost btn-sm gap-2"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                        </svg>
                        Re-extract
                      </button>
                    </div>
                    <MLSDataDisplay data={mlsData} />
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
                    <p className="text-base-content/60 text-center max-w-md mb-2">
                      AI will analyze your property photos and extract 22 MLS-compliant fields including bedrooms, bathrooms, flooring, appliances, and more.
                    </p>
                    <p className="text-base-content/40 text-sm text-center">
                      Upload photos and enter an address in the sidebar to get started.
                    </p>
                  </div>
                )}
              </div>
            </main>
          </div>
        )}
      </div>
    </main>
  );
}
