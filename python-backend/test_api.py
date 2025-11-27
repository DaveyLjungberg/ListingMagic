"""
Listing Magic - API Test Suite

Tests all endpoints with sample data and verifies:
- Response formats
- AI service functionality
- Cost estimation
- Model performance comparison
"""

import asyncio
import time
from typing import Dict, Any

import httpx

# Test configuration
BASE_URL = "http://localhost:8000"
TIMEOUT = 30.0


# =============================================================================
# Sample Test Data
# =============================================================================

SAMPLE_ADDRESS = {
    "street": "123 Maple Drive",
    "city": "Austin",
    "state": "TX",
    "zip_code": "78701"
}

SAMPLE_PROPERTY = {
    "address": SAMPLE_ADDRESS,
    "photos": [
        {"url": "https://example.com/photo1.jpg"},
        {"url": "https://example.com/photo2.jpg"},
        {"url": "https://example.com/photo3.jpg"}
    ],
    "property_type": "single_family",
    "bedrooms": 4,
    "bathrooms": 3.5,
    "square_feet": 2800,
    "year_built": 2018
}


# =============================================================================
# Test Functions
# =============================================================================

async def test_health_check(client: httpx.AsyncClient) -> Dict[str, Any]:
    """Test health check endpoint."""
    print("\n" + "=" * 60)
    print("Testing: GET /health")
    print("=" * 60)

    start = time.time()
    response = await client.get("/health")
    elapsed = (time.time() - start) * 1000

    data = response.json()

    print(f"Status: {response.status_code}")
    print(f"Time: {elapsed:.1f}ms")
    print(f"API Status: {data.get('status')}")
    print(f"Services: {data.get('services')}")
    print(f"Models: {data.get('models')}")

    return {
        "endpoint": "/health",
        "status": response.status_code,
        "time_ms": elapsed,
        "success": response.status_code == 200
    }


async def test_public_remarks(client: httpx.AsyncClient) -> Dict[str, Any]:
    """Test public remarks generation (GPT-4.1 Vision)."""
    print("\n" + "=" * 60)
    print("Testing: POST /api/generate-public-remarks")
    print("Model: GPT-4.1 Vision (OpenAI)")
    print("=" * 60)

    payload = {
        "property": SAMPLE_PROPERTY,
        "max_words": 250,
        "analyze_photos": True,
        "highlight_features": ["gourmet kitchen", "primary suite"]
    }

    start = time.time()
    response = await client.post("/api/generate-public-remarks", json=payload)
    elapsed = (time.time() - start) * 1000

    data = response.json()

    print(f"Status: {response.status_code}")
    print(f"Time: {elapsed:.1f}ms")

    if response.status_code == 200:
        print(f"Word count: {data.get('word_count')}")
        print(f"Photos analyzed: {data.get('photos_analyzed')}")
        print(f"Model used: {data.get('usage', {}).get('model_used')}")
        print(f"Cost: ${data.get('usage', {}).get('cost_usd', 0):.4f}")
        print(f"\nGenerated text preview:")
        print(data.get("text", "")[:200] + "...")

        if data.get("extracted_features"):
            ef = data["extracted_features"]
            print(f"\nExtracted features:")
            print(f"  Bedrooms: {ef.get('bedrooms')}")
            print(f"  Bathrooms: {ef.get('bathrooms')}")
            print(f"  Condition: {ef.get('condition')}")
            print(f"  Style: {ef.get('style')}")

    return {
        "endpoint": "/api/generate-public-remarks",
        "model": "gpt-4.1",
        "status": response.status_code,
        "time_ms": elapsed,
        "word_count": data.get("word_count", 0),
        "cost_usd": data.get("usage", {}).get("cost_usd", 0),
        "success": response.status_code == 200
    }


