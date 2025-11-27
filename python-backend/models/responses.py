"""
Listing Magic - Response Models

Pydantic models for API response validation.
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime
from enum import Enum


class AIProvider(str, Enum):
    """AI provider enumeration."""
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GOOGLE = "google"


class UsageMetrics(BaseModel):
    """Token usage and cost metrics."""
    input_tokens: int = Field(default=0, description="Input tokens consumed")
    output_tokens: int = Field(default=0, description="Output tokens generated")
    total_tokens: int = Field(default=0, description="Total tokens used")
    cost_usd: float = Field(default=0.0, description="Estimated cost in USD")
    generation_time_ms: int = Field(default=0, description="Generation time in milliseconds")

    # Model information
    model_used: str = Field(default="", description="Model ID used for generation")
    provider: AIProvider = Field(default=AIProvider.OPENAI)
    is_fallback: bool = Field(default=False, description="Whether fallback model was used")
    fallback_reason: Optional[str] = Field(None, description="Why fallback was triggered")


class ExtractedFeatures(BaseModel):
    """Features extracted from property photos by GPT-4.1 Vision."""
    bedrooms: Optional[int] = Field(None, description="Detected bedroom count")
    bathrooms: Optional[float] = Field(None, description="Detected bathroom count")
    kitchen_features: List[str] = Field(default_factory=list)
    flooring_type: List[str] = Field(default_factory=list)
    ceiling_features: List[str] = Field(default_factory=list)
    lighting: List[str] = Field(default_factory=list)
    windows: List[str] = Field(default_factory=list)
    outdoor_spaces: List[str] = Field(default_factory=list)
    amenities: List[str] = Field(default_factory=list)
    condition: Optional[str] = Field(None, description="Overall condition assessment")
    style: Optional[str] = Field(None, description="Architectural/interior style")
    notable_features: List[str] = Field(default_factory=list)

    # Confidence scores
    confidence: Dict[str, float] = Field(
        default_factory=dict,
        description="Confidence scores for each detected feature"
    )


class HealthResponse(BaseModel):
    """Health check response."""
    status: str = Field(default="healthy")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    version: str = Field(default="1.0.0")
    services: Dict[str, bool] = Field(
        default_factory=lambda: {
            "openai": True,
            "anthropic": True,
            "gemini": True,
            "video": True
        }
    )
    models: Dict[str, str] = Field(
        default_factory=lambda: {
            "public_remarks": "gpt-4.1",
            "walkthru_script": "claude-sonnet-4-20250514",
            "features": "gemini-3-pro-latest",
            "reso_data": "gemini-3-pro-latest"
        }
    )


class PublicRemarksResponse(BaseModel):
    """Response from public remarks generation."""
    success: bool = Field(default=True)
    text: str = Field(..., description="Generated listing description")
    word_count: int = Field(default=0)

    # Photo analysis results (GPT-4.1 Vision)
    extracted_features: Optional[ExtractedFeatures] = Field(
        None,
        description="Features automatically extracted from photos"
    )
    photos_analyzed: int = Field(default=0, description="Number of photos analyzed")

    # Usage metrics
    usage: UsageMetrics = Field(default_factory=UsageMetrics)

    # Metadata
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    request_id: Optional[str] = Field(None)

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "text": "Welcome to this stunning 4-bedroom residence...",
                "word_count": 245,
                "extracted_features": {
                    "bedrooms": 4,
                    "bathrooms": 3.5,
                    "kitchen_features": ["granite countertops", "stainless appliances"],
                    "condition": "excellent"
                },
                "photos_analyzed": 12,
                "usage": {
                    "input_tokens": 1500,
                    "output_tokens": 350,
                    "cost_usd": 0.065,
                    "model_used": "gpt-4.1",
                    "provider": "openai"
                }
            }
        }


class WalkthruScriptResponse(BaseModel):
    """Response from walk-thru script generation."""
    success: bool = Field(default=True)
    script: str = Field(..., description="Generated video narration script")
    word_count: int = Field(default=0)
    estimated_duration_seconds: int = Field(
        default=0,
        description="Estimated speaking duration"
    )

    # Script sections
    sections: List[Dict[str, str]] = Field(
        default_factory=list,
        description="Script broken into sections (intro, rooms, outro)"
    )

    # Usage metrics
    usage: UsageMetrics = Field(default_factory=UsageMetrics)

    # Metadata
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    request_id: Optional[str] = Field(None)


class FeatureCategory(BaseModel):
    """A category of property features."""
    name: str
    features: List[str]


class FeaturesResponse(BaseModel):
    """Response from features list generation."""
    success: bool = Field(default=True)
    features_list: List[str] = Field(
        default_factory=list,
        description="Flat list of all features"
    )
    categorized_features: List[FeatureCategory] = Field(
        default_factory=list,
        description="Features organized by category"
    )
    total_features: int = Field(default=0)

    # Usage metrics
    usage: UsageMetrics = Field(default_factory=UsageMetrics)

    # Metadata
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    request_id: Optional[str] = Field(None)


class ResoDataResponse(BaseModel):
    """Response from RESO data generation."""
    success: bool = Field(default=True)
    reso_json: Dict[str, Any] = Field(
        default_factory=dict,
        description="RESO-formatted property data"
    )
    schema_version: str = Field(default="2.0")
    validation_passed: bool = Field(default=True)
    validation_errors: List[str] = Field(default_factory=list)

    # Usage metrics
    usage: UsageMetrics = Field(default_factory=UsageMetrics)

    # Metadata
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    request_id: Optional[str] = Field(None)


class VideoGenerationResponse(BaseModel):
    """Response from video generation."""
    success: bool = Field(default=True)
    video_url: str = Field(..., description="URL to the generated video")
    thumbnail_url: Optional[str] = Field(None, description="Video thumbnail URL")
    duration_seconds: int = Field(default=0)
    file_size_mb: float = Field(default=0.0)
    resolution: str = Field(default="1080p")

    # Processing info
    processing_time_seconds: float = Field(default=0.0)
    photos_used: int = Field(default=0)

    # Metadata
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    request_id: Optional[str] = Field(None)
    expires_at: Optional[datetime] = Field(
        None,
        description="When the video URL expires"
    )


class ErrorResponse(BaseModel):
    """Standard error response."""
    success: bool = Field(default=False)
    error: str = Field(..., description="Error message")
    error_code: str = Field(default="UNKNOWN_ERROR")
    details: Optional[Dict[str, Any]] = Field(None)
    request_id: Optional[str] = Field(None)
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    # Fallback information
    fallback_attempted: bool = Field(default=False)
    fallback_provider: Optional[str] = Field(None)
