"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { supabase } from "@/libs/supabase";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [source, setSource] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error("Please enter email and password");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      // Save user source for analytics
      if (source) {
        try {
          await supabase.rpc('update_user_source', {
            user_email_param: email,
            source_param: source
          });
        } catch (sourceError) {
          console.error("Failed to save source:", sourceError);
        }
      }

      // Check if email confirmation is required
      if (data.user && !data.session) {
        toast.success("Check your email to confirm your account!");
        router.push("/auth/login");
      } else {
        toast.success("Account created successfully!");
        router.push("/dashboard/generate");
      }
    } catch (error) {
      console.error("Signup error:", error);
      toast.error("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-base-100 flex items-center justify-center px-4">
      <div className="card w-full max-w-md bg-base-100 shadow-xl border border-base-200">
        <div className="card-body">
          <h1 className="card-title text-2xl font-bold text-center justify-center mb-2">
            Create Account
          </h1>
          <p className="text-base-content/60 text-center mb-6">
            Sign up for Listing Magic
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text">Email</span>
              </label>
              <input
                type="email"
                placeholder="you@example.com"
                className="input input-bordered w-full"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Password</span>
              </label>
              <input
                type="password"
                placeholder="Create a password"
                className="input input-bordered w-full"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Confirm Password</span>
              </label>
              <input
                type="password"
                placeholder="Confirm your password"
                className="input input-bordered w-full"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">How did you hear about us?</span>
              </label>
              <select
                className="select select-bordered w-full"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                disabled={isLoading}
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

            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  Creating account...
                </>
              ) : (
                "Sign Up"
              )}
            </button>
          </form>

          <div className="divider">OR</div>

          <p className="text-center text-sm text-base-content/60">
            Already have an account?{" "}
            <Link href="/auth/login" className="link link-primary">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
