"""
Listing Magic - FastAPI Backend

Two cutting-edge AI models working together:
- GPT-4.1 Vision (OpenAI): Photo analysis + listing descriptions
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
    FeaturesRequest,
    ResoDataRequest,
    # Responses
    HealthResponse,
    PublicRemarksResponse,
    FeaturesResponse,
    ResoDataResponse,
    ErrorResponse
)
from services import OpenAIService, AnthropicService, GeminiService
from services.openai_service import get_openai_service
from services.anthropic_service import get_anthropic_service
from services.gemini_service import get_gemini_service
from services.ai_generation_service import (
    generate_content_with_fallback,
    check_ai_services_health,
    clean_json_response,
    OPENAI_MODEL,
    GEMINI_MODEL
)
from utils import get_cost_tracker
from endpoints.mls_data import router as mls_router
from endpoints.video_generation import router as video_router
from endpoints.refine_content import router as refine_router
from endpoints.photo_categorization import router as photo_categorization_router
from compliance import check_fair_housing_compliance

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

    Uses two cutting-edge AI models:
    - **GPT-4.1 Vision** (OpenAI): Photo analysis + persuasive listing descriptions
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
app.include_router(video_router)
app.include_router(refine_router)
app.include_router(photo_categorization_router)


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

    Returns status of AI services (unified generation with fallback).
    Primary: OpenAI gpt-5.2
    Fallback: Gemini gemini-2.0-flash
    """
    # Check unified AI service health
    ai_health = await check_ai_services_health()

    # Also check legacy services for backward compatibility
    anthropic_service = get_anthropic_service()
    anthropic_health = await anthropic_service.health_check()

    return HealthResponse(
        status="healthy",
        services={
            "openai": ai_health["openai"]["status"] == "healthy",
            "anthropic": anthropic_health["status"] == "healthy",
            "gemini": ai_health["gemini"]["status"] == "healthy",
            "video": True  # Placeholder for video service
        },
        models={
            # All tasks now use unified service (OpenAI primary, Gemini fallback)
            "public_remarks": OPENAI_MODEL,
            "features": OPENAI_MODEL,
            "reso_data": OPENAI_MODEL,
            "fallback": GEMINI_MODEL
        }
    )


# =============================================================================
# Public Remarks Endpoint (Unified: OpenAI primary, Gemini fallback)
# =============================================================================

@app.post(
    "/api/generate-public-remarks",
    response_model=PublicRemarksResponse,
    tags=["Content Generation"]
)
async def generate_public_remarks_endpoint(
    request: PublicRemarksRequest
) -> PublicRemarksResponse:
    """
    Generate property listing description (public remarks).

    Uses unified AI generation service:
    - Primary: OpenAI gpt-5.2
    - Fallback: Gemini gemini-2.0-flash (infrastructure failures only)

    The frontend does not know which provider was used.
    """
    from utils.prompt_templates import PUBLIC_REMARKS_SYSTEM, format_public_remarks_prompt
    from models.responses import UsageMetrics, AIProvider

    logger.info(f"Generating public remarks for: {request.property_details.address.full_address}")

    try:
        # Format the prompt using existing templates
        user_prompt = format_public_remarks_prompt(
            address=request.property_details.address.full_address,
            bedrooms=request.property_details.bedrooms,
            bathrooms=request.property_details.bathrooms,
            square_feet=request.property_details.square_feet,
            year_built=request.property_details.year_built,
            property_type=request.property_details.property_type.value.replace("_", " ").title(),
            max_words=request.max_words,
            highlight_features=request.highlight_features
        )

        # Get photo URLs
        photo_urls = []
        if request.property_details.photos:
            for photo in request.property_details.photos:
                if photo.url:
                    photo_urls.append(photo.url)
                elif photo.base64:
                    # Support base64 inputs by converting to data URLs (OpenAI Responses API accepts data URLs).
                    # NOTE: We intentionally pass these through `photo_urls` so unified AI service remains unchanged.
                    media_type = photo.content_type or "image/jpeg"
                    photo_urls.append(f"data:{media_type};base64,{photo.base64}")

        # Generate using unified service with fallback
        result = await generate_content_with_fallback(
            system_prompt=PUBLIC_REMARKS_SYSTEM,
            user_prompt=user_prompt,
            photo_urls=photo_urls,
            task_type="public_remarks",
            temperature=0.7,
            max_output_tokens=1500
        )

        if not result.success:
            raise HTTPException(
                status_code=500,
                detail=f"AI generation failed: {result.error}"
            )

        generated_text = result.content.strip()
        word_count = len(generated_text.split())

        # Fair Housing compliance check on generated content
        # This is a CONTENT check - should NOT trigger fallback if it fails
        compliance_result = check_fair_housing_compliance(generated_text)
        if not compliance_result.is_compliant:
            logger.warning(f"Public remarks failed Fair Housing compliance: {compliance_result.violations}")
            raise HTTPException(
                status_code=422,
                detail={
                    "error": "compliance_violation",
                    "message": "Generated content contains Fair Housing violations. Please try again.",
                    "violations": [
                        {
                            "category": v.category,
                            "matches": v.matches,
                            "suggestion": v.suggestion
                        }
                        for v in compliance_result.violations
                    ]
                }
            )

        # Build usage metrics
        usage = UsageMetrics(
            input_tokens=result.input_tokens or 0,
            output_tokens=result.output_tokens or 0,
            total_tokens=(result.input_tokens or 0) + (result.output_tokens or 0),
            cost_usd=0.0,  # Cost tracking handled separately
            generation_time_ms=result.generation_time_ms,
            model_used=result.model_used,
            provider=AIProvider.OPENAI if result.provider_used == "openai" else AIProvider.GOOGLE,
            is_fallback=result.is_fallback
        )

        # Track cost
        cost_tracker = get_cost_tracker()
        cost_tracker.record_usage(
            provider=result.provider_used,
            model=result.model_used,
            task="public_remarks",
            input_tokens=result.input_tokens or 0,
            output_tokens=result.output_tokens or 0,
            request_id=f"pr_{int(time.time() * 1000)}"
        )

        return PublicRemarksResponse(
            success=True,
            text=generated_text,
            word_count=word_count,
            extracted_features=None,
            photos_analyzed=len(photo_urls),
            usage=usage,
            request_id=f"pr_{int(time.time() * 1000)}"
        )

    except HTTPException:
        raise  # Re-raise HTTP exceptions (including compliance violations)
    except Exception as e:
        logger.error(f"Error generating public remarks: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate public remarks: {str(e)}"
        )


