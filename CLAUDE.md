# QuickList - AI Agent Instructions

> **IMPORTANT**: Read this file completely before starting any task. This is your source of truth for the QuickList project.

## 🎯 Project Overview

**QuickList** (formerly ListingMagic) is a SaaS web application that uses AI to generate professional, MLS-compliant real estate listing content in 60-90 seconds.

**Company**: LM-Intel (Davey Ljungberg + John)
**Status**: Pre-launch Beta
**First Beta Tester**: Chelsea Barrett (January 2025)

### What QuickList Does
Real estate agents upload property photos → QuickList automatically creates:
- Marketing description (Public Remarks)
- MLS-ready data extraction (22+ fields)
- Feature sheets and property highlights
- Silent video slideshows (configurable 2-10s per photo)

---

## 🔄 MANDATORY: Real-Time Documentation Updates

> **This is not optional.** Update documentation AS YOU WORK, not at the end of a session.

When you make ANY significant change to QuickList, you MUST immediately update the relevant documentation files:

### What Triggers an Update
- **New feature added** → Update CLAUDE.md + .cursorrules (codebase structure, generation flow)
- **Bug fixed** → Add to "Solved Issues" in both files + `.agent-workspace/logs/bugs/`
- **Architecture change** → Update diagrams, file structure, tech decisions
- **New API endpoint** → Update relevant sections
- **Database schema change** → Document in appropriate sections
- **New dependency/library** → Update tech stack info
- **Workflow change** → Update generation flow, development workflow

### Files to Update
| Change Type | Update These Files |
|-------------|-------------------|
| Code structure | `CLAUDE.md`, `.cursorrules` |
| Bug fix | `CLAUDE.md` (Solved Issues), `.cursorrules` (Known Issues), `.agent-workspace/logs/bugs/` |
| Feature change | `CLAUDE.md`, `.cursorrules`, `.agent-workspace/context/current-sprint.md` |
| Tech decision | `.agent-workspace/context/tech-decisions.md` |
| New pattern | `.agent-workspace/knowledge/` |

### Example: After Adding Video Persistence
```markdown
# In CLAUDE.md "Solved Issues":
- ✅ Video not loading on previous listings → Added video_url to database, restored in handleLoadDescListing

# In .cursorrules "Known Issues":
- ✅ Video not persisting → video_url now saved to database
```

**Remember**: If you changed code, update the docs. No exceptions.

---

## 🏗️ Architecture (Three-Tier)

```
┌─────────────────────────────────────────────────────────────┐
│                   FRONTEND (Vercel)                         │
│  Next.js 15 + React 19 + TypeScript + Tailwind CSS         │
│  URL: https://listing-magic.vercel.app                     │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS/REST
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   BACKEND (Railway)                         │
│  Python FastAPI + Uvicorn                                  │
│  URL: https://listingmagic-production.up.railway.app       │
└────────────────────────┬────────────────────────────────────┘
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
     ┌─────────┐   ┌───────────┐  ┌────────────┐
     │ gpt-5.2 │   │ gemini-   │  │  Supabase  │
     │(primary)│   │2.0-flash  │  │ PostgreSQL │
     └─────────┘   │(fallback) │  └────────────┘
                   └───────────┘
```

### Key URLs
- **Frontend (Vercel)**: https://listing-magic.vercel.app
- **Backend (Railway)**: https://listingmagic-production.up.railway.app
- **Database (Supabase)**: https://vbfwcemtkgymygccgffl.supabase.co
- **GitHub**: https://github.com/DaveyLjungberg/ListingMagic

---

## 📁 Codebase Structure

```
listing-magic/
├── app/                            # Next.js App Router (Frontend)
│   ├── admin/                      # Admin-only pages
│   │   └── headlights/             # Analytics dashboard (Davey + John only)
│   │       └── page.jsx            # User metrics, revenue, cost tracking
│   ├── auth/                       # Authentication pages
│   │   ├── login/page.jsx          # Email/OAuth login with "Remember Me"
│   │   ├── signup/page.jsx         # Account creation with source tracking
│   │   └── callback/page.jsx       # OAuth callback handler
│   ├── dashboard/
│   │   ├── generate/               # Main generation page
│   │   │   ├── components/         # DescriptionsTab, MLSDataTab, ResultsTabs, GenerationProgress
│   │   │   ├── hooks/              # Custom React hooks (see below)
│   │   │   │   ├── useDescriptionsState.js   # Public remarks + features state
│   │   │   │   ├── useMLSState.js            # MLS extraction state
│   │   │   │   ├── useVideoGeneration.js     # Video generation state
│   │   │   │   ├── useWakeLockGeneration.js  # Wake lock + progress + notifications
│   │   │   │   └── useRefinement.js          # Iterative content refinement
│   │   │   └── page.jsx            # Main orchestrator
│   │   └── pricing/                # Credit purchase page
│   │       └── page.jsx            # Pricing cards + Stripe checkout
│   └── layout.jsx
├── components/
│   ├── DashboardHeader.jsx         # Header with "Buy Credits" button
│   ├── LayoutClient.js             # Client wrapper with session check
│   └── listing-magic/
│       ├── NameListingModal.jsx    # Credit gatekeeper modal
│       └── AddressInput.jsx        # Address entry component
├── libs/
│   ├── generate-api.ts             # Backend API client (all generation functions)
│   ├── credits.ts                  # Credit system client (getCreditBalance)
│   ├── listings.ts                 # Listings CRUD client
│   ├── photo-selection.ts          # Photo categorization + intelligent sampling
│   ├── smart-photo-selector.ts     # AI-based photo quality evaluation
│   ├── supabase-storage-upload.ts  # Batch upload to Supabase Storage
│   ├── logger.ts                   # Environment-aware logging utility
│   ├── supabase.js                 # Supabase client
│   └── utils.js                    # Utility functions (getDomainFromEmail, etc.)
├── types/
│   └── api.ts                      # TypeScript interfaces matching backend models
├── python-backend/                 # FastAPI Backend
│   ├── endpoints/                  # API endpoints (mls_data, video_generation, refine_content)
│   ├── services/                   # AI provider integrations
│   │   ├── ai_generation_service.py # Unified AI service with fallback (USE THIS)
│   │   ├── openai_service.py       # OpenAI integration (legacy)
│   │   └── gemini_service.py       # Gemini integration (legacy)
│   ├── compliance/fair_housing.py  # Fair Housing validation
│   ├── utils/prompt_templates.py   # All AI prompts
│   ├── main.py                     # FastAPI entry point
│   └── config.py                   # Backend configuration
└── .agent-workspace/               # Agent memory & learning (READ THIS)
```

