import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const redirectTo = requestUrl.searchParams.get("redirectTo") || "/dashboard/generate";

  if (code) {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          get(name) {
            return cookieStore.get(name)?.value;
          },
          set(name, value, options) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name, options) {
            cookieStore.set({ name, value: "", ...options });
          },
        },
      }
    );

    // Exchange code for session
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("Auth callback error:", error);
      return NextResponse.redirect(new URL("/auth/login?error=auth_failed", request.url));
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

    // Redirect to dashboard
    return NextResponse.redirect(new URL(redirectTo, request.url));
  }

  // No code, redirect to login
  return NextResponse.redirect(new URL("/auth/login", request.url));
}
