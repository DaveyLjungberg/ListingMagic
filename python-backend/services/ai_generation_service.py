"""
Listing Magic - Unified AI Generation Service

This is the SINGLE source of truth for all AI generation with fallback logic.
All generation endpoints MUST use this service.

Primary Model: OpenAI gpt-5.2
Fallback Model: Google Gemini gemini-2.0-flash

FALLBACK RULES (CRITICAL):
- Gemini is ONLY used when OpenAI fails due to INFRASTRUCTURE issues:
  - Network errors / connection failures
  - Timeouts
  - 5xx server errors
  - Rate limit errors (429)

- Gemini is NOT used for CONTENT issues:
  - Fair Housing violations
  - JSON/schema validation errors
  - Empty or low-quality output
  - Any error where OpenAI successfully responded

The frontend MUST NOT know which provider was used (transparent fallback).
"""

import json
import logging
import time
import base64
from typing import List, Optional, Dict, Any, Literal, Tuple
from dataclasses import dataclass
from enum import Enum

import httpx
from openai import AsyncOpenAI, APIError, APIConnectionError, RateLimitError, APITimeoutError
import google.generativeai as genai
from google.api_core.exceptions import (
    ResourceExhausted,
    ServiceUnavailable,
    DeadlineExceeded,
    GoogleAPIError
)

from config import settings

logger = logging.getLogger(__name__)


# =============================================================================
# Constants - Model Configuration
# =============================================================================

# Primary model (OpenAI)
OPENAI_MODEL = "gpt-5.2"

# Fallback model (Gemini)
GEMINI_MODEL = "gemini-2.0-flash"

# Task types
TaskType = Literal["public_remarks", "features", "mls"]


# =============================================================================
# Response Data Classes
# =============================================================================

@dataclass
class GenerationResult:
    """Result from AI generation."""
    success: bool
    content: str
    provider_used: str  # "openai" or "gemini"
    model_used: str     # Actual model ID
    generation_time_ms: int
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
    is_fallback: bool = False
    error: Optional[str] = None


class InfrastructureError(Exception):
    """
    Raised when an AI provider fails due to infrastructure issues.
    These errors SHOULD trigger fallback to another provider.
    """
    pass


class ContentError(Exception):
    """
    Raised when generation fails due to content issues.
    These errors should NOT trigger fallback - they need to be fixed at the source.
    """
    pass


# =============================================================================
# Helper Functions
# =============================================================================

def is_infrastructure_error(error: Exception) -> bool:
    """
    Determine if an error is an infrastructure issue (should trigger fallback)
    vs a content issue (should NOT trigger fallback).

    INFRASTRUCTURE ERRORS (trigger fallback):
    - Network/connection errors
    - Timeouts
    - 5xx server errors
    - Rate limits (429)

    CONTENT ERRORS (do NOT trigger fallback):
    - 4xx client errors (except 429)
    - JSON parsing errors
    - Validation errors
    - Empty responses
    """
    # OpenAI infrastructure errors
    if isinstance(error, (APIConnectionError, APITimeoutError)):
        return True

    if isinstance(error, RateLimitError):
        return True

    if isinstance(error, APIError):
        # 5xx errors are infrastructure issues
        if hasattr(error, 'status_code') and error.status_code >= 500:
            return True
        # 429 is rate limiting - infrastructure issue
        if hasattr(error, 'status_code') and error.status_code == 429:
            return True
        return False

    # Google/Gemini infrastructure errors
    if isinstance(error, (ResourceExhausted, ServiceUnavailable, DeadlineExceeded)):
        return True

    # Network errors
    if isinstance(error, (ConnectionError, TimeoutError)):
        return True

    # httpx errors
    if isinstance(error, (httpx.ConnectError, httpx.TimeoutException)):
        return True

    return False


def clean_json_response(response_text: str) -> str:
    """Remove markdown code blocks from response if present."""
    text = response_text.strip()
    if text.startswith("```"):
        first_newline = text.find("\n")
        if first_newline != -1:
            text = text[first_newline + 1:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()
    return text


async def download_image_as_base64(url: str) -> Dict[str, str]:
    """Download an image from URL and convert to base64."""
    url = url.strip()
    # Support data URLs (used when frontend sends base64 photos).
    # Format: data:<mime_type>;base64,<data>
    if url.startswith("data:"):
        try:
            header, b64_data = url.split(",", 1)
            media_type = header.split(";", 1)[0].replace("data:", "").strip() or "image/jpeg"
            return {"data": b64_data, "media_type": media_type}
        except Exception:
            # Fall through to http fetch handling for unexpected formats
            pass
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
    }

    async with httpx.AsyncClient(headers=headers, timeout=30.0) as client:
        response = await client.get(url)
        response.raise_for_status()

        media_type = response.headers.get("content-type", "image/jpeg")
        if ";" in media_type:
            media_type = media_type.split(";")[0].strip()

        return {
            "data": base64.b64encode(response.content).decode("utf-8"),
            "media_type": media_type
        }


