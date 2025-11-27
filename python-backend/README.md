# Listing Magic - Python Backend

AI-Powered Real Estate Marketing API using three cutting-edge AI models.

## Why Three AI Models?

We use the **best AI model for each task**, optimizing for quality, speed, and cost:

| Task | Model | Why This Model |
|------|-------|----------------|
| **Public Remarks** | GPT-4.1 Vision (OpenAI) | Best multimodal - analyzes photos AND writes persuasive copy |
| **Walk-thru Scripts** | Claude Sonnet 4.5 (Anthropic) | Most natural narration, perfect pacing for video |
| **Features & RESO** | Gemini 3 Pro (Google) | Fastest for structured data, cost-effective |

## Model Specifications

### GPT-4.1 Vision (OpenAI) - April 2025
- **Model ID:** `gpt-4.1`
- **Use Case:** Property photo analysis + listing descriptions
- **Capabilities:**
  - Analyzes up to 20 property photos simultaneously
  - Automatically extracts: bedrooms, bathrooms, finishes, condition
  - Generates persuasive 250-word marketing copy
  - Identifies architectural style and notable features
- **Vision Features:**
  - High-detail image processing
  - Multi-image context understanding
  - Automatic feature detection
- **Cost:** ~$0.01/1K input, ~$0.03/1K output tokens

### Claude Sonnet 4.5 (Anthropic) - Latest
- **Model ID:** `claude-sonnet-4-20250514`
- **Use Case:** Video walk-thru narration scripts
- **Capabilities:**
  - Most natural-sounding speech patterns
  - Conversational, engaging tone
  - Proper pacing for video timing (~150 words/minute)
  - Emotional engagement and warmth
- **Special Features:**
  - Sectioned scripts (intro, rooms, outro)
  - Natural transitions between spaces
  - Duration-aware generation
- **Cost:** ~$0.003/1K input, ~$0.015/1K output tokens

### Gemini 3 Pro (Google) - November 18, 2025
- **Model ID:** `gemini-3-pro-latest`
- **Use Case:** Features lists + RESO-formatted MLS data
- **Capabilities:**
  - Fast inference speed
  - Excellent structured JSON output
  - RESO Data Dictionary compliance
  - Thought signatures for reasoning context
