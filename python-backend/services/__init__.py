"""
Listing Magic - AI Services

AI Generation Strategy:
- Primary: OpenAI gpt-5.2 for all generation tasks
- Fallback: Gemini gemini-2.0-flash (infrastructure failures only)

All generation endpoints should use the unified ai_generation_service.
"""

from .openai_service import OpenAIService
from .anthropic_service import AnthropicService
from .gemini_service import GeminiService
from .ai_generation_service import (
    generate_content_with_fallback,
    generate_public_remarks,
    generate_features,
    generate_mls_data,
    check_ai_services_health,
    GenerationResult,
    OPENAI_MODEL,
    GEMINI_MODEL
)

__all__ = [
    # Legacy services (kept for backward compatibility)
    "OpenAIService",
    "AnthropicService",
    "GeminiService",
    # Unified generation service (preferred)
    "generate_content_with_fallback",
    "generate_public_remarks",
    "generate_features",
    "generate_mls_data",
    "check_ai_services_health",
    "GenerationResult",
    "OPENAI_MODEL",
    "GEMINI_MODEL"
]
