"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/libs/supabase";
import { X } from "lucide-react";

export default function OnboardingModal({ userEmail, onComplete }) {
  const [source, setSource] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      console.log("Current user:", user?.id, user?.email);
      
      if (!user) {
        console.error("No user found");
        onComplete();
        return;
      }

      const emailDomain = userEmail.split('@')[1];
      console.log("Attempting upsert with:", {
        user_id: user.id,
        brokerage_domain: emailDomain,
        source: source
      });

      // Use UPSERT - insert or update in one operation
      const response = await supabase
        .from('user_profiles')
        .upsert({
          user_id: user.id,
          brokerage_domain: emailDomain,
          source: source,
          created_at: new Date().toISOString()
        }, {
          onConflict: 'user_id',
          ignoreDuplicates: false
        })
        .select();

      console.log("Raw response:", response);
      console.log("Response status:", response.status);
      console.log("Response statusText:", response.statusText);

      if (response.error) {
        console.error("Failed to save source - Full error object:", response.error);
        console.error("Error string:", JSON.stringify(response.error, null, 2));
        console.error("Error code:", response.error?.code);
        console.error("Error message:", response.error?.message);
        console.error("Error details:", response.error?.details);
        console.error("Error hint:", response.error?.hint);
      } else {
        console.log("✅ Source saved successfully:", response.data);
      }

      onComplete();
    } catch (error) {
      console.error("Exception saving source:", error);
      console.error("Exception string:", JSON.stringify(error, null, 2));
      onComplete(); // Close anyway to not block user
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 relative">
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            Welcome to QuickList! 🎉
          </h2>
          <p className="text-slate-600">
            Help us improve by telling us how you found us
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              How did you hear about us?
            </label>
            <select
              className="w-full h-11 px-4 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              disabled={isSubmitting}
              required
            >
              <option value="">Select an option</option>
              <option value="YouTube">YouTube</option>
              <option value="TikTok">TikTok</option>
              <option value="Facebook">Facebook</option>
              <option value="Instagram">Instagram</option>
              <option value="Google Search">Google Search</option>
              <option value="Referral">Referral from a friend</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleSkip}
              className="flex-1 h-11 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 transition-colors"
              disabled={isSubmitting}
            >
              Skip
            </button>
            <button
              type="submit"
              className="flex-1 h-11 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
              disabled={isSubmitting || !source}
            >
              {isSubmitting ? "Saving..." : "Continue"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
