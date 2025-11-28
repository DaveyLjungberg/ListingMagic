/**
 * Generate MLS Data from URLs API Route
 *
 * Proxies requests to Python FastAPI backend for MLS field extraction.
 * Uses photo URLs instead of base64 to bypass payload limits.
 */

import { NextRequest, NextResponse } from "next/server";

// Route segment config
export const maxDuration = 120; // 120 seconds timeout for AI processing
export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.PYTHON_BACKEND_URL || "http://localhost:8000";

export interface MLSDataURLsRequest {
  photo_urls: string[];
  address: string;
  model?: "gemini" | "gpt" | "claude";
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

    // Default to claude if no model specified
    const requestBody = {
      photo_urls: body.photo_urls,
      address: body.address,
      model: body.model || "claude",
    };

    console.log(`Sending ${body.photo_urls.length} photo URLs to backend for MLS extraction`);

    // Call Python backend
    const backendResponse = await fetch(`${BACKEND_URL}/api/generate-mls-data-urls`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

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
        "X-Model-Used": data.model_used || "unknown",
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