# =============================================================================
# OpenAI Generation (Primary) - Using Responses API
# =============================================================================

async def _generate_with_openai(
    system_prompt: str,
    user_prompt: str,
    photo_urls: List[str],
    temperature: float = 0.3,
    max_output_tokens: int = 1200
) -> Tuple[str, int, int]:
    """
    Generate content using OpenAI gpt-5.2.

    Uses the Responses API with vision support.
    IMPORTANT: Uses max_output_tokens (NOT max_tokens or max_completion_tokens).

    The Responses API expects input to be a list of message objects:
    input=[
        {
            "role": "user",
            "content": [
                {"type": "input_text", "text": "..."},
                {"type": "input_image", "image_url": "...", "detail": "high"},
            ]
        }
    ]

    Returns:
        Tuple of (content, input_tokens, output_tokens)

    Raises:
        InfrastructureError: For network/timeout/5xx/rate-limit errors
        Exception: For other errors (content issues)
    """
    if not settings.openai_api_key:
        raise InfrastructureError("OpenAI API key not configured")

    # === DEBUG: Log actual prompt received ===
    print(f"\n{'*'*60}")
    print(f"* OPENAI REQUEST DEBUG")
    print(f"* System prompt length: {len(system_prompt)} chars")
    print(f"* User prompt length: {len(user_prompt)} chars")
    print(f"* Photo URLs: {len(photo_urls)}")
    print(f"* User prompt preview: {user_prompt[:500]}...")
    if len(user_prompt) > 500:
        print(f"* User prompt end: ...{user_prompt[-200:]}")
    print(f"{'*'*60}\n")

    client = AsyncOpenAI(api_key=settings.openai_api_key)

    # Build content parts for the user message
    # The Responses API requires input to be message objects with role and content
    content_parts = []

    # Add text prompt first
    content_parts.append({
        "type": "input_text",
        "text": user_prompt
    })

    # Add images using input_image format
    for url in photo_urls:
        content_parts.append({
            "type": "input_image",
            "image_url": url,
            "detail": "high"
        })

    # Build the input as a list of message objects (required by Responses API)
    input_messages = [
        {
            "role": "user",
            "content": content_parts
        }
    ]

    try:
        # Use Responses API with max_output_tokens
        response = await client.responses.create(
            model=OPENAI_MODEL,
            instructions=system_prompt,
            input=input_messages,
            temperature=temperature,
            max_output_tokens=max_output_tokens
        )

        # Extract content from Responses API response
        content = response.output_text.strip() if response.output_text else ""

        # Extract token usage
        input_tokens = 0
        output_tokens = 0
        if hasattr(response, 'usage') and response.usage:
            input_tokens = getattr(response.usage, 'input_tokens', 0)
            output_tokens = getattr(response.usage, 'output_tokens', 0)

        return content, input_tokens, output_tokens

    except (APIConnectionError, APITimeoutError, RateLimitError) as e:
        logger.warning(f"OpenAI infrastructure error: {type(e).__name__}: {e}")
        raise InfrastructureError(f"OpenAI unavailable: {e}")

    except APIError as e:
        # Log 400 errors with input shape issues for debugging (no secrets)
        if hasattr(e, 'status_code') and e.status_code == 400:
            error_msg = str(e)
            if "invalid_value" in error_msg.lower() or "input" in error_msg.lower():
                logger.error(f"OpenAI 400 error - possible input shape issue: {error_msg[:500]}")

        if hasattr(e, 'status_code') and (e.status_code >= 500 or e.status_code == 429):
            logger.warning(f"OpenAI server error ({e.status_code}): {e}")
            raise InfrastructureError(f"OpenAI server error: {e}")
        raise  # Re-raise as content error


# =============================================================================
# Gemini Generation (Fallback)
# =============================================================================

