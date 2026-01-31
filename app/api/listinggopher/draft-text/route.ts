/**
 * ListingGopher Draft Text API Route
 *
 * Generates draft text content based on uploaded documents and user prompt.
 * Calls Python backend for AI generation.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const maxDuration = 60; // 60 second timeout

const BACKEND_URL = process.env.PYTHON_BACKEND_URL || "http://localhost:8000";

// Create authenticated Supabase client
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

// Get service client for admin operations
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return null;
  }

  try {
    const { createClient } = require("@supabase/supabase-js");
    return createClient(url, serviceKey);
  } catch (error) {
    console.warn("Failed to create service client:", error);
    return null;
  }
}

// Get authenticated user
async function getAuthenticatedUser(supabase: Awaited<ReturnType<typeof getSupabaseClient>>) {
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return { user: null, error: "Unauthorized - please log in" };
  }

  return { user, error: null };
}

interface RequestBody {
  listingId: string;
  userPrompt: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseClient();

    // 1. Authenticate user
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "unauthorized", message: authError || "Please log in" },
        { status: 401 }
      );
    }

    // === LOGGING: API Called ===
    console.log('=== DRAFT TEXT API CALLED ===');
    console.log('User ID:', user.id);
    console.log('User Email:', user.email);

    // 2. Parse request body
    const body: RequestBody = await request.json();
    const { listingId, userPrompt } = body;

    // === LOGGING: Request body ===
    console.log('Request body:', { listingId, userPrompt: userPrompt?.substring(0, 100) });

    if (!userPrompt?.trim()) {
      return NextResponse.json(
        { success: false, error: "validation_error", message: "User prompt is required" },
        { status: 400 }
      );
    }

    // 3. Fetch documents for this listing (only if listingId provided)
    const serviceClient = getServiceClient();
    const client = serviceClient || supabase;
    let documentUrls: string[] = [];

    if (listingId) {
      const { data: documents, error: docsError } = await client
        .from("documents")
        .select("id, file_url, file_name, file_type")
        .eq("listing_id", listingId)
        .eq("user_id", user.id);

      if (docsError) {
        console.error("Error fetching documents:", docsError);
        // Don't fail - just proceed without documents
        console.warn("Proceeding without documents due to fetch error");
      } else {
        documentUrls = documents?.map((doc: { file_url: string }) => doc.file_url) || [];
      }

      // === LOGGING: Documents from database ===
      console.log('Documents from database:', {
        listingId,
        count: documents?.length || 0,
        documents: documents?.map((d: { id: string; file_name: string; file_url: string }) => ({
          id: d.id,
          file_name: d.file_name,
          file_url: d.file_url?.substring(0, 80) + '...'
        }))
      });
    }

    // Note: We allow generation even without documents - user might just want to draft text

    // 4. Call Python backend
    // === LOGGING: Before calling Python backend ===
    console.log('Calling Python backend:', {
      endpoint: `${BACKEND_URL}/generate/draft-text`,
      documentUrlsCount: documentUrls.length,
      documentUrls: documentUrls.map(u => u.substring(0, 80) + '...'),
      userPrompt: userPrompt?.substring(0, 100)
    });

    let backendResponse;
    try {
      backendResponse = await fetch(`${BACKEND_URL}/generate/draft-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_prompt: userPrompt,
          document_urls: documentUrls,
        }),
      });
    } catch (fetchError) {
      console.error("Backend connection error:", fetchError);
      return NextResponse.json(
        { success: false, error: "backend_unavailable", message: "Unable to connect to generation service" },
        { status: 503 }
      );
    }

    if (!backendResponse.ok) {
      const errorData = await backendResponse.json().catch(() => ({}));
      console.error("Backend error:", errorData);

      if (backendResponse.status === 504) {
        return NextResponse.json(
          { success: false, error: "generation_timeout", message: "Generation took too long" },
          { status: 504 }
        );
      }

      return NextResponse.json(
        { success: false, error: "backend_error", message: errorData.detail || "Generation failed" },
        { status: 502 }
      );
    }

    const result = await backendResponse.json();

    // === LOGGING: Python backend response ===
    console.log('Python backend response:', {
      success: backendResponse.ok,
      status: backendResponse.status,
      hasGeneratedText: !!(result.generated_text || result.text),
      textLength: (result.generated_text || result.text || '').length
    });

    // 5. Save to generated_content table
    if (listingId) {
      // === LOGGING: Before saving to generated_content ===
      console.log('Saving to generated_content:', {
        listing_id: listingId,
        user_id: user.id,
        tab_type: 'draft_text',
        has_content: !!(result.generated_text || result.text),
        content_length: (result.generated_text || result.text || '').length
      });

      const { error: insertError } = await client.from("generated_content").insert({
        listing_id: listingId,
        user_id: user.id,
        tab_type: "draft_text",
        user_prompt: userPrompt,
        generated_text: result.generated_text || result.text || "",
        ai_cost: result.ai_cost || 0,
      });

      if (insertError) {
        console.error("Error saving generated content:", insertError);
        // Don't fail the request - content was generated successfully
      }
    }

    // 6. Return response
    return NextResponse.json({
      success: true,
      generatedText: result.generated_text || result.text || "",
      aiCost: result.ai_cost || 0,
      tokenCount: result.token_count || 0,
    });

  } catch (error) {
    console.error("Draft text generation error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "internal_error",
        message: error instanceof Error ? error.message : "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
}
