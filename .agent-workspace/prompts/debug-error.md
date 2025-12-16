# Debug Error Prompt

> Use this prompt when you encounter an error.
> Instead of bouncing to another LLM, give THIS context to your coding tool.

---

## Prompt Template

```
I'm getting an error in QuickList. Help me debug it.

## Error Message
```
[PASTE FULL ERROR HERE]
```

## Where It Happens
- Component/File: [FILE NAME]
- Action that triggers it: [WHAT YOU DID]
- Browser/Terminal: [WHERE YOU SEE THE ERROR]

## Recent Changes
[WHAT DID YOU CHANGE BEFORE THIS ERROR STARTED?]

## What I've Already Tried
- [ATTEMPT 1]
- [ATTEMPT 2]

## Relevant Context
- Frontend: Next.js 15 + React 19
- Backend: Python FastAPI
- Database: Supabase PostgreSQL

## Check .agent-workspace/logs/bugs/ first
Has this been solved before? Search for similar errors.
```

---

## Example: API Error

```
I'm getting an error in QuickList. Help me debug it.

## Error Message
```
POST https://listingmagic-production.up.railway.app/api/generate-public-remarks 503
Failed to load resource: the server responded with a status of 503 (Service Unavailable)
```

## Where It Happens
- Component/File: `libs/generate-api.ts` → `generatePublicRemarks()`
- Action that triggers it: Clicking "Generate All Content" button
- Browser/Terminal: Chrome DevTools Console

## Recent Changes
None - this started happening randomly

## What I've Already Tried
- Refreshed the page
- Checked Railway dashboard (service is running)
- Tried with fewer photos (same error)

## Relevant Context
- Using multi-provider AI (Claude, GPT, Gemini)
- Backend health check returns healthy
- Error is intermittent (sometimes works)
```

---

## Common Error Patterns

### 503 Service Unavailable
**Usually means**: AI provider rate limit or timeout
**Check**:
1. Railway logs for actual error
2. Which AI provider failed
3. Request payload size (too many photos?)
**Fix**: Fallback should handle it, check if fallback is working

### 401 Unauthorized
**Usually means**: Auth token expired or missing
**Check**:
1. Supabase session still valid
2. Authorization header being sent
3. CORS configuration
**Fix**: Re-login, check token refresh logic

### 500 Internal Server Error
**Usually means**: Backend code error
**Check**:
1. Railway logs for stack trace
2. Recent backend changes
3. Environment variables set
**Fix**: Read the actual error in logs, fix Python code

### Hydration Error
**Usually means**: Server/client HTML mismatch
**Check**:
1. Are you using `new Date()` or `Math.random()` in render?
2. Nested interactive elements (button inside button)?
3. Browser extensions modifying DOM?
**Fix**: Move dynamic content to useEffect, fix nesting

### CORS Error
**Usually means**: Backend not allowing frontend origin
**Check**:
1. `CORS_ORIGINS` env var on Railway
2. Both localhost:3000 and Vercel URL included?
**Fix**: Update CORS_ORIGINS to include your origin

---

## Before Asking for Help

1. **Check `.agent-workspace/logs/bugs/`** - Has this been solved?
2. **Read the FULL error message** - Often contains the answer
3. **Check Railway/Vercel logs** - Real error vs symptom
4. **Reproduce consistently?** - Random vs deterministic
5. **When did it start?** - What changed?

---

## Quick Debug Commands

```bash
# Check backend health
curl http://localhost:8000/health

# Check Railway logs (in Railway dashboard)
# Or use Railway CLI: railway logs

# Check Vercel logs (in Vercel dashboard)

# Check Supabase connection
# Go to Supabase dashboard → Logs

# Kill and restart local servers
lsof -ti:3000 | xargs kill -9
lsof -ti:8000 | xargs kill -9
npm run dev  # Terminal 1
uvicorn main:app --reload --port 8000  # Terminal 2
```
