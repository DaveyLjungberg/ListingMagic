/**
 * Generate MLS Data from URLs API Route (Legacy)
 *
 * This route is maintained for backwards compatibility.
 * New code should use /api/extract-mls-data instead.
 * 
 * Proxies requests to the unified extraction endpoint.
 * Backend automatically selects the optimal AI model for MLS field extraction.
 */

import { NextRequest, NextResponse } from "next/server";

// Route segment config
export const maxDuration = 300; // 5 minutes timeout for AI processing
export const dynamic = "force-dynamic";

export interface MLSDataURLsRequest {
  photo_urls: string[];
  address: string;
  tax_data?: {
    apn?: string;
    yearBuilt?: string;
    lotSize?: string;
    county?: string;
  };
}

export interface ErrorResponse {
  success: false;
  error: string;
  error_code: string;
  details?: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  try {
    const body: MLSDataURLsRequest = await request.json();

    // Validate required fields
    if (!body.photo_urls || body.photo_urls.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "At least one photo URL is required",
          error_code: "VALIDATION_ERROR",
        } as ErrorResponse,
        { status: 400 }
      );
    }

    if (!body.address) {
      return NextResponse.json(
        {
          success: false,
          error: "Property address is required",
          error_code: "VALIDATION_ERROR",
        } as ErrorResponse,
        { status: 400 }
      );
    }

    console.log(`[generate-mls-data-urls] Forwarding ${body.photo_urls.length} photo URLs to unified endpoint`);

    // Forward to unified extraction endpoint (model-agnostic)
    const unifiedResponse = await fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/extract-mls-data`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          photo_urls: body.photo_urls,
          address: body.address,
          tax_data: body.tax_data,
        }),
      }
    );

    const backendResponse = unifiedResponse;

    if (!backendResponse.ok) {
      const errorData = await backendResponse.json().catch(() => ({}));
      console.error("Backend error:", errorData);

      return NextResponse.json(
        {
          success: false,
          error: errorData.detail || "Failed to extract MLS data",
          error_code: "BACKEND_ERROR",
          details: errorData,
        } as ErrorResponse,
        { status: backendResponse.status }
      );
    }

    const data = await backendResponse.json();

    return NextResponse.json(data, {
      headers: {
        "X-Request-ID": data.request_id || "",
        "X-Processing-Time": String(data.processing_time_ms || 0),
        "X-Photos-Analyzed": String(data.photos_analyzed || 0),
      },
    });
  } catch (error) {
    console.error("Generate MLS data from URLs error:", error);

    // Check if it's a connection error
    if (error instanceof TypeError && error.message.includes("fetch")) {
      return NextResponse.json(
        {
          success: false,
          error: "Unable to connect to backend service. Please ensure the Python server is running.",
          error_code: "CONNECTION_ERROR",
        } as ErrorResponse,
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "An unexpected error occurred",
        error_code: "INTERNAL_ERROR",
      } as ErrorResponse,
      { status: 500 }
    );
  }
}
