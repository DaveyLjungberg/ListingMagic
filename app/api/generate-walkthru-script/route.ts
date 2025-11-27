/**
 * Generate Walk-thru Script API Route
 *
 * Proxies requests to Python FastAPI backend for video narration script generation.
 * Uses Claude Sonnet 4.5 for natural, conversational scripts.
 */

import { NextRequest, NextResponse } from "next/server";
import type { WalkthruScriptRequest, WalkthruScriptResponse, ErrorResponse } from "@/types/api";

const BACKEND_URL = process.env.PYTHON_BACKEND_URL || "http://localhost:8000";

export async function POST(request: NextRequest) {
  try {
    const body: WalkthruScriptRequest = await request.json();

    // Validate required fields
    if (!body.property_details?.address?.street) {
      return NextResponse.json(
        {
          success: false,
          error: "Street address is required",
          error_code: "VALIDATION_ERROR",
        } as ErrorResponse,
        { status: 400 }
      );
    }

    if (!body.property_details?.address?.zip_code) {
      return NextResponse.json(
        {
          success: false,
          error: "ZIP code is required",
          error_code: "VALIDATION_ERROR",
        } as ErrorResponse,
        { status: 400 }
      );
    }

    // Call Python backend
    const backendResponse = await fetch(`${BACKEND_URL}/api/generate-walkthru-script`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!backendResponse.ok) {
      const errorData = await backendResponse.json().catch(() => ({}));
      console.error("Backend error:", errorData);

      return NextResponse.json(
        {
          success: false,
          error: errorData.detail || "Failed to generate walk-thru script",
          error_code: "BACKEND_ERROR",
          details: errorData,
        } as ErrorResponse,
        { status: backendResponse.status }
      );
    }

    const data: WalkthruScriptResponse = await backendResponse.json();

    return NextResponse.json(data, {
      headers: {
        "X-Request-ID": data.request_id || "",
      },
    });
  } catch (error) {
    console.error("Generate walk-thru script error:", error);

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
