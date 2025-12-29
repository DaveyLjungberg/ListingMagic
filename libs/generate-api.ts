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
} from "@/types/api";
import { uploadPhotosToStorage } from "./supabase-storage-upload";
import {
  selectPhotosIntelligently,
  categorizePhotos,
  selectBestPhotos,
  orderPhotosForWalkthrough,
  type PhotoCategory,
} from "./photo-selection";
// ElevenLabs voiceover removed - videos are now silent
import { logger } from "./logger";

// Re-export photo selection utilities
export {
  selectPhotosIntelligently,
  categorizePhotos,
  selectBestPhotos,
  orderPhotosForWalkthrough,
  type PhotoCategory,
};

// =============================================================================
// Image Compression & Conversion
// =============================================================================

// Configuration for image compression
const IMAGE_CONFIG = {
  maxWidth: 1024,        // Max width in pixels
  maxHeight: 1024,       // Max height in pixels
  quality: 0.8,          // JPEG quality (0-1)
  maxImages: 20,         // Maximum number of images to process (matches backend VISION_CONFIG)
  outputType: "image/jpeg" as const,
};

// MLS extraction config - Claude can handle many photos efficiently
const MLS_IMAGE_CONFIG = {
  maxWidth: 1024,        // Balanced resolution for Claude
  maxHeight: 1024,
  quality: 0.8,          // Good quality while keeping payload reasonable
  maxImages: 50,         // Claude handles many photos well - allow up to 50
  outputType: "image/jpeg" as const,
};

/**
 * Load an image from a File object into an HTMLImageElement
 * Returns both the image and its object URL for proper cleanup
 */
function loadImageFromFile(file: File): Promise<{ img: HTMLImageElement; objectUrl: string }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, objectUrl });
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl); // Clean up on error
      reject(new Error(`Failed to load image: ${file.name}`));
    };
    img.src = objectUrl;
  });
}

/**
 * Load an image from a URL into an HTMLImageElement
 */
