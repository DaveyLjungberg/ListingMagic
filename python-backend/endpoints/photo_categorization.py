"""
Photo Categorization Endpoint for Listing Magic

Analyzes all uploaded photos to categorize them by room/area type,
enabling intelligent selection of the best representative photos
for detailed AI analysis.

Uses unified AI generation service:
- Primary: OpenAI gpt-5.2
- Fallback: Gemini gemini-2.0-flash (infrastructure failures only)
"""

import json
import logging
import time
from typing import List, Dict, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.ai_generation_service import generate_content_with_fallback, clean_json_response

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Photo Analysis"])


# =============================================================================
# Request/Response Models
# =============================================================================

class PhotoInput(BaseModel):
    """A single photo input for categorization."""
    url: str = Field(..., description="Public URL of the photo")
    index: int = Field(..., description="Original index in the photo array")


class PhotoCategorizationRequest(BaseModel):
    """Request model for photo categorization."""
    photo_urls: List[str] = Field(
        ...,
        min_length=1,
        description="Array of public photo URLs to categorize"
    )


class PhotoCategory(BaseModel):
    """Categorization result for a single photo."""
    index: int
    category: str
    subcategory: Optional[str] = None
    priority: int = Field(ge=1, le=5)


class PhotoCategorizationResponse(BaseModel):
    """Response model for photo categorization."""
    success: bool
    categories: List[PhotoCategory] = []
    photos_analyzed: int = 0
    processing_time_ms: float = 0
    error: Optional[str] = None


# =============================================================================
# Room Category Constants
# =============================================================================

ROOM_CATEGORIES = {
    "EXTERIOR": "Front, back, side views of the house exterior, curb appeal, roof, facade",
    "KITCHEN": "Kitchen areas, kitchenette, cooking spaces",
    "BATHROOM": "Bathrooms, powder rooms, half baths, master bath, ensuite",
    "BEDROOM": "Bedrooms, master bedroom, guest rooms, kids rooms, nursery",
    "LIVING": "Living room, family room, great room, den, sitting room",
    "DINING": "Dining room, breakfast nook, eat-in kitchen area",
    "OUTDOOR": "Deck, patio, pool, backyard, outdoor kitchen, pergola, gazebo, landscaping",
    "GARAGE": "Garage interior, workshop, storage areas",
    "UTILITY": "Laundry room, mudroom, pantry, utility room, large closets",
    "SPECIAL": "Home office, gym, theater room, wine cellar, basement, attic, bonus room",
    "DETAIL": "Architectural details - fireplace, staircase, hallway, flooring, ceiling, fixtures",
    "UNKNOWN": "Unclear or ambiguous photos"
}


# =============================================================================
# Main Endpoint
# =============================================================================

