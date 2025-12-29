import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// =============================================================================
// SUPABASE CLIENT
// =============================================================================

async function getSupabaseClient() {
  const cookieStore = await cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return null;
  }

  return createServerClient(url, key, {
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
  });
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Normalize address for comparison (uppercase, trimmed, collapsed whitespace)
 */
function normalizeAddress(street, city, state, zip) {
  const normalize = (s) => (s || "").trim().replace(/\s+/g, " ").toUpperCase();
  return {
    street: normalize(street),
    city: normalize(city),
    state: normalize(state),
    zip: (zip || "").trim(),
  };
}

/**
 * Check if two normalized addresses match
 */
function addressesMatch(addr1, addr2) {
  if (!addr1 || !addr2) return false;
  const n1 = normalizeAddress(addr1.street, addr1.city, addr1.state, addr1.zip_code || addr1.zip);
  const n2 = normalizeAddress(addr2.street, addr2.city, addr2.state, addr2.zip_code || addr2.zip);
  return n1.street === n2.street && n1.city === n2.city && n1.state === n2.state && n1.zip === n2.zip;
}

/**
 * Format lot size for display
 */
function formatLotSize(sqft, acres) {
  if (sqft) {
    const formatted = Number(sqft).toLocaleString();
    return `${formatted} sqft`;
  }
  if (acres) {
    return `${acres} acres`;
  }
  return null;
}

/**
 * Extract compact tax data from ATTOM response
 * Only the fields we need, in consistent formats
 */
function extractCompactTaxData(property) {
  const lotSizeRaw = property.lot?.lotsize2 || property.lot?.lotsize1 || null;
  const lotSizeUnit = property.lot?.lotsize2 ? "sqft" : "acres";

  return {
    apn: property.identifier?.apn || property.identifier?.attomId || null,
    yearBuilt: property.summary?.yearbuilt ? parseInt(property.summary.yearbuilt, 10) : null,
    lotSize: formatLotSize(property.lot?.lotsize2, property.lot?.lotsize1),
    lotSizeRaw: lotSizeRaw ? Number(lotSizeRaw) : null,
    lotSizeUnit,
    county: property.address?.county || null,
    // Additional fields from ATTOM
    bedrooms: property.building?.rooms?.beds || null,
    bathrooms: property.building?.rooms?.bathstotal || null,
    buildingSqft: property.building?.size?.bldgsize || null,
    propertyType: property.summary?.proptype || null,
    // Metadata
    fetchedAt: new Date().toISOString(),
  };
}

// =============================================================================
// POST /api/lookup-tax-records
// Fetches property tax records from ATTOM Data API
// Supports server-side caching via Supabase listings table
// =============================================================================

