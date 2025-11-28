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
  MLSDataRequest,
  MLSDataResponse,
  MLSModel,
} from "@/types/api";

// =============================================================================
// Image Compression & Conversion
// =============================================================================

// Configuration for image compression
const IMAGE_CONFIG = {
  maxWidth: 1024,        // Max width in pixels
  maxHeight: 1024,       // Max height in pixels
  quality: 0.8,          // JPEG quality (0-1)
  maxImages: 5,          // Maximum number of images to process
  outputType: "image/jpeg" as const,
};

// High-quality config for MLS extraction (needs more detail)
const MLS_IMAGE_CONFIG = {
  maxWidth: 1920,        // Higher resolution for detail
  maxHeight: 1920,
  quality: 0.9,          // Higher quality
  maxImages: 10,         // More images for complete analysis
  outputType: "image/jpeg" as const,
};

/**
 * Load an image file into an HTMLImageElement
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${file.name}`));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Compress and resize an image using Canvas API
 * Returns base64 string (without data URL prefix)
 */
export async function compressImage(file: File, config = IMAGE_CONFIG): Promise<string> {
  const img = await loadImage(file);

  // Calculate new dimensions while maintaining aspect ratio
  let { width, height } = img;

  if (width > config.maxWidth || height > config.maxHeight) {
    const ratio = Math.min(
      config.maxWidth / width,
      config.maxHeight / height
    );
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  // Create canvas and draw resized image
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to get canvas context");
  }

  // Use better image smoothing for quality
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // Draw the image
  ctx.drawImage(img, 0, 0, width, height);

  // Clean up object URL
  URL.revokeObjectURL(img.src);

  // Convert to base64 JPEG
  const dataUrl = canvas.toDataURL(config.outputType, config.quality);

  // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
  const base64 = dataUrl.split(",")[1];

  console.log(
    `Compressed ${file.name}: ${(file.size / 1024).toFixed(0)}KB -> ${(base64.length * 0.75 / 1024).toFixed(0)}KB (${width}x${height})`
  );

  return base64;
}

/**
 * Convert a File to base64 string (with compression)
 */
export async function convertImageToBase64(file: File): Promise<string> {
  return compressImage(file);
}

/**
 * Convert PhotoData array to ImageInput array for API requests
 * Compresses images and limits to max 5 images
 */
export async function convertPhotosToImageInputs(
  photos: PhotoData[]
): Promise<ImageInput[]> {
  // Limit number of images
  const photosToProcess = photos.slice(0, IMAGE_CONFIG.maxImages);

  if (photos.length > IMAGE_CONFIG.maxImages) {
    console.warn(
      `Limiting to ${IMAGE_CONFIG.maxImages} images (${photos.length} provided)`
    );
  }

  const imageInputs: ImageInput[] = [];

  for (const photo of photosToProcess) {
    try {
      const base64 = await compressImage(photo.file);
      imageInputs.push({
        base64,
        filename: photo.name,
        content_type: IMAGE_CONFIG.outputType,
      });
    } catch (error) {
      console.error(`Failed to convert photo ${photo.name}:`, error);
    }
  }

  console.log(
    `Processed ${imageInputs.length} images, total payload: ${(
      imageInputs.reduce((sum, img) => sum + (img.base64?.length || 0), 0) * 0.75 / 1024 / 1024
    ).toFixed(2)}MB`
  );

  return imageInputs;
}

/**
 * Convert PhotoData array to high-quality base64 strings for MLS extraction
 * Uses higher resolution and quality settings for better AI analysis
 */
export async function convertPhotosForMLS(
  photos: PhotoData[]
): Promise<string[]> {
  // Limit number of images for MLS
  const photosToProcess = photos.slice(0, MLS_IMAGE_CONFIG.maxImages);

  if (photos.length > MLS_IMAGE_CONFIG.maxImages) {
    console.warn(
      `MLS: Limiting to ${MLS_IMAGE_CONFIG.maxImages} images (${photos.length} provided)`
    );
  }

  const images: string[] = [];

  for (const photo of photosToProcess) {
    try {
      const base64 = await compressImage(photo.file, MLS_IMAGE_CONFIG);
      images.push(base64);
    } catch (error) {
      console.error(`Failed to convert photo ${photo.name} for MLS:`, error);
    }
  }

  console.log(
    `MLS: Processed ${images.length} high-quality images, total payload: ${(
      images.reduce((sum, img) => sum + img.length, 0) * 0.75 / 1024 / 1024
    ).toFixed(2)}MB`
  );

  return images;
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

// =============================================================================
// MLS Data Extraction
// =============================================================================

/**
 * Extract MLS data from property photos using AI vision
 * Uses GPT-4.1 Vision by default for best accuracy
 * @param photos - Array of photo data with files
 * @param address - Full property address string
 * @param model - AI model to use: 'gpt' (default for best accuracy), 'gemini', or 'claude'
 */
export async function generateMLSData(
  photos: PhotoData[],
  address: string,
  model: MLSModel = "gpt"
): Promise<MLSDataResponse> {
  // Convert photos to high-quality base64 for MLS extraction
  const images = await convertPhotosForMLS(photos);

  if (images.length === 0) {
    throw new Error("No valid images provided");
  }

  const request: MLSDataRequest = {
    images,
    address,
    model,
  };

  const response = await fetch("/api/generate-mls-data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || "Failed to extract MLS data");
  }

  return data;
}

/**
 * Mock MLS data for testing
 */
export const MOCK_MLS_DATA: MLSDataResponse = {
  success: true,
  property_type: "Single Family",
  bedrooms: 4,
  bathrooms_full: 2,
  bathrooms_half: 1,
  stories: 2,
  garage_spaces: 2,
  flooring: ["Hardwood", "Carpet", "Tile"],
  appliances: ["Refrigerator", "Stove", "Dishwasher", "Microwave", "Washer", "Dryer"],
  exterior_material: "Vinyl Siding",
  roof: "Asphalt Shingle",
  parking: ["Attached Garage", "Paved Driveway"],
  interior_features: ["Fireplace", "Walk-in Closet", "Vaulted Ceilings", "Crown Molding"],
  rooms: [
    { room_type: "Master Bedroom", level: "Upper", length_ft: 14, width_ft: 12 },
    { room_type: "Kitchen", level: "Main", length_ft: 16, width_ft: 12 },
    { room_type: "Living Room", level: "Main", length_ft: 18, width_ft: 14 },
    { room_type: "Bedroom 2", level: "Upper", length_ft: 12, width_ft: 10 },
    { room_type: "Bedroom 3", level: "Upper", length_ft: 11, width_ft: 10 },
  ],
  year_built_estimate: "2000s",
  total_finished_sqft_estimate: 2400,
  lot_size_estimate: "0.25 acres",
  basement: "Yes",
  foundation: "Concrete Perimeter",
  water_source: "Public",
  green_features: ["Energy Star Windows"],
  hoa_visible_amenities: null,
  confidence_scores: {
    property_type: "high",
    bedrooms: "high",
    bathrooms_full: "high",
    flooring: "high",
    appliances: "high",
    year_built_estimate: "medium",
    total_finished_sqft_estimate: "medium",
    lot_size_estimate: "low",
  },
  model_used: "gemini",
  processing_time_ms: 3500,
  photos_analyzed: 8,
};

/**
 * Generate MLS data using mock data (for testing)
 */
export async function generateMLSDataMock(): Promise<MLSDataResponse> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 2500));
  return MOCK_MLS_DATA;
}
