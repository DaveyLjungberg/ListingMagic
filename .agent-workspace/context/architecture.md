# QuickList Architecture

## System Overview

QuickList is a three-tier architecture:

1. **Frontend (Vercel)**: Next.js 15 + React 19 + TypeScript
2. **Backend (Railway)**: Python FastAPI
3. **Database (Supabase)**: PostgreSQL + Auth + Storage

## Tech Stack Details

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 15.5.6 | React framework, App Router |
| React | 19.x | UI library |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 3.x | Styling |
| Supabase JS | 2.x | Auth & DB client |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Python | 3.11+ | Core language |
| FastAPI | 0.104+ | Web framework |
| Uvicorn | 0.24+ | ASGI server |
| OpenAI SDK | Latest | GPT-4o API (primary) |
| Google AI SDK | Latest | Gemini API |
| Pillow | 10.x | Image processing |
| FFmpeg | 6.x | Video generation |

### Database
- **Supabase PostgreSQL**: Primary database
- **Supabase Auth**: User authentication
- **Supabase Storage**: Photo & video storage (buckets: `property-photos`, `generated-videos`)

## Request Flow

```
1. User visits listing-magic.vercel.app
2. Vercel serves Next.js app from CDN
3. App authenticates with Supabase
4. User uploads photos → Supabase Storage
5. App calls Railway backend API
6. Backend processes with AI providers
7. Backend saves to Supabase database
8. Frontend displays results
```

## AI Provider Strategy

Two-provider system with fallback:
- **GPT-4o (OpenAI)**: Photo analysis, Public Remarks, Content Refinement
- **Gemini Pro (Google)**: Features extraction, MLS data

**Fallback**: If primary fails, try secondary provider.

## Generation Flow (Updated Dec 15, 2025)

```
1. Upload Photos → Supabase Storage
2. Analyze Photos → GPT-4o Vision (real-time "X of Y" progress)
3. Generate Public Remarks → GPT-4o (overlay closes when done)
4. Background Tasks (sequential):
   a. Features List → Gemini
   b. Video Generation → FFmpeg (silent slideshow, 2-10s per photo)
   c. MLS Extraction → Gemini (reuses existing photo URLs)
```

**Result Tabs**: Public Remarks | Features Sheet | Video Tour

## Key Architectural Decisions

### Why Next.js App Router?
- Server components for better performance
- Built-in routing
- Vercel deployment integration
- React 19 support

### Why FastAPI (not Next.js API Routes)?
- Better for AI workloads (async support)
- Automatic API documentation
- Type safety with Pydantic
- Longer timeout support (300s vs 60s)

### Why Supabase?
- PostgreSQL (reliable, scalable)
- Built-in auth (saved weeks of development)
- Storage buckets (no S3 setup needed)
- Generous free tier
- Row-Level Security for multi-tenant

### Why Separate Frontend/Backend?
- Independent scaling
- Different runtime requirements (Node.js vs Python)
- AI libraries are Python-native
- Longer timeouts needed for AI processing

### Why Silent Videos (No Walkthrough Script)?
- Walkthrough narration added complexity without clear value
- ElevenLabs voiceover was too slow/expensive
- Silent slideshows are sufficient for beta testing
- Reduces AI API calls and generation time
- Simpler UX (3 result tabs instead of 4)

## Security Architecture

- HTTPS everywhere (TLS 1.3)
- CORS restricted to known origins
- Supabase Row-Level Security (RLS)
- API keys in environment variables
- JWT authentication tokens
- Rate limiting on backend (future)

## Database Schema Summary

### `listings` Table
Main table storing generated content:
- `id`: UUID primary key
- `user_id`: Foreign key to auth.users
- `property_address`: Full address
- `public_remarks`: Generated formal description
- `mls_data`: JSONB with all extracted MLS fields
- `photo_urls`: Array of photo URLs
- `video_url`: Generated video URL
- `ai_cost`: Total AI API cost
- `generation_time`: Seconds to generate

### Storage Buckets
- `property-photos`: User-uploaded photos
- `generated-videos`: AI-generated videos

## Environment Variables

### Frontend (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=https://vbfwcemtkgymygccgffl.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000 (or Railway URL)
```

### Backend (Railway)
```
OPENAI_API_KEY=...
GOOGLE_API_KEY=...
SUPABASE_URL=...
SUPABASE_KEY=...
ATTOM_API_KEY=...
CORS_ORIGINS=["https://listing-magic.vercel.app","http://localhost:3000"]
OPENAI_MODEL=gpt-4o
GEMINI_MODEL=gemini-2.0-flash-exp
```
