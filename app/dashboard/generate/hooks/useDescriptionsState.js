"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import toast from "react-hot-toast";
// TODO: photoCompliance is NOT safe in client bundles - it imports face-api.js/tfjs which attempt
// to resolve Node.js 'fs' module, causing browser bundle errors. Move to server-side API route or
// re-enable when a proper client-safe solution is available.

/**
 * Hook for managing all Descriptions tab state including photos, address, and generation state.
 */
export function useDescriptionsState() {
  // Photo state
  const photoUploaderDescRef = useRef(null);
  const [photosDesc, setPhotosDesc] = useState([]);
  const [photoUrlsDesc, setPhotoUrlsDesc] = useState([]);

  // Address state
  const addressInputDescRef = useRef(null);
  const [addressDesc, setAddressDesc] = useState(null);

  // Generation state
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false); // Overlay-only (Public Remarks)
  const [isGeneratingFeatures, setIsGeneratingFeatures] = useState(false); // Features tab loading
  const [isGeneratingBackground, setIsGeneratingBackground] = useState(false); // Background tasks running
  const [generationProgressDesc, setGenerationProgressDesc] = useState({ 
    phase: "uploadingPhotos", // "uploadingPhotos" | "analyzingPhotos" | "generatingPublicRemarks"
    current: 0, 
    total: 0, 
    label: "" // Still used for button text
  });

  // Content generation results
  const [generationState, setGenerationState] = useState({
    publicRemarks: { status: "idle", data: null, error: null },
    features: { status: "idle", data: null, error: null },
  });

  // Section expansion state
  const [expandedSections, setExpandedSections] = useState({
    publicRemarks: false,
    features: false,
  });

  // Listing tracking
  const [currentListingIdDesc, setCurrentListingIdDesc] = useState(null);

  // Photo compliance state
  const [complianceReportDesc, setComplianceReportDesc] = useState(null);
  const [scanningComplianceDesc, setScanningComplianceDesc] = useState(false);

  // Auto-expand tracking
  const hasAutoExpandedRef = useRef(false);

  // Photo handlers
  const handlePhotosChangeDesc = useCallback((newPhotos) => {
    setPhotosDesc(newPhotos);
    setComplianceReportDesc(null);
  }, []);

  const handleAddressChangeDesc = useCallback((newAddress) => {
    setAddressDesc(newAddress);
  }, []);

  // Compliance scan handler
  // TODO: Temporarily disabled - photoCompliance drags in face-api.js/tfjs which try to resolve
  // Node.js 'fs' in the browser bundle. Re-enable when moved to server-side API route.
  const handleScanComplianceDesc = async () => {
    toast.error("Photo compliance scanning is temporarily disabled", {
      duration: 4000,
      icon: "⚠️"
    });
    return;

    /* Disabled implementation:
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
    */
  };

  // Remove photo handler
  const handleRemovePhotoDesc = (photoIndex) => {
    const newPhotos = photosDesc.filter((_, idx) => idx !== photoIndex);
    setPhotosDesc(newPhotos);
    setComplianceReportDesc(null);
    toast.success("Photo removed");
  };

  // Form readiness check
  const isFormReadyDesc = photosDesc.length > 0 && addressDesc?.street && addressDesc?.zip_code?.length === 5;

  // Check if there's content to clear
  const hasDescDataToClear = photosDesc.length > 0 || addressDesc?.street ||
    generationState.publicRemarks.data || generationState.features.data;

  // Check if content has been generated
  const hasGeneratedContent =
    generationState.publicRemarks.data ||
    generationState.features.data;

  // Clear all data
  const handleClearDescData = () => {
    setPhotosDesc([]);
    setPhotoUrlsDesc([]);

    if (addressInputDescRef.current) {
      addressInputDescRef.current.clearAddress();
    }
    setAddressDesc(null);

    setGenerationState({
      publicRemarks: { status: "idle", data: null, error: null },
      features: { status: "idle", data: null, error: null },
    });

    setExpandedSections({
      publicRemarks: false,
      features: false,
    });
    hasAutoExpandedRef.current = false;

    setCurrentListingIdDesc(null);
    setComplianceReportDesc(null);
    
    // Reset generation progress
    setGenerationProgressDesc({
      phase: "uploadingPhotos",
      current: 0,
      total: 0,
      label: "",
    });

    toast.success("Property data cleared");
  };

  // Auto-expand Public Remarks when generated
  useEffect(() => {
    const publicRemarksReady = generationState.publicRemarks.data?.text;

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
    if (isGeneratingDesc || isGeneratingBackground) {
      hasAutoExpandedRef.current = false;
    }
  }, [isGeneratingDesc, isGeneratingBackground]);

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

  return {
    // Refs
    photoUploaderDescRef,
    addressInputDescRef,

    // Photo state
    photosDesc,
    setPhotosDesc,
    photoUrlsDesc,
    setPhotoUrlsDesc,

    // Address state
    addressDesc,
    setAddressDesc,

    // Generation state
    isGeneratingDesc,
    setIsGeneratingDesc,
    isGeneratingFeatures,
    setIsGeneratingFeatures,
    isGeneratingBackground,
    setIsGeneratingBackground,
    generationProgressDesc,
    setGenerationProgressDesc,
    generationState,
    setGenerationState,

    // Section state
    expandedSections,
    setExpandedSections,

    // Listing tracking
    currentListingIdDesc,
    setCurrentListingIdDesc,

    // Compliance state
    complianceReportDesc,
    setComplianceReportDesc,
    scanningComplianceDesc,

    // Computed values
    isFormReadyDesc,
    hasDescDataToClear,
    hasGeneratedContent,

    // Handlers
    handlePhotosChangeDesc,
    handleAddressChangeDesc,
    handleScanComplianceDesc,
    handleRemovePhotoDesc,
    handleClearDescData,

    // Helpers
    formatFeaturesText,
  };
}
