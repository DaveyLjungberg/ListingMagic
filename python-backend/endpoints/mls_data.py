"""
MLS Data Extraction Endpoint for Listing Magic
Extracts 22 MLS fields from property photos using AI vision models
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

import anthropic
import openai
import google.generativeai as genai

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


class MLSDataURLsRequest(BaseModel):
    """Request model for MLS data extraction from URLs."""
    photo_urls: List[str] = Field(..., description="Public URLs to property photos")
    address: str = Field(..., description="Property address")
    model: str = Field(default="claude", description="AI model: claude (default, best), gpt, or gemini")


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
# AI Model Extractors
# =============================================================================

async def extract_with_gemini(images: List[str], prompt: str) -> Dict[str, Any]:
    """Extract MLS data using Google Gemini."""
    genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
    model = genai.GenerativeModel("gemini-2.0-flash-exp")

    # Prepare image parts
    image_parts = []
    for img_b64 in images:
        clean_b64 = strip_base64_prefix(img_b64)
        image_parts.append({
            "mime_type": "image/jpeg",
            "data": clean_b64
        })

    # Generate content
    response = model.generate_content([prompt] + image_parts)
    response_text = clean_json_response(response.text)

    return json.loads(response_text)


async def extract_with_gpt(images: List[str], prompt: str) -> Dict[str, Any]:
    """Extract MLS data using GPT-4 Vision."""
    client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    # Prepare image content
    content = [{"type": "text", "text": prompt}]
    for img_b64 in images:
        if not img_b64.startswith("data:"):
            img_b64 = f"data:image/jpeg;base64,{strip_base64_prefix(img_b64)}"
        content.append({
            "type": "image_url",
            "image_url": {"url": img_b64}
        })

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": content}],
        max_tokens=2000
    )

    response_text = clean_json_response(response.choices[0].message.content)
    return json.loads(response_text)


async def extract_with_claude(images: List[str], prompt: str) -> Dict[str, Any]:
    """Extract MLS data using Claude Sonnet."""
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    # Prepare image content
    content = []
    for img_b64 in images:
        clean_b64 = strip_base64_prefix(img_b64)
        content.append({
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": "image/jpeg",
                "data": clean_b64
            }
        })
    content.append({"type": "text", "text": prompt})

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2000,
        messages=[{"role": "user", "content": content}]
    )

    response_text = clean_json_response(response.content[0].text)
    return json.loads(response_text)


# =============================================================================
# Main Endpoint
# =============================================================================

@router.post("/api/generate-mls-data", response_model=MLSDataResponse)
async def generate_mls_data(request: MLSDataRequest) -> MLSDataResponse:
    """
    Extract MLS fields from property photos using AI vision models.

    Analyzes property photos to extract 22 MLS-compliant fields including:
    - Property type, bedrooms, bathrooms
    - Flooring, appliances, interior features
    - Exterior materials, roof type, parking
    - Room dimensions and layout
    - Estimated square footage and year built

    **Models available:**
    - `claude` (default): Best accuracy, handles many photos well
    - `gpt`: Good for complex photos
    - `gemini`: Fastest option
    """
    start_time = time.time()

    logger.info(f"Generating MLS data for: {request.address}, model: {request.model}")
    logger.info(f"Processing {len(request.images)} images")

    try:
        prompt = MLS_EXTRACTION_PROMPT.format(address=request.address)

        # Select extraction function based on model
        extractors = {
            "gemini": extract_with_gemini,
            "gpt": extract_with_gpt,
            "claude": extract_with_claude
        }

        if request.model not in extractors:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid model '{request.model}'. Must be one of: gemini, gpt, claude"
            )

        extractor = extractors[request.model]
        mls_data = await extractor(request.images, prompt)

        # Calculate processing time
        processing_time_ms = int((time.time() - start_time) * 1000)

        # Build response
        return MLSDataResponse(
            success=True,
            model_used=request.model,
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
    except Exception as e:
        logger.error(f"MLS extraction failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"MLS extraction failed: {str(e)}"
        )


# =============================================================================
# URL-based Extraction Functions
# =============================================================================

async def download_image_as_base64(url: str) -> str:
    """Download an image from URL and convert to base64."""
    # Strip whitespace/newlines from URL
    url = url.strip()

    # Use browser-like headers to avoid 400 errors
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }

    async with httpx.AsyncClient(headers=headers) as client:
        response = await client.get(url, timeout=30.0)
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as e:
            logger.error(f"Failed to download image from {url}: {e.response.status_code} - {e.response.text}")
            raise
        return base64.b64encode(response.content).decode("utf-8")


async def extract_with_claude_urls(photo_urls: List[str], prompt: str) -> Dict[str, Any]:
    """Extract MLS data using Claude with photo URLs."""
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    # Build content with image URLs
    content = []
    for url in photo_urls:
        # Download and convert to base64 for Claude
        try:
            img_b64 = await download_image_as_base64(url)
            content.append({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": "image/jpeg",
                    "data": img_b64
                }
            })
        except Exception as e:
            logger.warning(f"Failed to download image {url}: {e}")
            continue

    content.append({"type": "text", "text": prompt})

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2000,
        messages=[{"role": "user", "content": content}]
    )

    response_text = clean_json_response(response.content[0].text)
    return json.loads(response_text)


async def extract_with_gpt_urls(photo_urls: List[str], prompt: str) -> Dict[str, Any]:
    """Extract MLS data using GPT-4 Vision with photo URLs."""
    client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    # GPT-4 Vision can use URLs directly
    content = [{"type": "text", "text": prompt}]
    for url in photo_urls:
        content.append({
            "type": "image_url",
            "image_url": {"url": url}
        })

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": content}],
        max_tokens=2000
    )

    response_text = clean_json_response(response.choices[0].message.content)
    return json.loads(response_text)


async def extract_with_gemini_urls(photo_urls: List[str], prompt: str) -> Dict[str, Any]:
    """Extract MLS data using Gemini with photo URLs."""
    genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
    model = genai.GenerativeModel("gemini-2.0-flash-exp")

    # Download images and convert to base64 for Gemini
    image_parts = []
    for url in photo_urls:
        try:
            img_b64 = await download_image_as_base64(url)
            image_parts.append({
                "mime_type": "image/jpeg",
                "data": img_b64
            })
        except Exception as e:
            logger.warning(f"Failed to download image {url}: {e}")
            continue

    response = model.generate_content([prompt] + image_parts)
    response_text = clean_json_response(response.text)

    return json.loads(response_text)


# =============================================================================
# URL-based Endpoint
# =============================================================================

@router.post("/api/generate-mls-data-urls", response_model=MLSDataResponse)
async def generate_mls_data_from_urls(request: MLSDataURLsRequest) -> MLSDataResponse:
    """
    Extract MLS fields from property photos using photo URLs.

    This endpoint accepts public URLs to photos instead of base64 data,
    which bypasses payload size limits and is more efficient for large uploads.

    **Models available:**
    - `claude` (default): Best accuracy, handles many photos well
    - `gpt`: Good for complex photos (supports URLs directly)
    - `gemini`: Fastest option
    """
    start_time = time.time()

    logger.info(f"Generating MLS data from URLs for: {request.address}, model: {request.model}")
    logger.info(f"Processing {len(request.photo_urls)} photo URLs")

    try:
        prompt = MLS_EXTRACTION_PROMPT.format(address=request.address)

        # Select extraction function based on model
        extractors = {
            "gemini": extract_with_gemini_urls,
            "gpt": extract_with_gpt_urls,
            "claude": extract_with_claude_urls
        }

        if request.model not in extractors:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid model '{request.model}'. Must be one of: gemini, gpt, claude"
            )

        extractor = extractors[request.model]
        mls_data = await extractor(request.photo_urls, prompt)

        # Calculate processing time
        processing_time_ms = int((time.time() - start_time) * 1000)

        # Build response
        return MLSDataResponse(
            success=True,
            model_used=request.model,
            processing_time_ms=processing_time_ms,
            photos_analyzed=len(request.photo_urls),
            **mls_data
        )

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse AI response as JSON: {e}")
        raise HTTPException(
            status_code=500,
            detail="AI returned invalid JSON response. Please try again."
        )
    except Exception as e:
        logger.error(f"MLS extraction from URLs failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"MLS extraction failed: {str(e)}"
        )
