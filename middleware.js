import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";

export async function middleware(req) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  // Refresh session if expired
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Check if accessing protected routes
  const isProtectedRoute = req.nextUrl.pathname.startsWith("/dashboard");

  if (isProtectedRoute && !session) {
    // Redirect to login if not authenticated
    const redirectUrl = new URL("/auth/login", req.url);
    redirectUrl.searchParams.set("redirectTo", req.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Redirect authenticated users away from auth pages (except logout)
  const isAuthRoute = req.nextUrl.pathname.startsWith("/auth");
  if (isAuthRoute && session && !req.nextUrl.pathname.includes("/logout")) {
    return NextResponse.redirect(new URL("/dashboard/generate", req.url));
  }

  return res;
}

export const config = {
  matcher: ["/dashboard/:path*", "/auth/:path*"],
};