# =============================================================================
# Features Endpoint (Unified: OpenAI primary, Gemini fallback)
# =============================================================================

@app.post(
    "/api/generate-features",
    response_model=FeaturesResponse,
    tags=["Content Generation"]
)
async def generate_features_endpoint(
    request: FeaturesRequest
) -> FeaturesResponse:
    """
    Generate property features list.

    Uses unified AI generation service:
    - Primary: OpenAI gpt-5.2
    - Fallback: Gemini gemini-2.0-flash (infrastructure failures only)

    The frontend does not know which provider was used.
    """
    from utils.prompt_templates import FEATURES_SYSTEM, format_features_prompt
    from models.responses import UsageMetrics, AIProvider, FeatureCategory
    import json

    logger.info(
        f"Generating features for: {request.property_details.address.full_address}, "
        f"max features: {request.max_features}"
    )

    try:
        # Format the prompt using existing templates
        user_prompt = format_features_prompt(
            address=request.property_details.address.full_address,
            property_type=request.property_details.property_type.value.replace("_", " ").title(),
            bedrooms=request.property_details.bedrooms,
            bathrooms=request.property_details.bathrooms,
            square_feet=request.property_details.square_feet,
            year_built=request.property_details.year_built,
            max_features=request.max_features
        )

        # Get photo URLs
        photo_urls = []
        if request.property_details.photos:
            for photo in request.property_details.photos:
                if photo.url:
                    photo_urls.append(photo.url)
                elif photo.base64:
                    media_type = photo.content_type or "image/jpeg"
                    photo_urls.append(f"data:{media_type};base64,{photo.base64}")

        # Generate using unified service with fallback
        result = await generate_content_with_fallback(
            system_prompt=FEATURES_SYSTEM,
            user_prompt=user_prompt,
            photo_urls=photo_urls,
            task_type="features",
            temperature=0.3,
            max_output_tokens=4000
        )

        if not result.success:
            raise HTTPException(
                status_code=500,
                detail=f"AI generation failed: {result.error}"
            )

        # Parse JSON response
        response_text = clean_json_response(result.content)
        try:
            parsed_data = json.loads(response_text)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse features JSON: {e}")
            raise HTTPException(
                status_code=500,
                detail="AI returned invalid JSON for features. Please try again."
            )

        # Build categorized features
        categorized_features = []
        if request.categorize and "categories" in parsed_data:
            for cat in parsed_data["categories"]:
                categorized_features.append(FeatureCategory(
                    name=cat.get("name", "Other"),
                    features=cat.get("features", [])
                ))

        # Get flat features list
        features_list = parsed_data.get("all_features", [])
        if not features_list and categorized_features:
            for cat in categorized_features:
                features_list.extend(cat.features)

        # Limit to max_features
        features_list = features_list[:request.max_features]

        # Fair Housing compliance check
        all_features_text = " ".join(features_list or [])
        if categorized_features:
            for category in categorized_features:
                all_features_text += " " + " ".join(category.features or [])

        compliance_result = check_fair_housing_compliance(all_features_text)
        if not compliance_result.is_compliant:
            logger.warning(f"Features failed Fair Housing compliance: {compliance_result.violations}")
            raise HTTPException(
                status_code=422,
                detail={
                    "error": "compliance_violation",
                    "message": "Generated features contain Fair Housing violations. Please try again.",
                    "violations": [
                        {
                            "category": v.category,
                            "matches": v.matches,
                            "suggestion": v.suggestion
                        }
                        for v in compliance_result.violations
                    ]
                }
            )

        # Build usage metrics
        usage = UsageMetrics(
            input_tokens=result.input_tokens or 0,
            output_tokens=result.output_tokens or 0,
            total_tokens=(result.input_tokens or 0) + (result.output_tokens or 0),
            cost_usd=0.0,
            generation_time_ms=result.generation_time_ms,
            model_used=result.model_used,
            provider=AIProvider.OPENAI if result.provider_used == "openai" else AIProvider.GOOGLE,
            is_fallback=result.is_fallback
        )

        # Track cost
        cost_tracker = get_cost_tracker()
        cost_tracker.record_usage(
            provider=result.provider_used,
            model=result.model_used,
            task="features",
            input_tokens=result.input_tokens or 0,
            output_tokens=result.output_tokens or 0,
            request_id=f"feat_{int(time.time() * 1000)}"
        )

        return FeaturesResponse(
            success=True,
            features_list=features_list,
            categorized_features=categorized_features if request.categorize else [],
            total_features=len(features_list),
            usage=usage,
            request_id=f"feat_{int(time.time() * 1000)}"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating features: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate features: {str(e)}"
        )


