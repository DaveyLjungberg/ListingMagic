"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { generateWalkthroughVideo, getFriendlyErrorMessage } from "@/libs/generate-api";

/**
 * Hook for managing video generation state and handlers.
 */
export function useVideoGeneration() {
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [videoData, setVideoData] = useState(null);
  const [includeVoiceover, setIncludeVoiceover] = useState(true);
  const [selectedVoice, setSelectedVoice] = useState("EXAVITQu4vr4xnSDxMaL"); // Sarah default
  const [isPreviewingVoice, setIsPreviewingVoice] = useState(null);

  // Generate video from walk-thru script
  const handleGenerateVideo = async (script, photoUrlsDesc, currentListingIdDesc) => {
    if (!script) {
      toast.error("Please generate a walk-thru script first");
      return;
    }

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

  // Preview voice
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

  return {
    // State
    isGeneratingVideo,
    videoData,
    setVideoData,
    includeVoiceover,
    setIncludeVoiceover,
    selectedVoice,
    setSelectedVoice,
    isPreviewingVoice,

    // Handlers
    handleGenerateVideo,
    handleDownloadVideo,
    handlePreviewVideo,
    handlePreviewVoice,
  };
}
