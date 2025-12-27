"""
MLS Data Extraction Endpoint for Listing Magic

Extracts 22 MLS fields from property photos using AI vision models.

Uses unified AI generation service:
- Primary: OpenAI gpt-5.2
- Fallback: Gemini gemini-2.0-flash (infrastructure failures only)

The frontend does not know which provider was used.
"""

import logging
import time
import json
import os
import httpx
import base64
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.ai_generation_service import (
    generate_content_with_fallback,
    clean_json_response,
    OPENAI_MODEL,
    GEMINI_MODEL
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["MLS Data"])


# =============================================================================
# Request/Response Models
# =============================================================================

class RoomData(BaseModel):
    """Room dimensions data."""
    room_type: str
    level: str
    length_ft: Optional[int] = None
    width_ft: Optional[int] = None


class MLSDataRequest(BaseModel):
    """Request model for MLS data extraction."""
    images: List[str] = Field(..., description="Base64 encoded images")
    address: str = Field(..., description="Property address")
    model: str = Field(default="claude", description="AI model: claude (default, best), gpt, or gemini")


class TaxData(BaseModel):
    """Tax record data from ATTOM API."""
    apn: Optional[str] = None
    yearBuilt: Optional[str] = None
    lotSize: Optional[str] = None
    county: Optional[str] = None


class MLSDataURLsRequest(BaseModel):
    """Request model for MLS data extraction from URLs."""
    photo_urls: List[str] = Field(..., description="Public URLs to property photos")
    address: str = Field(..., description="Property address")
    model: str = Field(default="claude", description="AI model: claude (default, best), gpt, or gemini")
    tax_data: Optional[TaxData] = Field(default=None, description="Tax record data to override AI estimates")


class MLSDataResponse(BaseModel):
    """Response model with extracted MLS fields."""
    success: bool = True

    # High Confidence Fields (GREEN) - Directly observable
    property_type: Optional[str] = None
    bedrooms: Optional[int] = None
    bathrooms_full: Optional[int] = None
    bathrooms_half: Optional[int] = None
    stories: Optional[int] = None
    garage_spaces: Optional[int] = None
    flooring: Optional[List[str]] = None
    appliances: Optional[List[str]] = None
    exterior_material: Optional[str] = None
    roof: Optional[str] = None
    parking: Optional[List[str]] = None
    interior_features: Optional[List[str]] = None
    rooms: Optional[List[RoomData]] = None

    # Moderate Confidence Fields (YELLOW) - Estimated
    year_built_estimate: Optional[str] = None
    total_finished_sqft_estimate: Optional[int] = None
    lot_size_estimate: Optional[str] = None
    basement: Optional[str] = None
    foundation: Optional[str] = None
    water_source: Optional[str] = None
    green_features: Optional[List[str]] = None
    hoa_visible_amenities: Optional[List[str]] = None

    # Metadata
    confidence_scores: Optional[Dict[str, str]] = None
    model_used: Optional[str] = None
    processing_time_ms: Optional[int] = None
    photos_analyzed: Optional[int] = None
    tax_data_applied: Optional[Dict[str, bool]] = None  # Fields overridden by tax records


# =============================================================================
# Extraction Prompt
# =============================================================================