# =============================================================================
# RESO Data Endpoint (Unified: OpenAI primary, Gemini fallback)
# =============================================================================

@app.post(
    "/api/generate-reso",
    response_model=ResoDataResponse,
    tags=["Content Generation"]
)
async def generate_reso_data_endpoint(
    request: ResoDataRequest
) -> ResoDataResponse:
    """
    Generate RESO-formatted MLS data.

    Uses unified AI generation service:
    - Primary: OpenAI gpt-5.2
    - Fallback: Gemini gemini-2.0-flash (infrastructure failures only)

    The frontend does not know which provider was used.
    """
    from utils.prompt_templates import RESO_DATA_SYSTEM, format_reso_prompt
    from models.responses import UsageMetrics, AIProvider
    import json

    logger.info(
        f"Generating RESO data for: {request.property_details.address.full_address}, "
        f"schema: {request.schema_version}"
    )

    try:
        address = request.property_details.address

        # Format the prompt using existing templates
        user_prompt = format_reso_prompt(
            address=address.full_address,
            street=address.street,
            city=address.city or "",
            state=address.state or "",
            zip_code=address.zip_code,
            property_type=request.property_details.property_type.value.replace("_", " ").title(),
            bedrooms=request.property_details.bedrooms,
            bathrooms=request.property_details.bathrooms,
            square_feet=request.property_details.square_feet,
            year_built=request.property_details.year_built,
            price=request.property_details.price,
            public_remarks=request.public_remarks,
            features=request.features_list,
            schema_version=request.schema_version
        )

        # Get photo URLs
        photo_urls = []
        if request.property_details.photos:
            for photo in request.property_details.photos:
                if photo.url:
                    photo_urls.append(photo.url)
                elif photo.base64:
                    media_type = photo.content_type or "image/jpeg"
                    photo_urls.append(f"data:{media_type};base64,{photo.base64}")

        # Generate using unified service with fallback
        result = await generate_content_with_fallback(
            system_prompt=RESO_DATA_SYSTEM,
            user_prompt=user_prompt,
            photo_urls=photo_urls,
            task_type="mls",  # Using "mls" task type for RESO
            temperature=0.2,
            max_output_tokens=4000
        )

        if not result.success:
            raise HTTPException(
                status_code=500,
                detail=f"AI generation failed: {result.error}"
            )

        # Parse JSON response
        response_text = clean_json_response(result.content)
        try:
            reso_json = json.loads(response_text)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse RESO JSON: {e}")
            raise HTTPException(
                status_code=500,
                detail="AI returned invalid JSON for RESO data. Please try again."
            )

        # Validate RESO data
        validation_errors = []
        required_fields = ["ListingKey", "PropertyType", "StandardStatus", "PostalCode"]
        for field in required_fields:
            if field not in reso_json or reso_json[field] is None:
                validation_errors.append(f"Required field '{field}' is missing or null")

        validation_passed = len(validation_errors) == 0

        # Build usage metrics
        usage = UsageMetrics(
            input_tokens=result.input_tokens or 0,
            output_tokens=result.output_tokens or 0,
            total_tokens=(result.input_tokens or 0) + (result.output_tokens or 0),
            cost_usd=0.0,
            generation_time_ms=result.generation_time_ms,
            model_used=result.model_used,
            provider=AIProvider.OPENAI if result.provider_used == "openai" else AIProvider.GOOGLE,
            is_fallback=result.is_fallback
        )

        # Track cost
        cost_tracker = get_cost_tracker()
        cost_tracker.record_usage(
            provider=result.provider_used,
            model=result.model_used,
            task="reso_data",
            input_tokens=result.input_tokens or 0,
            output_tokens=result.output_tokens or 0,
            request_id=f"reso_{int(time.time() * 1000)}"
        )

        return ResoDataResponse(
            success=True,
            reso_json=reso_json,
            schema_version=request.schema_version,
            validation_passed=validation_passed,
            validation_errors=validation_errors,
            usage=usage,
            request_id=f"reso_{int(time.time() * 1000)}"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating RESO data: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate RESO data: {str(e)}"
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
