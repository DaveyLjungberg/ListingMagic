"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useWakeLock } from "@/hooks/useWakeLock";

/**
 * Hook for managing wake lock and progress state during long-running generation operations.
 * Prevents browser tab suspension during AI generation.
 */
export function useWakeLockGeneration() {
  const { isSupported: isWakeLockSupported, isActive: isWakeLockActive, requestWakeLock, releaseWakeLock } = useWakeLock();
  const [generationStartTime, setGenerationStartTime] = useState(null);
  const [currentOperationLabel, setCurrentOperationLabel] = useState("");
  const heartbeatIntervalRef = useRef(null);

  // Request notification permission on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      const timer = setTimeout(() => {
        Notification.requestPermission().then((permission) => {
          console.log("[Notifications] Permission:", permission);
        });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, []);

  // Helper to send notification when generation completes (if tab was backgrounded)
  const sendCompletionNotification = useCallback((message = "Your property content is ready!") => {
    if (
      document.hidden &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      new Notification("Listing Magic", {
        body: message,
        icon: "/icon.png",
        tag: "generation-complete",
      });
    }
  }, []);

  // Helper to get estimated time remaining based on current step
  const getEstimatedTimeRemaining = useCallback((currentStep, totalSteps) => {
    const avgSecondsPerStep = 45;
    const remaining = (totalSteps - currentStep) * avgSecondsPerStep;
    if (remaining <= 0) return null;
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    return minutes > 0
      ? `~${minutes}m ${seconds}s remaining`
      : `~${seconds}s remaining`;
  }, []);

  // Start heartbeat for browsers without wake lock support
  const startHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) return;
    console.log("[Heartbeat] Starting fallback heartbeat...");
    heartbeatIntervalRef.current = setInterval(() => {
      fetch("/api/health", { method: "HEAD" }).catch(() => {});
    }, 30000);
  }, []);

  // Stop heartbeat
  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      console.log("[Heartbeat] Stopping fallback heartbeat");
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  // Cleanup heartbeat on unmount
  useEffect(() => {
    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, []);

  // Start generation with wake lock
  const startGeneration = useCallback(async (operationLabel = "Initializing...") => {
    console.log("[Generation] Started, requesting wake lock...");
    setGenerationStartTime(Date.now());
    setCurrentOperationLabel(operationLabel);

    const wakeLockAcquired = await requestWakeLock();
    console.log("[WakeLock] Acquired:", !!wakeLockAcquired);

    if (!wakeLockAcquired && !isWakeLockActive) {
      startHeartbeat();
    }

    return wakeLockAcquired;
  }, [requestWakeLock, isWakeLockActive, startHeartbeat]);

  // End generation and release wake lock
  const endGeneration = useCallback(async () => {
    console.log("[Generation] Complete, releasing wake lock");
    await releaseWakeLock();
    stopHeartbeat();
    setGenerationStartTime(null);
    setCurrentOperationLabel("");
  }, [releaseWakeLock, stopHeartbeat]);

  return {
    // Wake lock state
    isWakeLockSupported,
    isWakeLockActive,

    // Progress state
    generationStartTime,
    currentOperationLabel,
    setCurrentOperationLabel,

    // Helpers
    getEstimatedTimeRemaining,
    sendCompletionNotification,

    // Control functions
    startGeneration,
    endGeneration,
  };
}