async def test_walkthru_script(client: httpx.AsyncClient) -> Dict[str, Any]:
    """Test walk-thru script generation (Claude Sonnet 4.5)."""
    print("\n" + "=" * 60)
    print("Testing: POST /api/generate-walkthru-script")
    print("Model: Claude Sonnet 4.5 (Anthropic)")
    print("=" * 60)

    payload = {
        "property": SAMPLE_PROPERTY,
        "duration_seconds": 120,
        "style": "conversational",
        "include_intro": True,
        "include_outro": True
    }

    start = time.time()
    response = await client.post("/api/generate-walkthru-script", json=payload)
    elapsed = (time.time() - start) * 1000

    data = response.json()

    print(f"Status: {response.status_code}")
    print(f"Time: {elapsed:.1f}ms")

    if response.status_code == 200:
        print(f"Word count: {data.get('word_count')}")
        print(f"Est. duration: {data.get('estimated_duration_seconds')}s")
        print(f"Sections: {len(data.get('sections', []))}")
        print(f"Model used: {data.get('usage', {}).get('model_used')}")
        print(f"Cost: ${data.get('usage', {}).get('cost_usd', 0):.4f}")
        print(f"\nScript preview:")
        print(data.get("script", "")[:300] + "...")

    return {
        "endpoint": "/api/generate-walkthru-script",
        "model": "claude-sonnet-4-20250514",
        "status": response.status_code,
        "time_ms": elapsed,
        "word_count": data.get("word_count", 0),
        "duration_seconds": data.get("estimated_duration_seconds", 0),
        "cost_usd": data.get("usage", {}).get("cost_usd", 0),
        "success": response.status_code == 200
    }


async def test_features(client: httpx.AsyncClient) -> Dict[str, Any]:
    """Test features list generation (Gemini 3 Pro)."""
    print("\n" + "=" * 60)
    print("Testing: POST /api/generate-features")
    print("Model: Gemini 3 Pro (Google)")
    print("=" * 60)

    payload = {
        "property": SAMPLE_PROPERTY,
        "categorize": True,
        "include_measurements": True,
        "max_features": 30
    }

    start = time.time()
    response = await client.post("/api/generate-features", json=payload)
    elapsed = (time.time() - start) * 1000

    data = response.json()

    print(f"Status: {response.status_code}")
    print(f"Time: {elapsed:.1f}ms")

    if response.status_code == 200:
        print(f"Total features: {data.get('total_features')}")
        print(f"Categories: {len(data.get('categorized_features', []))}")
        print(f"Model used: {data.get('usage', {}).get('model_used')}")
        print(f"Cost: ${data.get('usage', {}).get('cost_usd', 0):.4f}")

        print(f"\nCategories:")
        for cat in data.get("categorized_features", [])[:3]:
            print(f"  - {cat['name']}: {len(cat['features'])} features")

    return {
        "endpoint": "/api/generate-features",
        "model": "gemini-3-pro-latest",
        "status": response.status_code,
        "time_ms": elapsed,
        "total_features": data.get("total_features", 0),
        "cost_usd": data.get("usage", {}).get("cost_usd", 0),
        "success": response.status_code == 200
    }


async def test_reso_data(client: httpx.AsyncClient) -> Dict[str, Any]:
    """Test RESO data generation (Gemini 3 Pro)."""
    print("\n" + "=" * 60)
    print("Testing: POST /api/generate-reso")
    print("Model: Gemini 3 Pro (Google)")
    print("=" * 60)

    payload = {
        "property": SAMPLE_PROPERTY,
        "schema_version": "2.0",
        "include_optional_fields": True
    }

    start = time.time()
    response = await client.post("/api/generate-reso", json=payload)
    elapsed = (time.time() - start) * 1000

    data = response.json()

    print(f"Status: {response.status_code}")
    print(f"Time: {elapsed:.1f}ms")

    if response.status_code == 200:
        reso = data.get("reso_json", {})
        print(f"Schema version: {data.get('schema_version')}")
        print(f"Validation passed: {data.get('validation_passed')}")
        print(f"RESO fields: {len(reso)}")
        print(f"Model used: {data.get('usage', {}).get('model_used')}")
        print(f"Cost: ${data.get('usage', {}).get('cost_usd', 0):.4f}")

        print(f"\nKey RESO fields:")
        print(f"  ListingKey: {reso.get('ListingKey')}")
        print(f"  PropertyType: {reso.get('PropertyType')}")
        print(f"  BedroomsTotal: {reso.get('BedroomsTotal')}")
        print(f"  ListPrice: {reso.get('ListPrice')}")

    return {
        "endpoint": "/api/generate-reso",
        "model": "gemini-3-pro-latest",
        "status": response.status_code,
        "time_ms": elapsed,
        "reso_fields": len(data.get("reso_json", {})),
        "cost_usd": data.get("usage", {}).get("cost_usd", 0),
        "success": response.status_code == 200
    }


