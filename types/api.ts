/**
 * Listing Magic - API Types
 *
 * TypeScript interfaces matching the Python backend models.
 */

// =============================================================================
// Enums
// =============================================================================

export type PropertyType =
  | "single_family"
  | "condo"
  | "townhouse"
  | "multi_family"
  | "land"
  | "commercial"
  | "other";

export type AIProvider = "openai" | "anthropic" | "google";

// =============================================================================
// Input Types
// =============================================================================

export interface ImageInput {
  base64?: string;
  url?: string;
  filename?: string;
  content_type?: string;
}

export interface AddressInput {
  street: string;
  city?: string;
  state?: string;
  zip_code: string;
  country?: string;
}

export interface PropertyDetails {
  address: AddressInput;
  photos: ImageInput[];
  property_type?: PropertyType;
  bedrooms?: number;
  bathrooms?: number;
  square_feet?: number;
  lot_size?: string;
  year_built?: number;
  price?: number;
  description?: string;
  features?: string[];
  style?: string;
}

// =============================================================================
// Request Types
// =============================================================================

export interface GenerateRequest {
  property_details: PropertyDetails;
}

export interface PublicRemarksRequest extends GenerateRequest {
  max_words?: number;
  tone?: string;
  include_call_to_action?: boolean;
  highlight_features?: string[];
  analyze_photos?: boolean;
}

export interface WalkthruScriptRequest extends GenerateRequest {
  duration_seconds?: number;
  style?: string;
  include_intro?: boolean;
  include_outro?: boolean;
  pacing?: string;
  public_remarks?: string;
}

export interface FeaturesRequest extends GenerateRequest {
  format?: string;
  categorize?: boolean;
  include_measurements?: boolean;
  max_features?: number;
}

// =============================================================================
// Response Types
// =============================================================================

export interface UsageMetrics {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost_usd: number;
  generation_time_ms: number;
  model_used: string;
  provider: AIProvider;
  is_fallback: boolean;
  fallback_reason?: string;
}

export interface ExtractedFeatures {
  bedrooms?: number;
  bathrooms?: number;
  kitchen_features: string[];
  flooring_type: string[];
  ceiling_features: string[];
  lighting: string[];
  windows: string[];
  outdoor_spaces: string[];
  amenities: string[];
  condition?: string;
  style?: string;
  notable_features: string[];
  confidence: Record<string, number>;
}

export interface PublicRemarksResponse {
  success: boolean;
  text: string;
  word_count: number;
  extracted_features?: ExtractedFeatures;
  photos_analyzed: number;
  usage: UsageMetrics;
  generated_at: string;
  request_id?: string;
}

export interface ScriptSection {
  name: string;
  content: string;
}

export interface WalkthruScriptResponse {
  success: boolean;
  script: string;
  word_count: number;
  estimated_duration_seconds: number;
  sections: ScriptSection[];
  usage: UsageMetrics;
  generated_at: string;
  request_id?: string;
}

export interface FeatureCategory {
  name: string;
  features: string[];
}

export interface FeaturesResponse {
  success: boolean;
  features_list: string[];
  categorized_features: FeatureCategory[];
  total_features: number;
  usage: UsageMetrics;
  generated_at: string;
  request_id?: string;
}

export interface ErrorResponse {
  success: false;
  error: string;
  error_code: string;
  details?: Record<string, unknown>;
  request_id?: string;
  timestamp: string;
  fallback_attempted: boolean;
  fallback_provider?: string;
}

// =============================================================================
// Frontend State Types
// =============================================================================

export type GenerationStatus = "idle" | "loading" | "success" | "error";

export interface GenerationState<T> {
  status: GenerationStatus;
  data?: T;
  error?: string;
  startTime?: number;
  endTime?: number;
}

export interface AllGenerationsState {
  publicRemarks: GenerationState<PublicRemarksResponse>;
  walkthruScript: GenerationState<WalkthruScriptResponse>;
  features: GenerationState<FeaturesResponse>;
}

export interface FormData {
  photos: PhotoData[];
  address: AddressInput;
  propertyDetails: Partial<PropertyDetails>;
}

export interface PhotoData {
  id: string;
  file: File;
  preview: string;
  name: string;
  base64?: string;
}

// =============================================================================
// API Response Wrapper
// =============================================================================

export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string; details?: Record<string, unknown> };