function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // Required for canvas operations on external images
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image from URL: ${url}`));
    img.src = url;
  });
}

/**
 * Compress and resize an image using Canvas API
 * Returns base64 string (without data URL prefix)
 */
export async function compressImage(file: File, config = IMAGE_CONFIG): Promise<string> {
  const { img, objectUrl } = await loadImageFromFile(file);

  try {
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

    // Convert to base64 JPEG
    const dataUrl = canvas.toDataURL(config.outputType, config.quality);

    // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
    const base64 = dataUrl.split(",")[1];

    logger.debug(
      `Compressed ${file.name}: ${(file.size / 1024).toFixed(0)}KB -> ${(base64.length * 0.75 / 1024).toFixed(0)}KB (${width}x${height})`
    );

    return base64;
  } finally {
    // Always clean up object URL, even if an error occurred
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Compress an image from URL using Canvas API
 * Returns base64 string (without data URL prefix)
 */
export async function compressImageFromUrl(url: string, config = IMAGE_CONFIG): Promise<string> {
  const img = await loadImageFromUrl(url);

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

  // Convert to base64 JPEG
  const dataUrl = canvas.toDataURL(config.outputType, config.quality);

  // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
  const base64 = dataUrl.split(",")[1];

  // Extract filename from URL for logging
  const filename = url.split('/').pop() || 'url-image';
  logger.debug(
    `Compressed URL image ${filename}: -> ${(base64.length * 0.75 / 1024).toFixed(0)}KB (${width}x${height})`
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
 * Get the URL for a photo (handles both File objects and URL strings)
 */
function getPhotoUrl(photo: PhotoData): string | null {
  // If photo has a preview URL (from loaded listings or fresh uploads)
  if (photo.preview && typeof photo.preview === 'string') {
    return photo.preview;
  }
  // If photo has a url property
  if ((photo as { url?: string }).url) {
    return (photo as { url?: string }).url!;
  }
  return null;
}

/**
 * Convert PhotoData array to ImageInput array for API requests
 * Uses intelligent photo selection when more than maxImages are provided
 * Handles both File objects (fresh uploads) and URLs (loaded listings)
 * @param onProgress - Optional callback (current, total) called after each photo is processed
 */
export async function convertPhotosToImageInputs(
  photos: PhotoData[],
  photoUrls?: string[], // Optional: pre-uploaded URLs for intelligent selection
  onProgress?: (current: number, total: number) => void
): Promise<ImageInput[]> {
  // If we have more photos than the limit and have URLs, use intelligent selection
  if (photos.length > IMAGE_CONFIG.maxImages && photoUrls && photoUrls.length > 0) {
    console.log(
      `[convertPhotosToImageInputs] ${photos.length} photos > ${IMAGE_CONFIG.maxImages} limit - using intelligent selection`
    );

    try {
      // Use intelligent selection to pick the best photos
      const { selectedUrls, categories } = await selectPhotosIntelligently(
        photoUrls,
        IMAGE_CONFIG.maxImages
      );

      // Get the indices of selected photos
      const selectedIndices = new Set(
        categories.map((cat) => cat.index)
      );

      // Filter photos to only the selected ones
      const selectedPhotos = photos.filter((_, index) => selectedIndices.has(index));

      console.log(
        `[convertPhotosToImageInputs] Intelligent selection chose ${selectedPhotos.length} photos from ${photos.length}`
      );

      // Process only the selected photos
      return await processPhotosToImageInputs(selectedPhotos, selectedUrls, onProgress);
    } catch (error) {
      console.error("[convertPhotosToImageInputs] Intelligent selection failed, falling back to first N:", error);
      // Fall through to standard processing
    }
  }

  // Standard processing (for <= maxImages or when intelligent selection fails)
  const photosToProcess = photos.slice(0, IMAGE_CONFIG.maxImages);

  if (photos.length > IMAGE_CONFIG.maxImages) {
    console.warn(
      `Limiting to ${IMAGE_CONFIG.maxImages} images (${photos.length} provided) - no URLs available for intelligent selection`
    );
  }

  return await processPhotosToImageInputs(photosToProcess, undefined, onProgress);
}

/**
 * Internal function to process photos to ImageInput array
 */
async function processPhotosToImageInputs(
  photos: PhotoData[],
  selectedUrls?: string[],
  onProgress?: (current: number, total: number) => void
): Promise<ImageInput[]> {
  const imageInputs: ImageInput[] = [];
  const totalPhotos = photos.length;

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    try {
      let base64: string;

      // Check if we have a File object (fresh upload)
      if (photo.file && photo.file instanceof File) {
        base64 = await compressImage(photo.file);
      }
      // Otherwise try to use the URL (from selectedUrls or photo object)
      else {
        const url = selectedUrls?.[i] || getPhotoUrl(photo);
        if (url && url.startsWith('http')) {
          base64 = await compressImageFromUrl(url);
        } else {
          console.error(`Photo ${photo.name} has no valid file or URL`);
          continue;
        }
      }

      imageInputs.push({
        base64,
        filename: photo.name,
        content_type: IMAGE_CONFIG.outputType,
      });
      
      // Call progress callback after each photo is processed
      if (onProgress) {
        onProgress(i + 1, totalPhotos);
      }
    } catch (error) {
      console.error(`Failed to convert photo ${photo.name}:`, error);
    }
  }

  logger.debug(
    `Processed ${imageInputs.length} images, total payload: ${(
      imageInputs.reduce((sum, img) => sum + (img.base64?.length || 0), 0) * 0.75 / 1024 / 1024
    ).toFixed(2)}MB`
  );

  return imageInputs;
}

/**
 * Convert PhotoData array to high-quality base64 strings for MLS extraction
 * Uses higher resolution and quality settings for better AI analysis
 * Handles both File objects (fresh uploads) and URLs (loaded listings)
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
      let base64: string;

      // Check if we have a File object (fresh upload)
      if (photo.file && photo.file instanceof File) {
        base64 = await compressImage(photo.file, MLS_IMAGE_CONFIG);
      }
      // Otherwise try to use the URL (loaded from database)
      else {
        const url = getPhotoUrl(photo);
        if (url && url.startsWith('http')) {
          base64 = await compressImageFromUrl(url, MLS_IMAGE_CONFIG);
        } else {
          console.error(`Photo ${photo.name} has no valid file or URL for MLS`);
          continue;
        }
      }

      images.push(base64);
    } catch (error) {
      console.error(`Failed to convert photo ${photo.name} for MLS:`, error);
    }
  }

  logger.debug(
    `MLS: Processed ${images.length} high-quality images, total payload: ${(
      images.reduce((sum, img) => sum + img.length, 0) * 0.75 / 1024 / 1024
    ).toFixed(2)}MB`
  );

  return images;
}

// =============================================================================
// API Request Functions
// =============================================================================

// Timeout configuration for different API calls
const API_TIMEOUTS = {
  generation: 300000,    // 5 minutes for AI generation (increased from 2 min)
  mlsExtraction: 300000, // 5 minutes for MLS extraction (many photos)
  videoGeneration: 600000, // 10 minutes for video generation
  default: 120000,       // 2 minutes default (increased from 1 min)
};

/**
 * Fetch with timeout and abort controller
 * Throws error if request takes longer than specified timeout
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = API_TIMEOUTS.default
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs / 1000} seconds`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Safely parse JSON response, handling non-JSON error responses
 * Prevents "Unexpected token <" errors when backend returns HTML/plain text
 * @param response - Fetch Response object
 * @returns Parsed JSON object
 * @throws Error with snippet of non-JSON response
 */
