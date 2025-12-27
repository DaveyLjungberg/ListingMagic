"""
Listing Magic - Configuration Module

Centralized configuration for AI models, costs, and application settings.
Uses two cutting-edge AI models optimized for different tasks:
- GPT-4.1 Vision: Photo analysis + persuasive listing copy
- Gemini 3 Pro: Fast structured data (features, RESO)
"""

import os
from typing import Dict, Any, Optional
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Environment
    environment: str = Field(default="development", alias="ENVIRONMENT")
    debug: bool = Field(default=True, alias="DEBUG")

    # API Keys
    openai_api_key: str = Field(default="", alias="OPENAI_API_KEY")
    anthropic_api_key: str = Field(default="", alias="ANTHROPIC_API_KEY")
    gemini_api_key: str = Field(default="", alias="GEMINI_API_KEY")

    # Model Names
    # Primary: OpenAI gpt-5.2 for all generation tasks
    # Fallback: Gemini gemini-2.0-flash (only for infrastructure failures)
    openai_model: str = Field(default="gpt-5.2", alias="OPENAI_MODEL")
    anthropic_model: str = Field(default="claude-sonnet-4-20250514", alias="ANTHROPIC_MODEL")
    gemini_model: str = Field(default="gemini-2.0-flash", alias="GEMINI_MODEL")

    # CORS - supports wildcards for Vercel preview deployments
    allowed_origins: str = Field(
        default="http://localhost:3000,http://localhost:3001,https://listing-magic.vercel.app,https://*.vercel.app,https://listingmagic.com,https://www.listingmagic.com",
        alias="ALLOWED_ORIGINS"
    )

    # File Storage
    temp_storage_path: str = Field(default="./tmp", alias="TEMP_STORAGE_PATH")
    max_upload_size_mb: int = Field(default=50, alias="MAX_UPLOAD_SIZE_MB")

    # Cost Tracking
    enable_cost_tracking: bool = Field(default=True, alias="ENABLE_COST_TRACKING")
    cost_alert_threshold: float = Field(default=10.0, alias="COST_ALERT_THRESHOLD")

    @property
    def allowed_origins_list(self) -> list[str]:
        """Parse comma-separated origins into a list."""
        return [origin.strip() for origin in self.allowed_origins.split(",")]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


# Initialize settings
settings = Settings()


# =============================================================================
# AI Model Configurations
# =============================================================================

class ModelConfig:
    """Configuration for a specific AI model."""

    def __init__(
        self,
        name: str,
        provider: str,
        model_id: str,
        task: str,
        temperature: float,
        max_tokens: int,
        supports_vision: bool = False,
        cost_per_1k_input: float = 0.0,
        cost_per_1k_output: float = 0.0,
        special_features: Optional[list[str]] = None
    ):
        self.name = name
        self.provider = provider
        self.model_id = model_id
        self.task = task
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.supports_vision = supports_vision
        self.cost_per_1k_input = cost_per_1k_input
        self.cost_per_1k_output = cost_per_1k_output
        self.special_features = special_features or []

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "provider": self.provider,
            "model_id": self.model_id,
            "task": self.task,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
            "supports_vision": self.supports_vision,
            "cost_per_1k_input": self.cost_per_1k_input,
            "cost_per_1k_output": self.cost_per_1k_output,
            "special_features": self.special_features
        }


# GPT-4o Vision Configuration
# Best for: Persuasive listing copy + automatic photo analysis
# Pricing: $2.50/1M input, $10/1M output tokens
GPT41_CONFIG = ModelConfig(
    name="GPT-4o Vision",
    provider="openai",
    model_id=settings.openai_model,
    task="public_remarks",
    temperature=0.7,  # Balanced creativity for marketing copy
    max_tokens=1500,  # ~250 words for public remarks
    supports_vision=True,
    cost_per_1k_input=0.0025,   # $2.50 per 1M tokens
    cost_per_1k_output=0.01,    # $10 per 1M tokens
    special_features=[
        "vision_analysis",
        "photo_feature_extraction",
        "multi_image_processing",
        "automatic_room_detection",
        "quality_assessment"
    ]
)

# Claude Sonnet 4.5 Configuration
# Best for: Natural-sounding video narration scripts
# Pricing: $3/1M input, $15/1M output tokens
CLAUDE_SONNET_CONFIG = ModelConfig(
    name="Claude Sonnet 4.5",
    provider="anthropic",
    model_id=settings.anthropic_model,
    task="walkthru_script",
    temperature=0.8,  # Higher creativity for natural narration
    max_tokens=3000,  # Longer scripts for video walk-thrus
    supports_vision=True,
    cost_per_1k_input=0.003,    # $3 per 1M tokens
    cost_per_1k_output=0.015,   # $15 per 1M tokens
    special_features=[
        "natural_narration",
        "conversational_tone",
        "emotional_engagement",
        "pacing_awareness"
    ]
)

