"use client";

import { useState, useRef, useCallback, useEffect } from "react";
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
  generateWalkthroughVideo,
  refineContent,
  checkFairHousingComplianceLocal,
  convertPhotosToImageInputs,
  formatGenerationTime,
  formatCost,
  copyToClipboard,
  getFriendlyErrorMessage,
  isRateLimitError,
} from "@/libs/generate-api";
import { uploadPhotosToStorage } from "@/libs/supabase-storage-upload";
import { saveListing, updateListing } from "@/libs/listings";
import { scanPhotoCompliance } from "@/libs/photoCompliance";

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
  // Photo compliance scanning state
  const [complianceReportDesc, setComplianceReportDesc] = useState(null);
  const [scanningComplianceDesc, setScanningComplianceDesc] = useState(false);

  // =========================================================================
  // MLS DATA TAB STATE (Independent)
  // =========================================================================
  const photoUploaderMLSRef = useRef(null);
  const addressInputMLSRef = useRef(null);
  const [photosMLS, setPhotosMLS] = useState([]);
  const [addressMLS, setAddressMLS] = useState(null);
  const [isGeneratingMLS, setIsGeneratingMLS] = useState(false);
  const [mlsData, setMlsData] = useState(null);
  const [mlsDataEditable, setMlsDataEditable] = useState(null); // Editable copy of MLS data
  const [photoUrlsMLS, setPhotoUrlsMLS] = useState([]); // For storing Supabase URLs after load
  const [currentListingIdMLS, setCurrentListingIdMLS] = useState(null); // Track current MLS listing for updates
  // Photo compliance scanning state for MLS
  const [complianceReportMLS, setComplianceReportMLS] = useState(null);
  const [scanningComplianceMLS, setScanningComplianceMLS] = useState(false);

  // =========================================================================
  // VIDEO GENERATION STATE
  // =========================================================================
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [videoData, setVideoData] = useState(null);
  const [includeVoiceover, setIncludeVoiceover] = useState(true);
  const [selectedVoice, setSelectedVoice] = useState("EXAVITQu4vr4xnSDxMaL"); // Sarah default
  const [isPreviewingVoice, setIsPreviewingVoice] = useState(null);

  // =========================================================================
  // CONTENT REFINEMENT STATE (for real-time AI editing)
  // =========================================================================
  // Public Remarks refinement
  const [remarksHistory, setRemarksHistory] = useState([]);
  const [isRefiningRemarks, setIsRefiningRemarks] = useState(false);
  const [remarksComplianceError, setRemarksComplianceError] = useState(null);

  // Walk-thru Script refinement
  const [scriptHistory, setScriptHistory] = useState([]);
  const [isRefiningScript, setIsRefiningScript] = useState(false);
  const [scriptComplianceError, setScriptComplianceError] = useState(null);

  // Features refinement
  const [featuresHistory, setFeaturesHistory] = useState([]);
  const [isRefiningFeatures, setIsRefiningFeatures] = useState(false);
  const [featuresComplianceError, setFeaturesComplianceError] = useState(null);

  // Voice options with metadata - American voices only
  const voiceOptions = [
    // Female voices (American)
    {
      id: "EXAVITQu4vr4xnSDxMaL",
      name: "Sarah",
      gender: "Female",
      age: "Young",
      description: "Warm, engaging",
    },
    {
      id: "FGY2WhTYpPnrIDTdsKH5",
      name: "Laura",
      gender: "Female",
      age: "Young",
      description: "Friendly, approachable",
    },
    {
      id: "XrExE9yKIg1WjnnlVkGX",
      name: "Matilda",
      gender: "Female",
      age: "Middle-aged",
      description: "Professional, polished",
    },
    // Male voices (American)
    {
      id: "nPczCjzI2devNBz1zQrb",
      name: "Brian",
      gender: "Male",
      age: "Middle-aged",
      description: "Authoritative, trustworthy",
    },
    {
      id: "iP95p4xoKVk53GoZ742B",
      name: "Chris",
      gender: "Male",
      age: "Middle-aged",
      description: "Clear, professional",
    },
    {
      id: "cjVigY5qzO86Huf0OWal",
      name: "Eric",
      gender: "Male",
      age: "Middle-aged",
      description: "Warm, confident",
    },
  ];

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
  // Only save when we have valid photo URLs (not blob URLs) and NO existing listing ID
  useEffect(() => {
    // Skip auto-save if we already have a listing ID (loading existing or already saved)
    if (currentListingIdDesc) {
      console.log("[Auto-save Desc] Skipping - already have listing ID:", currentListingIdDesc);
      return;
    }

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
              // Tax record data
              apn: addressDesc.apn || null,
              yearBuilt: addressDesc.yearBuilt || null,
              lotSize: addressDesc.lotSize || null,
              county: addressDesc.county || null,
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
  }, [generationState.publicRemarks.status, generationState.walkthruScript.status, generationState.features.status, photoUrlsDesc, currentListingIdDesc]);

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
  // Only save when we have both mlsData AND valid photo URLs (not blob URLs) and NO existing listing ID
  useEffect(() => {
    // Skip auto-save if we already have a listing ID (loading existing or already saved)
    if (currentListingIdMLS) {
      console.log("[Auto-save MLS] Skipping - already have listing ID:", currentListingIdMLS);
      return;
    }

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
              // Tax record data
              apn: addressMLS.apn || null,
              yearBuilt: addressMLS.yearBuilt || null,
              lotSize: addressMLS.lotSize || null,
              county: addressMLS.county || null,
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
            setCurrentListingIdMLS(result.id); // Store listing ID for future updates
            toast.success("MLS data saved automatically", { duration: 3000, icon: "✓" });
          }
        } catch (error) {
          console.error("Auto-save MLS error:", error);
        }
      };

      autoSaveMLS();
    }
  }, [mlsData, photoUrlsMLS, currentListingIdMLS]);

  // Sync editable MLS data when mlsData changes
  useEffect(() => {
    if (mlsData) {
      setMlsDataEditable({ ...mlsData });
    } else {
      setMlsDataEditable(null);
    }
  }, [mlsData]);

  // Handler for MLS field changes
  const handleMLSFieldChange = useCallback((field, value) => {
    setMlsDataEditable(prev => {
      if (!prev) return prev;
      return { ...prev, [field]: value };
    });
  }, []);

  // Save edited MLS data
  const handleSaveMLSEdits = async () => {
    if (!currentListingIdMLS) {
      toast.error("No listing to update");
      return;
    }

    try {
      const result = await updateListing(currentListingIdMLS, {
        mls_data: mlsDataEditable,
      });

      if (result.success) {
        // Update the original mlsData to match
        setMlsData({ ...mlsDataEditable });
        toast.success("MLS data saved");
      } else {
        toast.error(result.error || "Failed to save changes");
      }
    } catch (error) {
      console.error("Save MLS error:", error);
      toast.error("Failed to save changes");
    }
  };

  // =========================================================================
  // PROPERTY DESCRIPTIONS TAB HANDLERS
  // =========================================================================

  const handlePhotosChangeDesc = useCallback((newPhotos) => {
    setPhotosDesc(newPhotos);
    // Clear compliance report when photos change
    setComplianceReportDesc(null);
  }, []);

  const handleAddressChangeDesc = useCallback((newAddress) => {
    setAddressDesc(newAddress);
  }, []);

  // Handle compliance scan for descriptions tab
  const handleScanComplianceDesc = async () => {
    if (photosDesc.length === 0) {
      toast.error("No photos to scan");
      return;
    }

    setScanningComplianceDesc(true);
    setComplianceReportDesc(null);

    try {
      const report = await scanPhotoCompliance(photosDesc, {
        onProgress: (index, total) => {
          console.log(`Scanning photo ${index + 1} of ${total}...`);
        },
      });
      setComplianceReportDesc(report);

      if (report.hasViolations) {
        toast.error(`${report.violations.length} photo(s) have compliance issues`);
      } else {
        toast.success("All photos are compliant!");
      }
    } catch (error) {
      console.error("Compliance scan error:", error);
      toast.error("Failed to scan photos");
    } finally {
      setScanningComplianceDesc(false);
    }
  };

  // Remove photo by index (for compliance violations)
  const handleRemovePhotoDesc = (photoIndex) => {
    const newPhotos = photosDesc.filter((_, idx) => idx !== photoIndex);
    setPhotosDesc(newPhotos);
    photoUploaderDescRef.current?.setPhotos(newPhotos);
    setComplianceReportDesc(null); // Clear report after removal
    toast.success("Photo removed");
  };

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
    const totalSteps = 4; // Public Remarks, Walk-thru, Features, MLS Data

    // Reset all states
    setGenerationState({
      publicRemarks: { status: "idle", data: null, error: null },
      walkthruScript: { status: "idle", data: null, error: null },
      features: { status: "idle", data: null, error: null },
    });
    // Reset MLS data as well
    setMlsData(null);
    setMlsDataEditable(null);

    try {
      // Step 0: Upload photos to Supabase Storage (for saving later)
      setGenerationProgressDesc({ step: 0, total: totalSteps, label: "Uploading photos..." });
      toast.loading("Uploading photos...", { id: "generating-desc" });

      // Track URLs for intelligent photo selection
      let currentPhotoUrls = photoUrlsDesc;

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
          currentPhotoUrls = uploadedUrls; // Use immediately for selection
          console.log("[handleGenerateAllDesc] Uploaded photos to Supabase:", uploadedUrls);
        }
      } else if (!hasFileObjects && photoUrlsDesc.length > 0) {
        // Photos are already URLs (loaded from previous listing)
        console.log("[handleGenerateAllDesc] Using existing photo URLs:", photoUrlsDesc);
      }

      // Convert photos to base64 for API calls (with intelligent selection if > 20 photos)
      setGenerationProgressDesc({ step: 0, total: totalSteps, label: "Preparing photos..." });
      toast.loading("Preparing photos...", { id: "generating-desc" });
      const imageInputs = await convertPhotosToImageInputs(photosDesc, currentPhotoUrls);

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

      // STEP 4: MLS Data (Claude) - only if no rate limit
      if (!rateLimitHit) {
        setGenerationProgressDesc({ step: 4, total: totalSteps, label: "Extracting MLS data..." });
        toast.loading(`Extracting MLS data... (4/${totalSteps})`, { id: "generating-desc" });

        try {
          // Format address string for MLS
          const addressString = addressDesc
            ? `${addressDesc.street}, ${addressDesc.city || ""}, ${addressDesc.state || ""} ${addressDesc.zip_code}`.trim()
            : "";

          // Get tax data from AddressInput ref
          const taxData = addressInputDescRef.current?.getTaxData?.();

          // Generate MLS data using photos already uploaded to Supabase
          const { mlsData: mlsResult, photoUrls: mlsPhotoUrls } = await generateMLSDataWithStorage(
            photosDesc,
            addressString,
            user?.id,
            "claude",
            () => {}, // No individual toast updates since we're showing overall progress
            taxData
          );

          setMlsData(mlsResult);
          // Sync photos to MLS tab state
          if (mlsPhotoUrls.length > 0) {
            setPhotoUrlsMLS(mlsPhotoUrls);
          } else if (currentPhotoUrls.length > 0) {
            setPhotoUrlsMLS(currentPhotoUrls);
          }
          // Sync address to MLS tab
          setAddressMLS(addressDesc);
          successCount++;
        } catch (error) {
          console.error("MLS generation error:", error);
          // MLS errors don't stop the overall process, just log it
          const friendlyError = getFriendlyErrorMessage(error);
          console.warn(`MLS generation failed: ${friendlyError}`);
          // Still consider partial success - descriptions were generated
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
    // Set address via ref (to avoid circular updates) - including tax data
    if (listing.address_json && addressInputDescRef.current) {
      addressInputDescRef.current.setAddress({
        street: listing.address_json.street,
        city: listing.address_json.city,
        state: listing.address_json.state,
        zip_code: listing.address_json.zip_code,
        // Tax record data
        apn: listing.address_json.apn || "",
        yearBuilt: listing.address_json.yearBuilt || "",
        lotSize: listing.address_json.lotSize || "",
        county: listing.address_json.county || "",
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

    // Set address via ref (to avoid circular updates) - including tax data
    if (listing.address_json && addressInputMLSRef.current) {
      console.log("[handleLoadMLSListing] Setting address...");
      addressInputMLSRef.current.setAddress({
        street: listing.address_json.street,
        city: listing.address_json.city,
        state: listing.address_json.state,
        zip_code: listing.address_json.zip_code,
        // Tax record data
        apn: listing.address_json.apn || "",
        yearBuilt: listing.address_json.yearBuilt || "",
        lotSize: listing.address_json.lotSize || "",
        county: listing.address_json.county || "",
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

    // Track listing ID for future updates (prevents auto-save on load)
    setCurrentListingIdMLS(listing.id);
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

    // Reset listing ID (new generation will create new listing)
    setCurrentListingIdMLS(null);

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
    // Clear compliance report when photos change
    setComplianceReportMLS(null);
  }, []);

  const handleAddressChangeMLS = useCallback((newAddress) => {
    setAddressMLS(newAddress);
  }, []);

  // Handle compliance scan for MLS tab
  const handleScanComplianceMLS = async () => {
    if (photosMLS.length === 0) {
      toast.error("No photos to scan");
      return;
    }

    setScanningComplianceMLS(true);
    setComplianceReportMLS(null);

    try {
      const report = await scanPhotoCompliance(photosMLS, {
        onProgress: (index, total) => {
          console.log(`Scanning photo ${index + 1} of ${total}...`);
        },
      });
      setComplianceReportMLS(report);

      if (report.hasViolations) {
        toast.error(`${report.violations.length} photo(s) have compliance issues`);
      } else {
        toast.success("All photos are compliant!");
      }
    } catch (error) {
      console.error("Compliance scan error:", error);
      toast.error("Failed to scan photos");
    } finally {
      setScanningComplianceMLS(false);
    }
  };

  // Remove photo by index (for MLS compliance violations)
  const handleRemovePhotoMLS = (photoIndex) => {
    const newPhotos = photosMLS.filter((_, idx) => idx !== photoIndex);
    setPhotosMLS(newPhotos);
    photoUploaderMLSRef.current?.setPhotos(newPhotos);
    setComplianceReportMLS(null); // Clear report after removal
    toast.success("Photo removed");
  };

  // Check if MLS form is ready - either has uploaded photos OR has photos from Descriptions tab
  const hasMLSPhotos = photosMLS.length > 0 || photoUrlsMLS.length > 0;
  const isFormReadyMLS = hasMLSPhotos && addressMLS?.street && addressMLS?.zip_code?.length === 5;

  // Handle generate MLS data
  const handleGenerateMLS = async () => {
    // Special case: regenerating from Descriptions tab photos
    const usingDescPhotos = photosMLS.length === 0 && photoUrlsMLS.length > 0;

    if (!usingDescPhotos && !isFormReadyMLS) {
      toast.error("Please upload photos and enter a complete address");
      return;
    }

    if (!user) {
      toast.error("Please log in to generate MLS data");
      return;
    }

    setIsGeneratingMLS(true);

    try {
      // Format address string - use MLS address, or fall back to Descriptions address
      const effectiveAddress = addressMLS || addressDesc;
      const addressString = effectiveAddress
        ? `${effectiveAddress.street}, ${effectiveAddress.city || ""}, ${effectiveAddress.state || ""} ${effectiveAddress.zip_code}`.trim()
        : "";

      // Get tax data from AddressInput ref if it exists
      // Try MLS ref first, then fallback to Descriptions ref
      const taxData = addressInputMLSRef.current?.getTaxData?.() || addressInputDescRef.current?.getTaxData?.();
      console.log("[handleGenerateMLS] Tax data:", taxData);

      // Determine which photos to use
      // If we have fresh uploads, use those; otherwise use existing URLs
      const photosToUse = photosMLS.length > 0 ? photosMLS : [];
      const existingUrls = photoUrlsMLS.length > 0 ? photoUrlsMLS : photoUrlsDesc;

      // Upload photos to Supabase Storage first, then send URLs to Claude
      // This bypasses Vercel's 4.5MB payload limit
      const { mlsData: result, photoUrls } = await generateMLSDataWithStorage(
        photosToUse,
        addressString,
        user.id,
        "claude",
        (message) => toast.loading(message, { id: "mls-generating" }),
        taxData, // Pass tax data to backend
        existingUrls // Pass existing URLs for regeneration case
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
      // Convert photos to base64 for API (with intelligent selection if > 20 photos)
      const imageInputs = await convertPhotosToImageInputs(photosDesc, photoUrlsDesc);

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
      // Convert photos to base64 for API (with intelligent selection if > 20 photos)
      const imageInputs = await convertPhotosToImageInputs(photosDesc, photoUrlsDesc);

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

  // Handle video generation from walk-thru script
  const handleGenerateVideo = async () => {
    // Check if we have a walk-thru script
    const script = generationState.walkthruScript.data?.script;
    if (!script) {
      toast.error("Please generate a walk-thru script first");
      return;
    }

    // Check if we have photos
    if (!photoUrlsDesc || photoUrlsDesc.length === 0) {
      toast.error("No photos available for video generation");
      return;
    }

    // Check if we have a listing ID
    if (!currentListingIdDesc) {
      toast.error("Please generate content first");
      return;
    }

    setIsGeneratingVideo(true);
    setVideoData(null);

    const loadingMessage = includeVoiceover
      ? "Generating video with voiceover... (1-2 minutes)"
      : "Generating silent video...";
    const toastId = toast.loading(loadingMessage, { duration: 180000 });

    try {
      const result = await generateWalkthroughVideo(
        script,
        photoUrlsDesc,
        currentListingIdDesc,
        includeVoiceover,
        selectedVoice,
        (message) => {
          toast.loading(message, { id: toastId });
        }
      );

      setVideoData(result);

      if (!result.has_voiceover) {
        toast.success(
          `Video ready (${Math.round(result.duration_seconds)}s) - no voiceover, script available separately`,
          { id: toastId, duration: 5000 }
        );
      } else {
        toast.success(
          `Video ready! ${Math.round(result.duration_seconds)}s with professional voiceover`,
          { id: toastId, duration: 5000 }
        );
      }
    } catch (error) {
      console.error("Video generation error:", error);
      const friendlyError = getFriendlyErrorMessage(error);
      toast.error(friendlyError, { id: toastId });
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  // Handle video download - fetches and downloads as blob for cross-origin support
  const handleDownloadVideo = async (videoUrl) => {
    try {
      toast.loading("Preparing download...", { id: "video-download" });

      // Fetch the video file
      const response = await fetch(videoUrl);
      if (!response.ok) throw new Error("Failed to fetch video");

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      // Create download link
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `walkthrough_video_${currentListingIdDesc || "listing"}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Cleanup blob URL
      URL.revokeObjectURL(blobUrl);

      toast.success("Video downloaded!", { id: "video-download" });
    } catch (error) {
      console.error("Download failed:", error);
      toast.error("Download failed. Try right-click → Save As", { id: "video-download" });
    }
  };

  // Handle video preview - opens in new tab
  const handlePreviewVideo = (videoUrl) => {
    window.open(videoUrl, "_blank");
  };

  // Handle voice preview
  const handlePreviewVoice = async (voiceId) => {
    setIsPreviewingVoice(voiceId);

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "https://listingmagic-production.up.railway.app";

      const response = await fetch(`${backendUrl}/api/preview-voice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voice_id: voiceId,
          text: "Welcome to this beautiful home. This property features stunning craftsmanship and modern amenities."
        })
      });

      if (!response.ok) {
        throw new Error("Voice preview failed");
      }

      const data = await response.json();

      // Convert base64 to audio blob and play
      const audioBytes = atob(data.audio_base64);
      const audioArray = new Uint8Array(audioBytes.length);
      for (let i = 0; i < audioBytes.length; i++) {
        audioArray[i] = audioBytes.charCodeAt(i);
      }
      const audioBlob = new Blob([audioArray], { type: "audio/mpeg" });
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.play();

      audio.onended = () => {
        setIsPreviewingVoice(null);
        URL.revokeObjectURL(audioUrl);
      };
    } catch (error) {
      console.error("Voice preview failed:", error);
      toast.error("Could not preview voice");
      setIsPreviewingVoice(null);
    }
  };

  // =========================================================================
  // CONTENT REFINEMENT HANDLERS
  // =========================================================================

  // Refine Public Remarks
  const handleRefineRemarks = async (instruction) => {
    if (!instruction?.trim()) return;

    const currentContent = generationState.publicRemarks.data?.text;
    if (!currentContent) {
      toast.error("No content to refine");
      return;
    }

    // Quick local compliance check
    const localCheck = checkFairHousingComplianceLocal(instruction);
    if (!localCheck.isCompliant) {
      setRemarksComplianceError({
        message: "Your refinement request may violate Fair Housing laws",
        violations: localCheck.violations,
      });
      return;
    }

    setIsRefiningRemarks(true);
    setRemarksComplianceError(null);

    try {
      const result = await refineContent(
        "remarks",
        currentContent,
        instruction,
        remarksHistory,
        { address: addressDesc }
      );

      if (!result.success) {
        if (result.error === "compliance_violation") {
          setRemarksComplianceError({
            message: result.message,
            violations: result.violations,
          });
          toast.error("Fair Housing compliance issue detected");
        } else {
          toast.error(result.message || "Failed to refine content");
        }
        return;
      }

      // Update the generation state with refined content
      setGenerationState(prev => ({
        ...prev,
        publicRemarks: {
          ...prev.publicRemarks,
          data: { ...prev.publicRemarks.data, text: result.refined_content },
        },
      }));

      // Update conversation history
      setRemarksHistory(prev => [
        ...prev,
        { role: "user", content: instruction },
        { role: "assistant", content: result.refined_content },
      ]);

      // Update database
      if (currentListingIdDesc) {
        await updateListing(currentListingIdDesc, {
          public_remarks: result.refined_content,
        });
      }

      toast.success("Public remarks refined");
    } catch (error) {
      console.error("Refinement error:", error);
      toast.error("Failed to refine content");
    } finally {
      setIsRefiningRemarks(false);
    }
  };

  // Refine Walk-thru Script
  const handleRefineScript = async (instruction) => {
    if (!instruction?.trim()) return;

    const currentContent = generationState.walkthruScript.data?.script;
    if (!currentContent) {
      toast.error("No content to refine");
      return;
    }

    // Quick local compliance check
    const localCheck = checkFairHousingComplianceLocal(instruction);
    if (!localCheck.isCompliant) {
      setScriptComplianceError({
        message: "Your refinement request may violate Fair Housing laws",
        violations: localCheck.violations,
      });
      return;
    }

    setIsRefiningScript(true);
    setScriptComplianceError(null);

    try {
      const result = await refineContent(
        "script",
        currentContent,
        instruction,
        scriptHistory,
        { address: addressDesc }
      );

      if (!result.success) {
        if (result.error === "compliance_violation") {
          setScriptComplianceError({
            message: result.message,
            violations: result.violations,
          });
          toast.error("Fair Housing compliance issue detected");
        } else {
          toast.error(result.message || "Failed to refine content");
        }
        return;
      }

      // Update the generation state with refined content
      setGenerationState(prev => ({
        ...prev,
        walkthruScript: {
          ...prev.walkthruScript,
          data: { ...prev.walkthruScript.data, script: result.refined_content },
        },
      }));

      // Update conversation history
      setScriptHistory(prev => [
        ...prev,
        { role: "user", content: instruction },
        { role: "assistant", content: result.refined_content },
      ]);

      // Update database
      if (currentListingIdDesc) {
        await updateListing(currentListingIdDesc, {
          walkthru_script: result.refined_content,
        });
      }

      toast.success("Walk-thru script refined");
    } catch (error) {
      console.error("Refinement error:", error);
      toast.error("Failed to refine content");
    } finally {
      setIsRefiningScript(false);
    }
  };

  // Refine Features
  const handleRefineFeatures = async (instruction) => {
    if (!instruction?.trim()) return;

    const featuresData = generationState.features.data;
    const currentContent = featuresData?.categorized_features
      ? JSON.stringify(featuresData.categorized_features, null, 2)
      : featuresData?.features_list?.join("\n");

    if (!currentContent) {
      toast.error("No content to refine");
      return;
    }

    // Quick local compliance check
    const localCheck = checkFairHousingComplianceLocal(instruction);
    if (!localCheck.isCompliant) {
      setFeaturesComplianceError({
        message: "Your refinement request may violate Fair Housing laws",
        violations: localCheck.violations,
      });
      return;
    }

    setIsRefiningFeatures(true);
    setFeaturesComplianceError(null);

    try {
      const result = await refineContent(
        "features",
        currentContent,
        instruction,
        featuresHistory,
        { address: addressDesc }
      );

      if (!result.success) {
        if (result.error === "compliance_violation") {
          setFeaturesComplianceError({
            message: result.message,
            violations: result.violations,
          });
          toast.error("Fair Housing compliance issue detected");
        } else {
          toast.error(result.message || "Failed to refine content");
        }
        return;
      }

      // Parse the refined content back to structured format
      let refinedFeatures;
      try {
        refinedFeatures = JSON.parse(result.refined_content);
      } catch {
        // If not JSON, treat as plain text list
        refinedFeatures = result.refined_content.split("\n").filter(line => line.trim());
      }

      // Update the generation state with refined content
      setGenerationState(prev => ({
        ...prev,
        features: {
          ...prev.features,
          data: {
            ...prev.features.data,
            categorized_features: typeof refinedFeatures === "object" && !Array.isArray(refinedFeatures)
              ? refinedFeatures
              : prev.features.data?.categorized_features,
            features_list: Array.isArray(refinedFeatures)
              ? refinedFeatures
              : prev.features.data?.features_list,
          },
        },
      }));

      // Update conversation history
      setFeaturesHistory(prev => [
        ...prev,
        { role: "user", content: instruction },
        { role: "assistant", content: result.refined_content },
      ]);

      // Update database
      if (currentListingIdDesc) {
        await updateListing(currentListingIdDesc, {
          features: result.refined_content,
        });
      }

      toast.success("Features refined");
    } catch (error) {
      console.error("Refinement error:", error);
      toast.error("Failed to refine content");
    } finally {
      setIsRefiningFeatures(false);
    }
  };

  // Clear refinement history (called on regenerate)
  const clearRefinementHistory = (type) => {
    if (type === "remarks") {
      setRemarksHistory([]);
      setRemarksComplianceError(null);
    } else if (type === "script") {
      setScriptHistory([]);
      setScriptComplianceError(null);
    } else if (type === "features") {
      setFeaturesHistory([]);
      setFeaturesComplianceError(null);
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
      // Convert photos to base64 for API (with intelligent selection if > 20 photos)
      const imageInputs = await convertPhotosToImageInputs(photosDesc, photoUrlsDesc);

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
      onClick: handleGenerateVideo,
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
                New Listing
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
          /* =============================================================== */
          /* PROPERTY DESCRIPTIONS TAB                                       */
          /* =============================================================== */
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

                  <PhotoUploader
                    ref={photoUploaderDescRef}
                    onPhotosChange={handlePhotosChangeDesc}
                    disabled={isGeneratingDesc}
                  />

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
                    <div className={`transition-all duration-300 overflow-hidden ${
                      includeVoiceover ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
                    }`}>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-base-content/70">Select Voice</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {voiceOptions.map((voice) => (
                            <button
                              key={voice.id}
                              onClick={() => setSelectedVoice(voice.id)}
                              className={`relative p-3 border-2 rounded-lg text-left transition-all ${
                                selectedVoice === voice.id
                                  ? "border-primary bg-primary/5"
                                  : "border-base-300 hover:border-base-content/30"
                              }`}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-medium text-sm">{voice.name}</span>
                                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                                      voice.gender === "Female"
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
                          onClick={() => handleDownloadVideo(videoData.video_url)}
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

            </main>
          </div>
        ) : (
          /* =============================================================== */
          /* MLS DATA TAB                                                    */
          /* =============================================================== */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Sidebar - Photos & Address for MLS */}
            <aside className="lg:col-span-4 space-y-6 relative z-10">
              <div className="sticky top-40">
                {/* Card wrapper for sidebar content */}
                <div className="bg-base-100 border border-base-200 rounded-2xl p-6 space-y-6 shadow-sm">
                  {/* If MLS was generated from Descriptions tab, show simplified sidebar */}
                  {mlsData && photosMLS.length === 0 && photoUrlsMLS.length > 0 ? (
                    <>
                      {/* Info Banner - Generated from Descriptions */}
                      <div className="alert alert-success">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="flex-1">
                          <span className="font-medium">Generated from Descriptions</span>
                          <p className="text-xs opacity-70 mt-0.5">
                            MLS data extracted using {photoUrlsMLS.length} photos from the Descriptions tab
                          </p>
                        </div>
                      </div>

                      {/* Address Summary */}
                      {addressMLS && (
                        <div className="bg-base-200/50 rounded-xl p-4">
                          <p className="text-sm font-medium text-base-content/80">Property Address</p>
                          <p className="text-base-content mt-1">
                            {addressMLS.street}, {addressMLS.city}, {addressMLS.state} {addressMLS.zip_code}
                          </p>
                        </div>
                      )}

                      {/* Regenerate MLS Button */}
                      <button
                        onClick={handleGenerateMLS}
                        disabled={isGeneratingMLS}
                        className="btn btn-outline btn-sm w-full gap-2"
                      >
                        {isGeneratingMLS ? (
                          <>
                            <span className="loading loading-spinner loading-sm"></span>
                            Regenerating...
                          </>
                        ) : (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                            </svg>
                            Re-extract MLS Data
                          </>
                        )}
                      </button>

                      {/* Clear Button - to start fresh on MLS tab */}
                      <button
                        onClick={handleClearMLSData}
                        className="btn btn-ghost btn-xs w-full text-base-content/50 hover:text-error"
                      >
                        Clear & upload new photos
                      </button>
                    </>
                  ) : (
                    <>
                      {/* Standard MLS Tab View - Photo Upload & Address */}
                      {/* Listing Loader & Clear Button */}
                      <div className="flex justify-end gap-2 -mt-2 -mr-2 relative z-10">
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
                      />

                  {/* Photo Compliance Scanner for MLS */}
                  {photosMLS.length > 0 && (
                    <div className="border-t border-base-200 pt-4 space-y-3">
                      {/* Scan Button */}
                      {!complianceReportMLS && !scanningComplianceMLS && (
                        <button
                          onClick={handleScanComplianceMLS}
                          className="btn btn-outline btn-sm w-full gap-2"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                          </svg>
                          Scan for Compliance Issues
                        </button>
                      )}

                      {/* Scanning Progress */}
                      {scanningComplianceMLS && (
                        <div className="alert alert-info">
                          <span className="loading loading-spinner loading-sm"></span>
                          <span>Scanning {photosMLS.length} photos for compliance issues...</span>
                        </div>
                      )}

                      {/* Compliance Results */}
                      {complianceReportMLS && !scanningComplianceMLS && (
                        <div className="space-y-3">
                          {complianceReportMLS.hasViolations ? (
                            <>
                              <div className="alert alert-warning">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                                </svg>
                                <span>{complianceReportMLS.violations.length} photo(s) have potential issues</span>
                              </div>

                              {/* Violation List */}
                              <div className="space-y-2">
                                {complianceReportMLS.violations.map((v) => (
                                  <div key={v.photoIndex} className="flex items-start gap-3 p-3 bg-warning/10 rounded-lg border border-warning/20">
                                    {/* Photo Thumbnail */}
                                    <div className="w-12 h-12 rounded overflow-hidden flex-shrink-0 bg-base-200">
                                      <img
                                        src={photosMLS[v.photoIndex]?.preview || photosMLS[v.photoIndex]}
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
                                      onClick={() => handleRemovePhotoMLS(v.photoIndex)}
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
                                onClick={handleScanComplianceMLS}
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
                              <span>All {complianceReportMLS.totalPhotos} photos are compliant!</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="border-t border-base-200 pt-6">
                    <AddressInput
                      ref={addressInputMLSRef}
                      onAddressChange={handleAddressChangeMLS}
                      disabled={isGeneratingMLS}
                      hideTaxFields={true}
                      autoFetchTaxRecords={true}
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
                    </>
                  )}
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
                        onClick={handleSaveMLSEdits}
                        disabled={!currentListingIdMLS}
                        className="btn btn-primary btn-sm gap-2"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 3.75H6.912a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H15M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859M12 3v8.25m0 0l-3-3m3 3l3-3" />
                        </svg>
                        Save Changes
                      </button>
                    </div>
                    <MLSDataDisplay
                      data={mlsData}
                      editableData={mlsDataEditable}
                      onFieldChange={handleMLSFieldChange}
                      isEditable={true}
                    />
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