---

## ⚠️ CRITICAL: Fair Housing Compliance

**Every AI-generated description MUST follow Fair Housing rules.**

### PROHIBITED Language
- Imperative/invitational: "Step inside", "Welcome to", "Come see"
- Second-person pronouns: "you", "your", "you'll love"
- Buyer-specific: "Perfect for families", "Ideal for retirees"
- Discriminatory terms: "Master bedroom" (use "Primary bedroom")

### REQUIRED Language
- Third-person only: "This residence features..."
- Factual descriptions: "The property includes..."
- Objective statements: "Located near schools"

**WRONG**: "Welcome to this stunning home! You'll love the master bedroom."
**CORRECT**: "This residence features a spacious primary bedroom."

---

## 💳 Domain-Aware Credit System

Credits control access to listing generation. The system supports both individual and team credits.

### How Credits Work
1. **Domain credits** (team pool): Shared by all users with the same email domain (e.g., `@example.com`)
2. **Personal credits**: Tied to a specific email address

**Priority**: Domain credits are used first, then personal credits.

**Credit Refunds**: If generation fails after a credit is consumed, the system automatically refunds 1 credit via the `refund_credit_attempt` RPC. Users see a toast: "Generation failed. Credit refunded." This ensures users are never charged for unsuccessful generations.

### Database Schema
```sql
-- Table: credit_balances
-- Stores credit balances for personal and domain (team) accounts
CREATE TABLE credit_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_identifier TEXT UNIQUE NOT NULL,  -- "john@example.com" (personal) OR "example.com" (domain)
  credits INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Table: credit_transactions
-- Tracks all credit debits/refunds with idempotent keys
CREATE TABLE credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL,                -- Links to generation attempt
  user_email TEXT NOT NULL,
  transaction_type TEXT NOT NULL,          -- 'debit' or 'refund'
  amount INTEGER DEFAULT 1,
  source TEXT,                             -- 'domain' or 'personal'
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(attempt_id, transaction_type)     -- Prevents duplicate refunds
);

-- Table: listings
-- Stores generated listing content
CREATE TABLE listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  name TEXT,
  address_json JSONB,          -- street, city, state, zip, taxData, attempt_id
  photo_urls TEXT[],
  public_remarks TEXT,
  features JSONB,
  mls_data JSONB,
  video_url TEXT,
  ai_cost_details JSONB,       -- Cost breakdown by task
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### API Endpoints (Credits)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/credits` | GET | Get user's credit balance |
| `/api/credits` | POST | Use a credit (decrement) |
| `/api/credits/add` | POST | Add credits (internal/admin) |
| `/api/stripe/checkout` | POST | Create Stripe checkout for credit purchase |
| `/api/stripe/webhook` | POST | Stripe webhook for credit fulfillment |

### API Endpoints (Generation - Frontend Proxies)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/generate-public-remarks` | POST | Proxy to backend for public remarks |
| `/api/generate-features` | POST | Proxy to backend for features list |
| `/api/extract-mls-data` | POST | Unified MLS extraction (base64 or URLs) |
| `/api/analyze-photos` | POST | Batch photo analysis via GPT-4 Vision (60s timeout) |
| `/api/listings` | GET/POST | CRUD operations for user listings |
| `/api/health` | GET/HEAD | Health check (used as wake lock heartbeat fallback) |

### API Endpoints (Legacy/Internal)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/generate-mls-data` | POST | Legacy - forwards to `/api/extract-mls-data` |
| `/api/generate-mls-data-urls` | POST | Legacy - forwards to `/api/extract-mls-data` |
| `/api/webhook/stripe` | POST | Legacy subscription webhook (separate from credits) |
| `/api/stripe/create-checkout` | POST | Legacy checkout (uses MongoDB) |
| `/api/stripe/create-portal` | POST | Stripe customer portal creation |
| `/api/lead` | POST | Lead capture from landing page |
| `/api/auth/callback` | GET | OAuth2 callback handler |

### Frontend Client (`libs/credits.ts`)
```typescript
import { getCreditBalance, useCredit, hasCredits } from "@/libs/credits";

// Check balance
const { data } = await getCreditBalance();
// { domain_credits: 10, personal_credits: 5, total_credits: 15 }

// Use a credit before generation
const result = await useCredit();
// { success: true, source: 'domain', remaining: 9 }
```

