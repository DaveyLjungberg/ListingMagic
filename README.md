# Listing Magic - AI-Powered Real Estate Marketing

Generate professional property listings, video scripts, and MLS data using GPT-4.1 Vision, Claude Sonnet 4.5, and Gemini 3 Pro.

## Overview

Listing Magic is a comprehensive AI-powered platform for real estate professionals. Upload property photos and basic details, and the platform generates:

- **Public Remarks**: Compelling MLS listing descriptions with automatic photo analysis
- **Walk-thru Scripts**: Natural, conversational video narration scripts
- **Features Lists**: Categorized property features for MLS systems
- **RESO Data**: MLS-compliant JSON data following RESO Data Dictionary standards

## Tech Stack

### Frontend
- **Next.js 15** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS 4** - Utility-first styling
- **DaisyUI 5** - Component library
- **shadcn/ui** - Accessible UI components

### Backend
- **Python 3.11+** - Backend runtime
- **FastAPI** - High-performance async API framework
- **Pydantic** - Data validation and serialization
- **Tenacity** - Retry logic with exponential backoff

### AI Models
| Model | Provider | Purpose |
|-------|----------|---------|
| **GPT-4.1 Vision** | OpenAI | Photo analysis + listing descriptions |
| **Claude Sonnet 4.5** | Anthropic | Natural video walk-thru scripts |
| **Gemini 3 Pro** | Google | Features extraction + RESO data |

## Project Structure

```
listing-magic/
├── app/                          # Next.js App Router
│   ├── dashboard/
│   │   └── generate/            # Main generation UI
│   └── api/                     # Next.js API routes (proxy to Python)
│       ├── generate-features/   # Features generation endpoint
│       ├── generate-public-remarks/  # Listing description endpoint
│       └── generate-walkthru-script/ # Video script endpoint
├── types/
│   └── api.ts                   # TypeScript interfaces for API
├── lib/
│   └── generate-api.ts          # API helper functions
├── components/
│   └── listing-magic/           # Custom components
│       ├── PhotoUploader.jsx    # Drag-drop photo upload
│       ├── AddressInput.jsx     # Address input with ZIP lookup
│       ├── GeneratedSection.jsx # Collapsible content sections
│       └── ChatbotInput.jsx     # Refinement instructions
├── python-backend/              # FastAPI Backend
│   ├── main.py                  # API endpoints
│   ├── config.py                # Model configurations
│   ├── models/
│   │   ├── requests.py          # Pydantic request models
│   │   └── responses.py         # Pydantic response models
│   ├── services/
│   │   ├── openai_service.py    # GPT-4.1 Vision integration
│   │   ├── anthropic_service.py # Claude Sonnet 4.5 integration
│   │   └── gemini_service.py    # Gemini 3 Pro integration
│   └── utils/
│       ├── prompt_templates.py  # AI prompt templates
│       └── cost_tracker.py      # Usage & cost tracking
└── libs/                        # Shared utilities
```

## Setup Instructions

### Prerequisites
- Node.js 18+
- Python 3.11+
- API keys for OpenAI, Anthropic, and Google AI

### Frontend Setup

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/listing-magic.git
cd listing-magic

# Install dependencies
npm install

# Create environment file
cp .env.example .env.local

# Edit .env.local with your settings
# (See Environment Variables section below)

# Start development server
npm run dev
```

The frontend will be available at `http://localhost:3000`

### Backend Setup

```bash
# Navigate to backend
cd python-backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create environment file
cp .env.example .env

# Edit .env with your API keys
# (See Environment Variables section below)

# Start development server
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`
Swagger docs at `http://localhost:8000/docs`

## Environment Variables

### Frontend (.env.local)

```env
# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret

# Python Backend API (used by Next.js API routes)
PYTHON_BACKEND_URL=http://localhost:8000

# Optional: MongoDB for user data
MONGODB_URI=mongodb://localhost:27017/listing-magic
```

### Backend (.env)

```env
# Environment
ENVIRONMENT=development
DEBUG=true

# AI API Keys (REQUIRED)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=AIza...

# Model Selection (optional - defaults shown)
OPENAI_MODEL=gpt-4.1
ANTHROPIC_MODEL=claude-sonnet-4-20250514
GEMINI_MODEL=gemini-3-pro-latest

# CORS
ALLOWED_ORIGINS=http://localhost:3000

# Cost Tracking
ENABLE_COST_TRACKING=true
COST_ALERT_THRESHOLD=10.0
```

## API Endpoints

### Content Generation

| Endpoint | Method | Description | AI Model |
|----------|--------|-------------|----------|
| `/api/generate-public-remarks` | POST | Generate listing description | GPT-4.1 Vision |
| `/api/generate-walkthru-script` | POST | Generate video script | Claude Sonnet 4.5 |
| `/api/generate-features` | POST | Extract property features | Gemini 3 Pro |
| `/api/generate-reso` | POST | Generate RESO MLS data | Gemini 3 Pro |
| `/api/generate-video` | POST | Generate video with voiceover | MoviePy |

### Utility Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Service health check |
| `/api/costs/summary` | GET | Usage and cost summary |
| `/api/costs/by-provider` | GET | Costs broken down by provider |

### Example Request

```bash
curl -X POST http://localhost:8000/api/generate-features \
  -H "Content-Type: application/json" \
  -d '{
    "property_details": {
      "address": {
        "street": "123 Main Street",
        "city": "Austin",
        "state": "TX",
        "zip_code": "78701"
      },
      "property_type": "single_family",
      "bedrooms": 4,
      "bathrooms": 3.5,
      "square_feet": 2800,
      "photos": []
    },
    "max_features": 30,
    "categorize": true
  }'
```

## Running Locally

### Start Both Servers

**Terminal 1 - Frontend:**
```bash
npm run dev
```

**Terminal 2 - Backend:**
```bash
cd python-backend
source venv/bin/activate
uvicorn main:app --reload
```

### Access Points
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs
- Dashboard: http://localhost:3000/dashboard/generate

## Deployment

### Frontend (Vercel)
```bash
vercel --prod
```

### Backend (Railway)
```bash
# Deploy to Railway
railway up
```

Or use Docker:
```bash
cd python-backend
docker build -t listing-magic-api .
docker run -p 8000:8000 --env-file .env listing-magic-api
```

## Cost Tracking

The platform tracks AI usage and costs in real-time:

| Model | Input Cost | Output Cost |
|-------|------------|-------------|
| GPT-4.1 Vision | $2.50/1M tokens | $10.00/1M tokens |
| Claude Sonnet 4.5 | $3.00/1M tokens | $15.00/1M tokens |
| Gemini 3 Pro | $2.00/1M tokens | $12.00/1M tokens |

View costs at `/api/costs/summary` or in the API logs.

## License

Private - All rights reserved.

## Support

For questions or issues, please open a GitHub issue.