async function parseJsonResponse<T>(response: Response): Promise<T> {
  const responseText = await response.text();
  
  // Handle empty response
  if (!responseText || responseText.trim() === '') {
    throw new Error(`Server error (${response.status}): Empty response`);
  }
  
  // Try to parse as JSON
  try {
    return JSON.parse(responseText) as T;
  } catch (parseError) {
    // Backend returned non-JSON (likely HTML error page or plain text)
    const snippet = responseText.substring(0, 200);
    throw new Error(
      `Server error (${response.status}): ${snippet}${responseText.length > 200 ? '...' : ''}`
    );
  }
}

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

  const response = await fetchWithTimeout(
    "/api/generate-public-remarks",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    },
    API_TIMEOUTS.generation
  );

  // Use safe JSON parsing helper - response could be success or error type
  const data = await parseJsonResponse<PublicRemarksResponse | { success: false; error: string }>(response);

  if (!response.ok || !data.success) {
    const errorMessage = 'error' in data ? data.error : "Failed to generate public remarks";
    throw new Error(errorMessage);
  }

  return data as PublicRemarksResponse;
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

  const response = await fetchWithTimeout(
    "/api/generate-features",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    },
    API_TIMEOUTS.generation
  );

  // Use safe JSON parsing helper - response could be success or error type
  const data = await parseJsonResponse<FeaturesResponse | { success: false; error: string }>(response);

  if (!response.ok || !data.success) {
    const errorMessage = 'error' in data ? data.error : "Failed to generate features";
    throw new Error(errorMessage);
  }

  return data as FeaturesResponse;
}

// =============================================================================
// Combined Generation
// =============================================================================

export interface GenerateAllResult {
  publicRemarks: PublicRemarksResponse | null;
  features: FeaturesResponse | null;
  errors: {
    publicRemarks?: string;
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
    features: null,
    errors: {},
  };

  // Run all generations in parallel
  const [publicRemarksResult, featuresResult] =
    await Promise.allSettled([
      generatePublicRemarks(propertyDetails),
      generateFeatures(propertyDetails),
    ]);