### Supabase RPC Functions
- `add_credits(owner, amount)` - Add credits to personal or team balance (primary function for purchases)
- `check_and_decrement_credits(user_email)` - Use a credit (legacy, no attempt tracking)
- `check_and_decrement_credits_with_attempt(user_email, attempt_id)` - Use a credit with attempt tracking (recommended)
- `get_credit_balance(user_email)` - Get balance
- `increment_credits(user_email, amount)` - Add personal credits (legacy, kept for compatibility)
- `refund_credit_attempt(user_email, attempt_id, amount)` - Idempotent refund by attempt (recommended)

**Important - RPC Parameter Naming**: 
When calling RPC functions from the frontend, ensure parameter names match exactly. For example:
```javascript
// ✅ Correct - matches SQL function signature
await supabase.rpc('check_and_decrement_credits_with_attempt', { 
  user_email: user.email,
  attempt_id: attemptId 
})

// ✅ Correct - idempotent refund
await supabase.rpc('refund_credit_attempt', {
  user_email: user.email,
  attempt_id: attemptId,
  amount: 1
})

// ❌ Wrong - parameter name mismatch will cause RPC error
await supabase.rpc('check_and_decrement_credits', { p_user_email: user.email })
```
Always verify the SQL function signature in `supabase/migrations/` and match the parameter names exactly. Add debug logs before RPC calls to troubleshoot authentication or parameter issues.

### Stripe Integration (Credit Purchases)
QuickList uses Stripe Checkout for credit purchases. Credits can be purchased for **personal** use or for an entire **domain** (team).

**Pricing Model**: Per-pack pricing with 3 tiers:
- **Starter**: 1 credit for $20
- **Pro**: 10 credits for $150 ($15/credit)
- **Agency**: 50 credits for $400 ($8/credit)

**Flow**:
1. Frontend calls `POST /api/stripe/checkout` with `{ priceId, quantity: 1, creditsAmount, creditType, userEmail, successUrl, cancelUrl }`
2. Backend creates Stripe Checkout Session with:
   - Line item: `quantity = 1` (buy one pack)
   - Metadata: `{ targetIdentifier, creditsAmount, creditType }` for fulfillment
3. User completes payment on Stripe-hosted page
4. Stripe webhook (`POST /api/stripe/webhook`) receives `checkout.session.completed` event
5. Webhook calls Supabase RPC `add_credits(owner, amount)` to atomically increment `credit_balances`

**Credit Types**:
- `creditType: "personal"` → Credits added to user's email (`targetIdentifier = "user@example.com"`)
- `creditType: "domain"` → Credits added to team pool (`targetIdentifier = "example.com"`)

**Environment Variables (Frontend)**:
- `NEXT_PUBLIC_STRIPE_PRICE_STARTER` - Stripe Price ID for 1 credit pack ($20)
- `NEXT_PUBLIC_STRIPE_PRICE_PRO` - Stripe Price ID for 10 credits pack ($150)
- `NEXT_PUBLIC_STRIPE_PRICE_AGENCY` - Stripe Price ID for 50 credits pack ($400)

**Environment Variables (Backend/Server)**:
- `STRIPE_SECRET_KEY` - Stripe API secret key
- `STRIPE_CREDITS_WEBHOOK_SECRET` - Webhook signing secret (or falls back to `STRIPE_WEBHOOK_SECRET`)
- `SUPABASE_SERVICE_ROLE_KEY` - Required for RPC calls
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SITE_URL` - For URL validation in checkout

**Important**: Stripe Prices must be configured as **per-pack** prices in your Stripe Dashboard:
- Each Price represents the total cost of the pack (not per-credit)
- Frontend always sends `quantity: 1` to Stripe
- The `creditsAmount` field (1/10/50) is passed in metadata for webhook fulfillment

**Note**: The credits webhook (`/api/stripe/webhook`) is separate from the legacy subscription webhook (`/api/webhook/stripe`).

**Revenue Tracking** (added Dec 28, 2025):
- Stripe webhook automatically tracks revenue after successful credit purchases
- Calls `update_user_revenue` RPC with email and dollar amount
- For domain purchases: uses customer email from Stripe
- For personal purchases: uses targetIdentifier (user email)
- Revenue stored in user profile for analytics dashboard

---

## 📊 User Analytics & Tracking (Dec 28, 2025)

QuickList tracks user activity for analytics and business insights.

### Session Tracking
**Login sessions** are automatically logged for both authentication methods:
- Email/password login → tracked in `app/auth/login/page.jsx`
- OAuth login (Google/Apple) → tracked in `app/auth/callback/page.jsx`
- Both call `log_user_session` RPC with user email
- Non-blocking: errors don't prevent login

### User Source Tracking
**Signup source tracking removed** (Jan 11, 2026):
- Previously asked "How did you hear about us?" during signup
- Removed to simplify the signup flow
- The `update_user_source` RPC and `source` column in profiles still exist but are unused

### Remember Me Feature
**Session persistence** controlled by user preference:
- Checkbox in login form (defaults to checked)
- Stores preference in localStorage + sessionStorage
- On browser restart: if unchecked, user is signed out automatically
- Checked in `LayoutClient.js` on app mount (skips auth pages)

### Admin Analytics Dashboard
**Headlights Dashboard** (`/admin/headlights`) - protected page for Davey + John:
- **Access control**: Only `admin@lm-intel.ai` and `jmcdrmtt00@gmail.com`
- **Metrics displayed**:
  - Total accounts, logins, listings
  - Paid listings (credits purchased)
  - Total revenue and cost
- **Per-user table**: Email, brokerage, join date, source, activity, revenue, cost
- **Date filter**: View historical data as of any date
- **Data source**: Supabase view `headlights_overview`

### Required RPC Functions
```sql
-- Log user login session
CREATE FUNCTION log_user_session(user_email_param TEXT) RETURNS VOID;

