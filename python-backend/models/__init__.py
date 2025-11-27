"""
Listing Magic - Pydantic Models

Request and response models for the API endpoints.
"""

from .requests import (
    PropertyDetailsRequest,
    PublicRemarksRequest,
    WalkthruScriptRequest,
    FeaturesRequest,
    ResoDataRequest,
    VideoGenerationRequest
)

from .responses import (
    HealthResponse,
    PublicRemarksResponse,
    WalkthruScriptResponse,
    FeaturesResponse,
    ResoDataResponse,
    VideoGenerationResponse,
    ExtractedFeatures,
    UsageMetrics,
    ErrorResponse
)

__all__ = [
    # Requests
    "PropertyDetailsRequest",
    "PublicRemarksRequest",
    "WalkthruScriptRequest",
    "FeaturesRequest",
    "ResoDataRequest",
    "VideoGenerationRequest",
    # Responses
    "HealthResponse",
    "PublicRemarksResponse",
    "WalkthruScriptResponse",
    "FeaturesResponse",
    "ResoDataResponse",
    "VideoGenerationResponse",
    "ExtractedFeatures",
    "UsageMetrics",
    "ErrorResponse"
]
