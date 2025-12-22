/**
 * Credits API Route
 *
 * Domain-aware credit system for QuickList.
 * Handles credit balance checks and usage.
 *
 * GET: Get current credit balance (domain + personal)
 * POST: Use a credit (decrement, domain-first logic)
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Create authenticated Supabase client
async function getSupabaseClient() {
  const cookieStore = await cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase environment variables");
  }

  return createServerClient(url, key, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: Record<string, unknown>) {
        cookieStore.set({ name, value, ...options });
      },
      remove(name: string, options: Record<string, unknown>) {
        cookieStore.set({ name, value: "", ...options });
      },
    },
  });
}

// Create service role client for admin operations
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Missing Supabase service role key");
  }

  // Use dynamic import to avoid bundling issues
  const { createClient } = require("@supabase/supabase-js");
  return createClient(url, serviceKey);
}

// Helper to get authenticated user
async function getAuthenticatedUser(supabase: Awaited<ReturnType<typeof getSupabaseClient>>) {
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return { user: null, error: "Unauthorized - please log in" };
  }

  return { user, error: null };
}

interface CreditBalance {
  domain_credits: number;
  personal_credits: number;
  total_credits: number;
  domain: string | null;
}

interface CreditResult {
  success: boolean;
  source: "domain" | "personal" | null;
  remaining: number;
  message: string;
}

/**
 * GET /api/credits
 * Returns the user's credit balance (domain + personal)
 */
export async function GET() {
  try {
    const supabase = await getSupabaseClient();

    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (!user || !user.email) {
      return NextResponse.json(
        { success: false, error: authError || "No email found" },
        { status: 401 }
      );
    }

    // Use service client to call RPC (bypasses RLS for function call)
    const serviceClient = getServiceClient();

    const { data, error } = await serviceClient.rpc("get_credit_balance", {
      user_email: user.email,
    });

    if (error) {
      console.error("Error fetching credit balance:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    const balance = data as CreditBalance;

    return NextResponse.json({
      success: true,
      data: {
        domain_credits: balance.domain_credits,
        personal_credits: balance.personal_credits,
        total_credits: balance.total_credits,
        domain: balance.domain,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/credits:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch credits",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/credits
 * Uses a credit (domain-first, then personal)
 */
export async function POST() {
  try {
    const supabase = await getSupabaseClient();

    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (!user || !user.email) {
      return NextResponse.json(
        { success: false, error: authError || "No email found" },
        { status: 401 }
      );
    }

    // Use service client to call RPC
    const serviceClient = getServiceClient();

    const { data, error } = await serviceClient.rpc("check_and_decrement_credits", {
      user_email: user.email,
    });

    if (error) {
      console.error("Error using credit:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    const result = data as CreditResult;

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.message,
          data: {
            source: null,
            remaining: 0,
          },
        },
        { status: 402 } // Payment Required
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        source: result.source,
        remaining: result.remaining,
        message: result.message,
      },
    });
  } catch (error) {
    console.error("Error in POST /api/credits:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to use credit",
      },
      { status: 500 }
    );
  }
}
