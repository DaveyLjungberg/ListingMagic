"""
Listing Magic - Pydantic Models

Request and response models for the API endpoints.
"""

from .requests import (
    PropertyDetailsRequest,
    PublicRemarksRequest,
    FeaturesRequest,
    ResoDataRequest,
    VideoGenerationRequest
)

from .responses import (
    HealthResponse,
    PublicRemarksResponse,
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
    "FeaturesRequest",
    "ResoDataRequest",
    "VideoGenerationRequest",
    # Responses
    "HealthResponse",
    "PublicRemarksResponse",
    "FeaturesResponse",
    "ResoDataResponse",
    "VideoGenerationResponse",
    "ExtractedFeatures",
    "UsageMetrics",
    "ErrorResponse"
]
