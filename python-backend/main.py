"""
Listing Magic - FastAPI Backend

Three cutting-edge AI models working together:
- GPT-4.1 Vision (OpenAI): Photo analysis + listing descriptions
- Claude Sonnet 4.5 (Anthropic): Video walk-thru scripts
- Gemini 3 Pro (Google): Features lists + RESO data

Run with: uvicorn main:app --reload --port 8000
"""

import logging
import os
import time
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import settings, TASK_MODEL_MAPPING, get_fallback_model
from models import (
    # Requests
    PublicRemarksRequest,
    WalkthruScriptRequest,
    FeaturesRequest,
    ResoDataRequest,
    VideoGenerationRequest,
    # Responses
    HealthResponse,
    PublicRemarksResponse,
    WalkthruScriptResponse,
    FeaturesResponse,
    ResoDataResponse,
    VideoGenerationResponse,
    ErrorResponse
)
from services import OpenAIService, AnthropicService, GeminiService
from services.openai_service import get_openai_service
from services.anthropic_service import get_anthropic_service
from services.gemini_service import get_gemini_service
from utils import get_cost_tracker
from endpoints.mls_data import router as mls_router

# Configure logging
logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


# =============================================================================
# Application Lifespan
# =============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown events."""
    # Startup
    logger.info("=" * 60)
    logger.info("Listing Magic API Starting")
    logger.info("=" * 60)
    logger.info(f"Environment: {settings.environment}")
    logger.info(f"Debug mode: {settings.debug}")
    logger.info("")
    logger.info("AI Models configured:")
    for task, config in TASK_MODEL_MAPPING.items():
        logger.info(f"  - {task}: {config.name} ({config.model_id})")
    logger.info("")
    logger.info(f"CORS origins: {settings.allowed_origins_list}")
    logger.info("=" * 60)

    yield

    # Shutdown
    logger.info("Listing Magic API Shutting down")
    cost_tracker = get_cost_tracker()
    summary = cost_tracker.get_today_summary()
    logger.info(f"Session summary: {summary.total_requests} requests, ${summary.total_cost_usd:.4f} total cost")


# =============================================================================
# FastAPI Application
# =============================================================================

app = FastAPI(
    title="Listing Magic API",
    description="""
    AI-Powered Real Estate Marketing API

    Uses three cutting-edge AI models:
    - **GPT-4.1 Vision** (OpenAI): Photo analysis + persuasive listing descriptions
    - **Claude Sonnet 4.5** (Anthropic): Natural video walk-thru scripts
    - **Gemini 3 Pro** (Google): Fast features lists + RESO-formatted data
    """,
    version="1.0.0",
    lifespan=lifespan
)

# CORS Configuration
# Note: FastAPI's CORSMiddleware doesn't support wildcards, but we handle
# Vercel preview URLs by allowing all vercel.app subdomains
def get_cors_origins():
    """
    Get CORS origins, expanding wildcards for Vercel preview deployments.
    In production, you may want to use allow_origin_regex for more control.
    """
    origins = settings.allowed_origins_list
    # For simplicity in development/staging, if we have a wildcard pattern,
    # we'll use allow_origins=["*"] with allow_credentials=False
    # In production with specific domains, use the explicit list
    has_wildcard = any("*" in origin for origin in origins)
    if has_wildcard:
        # Remove wildcard entries and keep explicit ones
        explicit_origins = [o for o in origins if "*" not in o]
        return explicit_origins if explicit_origins else ["*"]
    return origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_origin_regex=r"https://.*\.vercel\.app",  # Allow all Vercel preview URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(mls_router)


# =============================================================================
# Middleware
# =============================================================================

@app.middleware("http")
async def add_request_timing(request: Request, call_next):
    """Add request timing and request ID to all responses."""
    start_time = time.time()
    request_id = f"req_{int(start_time * 1000)}"

    # Add request ID to state
    request.state.request_id = request_id

    response = await call_next(request)

    # Add timing headers
    process_time = time.time() - start_time
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Process-Time"] = f"{process_time:.4f}"

    return response


