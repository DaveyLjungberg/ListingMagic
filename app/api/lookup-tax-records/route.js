import { NextResponse } from "next/server";

/**
 * POST /api/lookup-tax-records
 * Fetches property tax records from ATTOM Data API
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { address, city, state, zip } = body;

    // Validate required fields
    if (!address || !city || !state || !zip) {
      return NextResponse.json(
        { success: false, error: "Missing required address fields" },
        { status: 400 }
      );
    }

    // Check for API key
    const apiKey = process.env.ATTOM_API_KEY;
    if (!apiKey) {
      console.error("[ATTOM API] Missing ATTOM_API_KEY environment variable");
      return NextResponse.json(
        { success: false, error: "Tax record lookup not configured" },
        { status: 500 }
      );
    }

    // Build ATTOM API URL
    const address1 = encodeURIComponent(address);
    const address2 = encodeURIComponent(`${city}, ${state} ${zip}`);
    const url = `https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/address?address1=${address1}&address2=${address2}`;

    console.log("[ATTOM API] Fetching tax records for:", { address, city, state, zip });
    console.log("[ATTOM API] URL:", url);

    // Call ATTOM API
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
    const data = await response.json();
    console.log("[ATTOM API] Response data:", JSON.stringify(data, null, 2));

    // Extract property data (ATTOM returns array of properties)
    const property = data.property?.[0];
    if (!property) {
      console.log("[ATTOM API] No property data in response");
      return NextResponse.json(
        { success: false, error: "Property not found in tax records" },
        { status: 404 }
      );
    }

    // Extract relevant fields
    const taxData = {
      apn: property.identifier?.apn || property.identifier?.attomId || null,
      yearBuilt: property.summary?.yearbuilt || null,
      lotSize: formatLotSize(property.lot?.lotsize2, property.lot?.lotsize1),
      lotSizeRaw: property.lot?.lotsize2 || property.lot?.lotsize1 || null,
      lotSizeUnit: property.lot?.lotsize2 ? "sqft" : "acres",
      county: property.address?.county || null,
      legalDescription: property.lot?.legaldesc || null,
      zoning: property.summary?.zoning || null,
      // Additional useful fields
      bedrooms: property.building?.rooms?.beds || null,
      bathrooms: property.building?.rooms?.bathstotal || null,
      buildingSqft: property.building?.size?.bldgsize || null,
      propertyType: property.summary?.proptype || null,
      subdivision: property.address?.subdivision || null,
      taxAmount: property.assessment?.assessed?.assdttlvalue || null,
      taxYear: property.assessment?.tax?.taxyear || null,
    };

    console.log("[ATTOM API] Extracted tax data:", taxData);

    return NextResponse.json({
      success: true,
      data: taxData,
    });
  } catch (error) {
    console.error("[ATTOM API] Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch tax records" },
      { status: 500 }
    );
  }
}

/**
 * Format lot size for display
 */
function formatLotSize(sqft, acres) {
  if (sqft) {
    // Format square feet with commas
    const formatted = Number(sqft).toLocaleString();
    return `${formatted} sqft`;
  }
  if (acres) {
    return `${acres} acres`;
  }
  return null;
}
