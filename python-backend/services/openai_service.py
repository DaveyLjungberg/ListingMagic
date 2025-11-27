"""
Listing Magic - OpenAI GPT-4.1 Vision Service

GPT-4.1 is OpenAI's multimodal model.
Used for:
- Analyzing property photos to extract features automatically
- Generating persuasive listing descriptions (public remarks)

Key capabilities:
- Multi-image processing (up to 20 property photos)
- Automatic feature extraction (bedrooms, bathrooms, amenities, condition)
- Marketing-optimized copywriting
"""

import json
import logging
import time
from typing import List, Optional, Dict, Any

from openai import AsyncOpenAI
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type
)

from config import settings, GPT41_CONFIG, VISION_CONFIG
from models.requests import ImageInput, PropertyDetailsRequest
from models.responses import (
    PublicRemarksResponse,
    ExtractedFeatures,
    UsageMetrics,
    AIProvider
)
from utils.prompt_templates import (
    PUBLIC_REMARKS_SYSTEM,
    format_public_remarks_prompt,
    PHOTO_ANALYSIS_PROMPT
)

logger = logging.getLogger(__name__)


class OpenAIServiceError(Exception):
    """Custom exception for OpenAI service errors."""
    pass


class OpenAIService:
    """
    OpenAI GPT-4.1 Vision Service

    Handles:
    - Photo analysis and feature extraction
    - Public remarks (listing description) generation
    """

    def __init__(self):
        self.api_key = settings.openai_api_key
        self.model = GPT41_CONFIG.model_id
        self.config = GPT41_CONFIG

        # Initialize async client
        self.client = AsyncOpenAI(api_key=self.api_key) if self.api_key else None

        # Track usage
        self.total_tokens_used = 0
        self.total_cost = 0.0

        logger.info(f"OpenAI Service initialized with model: {self.model}")

    def _calculate_cost(self, input_tokens: int, output_tokens: int) -> float:
        """Calculate cost based on token usage."""
        input_cost = (input_tokens / 1000) * self.config.cost_per_1k_input
        output_cost = (output_tokens / 1000) * self.config.cost_per_1k_output
        return round(input_cost + output_cost, 6)

    def _prepare_images_for_vision(
        self,
        images: List[ImageInput]
    ) -> List[Dict[str, Any]]:
        """
        Prepare images for GPT-4.1 Vision API.

        Returns list of image content blocks in OpenAI format.
        """
        image_contents = []

        for idx, image in enumerate(images[:VISION_CONFIG["max_images"]]):
            if image.url:
                image_contents.append({
                    "type": "image_url",
                    "image_url": {
                        "url": image.url,
                        "detail": VISION_CONFIG["default_detail"]
                    }
                })
            elif image.base64:
                # Determine media type
                media_type = image.content_type or "image/jpeg"
                image_contents.append({
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:{media_type};base64,{image.base64}",
                        "detail": VISION_CONFIG["default_detail"]
                    }
                })

            logger.debug(f"Prepared image {idx + 1} for vision analysis")

        return image_contents

    def _parse_extracted_features(self, response_text: str) -> ExtractedFeatures:
        """Parse the extracted features from GPT response."""
        try:
            # Try to parse as JSON
            # Find JSON in response (may be wrapped in markdown code blocks)
            json_start = response_text.find('{')
            json_end = response_text.rfind('}') + 1

            if json_start != -1 and json_end > json_start:
                json_str = response_text[json_start:json_end]
                data = json.loads(json_str)

                return ExtractedFeatures(
                    bedrooms=data.get("bedrooms"),
                    bathrooms=data.get("bathrooms"),
                    kitchen_features=data.get("kitchen_features", []),
                    flooring_type=data.get("flooring_type", []),
                    ceiling_features=data.get("ceiling_features", []),
                    lighting=data.get("lighting", []),
                    windows=data.get("windows", []),
                    outdoor_spaces=data.get("outdoor_spaces", []),
                    amenities=data.get("amenities", []),
                    condition=data.get("condition"),
                    style=data.get("style"),
                    notable_features=data.get("notable_features", []),
                    confidence=data.get("confidence", {})
                )
        except (json.JSONDecodeError, KeyError) as e:
            logger.warning(f"Failed to parse features JSON: {e}")

        # Return empty features if parsing fails
        return ExtractedFeatures()

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((OpenAIServiceError, ConnectionError))
    )
    async def analyze_photos(
        self,
        images: List[ImageInput]
    ) -> ExtractedFeatures:
        """
        Analyze property photos using GPT-4.1 Vision.

        Extracts:
        - Room counts (bedrooms, bathrooms)
        - Kitchen features
        - Flooring types
        - Amenities
        - Overall condition
        - Architectural style
        """
        if not self.client:
            raise OpenAIServiceError("OpenAI client not initialized - check API key")

        start_time = time.time()
        logger.info(f"Analyzing {len(images)} photos with GPT-4.1 Vision")

        # Prepare images
        image_contents = self._prepare_images_for_vision(images)

        if not image_contents:
            logger.warning("No valid images to analyze")
            return ExtractedFeatures()

        try:
            # Build message content with images and prompt
            content = image_contents + [{"type": "text", "text": PHOTO_ANALYSIS_PROMPT}]

            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "user",
                        "content": content
                    }
                ],
                max_tokens=2000,
                temperature=0.3  # Lower temperature for more factual analysis
            )

            # Parse response
            response_text = response.choices[0].message.content
            features = self._parse_extracted_features(response_text)

            # Log usage
            usage = response.usage
            elapsed_ms = int((time.time() - start_time) * 1000)

            logger.info(
                f"Photo analysis complete in {elapsed_ms}ms. "
                f"Tokens: {usage.total_tokens if usage else 'N/A'}"
            )

            return features

        except Exception as e:
            logger.error(f"Error analyzing photos: {e}")
            raise OpenAIServiceError(f"Photo analysis failed: {str(e)}")

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((OpenAIServiceError, ConnectionError))
    )
    async def generate_public_remarks(
        self,
        property_details: PropertyDetailsRequest,
        max_words: int = 250,
        analyze_photos: bool = True,
        highlight_features: Optional[List[str]] = None
    ) -> PublicRemarksResponse:
        """
        Generate public remarks (listing description) using GPT-4.1 Vision.

        If analyze_photos is True, will first analyze property photos
        to extract features, then use those features to write the description.
        """
        if not self.client:
            raise OpenAIServiceError("OpenAI client not initialized - check API key")

        start_time = time.time()
        request_id = f"openai_{int(time.time() * 1000)}"

        logger.info(
            f"Generating public remarks with GPT-4.1 Vision. "
            f"Photos: {len(property_details.photos)}, Max words: {max_words}"
        )

        # Step 1: Analyze photos if enabled and photos provided
        extracted_features = None
        photos_analyzed = 0

        if analyze_photos and property_details.photos:
            try:
                extracted_features = await self.analyze_photos(property_details.photos)
                photos_analyzed = len(property_details.photos)
            except Exception as e:
                logger.warning(f"Photo analysis failed, continuing without: {e}")

        # Step 2: Generate the listing description
        try:
            # Format the prompt
            prompt = format_public_remarks_prompt(
                address=property_details.address.full_address,
                bedrooms=property_details.bedrooms or (extracted_features.bedrooms if extracted_features else None),
                bathrooms=property_details.bathrooms or (extracted_features.bathrooms if extracted_features else None),
                square_feet=property_details.square_feet,
                year_built=property_details.year_built,
                property_type=property_details.property_type.value.replace("_", " ").title(),
                max_words=max_words,
                highlight_features=highlight_features
            )

            # Prepare message content
            content = []

            # Add images if available
            if property_details.photos:
                image_contents = self._prepare_images_for_vision(property_details.photos)
                content.extend(image_contents)

            # Add text prompt
            content.append({"type": "text", "text": prompt})

            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": PUBLIC_REMARKS_SYSTEM},
                    {"role": "user", "content": content}
                ],
                max_tokens=self.config.max_tokens,
                temperature=self.config.temperature
            )

            # Extract response
            generated_text = response.choices[0].message.content.strip()
            word_count = len(generated_text.split())

            # Calculate usage and cost
            usage_data = response.usage
            input_tokens = usage_data.prompt_tokens if usage_data else 0
            output_tokens = usage_data.completion_tokens if usage_data else 0
            elapsed_ms = int((time.time() - start_time) * 1000)

            cost = self._calculate_cost(input_tokens, output_tokens)

            usage = UsageMetrics(
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                total_tokens=input_tokens + output_tokens,
                cost_usd=cost,
                generation_time_ms=elapsed_ms,
                model_used=self.model,
                provider=AIProvider.OPENAI,
                is_fallback=False
            )

            # Update tracking
            self.total_tokens_used += usage.total_tokens
            self.total_cost += usage.cost_usd

            logger.info(
                f"Public remarks generated. Words: {word_count}, "
                f"Tokens: {usage.total_tokens}, Cost: ${usage.cost_usd:.4f}"
            )

            return PublicRemarksResponse(
                success=True,
                text=generated_text,
                word_count=word_count,
                extracted_features=extracted_features,
                photos_analyzed=photos_analyzed,
                usage=usage,
                request_id=request_id
            )

        except Exception as e:
            logger.error(f"Error generating public remarks: {e}")
            raise OpenAIServiceError(f"Failed to generate public remarks: {str(e)}")

    async def health_check(self) -> Dict[str, Any]:
        """Check if OpenAI service is available."""
        status = "healthy" if self.api_key and self.client else "no_api_key"

        # Optionally test the connection
        if self.client and status == "healthy":
            try:
                # Quick test - list models (lightweight call)
                await self.client.models.list()
            except Exception as e:
                status = f"error: {str(e)[:50]}"

        return {
            "service": "openai",
            "model": self.model,
            "status": status,
            "features": self.config.special_features,
            "total_tokens_used": self.total_tokens_used,
            "total_cost_usd": round(self.total_cost, 4)
        }


# Singleton instance
_openai_service: Optional[OpenAIService] = None


def get_openai_service() -> OpenAIService:
    """Get or create OpenAI service singleton."""
    global _openai_service
    if _openai_service is None:
        _openai_service = OpenAIService()
    return _openai_service
