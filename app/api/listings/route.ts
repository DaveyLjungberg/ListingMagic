/**
 * Listings API Route
 *
 * Handles saving and retrieving listings from Supabase.
 *
 * SECURITY: All operations validate user authentication server-side.
 * - POST: Creates listing owned by authenticated user
 * - PATCH: Only allows updates to user's own listings
 * - GET: Only returns user's own listings (enforced server-side)
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Create authenticated Supabase client that respects RLS
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

// Helper to get authenticated user or return error response
async function getAuthenticatedUser(supabase: Awaited<ReturnType<typeof getSupabaseClient>>) {
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return { user: null, error: "Unauthorized - please log in" };
  }

  return { user, error: null };
}

interface ListingData {
  listing_type: "descriptions" | "mls_data";
  property_address: string;
  address_json?: {
    street: string;
    city?: string;
    state?: string;
    zip_code: string;
  };
  property_type: string;
  bedrooms: number | null;
  bathrooms: number | null;
  public_remarks: string | null;
  walkthru_script: string | null;
  features: string | null;
  mls_data?: Record<string, unknown> | null;
  photo_urls: string[];
  ai_cost: number;
  generation_time: number;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseClient();

    // Get authenticated user server-side (don't trust client)
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (!user) {
      return NextResponse.json(
        { success: false, error: authError },
        { status: 401 }
      );
    }

    const body: ListingData = await request.json();

    // Validate required fields
    if (!body.property_address) {
      return NextResponse.json(
        { success: false, error: "Property address is required" },
        { status: 400 }
      );
    }

    // Insert with authenticated user's ID (server-validated, not client-provided)
    const { data, error } = await supabase
      .from("listings")
      .insert({
        user_id: user.id, // Use server-validated user ID
        listing_type: body.listing_type || "descriptions",
        property_address: body.property_address,
        address_json: body.address_json || null,
        property_type: body.property_type,
        bedrooms: body.bedrooms,
        bathrooms: body.bathrooms,
        public_remarks: body.public_remarks,
        walkthru_script: body.walkthru_script,
        features: body.features,
        mls_data: body.mls_data || null,
        photo_urls: body.photo_urls,
        ai_cost: body.ai_cost,
        generation_time: body.generation_time,
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      console.error("Error saving listing:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, id: data.id });
  } catch (error) {
    console.error("Error saving listing:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to save listing",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await getSupabaseClient();

    // Get authenticated user server-side
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (!user) {
      return NextResponse.json(
        { success: false, error: authError },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Listing ID is required" },
        { status: 400 }
      );
    }

    // Add updated_at timestamp
    const dataToUpdate = {
      ...updateData,
      updated_at: new Date().toISOString(),
    };

    // Update only if the listing belongs to this user (ownership check)
    const { data, error } = await supabase
      .from("listings")
      .update(dataToUpdate)
      .eq("id", id)
      .eq("user_id", user.id) // SECURITY: Only update own listings
      .select("id")
      .single();

    if (error) {
      // Check if it's a "no rows returned" error (user doesn't own this listing)
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { success: false, error: "Listing not found or access denied" },
          { status: 404 }
        );
      }
      console.error("Error updating listing:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, id: data.id });
  } catch (error) {
    console.error("Error updating listing:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update listing",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseClient();

    // Get authenticated user server-side
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (!user) {
      return NextResponse.json(
        { success: false, error: authError, data: [] },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const listingType = searchParams.get("listing_type");
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    // SECURITY: Always filter by authenticated user's ID (server-validated)
    // Don't accept user_id from query params - that's a security vulnerability
    let query = supabase
      .from("listings")
      .select("*")
      .eq("user_id", user.id) // Always filter to own listings
      .order("created_at", { ascending: false })
      .limit(limit);

    // Filter by listing_type if provided
    if (listingType) {
      query = query.eq("listing_type", listingType);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching listings:", error);
      return NextResponse.json(
        { success: false, error: error.message, data: [] },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Error fetching listings:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch listings",
        data: [],
      },
      { status: 500 }
    );
  }
}