export async function POST(request) {
  try {
    const body = await request.json();
    const { address, city, state, zip, listingId } = body;

    // Validate required fields
    if (!address || !city || !state || !zip) {
      return NextResponse.json(
        { success: false, error: "Missing required address fields" },
        { status: 400 }
      );
    }

    const requestedAddress = { street: address, city, state, zip_code: zip };

    // =========================================================================
    // SERVER-SIDE CACHE CHECK: If listingId provided, check for existing tax data
    // =========================================================================
    if (listingId) {
      const supabase = await getSupabaseClient();
      if (supabase) {
        try {
          const { data: listing, error } = await supabase
            .from("listings")
            .select("address_json")
            .eq("id", listingId)
            .single();

          if (!error && listing?.address_json) {
            const storedAddress = listing.address_json;
            const storedTaxData = storedAddress.taxData;

            // Check if we have cached tax data AND the address matches
            if (storedTaxData && addressesMatch(storedAddress, requestedAddress)) {
              console.log("[ATTOM API] Using cached tax data from listing:", listingId);
              return NextResponse.json({
                success: true,
                data: storedTaxData,
                cached: true,
              });
            }
          }
        } catch (cacheError) {
          // Cache check failed, continue to ATTOM fetch
          console.warn("[ATTOM API] Cache check failed:", cacheError.message);
        }
      }
    }

    // =========================================================================
    // ATTOM API CALL
    // =========================================================================

    const apiKey = process.env.ATTOM_API_KEY;
    if (!apiKey) {
      console.error("[ATTOM API] Missing ATTOM_API_KEY environment variable");
      return NextResponse.json(
        { success: false, error: "Tax record lookup not configured" },
        { status: 500 }
      );
    }

    // Build ATTOM API URL - address2 should be "city, state" only (NO ZIP per ATTOM docs)
    const address1 = encodeURIComponent(address);
    const address2 = encodeURIComponent(`${city}, ${state}`);
    const url = `https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/detail?address1=${address1}&address2=${address2}`;

    console.log("[ATTOM API] Fetching tax records for:", { address, city, state, zip });

    const response = await fetch(url, {
      method: "GET",
      headers: {
        apikey: apiKey,
        accept: "application/json",
      },
    });

    console.log("[ATTOM API] Response status:", response.status);

    // Handle error responses
    if (!response.ok) {
      if (response.status === 401) {
        console.error("[ATTOM API] Invalid API key");
        return NextResponse.json(
          { success: false, error: "Invalid API key" },
          { status: 401 }
        );
      }
      if (response.status === 404) {
        console.log("[ATTOM API] Property not found");
        return NextResponse.json(
          { success: false, error: "Property not found in tax records" },
          { status: 404 }
        );
      }
      if (response.status === 429) {
        console.error("[ATTOM API] Rate limit exceeded");
        return NextResponse.json(
          { success: false, error: "Too many requests, please try again later" },
          { status: 429 }
        );
      }

      const errorText = await response.text();
      console.error("[ATTOM API] Error response:", errorText);
      return NextResponse.json(
        { success: false, error: "Failed to fetch tax records" },
        { status: response.status }
      );
    }

    // Parse successful response
    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      console.error("[ATTOM API] Failed to parse JSON response:", parseError);
      return NextResponse.json({
        success: true,
        data: {
          yearBuilt: null,
          lotSize: null,
          apn: null,
          county: null,
          note: "Partial success: Tax API returned invalid JSON",
        },
      });
    }

    // Extract property data (ATTOM returns array of properties)
    const property = data.property?.[0];
    if (!property) {
      console.log("[ATTOM API] No property data in response");
      return NextResponse.json(
        { success: false, error: "Property not found in tax records" },
        { status: 404 }
      );
    }

    // Extract compact tax data
    const taxData = extractCompactTaxData(property);
    console.log("[ATTOM API] Extracted tax data:", taxData);

    // =========================================================================
    // SERVER-SIDE CACHE STORE: Save tax data to listing if listingId provided
    // =========================================================================
    if (listingId) {
      const supabase = await getSupabaseClient();
      if (supabase) {
        try {
          // Get current address_json and merge with tax data
          const { data: listing, error: fetchError } = await supabase
            .from("listings")
            .select("address_json")
            .eq("id", listingId)
            .single();

          if (!fetchError && listing) {
            const updatedAddressJson = {
              ...listing.address_json,
              // Ensure address fields are current
              street: address,
              city,
              state,
              zip_code: zip,
              // Store tax data nested
              taxData,
            };

            const { error: updateError } = await supabase
              .from("listings")
              .update({ address_json: updatedAddressJson })
              .eq("id", listingId);

            if (updateError) {
              console.warn("[ATTOM API] Failed to cache tax data:", updateError.message);
            } else {
              console.log("[ATTOM API] Cached tax data to listing:", listingId);
            }
          }
        } catch (cacheError) {
          console.warn("[ATTOM API] Cache store failed:", cacheError.message);
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: taxData,
      cached: false,
    });
  } catch (error) {
    console.error("[ATTOM API] Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch tax records" },
      { status: 500 }
    );
  }
}