@router.post("/api/categorize-photos", response_model=PhotoCategorizationResponse)
async def categorize_photos(request: PhotoCategorizationRequest) -> PhotoCategorizationResponse:
    """
    Categorize property photos by room/area type.

    Uses unified AI generation service:
    - Primary: OpenAI gpt-5.2
    - Fallback: Gemini gemini-2.0-flash (infrastructure failures only)

    Analyzes all provided photos and returns categorization with priority scores
    to enable intelligent selection of representative photos for detailed analysis.
    """
    start_time = time.time()

    # Validate input
    if len(request.photo_urls) == 0:
        raise HTTPException(status_code=400, detail="No photos provided")

    logger.info(f"Categorizing {len(request.photo_urls)} photos using unified AI service...")

    try:
        # Build the categorization prompt
        categories_description = "\n".join([
            f"- {cat}: {desc}" for cat, desc in ROOM_CATEGORIES.items()
        ])

        categorization_prompt = f"""Analyze these {len(request.photo_urls)} property photos and categorize each one.

CATEGORIES:
{categories_description}

For EACH photo (indexed 0 to {len(request.photo_urls) - 1}), provide:
1. category: One of {list(ROOM_CATEGORIES.keys())}
2. subcategory: Be specific (e.g., "master bathroom", "guest bedroom 2", "front elevation", "kitchen island view")
3. priority: 1-5 score
   - 1 = ESSENTIAL: Main exterior shot, primary kitchen view, master bedroom/bath
   - 2 = IMPORTANT: Secondary rooms, key features, main outdoor areas
   - 3 = USEFUL: Additional angles of important rooms, nice details
   - 4 = REDUNDANT: Multiple similar shots of same area
   - 5 = LOW-VALUE: Blurry, dark, unhelpful, or duplicate photos

IMPORTANT:
- Analyze ALL {len(request.photo_urls)} photos
- Return EXACTLY {len(request.photo_urls)} categorizations
- Prioritize diversity - first good photo of each room type gets priority 1-2
- Additional photos of same room get priority 3-5

Return ONLY a valid JSON array with no markdown formatting:
[
  {{"index": 0, "category": "EXTERIOR", "subcategory": "front elevation", "priority": 1}},
  {{"index": 1, "category": "KITCHEN", "subcategory": "main kitchen overview", "priority": 1}},
  ...
]"""

        # System prompt for photo categorization
        system_prompt = """You are an expert real estate photo analyzer.
Your task is to categorize property photos by room type and assess their quality and importance.
Return accurate, structured JSON responses."""

        # Use unified AI generation service (OpenAI primary, Gemini fallback)
        result = await generate_content_with_fallback(
            system_prompt=system_prompt,
            user_prompt=categorization_prompt,
            photo_urls=request.photo_urls,
            task_type="mls",  # Use mls task type for categorization (structured output)
            temperature=0.2,  # Low temperature for consistent categorization
            max_output_tokens=8000  # Enough for large JSON array (40+ photos)
        )

        if not result.success:
            raise HTTPException(
                status_code=503,
                detail=f"AI generation failed: {result.error}"
            )

        # Clean up response - remove markdown code blocks if present
        response_text = clean_json_response(result.content)

        # Parse JSON response
        try:
            categories_raw = json.loads(response_text)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON: {response_text[:500]}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to parse categorization response: {str(e)}"
            )

        # Validate and convert to PhotoCategory objects
        categories = []
        for cat in categories_raw:
            try:
                categories.append(PhotoCategory(
                    index=cat.get("index", 0),
                    category=cat.get("category", "UNKNOWN").upper(),
                    subcategory=cat.get("subcategory"),
                    priority=min(max(cat.get("priority", 3), 1), 5)  # Clamp to 1-5
                ))
            except Exception as e:
                logger.warning(f"Failed to parse category: {cat}, error: {e}")
                # Add a default entry for this index
                categories.append(PhotoCategory(
                    index=cat.get("index", len(categories)),
                    category="UNKNOWN",
                    subcategory=None,
                    priority=3
                ))

        # Ensure we have an entry for each photo (fill gaps if AI missed some)
        indexed = {c.index for c in categories}
        for i in range(len(request.photo_urls)):
            if i not in indexed:
                categories.append(PhotoCategory(
                    index=i,
                    category="UNKNOWN",
                    subcategory=None,
                    priority=3
                ))

        # Sort by index
        categories.sort(key=lambda x: x.index)

        processing_time = (time.time() - start_time) * 1000

        logger.info(
            f"Categorized {len(categories)} photos in {processing_time:.0f}ms using {result.model_used}. "
            f"Categories: {_summarize_categories(categories)}"
        )

        return PhotoCategorizationResponse(
            success=True,
            categories=categories,
            photos_analyzed=len(request.photo_urls),
            processing_time_ms=processing_time
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Photo categorization failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Photo categorization failed: {str(e)}"
        )


def _summarize_categories(categories: List[PhotoCategory]) -> Dict[str, int]:
    """Summarize categories for logging."""
    summary = {}
    for cat in categories:
        summary[cat.category] = summary.get(cat.category, 0) + 1
    return summary
