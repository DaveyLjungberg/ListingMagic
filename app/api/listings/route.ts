/**
 * Listings API Route
 *
 * Handles saving and retrieving listings from Supabase.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Create Supabase admin client on demand (not at import time)
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

interface ListingData {
  user_id: string | null;
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
    const body: ListingData = await request.json();

    // Validate required fields
    if (!body.property_address) {
      return NextResponse.json(
        { success: false, error: "Property address is required" },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    const { data, error } = await supabaseAdmin
      .from("listings")
      .insert({
        user_id: body.user_id,
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

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const listingType = searchParams.get("listing_type");
    const userId = searchParams.get("user_id");
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    let query = supabaseAdmin
      .from("listings")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    // Filter by listing_type if provided
    if (listingType) {
      query = query.eq("listing_type", listingType);
    }

    // Filter by user_id if provided
    if (userId) {
      query = query.eq("user_id", userId);
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
