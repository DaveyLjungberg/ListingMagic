"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { supabase } from "@/libs/supabase";
import { FcGoogle } from "react-icons/fc";
import { FaApple } from "react-icons/fa";
import { Mail, Lock, Loader2, Home } from "lucide-react";

function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (!email || !password) {
      setErrorMessage("Please enter email and password");
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMessage(error.message);
        setIsLoading(false);
        return;
      }

      toast.success("Login successful!");

      localStorage.setItem('rememberMe', rememberMe);
      if (rememberMe) {
        sessionStorage.setItem('activeSession', 'true');
      }

      // Log user session for analytics
      try {
        await supabase.rpc('log_user_session', {
          user_email_param: email
        });
      } catch (sessionError) {
        console.error("Failed to log session:", sessionError);
      }

      // Use window.location for full page navigation to properly trigger middleware
      const redirectTo = searchParams.get("redirectTo") || "/dashboard/generate";
      window.location.href = redirectTo;
    } catch (error) {
      console.error("Login error:", error);
      setErrorMessage("An unexpected error occurred");
      setIsLoading(false);
    }
  };

  const handleOAuthLogin = async (provider) => {
    setIsLoading(true);
    
    localStorage.setItem('rememberMe', rememberMe);
    if (rememberMe) {
      sessionStorage.setItem('activeSession', 'true');
    }
    
    try {
      const redirectTo = searchParams.get("redirectTo") || "/dashboard/generate";
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: provider,
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback?redirectTo=${redirectTo}`,
        },
      });

      if (error) {
        console.error("OAuth error:", error);
        toast.error(`Failed to sign in with ${provider}`);
        setIsLoading(false);
      }
    } catch (error) {
      console.error("OAuth error:", error);
      toast.error("An unexpected error occurred");
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[440px] bg-white rounded-3xl shadow-xl border border-slate-100 p-10">
      {/* Header */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mb-4">
          <Home className="w-6 h-6 text-indigo-600" />
        </div>
        <h1 className="text-3xl font-serif font-bold text-slate-900 mb-2">
          Welcome back
        </h1>
        <p className="text-slate-600 text-sm">
          Sign in to your dashboard
        </p>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-sm text-red-700">{errorMessage}</p>
        </div>
      )}

      {/* Social Login Buttons */}
      <div className="space-y-3 mb-6">
        <button
          type="button"
          onClick={() => handleOAuthLogin("google")}
          disabled={isLoading}
          className="w-full h-11 flex items-center justify-center gap-3 bg-white border border-slate-300 rounded-xl text-slate-700 font-medium hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FcGoogle className="w-5 h-5" />
          Continue with Google
        </button>
        <button
          type="button"
          onClick={() => handleOAuthLogin("apple")}
          disabled={isLoading}
          className="w-full h-11 flex items-center justify-center gap-3 bg-black text-white rounded-xl font-medium hover:bg-slate-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FaApple className="w-5 h-5" />
          Continue with Apple
        </button>
      </div>

      {/* Divider */}
      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-white text-slate-500">Or continue with email</span>
        </div>
      </div>

      {/* Email Form */}
      <form onSubmit={handleEmailLogin} className="space-y-4">
        {/* Email Input */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Email
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="email"
              placeholder="you@example.com"
              className="w-full h-11 pl-11 pr-4 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setErrorMessage("");
              }}
              disabled={isLoading}
              required
            />
          </div>
        </div>

        {/* Password Input */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="password"
              placeholder="Enter your password"
              className="w-full h-11 pl-11 pr-4 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setErrorMessage("");
              }}
              disabled={isLoading}
              required
            />
          </div>
        </div>

        {/* Remember Me Checkbox */}
        <div className="flex items-center">
          <input
            id="remember-me"
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            disabled={isLoading}
            className="w-4 h-4 text-indigo-600 bg-white border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <label htmlFor="remember-me" className="ml-2 text-sm text-slate-700">
            Remember me for 1 week
          </label>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="w-full h-12 bg-indigo-600 text-white font-semibold rounded-xl shadow-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Signing in...
            </>
          ) : (
            "Sign In"
          )}
        </button>
      </form>

      {/* Footer */}
      <div className="mt-6 text-center">
        <p className="text-sm text-slate-600">
          Don&apos;t have an account?{" "}
          <Link href="/auth/signup" className="text-indigo-600 hover:text-indigo-700 font-medium">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}

function LoginFormFallback() {
  return (
    <div className="w-full max-w-[440px] bg-white rounded-3xl shadow-xl border border-slate-100 p-10 flex items-center justify-center min-h-[500px]">
      <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="relative min-h-screen bg-slate-50 flex items-center justify-center px-4 overflow-hidden">
      {/* Background Blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-indigo-400/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-teal-400/20 rounded-full blur-3xl"></div>
      </div>

      {/* Login Form */}
      <div className="relative z-10">
        <Suspense fallback={<LoginFormFallback />}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
