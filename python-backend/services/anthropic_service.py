"""
Listing Magic - Anthropic Claude Sonnet 4.5 Service

Claude Sonnet 4.5 is Anthropic's latest model.
Used for:
- Video walk-thru script generation
- Natural, conversational narration

Key capabilities:
- Most natural-sounding narration
- Excellent pacing and flow
- Emotional engagement
- Conversational tone perfect for video content
"""

import logging
import time
from typing import List, Optional, Dict, Any

import anthropic
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type
)

from config import settings, CLAUDE_SONNET_CONFIG
from models.requests import ImageInput, PropertyDetailsRequest
from models.responses import (
    WalkthruScriptResponse,
    UsageMetrics,
    AIProvider
)
from services.openai_service import get_openai_service, OpenAIServiceError
from utils.prompt_templates import (
    WALKTHRU_SCRIPT_SYSTEM,
    format_walkthru_prompt
)

logger = logging.getLogger(__name__)


class AnthropicServiceError(Exception):
    """Custom exception for Anthropic service errors."""
    pass


class AnthropicService:
    """
    Anthropic Claude Sonnet 4.5 Service

    Handles:
    - Video walk-thru script generation
    - Natural narration with proper pacing
    """

    def __init__(self):
        self.api_key = settings.anthropic_api_key
        self.model = CLAUDE_SONNET_CONFIG.model_id
        self.config = CLAUDE_SONNET_CONFIG

        # Initialize client
        self.client = anthropic.AsyncAnthropic(api_key=self.api_key) if self.api_key else None

        # Track usage
        self.total_tokens_used = 0
        self.total_cost = 0.0

        logger.info(f"Anthropic Service initialized with model: {self.model}")

    def _calculate_cost(self, input_tokens: int, output_tokens: int) -> float:
        """Calculate cost based on token usage."""
        input_cost = (input_tokens / 1000) * self.config.cost_per_1k_input
        output_cost = (output_tokens / 1000) * self.config.cost_per_1k_output
        return round(input_cost + output_cost, 6)

    def _estimate_speaking_duration(self, text: str) -> int:
        """
        Estimate speaking duration for narration.

        Average speaking rate: ~150 words per minute for natural narration.
        """
        word_count = len(text.split())
        # 150 words per minute = 2.5 words per second
        seconds = int(word_count / 2.5)
        return seconds

    def _prepare_images_for_claude(
        self,
        images: List[ImageInput]
    ) -> List[Dict[str, Any]]:
        """
        Prepare images for Claude's vision API.

        Returns list of image content blocks in Anthropic format.
        """
        image_contents = []

        for image in images:
            if image.base64:
                media_type = image.content_type or "image/jpeg"
                image_contents.append({
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": media_type,
                        "data": image.base64
                    }
                })

        return image_contents

    def _parse_script_sections(self, script_text: str) -> List[Dict[str, str]]:
        """Parse the script into sections based on markers."""
        sections = []
        current_section = None
        current_content = []

        # Section markers to look for
        section_markers = {
            "[INTRO]": "Introduction",
            "[LIVING]": "Living Areas",
            "[KITCHEN]": "Kitchen",
            "[PRIMARY]": "Primary Suite",
            "[ADDITIONAL]": "Additional Spaces",
            "[OUTDOOR]": "Outdoor",
            "[CLOSING]": "Closing"
        }

        for line in script_text.split('\n'):
            line_stripped = line.strip()

            # Check if this is a section marker
            found_marker = False
            for marker, name in section_markers.items():
                if marker in line_stripped.upper():
                    # Save previous section
                    if current_section and current_content:
                        sections.append({
                            "name": current_section,
                            "content": '\n'.join(current_content).strip()
                        })
                    current_section = name
                    current_content = []
                    found_marker = True
                    break

            if not found_marker and current_section:
                current_content.append(line)

        # Save last section
        if current_section and current_content:
            sections.append({
                "name": current_section,
                "content": '\n'.join(current_content).strip()
            })

        # If no sections found, treat entire text as one section
        if not sections:
            sections.append({
                "name": "Full Script",
                "content": script_text.strip()
            })

        return sections

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((AnthropicServiceError, ConnectionError))
    )
    async def generate_walkthru_script(
        self,
        property_details: PropertyDetailsRequest,
        duration_seconds: int = 120,
        style: str = "conversational",
        include_intro: bool = True,
        include_outro: bool = True,
        public_remarks: Optional[str] = None
    ) -> WalkthruScriptResponse:
        """
        Generate video walk-thru script using Claude Sonnet 4.5.

        Creates natural, conversational narration perfect for property
        tour videos with proper pacing and transitions.
        """
        if not self.client:
            raise AnthropicServiceError("Anthropic client not initialized - check API key")

        start_time = time.time()
        request_id = f"anthropic_{int(time.time() * 1000)}"

        logger.info(
            f"Generating walk-thru script with Claude Sonnet 4.5. "
            f"Target duration: {duration_seconds}s, Style: {style}"
        )

        try:
            # Build features list from property details
            features = []
            if property_details.features:
                features = property_details.features
            if property_details.bedrooms:
                features.append(f"{property_details.bedrooms} bedrooms")
            if property_details.bathrooms:
                features.append(f"{property_details.bathrooms} bathrooms")

            # Format the prompt
            prompt = format_walkthru_prompt(
                address=property_details.address.full_address,
                bedrooms=property_details.bedrooms,
                bathrooms=property_details.bathrooms,
                square_feet=property_details.square_feet,
                features=features,
                public_remarks=public_remarks,
                duration_seconds=duration_seconds,
                style=style
            )

            # Build message content
            content = []

            # Add images if available (Claude can use them for context)
            if property_details.photos:
                image_contents = self._prepare_images_for_claude(property_details.photos)
                content.extend(image_contents)

            # Add text prompt
            content.append({
                "type": "text",
                "text": prompt
            })

            # Call Claude API
            response = await self.client.messages.create(
                model=self.model,
                max_tokens=self.config.max_tokens,
                system=WALKTHRU_SCRIPT_SYSTEM,
                messages=[
                    {"role": "user", "content": content}
                ]
            )

            # Extract response text
            generated_script = ""
            for block in response.content:
                if block.type == "text":
                    generated_script += block.text

            generated_script = generated_script.strip()
            word_count = len(generated_script.split())
            estimated_duration = self._estimate_speaking_duration(generated_script)

            # Parse sections
            sections = self._parse_script_sections(generated_script)

            # Calculate usage and cost
            input_tokens = response.usage.input_tokens
            output_tokens = response.usage.output_tokens
            elapsed_ms = int((time.time() - start_time) * 1000)

            cost = self._calculate_cost(input_tokens, output_tokens)

            usage = UsageMetrics(
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                total_tokens=input_tokens + output_tokens,
                cost_usd=cost,
                generation_time_ms=elapsed_ms,
                model_used=self.model,
                provider=AIProvider.ANTHROPIC,
                is_fallback=False
            )

            # Update tracking
            self.total_tokens_used += usage.total_tokens
            self.total_cost += usage.cost_usd

            logger.info(
                f"Walk-thru script generated. Words: {word_count}, "
                f"Duration: {estimated_duration}s, Tokens: {usage.total_tokens}, "
                f"Cost: ${usage.cost_usd:.4f}"
            )

            return WalkthruScriptResponse(
                success=True,
                script=generated_script,
                word_count=word_count,
                estimated_duration_seconds=estimated_duration,
                sections=sections,
                usage=usage,
                request_id=request_id
            )

        except anthropic.APIError as e:
            logger.error(f"Anthropic API error: {e}")
            # Fallback to OpenAI
            logger.warning("Anthropic API failed, attempting fallback to OpenAI...")
            try:
                openai_service = get_openai_service()
                return await openai_service.generate_walkthru_script(
                    property_details=property_details,
                    duration_seconds=duration_seconds,
                    style=style,
                    include_intro=include_intro,
                    include_outro=include_outro,
                    public_remarks=public_remarks
                )
            except Exception as fallback_error:
                logger.error(f"Fallback to OpenAI also failed: {fallback_error}")
                raise AnthropicServiceError(f"Claude API error: {str(e)}. Fallback failed: {str(fallback_error)}")

        except Exception as e:
            logger.error(f"Error generating walk-thru script: {e}")
            # Fallback to OpenAI
            logger.warning("Anthropic service failed, attempting fallback to OpenAI...")
            try:
                openai_service = get_openai_service()
                return await openai_service.generate_walkthru_script(
                    property_details=property_details,
                    duration_seconds=duration_seconds,
                    style=style,
                    include_intro=include_intro,
                    include_outro=include_outro,
                    public_remarks=public_remarks
                )
            except Exception as fallback_error:
                logger.error(f"Fallback to OpenAI also failed: {fallback_error}")
                raise AnthropicServiceError(f"Failed to generate walk-thru script: {str(e)}. Fallback failed: {str(fallback_error)}")

    async def health_check(self) -> Dict[str, Any]:
        """Check if Anthropic service is available."""
        status = "healthy" if self.api_key and self.client else "no_api_key"

        return {
            "service": "anthropic",
            "model": self.model,
            "status": status,
            "features": self.config.special_features,
            "total_tokens_used": self.total_tokens_used,
            "total_cost_usd": round(self.total_cost, 4)
        }


# Singleton instance
_anthropic_service: Optional[AnthropicService] = None


def get_anthropic_service() -> AnthropicService:
    """Get or create Anthropic service singleton."""
    global _anthropic_service
    if _anthropic_service is None:
        _anthropic_service = AnthropicService()
    return _anthropic_service
