"use client";

import { useState, useCallback } from "react";
import toast from "react-hot-toast";
import { refineContent, checkFairHousingComplianceLocal } from "@/libs/generate-api";
import { updateListing } from "@/libs/listings";

/**
 * Hook for managing content refinement state and handlers.
 */
export function useRefinement() {
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

  // Refine Public Remarks
  const handleRefineRemarks = useCallback(async (instruction, currentContent, addressDesc, currentListingIdDesc, updateGenerationState) => {
    if (!instruction?.trim()) return;

    if (!currentContent) {
      toast.error("No content to refine");
      return;
    }

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
      updateGenerationState(prev => ({
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
  }, [remarksHistory]);

  // Refine Walk-thru Script
  const handleRefineScript = useCallback(async (instruction, currentContent, addressDesc, currentListingIdDesc, updateGenerationState) => {
    if (!instruction?.trim()) return;

    if (!currentContent) {
      toast.error("No content to refine");
      return;
    }

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

      updateGenerationState(prev => ({
        ...prev,
        walkthruScript: {
          ...prev.walkthruScript,
          data: { ...prev.walkthruScript.data, script: result.refined_content },
        },
      }));

      setScriptHistory(prev => [
        ...prev,
        { role: "user", content: instruction },
        { role: "assistant", content: result.refined_content },
      ]);

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
  }, [scriptHistory]);

  // Refine Features
  const handleRefineFeatures = useCallback(async (instruction, featuresData, addressDesc, currentListingIdDesc, updateGenerationState) => {
    if (!instruction?.trim()) return;

    const currentContent = featuresData?.categorized_features
      ? JSON.stringify(featuresData.categorized_features, null, 2)
      : featuresData?.features_list?.join("\n");

    if (!currentContent) {
      toast.error("No content to refine");
      return;
    }

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
        refinedFeatures = result.refined_content.split("\n").filter(line => line.trim());
      }

      updateGenerationState(prev => ({
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

      setFeaturesHistory(prev => [
        ...prev,
        { role: "user", content: instruction },
        { role: "assistant", content: result.refined_content },
      ]);

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
  }, [featuresHistory]);

  // Clear refinement history
  const clearRefinementHistory = useCallback((type) => {
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
  }, []);

  return {
    // Public Remarks
    remarksHistory,
    isRefiningRemarks,
    remarksComplianceError,
    setRemarksComplianceError,
    handleRefineRemarks,

    // Walk-thru Script
    scriptHistory,
    isRefiningScript,
    scriptComplianceError,
    setScriptComplianceError,
    handleRefineScript,

    // Features
    featuresHistory,
    isRefiningFeatures,
    featuresComplianceError,
    setFeaturesComplianceError,
    handleRefineFeatures,

    // Shared
    clearRefinementHistory,
  };
}
