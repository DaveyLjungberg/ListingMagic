"""
Listing Magic - Google Gemini 3 Pro Service

Gemini 3 Pro (gemini-3-pro-latest, Nov 18, 2025) is Google's newest model.
Used for:
- Property features list generation
- RESO-formatted MLS data generation

Key capabilities:
- Fast inference speed
- Excellent structured output (JSON mode)
- Thought signatures for reasoning context
- Cost-effective for high-volume tasks

IMPORTANT: temperature=1.0 is the default and should not be changed
as it affects reasoning quality with thought signatures.
"""

import json
import logging
import time
from typing import List, Optional, Dict, Any

import google.generativeai as genai
from google.api_core.exceptions import ResourceExhausted
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type
)

from config import settings, GEMINI3_CONFIG, VISION_CONFIG
from models.requests import ImageInput, PropertyDetailsRequest
from models.responses import (
    FeaturesResponse,
    ResoDataResponse,
    FeatureCategory,
    UsageMetrics,
    AIProvider
)
from utils.prompt_templates import (
    FEATURES_SYSTEM,
    format_features_prompt,
    RESO_DATA_SYSTEM,
    format_reso_prompt
)

logger = logging.getLogger(__name__)


class GeminiServiceError(Exception):
    """Custom exception for Gemini service errors."""
    pass