async def _generate_with_gemini(
    system_prompt: str,
    user_prompt: str,
    photo_urls: List[str],
    temperature: float = 0.3,
    max_output_tokens: int = 1200
) -> Tuple[str, int, int]:
    """
    Generate content using Google Gemini gemini-2.0-flash.

    This is the FALLBACK provider - only called when OpenAI has infrastructure issues.

    Returns:
        Tuple of (content, input_tokens, output_tokens)
    """
    api_key = settings.gemini_api_key or settings.openai_api_key  # Fallback to check env
    if not api_key:
        raise InfrastructureError("Gemini API key not configured")

    genai.configure(api_key=settings.gemini_api_key)
    model = genai.GenerativeModel(GEMINI_MODEL)

    # Download images and convert to base64 (Gemini requires this)
    content_parts = []

    for url in photo_urls:
        try:
            img_data = await download_image_as_base64(url)
            content_parts.append({
                "mime_type": img_data["media_type"],
                "data": img_data["data"]
            })
        except Exception as e:
            logger.warning(f"Failed to download image {url}: {e}")
            continue

    # Combine system + user prompt (Gemini doesn't have separate system message)
    full_prompt = f"{system_prompt}\n\n{user_prompt}"
    content_parts.append(full_prompt)

    # Configure generation
    generation_config = genai.types.GenerationConfig(
        temperature=temperature,
        max_output_tokens=max_output_tokens
    )

    try:
        response = await model.generate_content_async(
            content_parts,
            generation_config=generation_config
        )

        content = response.text.strip()

        # Extract token counts if available
        input_tokens = 0
        output_tokens = 0
        if hasattr(response, 'usage_metadata'):
            input_tokens = getattr(response.usage_metadata, 'prompt_token_count', 0)
            output_tokens = getattr(response.usage_metadata, 'candidates_token_count', 0)

        return content, input_tokens, output_tokens

    except (ResourceExhausted, ServiceUnavailable, DeadlineExceeded) as e:
        logger.error(f"Gemini infrastructure error: {type(e).__name__}: {e}")
        raise InfrastructureError(f"Gemini unavailable: {e}")


# =============================================================================
# Unified Generation Function (MAIN ENTRY POINT)
# =============================================================================

async def generate_content_with_fallback(
    system_prompt: str,
    user_prompt: str,
    photo_urls: List[str],
    task_type: TaskType,
    temperature: float = 0.3,
    max_output_tokens: int = 1200
) -> GenerationResult:
    """
    Generate AI content with automatic fallback.

    This is the ONLY function that should be called for AI generation.
    All endpoints MUST use this function.

    Args:
        system_prompt: The system instructions for the AI
        user_prompt: The user request/prompt
        photo_urls: List of image URLs to analyze
        task_type: Type of task ("public_remarks", "features", "mls")
        temperature: Generation temperature (default 0.3)
        max_output_tokens: Max tokens in response (default 1200)

    Returns:
        GenerationResult with content and metadata

    Flow:
        1. Try OpenAI gpt-5.2 (primary)
        2. If infrastructure error -> try Gemini gemini-2.0-flash (fallback)
        3. If content error -> raise immediately (no fallback)
        4. If both fail -> raise the last error
    """
    start_time = time.time()

    # === DEBUG: Log what we received ===
    print(f"\n{'@'*60}")
    print(f"@ GENERATE_CONTENT_WITH_FALLBACK CALLED")
    print(f"@ Task type: {task_type}")
    print(f"@ System prompt length: {len(system_prompt)} chars")
    print(f"@ User prompt length: {len(user_prompt)} chars")
    print(f"@ Contains 'DOCUMENT CONTENT': {'DOCUMENT CONTENT' in user_prompt}")
    print(f"@ Photo URLs: {len(photo_urls)}")
    print(f"{'@'*60}\n")

    logger.info(f"[AIGeneration] Starting {task_type} generation with {len(photo_urls)} photos")

    # ==========================================================================
    # Step 1: Try OpenAI (Primary)
    # ==========================================================================
    try:
        logger.info(f"[AIGeneration] Attempting OpenAI {OPENAI_MODEL}")

        content, input_tokens, output_tokens = await _generate_with_openai(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            photo_urls=photo_urls,
            temperature=temperature,
            max_output_tokens=max_output_tokens
        )

        generation_time_ms = int((time.time() - start_time) * 1000)

        logger.info(
            f"[AIGeneration] OpenAI succeeded in {generation_time_ms}ms. "
            f"Tokens: {input_tokens} in / {output_tokens} out"
        )

        return GenerationResult(
            success=True,
            content=content,
            provider_used="openai",
            model_used=OPENAI_MODEL,
            generation_time_ms=generation_time_ms,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            is_fallback=False
        )

    except InfrastructureError as e:
        # OpenAI infrastructure failure - try Gemini fallback
        logger.warning(f"[AIGeneration] OpenAI infrastructure error, trying Gemini fallback: {e}")
        openai_error = str(e)

    except Exception as e:
        # Content error or other issue - do NOT fallback
        # These errors need to be fixed at the source, not worked around
        if not is_infrastructure_error(e):
            logger.error(f"[AIGeneration] OpenAI content error (no fallback): {e}")
            raise

        # It was an infrastructure error we didn't catch above
        logger.warning(f"[AIGeneration] OpenAI error, trying Gemini fallback: {e}")
        openai_error = str(e)

    # ==========================================================================
    # Step 2: Try Gemini (Fallback) - Only reached if OpenAI had infrastructure error
    # ==========================================================================
    try:
        logger.info(f"[AIGeneration] Attempting Gemini {GEMINI_MODEL} (fallback)")

        content, input_tokens, output_tokens = await _generate_with_gemini(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            photo_urls=photo_urls,
            temperature=temperature,
            max_output_tokens=max_output_tokens
        )

        generation_time_ms = int((time.time() - start_time) * 1000)

        logger.info(
            f"[AIGeneration] Gemini fallback succeeded in {generation_time_ms}ms. "
            f"Tokens: {input_tokens} in / {output_tokens} out"
        )

        return GenerationResult(
            success=True,
            content=content,
            provider_used="gemini",
            model_used=GEMINI_MODEL,
            generation_time_ms=generation_time_ms,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            is_fallback=True
        )

    except Exception as e:
        # Both providers failed
        logger.error(f"[AIGeneration] Both OpenAI and Gemini failed. Last error: {e}")

        generation_time_ms = int((time.time() - start_time) * 1000)

        return GenerationResult(
            success=False,
            content="",
            provider_used="none",
            model_used="none",
            generation_time_ms=generation_time_ms,
            is_fallback=True,
            error=f"All providers failed. OpenAI: {openai_error}. Gemini: {e}"
        )


