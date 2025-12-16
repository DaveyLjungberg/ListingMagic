"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { generateWalkthroughVideo, getFriendlyErrorMessage } from "@/libs/generate-api";

/**
 * Hook for managing video generation state and handlers.
 * Videos are silent (no voiceover) - just photos with transitions.
 */
export function useVideoGeneration() {
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [videoData, setVideoData] = useState(null);
  const [secondsPerPhoto, setSecondsPerPhoto] = useState(4.0);

  // Generate silent video from photos
  const handleGenerateVideo = async (photoUrlsDesc, currentListingIdDesc) => {
    if (!photoUrlsDesc || photoUrlsDesc.length === 0) {
      toast.error("No photos available for video generation");
      return;
    }

    if (!currentListingIdDesc) {
      toast.error("Please generate content first");
      return;
    }

    setIsGeneratingVideo(true);
    setVideoData(null);

    const toastId = toast.loading("Generating video... (30-60 seconds)", { duration: 180000 });

    try {
      const result = await generateWalkthroughVideo(
        photoUrlsDesc,
        currentListingIdDesc,
        secondsPerPhoto,
        (message) => {
          toast.loading(message, { id: toastId });
        }
      );

      setVideoData(result);

      toast.success(
        `Video ready! ${Math.round(result.duration_seconds)}s, ${result.photos_used} photos`,
        { id: toastId, duration: 5000 }
      );
    } catch (error) {
      console.error("Video generation error:", error);
      const friendlyError = getFriendlyErrorMessage(error);
      toast.error(friendlyError, { id: toastId });
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  // Download video as blob (cross-origin support)
  const handleDownloadVideo = async (videoUrl, listingId) => {
    try {
      toast.loading("Preparing download...", { id: "video-download" });

      const response = await fetch(videoUrl);
      if (!response.ok) throw new Error("Failed to fetch video");

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `walkthrough_video_${listingId || "listing"}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(blobUrl);

      toast.success("Video downloaded!", { id: "video-download" });
    } catch (error) {
      console.error("Download failed:", error);
      toast.error("Download failed. Try right-click → Save As", { id: "video-download" });
    }
  };

  // Preview video in new tab
  const handlePreviewVideo = (videoUrl) => {
    window.open(videoUrl, "_blank");
  };

  return {
    // State
    isGeneratingVideo,
    videoData,
    setVideoData,
    secondsPerPhoto,
    setSecondsPerPhoto,

    // Handlers
    handleGenerateVideo,
    handleDownloadVideo,
    handlePreviewVideo,
  };
}