async def test_video_generation(client: httpx.AsyncClient) -> Dict[str, Any]:
    """Test video generation endpoint."""
    print("\n" + "=" * 60)
    print("Testing: POST /api/generate-video")
    print("Service: MoviePy")
    print("=" * 60)

    payload = {
        "property": SAMPLE_PROPERTY,
        "script": "Welcome to this beautiful home at 123 Maple Drive...",
        "resolution": "1080p",
        "voice": "professional_male",
        "background_music": True
    }

    start = time.time()
    response = await client.post("/api/generate-video", json=payload)
    elapsed = (time.time() - start) * 1000

    data = response.json()

    print(f"Status: {response.status_code}")
    print(f"Time: {elapsed:.1f}ms")

    if response.status_code == 200:
        print(f"Video URL: {data.get('video_url')}")
        print(f"Duration: {data.get('duration_seconds')}s")
        print(f"File size: {data.get('file_size_mb')}MB")
        print(f"Resolution: {data.get('resolution')}")

    return {
        "endpoint": "/api/generate-video",
        "status": response.status_code,
        "time_ms": elapsed,
        "success": response.status_code == 200
    }


async def test_cost_summary(client: httpx.AsyncClient) -> Dict[str, Any]:
    """Test cost summary endpoint."""
    print("\n" + "=" * 60)
    print("Testing: GET /api/costs/summary")
    print("=" * 60)

    response = await client.get("/api/costs/summary")
    data = response.json()

    print(f"Status: {response.status_code}")

    if response.status_code == 200:
        today = data.get("today", {})
        estimates = data.get("estimates", {})

        print(f"\nToday's usage:")
        print(f"  Total cost: ${today.get('total_cost_usd', 0):.4f}")
        print(f"  Total requests: {today.get('total_requests', 0)}")
        print(f"  By provider: {today.get('by_provider', {})}")

        print(f"\nEstimated cost per full generation:")
        for task, cost in estimates.items():
            print(f"  {task}: ${cost:.4f}")

    return {
        "endpoint": "/api/costs/summary",
        "status": response.status_code,
        "success": response.status_code == 200
    }


async def test_model_info(client: httpx.AsyncClient) -> Dict[str, Any]:
    """Test model info endpoint."""
    print("\n" + "=" * 60)
    print("Testing: GET /api/models")
    print("=" * 60)

    response = await client.get("/api/models")
    data = response.json()

    print(f"Status: {response.status_code}")

    if response.status_code == 200:
        models = data.get("models", {})
        print(f"\nConfigured models:")
        for task, info in models.items():
            print(f"  {task}:")
            print(f"    Name: {info.get('name')}")
            print(f"    Provider: {info.get('provider')}")
            print(f"    Model ID: {info.get('model_id')}")
            print(f"    Vision: {info.get('supports_vision')}")

    return {
        "endpoint": "/api/models",
        "status": response.status_code,
        "success": response.status_code == 200
    }


# =============================================================================
# Main Test Runner
# =============================================================================

async def run_all_tests():
    """Run all API tests."""
    print("\n" + "=" * 60)
    print("LISTING MAGIC API TEST SUITE")
    print("=" * 60)
    print(f"Base URL: {BASE_URL}")
    print(f"Timeout: {TIMEOUT}s")

    results = []

    async with httpx.AsyncClient(
        base_url=BASE_URL,
        timeout=TIMEOUT
    ) as client:

        # Run tests
        results.append(await test_health_check(client))
        results.append(await test_model_info(client))
        results.append(await test_public_remarks(client))
        results.append(await test_walkthru_script(client))
        results.append(await test_features(client))
        results.append(await test_reso_data(client))
        results.append(await test_video_generation(client))
        results.append(await test_cost_summary(client))

    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)

    passed = sum(1 for r in results if r["success"])
    failed = len(results) - passed
    total_time = sum(r.get("time_ms", 0) for r in results)
    total_cost = sum(r.get("cost_usd", 0) for r in results)

    print(f"Tests passed: {passed}/{len(results)}")
    print(f"Tests failed: {failed}")
    print(f"Total time: {total_time:.1f}ms")
    print(f"Total estimated cost: ${total_cost:.4f}")

    print("\n" + "-" * 60)
    print("Model Performance Comparison:")
    print("-" * 60)

    for r in results:
        if "model" in r:
            print(f"{r['endpoint']:40} | {r['model']:30} | {r['time_ms']:8.1f}ms | ${r.get('cost_usd', 0):.4f}")

    print("\n" + "=" * 60)

    return results


if __name__ == "__main__":
    try:
        asyncio.run(run_all_tests())
    except httpx.ConnectError:
        print("\nERROR: Could not connect to API server.")
        print(f"Make sure the server is running at {BASE_URL}")
        print("\nTo start the server:")
        print("  cd python-backend")
        print("  uvicorn main:app --reload --port 8000")