- **Special Features:**
  - `temperature=1.0` (default, don't change - affects reasoning)
  - Thought signature maintenance across calls
  - JSON mode for structured output
- **Cost:** ~$0.00125/1K input, ~$0.005/1K output tokens (most cost-effective)

## Setup Instructions

### 1. Clone and Navigate
```bash
cd listing-magic/python-backend
```

### 2. Create Virtual Environment
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Configure Environment
```bash
cp .env.example .env
# Edit .env and add your API keys
```

Required API keys:
- `OPENAI_API_KEY` - Get from [OpenAI Platform](https://platform.openai.com/api-keys)
- `ANTHROPIC_API_KEY` - Get from [Anthropic Console](https://console.anthropic.com/)
- `GEMINI_API_KEY` - Get from [Google AI Studio](https://makersuite.google.com/app/apikey)

### 5. Run the Server
```bash
uvicorn main:app --reload --port 8000
```

### 6. View API Documentation
Open [http://localhost:8000/docs](http://localhost:8000/docs) in your browser.

## API Endpoints

### Health Check
```bash
GET /health
```
Returns status of all AI services and configured models.

### Generate Public Remarks (GPT-4.1 Vision)
```bash
POST /api/generate-public-remarks
```
Analyzes property photos and generates 250-word listing description.

**Request:**
```json
{
  "property": {
    "address": {
      "street": "123 Main St",
      "city": "Austin",
      "state": "TX",
      "zip_code": "78701"
    },
    "photos": [
      {"url": "https://example.com/photo1.jpg"}
    ],
    "bedrooms": 4,
    "bathrooms": 3.5
  },
  "max_words": 250,
  "analyze_photos": true
}
```

**Response:**
```json
{
  "success": true,
  "text": "Welcome to this stunning 4-bedroom residence...",
  "word_count": 245,
  "extracted_features": {
    "bedrooms": 4,
    "bathrooms": 3.5,
    "kitchen_features": ["granite countertops", "stainless appliances"],
    "condition": "Excellent"
  },
  "photos_analyzed": 12,
  "usage": {
    "model_used": "gpt-4.1",
    "cost_usd": 0.065
  }
}
```

### Generate Walk-thru Script (Claude Sonnet 4.5)
```bash
POST /api/generate-walkthru-script
```
Creates natural video narration script.

**Request:**
```json
{
  "property": { ... },
  "duration_seconds": 120,
  "style": "conversational",
  "include_intro": true,
  "include_outro": true
}
```

### Generate Features (Gemini 3 Pro)
```bash
POST /api/generate-features
```
Extracts categorized property features.

### Generate RESO Data (Gemini 3 Pro)
```bash
POST /api/generate-reso
```
Creates RESO-formatted MLS data.

### Generate Video
```bash
POST /api/generate-video
```
Combines photos + script into video with voiceover.

## Cost Breakdown

Estimated cost per full property generation:

| Component | Model | Est. Cost |
|-----------|-------|-----------|
| Public Remarks | GPT-4.1 Vision | $0.055 |
| Walk-thru Script | Claude Sonnet 4.5 | $0.015 |
| Features List | Gemini 3 Pro | $0.004 |
| RESO Data | Gemini 3 Pro | $0.007 |
| **Total** | | **~$0.08** |

*Costs are estimates based on typical usage patterns.*

## Fallback Logic

If a primary model is unavailable, the system falls back:

| Primary | Fallback | Notes |
|---------|----------|-------|
| GPT-4.1 | Claude | Loses photo analysis capability |
| Claude | GPT-4.1 | May be less natural-sounding |
| Gemini | GPT-4.1 | Slower, more expensive |

All fallbacks are logged with timestamps and reasons.

## Running Tests

```bash
# Start the server first
uvicorn main:app --reload --port 8000

# In another terminal
python test_api.py
```

## Project Structure

```
python-backend/
├── main.py              # FastAPI application
├── config.py            # Model & app configuration
├── requirements.txt     # Python dependencies
├── .env.example         # Environment template
├── test_api.py          # API test suite
├── README.md            # This file
├── models/              # Pydantic request/response models
│   ├── __init__.py
│   ├── requests.py
│   └── responses.py
├── services/            # AI service integrations
│   ├── __init__.py
│   ├── openai_service.py    # GPT-4.1 Vision
│   ├── anthropic_service.py # Claude Sonnet 4.5
│   └── gemini_service.py    # Gemini 3 Pro
└── utils/               # Utility modules
    ├── __init__.py
    ├── cost_tracker.py      # API cost tracking
    ├── prompt_templates.py  # Optimized prompts
    ├── image_handler.py     # Image preparation
    └── vision_analyzer.py   # GPT-4.1 photo analysis
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | OpenAI API key | Yes |
| `ANTHROPIC_API_KEY` | Anthropic API key | Yes |
| `GEMINI_API_KEY` | Google AI API key | Yes |
| `OPENAI_MODEL` | OpenAI model ID | No (default: gpt-4.1) |
| `ANTHROPIC_MODEL` | Anthropic model ID | No (default: claude-sonnet-4-20250514) |
| `GEMINI_MODEL` | Gemini model ID | No (default: gemini-3-pro-latest) |
| `ALLOWED_ORIGINS` | CORS origins (comma-separated) | No |
| `ENVIRONMENT` | development/production | No |
| `DEBUG` | Enable debug logging | No |

## Notes

### GPT-4.1 Vision Capabilities
- Processes multiple images in a single request
- Automatically detects room types and counts
- Assesses property condition and style
- Extracts specific features (countertops, flooring, etc.)
- Confidence scores for each detection

### Gemini 3 Thought Signatures
- Maintains reasoning context across structured outputs
- Temperature must remain at 1.0 (default)
- Improves accuracy of RESO field mapping
- Enables better feature categorization

### Claude Sonnet 4.5 Narration
- Optimized for ~150 words/minute speaking rate
- Includes natural pauses and transitions
- Sectioned output for video editing
- Emotional engagement techniques

## License

Proprietary - Listing Magic
