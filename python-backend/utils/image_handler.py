"""
Listing Magic - Image Handler

Prepares images for each AI's specific format requirements.
Handles base64 encoding, URL validation, resizing, and format conversion.
"""

import base64
import io
import logging
from typing import List, Optional, Dict, Any, Tuple
from pathlib import Path

from config import VISION_CONFIG

logger = logging.getLogger(__name__)


class ImageHandler:
    """
    Handles image preparation for different AI vision APIs.

    Each AI has specific requirements:
    - OpenAI GPT-4.1: base64 or URL, supports multiple images
    - Anthropic Claude: base64 preferred, URL supported
    - Google Gemini: inline_data or file_uri
    """

    SUPPORTED_FORMATS = VISION_CONFIG["supported_formats"]
    MAX_SIZE_MB = VISION_CONFIG["max_image_size_mb"]
    MAX_IMAGES = VISION_CONFIG["max_images"]
    RESIZE_THRESHOLD = VISION_CONFIG["resize_threshold"]
    JPEG_QUALITY = VISION_CONFIG["jpeg_quality"]

    @staticmethod
    def validate_image_format(filename: str) -> bool:
        """Check if image format is supported."""
        if not filename:
            return False
        ext = filename.lower().split(".")[-1]
        return ext in ImageHandler.SUPPORTED_FORMATS

    @staticmethod
    def get_mime_type(filename: str) -> str:
        """Get MIME type from filename."""
        ext = filename.lower().split(".")[-1] if filename else "jpeg"

        mime_types = {
            "jpg": "image/jpeg",
            "jpeg": "image/jpeg",
            "png": "image/png",
            "webp": "image/webp",
            "gif": "image/gif"
        }

        return mime_types.get(ext, "image/jpeg")

    @staticmethod
    def encode_to_base64(image_bytes: bytes) -> str:
        """Encode image bytes to base64 string."""
        return base64.b64encode(image_bytes).decode("utf-8")

    @staticmethod
    def decode_from_base64(base64_string: str) -> bytes:
        """Decode base64 string to image bytes."""
        # Remove data URI prefix if present
        if "," in base64_string:
            base64_string = base64_string.split(",")[1]
        return base64.b64decode(base64_string)

    @staticmethod
    def estimate_base64_size_mb(base64_string: str) -> float:
        """Estimate size of base64-encoded image in MB."""
        # Base64 encoding increases size by ~33%
        # Original size = base64 length * 3/4
        original_bytes = len(base64_string) * 3 / 4
        return original_bytes / (1024 * 1024)

    @staticmethod
    def resize_image_if_needed(
        image_bytes: bytes,
        max_dimension: int = None
    ) -> Tuple[bytes, bool]:
        """
        Resize image if it exceeds maximum dimensions.

        Returns:
            Tuple of (processed_bytes, was_resized)
        """
        max_dimension = max_dimension or ImageHandler.RESIZE_THRESHOLD

        try:
            from PIL import Image

            img = Image.open(io.BytesIO(image_bytes))
            original_size = img.size

            # Check if resize needed
            if max(original_size) <= max_dimension:
                return image_bytes, False

            # Calculate new size maintaining aspect ratio
            ratio = max_dimension / max(original_size)
            new_size = (int(original_size[0] * ratio), int(original_size[1] * ratio))

            # Resize
            img = img.resize(new_size, Image.Resampling.LANCZOS)

            # Save to bytes
            output = io.BytesIO()
            img_format = img.format or "JPEG"

            if img_format.upper() == "JPEG":
                img.save(output, format="JPEG", quality=ImageHandler.JPEG_QUALITY)
            else:
                img.save(output, format=img_format)

            logger.debug(f"Resized image from {original_size} to {new_size}")
            return output.getvalue(), True

        except ImportError:
            logger.warning("PIL not available, skipping resize")
            return image_bytes, False
        except Exception as e:
            logger.error(f"Error resizing image: {e}")
            return image_bytes, False

    @classmethod
    def prepare_for_openai(
        cls,
        images: List[Dict[str, Any]],
        detail: str = "high"
    ) -> List[Dict[str, Any]]:
        """
        Prepare images for OpenAI GPT-4.1 Vision API.

        Format:
        {
            "type": "image_url",
            "image_url": {
                "url": "data:image/jpeg;base64,..." or "https://...",
                "detail": "high" | "low" | "auto"
            }
        }
        """
        prepared = []
        detail = detail or VISION_CONFIG["default_detail"]

        for idx, image in enumerate(images[:cls.MAX_IMAGES]):
            if image.get("base64"):
                mime_type = image.get("content_type", "image/jpeg")
                data_url = f"data:{mime_type};base64,{image['base64']}"
                prepared.append({
                    "type": "image_url",
                    "image_url": {
                        "url": data_url,
                        "detail": detail
                    }
                })
            elif image.get("url"):
                prepared.append({
                    "type": "image_url",
                    "image_url": {
                        "url": image["url"],
                        "detail": detail
                    }
                })

            logger.debug(f"Prepared image {idx + 1} for OpenAI")

        return prepared

    @classmethod
    def prepare_for_anthropic(
        cls,
        images: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Prepare images for Anthropic Claude Vision API.

        Format:
        {
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": "image/jpeg",
                "data": "..."
            }
        }
        """
        prepared = []

        for idx, image in enumerate(images[:cls.MAX_IMAGES]):
            if image.get("base64"):
                mime_type = image.get("content_type", "image/jpeg")
                prepared.append({
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": mime_type,
                        "data": image["base64"]
                    }
                })
            elif image.get("url"):
                # Claude prefers base64, but can handle URLs in some cases
                prepared.append({
                    "type": "image",
                    "source": {
                        "type": "url",
                        "url": image["url"]
                    }
                })

            logger.debug(f"Prepared image {idx + 1} for Anthropic")

        return prepared

    @classmethod
    def prepare_for_gemini(
        cls,
        images: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Prepare images for Google Gemini Vision API.

        Format:
        {
            "inline_data": {
                "mime_type": "image/jpeg",
                "data": "..."
            }
        }
        or
        {
            "file_data": {
                "file_uri": "https://..."
            }
        }
        """
        prepared = []

        for idx, image in enumerate(images[:cls.MAX_IMAGES]):
            if image.get("base64"):
                mime_type = image.get("content_type", "image/jpeg")
                prepared.append({
                    "inline_data": {
                        "mime_type": mime_type,
                        "data": image["base64"]
                    }
                })
            elif image.get("url"):
                prepared.append({
                    "file_data": {
                        "file_uri": image["url"]
                    }
                })

            logger.debug(f"Prepared image {idx + 1} for Gemini")

        return prepared

    @classmethod
    def prepare_images(
        cls,
        images: List[Dict[str, Any]],
        provider: str
    ) -> List[Dict[str, Any]]:
        """
        Prepare images for a specific AI provider.

        Args:
            images: List of image dicts with 'base64' or 'url' keys
            provider: 'openai', 'anthropic', or 'google'

        Returns:
            List of images in provider-specific format
        """
        if provider == "openai":
            return cls.prepare_for_openai(images)
        elif provider == "anthropic":
            return cls.prepare_for_anthropic(images)
        elif provider == "google":
            return cls.prepare_for_gemini(images)
        else:
            raise ValueError(f"Unknown provider: {provider}")

    @classmethod
    def validate_and_prepare(
        cls,
        images: List[Dict[str, Any]],
        provider: str
    ) -> Tuple[List[Dict[str, Any]], List[str]]:
        """
        Validate images and prepare for a provider.

        Returns:
            Tuple of (prepared_images, validation_errors)
        """
        errors = []
        valid_images = []

        for idx, image in enumerate(images):
            # Check if image has a source
            if not image.get("base64") and not image.get("url"):
                errors.append(f"Image {idx + 1}: No source (base64 or URL)")
                continue

            # Check format if filename provided
            filename = image.get("filename", "")
            if filename and not cls.validate_image_format(filename):
                errors.append(f"Image {idx + 1}: Unsupported format '{filename}'")
                continue

            # Check size for base64
            if image.get("base64"):
                size_mb = cls.estimate_base64_size_mb(image["base64"])
                if size_mb > cls.MAX_SIZE_MB:
                    errors.append(
                        f"Image {idx + 1}: Size {size_mb:.1f}MB exceeds "
                        f"maximum {cls.MAX_SIZE_MB}MB"
                    )
                    continue

            valid_images.append(image)

        # Check total count
        if len(valid_images) > cls.MAX_IMAGES:
            errors.append(
                f"Too many images ({len(valid_images)}). "
                f"Maximum is {cls.MAX_IMAGES}."
            )
            valid_images = valid_images[:cls.MAX_IMAGES]

        # Prepare for provider
        prepared = cls.prepare_images(valid_images, provider)

        return prepared, errors
