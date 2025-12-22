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
     ┌────────┐    ┌────────┐    ┌────────────┐
     │ GPT-4o │    │ Gemini │    │  Supabase  │
     │        │    │  Pro   │    │ PostgreSQL │
     └────────┘    └────────┘    └────────────┘
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
│   ├── auth/                       # Login/signup pages
│   ├── dashboard/
│   │   ├── generate/               # Main generation page
│   │   │   ├── components/         # DescriptionsTab, MLSDataTab, ResultsTabs
│   │   │   ├── hooks/              # useDescriptionsState, useMLSState, useVideoGeneration
│   │   │   └── page.jsx            # Main orchestrator
│   │   └── pricing/                # Credit purchase page
│   │       └── page.jsx            # Pricing cards + Stripe checkout
│   └── layout.jsx
├── components/
│   ├── DashboardHeader.jsx         # Header with "Buy Credits" button
│   └── listing-magic/
│       ├── NameListingModal.jsx    # Credit gatekeeper modal
│       └── AddressInput.jsx        # Address entry component
├── libs/
│   ├── generate-api.ts             # Backend API client
│   ├── credits.ts                  # Credit system client (getCreditBalance)
│   ├── supabase.js                 # Supabase client
│   └── utils.js                    # Utility functions (getDomainFromEmail, etc.)
├── python-backend/                 # FastAPI Backend
│   ├── endpoints/                  # API endpoints (mls_data, video_generation, refine_content)
│   ├── services/                   # AI provider integrations
│   │   ├── openai_service.py       # GPT integration (primary)
│   │   └── gemini_service.py       # Gemini integration
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

**Credit Refunds**: If generation fails after a credit is consumed, the system automatically refunds 1 credit via the `increment_credits` RPC. Users see a toast: "Generation failed. Credit refunded." This ensures users are never charged for unsuccessful generations.

### Database Schema
```sql
-- Table: credit_balances
-- owner_identifier: "john@example.com" (personal) OR "example.com" (domain)
-- credits: integer balance
```

### API Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/credits` | GET | Get user's credit balance |
| `/api/credits` | POST | Use a credit (decrement) |
| `/api/credits/add` | POST | Add credits (internal/admin) |
| `/api/stripe/checkout` | POST | Create Stripe checkout for credit purchase |
| `/api/stripe/webhook` | POST | Stripe webhook for credit fulfillment |

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
- `check_and_decrement_credits(user_email)` - Use a credit
- `get_credit_balance(user_email)` - Get balance
- `add_credits(owner, amount)` - Add credits (admin)

**Important - RPC Parameter Naming**: 
When calling RPC functions from the frontend, ensure parameter names match exactly. For example:
```javascript
// ✅ Correct - matches SQL function signature
await supabase.rpc('check_and_decrement_credits', { p_user_email: user.email })

// ❌ Wrong - parameter name mismatch will cause RPC error
await supabase.rpc('check_and_decrement_credits', { user_email: user.email })
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

---

## 🤖 AI Model Assignment

| Task | Primary | Fallback |
|------|---------|----------|
| Photo Analysis | GPT-4o Vision | Gemini |
| Public Remarks | GPT-4o | Gemini |
| Features List | Gemini Pro | GPT-4o |
| MLS Extraction | Gemini Pro | GPT-4o |
| Content Refinement | GPT-4o | Gemini |

**Note**: Walkthrough script generation was removed (Dec 15, 2025). Videos are now silent slideshows.

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

## 📋 Before Starting Any Task

1. **Check `.agent-workspace/context/current-sprint.md`** - What am I working on?
2. **Check `.agent-workspace/logs/bugs/`** - Has this bug been solved before?
3. **Check `.agent-workspace/knowledge/error-solutions.md`** - Known solutions index
4. **If working on frontend**: Read `app/dashboard/generate/` structure
5. **If working on backend**: Read `python-backend/` structure

---

## 🐛 Known Issues (Check Before Debugging)

### Active Issues
1. **Photo Categorization 503**: Non-blocking console error, doesn't affect generation
2. **ATTOM Tax Data Inconsistency**: Sometimes returns wrong year built/lot size

### Solved Issues (Don't Re-Fix)
- ✅ Generation timeout → Increased to 300s
- ✅ Slow GPT-4.1 → Changed to GPT-4o
- ✅ MLS data clearing on listing switch → Fixed handleLoadDescListing
- ✅ Nested button hydration error → Changed to div role="button"
- ✅ Address lost on tab switch → AddressInput now controlled component
- ✅ Photos not showing when loading listing → Uses setPhotosFromUrls()
- ✅ Walkthrough script complexity → Feature removed entirely
- ✅ Video not loading on previous listings → Added video_url to database, saved after generation, restored in handleLoadDescListing
- ✅ Credit double-charging → Moved credit check to upfront modal gatekeeper (Dec 21, 2025)
- ✅ RPC parameter mismatch → Fixed NameListingModal to use `p_user_email` (Dec 21, 2025)

---

## 📝 After Completing Any Task

1. **If you fixed a bug**: Add entry to `.agent-workspace/logs/bugs/YYYY-MM-DD-description.md`
2. **If you made architecture decisions**: Update `.agent-workspace/context/tech-decisions.md`
3. **If it was a significant session**: Add summary to `.agent-workspace/logs/sessions/`
4. **If you discovered a reusable pattern**: Add to `.agent-workspace/knowledge/`

---

## 🔗 Quick References

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
3. **Analyze Photos** → GPT-4o Vision (shows "Photo X of Y" progress)
4. **Generate Public Remarks** → GPT-4o (overlay closes when done)
5. **Background Tasks** (sequential):
   - Features List → Gemini
   - Video Generation → FFmpeg (silent slideshow)
   - MLS Extraction → Gemini

**Result Tabs**: Public Remarks | Features Sheet | Video Tour

**Credit Flow**:
- Credits charged **upfront** when user clicks "Start Project" in modal
- If generation fails, credit is already used (trade-off for simpler UX)
- User sees toast: "1 Credit Used from team pool/personal balance (X remaining)"
