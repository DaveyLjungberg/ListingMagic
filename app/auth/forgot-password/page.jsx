"use client";

import { useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { supabase } from "@/libs/supabase";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email) {
      toast.error("Please enter your email address");
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });

      if (error) {
        toast.error(error.message);
        setIsLoading(false);
        return;
      }

      setEmailSent(true);
      toast.success("Password reset link sent! Check your email.");
    } catch (error) {
      console.error("Password reset error:", error);
      toast.error("An unexpected error occurred");
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-surface p-8 rounded-2xl border border-border shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
        {emailSent ? (
          // Success state
          <div className="text-center">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">
              Check Your Email
            </h1>
            <p className="text-green-400 mb-6">
              We&apos;ve sent a password reset link to <strong>{email}</strong>
            </p>
            <p className="text-sm text-text-muted mb-6">
              Click the link in the email to reset your password. The link will expire in 1 hour.
            </p>
            <Link
              href="/auth/login"
              className="inline-flex items-center justify-center w-full px-4 py-3 bg-surface-highlight border border-border text-white font-semibold rounded-xl hover:bg-surface-highlight/80 transition-colors"
            >
              Back to Login
            </Link>
          </div>
        ) : (
          // Form state
          <>
            <h1 className="text-2xl font-bold text-white text-center mb-2">
              Forgot Password?
            </h1>
            <p className="text-text-muted text-center mb-6">
              Enter your email and we&apos;ll send you a link to reset your password.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block mb-2">
                  <span className="text-sm font-medium text-white">Email</span>
                </label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 rounded-xl bg-surface-highlight text-white border border-border placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition-all"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-white font-semibold py-3 hover:bg-[#0088EE] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span className="loading loading-spinner loading-sm"></span>
                    Sending...
                  </>
                ) : (
                  "Send Reset Link"
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <Link
                href="/auth/login"
                className="text-sm text-text-muted hover:text-primary transition-colors"
              >
                ← Back to Login
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