MLS_EXTRACTION_PROMPT = """You are an expert real estate data extraction assistant. Analyze the provided property photos and extract MLS (Multiple Listing Service) compliant data fields.

PROPERTY ADDRESS: {address}

Extract the following fields with HIGH ACCURACY:

**HIGH CONFIDENCE FIELDS (Extract from visual evidence):**
1. property_type: Single Family, Condo, Townhouse, Multi-Family, etc.
2. bedrooms: Total number of bedrooms visible
3. bathrooms_full: Number of full bathrooms (toilet + sink + shower/tub)
4. bathrooms_half: Number of half bathrooms (toilet + sink only)
5. stories: Number of floors/levels
6. garage_spaces: Number of garage parking spaces
7. flooring: List all flooring types seen (Hardwood, Tile, Carpet, Laminate, Vinyl, etc.)
8. appliances: List all appliances visible (Refrigerator, Stove, Oven, Dishwasher, Microwave, Washer, Dryer, etc.)
9. exterior_material: Primary exterior (Vinyl Siding, Brick, Stone, Wood, Stucco, etc.)
10. roof: Roof material (Asphalt Shingle, Tile, Metal, Slate, etc.)
11. parking: All parking types (Attached Garage, Detached Garage, Carport, Driveway, Street, etc.)
12. interior_features: Special features (Fireplace, Walk-in Closet, Vaulted Ceilings, Crown Molding, Built-in Shelving, etc.)
13. rooms: For each distinct room, provide: {{"room_type": "Bedroom"/"Kitchen"/etc., "level": "Main"/"Upper"/"Lower", "length_ft": estimated, "width_ft": estimated}}

**MODERATE CONFIDENCE FIELDS (Estimate based on visual clues):**
14. year_built_estimate: Estimate decade based on architectural style (e.g., "1990s", "2000s", "2010s")
15. total_finished_sqft_estimate: Estimate total square footage based on room sizes and layout
16. lot_size_estimate: If exterior photos show yard, estimate (e.g., "0.25 acres", "0.5 acres")
17. basement: "Yes" if basement visible, "No" if only one level visible, "Unknown" if unclear
18. foundation: Type if visible in exterior shots (Concrete Perimeter, Slab, Crawl Space, etc.)
19. water_source: Usually "Public" for urban/suburban, "Well" if visible well equipment
20. green_features: List if visible (Solar Panels, Energy Star Windows, Tankless Water Heater, etc.)
21. hoa_visible_amenities: If photos show shared amenities (Pool, Clubhouse, Tennis Courts, etc.)

**CRITICAL INSTRUCTIONS:**
- Only include fields you can see clear evidence for
- For counts (bedrooms, bathrooms), be conservative - only count what you clearly see
- For lists (appliances, flooring), include all distinct items you observe
- For estimates (sqft, lot size, year), provide reasonable ranges
- If you cannot determine a field with confidence, use null
- Provide a confidence_scores object with each field rated as "high", "medium", or "low"

**OUTPUT FORMAT:**
Return ONLY valid JSON matching this exact structure (no markdown, no code blocks):
{{
  "property_type": "Single Family",
  "bedrooms": 4,
  "bathrooms_full": 2,
  "bathrooms_half": 1,
  "stories": 2,
  "garage_spaces": 2,
  "flooring": ["Hardwood", "Carpet", "Tile"],
  "appliances": ["Refrigerator", "Stove", "Dishwasher", "Microwave"],
  "exterior_material": "Vinyl Siding",
  "roof": "Asphalt Shingle",
  "parking": ["Attached Garage", "Paved Driveway"],
  "interior_features": ["Fireplace", "Walk-in Closet", "Vaulted Ceilings"],
  "rooms": [
    {{"room_type": "Master Bedroom", "level": "Upper", "length_ft": 14, "width_ft": 12}},
    {{"room_type": "Kitchen", "level": "Main", "length_ft": 16, "width_ft": 12}}
  ],
  "year_built_estimate": "1990s",
  "total_finished_sqft_estimate": 2400,
  "lot_size_estimate": "0.25 acres",
  "basement": "Yes",
  "foundation": "Concrete Perimeter",
  "water_source": "Public",
  "green_features": ["Energy Star Windows"],
  "hoa_visible_amenities": null,
  "confidence_scores": {{
    "property_type": "high",
    "bedrooms": "high",
    "bathrooms_full": "high",
    "year_built_estimate": "medium",
    "total_finished_sqft_estimate": "low"
  }}
}}

Analyze the photos carefully and extract all visible data."""


# =============================================================================
# Helper Functions
# =============================================================================

def clean_json_response(response_text: str) -> str:
    """Remove markdown code blocks from response if present."""
    text = response_text.strip()
    if text.startswith("```"):
        # Find the end of the first line (```json or just ```)
        first_newline = text.find("\n")
        if first_newline != -1:
            text = text[first_newline + 1:]
        # Remove closing ```
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()
    return text


def strip_base64_prefix(img_b64: str) -> str:
    """Remove data URI prefix if present."""
    if "base64," in img_b64:
        return img_b64.split("base64,")[1]
    return img_b64


# =============================================================================
# MLS Extraction System Prompt
# =============================================================================

MLS_SYSTEM_PROMPT = """You are an expert real estate data extraction assistant.
Your task is to analyze property photos and extract MLS-compliant data fields accurately.
Be conservative in your estimates - only report what you can clearly see.
Return data as valid JSON matching the exact structure provided in the user prompt."""


# =============================================================================
# Main Endpoint (Base64 images - legacy, kept for backward compatibility)
# =============================================================================

