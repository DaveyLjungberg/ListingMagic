"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import toast from "react-hot-toast";
import { updateListing } from "@/libs/listings";

/**
 * Hook for managing all MLS Data tab state.
 */
export function useMLSState() {
  // Photo state
  const photoUploaderMLSRef = useRef(null);
  const [photosMLS, setPhotosMLS] = useState([]);
  const [photoUrlsMLS, setPhotoUrlsMLS] = useState([]);

  // Address state
  const addressInputMLSRef = useRef(null);
  const [addressMLS, setAddressMLS] = useState(null);

  // Generation state
  const [isGeneratingMLS, setIsGeneratingMLS] = useState(false);
  const [mlsData, setMlsData] = useState(null);
  const [mlsDataEditable, setMlsDataEditable] = useState(null);

  // Listing tracking
  const [currentListingIdMLS, setCurrentListingIdMLS] = useState(null);

  // Compliance state
  const [complianceReportMLS, setComplianceReportMLS] = useState(null);
  const [scanningComplianceMLS, setScanningComplianceMLS] = useState(false);

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

  // Photo handlers
  const handlePhotosChangeMLS = useCallback((newPhotos) => {
    setPhotosMLS(newPhotos);
    setComplianceReportMLS(null);
  }, []);

  const handleAddressChangeMLS = useCallback((newAddress) => {
    setAddressMLS(newAddress);
  }, []);

  // Remove photo handler
  const handleRemovePhotoMLS = (photoIndex) => {
    const newPhotos = photosMLS.filter((_, idx) => idx !== photoIndex);
    setPhotosMLS(newPhotos);
    photoUploaderMLSRef.current?.setPhotos(newPhotos);
    setComplianceReportMLS(null);
    toast.success("Photo removed");
  };

  // Form readiness check
  const hasMLSPhotos = photosMLS.length > 0 || photoUrlsMLS.length > 0;
  const isFormReadyMLS = hasMLSPhotos && addressMLS?.street && addressMLS?.zip_code?.length === 5;

  // Check if there's data to clear
  const hasMLSDataToClear = photosMLS.length > 0 || addressMLS?.street || mlsData;

  // Clear all data
  const handleClearMLSData = () => {
    if (photoUploaderMLSRef.current) {
      photoUploaderMLSRef.current.clearPhotos();
    }
    setPhotosMLS([]);
    setPhotoUrlsMLS([]);

    if (addressInputMLSRef.current) {
      addressInputMLSRef.current.clearAddress();
    }
    setAddressMLS(null);

    setMlsData(null);
    setMlsDataEditable(null);

    setCurrentListingIdMLS(null);

    toast.success("MLS data cleared");
  };

  // Load MLS listing
  const handleLoadMLSListing = (listing) => {
    console.log("[handleLoadMLSListing] Loading listing:", listing);

    if (listing.address_json && addressInputMLSRef.current) {
      console.log("[handleLoadMLSListing] Setting address...");
      addressInputMLSRef.current.setAddress({
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

    if (listing.photo_urls?.length > 0 && photoUploaderMLSRef.current) {
      console.log("[handleLoadMLSListing] Setting photos...");
      setPhotoUrlsMLS(listing.photo_urls);
      photoUploaderMLSRef.current.setPhotosFromUrls(listing.photo_urls);
    }

    if (listing.mls_data) {
      console.log("[handleLoadMLSListing] Setting MLS data...");
      setMlsData(listing.mls_data);
    }

    setCurrentListingIdMLS(listing.id);
  };

  return {
    // Refs
    photoUploaderMLSRef,
    addressInputMLSRef,

    // Photo state
    photosMLS,
    setPhotosMLS,
    photoUrlsMLS,
    setPhotoUrlsMLS,

    // Address state
    addressMLS,
    setAddressMLS,

    // Generation state
    isGeneratingMLS,
    setIsGeneratingMLS,
    mlsData,
    setMlsData,
    mlsDataEditable,
    setMlsDataEditable,

    // Listing tracking
    currentListingIdMLS,
    setCurrentListingIdMLS,

    // Compliance state
    complianceReportMLS,
    scanningComplianceMLS,

    // Computed values
    hasMLSPhotos,
    isFormReadyMLS,
    hasMLSDataToClear,

    // Handlers
    handleMLSFieldChange,
    handleSaveMLSEdits,
    handlePhotosChangeMLS,
    handleAddressChangeMLS,
    handleRemovePhotoMLS,
    handleClearMLSData,
    handleLoadMLSListing,
  };
}
