/**
 * Generate MLS Data API Route
 *
 * Proxies requests to Python FastAPI backend for MLS field extraction.
 * Uses AI vision models (Gemini/GPT/Claude) to extract 22 MLS fields from photos.
 */

import { NextRequest, NextResponse } from "next/server";

// Route segment config - increase body size limit for base64 images
export const maxDuration = 120; // 120 seconds timeout for AI processing
export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.PYTHON_BACKEND_URL || "http://localhost:8000";

export interface MLSDataRequest {
  images: string[];
  address: string;
  model?: "gemini" | "gpt" | "claude";
}

export interface RoomData {
  room_type: string;
  level: string;
  length_ft?: number;
  width_ft?: number;
}

export interface MLSDataResponse {
  success: boolean;
  // High Confidence Fields
  property_type?: string;
  bedrooms?: number;
  bathrooms_full?: number;
  bathrooms_half?: number;
  stories?: number;
  garage_spaces?: number;
  flooring?: string[];
  appliances?: string[];
  exterior_material?: string;
  roof?: string;
  parking?: string[];
  interior_features?: string[];
  rooms?: RoomData[];
  // Moderate Confidence Fields
  year_built_estimate?: string;
  total_finished_sqft_estimate?: number;
  lot_size_estimate?: string;
  basement?: string;
  foundation?: string;
  water_source?: string;
  green_features?: string[];
  hoa_visible_amenities?: string[];
  // Metadata
  confidence_scores?: Record<string, string>;
  model_used?: string;
  processing_time_ms?: number;
  photos_analyzed?: number;
}

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
    if (!body.images || body.images.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "At least one image is required",
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

    // Default to gemini if no model specified
    const requestBody = {
      images: body.images,
      address: body.address,
      model: body.model || "gemini",
    };

    // Call Python backend
    const backendResponse = await fetch(`${BACKEND_URL}/api/generate-mls-data`, {
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

    const data: MLSDataResponse = await backendResponse.json();

    return NextResponse.json(data, {
      headers: {
        "X-Model-Used": data.model_used || "unknown",
        "X-Processing-Time": String(data.processing_time_ms || 0),
      },
    });
  } catch (error) {
    console.error("Generate MLS data error:", error);

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
