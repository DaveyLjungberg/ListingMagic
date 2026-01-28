/**
 * Extract MLS Data API Route (Unified Endpoint)
 *
 * Proxies requests to Python FastAPI backend for MLS field extraction.
 * Accepts either base64 images or photo URLs.
 * Model selection is handled by the backend.
 */

import { NextRequest, NextResponse } from "next/server";
import type { MLSDataRequest, MLSDataResponse } from "@/types/api";

// Route segment config
export const maxDuration = 300; // 5 minutes for MLS extraction
export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.PYTHON_BACKEND_URL || "http://localhost:8000";

export interface ErrorResponse {
  success: false;
  error: string;
  error_code: string;
  details?: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  try {
    const body: MLSDataRequest = await request.json();

    // Validate required fields
    const hasImages = body.images && body.images.length > 0;
    const hasPhotoUrls = body.photo_urls && body.photo_urls.length > 0;

    if (!hasImages && !hasPhotoUrls) {
      return NextResponse.json(
        {
          success: false,
          error: "Either images or photo_urls is required",
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

    // Determine which backend endpoint to use
    const backendEndpoint = hasPhotoUrls
      ? `${BACKEND_URL}/api/generate-mls-data-urls`
      : `${BACKEND_URL}/api/generate-mls-data`;

    // Build request body (backend decides model)
    const requestBody: Record<string, unknown> = {
      address: body.address,
    };

    if (hasPhotoUrls) {
      requestBody.photo_urls = body.photo_urls;
    } else {
      requestBody.images = body.images;
    }

    // Include tax data if provided
    if (body.tax_data) {
      requestBody.tax_data = body.tax_data;
    }

    const photoCount = hasPhotoUrls ? body.photo_urls!.length : body.images!.length;
    console.log(`[extract-mls-data] Extracting MLS data from ${photoCount} ${hasPhotoUrls ? 'URLs' : 'images'}`);

    // Call Python backend
    const backendResponse = await fetch(backendEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!backendResponse.ok) {
      const errorData = await backendResponse.json().catch(() => ({}));
      console.error("[extract-mls-data] Backend error:", errorData);

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

    const data: MLSDataResponse = await backendResponse.json();

    return NextResponse.json(data, {
      headers: {
        "X-Processing-Time": String(data.processing_time_ms || 0),
        "X-Photos-Analyzed": String(data.photos_analyzed || 0),
      },
    });
  } catch (error) {
    console.error("[extract-mls-data] Error:", error);

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