  // Process public remarks result
  if (publicRemarksResult.status === "fulfilled") {
    result.publicRemarks = publicRemarksResult.value;
  } else {
    result.errors.publicRemarks =
      publicRemarksResult.reason?.message || "Failed to generate public remarks";
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
 * Backend selects the optimal model automatically
 * @param photos - Array of photo data with files
 * @param address - Full property address string
 */
export async function generateMLSData(
  photos: PhotoData[],
  address: string
): Promise<MLSDataResponse> {
  // Convert photos to base64 for MLS extraction
  const images = await convertPhotosForMLS(photos);

  if (images.length === 0) {
    throw new Error("No valid images provided");
  }

  const request: MLSDataRequest = {
    images,
    address,
  };

  const response = await fetchWithTimeout(
    "/api/extract-mls-data",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    },
    API_TIMEOUTS.mlsExtraction
  );

  const data = await parseJsonResponse<MLSDataResponse | { success: false; error: string }>(response);

  if (!response.ok || !data.success) {
    const errorMessage = 'error' in data ? data.error : "Failed to extract MLS data";
    throw new Error(errorMessage);
  }

  return data as MLSDataResponse;
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

// =============================================================================
// MLS Data Extraction with Supabase Storage (URL-based)
// =============================================================================

/**
 * Generate MLS data from photo URLs (bypasses payload limits)
 * Backend selects the optimal model automatically
 * @param photoUrls - Array of public URLs to photos in Supabase Storage
 * @param address - Full property address string
 */
export async function generateMLSDataFromURLs(
  photoUrls: string[],
  address: string
): Promise<MLSDataResponse> {
  logger.debug(`Generating MLS data from ${photoUrls.length} photo URLs`);

  const response = await fetchWithTimeout(
    "/api/extract-mls-data",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        photo_urls: photoUrls,
        address: address,
      }),
    },
    API_TIMEOUTS.mlsExtraction
  );

  const data = await parseJsonResponse<MLSDataResponse | { success: false; error: string }>(response);

  if (!response.ok || !data.success) {
    const errorMessage = 'error' in data ? data.error : "Failed to extract MLS data from URLs";
    throw new Error(errorMessage);
  }

  return data as MLSDataResponse;
}

/**
 * Tax data from ATTOM API lookup
 */
export interface TaxData {
  apn?: string;
  yearBuilt?: string;
  lotSize?: string;
  county?: string;
}

/**
 * Generate MLS data with Supabase Storage upload
 * Uploads photos to storage first, then sends URLs directly to backend
 * This bypasses Vercel's 4.5MB payload limit
 * Backend selects the optimal model automatically
 * @param photos - Array of photo data with files
 * @param address - Full property address string
 * @param userId - User ID for storage path
 * @param onProgress - Optional callback for progress updates
 * @param taxData - Optional tax data from ATTOM API to override AI estimates
 * @param existingUrls - Optional: use existing URLs instead of uploading
 */
