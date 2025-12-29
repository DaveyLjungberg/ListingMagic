/**
 * Add Credits API Route
 *
 * For internal use by Stripe webhook or admin operations.
 * Requires service role authentication (not user auth).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Verify the request is from a trusted source
function verifyInternalRequest(request: NextRequest): boolean {
  const authHeader = request.headers.get("x-internal-secret");
  const expectedSecret = process.env.INTERNAL_API_SECRET;

  // If no secret configured, deny all requests
  if (!expectedSecret) {
    console.warn("INTERNAL_API_SECRET not configured");
    return false;
  }

  return authHeader === expectedSecret;
}

// Create service role client
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Missing Supabase service role key");
  }

  return createClient(url, serviceKey);
}

interface AddCreditsRequest {
  owner: string; // Email or domain
  amount: number;
}

/**
 * POST /api/credits/add
 * Add credits to an email or domain
 *
 * Headers:
 *   x-internal-secret: INTERNAL_API_SECRET
 *
 * Body:
 *   { owner: "john@example.com", amount: 10 }  // Personal credits
 *   { owner: "example.com", amount: 50 }       // Team/domain credits
 */
export async function POST(request: NextRequest) {
  try {
    // Verify internal authentication
    if (!verifyInternalRequest(request)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body: AddCreditsRequest = await request.json();

    // Validate input
    if (!body.owner || typeof body.owner !== "string") {
      return NextResponse.json(
        { success: false, error: "Owner (email or domain) is required" },
        { status: 400 }
      );
    }

    if (!body.amount || typeof body.amount !== "number" || body.amount <= 0) {
      return NextResponse.json(
        { success: false, error: "Amount must be a positive number" },
        { status: 400 }
      );
    }

    const serviceClient = getServiceClient();

    const { data, error } = await serviceClient.rpc("add_credits", {
      owner: body.owner,
      amount: body.amount,
    });

    if (error) {
      console.error("Error adding credits:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    console.log(`Credits added: ${body.amount} to ${body.owner}`, data);

    return NextResponse.json({
      success: true,
      data: {
        owner: data.owner,
        credits_added: data.credits_added,
        new_balance: data.new_balance,
      },
    });
  } catch (error) {
    console.error("Error in POST /api/credits/add:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to add credits",
      },
      { status: 500 }
    );
  }
}
