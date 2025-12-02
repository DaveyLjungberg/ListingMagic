import asyncio
import logging
from unittest.mock import MagicMock, patch, AsyncMock
import pytest
from tenacity import RetryError

# Mock configuration
with patch("config.settings") as mock_settings:
    mock_settings.anthropic_api_key = "test_key"
    mock_settings.openai_api_key = "test_key"
    mock_settings.gemini_api_key = "test_key"
    
    from services.anthropic_service import AnthropicService, AnthropicServiceError
    from services.gemini_service import GeminiService, GeminiServiceError
    from services.openai_service import OpenAIService
    from models.requests import PropertyDetailsRequest, AddressInput as Address
    from models.responses import WalkthruScriptResponse, FeaturesResponse
    from google.api_core.exceptions import ResourceExhausted

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@pytest.mark.asyncio
async def test_anthropic_fallback():
    """Test that AnthropicService falls back to OpenAI when Claude fails."""
    logger.info("Testing Anthropic Fallback...")
    
    # Mock Anthropic client to raise an error
    with patch("anthropic.AsyncAnthropic") as MockAnthropic:
        mock_client = MockAnthropic.return_value
        mock_client.messages.create.side_effect = Exception("Simulated Anthropic Outage")
        
        service = AnthropicService()
        service.client = mock_client
        
        # Mock OpenAI service
        with patch("services.anthropic_service.get_openai_service") as mock_get_openai:
            mock_openai_service = MagicMock(spec=OpenAIService)
            mock_get_openai.return_value = mock_openai_service
            
            # Setup OpenAI response
            mock_openai_service.generate_walkthru_script.return_value = WalkthruScriptResponse(
                success=True,
                script="Fallback script from OpenAI",
                word_count=5,
                estimated_duration_seconds=2,
                sections=[],
                usage={
                    "input_tokens": 10,
                    "output_tokens": 5,
                    "total_tokens": 15,
                    "cost_usd": 0.001,
                    "generation_time_ms": 100,
                    "model_used": "gpt-4.1",
                    "provider": "openai",
                    "is_fallback": True
                },
                request_id="fallback_test"
            )
            
            request = PropertyDetailsRequest(
                address=Address(street="123 Test St", city="Test City", state="TS", zip_code="12345"),
                property_type="single_family",
                bedrooms=3,
                bathrooms=2.0
            )
            
            # Call the service
            response = await service.generate_walkthru_script(request)
            
            # Verify fallback
            assert response.script == "Fallback script from OpenAI"
            mock_openai_service.generate_walkthru_script.assert_called_once()
            logger.info("Anthropic Fallback Test Passed!")

@pytest.mark.asyncio
async def test_gemini_retry_logic():
    """Test that GeminiService retries on ResourceExhausted errors."""
    logger.info("Testing Gemini Retry Logic...")
    
    # Mock Gemini client
    with patch("google.generativeai.GenerativeModel") as MockGemini:
        mock_client = MockGemini.return_value
        
        service = GeminiService()
        service.client = mock_client
        
        # Simulate 2 failures then success
        mock_response = MagicMock()
        mock_response.text = '{"all_features": ["Feature 1", "Feature 2"]}'
        
        # Ensure generate_content_async is treated as async
        mock_client.generate_content_async = AsyncMock(side_effect=[
            ResourceExhausted("Quota exceeded"),
            ResourceExhausted("Quota exceeded"),
            mock_response
        ])
        
        request = PropertyDetailsRequest(
            address=Address(street="123 Test St", city="Test City", state="TS", zip_code="12345"),
            property_type="single_family",
            bedrooms=3,
            bathrooms=2.0
        )
        
        # Call the service (should succeed after retries)
        # We patch sleep to speed up the test
        with patch("time.sleep"):
            response = await service.generate_features(request)
            
        assert len(response.features_list) == 2
        assert mock_client.generate_content_async.call_count == 3
        logger.info("Gemini Retry Logic Test Passed!")

if __name__ == "__main__":
    # Run tests manually if executed directly
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(test_anthropic_fallback())
        loop.run_until_complete(test_gemini_retry_logic())
    finally:
        loop.close()