export async function generateMLSDataWithStorage(
  photos: PhotoData[],
  address: string,
  userId: string,
  onProgress?: (message: string) => void,
  taxData?: TaxData,
  existingUrls?: string[]
): Promise<{ mlsData: MLSDataResponse; photoUrls: string[] }> {
  try {
    let photoUrls: string[];

    // If existing URLs are provided (e.g., from Descriptions tab), use those instead of uploading
    if (existingUrls && existingUrls.length > 0 && photos.length === 0) {
      logger.debug("[generateMLSDataWithStorage] Using existing photo URLs:", existingUrls.length);
      photoUrls = existingUrls;
      onProgress?.(`Using ${photoUrls.length} existing photos. Analyzing...`);
    } else {
      // Step 1: Upload photos to Supabase Storage
      onProgress?.("Uploading photos to storage...");
      const { urls: uploadedUrls, errors } = await uploadPhotosToStorage(photos, userId);

      if (errors.length > 0) {
        console.warn(`${errors.length} photos failed to upload:`, errors);
      }

      if (uploadedUrls.length === 0) {
        throw new Error("No photos were successfully uploaded");
      }

      photoUrls = uploadedUrls;
      onProgress?.(`${photoUrls.length} photos uploaded. Analyzing...`);
    }

    // Step 2: Call Next.js API route (model-agnostic)
    logger.debug("[generateMLSDataWithStorage] Sending tax_data:", taxData);

    const requestBody: MLSDataRequest = {
      photo_urls: photoUrls,
      address,
      tax_data: taxData,
    };
    logger.debug("[generateMLSDataWithStorage] Request body:", JSON.stringify(requestBody, null, 2));

    const response = await fetchWithTimeout(
      "/api/extract-mls-data",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      },
      API_TIMEOUTS.mlsExtraction
    );

    const mlsData = await parseJsonResponse<MLSDataResponse | { success: false; error: string }>(response);
    
    if (!response.ok || !mlsData.success) {
      const errorMessage = 'error' in mlsData ? mlsData.error : "Failed to generate MLS data";
      throw new Error(errorMessage);
    }
    
    logger.debug("[generateMLSDataWithStorage] Response from backend:", mlsData);
    logger.debug("[generateMLSDataWithStorage] tax_data_applied:", (mlsData as MLSDataResponse).tax_data_applied);

    return {
      mlsData: mlsData as MLSDataResponse,
      photoUrls,
    };
  } catch (error) {
    console.error("Error in generateMLSDataWithStorage:", error);
    throw error;
  }
}

// =============================================================================
// Video Generation (Silent - No Voiceover)
// =============================================================================

/**
 * Video generation response from backend
 */
export interface VideoGenerationResponse {
  success: boolean;
  video_url: string;
  script_url?: string;
  has_voiceover: boolean; // Always false - videos are silent
  duration_seconds: number;
  processing_time_seconds: number;
  photos_used: number;
}

/**
 * Generate silent walkthrough video from photos
 * @param photoUrls - Array of public URLs to photos
 * @param listingId - Listing ID for storage path
 * @param secondsPerPhoto - Duration per photo (default 4.0)
 * @param onProgress - Optional callback for progress updates
 */
export async function generateWalkthroughVideo(
  photoUrls: string[],
  listingId: string,
  secondsPerPhoto: number = 4.0,
  onProgress?: (message: string) => void
): Promise<VideoGenerationResponse> {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "https://listingmagic-production.up.railway.app";

    onProgress?.("Preparing video generation...");

    // Fair Housing-safe placeholder script for silent video (backend requires script field)
    const placeholderScript = "This property walkthrough video showcases the home's features through a visual tour of professionally photographed spaces.";

    const response = await fetchWithTimeout(
      `${backendUrl}/api/generate-video`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          script: placeholderScript,
          photo_urls: photoUrls,
          listing_id: listingId,
          seconds_per_photo: secondsPerPhoto,
        }),
      },
      API_TIMEOUTS.videoGeneration
    );

    const result = await parseJsonResponse<VideoGenerationResponse | { success: false; error: string }>(response);

    if (!response.ok || !result.success) {
      const errorMessage = 'error' in result ? result.error : "Failed to generate video";
      throw new Error(errorMessage);
    }

    return result as VideoGenerationResponse;
  } catch (error) {
    console.error("Error in generateWalkthroughVideo:", error);
    throw error;
  }
}

// =============================================================================
// Content Refinement with Fair Housing Compliance
// =============================================================================

/**
 * Conversation message for refinement history
 */
export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Compliance violation details
 */
export interface ComplianceViolation {
  category: string;
  matches: string[];
  severity: string;
  suggestion: string;
}

/**
 * Response from content refinement endpoint
 */
export interface RefineContentResponse {
  success: boolean;
  refined_content?: string;
  error?: string;
  error_type?: string;
  violations?: ComplianceViolation[];
  message?: string;
  processing_time_ms: number;
}

/**
 * Property data for refinement context
 */
export interface PropertyDataForRefinement {
  address?: {
    full_address?: string;
  };
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
  price?: number;
}

