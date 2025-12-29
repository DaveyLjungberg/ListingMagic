"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/libs/supabase";
import { Loader2 } from "lucide-react";

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Log all URL parameters for debugging
        const allParams = {};
        searchParams.forEach((value, key) => {
          allParams[key] = value;
        });
        console.log("Callback URL params:", allParams);

        // Check for error from OAuth provider
        const errorParam = searchParams.get("error");
        const errorDescription = searchParams.get("error_description");
        if (errorParam) {
          console.error("OAuth error:", errorParam);
          console.error("Error description:", errorDescription);
          setError(`Authentication failed: ${errorDescription || errorParam}`);
          setTimeout(() => router.push("/auth/login?error=auth_failed"), 2000);
          return;
        }

        // Get the code from URL (Google sends this)
        const code = searchParams.get("code");
        console.log("OAuth code present:", !!code);
        
        if (code) {
          console.log("Attempting to exchange code for session...");
          // Exchange the code for a session
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          console.log("Exchange result:", { hasData: !!data, error: exchangeError });
          
          if (exchangeError) {
            console.error("Code exchange error:", exchangeError);
            setError("Failed to complete sign in");
            setTimeout(() => router.push("/auth/login?error=auth_failed"), 2000);
            return;
          }

          // Log user session for analytics
          if (data?.user?.email) {
            try {
              await supabase.rpc('log_user_session', {
                user_email_param: data.user.email
              });
            } catch (sessionError) {
              console.error("Failed to log session:", sessionError);
            }
          }

          const redirectTo = searchParams.get("redirectTo") || "/dashboard/generate";
          router.push(redirectTo);
        } else {
          // No code in URL - check if already authenticated
          const { data: { session } } = await supabase.auth.getSession();
          
          if (session) {
            const redirectTo = searchParams.get("redirectTo") || "/dashboard/generate";
            router.push(redirectTo);
          } else {
            setError("No authentication code received");
            setTimeout(() => router.push("/auth/login"), 2000);
          }
        }
      } catch (err) {
        console.error("Callback error:", err);
        setError("An unexpected error occurred");
        setTimeout(() => router.push("/auth/login?error=callback_failed"), 2000);
      }
    };

    handleCallback();
  }, [router, searchParams]);

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <p className="text-slate-600">
          {error || "Completing sign in..."}
        </p>
      </div>
    </main>
  );
}

export default function AuthCallback() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          <p className="text-slate-600">Loading...</p>
        </div>
      </main>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}
