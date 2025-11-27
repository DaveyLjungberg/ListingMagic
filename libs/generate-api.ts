/**
 * Listing Magic - Content Generation API Utilities
 *
 * Helper functions for interacting with the generation API endpoints.
 */

import type {
  PropertyDetails,
  PhotoData,
  ImageInput,
  AddressInput,
  PublicRemarksResponse,
  WalkthruScriptResponse,
  FeaturesResponse,
  PublicRemarksRequest,
  WalkthruScriptRequest,
  FeaturesRequest,
} from "@/types/api";

// =============================================================================
// Image Conversion
// =============================================================================

/**
 * Convert a File to base64 string
 */
export async function convertImageToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

/**
 * Convert PhotoData array to ImageInput array for API requests
 */
export async function convertPhotosToImageInputs(
  photos: PhotoData[]
): Promise<ImageInput[]> {
  const imageInputs: ImageInput[] = [];

  for (const photo of photos) {
    try {
      const base64 = await convertImageToBase64(photo.file);
      imageInputs.push({
        base64,
        filename: photo.name,
        content_type: photo.file.type,
      });
    } catch (error) {
      console.error(`Failed to convert photo ${photo.name}:`, error);
    }
  }

  return imageInputs;
}

// =============================================================================
// API Request Functions
// =============================================================================

/**
 * Generate public remarks (listing description)
 */
export async function generatePublicRemarks(
  propertyDetails: PropertyDetails
): Promise<PublicRemarksResponse> {
  const request: PublicRemarksRequest = {
    property_details: propertyDetails,
    max_words: 250,
    analyze_photos: true,
  };

  const response = await fetch("/api/generate-public-remarks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || "Failed to generate public remarks");
  }

  return data;
}

/**
 * Generate walk-thru script
 */
export async function generateWalkthruScript(
  propertyDetails: PropertyDetails,
  publicRemarks?: string
): Promise<WalkthruScriptResponse> {
  const request: WalkthruScriptRequest = {
    property_details: propertyDetails,
    duration_seconds: 120,
    style: "conversational",
    include_intro: true,
    include_outro: true,
    public_remarks: publicRemarks,
  };

  const response = await fetch("/api/generate-walkthru-script", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || "Failed to generate walk-thru script");
  }

  return data;
}

/**
 * Generate features list
 */
export async function generateFeatures(
  propertyDetails: PropertyDetails
): Promise<FeaturesResponse> {
  const request: FeaturesRequest = {
    property_details: propertyDetails,
    categorize: true,
    include_measurements: true,
    max_features: 30,
  };

  const response = await fetch("/api/generate-features", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || "Failed to generate features");
  }

  return data;
}

// =============================================================================
// Combined Generation
// =============================================================================

export interface GenerateAllResult {
  publicRemarks: PublicRemarksResponse | null;
  walkthruScript: WalkthruScriptResponse | null;
  features: FeaturesResponse | null;
  errors: {
    publicRemarks?: string;
    walkthruScript?: string;
    features?: string;
  };
}

/**
 * Generate all content in parallel
 */
export async function generateAllContent(
  photos: PhotoData[],
  address: AddressInput
): Promise<GenerateAllResult> {
  // Convert photos to base64
  const imageInputs = await convertPhotosToImageInputs(photos);

  // Build property details
  const propertyDetails: PropertyDetails = {
    address,
    photos: imageInputs,
    property_type: "single_family",
  };

  const result: GenerateAllResult = {
    publicRemarks: null,
    walkthruScript: null,
    features: null,
    errors: {},
  };

  // Run all three generations in parallel
  const [publicRemarksResult, walkthruResult, featuresResult] =
    await Promise.allSettled([
      generatePublicRemarks(propertyDetails),
      generateWalkthruScript(propertyDetails),
      generateFeatures(propertyDetails),
    ]);

  // Process public remarks result
  if (publicRemarksResult.status === "fulfilled") {
    result.publicRemarks = publicRemarksResult.value;
  } else {
    result.errors.publicRemarks =
      publicRemarksResult.reason?.message || "Failed to generate public remarks";
  }

  // Process walk-thru script result
  if (walkthruResult.status === "fulfilled") {
    result.walkthruScript = walkthruResult.value;
  } else {
    result.errors.walkthruScript =
      walkthruResult.reason?.message || "Failed to generate walk-thru script";
  }

  // Process features result
  if (featuresResult.status === "fulfilled") {
    result.features = featuresResult.value;
  } else {
    result.errors.features =
      featuresResult.reason?.message || "Failed to generate features";
  }

  return result;
}

// =============================================================================
// Mock Data for Testing
// =============================================================================

export const MOCK_PUBLIC_REMARKS: PublicRemarksResponse = {
  success: true,
  text: `Welcome to this stunning 4-bedroom, 3-bathroom residence nestled in the heart of a sought-after neighborhood. This meticulously maintained home offers over 2,400 square feet of thoughtfully designed living space, perfect for modern family life.

Step inside to discover an open-concept floor plan bathed in natural light, featuring soaring ceilings and elegant hardwood floors throughout the main level. The gourmet kitchen is a chef's dream, boasting granite countertops, stainless steel appliances, and a generous center island ideal for casual dining and entertaining.

The primary suite serves as a private retreat, complete with a spa-like ensuite bathroom and walk-in closet. Three additional bedrooms provide ample space for family, guests, or a home office. The landscaped backyard offers a peaceful outdoor oasis, perfect for relaxation or hosting gatherings.

Don't miss this exceptional opportunity to own a truly move-in ready home in a prime location!`,
  word_count: 152,
  photos_analyzed: 8,
  usage: {
    input_tokens: 1500,
    output_tokens: 350,
    total_tokens: 1850,
    cost_usd: 0.065,
    generation_time_ms: 3200,
    model_used: "gpt-4.1",
    provider: "openai",
    is_fallback: false,
  },
  generated_at: new Date().toISOString(),
  request_id: "mock_pr_001",
};

