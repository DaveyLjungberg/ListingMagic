"""
Listing Magic - Request Models

Pydantic models for API request validation.
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator
from enum import Enum


class PropertyType(str, Enum):
    """Property type enumeration."""
    SINGLE_FAMILY = "single_family"
    CONDO = "condo"
    TOWNHOUSE = "townhouse"
    MULTI_FAMILY = "multi_family"
    LAND = "land"
    COMMERCIAL = "commercial"
    OTHER = "other"


class ImageInput(BaseModel):
    """Image input - either base64 or URL."""
    base64: Optional[str] = Field(None, description="Base64 encoded image data")
    url: Optional[str] = Field(None, description="URL to the image")
    filename: Optional[str] = Field(None, description="Original filename")
    content_type: Optional[str] = Field(None, description="MIME type (e.g., image/jpeg)")

    @field_validator("base64", "url")
    @classmethod
    def validate_image_source(cls, v, info):
        # At least one source must be provided (validated at model level)
        return v

    def has_source(self) -> bool:
        """Check if image has a valid source."""
        return bool(self.base64 or self.url)


class AddressInput(BaseModel):
    """Property address input."""
    street: str = Field(..., min_length=1, description="Street address")
    city: Optional[str] = Field(None, description="City (can be auto-populated)")
    state: Optional[str] = Field(None, max_length=2, description="State abbreviation")
    zip_code: str = Field(..., min_length=5, max_length=10, description="ZIP code")
    country: str = Field(default="US", description="Country code")

    @property
    def full_address(self) -> str:
        """Get full formatted address."""
        parts = [self.street]
        if self.city:
            parts.append(self.city)
        if self.state:
            parts.append(self.state)
        parts.append(self.zip_code)
        return ", ".join(parts)


class PropertyDetailsRequest(BaseModel):
    """Complete property details for content generation."""
    address: AddressInput
    photos: List[ImageInput] = Field(default_factory=list, max_length=20)
    property_type: PropertyType = Field(default=PropertyType.SINGLE_FAMILY)

    # Optional property details (can be extracted from photos)
    bedrooms: Optional[int] = Field(None, ge=0, le=50)
    bathrooms: Optional[float] = Field(None, ge=0, le=50)
    square_feet: Optional[int] = Field(None, ge=0)
    lot_size: Optional[str] = Field(None, description="Lot size with unit (e.g., '0.25 acres')")
    year_built: Optional[int] = Field(None, ge=1800, le=2030)
    price: Optional[float] = Field(None, ge=0)

    # Additional details
    description: Optional[str] = Field(None, description="Any additional context")
    features: Optional[List[str]] = Field(None, description="Known features to highlight")
    style: Optional[str] = Field(None, description="Architectural style")

    class Config:
        json_schema_extra = {
            "example": {
                "address": {
                    "street": "123 Main Street",
                    "city": "Austin",
                    "state": "TX",
                    "zip_code": "78701"
                },
                "photos": [
                    {"url": "https://example.com/photo1.jpg"},
                    {"base64": "base64encodeddata..."}
                ],
                "property_type": "single_family",
                "bedrooms": 4,
                "bathrooms": 3.5,
                "square_feet": 2800
            }
        }


class PublicRemarksRequest(BaseModel):
    """Request for generating public remarks (listing description)."""
    property_details: PropertyDetailsRequest
    max_words: int = Field(default=250, ge=50, le=500)
    tone: str = Field(default="professional_warm", description="Writing tone")
    include_call_to_action: bool = Field(default=True)
    highlight_features: Optional[List[str]] = Field(None, description="Features to emphasize")

    # GPT-4.1 Vision specific
    analyze_photos: bool = Field(
        default=True,
        description="Use GPT-4.1 Vision to analyze photos and extract features"
    )


class WalkthruScriptRequest(BaseModel):
    """Request for generating video walk-thru script."""
    property_details: PropertyDetailsRequest
    duration_seconds: int = Field(default=120, ge=30, le=300)
    style: str = Field(default="conversational", description="Narration style")
    include_intro: bool = Field(default=True)
    include_outro: bool = Field(default=True)
    pacing: str = Field(default="moderate", description="Script pacing: slow, moderate, fast")

    # Optional: Use existing public remarks for context
    public_remarks: Optional[str] = Field(None, description="Previously generated listing text")


class FeaturesRequest(BaseModel):
    """Request for generating features list."""
    property_details: PropertyDetailsRequest
    format: str = Field(default="bullet_list", description="Output format")
    categorize: bool = Field(default=True, description="Group features by category")
    include_measurements: bool = Field(default=True)
    max_features: int = Field(default=30, ge=5, le=100)


class ResoDataRequest(BaseModel):
    """Request for generating RESO-formatted MLS data."""
    property_details: PropertyDetailsRequest
    schema_version: str = Field(default="2.0", description="RESO schema version")
    include_optional_fields: bool = Field(default=True)

    # Previously generated content to include
    public_remarks: Optional[str] = Field(None)
    features_list: Optional[List[str]] = Field(None)

    # MLS-specific fields
    mls_id: Optional[str] = Field(None, description="MLS listing ID")
    listing_agent: Optional[Dict[str, str]] = Field(None)


class VideoGenerationRequest(BaseModel):
    """Request for generating video with voiceover."""
    property_details: PropertyDetailsRequest
    script: str = Field(..., min_length=50, description="Walk-thru script for voiceover")

    # Video settings
    duration_seconds: Optional[int] = Field(None, description="Override auto duration")
    resolution: str = Field(default="1080p", description="Video resolution")
    aspect_ratio: str = Field(default="16:9", description="Aspect ratio")

    # Audio settings
    voice: str = Field(default="professional_male", description="Voiceover voice selection")
    background_music: bool = Field(default=True)
    music_volume: float = Field(default=0.2, ge=0.0, le=1.0)

    # Output settings
    output_format: str = Field(default="mp4")
    watermark: bool = Field(default=False)
