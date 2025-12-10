"use client";

import { useState, useEffect } from "react";
import { UploadCloud, ScanEye, PenTool, ShieldCheck } from "lucide-react";

/**
 * NarrativeLoader - Full-screen generation overlay
 * Shows state-driven narrative phases with smooth progress interpolation
 */
export default function NarrativeLoader({ isGenerating, currentStep = 1 }) {
  const [displayProgress, setDisplayProgress] = useState(2);
  const [targetProgress, setTargetProgress] = useState(30);
  const [show, setShow] = useState(false);

  // Define the narrative phases keyed by step number
  const phases = {
    1: {
      icon: ScanEye,
      title: "Vision AI analyzing room features...",
      color: "text-indigo-600",
      bgColor: "bg-indigo-100",
      progressStart: 10,
      progressEnd: 30,
    },
    2: {
      icon: PenTool,
      title: "Drafting video scripts & marketing copy...",
      color: "text-violet-600",
      bgColor: "bg-violet-100",
      progressStart: 30,
      progressEnd: 60,
    },
    3: {
      icon: UploadCloud,
      title: "Extracting features...",
      color: "text-slate-600",
      bgColor: "bg-slate-100",
      progressStart: 60,
      progressEnd: 85,
    },
    4: {
      icon: ShieldCheck,
      title: "Verifying MLS data & Fair Housing compliance...",
      color: "text-teal-600",
      bgColor: "bg-teal-100",
      progressStart: 85,
      progressEnd: 95,
    },
  };

  // Update target progress when step changes
  useEffect(() => {
    if (isGenerating) {
      setShow(true);
      // Normalize step to 1-4 range
      const normalizedStep = Math.max(1, Math.min(4, currentStep));
      const phase = phases[normalizedStep];
      if (phase) {
        setTargetProgress(phase.progressEnd);
      }
    }
  }, [currentStep, isGenerating]);

  // Handle completion transition
  useEffect(() => {
    if (!isGenerating && show) {
      // Transition to 100%
      setTargetProgress(100);
    }
  }, [isGenerating, show]);

  // Progress interpolator - smoothly moves displayProgress toward targetProgress
  useEffect(() => {
    if (!show) return;

    const interval = setInterval(() => {
      setDisplayProgress((current) => {
        // If we're close enough to target, snap to it
        if (Math.abs(current - targetProgress) < 0.5) {
          return targetProgress;
        }
        
        // Otherwise move toward target
        const increment = targetProgress > current ? 1.5 : -1.5;
        const next = current + increment;
        
        // Clamp to not overshoot
        if (increment > 0) {
          return Math.min(next, targetProgress);
        } else {
          return Math.max(next, targetProgress);
        }
      });
    }, 150);

    return () => clearInterval(interval);
  }, [targetProgress, show]);

  // Unmount after reaching 100%
  useEffect(() => {
    if (displayProgress >= 100 && !isGenerating) {
      const timer = setTimeout(() => {
        setShow(false);
        setDisplayProgress(2); // Reset for next time
        setTargetProgress(30);
      }, 600);
      
      return () => clearTimeout(timer);
    }
  }, [displayProgress, isGenerating]);

  // Don't render if not showing
  if (!show) return null;

  // Get the active phase (normalize step to 1-4)
  const normalizedStep = Math.max(1, Math.min(4, currentStep));
  const activePhase = phases[normalizedStep] || phases[1];
  const Icon = activePhase.icon;

  return (
    <div className="fixed inset-0 z-50 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center">
      {/* Main Content */}
      <div className="flex flex-col items-center gap-6 max-w-md mx-auto px-4">
        {/* Pulsing Icon Circle */}
        <div className={`p-8 rounded-full ${activePhase.bgColor} animate-pulse shadow-lg transition-all duration-300`}>
          <Icon className={`w-16 h-16 ${activePhase.color}`} strokeWidth={1.5} />
        </div>

        {/* Title */}
        <h2 className="text-2xl font-serif font-semibold text-primary-navy text-center">
          {activePhase.title}
        </h2>

        {/* Progress Bar */}
        <div className="w-full max-w-md">
          <div className="w-full h-2 bg-base-200 rounded-full overflow-hidden">
            <div
              className={`h-full ${activePhase.bgColor} transition-all duration-500 ease-out`}
              style={{ width: `${displayProgress}%` }}
            />
          </div>
          <p className="text-xs text-base-content/50 text-center mt-2">
            {Math.round(displayProgress)}% complete
          </p>
        </div>
      </div>
    </div>
  );
}