@router.post("/api/generate-mls-data", response_model=MLSDataResponse)
async def generate_mls_data(request: MLSDataRequest) -> MLSDataResponse:
    """
    Extract MLS fields from property photos using AI vision models.

    Uses unified AI generation service:
    - Primary: OpenAI gpt-5.2
    - Fallback: Gemini gemini-2.0-flash (infrastructure failures only)

    Note: The 'model' parameter is ignored - unified service handles model selection.
    This endpoint accepts base64 images for backward compatibility.
    Prefer using /api/generate-mls-data-urls with photo URLs instead.
    """
    start_time = time.time()

    logger.info(f"Generating MLS data for: {request.address}")
    logger.info(f"Processing {len(request.images)} base64 images")

    try:
        prompt = MLS_EXTRACTION_PROMPT.format(address=request.address)

        # Convert base64 images to data URLs for the unified service
        photo_urls = []
        for img_b64 in request.images:
            clean_b64 = strip_base64_prefix(img_b64)
            data_url = f"data:image/jpeg;base64,{clean_b64}"
            photo_urls.append(data_url)

        # Generate using unified service with fallback
        result = await generate_content_with_fallback(
            system_prompt=MLS_SYSTEM_PROMPT,
            user_prompt=prompt,
            photo_urls=photo_urls,
            task_type="mls",
            temperature=0.2,
            max_output_tokens=2500
        )

        if not result.success:
            raise HTTPException(
                status_code=500,
                detail=f"AI generation failed: {result.error}"
            )

        # Parse JSON response
        response_text = clean_json_response(result.content)
        mls_data = json.loads(response_text)

        # Calculate processing time
        processing_time_ms = int((time.time() - start_time) * 1000)

        # Build response with provider metadata
        return MLSDataResponse(
            success=True,
            model_used=result.model_used,
            processing_time_ms=processing_time_ms,
            photos_analyzed=len(request.images),
            **mls_data
        )

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse AI response as JSON: {e}")
        raise HTTPException(
            status_code=500,
            detail="AI returned invalid JSON response. Please try again."
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"MLS extraction failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"MLS extraction failed: {str(e)}"
        )


# =============================================================================
# URL-based Endpoint (Primary - uses unified service with fallback)
# =============================================================================

@router.post("/api/generate-mls-data-urls", response_model=MLSDataResponse)
async def generate_mls_data_from_urls(request: MLSDataURLsRequest) -> MLSDataResponse:
    """
    Extract MLS fields from property photos using photo URLs.

    Uses unified AI generation service:
    - Primary: OpenAI gpt-5.2
    - Fallback: Gemini gemini-2.0-flash (infrastructure failures only)

    The 'model' parameter is ignored - unified service handles model selection.
    The frontend does not know which provider was used.

    If tax_data is provided (from ATTOM API), those values will override
    AI estimates for year_built, lot_size, etc.
    """
    start_time = time.time()

    logger.info(f"Generating MLS data from URLs for: {request.address}")
    logger.info(f"Processing {len(request.photo_urls)} photo URLs")
    logger.info(f"[MLS Gen Backend] Received tax_data: {request.tax_data}")

    try:
        prompt = MLS_EXTRACTION_PROMPT.format(address=request.address)

        # Generate using unified service with fallback
        result = await generate_content_with_fallback(
            system_prompt=MLS_SYSTEM_PROMPT,
            user_prompt=prompt,
            photo_urls=request.photo_urls,
            task_type="mls",
            temperature=0.2,
            max_output_tokens=2500
        )

        if not result.success:
            raise HTTPException(
                status_code=500,
                detail=f"AI generation failed: {result.error}"
            )

        # Parse JSON response
        response_text = clean_json_response(result.content)
        mls_data = json.loads(response_text)

        # Calculate processing time
        processing_time_ms = int((time.time() - start_time) * 1000)

        # Override AI estimates with tax data when available
        tax_data_applied = {}

        if request.tax_data:
            # Year Built - use exact year from tax records (not decade estimate)
            if request.tax_data.yearBuilt:
                mls_data["year_built_estimate"] = str(request.tax_data.yearBuilt)
                tax_data_applied["year_built_estimate"] = True
                logger.info(f"[Override] Year Built: {request.tax_data.yearBuilt}")

            # Lot Size - use exact size with units from tax records
            if request.tax_data.lotSize:
                mls_data["lot_size_estimate"] = request.tax_data.lotSize
                tax_data_applied["lot_size_estimate"] = True
                logger.info(f"[Override] Lot Size: {request.tax_data.lotSize}")

            # APN/Tax ID - official identifier (store in confidence_scores for now)
            if request.tax_data.apn:
                if mls_data.get("confidence_scores") is None:
                    mls_data["confidence_scores"] = {}
                mls_data["confidence_scores"]["apn"] = "high"
                tax_data_applied["apn"] = True
                logger.info(f"[Override] APN: {request.tax_data.apn}")

            # County - administrative data
            if request.tax_data.county:
                tax_data_applied["county"] = True
                logger.info(f"[Override] County: {request.tax_data.county}")

        # Build response with provider metadata
        return MLSDataResponse(
            success=True,
            model_used=result.model_used,  # Returns actual model used (gpt-5.2 or gemini-2.0-flash)
            processing_time_ms=processing_time_ms,
            photos_analyzed=len(request.photo_urls),
            tax_data_applied=tax_data_applied if tax_data_applied else None,
            **mls_data
        )

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse AI response as JSON: {e}")
        raise HTTPException(
            status_code=500,
            detail="AI returned invalid JSON response. Please try again."
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"MLS extraction from URLs failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"MLS extraction failed: {str(e)}"
        )