-- Save signup source
CREATE FUNCTION update_user_source(user_email_param TEXT, source_param TEXT) RETURNS VOID;

-- Track revenue from credit purchases
CREATE FUNCTION update_user_revenue(user_email_param TEXT, amount_param DECIMAL) RETURNS VOID;
```

### Required Database Schema
```sql
-- User sessions table
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY,
  user_email TEXT,
  logged_in_at TIMESTAMP,
  created_at TIMESTAMP
);

-- Profiles table additions
ALTER TABLE profiles ADD COLUMN source TEXT;
ALTER TABLE profiles ADD COLUMN revenue_to_date DECIMAL(10,2) DEFAULT 0;

-- Headlights analytics view
CREATE VIEW headlights_overview AS
  SELECT user_id, listor_email, brokerage_domain, date_account_opened,
         source, num_listings, num_logins, new_listing_credits,
         revenue_to_date, cost_to_date
  FROM profiles;
```

---

## 🏠 ATTOM Tax Records API

ATTOM provides property tax data (yearBuilt, lotSize, APN, county) to override AI estimates for MLS extraction.

### Endpoint
- **API Route**: `POST /api/lookup-tax-records`
- **ATTOM Endpoint**: `GET https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/detail`
- **Called From**: `components/listing-magic/AddressInput.jsx` (auto-fetch only)

### Cost-Control Safeguards (Dec 23, 2025)

| Layer | Safeguard | Details |
|-------|-----------|---------|
| Client | Session Cache | `taxCache` Map with normalized address key (`STREET\|CITY\|STATE\|ZIP`) |
| Client | In-Flight Lock | `inFlightRequests` Map with AbortController - only one request per address |
| Client | Failure Cooldown | `taxFailures` Map - 60s backoff before retrying failed addresses |
| Client | Debounce | 800ms delay after address is complete before fetching |
| Server | Listing Cache | Tax data stored in `address_json.taxData` in Supabase |

### Auto-Fetch Flow
1. User enters complete address (street + city + state + 5-digit ZIP)
2. 800ms debounce to avoid fetching while typing
3. Check client cache → if hit, use cached data (no API call)
4. Check in-flight lock → if request pending for same address, skip
5. Check failure cooldown → if failed < 60s ago, show message and skip
6. If `listingId` provided → check Supabase `address_json.taxData`
7. If no cache hit → call ATTOM API
8. Cache result in both client Map and Supabase (if `listingId`)

### Data Format
```javascript
{
  apn: "1234-567-890",        // String or null
  yearBuilt: 1985,            // Integer or null
  lotSize: "7,500 sqft",      // String with units or null
  county: "Los Angeles",      // String or null
  fetchedAt: "2025-12-23..."  // ISO timestamp
}
```

### Environment Variable
- `ATTOM_API_KEY` - Required for tax record lookups

---

## 🤖 AI Model Architecture (Unified Service)

**All AI generation uses a single unified service with transparent fallback.**

### Model Configuration (Dec 26, 2025)
| Role | Model | Provider |
|------|-------|----------|
| **Primary** | `gpt-5.2` | OpenAI |
| **Fallback** | `gemini-2.0-flash` | Google |

### Task Assignment
| Task | Model Used |
|------|------------|
| Photo Analysis | gpt-5.2 (primary) |
| Public Remarks | gpt-5.2 (primary) |
| Features List | gpt-5.2 (primary) |
| MLS Extraction | gpt-5.2 (primary) |

### Fallback Rules (CRITICAL)
The Gemini fallback is ONLY triggered for **infrastructure errors**:
- ✅ Network/connection errors
- ✅ Timeouts (APITimeoutError)
- ✅ Rate limits (429)
- ✅ Server errors (5xx)

The Gemini fallback is NOT triggered for **content errors**:
- ❌ Fair Housing violations
- ❌ JSON parsing/validation errors
- ❌ Empty or low-quality output
- ❌ Any error where OpenAI successfully responded

**Why?** Content errors need to be fixed at the source (prompts, validators), not worked around with a different model.

### Unified Service
All endpoints use `services/ai_generation_service.py`:
```python
from services.ai_generation_service import generate_content_with_fallback

