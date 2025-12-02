"use client";

import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Custom hook to manage the Screen Wake Lock API.
 * Prevents the browser from suspending the tab during long-running operations.
 *
 * @returns {Object} Wake lock controls and state
 */
export function useWakeLock() {
  const [wakeLock, setWakeLock] = useState(null);
  const [isSupported, setIsSupported] = useState(false);
  const wakeLockRef = useRef(null);

  // Check for Wake Lock API support on mount
  useEffect(() => {
    const supported = "wakeLock" in navigator;
    setIsSupported(supported);
    console.log("[WakeLock] Supported:", supported);
  }, []);

  // Request a wake lock
  const requestWakeLock = useCallback(async () => {
    if (!isSupported) {
      console.warn("[WakeLock] Not supported in this browser");
      return null;
    }

    try {
      const lock = await navigator.wakeLock.request("screen");
      setWakeLock(lock);
      wakeLockRef.current = lock;
      console.log("[WakeLock] Acquired - tab will stay active");

      // Handle lock release events (e.g., when tab becomes hidden on mobile)
      lock.addEventListener("release", () => {
        console.log("[WakeLock] Released by system");
        setWakeLock(null);
        wakeLockRef.current = null;
      });

      return lock;
    } catch (err) {
      // Wake lock request can fail if:
      // - Tab is not visible
      // - User denied permission
      // - Browser policy prevents it
      console.error("[WakeLock] Failed to acquire:", err.name, err.message);
      return null;
    }
  }, [isSupported]);

  // Release the wake lock
  const releaseWakeLock = useCallback(async () => {
    const lock = wakeLockRef.current;
    if (lock) {
      try {
        await lock.release();
        setWakeLock(null);
        wakeLockRef.current = null;
        console.log("[WakeLock] Manually released");
      } catch (err) {
        console.error("[WakeLock] Failed to release:", err.name, err.message);
      }
    }
  }, []);

  // Re-acquire wake lock when tab becomes visible again
  // This is important because the wake lock is automatically released when tab is hidden
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible" && wakeLockRef.current !== null) {
        // Tab became visible and we had a wake lock - try to re-acquire
        console.log("[WakeLock] Tab visible again, re-acquiring wake lock...");
        try {
          const lock = await navigator.wakeLock.request("screen");
          setWakeLock(lock);
          wakeLockRef.current = lock;
          console.log("[WakeLock] Re-acquired after visibility change");

          lock.addEventListener("release", () => {
            console.log("[WakeLock] Released by system after re-acquire");
            setWakeLock(null);
            wakeLockRef.current = null;
          });
        } catch (err) {
          console.error("[WakeLock] Failed to re-acquire:", err.name, err.message);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
      }
    };
  }, []);

  return {
    isSupported,
    isActive: wakeLock !== null,
    requestWakeLock,
    releaseWakeLock,
  };
}