# =============================================================================
# Convenience Functions for Specific Tasks
# =============================================================================

async def generate_public_remarks(
    system_prompt: str,
    user_prompt: str,
    photo_urls: List[str],
    max_words: int = 250
) -> GenerationResult:
    """Generate public remarks (listing description)."""
    # Adjust max tokens based on word count (~1.3 tokens per word)
    max_tokens = int(max_words * 1.5) + 200  # Buffer for formatting

    return await generate_content_with_fallback(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        photo_urls=photo_urls,
        task_type="public_remarks",
        temperature=0.7,  # Slightly higher for creative marketing copy
        max_output_tokens=max_tokens
    )


async def generate_features(
    system_prompt: str,
    user_prompt: str,
    photo_urls: List[str],
    max_features: int = 30
) -> GenerationResult:
    """Generate property features list."""
    # Estimate tokens: ~50 tokens per feature + JSON structure
    max_tokens = max_features * 60 + 500

    return await generate_content_with_fallback(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        photo_urls=photo_urls,
        task_type="features",
        temperature=0.3,  # Lower for accurate extraction
        max_output_tokens=min(max_tokens, 4000)
    )


async def generate_mls_data(
    system_prompt: str,
    user_prompt: str,
    photo_urls: List[str]
) -> GenerationResult:
    """Generate MLS data extraction."""
    return await generate_content_with_fallback(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        photo_urls=photo_urls,
        task_type="mls",
        temperature=0.2,  # Very low for factual extraction
        max_output_tokens=2500
    )


# =============================================================================
# Health Check
# =============================================================================

async def check_ai_services_health() -> Dict[str, Any]:
    """Check health of AI services."""
    health = {
        "openai": {"status": "unknown", "model": OPENAI_MODEL},
        "gemini": {"status": "unknown", "model": GEMINI_MODEL}
    }

    # Check OpenAI
    if settings.openai_api_key:
        try:
            client = AsyncOpenAI(api_key=settings.openai_api_key)
            await client.models.list()
            health["openai"]["status"] = "healthy"
        except Exception as e:
            health["openai"]["status"] = f"error: {str(e)[:50]}"
    else:
        health["openai"]["status"] = "no_api_key"

    # Check Gemini
    if settings.gemini_api_key:
        try:
            genai.configure(api_key=settings.gemini_api_key)
            models = genai.list_models()
            health["gemini"]["status"] = "healthy"
        except Exception as e:
            health["gemini"]["status"] = f"error: {str(e)[:50]}"
    else:
        health["gemini"]["status"] = "no_api_key"

    return health