result = await generate_content_with_fallback(
    system_prompt=SYSTEM_PROMPT,
    user_prompt=user_prompt,
    photo_urls=photo_urls,
    task_type="public_remarks",  # or "features", "mls"
    temperature=0.7,
    max_output_tokens=1200
)
# result.provider_used = "openai" or "gemini"
# result.is_fallback = True if Gemini was used
```

### OpenAI Responses API Format
The service uses the OpenAI Responses API (NOT Chat Completions):
```python
# Internal implementation uses:
# IMPORTANT: input must be a list of MESSAGE OBJECTS, not raw content items
response = await client.responses.create(
    model="gpt-5.2",
    instructions=system_prompt,           # System prompt
    input=[                               # List of message objects
        {
            "role": "user",
            "content": [                  # Content items go INSIDE the message
                {"type": "input_text", "text": user_prompt},
                {"type": "input_image", "image_url": url, "detail": "high"},
            ]
        }
    ],
    temperature=0.7,
    max_output_tokens=1200                # NOT max_tokens!
)
content = response.output_text            # Extract result
```

**CRITICAL**: The `input` parameter must be a list of message objects with `role` and `content` fields. Passing raw `input_text`/`input_image` items directly to `input` will cause a 400 error.

**Frontend is Model-Agnostic**:
- The frontend does NOT know which AI provider/model is used
- All generation endpoints (`/api/generate-public-remarks`, `/api/generate-features`, `/api/extract-mls-data`) proxy to the backend
- The backend handles all model selection and fallback logic
- Provider/model metadata is ONLY shown in dev/debug mode (gated by `NODE_ENV !== "production"` and `NEXT_PUBLIC_DEBUG_AI_METADATA="true"`)

**Note**: Walkthrough script generation was removed (Dec 15, 2025). Videos are now silent slideshows.

---

## 📸 Photo Categorization Pipeline

Before generating the Features sheet, photos are categorized by room type for intelligent selection.

### Categories
| Category | Examples |
|----------|----------|
| EXTERIOR | Front yard, backyard, pool, garage exterior |
| LIVING | Living room, family room, great room |
| KITCHEN | Kitchen, breakfast nook, pantry |
| BATHROOM | Full bath, half bath, primary bath |
| BEDROOM | Primary bedroom, guest bedroom |
| UTILITY | Laundry, garage interior, storage |

### Flow
1. **AI Categorization** (25s timeout): Backend `/api/categorize-photos` assigns room type + priority score to each photo
2. **Fallback Sampling**: If AI times out/errors/returns unusable buckets, deterministic fallback kicks in:
   - `spreadSample()` selects photos evenly distributed across the album
   - `pickFromThird()` samples from beginning/middle/end of photo list
   - Category quotas ensure diverse representation
3. **Selection**: `libs/photo-selection.ts` picks photos for Features sheet generation
4. **Guardrails**: Throws error if selection produces empty list when photos exist

### Why This Matters
- Features Sheet needs diverse photo coverage to extract all property features
- Prevents "Not provided" sections due to photos missing certain rooms
- Fallback ensures the pipeline never fails due to categorization issues

---

## 🔧 Python Backend Endpoints

The FastAPI backend exposes these endpoints (base URL: `https://listingmagic-production.up.railway.app`):

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/generate-public-remarks` | POST | Generate MLS public remarks from photos |
| `/api/generate-features` | POST | Generate features list from photos |
| `/api/generate-mls-data` | POST | Extract MLS data from base64 images |
| `/api/generate-mls-data-urls` | POST | Extract MLS data from photo URLs |
| `/api/categorize-photos` | POST | Categorize photos by room type (EXTERIOR/LIVING/KITCHEN/BATHROOM/BEDROOM/UTILITY) |
| `/api/refine-content` | POST | Iterative content refinement with compliance checking |
| `/api/check-compliance` | POST | Fair Housing compliance validation |
| `/api/generate-video` | POST | Generate silent video slideshow from photos |
| `/api/costs/summary` | GET | Daily cost breakdown by provider/task |
| `/api/models` | GET | Model configuration info |

### Backend Endpoint Files
```
python-backend/endpoints/
├── mls_data.py           # MLS extraction endpoints
├── photo_categorization.py   # Photo categorization for features
├── refine_content.py     # Iterative content refinement
└── video_generation.py   # FFmpeg-based video creation
```

---

## 🚀 Development Workflow

### Local Development
```bash
# Terminal 1 - Frontend
cd /Users/davidljungberg/Documents/listing-magic
npm run dev  # http://localhost:3000

# Terminal 2 - Backend
cd /Users/davidljungberg/Documents/listing-magic/python-backend
source venv/bin/activate
uvicorn main:app --reload --port 8000  # http://localhost:8000
```

### Common Commands
```bash
# Kill stuck ports
lsof -ti:3000 | xargs kill -9
lsof -ti:8000 | xargs kill -9

# Backend health check
curl http://localhost:8000/health

# Deploy (auto-deploy on push to main)
git push origin main
```

---

## 🔐 Environment Variables

### Frontend (.env.local)
| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_CREDITS_WEBHOOK_SECRET` | Webhook secret for credits webhook |
| `NEXT_PUBLIC_STRIPE_PRICE_STARTER` | Stripe Price ID for 1 credit ($20) |
| `NEXT_PUBLIC_STRIPE_PRICE_PRO` | Stripe Price ID for 10 credits ($150) |
| `NEXT_PUBLIC_STRIPE_PRICE_AGENCY` | Stripe Price ID for 50 credits ($400) |
| `NEXT_PUBLIC_SITE_URL` | Site URL for Stripe callbacks |
| `PYTHON_BACKEND_URL` | Backend URL (default: `http://localhost:8000`) |
| `ATTOM_API_KEY` | ATTOM API key for tax records |
| `NEXT_PUBLIC_DEBUG_AI_METADATA` | Enable AI provider/model display (dev only) |

### Backend (python-backend/.env)
| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI API key (gpt-5.2) |
| `GOOGLE_API_KEY` | Google API key (Gemini fallback) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `ENVIRONMENT` | Deployment environment (development/production) |
| `DEBUG` | Enable debug logging |
| `TEMP_STORAGE_PATH` | Temporary file storage (default: `./tmp`) |
| `MAX_UPLOAD_SIZE_MB` | Max upload size (default: 50MB) |
| `ENABLE_COST_TRACKING` | Enable cost tracking |
| `COST_ALERT_THRESHOLD` | Cost alert threshold (default: $10.00) |
| `ALLOWED_ORIGINS` | CORS whitelist (supports Vercel preview URLs) |

---

## 📋 Before Starting Any Task

1. **Check `.agent-workspace/context/current-sprint.md`** - What am I working on?
2. **Check `.agent-workspace/logs/bugs/`** - Has this bug been solved before?
3. **Check `.agent-workspace/knowledge/error-solutions.md`** - Known solutions index
4. **If working on frontend**: Read `app/dashboard/generate/` structure
5. **If working on backend**: Read `python-backend/` structure

---