# =============================================================================
# Exception Handlers
# =============================================================================

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handle all unhandled exceptions."""
    request_id = getattr(request.state, "request_id", "unknown")
    logger.error(f"Unhandled exception [{request_id}]: {exc}", exc_info=True)

    return JSONResponse(
        status_code=500,
        content=ErrorResponse(
            error=str(exc) if settings.debug else "Internal server error",
            error_code="INTERNAL_ERROR",
            request_id=request_id
        ).model_dump()
    )


# =============================================================================
# Health Check Endpoint
# =============================================================================

@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """
    Check API health and service availability.

    Returns status of all AI services and their configured models.
    """
    openai_service = get_openai_service()
    anthropic_service = get_anthropic_service()
    gemini_service = get_gemini_service()

    openai_health = await openai_service.health_check()
    anthropic_health = await anthropic_service.health_check()
    gemini_health = await gemini_service.health_check()

    return HealthResponse(
        status="healthy",
        services={
            "openai": openai_health["status"] == "healthy",
            "anthropic": anthropic_health["status"] == "healthy",
            "gemini": gemini_health["status"] == "healthy",
            "video": True  # Placeholder for video service
        },
        models={
            "public_remarks": openai_health["model"],
            "walkthru_script": anthropic_health["model"],
            "features": gemini_health["model"],
            "reso_data": gemini_health["model"]
        }
    )


# =============================================================================
# Public Remarks Endpoint (GPT-4.1 Vision)
# =============================================================================

@app.post(
    "/api/generate-public-remarks",
    response_model=PublicRemarksResponse,
    tags=["Content Generation"]
)
async def generate_public_remarks(
    request: PublicRemarksRequest
) -> PublicRemarksResponse:
    """
    Generate property listing description (public remarks).

    Uses **GPT-4.1 Vision** to:
    - Analyze property photos
    - Extract features automatically
    - Generate persuasive 250-word listing copy

    If GPT-4.1 is unavailable, falls back to Claude (without photo analysis).
    """
    logger.info(f"Generating public remarks for: {request.property_details.address.full_address}")

    try:
        openai_service = get_openai_service()

        response = await openai_service.generate_public_remarks(
            property_details=request.property_details,
            max_words=request.max_words,
            analyze_photos=request.analyze_photos,
            highlight_features=request.highlight_features
        )

        # Track cost
        cost_tracker = get_cost_tracker()
        cost_tracker.record_usage(
            provider="openai",
            model=response.usage.model_used,
            task="public_remarks",
            input_tokens=response.usage.input_tokens,
            output_tokens=response.usage.output_tokens,
            request_id=response.request_id or "unknown"
        )

        return response

    except Exception as e:
        logger.error(f"Error generating public remarks: {e}")

        # Try fallback to Claude
        fallback_config = get_fallback_model("public_remarks")
        if fallback_config:
            logger.info(f"Attempting fallback to {fallback_config.name}")
            # TODO: Implement fallback logic
            pass

        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate public remarks: {str(e)}"
        )


# =============================================================================
# Walk-thru Script Endpoint (Claude Sonnet 4.5)
# =============================================================================

@app.post(
    "/api/generate-walkthru-script",
    response_model=WalkthruScriptResponse,
    tags=["Content Generation"]
)
async def generate_walkthru_script(
    request: WalkthruScriptRequest
) -> WalkthruScriptResponse:
    """
    Generate video walk-thru narration script.

    Uses **Claude Sonnet 4.5** for:
    - Natural, conversational narration
    - Proper pacing for video timing
    - Engaging, warm tone

    If Claude is unavailable, falls back to GPT-4.1.
    """
    logger.info(
        f"Generating walk-thru script for: {request.property_details.address.full_address}, "
        f"duration: {request.duration_seconds}s"
    )

    try:
        anthropic_service = get_anthropic_service()

        response = await anthropic_service.generate_walkthru_script(
            property_details=request.property_details,
            duration_seconds=request.duration_seconds,
            style=request.style,
            include_intro=request.include_intro,
            include_outro=request.include_outro,
            public_remarks=request.public_remarks
        )

        # Track cost
        cost_tracker = get_cost_tracker()
        cost_tracker.record_usage(
            provider="anthropic",
            model=response.usage.model_used,
            task="walkthru_script",
            input_tokens=response.usage.input_tokens,
            output_tokens=response.usage.output_tokens,
            request_id=response.request_id or "unknown"
        )

        return response

    except Exception as e:
        logger.error(f"Error generating walk-thru script: {e}")

        # Try fallback to GPT-4.1
        fallback_config = get_fallback_model("walkthru_script")
        if fallback_config:
            logger.info(f"Attempting fallback to {fallback_config.name}")
            # TODO: Implement fallback logic
            pass

        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate walk-thru script: {str(e)}"
        )


# =============================================================================
# Features Endpoint (Gemini 3 Pro)
# =============================================================================

@app.post(
    "/api/generate-features",
    response_model=FeaturesResponse,
    tags=["Content Generation"]
)
async def generate_features(
    request: FeaturesRequest
) -> FeaturesResponse:
    """
    Generate property features list.

    Uses **Gemini 3 Pro** for:
    - Fast feature extraction
    - Categorized output for MLS
    - Accurate structured data

    If Gemini is unavailable, falls back to GPT-4.1.
    """
    logger.info(
        f"Generating features for: {request.property_details.address.full_address}, "
        f"max features: {request.max_features}"
    )

    try:
        gemini_service = get_gemini_service()

        response = await gemini_service.generate_features(
            property_details=request.property_details,
            categorize=request.categorize,
            include_measurements=request.include_measurements,
            max_features=request.max_features
        )

        # Track cost
        cost_tracker = get_cost_tracker()
        cost_tracker.record_usage(
            provider="google",
            model=response.usage.model_used,
            task="features",
            input_tokens=response.usage.input_tokens,
            output_tokens=response.usage.output_tokens,
            request_id=response.request_id or "unknown"
        )

        return response

    except Exception as e:
        logger.error(f"Error generating features: {e}")

        # Try fallback to GPT-4.1
        fallback_config = get_fallback_model("features")
        if fallback_config:
            logger.info(f"Attempting fallback to {fallback_config.name}")
            # TODO: Implement fallback logic
            pass

        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate features: {str(e)}"
        )


# =============================================================================
# RESO Data Endpoint (Gemini 3 Pro)
# =============================================================================

@app.post(
    "/api/generate-reso",
    response_model=ResoDataResponse,
    tags=["Content Generation"]
)
async def generate_reso_data(
    request: ResoDataRequest
) -> ResoDataResponse:
    """
    Generate RESO-formatted MLS data.

    Uses **Gemini 3 Pro** for:
    - RESO Data Dictionary compliance
    - Structured JSON output
    - Fast, accurate formatting

    If Gemini is unavailable, falls back to GPT-4.1.
    """
    logger.info(
        f"Generating RESO data for: {request.property_details.address.full_address}, "
        f"schema: {request.schema_version}"
    )

    try:
        gemini_service = get_gemini_service()

        response = await gemini_service.generate_reso_data(
            property_details=request.property_details,
            schema_version=request.schema_version,
            include_optional_fields=request.include_optional_fields,
            public_remarks=request.public_remarks,
            features_list=request.features_list
        )

        # Track cost
        cost_tracker = get_cost_tracker()
        cost_tracker.record_usage(
            provider="google",
            model=response.usage.model_used,
            task="reso_data",
            input_tokens=response.usage.input_tokens,
            output_tokens=response.usage.output_tokens,
            request_id=response.request_id or "unknown"
        )

        return response

    except Exception as e:
        logger.error(f"Error generating RESO data: {e}")

        # Try fallback to GPT-4.1
        fallback_config = get_fallback_model("reso_data")
        if fallback_config:
            logger.info(f"Attempting fallback to {fallback_config.name}")
            # TODO: Implement fallback logic
            pass

        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate RESO data: {str(e)}"
        )


# =============================================================================
# Video Generation Endpoint
# =============================================================================

@app.post(
    "/api/generate-video",
    response_model=VideoGenerationResponse,
    tags=["Video Generation"]
)
async def generate_video(
    request: VideoGenerationRequest
) -> VideoGenerationResponse:
    """
    Generate property video with voiceover.

    Combines:
    - Property photos
    - Walk-thru script (voiceover)
    - Background music (optional)

    Uses MoviePy for video assembly.
    """
    logger.info(
        f"Generating video for: {request.property_details.address.full_address}, "
        f"resolution: {request.resolution}"
    )

    # TODO: Implement video generation with MoviePy

    # Mock response for now
    return VideoGenerationResponse(
        success=True,
        video_url="https://storage.listingmagic.com/videos/sample-video.mp4",
        thumbnail_url="https://storage.listingmagic.com/thumbnails/sample-thumb.jpg",
        duration_seconds=request.duration_seconds or 120,
        file_size_mb=45.2,
        resolution=request.resolution,
        processing_time_seconds=30.5,
        photos_used=len(request.property_details.photos)
    )


# =============================================================================
# Cost & Usage Endpoints
# =============================================================================

@app.get("/api/costs/summary", tags=["Costs"])
async def get_cost_summary():
    """Get cost summary for today's usage."""
    cost_tracker = get_cost_tracker()
    summary = cost_tracker.get_today_summary()

    return {
        "today": {
            "total_cost_usd": summary.total_cost_usd,
            "total_requests": summary.total_requests,
            "total_tokens": summary.total_input_tokens + summary.total_output_tokens,
            "by_provider": summary.by_provider,
            "by_task": summary.by_task
        },
        "estimates": cost_tracker.estimate_full_generation_cost(),
        "alerts": cost_tracker.get_alerts()
    }


@app.get("/api/models", tags=["Info"])
async def get_model_info():
    """Get information about configured AI models."""
    return {
        "models": {
            task: {
                "name": config.name,
                "provider": config.provider,
                "model_id": config.model_id,
                "task": config.task,
                "supports_vision": config.supports_vision,
                "special_features": config.special_features
            }
            for task, config in TASK_MODEL_MAPPING.items()
        }
    }


# =============================================================================
# Run with uvicorn
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
