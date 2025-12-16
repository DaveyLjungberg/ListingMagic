"""
Listing Magic - Anthropic Claude Sonnet 4.5 Service

Claude Sonnet 4.5 is Anthropic's latest model.
Reserved for future AI content generation features.
"""

import logging
from typing import Optional, Dict, Any

import anthropic

from config import settings, CLAUDE_SONNET_CONFIG

logger = logging.getLogger(__name__)


class AnthropicServiceError(Exception):
    """Custom exception for Anthropic service errors."""
    pass


class AnthropicService:
    """
    Anthropic Claude Sonnet 4.5 Service

    Reserved for future AI content generation features.
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