export const MOCK_WALKTHRU_SCRIPT: WalkthruScriptResponse = {
  success: true,
  script: `Welcome to your next home! Let me take you on a tour of this beautiful property.

[INTRO - 15 seconds]
As we approach, notice the stunning curb appeal with its manicured landscaping and inviting front porch. This home truly makes a wonderful first impression.

[LIVING AREA - 25 seconds]
Stepping through the front door, you're immediately greeted by soaring ceilings and an abundance of natural light. The open floor plan creates a seamless flow between the living, dining, and kitchen areas - perfect for both everyday living and entertaining.

[KITCHEN - 25 seconds]
The heart of the home is this gorgeous gourmet kitchen. You'll love the granite countertops, stainless steel appliances, and this generous center island. There's plenty of storage in these custom cabinetry and a walk-in pantry for all your culinary needs.

[PRIMARY SUITE - 20 seconds]
The primary suite is your private retreat. Notice the tray ceiling and large windows that flood the room with light. The ensuite bathroom features dual vanities, a soaking tub, and a separate walk-in shower.

[BACKYARD - 20 seconds]
And finally, step outside to your private backyard oasis. The covered patio is ideal for outdoor dining, and the landscaped yard offers plenty of space for relaxation or play.

[OUTRO - 15 seconds]
This exceptional home offers everything you've been looking for. Contact us today to schedule your private showing!`,
  word_count: 243,
  estimated_duration_seconds: 120,
  sections: [
    { name: "intro", content: "Welcome and curb appeal introduction" },
    { name: "living", content: "Living area tour" },
    { name: "kitchen", content: "Kitchen features" },
    { name: "primary", content: "Primary suite" },
    { name: "backyard", content: "Outdoor spaces" },
    { name: "outro", content: "Call to action" },
  ],
  usage: {
    input_tokens: 800,
    output_tokens: 450,
    total_tokens: 1250,
    cost_usd: 0.038,
    generation_time_ms: 2800,
    model_used: "claude-sonnet-4-20250514",
    provider: "anthropic",
    is_fallback: false,
  },
  generated_at: new Date().toISOString(),
  request_id: "mock_ws_001",
};

export const MOCK_FEATURES: FeaturesResponse = {
  success: true,
  features_list: [
    "4 bedrooms",
    "3 full bathrooms",
    "2,400 sq ft living space",
    "Open floor plan",
    "Hardwood floors throughout",
    "Granite countertops",
    "Stainless steel appliances",
    "Center island",
    "Walk-in pantry",
    "Primary suite with ensuite bath",
    "Dual vanities",
    "Soaking tub",
    "Walk-in closet",
    "Covered patio",
    "Landscaped backyard",
  ],
  categorized_features: [
    {
      name: "Interior Features",
      features: [
        "Open floor plan",
        "Hardwood floors throughout",
        "High ceilings",
        "Natural light",
      ],
    },
    {
      name: "Kitchen",
      features: [
        "Granite countertops",
        "Stainless steel appliances",
        "Center island",
        "Walk-in pantry",
        "Custom cabinetry",
      ],
    },
    {
      name: "Primary Suite",
      features: [
        "Ensuite bathroom",
        "Dual vanities",
        "Soaking tub",
        "Walk-in shower",
        "Walk-in closet",
        "Tray ceiling",
      ],
    },
    {
      name: "Outdoor",
      features: [
        "Covered patio",
        "Landscaped backyard",
        "Manicured front lawn",
        "Inviting front porch",
      ],
    },
  ],
  total_features: 15,
  usage: {
    input_tokens: 600,
    output_tokens: 250,
    total_tokens: 850,
    cost_usd: 0.012,
    generation_time_ms: 1500,
    model_used: "gemini-3-pro-latest",
    provider: "google",
    is_fallback: false,
  },
  generated_at: new Date().toISOString(),
  request_id: "mock_ft_001",
};

/**
 * Generate all content using mock data (for testing)
 */
export async function generateAllContentMock(): Promise<GenerateAllResult> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 2000));

  return {
    publicRemarks: MOCK_PUBLIC_REMARKS,
    walkthruScript: MOCK_WALKTHRU_SCRIPT,
    features: MOCK_FEATURES,
    errors: {},
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Format generation time for display
 */
export function formatGenerationTime(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Format cost for display
 */
export function formatCost(usd: number): string {
  if (usd < 0.01) {
    return `<$0.01`;
  }
  return `$${usd.toFixed(2)}`;
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error("Failed to copy to clipboard:", error);
    return false;
  }
}

/**
 * Check if an error is a rate limit error
 */
export function isRateLimitError(error: Error | string): boolean {
  const message = typeof error === "string" ? error : error.message;
  return (
    message.toLowerCase().includes("rate limit") ||
    message.toLowerCase().includes("429") ||
    message.toLowerCase().includes("too many requests") ||
    message.toLowerCase().includes("quota exceeded")
  );
}

/**
 * Get user-friendly error message
 */
export function getFriendlyErrorMessage(error: Error | string): string {
  const message = typeof error === "string" ? error : error.message;

  if (isRateLimitError(message)) {
    return "Rate limit hit. Please wait 1 minute and try again.";
  }

  if (message.toLowerCase().includes("connection") || message.toLowerCase().includes("network")) {
    return "Unable to connect to the server. Please check your connection.";
  }

  if (message.toLowerCase().includes("timeout")) {
    return "Request timed out. Please try again.";
  }

  return message;
}
