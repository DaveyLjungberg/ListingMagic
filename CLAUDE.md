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
│   ├── dashboard/generate/         # Main generation page
│   │   ├── components/             # DescriptionsTab, MLSDataTab, ResultsTabs
│   │   ├── hooks/                  # useDescriptionsState, useMLSState, useVideoGeneration
│   │   └── page.jsx                # Main orchestrator
│   └── layout.jsx
├── libs/
│   ├── generate-api.ts             # Backend API client
│   └── supabase.ts                 # Supabase client
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

1. **Upload Photos** → Supabase Storage
2. **Analyze Photos** → GPT-4o Vision (shows "Photo X of Y" progress)
3. **Generate Public Remarks** → GPT-4o (overlay closes when done)
4. **Background Tasks** (sequential):
   - Features List → Gemini
   - Video Generation → FFmpeg (silent slideshow)
   - MLS Extraction → Gemini

**Result Tabs**: Public Remarks | Features Sheet | Video Tour