## 🐛 Known Issues (Check Before Debugging)

### Active Issues
None currently active.

### Recently Fixed (Jan 11, 2026)
- ✅ **"Listing updated" toast spam** → Auto-save effects had entire state objects in dependency arrays causing infinite re-runs (Jan 11, 2026):
  - Removed `descState` and `mlsState` objects from dependency arrays (only specific properties needed)
  - Added `autoSavedListingsRef` (Set) to track which listings have been saved
  - Each save operation uses a unique key (`listingId-desc`, `listingId-mls`) to prevent duplicates
  - If save fails, key is removed from Set to allow retry
  - Changed toast message from "Listing updated automatically" to "Listing saved"
  - Affects: `app/dashboard/generate/page.jsx`

### Solved Issues (Don't Re-Fix)
- ✅ **Team credit support** → Implemented full team/domain credit purchasing (Dec 29, 2025):
  - Created `add_credits(owner, amount)` RPC function in Supabase
  - Supports both personal (email) and team (domain) credit pools
  - Updated webhook to use new RPC instead of `increment_credits`
  - Team credits shared by all users with same email domain
  - Affects: `app/api/stripe/webhook/route.js`, Supabase RPC functions
- ✅ **Stripe webhook credits not populating** → Fixed RPC function mismatch (Dec 29, 2025):
  - Webhook was initially calling non-existent `add_credits` RPC function
  - Temporarily used `increment_credits` as a quick fix (personal credits only)
  - Then implemented full `add_credits` RPC to support both personal and team credits
  - All three credit packages now successfully add credits after purchase
  - Affects: `app/api/stripe/webhook/route.js`
- ✅ **Previous listing data bleed-through** → State fully cleared before loading new listing (Dec 29, 2025):
  - `handleLoadDescListing` now clears ALL state (descriptions, MLS, video) before loading
  - Prevents "ghost data" from previous listings appearing when switching
  - Unconditional reset → conditional load pattern ensures clean slate
  - Affects: `app/dashboard/generate/page.jsx`
- ✅ **User analytics tracking** → Implemented comprehensive tracking system (Dec 28, 2025):
  - Session logging for both email and OAuth logins
  - Signup source tracking with dropdown selection
  - Revenue tracking in Stripe webhook
  - Admin analytics dashboard at `/admin/headlights`
  - "Remember Me" feature with automatic session expiry
- ✅ **Google OAuth integration** → Implemented Supabase OAuth flow (Dec 28, 2025):
  - Login page now supports Google and Apple OAuth
  - Created `/app/auth/callback/page.jsx` to handle OAuth redirects
  - Session tracking integrated into OAuth flow
- ✅ Photo categorization timeout → Increased timeout + deterministic fallback (Dec 26, 2025):
  - Timeout increased from 15s to 25s (configurable, capped <30s)
  - Added deterministic fallback categorization when AI times out/errors/returns unusable buckets
  - Fallback uses `spreadSample()` + `pickFromThird()` utilities to sample across entire album
  - Fallback preserves category representation via quotas (EXTERIOR/LIVING/KITCHEN/BATHROOM/BEDROOM/UTILITY) and album-wide sampling
  - Features Sheet now always receives diverse photo coverage (no more "Not provided" due to categorization failures)
  - Added guardrails: throws clear error if selection produces empty list when photos exist
  - Lightweight logging: logs fallback reason (timeout/error/unusable) + bucket counts
  - Affects: `libs/photo-selection.ts`
- ✅ Features/MLS/Public Remarks generating with 0 photos (base64 ignored) → Fixed base64 photo forwarding (Dec 27, 2025): 
  - Backend endpoints were only forwarding `photo.url` into unified AI service, ignoring `photo.base64`
  - Result: Features sheet often returned “Not provided (no photos/data…)” across all sections
  - Fix: convert base64 inputs into `data:<mime>;base64,...` URLs when building `photo_urls`
  - Gemini fallback now supports `data:` URLs as well (no HTTP download attempt)
  - Affects: `python-backend/main.py`, `python-backend/services/ai_generation_service.py`
- ✅ RPC fallback too broad + useless error logs → Tightened to PGRST202-only + actionable logging (Dec 26, 2025):
  - Only fall back to legacy RPC when `error.code === "PGRST202"` (function not found)
  - Removed message-based fallback (`errorMessage.includes("Could not find...")`)
  - If RPC exists but errors (permissions, ambiguous column, etc.), surface real error to user
  - Added `logRpcError()` helper that logs: `code`, `message`, `details`, `hint`, `status`, `statusText`, `paramKeys`
  - Now captures `status`/`statusText` from RPC response: `{ data, error, status, statusText }`
  - Refund failures show toast with error code: `"Credit refund failed (CODE)"`
  - Affects: `NameListingModal.jsx` (debit RPC), `page.jsx` (refund RPC)
- ✅ photoCompliance client-bundle issue → Temporarily disabled (Dec 26, 2025):
  - `libs/photoCompliance.js` imports `face-api.js`/`tfjs` which try to resolve Node.js `fs` in browser
  - Removed client-side import from `useDescriptionsState.js`
  - Scan handler now shows toast: `"Photo compliance scanning is temporarily disabled"`
  - TODO: Move to server-side API route or use browser-safe ML library
  - Low priority for beta launch
- ✅ OpenAI 400 error "max_tokens unsupported" → Switched to Responses API (Dec 26, 2025):
  - Now uses `client.responses.create()` instead of `client.chat.completions.create()`
  - Uses `max_output_tokens` parameter (NOT `max_tokens` or `max_completion_tokens`)
  - Uses `instructions` for system prompt, `input` for user content with `input_image`/`input_text` types
  - Uses `response.output_text` to extract content