# Gemini 3 Pro Configuration
# Best for: Fast, accurate structured data (features, RESO JSON)
# Pricing: $2/1M input, $12/1M output tokens
GEMINI3_CONFIG = ModelConfig(
    name="Gemini 3 Pro",
    provider="google",
    model_id=settings.gemini_model,
    task="features_and_reso",
    temperature=1.0,  # Default - don't change, affects reasoning with thought signatures
    max_tokens=4000,  # Enough for detailed RESO JSON
    supports_vision=True,
    cost_per_1k_input=0.002,     # $2 per 1M tokens
    cost_per_1k_output=0.012,    # $12 per 1M tokens
    special_features=[
        "thought_signatures",
        "reasoning_context",
        "structured_output",
        "json_mode",
        "fast_inference"
    ]
)


# =============================================================================
# Task-to-Model Mapping
# =============================================================================

TASK_MODEL_MAPPING: Dict[str, ModelConfig] = {
    "public_remarks": GPT41_CONFIG,
    "features": GEMINI3_CONFIG,
    "reso_data": GEMINI3_CONFIG,
}

# Fallback configurations when primary model is unavailable
FALLBACK_MAPPING: Dict[str, str] = {
    "public_remarks": "features",          # GPT-4.1 → Gemini
    "features": "public_remarks",          # Gemini → GPT-4.1
    "reso_data": "public_remarks",         # Gemini → GPT-4.1
}


def get_model_for_task(task: str) -> ModelConfig:
    """Get the configured model for a specific task."""
    if task not in TASK_MODEL_MAPPING:
        raise ValueError(f"Unknown task: {task}")
    return TASK_MODEL_MAPPING[task]


def get_fallback_model(task: str) -> Optional[ModelConfig]:
    """Get the fallback model for a task if primary fails."""
    fallback_task = FALLBACK_MAPPING.get(task)
    if fallback_task and fallback_task in TASK_MODEL_MAPPING:
        return TASK_MODEL_MAPPING[fallback_task]
    return None


# =============================================================================
# Vision-Specific Settings
# =============================================================================

VISION_CONFIG = {
    "max_images": 20,                    # Maximum images per request
    "max_image_size_mb": 20,             # Maximum size per image
    "supported_formats": ["jpg", "jpeg", "png", "webp", "gif"],
    "default_detail": "high",            # Image detail level for GPT-4.1
    "resize_threshold": 2048,            # Resize if larger than this
    "jpeg_quality": 85,                  # Quality for JPEG compression

    # GPT-4.1 Vision specific
    "gpt41_features_to_extract": [
        "bedrooms",
        "bathrooms",
        "kitchen_features",
        "flooring_type",
        "ceiling_features",
        "lighting",
        "windows",
        "outdoor_spaces",
        "amenities",
        "condition",
        "style",
        "notable_features"
    ]
}


# =============================================================================
# Prompt Configuration
# =============================================================================

PROMPT_CONFIG = {
    "public_remarks": {
        "max_words": 250,
        "style": "persuasive_marketing",
        "tone": "professional_yet_warm",
        "include_call_to_action": True
    },
    "features": {
        "format": "bullet_list",
        "categorize": True,
        "include_measurements": True
    },
    "reso_data": {
        "schema_version": "2.0",
        "include_optional_fields": True,
        "validate_output": True
    }
}


# =============================================================================
# Cost Tracking Configuration
# =============================================================================

COST_CONFIG = {
    "track_per_request": True,
    "track_per_user": True,
    "track_per_day": True,
    "alert_thresholds": {
        "per_request": 1.00,    # Alert if single request > $1
        "per_hour": 10.00,      # Alert if hourly spend > $10
        "per_day": 50.00        # Alert if daily spend > $50
    },
    "currency": "USD"
}


# =============================================================================
# Export all configurations
# =============================================================================

__all__ = [
    "settings",
    "Settings",
    "ModelConfig",
    "GPT41_CONFIG",
    "CLAUDE_SONNET_CONFIG",
    "GEMINI3_CONFIG",
    "TASK_MODEL_MAPPING",
    "FALLBACK_MAPPING",
    "get_model_for_task",
    "get_fallback_model",
    "VISION_CONFIG",
    "PROMPT_CONFIG",
    "COST_CONFIG"
]