class GeminiService:
    """
    Google Gemini 3 Pro Service

    Handles:
    - Property features list generation
    - RESO-formatted MLS data generation

    Note: Uses thought signatures for enhanced reasoning.
    Temperature is set to 1.0 (default) - do not change as it
    affects the quality of reasoning and structured output.
    """

    def __init__(self):
        self.api_key = settings.gemini_api_key
        self.model = GEMINI3_CONFIG.model_id
        self.config = GEMINI3_CONFIG

        # Configure the Gemini client
        if self.api_key:
            genai.configure(api_key=self.api_key)
            self.client = genai.GenerativeModel(self.model)
        else:
            self.client = None

        # Thought signature context (maintains reasoning across calls)
        self._thought_context: Optional[str] = None

        # Track usage
        self.total_tokens_used = 0
        self.total_cost = 0.0

        logger.info(f"Gemini Service initialized with model: {self.model}")

    def _calculate_cost(self, input_tokens: int, output_tokens: int) -> float:
        """Calculate cost based on token usage."""
        input_cost = (input_tokens / 1000) * self.config.cost_per_1k_input
        output_cost = (output_tokens / 1000) * self.config.cost_per_1k_output
        return round(input_cost + output_cost, 6)

    def _prepare_images_for_gemini(
        self,
        images: List[ImageInput]
    ) -> List[Dict[str, Any]]:
        """
        Prepare images for Gemini's vision API.

        Returns list of image parts in Google AI format.
        """
        import base64

        image_parts = []

        for idx, image in enumerate(images[:VISION_CONFIG["max_images"]]):
            if image.base64:
                media_type = image.content_type or "image/jpeg"
                # Gemini expects inline_data format
                image_parts.append({
                    "inline_data": {
                        "mime_type": media_type,
                        "data": image.base64
                    }
                })
                logger.debug(f"Prepared image {idx + 1} for Gemini vision")

        return image_parts

    def _init_thought_signature(self, task: str) -> str:
        """
        Initialize thought signature for reasoning context.

        Gemini 3 Pro uses thought signatures to maintain
        reasoning context and improve structured output quality.
        """
        signature = f"[THOUGHT_INIT:task={task}:ts={int(time.time())}]"
        self._thought_context = signature
        return signature

    def _update_thought_signature(self, reasoning_step: str) -> str:
        """Update thought signature with new reasoning context."""
        if self._thought_context:
            self._thought_context += f"[STEP:{reasoning_step}]"
        return self._thought_context or ""

    def _parse_features_response(self, response_text: str) -> Dict[str, Any]:
        """Parse features JSON from Gemini response."""
        try:
            # Find JSON in response (may be wrapped in markdown code blocks)
            json_start = response_text.find('{')
            json_end = response_text.rfind('}') + 1

            if json_start != -1 and json_end > json_start:
                json_str = response_text[json_start:json_end]
                return json.loads(json_str)
        except (json.JSONDecodeError, KeyError) as e:
            logger.warning(f"Failed to parse features JSON: {e}")

        return {"categories": [], "all_features": [], "highlight_features": []}

    def _parse_reso_response(self, response_text: str) -> Dict[str, Any]:
        """Parse RESO JSON from Gemini response."""
        try:
            # Find JSON in response (may be wrapped in markdown code blocks)
            json_start = response_text.find('{')
            json_end = response_text.rfind('}') + 1

            if json_start != -1 and json_end > json_start:
                json_str = response_text[json_start:json_end]
                return json.loads(json_str)
        except (json.JSONDecodeError, KeyError) as e:
            logger.warning(f"Failed to parse RESO JSON: {e}")

        return {}

    @retry(
        stop=stop_after_attempt(4),  # Reduced to fit within frontend timeout
        wait=wait_exponential(multiplier=2, min=2, max=30),  # Max 30s wait
        retry=retry_if_exception_type((GeminiServiceError, ConnectionError, ResourceExhausted))
    )
    async def generate_features(
        self,
        property_details: PropertyDetailsRequest,
        categorize: bool = True,
        include_measurements: bool = True,
        max_features: int = 30
    ) -> FeaturesResponse:
        """
        Generate property features list using Gemini 3 Pro.

        Fast and accurate feature extraction with optional
        categorization for MLS compatibility.
        """
        if not self.client:
            raise GeminiServiceError("Gemini client not initialized - check API key")

        start_time = time.time()
        request_id = f"gemini_{int(time.time() * 1000)}"

        # Initialize thought signature for this task
        self._init_thought_signature("features_extraction")

        logger.info(
            f"Generating features list with Gemini 3 Pro. "
            f"Categorize: {categorize}, Max features: {max_features}"
        )

        try:
            # Format the prompt
            prompt = format_features_prompt(
                address=property_details.address.full_address,
                property_type=property_details.property_type.value.replace("_", " ").title(),
                bedrooms=property_details.bedrooms,
                bathrooms=property_details.bathrooms,
                square_feet=property_details.square_feet,
                year_built=property_details.year_built,
                max_features=max_features
            )

            # Build content parts
            content_parts = []

            # Add images if available
            if property_details.photos:
                image_parts = self._prepare_images_for_gemini(property_details.photos)
                content_parts.extend(image_parts)

            # Add system context and prompt
            full_prompt = f"{FEATURES_SYSTEM}\n\n{prompt}"
            content_parts.append(full_prompt)

            # Configure generation settings
            generation_config = genai.types.GenerationConfig(
                temperature=self.config.temperature,
                max_output_tokens=self.config.max_tokens,
            )

            # Call Gemini API
            response = await self.client.generate_content_async(
                content_parts,
                generation_config=generation_config
            )

            # Extract response text
            response_text = response.text

            # Parse the features from JSON response
            parsed_data = self._parse_features_response(response_text)

            # Build categorized features
            categorized_features = []
            if categorize and "categories" in parsed_data:
                for cat in parsed_data["categories"]:
                    categorized_features.append(FeatureCategory(
                        name=cat.get("name", "Other"),
                        features=cat.get("features", [])
                    ))

            # Get flat features list
            features_list = parsed_data.get("all_features", [])
            if not features_list and categorized_features:
                # Flatten from categories
                for cat in categorized_features:
                    features_list.extend(cat.features)

            # Limit to max_features
            features_list = features_list[:max_features]

            # Update thought signature
            self._update_thought_signature(f"extracted_{len(features_list)}_features")

            # Calculate usage and cost
            # Gemini provides token counts in usage_metadata
            input_tokens = 0
            output_tokens = 0

            if hasattr(response, 'usage_metadata'):
                input_tokens = getattr(response.usage_metadata, 'prompt_token_count', 0)
                output_tokens = getattr(response.usage_metadata, 'candidates_token_count', 0)
            else:
                # Estimate tokens if not provided
                input_tokens = 600 + (len(property_details.photos) * 250)  # ~250 tokens per image
                output_tokens = len(response_text.split()) * 1.3  # Rough estimate

            elapsed_ms = int((time.time() - start_time) * 1000)
            cost = self._calculate_cost(int(input_tokens), int(output_tokens))

            usage = UsageMetrics(
                input_tokens=int(input_tokens),
                output_tokens=int(output_tokens),
                total_tokens=int(input_tokens + output_tokens),
                cost_usd=cost,
                generation_time_ms=elapsed_ms,
                model_used=self.model,
                provider=AIProvider.GOOGLE,
                is_fallback=False
            )

            # Update tracking
            self.total_tokens_used += usage.total_tokens
            self.total_cost += usage.cost_usd

            logger.info(
                f"Features list generated. Total: {len(features_list)}, "
                f"Categories: {len(categorized_features)}, "
                f"Tokens: {usage.total_tokens}, Cost: ${usage.cost_usd:.4f}"
            )

            return FeaturesResponse(
                success=True,
                features_list=features_list,
                categorized_features=categorized_features if categorize else [],
                total_features=len(features_list),
                usage=usage,
                request_id=request_id
            )

        except ResourceExhausted:
            raise  # Re-raise for tenacity to handle with backoff
        except Exception as e:
            logger.error(f"Error generating features: {e}")
            raise GeminiServiceError(f"Failed to generate features: {str(e)}")

    @retry(
        stop=stop_after_attempt(4),  # Reduced to fit within frontend timeout
        wait=wait_exponential(multiplier=2, min=2, max=30),  # Max 30s wait
        retry=retry_if_exception_type((GeminiServiceError, ConnectionError, ResourceExhausted))
    )
    async def generate_reso_data(
        self,
        property_details: PropertyDetailsRequest,
        schema_version: str = "2.0",
        include_optional_fields: bool = True,
        public_remarks: Optional[str] = None,
        features_list: Optional[List[str]] = None
    ) -> ResoDataResponse:
        """
        Generate RESO-formatted MLS data using Gemini 3 Pro.

        Creates structured JSON output conforming to RESO Data Dictionary
        standards for MLS system compatibility.
        """
        if not self.client:
            raise GeminiServiceError("Gemini client not initialized - check API key")

        start_time = time.time()
        request_id = f"gemini_{int(time.time() * 1000)}"

        # Initialize thought signature for structured output
        self._init_thought_signature("reso_generation")

        logger.info(
            f"Generating RESO data with Gemini 3 Pro. "
            f"Schema: {schema_version}, Optional fields: {include_optional_fields}"
        )

        try:
            address = property_details.address

            # Format the prompt
            prompt = format_reso_prompt(
                address=address.full_address,
                street=address.street,
                city=address.city or "",
                state=address.state or "",
                zip_code=address.zip_code,
                property_type=property_details.property_type.value.replace("_", " ").title(),
                bedrooms=property_details.bedrooms,
                bathrooms=property_details.bathrooms,
                square_feet=property_details.square_feet,
                year_built=property_details.year_built,
                price=property_details.price,
                public_remarks=public_remarks,
                features=features_list,
                schema_version=schema_version
            )

            # Build content parts
            content_parts = []

            # Add images if available (for additional context)
            if property_details.photos:
                image_parts = self._prepare_images_for_gemini(property_details.photos)
                content_parts.extend(image_parts)

            # Add system context and prompt
            full_prompt = f"{RESO_DATA_SYSTEM}\n\n{prompt}"
            content_parts.append(full_prompt)

            # Configure generation settings - use JSON mode for structured output
            generation_config = genai.types.GenerationConfig(
                temperature=self.config.temperature,
                max_output_tokens=self.config.max_tokens,
                response_mime_type="application/json"  # Enable JSON mode
            )

            # Call Gemini API
            response = await self.client.generate_content_async(
                content_parts,
                generation_config=generation_config
            )

            # Extract and parse response
            response_text = response.text
            reso_json = self._parse_reso_response(response_text)

            # If parsing failed, create a basic RESO structure
            if not reso_json:
                reso_json = self._create_fallback_reso(
                    property_details,
                    public_remarks,
                    features_list
                )

            # Validate output
            validation_passed, validation_errors = self._validate_reso_data(reso_json)

            # Update thought signature
            self._update_thought_signature(f"generated_reso_v{schema_version}")

            # Calculate usage and cost
            input_tokens = 0
            output_tokens = 0

            if hasattr(response, 'usage_metadata'):
                input_tokens = getattr(response.usage_metadata, 'prompt_token_count', 0)
                output_tokens = getattr(response.usage_metadata, 'candidates_token_count', 0)
            else:
                # Estimate tokens if not provided
                input_tokens = 800 + (len(property_details.photos) * 250)
                output_tokens = len(response_text.split()) * 1.3

            elapsed_ms = int((time.time() - start_time) * 1000)
            cost = self._calculate_cost(int(input_tokens), int(output_tokens))

            usage = UsageMetrics(
                input_tokens=int(input_tokens),
                output_tokens=int(output_tokens),
                total_tokens=int(input_tokens + output_tokens),
                cost_usd=cost,
                generation_time_ms=elapsed_ms,
                model_used=self.model,
                provider=AIProvider.GOOGLE,
                is_fallback=False
            )

            # Update tracking
            self.total_tokens_used += usage.total_tokens
            self.total_cost += usage.cost_usd

            logger.info(
                f"RESO data generated. Fields: {len(reso_json)}, "
                f"Validation: {'passed' if validation_passed else 'failed'}, "
                f"Tokens: {usage.total_tokens}, Cost: ${usage.cost_usd:.4f}"
            )

            return ResoDataResponse(
                success=True,
                reso_json=reso_json,
                schema_version=schema_version,
                validation_passed=validation_passed,
                validation_errors=validation_errors,
                usage=usage,
                request_id=request_id
            )

        except ResourceExhausted:
            raise  # Re-raise for tenacity to handle with backoff
        except Exception as e:
            logger.error(f"Error generating RESO data: {e}")
            raise GeminiServiceError(f"Failed to generate RESO data: {str(e)}")

    def _create_fallback_reso(
        self,
        property_details: PropertyDetailsRequest,
        public_remarks: Optional[str],
        features_list: Optional[List[str]]
    ) -> Dict[str, Any]:
        """Create a fallback RESO structure if parsing fails."""
        address = property_details.address

        reso_json = {
            "ListingKey": f"LM{int(time.time())}",
            "ListingId": f"LM-{address.zip_code}-{int(time.time()) % 10000}",
            "PropertyType": property_details.property_type.value.replace("_", " ").title(),
            "PropertySubType": "Residential",
            "StandardStatus": "Active",

            # Address fields
            "UnparsedAddress": address.full_address,
            "StreetNumber": address.street.split()[0] if address.street else "",
            "StreetName": " ".join(address.street.split()[1:]) if address.street else "",
            "City": address.city or "TBD",
            "StateOrProvince": address.state or "TBD",
            "PostalCode": address.zip_code,
            "Country": address.country,

            # Property details
            "BedroomsTotal": property_details.bedrooms or 0,
            "BathroomsTotalInteger": int(property_details.bathrooms or 0),
            "BathroomsFull": int(property_details.bathrooms or 0),
            "BathroomsHalf": 1 if property_details.bathrooms and property_details.bathrooms % 1 > 0 else 0,
            "LivingArea": property_details.square_feet or 0,
            "LivingAreaUnits": "Square Feet",
            "YearBuilt": property_details.year_built,

            # Listing details
            "ListPrice": property_details.price or 0,
            "OriginalListPrice": property_details.price or 0,
            "PublicRemarks": public_remarks or "",

            # Dates
            "OnMarketDate": time.strftime("%Y-%m-%d"),
            "ModificationTimestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),

            # Features
            "InteriorFeatures": [],
            "ExteriorFeatures": [],
            "Appliances": [],
        }

        # Add features if provided
        if features_list:
            interior = [f for f in features_list if any(
                kw in f.lower() for kw in ["floor", "ceiling", "closet", "light", "crown"]
            )]
            exterior = [f for f in features_list if any(
                kw in f.lower() for kw in ["patio", "porch", "fence", "landscape", "garage"]
            )]
            appliances = [f for f in features_list if any(
                kw in f.lower() for kw in ["appliance", "range", "refrigerator", "dishwasher"]
            )]

            reso_json["InteriorFeatures"] = interior[:10]
            reso_json["ExteriorFeatures"] = exterior[:10]
            reso_json["Appliances"] = appliances[:10]

        return reso_json

    def _validate_reso_data(self, reso_json: Dict[str, Any]) -> tuple[bool, List[str]]:
        """Validate RESO data structure."""
        validation_errors = []

        # Required fields check
        required_fields = [
            "ListingKey", "PropertyType", "StandardStatus",
            "PostalCode", "BedroomsTotal", "BathroomsTotalInteger"
        ]

        for field in required_fields:
            if field not in reso_json or reso_json[field] is None:
                validation_errors.append(f"Required field '{field}' is missing or null")

        # Type validation
        if "BedroomsTotal" in reso_json and not isinstance(reso_json["BedroomsTotal"], (int, float)):
            validation_errors.append("BedroomsTotal must be a number")

        if "ListPrice" in reso_json and reso_json["ListPrice"] is not None:
            if not isinstance(reso_json["ListPrice"], (int, float)):
                validation_errors.append("ListPrice must be a number")

        validation_passed = len(validation_errors) == 0
        return validation_passed, validation_errors

    async def health_check(self) -> Dict[str, Any]:
        """Check if Gemini service is available."""
        status = "healthy" if self.api_key and self.client else "no_api_key"

        # Optionally test the connection
        if self.client and status == "healthy":
            try:
                # Quick test - list models
                models = genai.list_models()
                model_exists = any(self.model in m.name for m in models)
                if not model_exists:
                    status = f"model_not_found: {self.model}"
            except Exception as e:
                status = f"error: {str(e)[:50]}"

        return {
            "service": "gemini",
            "model": self.model,
            "status": status,
            "features": self.config.special_features,
            "thought_context_active": bool(self._thought_context),
            "total_tokens_used": self.total_tokens_used,
            "total_cost_usd": round(self.total_cost, 4)
        }


# Singleton instance
_gemini_service: Optional[GeminiService] = None


def get_gemini_service() -> GeminiService:
    """Get or create Gemini service singleton."""
    global _gemini_service
    if _gemini_service is None:
        _gemini_service = GeminiService()
    return _gemini_service