- ✅ OpenAI 400 error "Invalid value: 'input_text'" → Fixed input format (Dec 26, 2025):
  - `input` must be a list of MESSAGE OBJECTS, not a flat list of content items
  - WRONG: `input=[{"type": "input_text", ...}, {"type": "input_image", ...}]`
  - RIGHT: `input=[{"role": "user", "content": [{"type": "input_text", ...}, ...]}]`
  - Added defensive logging for 400 errors with input shape info
- ✅ AI model fragmentation → Unified all generation to use gpt-5.2 primary with gemini-2.0-flash fallback (Dec 26, 2025):
  - Created `services/ai_generation_service.py` as single source of truth
  - Fallback only triggers for infrastructure errors (timeouts, 5xx, rate limits)
  - Content errors do NOT trigger fallback (Fair Housing, JSON validation)
  - All endpoints now use `generate_content_with_fallback()`
- ✅ Claude 429 TPM rate limit → Removed direct Claude calls from all endpoints (Dec 26, 2025):
  - Updated `endpoints/refine_content.py` to use unified AI service (was calling Claude directly)
  - Updated `endpoints/photo_categorization.py` to use unified AI service (was calling Claude directly)
  - Removed `import anthropic` from both endpoints
  - All endpoints now consistently use OpenAI gpt-5.2 as primary with Gemini fallback
- ✅ Frontend model exposure → Made model-agnostic (Dec 26, 2025):
  - Removed client-side model selection from MLS extraction
  - Provider/model metadata is dev/debug-only (gated by env flags)
  - All frontend routes proxy to backend without knowing which AI provider is used
  - Created unified `/api/extract-mls-data` endpoint
- ✅ Background tasks running after Step 1 failure → Fixed pipeline control (Dec 26, 2025):
  - If Public Remarks generation fails, pipeline now stops immediately
  - Credit refund happens before returning (prevents background tasks)
  - Overlay closes to show error state clearly
  - Improved JSON parsing in `generatePublicRemarks()` and `generateFeatures()` to handle non-JSON error responses (HTML, plain text)
- ✅ Credit double-refund risk → Implemented idempotent refund system (Dec 26, 2025):
  - Added `credit_transactions` table with unique `(attempt_id, transaction_type)` constraint
  - Created `refund_credit_attempt()` RPC that only refunds once per attempt_id
  - Frontend generates UUID `attempt_id` before credit consumption in `NameListingModal`
  - Passes `attempt_id` through generation flow for safe refunds on failure
- ✅ Wake lock double-cleanup → Single-shot cleanup pattern (Dec 26, 2025):
  - Added `cleanupOnce()` function with flags to prevent duplicate cleanup
  - Both success and failure paths use same cleanup function
  - JavaScript `finally` block only runs cleanup if not already done
- ✅ "Unexpected token <" JSON parse errors → Reusable safe parsing (Dec 26, 2025):
  - Created `parseJsonResponse<T>()` helper in `libs/generate-api.ts`
  - Handles empty responses, HTML error pages, and plain text gracefully
  - Applied to all generation endpoints (Public Remarks, Features, MLS, Video, Refine, Compliance)
  - Shows first 200 chars of non-JSON response for debugging
- ✅ ATTOM duplicate calls → Implemented cost-control safeguards (Dec 23, 2025):
  - Client-side cache (session memory), in-flight lock, 60s failure cooldown
  - Server-side cache via `address_json.taxData` in Supabase
  - Removed manual "Fetch Tax Records" button (auto-fetch only)
  - 800ms debounce, AbortController for address changes
- ✅ Generation timeout → Increased to 300s
- ✅ Slow GPT-4.1 → Changed to gpt-5.2 (via unified service)
- ✅ MLS data clearing on listing switch → Fixed handleLoadDescListing
- ✅ Nested button hydration error → Changed to div role="button"
- ✅ Address lost on tab switch → AddressInput now controlled component
- ✅ Photos not showing when loading listing → Uses setPhotosFromUrls()
- ✅ Walkthrough script complexity → Feature removed entirely
- ✅ Video not loading on previous listings → Added video_url to database, saved after generation, restored in handleLoadDescListing
- ✅ Credit double-charging → Moved credit check to upfront modal gatekeeper (Dec 21, 2025)
- ✅ RPC parameter mismatch → Fixed NameListingModal to match `user_email` signature + boolean `success` response (Dec 21, 2025)
- ✅ `/api/credits` 500 on refresh → Made service-role optional, fallback to user auth client (Dec 27, 2025):
  - Added `export const runtime = "nodejs"` to guarantee Node runtime
  - `getServiceClient()` returns `null` instead of throwing when env vars missing
  - Both GET/POST prefer service client, fallback to authenticated `supabase` if unavailable
  - Client-side safe JSON parsing handles non-JSON 500 responses gracefully
  - 401 responses (not logged in) handled quietly without console noise

---

## 📝 After Completing Any Task

1. **If you fixed a bug**: Add entry to `.agent-workspace/logs/bugs/YYYY-MM-DD-description.md`
2. **If you made architecture decisions**: Update `.agent-workspace/context/tech-decisions.md`
3. **If it was a significant session**: Add summary to `.agent-workspace/logs/sessions/`
4. **If you discovered a reusable pattern**: Add to `.agent-workspace/knowledge/`

---

## 🔗 Quick References