/**
 * Refine existing content with targeted AI edits
 * Includes Fair Housing compliance validation
 *
 * @param contentType - Type of content: 'remarks', 'features', or 'script'
 * @param currentContent - The current content to refine
 * @param userInstruction - What the user wants to change
 * @param conversationHistory - Previous refinement conversation
 * @param propertyData - Property context for reference
 */
export async function refineContent(
  contentType: "remarks" | "features" | "script",
  currentContent: string,
  userInstruction: string,
  conversationHistory: ConversationMessage[] = [],
  propertyData?: PropertyDataForRefinement
): Promise<RefineContentResponse> {
  try {
    const backendUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      "https://listingmagic-production.up.railway.app";

    const response = await fetchWithTimeout(
      `${backendUrl}/api/refine-content`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content_type: contentType,
          current_content: currentContent,
          user_instruction: userInstruction,
          conversation_history: conversationHistory,
          property_data: propertyData,
        }),
      },
      API_TIMEOUTS.generation
    );

    return await parseJsonResponse<RefineContentResponse>(response);
  } catch (error) {
    console.error("Error in refineContent:", error);
    throw error;
  }
}

/**
 * Check text for Fair Housing compliance
 */
export interface ComplianceCheckResponse {
  is_compliant: boolean;
  violations: ComplianceViolation[];
  message: string;
}

export async function checkFairHousingCompliance(
  text: string
): Promise<ComplianceCheckResponse> {
  try {
    const backendUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      "https://listingmagic-production.up.railway.app";

    const response = await fetchWithTimeout(
      `${backendUrl}/api/check-compliance`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      },
      API_TIMEOUTS.default
    );

    return await parseJsonResponse<ComplianceCheckResponse>(response);
  } catch (error) {
    console.error("Error in checkFairHousingCompliance:", error);
    throw error;
  }
}

/**
 * Frontend Fair Housing compliance checker (quick local check)
 * For immediate feedback before sending to backend
 */
export function checkFairHousingComplianceLocal(text: string): {
  isCompliant: boolean;
  violations: { category: string; matches: string[] }[];
} {
  const patterns: { category: string; regex: RegExp }[] = [
    // Familial status
    {
      category: "familial_status",
      regex:
        /\b(adults?\s+only|no\s+children|no\s+kids|perfect\s+for\s+couples?|ideal\s+for\s+couples?|mature\s+(individual|person|couple)|empty\s+nesters?|singles?\s+only|adult\s+(community|living)|great\s+for\s+famil(y|ies)|perfect\s+for\s+famil(y|ies))\b/gi,
    },
    // Religion
    {
      category: "religion",
      regex:
        /\b(near\s+(church(es)?|synagogue|temple|mosque)|christian\s+(community|neighborhood)|jewish\s+(community|neighborhood))\b/gi,
    },
    // Race/ethnicity
    {
      category: "race_ethnicity",
      regex:
        /\b(white|black|asian|hispanic|latino|caucasian|african[\s-]american|diverse|ethnic)\s+(community|neighborhood|area)\b/gi,
    },
    // Disability
    {
      category: "disability",
      regex:
        /\b(no\s+wheelchairs?|able[\s-]bodied|healthy\s+only|no\s+disabled|not\s+suitable\s+for\s+disabled)\b/gi,
    },
    // Gender
    {
      category: "gender",
      regex:
        /\b(male|female|males?|females?)\s+(only|preferred)|bachelor\s+(pad|apartment)|gentleman('s)?\s+(apartment|residence)\b/gi,
    },
    // Age
    {
      category: "age",
      regex:
        /\b(senior(s)?\s+(only|preferred|community)|older\s+persons?\s+(only|preferred)|retirees?\s+(only|preferred)|golden\s+age)\b/gi,
    },
  ];

  const violations: { category: string; matches: string[] }[] = [];

  for (const { category, regex } of patterns) {
    const matches = text.match(regex);
    if (matches) {
      violations.push({
        category,
        matches: [...new Set(matches)], // Remove duplicates
      });
    }
  }

  return {
    isCompliant: violations.length === 0,
    violations,
  };
}