**Key Files**:
| What | Where |
|------|-------|
| Login page (email + OAuth) | `app/auth/login/page.jsx` |
| Signup page (with source tracking) | `app/auth/signup/page.jsx` |
| OAuth callback handler | `app/auth/callback/page.jsx` |
| Session check logic | `components/LayoutClient.js` |
| Admin analytics dashboard | `app/admin/headlights/page.jsx` |
| Main generation UI | `app/dashboard/generate/components/DescriptionsTab.jsx` |
| MLS data display | `app/dashboard/generate/components/MLSDataTab.jsx` |
| Credit gatekeeper modal | `components/listing-magic/NameListingModal.jsx` |
| Pricing page | `app/dashboard/pricing/page.jsx` |
| Dashboard header | `components/DashboardHeader.jsx` |
| Backend API client (model-agnostic) | `libs/generate-api.ts` |
| Credit system client | `libs/credits.ts` |
| Credit API | `app/api/credits/route.ts` |
| Stripe checkout | `app/api/stripe/checkout/route.js` |
| Stripe webhook (with revenue tracking) | `app/api/stripe/webhook/route.js` |
| Generation proxies | `app/api/generate-public-remarks/route.ts`, `app/api/generate-features/route.ts` |
| MLS extraction (unified) | `app/api/extract-mls-data/route.ts` |
| Utility functions | `libs/utils.js` |
| AI prompts | `python-backend/utils/prompt_templates.py` |
| Unified AI service | `python-backend/services/ai_generation_service.py` |
| Fair Housing rules | `python-backend/compliance/fair_housing.py` |
| Agent memory | `.agent-workspace/` |
| TypeScript API types | `types/api.ts` |
| Luxury theme guide | `LUXURY_THEME_GUIDE.md` |
| Photo selection logic | `libs/photo-selection.ts` |
| Listings CRUD | `libs/listings.ts` |

**Dashboard URLs**:
- **Supabase Dashboard**: https://supabase.com/dashboard/project/vbfwcemtkgymygccgffl
- **Vercel Dashboard**: https://vercel.com/daveylungbergs-projects
- **Railway Dashboard**: https://railway.app
- **API Docs (local)**: http://localhost:8000/docs

---

## 📂 Agent Workspace

For detailed context, check the `.agent-workspace/` directory:
- `context/` - Current project state and decisions
- `logs/bugs/` - Bug journal (searchable history)
- `logs/sessions/` - Daily work summaries
- `prompts/` - Reusable task prompts
- `knowledge/` - Accumulated solutions and patterns

---

## 🎬 Generation Flow (Current)

**IMPORTANT: Credit Gatekeeper** - Credits are checked and charged BEFORE generation begins.

1. **Upload Photos** → Supabase Storage
2. **Name Listing Modal** → User enters address + ZIP, system calls `check_and_decrement_credits` RPC
   - ✅ **Has Credits**: Modal closes, proceed with generation
   - ❌ **No Credits**: Redirect to `/dashboard/pricing`
3. **Analyze Photos** → Backend AI (shows "Photo X of Y" progress)
4. **Generate Public Remarks** (CRITICAL STEP) → Backend AI
   - ✅ **Success**: Overlay closes, proceed to background tasks
   - ❌ **Failure**: Stop immediately, refund credit, keep error visible, do NOT continue
5. **Background Tasks** (only if Step 4 succeeded):
   - Features List → Backend AI
   - Video Generation → FFmpeg (silent slideshow)
   - MLS Extraction → Backend AI

**All AI tasks use unified service** (`services/ai_generation_service.py`) with automatic Gemini fallback for infrastructure errors only.

**Frontend API Routes** (model-agnostic):
- `/api/generate-public-remarks` → Proxies to backend
- `/api/generate-features` → Proxies to backend
- `/api/extract-mls-data` → Unified MLS extraction (accepts either base64 images or photo URLs)
  - Legacy routes `/api/generate-mls-data` and `/api/generate-mls-data-urls` forward to this endpoint

**Result Tabs**: Public Remarks | Features Sheet | Video Tour

**Credit Flow & Error Handling**:
- Credits charged **upfront** when user clicks "Start Project" in modal
- Each generation gets a unique `attempt_id` (UUID) for idempotent refunds
- `attempt_id` is also stored in the saved listing under `address_json.attempt_id` for audit/debug (listing ↔ attempt ↔ credit transactions)
- If **Public Remarks** (Step 1) fails:
  - Pipeline stops immediately (no background tasks run)
  - Credit automatically refunded via idempotent `refund_credit_attempt` RPC
  - Refund keyed by `attempt_id` - safe to call multiple times (no double-refunds)
  - User sees error in UI: "Generation failed. Credit refunded."
  - Overlay closes to show error state
  - Wake lock and cleanup run exactly once (single-shot pattern)
- If background tasks fail (Features/Video/MLS):
  - No credit refund (user already has Public Remarks content)
  - Errors shown in respective tabs

**Idempotent Refund System**:
- `credit_transactions` table tracks all debits/refunds with `attempt_id`
- `refund_credit_attempt(user_email, attempt_id, amount)` RPC ensures one refund per attempt
- Unique constraint on `(attempt_id, transaction_type)` prevents duplicate refunds
- Frontend generates `attempt_id` in `NameListingModal` before credit consumption
- Passes through generation flow for potential refund on failure

**Wake Lock & Background Tab Handling**:
The generation process can take 60-90 seconds. To prevent interruption:
- Browser Wake Lock API prevents screen sleep when available
- Fallback: Periodic HTTP heartbeat to `/api/health` (5-second intervals)
- Notification system alerts user when generation completes while tab is backgrounded
- Estimated time remaining displayed in `GenerationProgress` component (45s avg per step)
- Single-shot cleanup pattern prevents duplicate cleanup on success/failure paths
