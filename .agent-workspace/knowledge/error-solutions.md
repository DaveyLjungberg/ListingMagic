# Error Solutions Index

> Quick reference for solved problems. Search here FIRST before debugging.
> For full details, see `.agent-workspace/logs/bugs/`

---

## Generation Issues

### Generation Too Slow (5+ minutes)
**Solution**: Check which model is being used. GPT-4.1 is slow (reasoning model). Use GPT-4o for content generation.
**File**: `python-backend/config.py` → `OPENAI_MODEL`
**See**: `logs/bugs/2025-12-03-slow-gpt41-generation.md`

### Generation Timeout
**Solution**: Increase timeout values. AI operations can take 60-90s for large photo sets.
**File**: Multiple timeout settings
**Values**: Generation: 300s, MLS: 300s, Video: 600s

### All AI Providers Failed
**Solution**: Check API keys, rate limits, and provider status pages.
**Debug**: `curl http://localhost:8000/health` should show provider status

---

## Frontend Issues

### MLS Data Not Loading on Listing Switch
**Solution**: `handleLoadDescListing` was clearing state. Update to populate from `selectedListing.mls_data`.
**File**: `app/dashboard/generate/components/DescriptionsTab.jsx`
**See**: `logs/bugs/2025-12-03-mls-data-cleared-on-switch.md`

### Nested Button Hydration Error
**Solution**: Can't nest `<button>` inside `<button>`. Use `<div role="button">` for inner element.
**Pattern**: `<button><div role="button" onClick={...}>...</div></button>`

### Port Already in Use
**Solution**: Kill the stuck process:
```bash
lsof -ti:3000 | xargs kill -9  # Frontend
lsof -ti:8000 | xargs kill -9  # Backend
```

---

## Backend Issues

### 503 Service Unavailable
**Causes**: AI provider timeout, rate limit, or file download failure
**Debug**: Check Railway logs for actual error
**Workaround**: Multi-provider fallback should handle it

### CORS Error
**Solution**: Add origin to `CORS_ORIGINS` env var on Railway
**Format**: `["https://listing-magic.vercel.app","http://localhost:3000"]`

### Supabase Connection Error
**Debug**: Check environment variables are set correctly
```bash
cat python-backend/.env | grep SUPABASE
```

---

## Supabase Issues

### RLS Policy Blocking Access
**Symptoms**: Empty results, 401 errors
**Solution**: Check Row-Level Security policies in Supabase dashboard
**Note**: User must be authenticated, `auth.uid()` must match `user_id`

### Storage Upload Failed
**Causes**: File too large (>10MB), wrong MIME type, bucket permissions
**Debug**: Check Supabase Storage logs

---

## AI Issues

### Fair Housing Violation in Output
**Solution**: Check prompt templates include Fair Housing rules
**File**: `python-backend/utils/prompt_templates.py`
**Reference**: `.agent-workspace/knowledge/fair-housing-rules.md`

### Inconsistent Photo Analysis
**Solution**: Limit to 20 photos max, compress images before sending
**File**: `python-backend/services/openai_service.py`

### ATTOM Tax Data Wrong
**Causes**: API intermittent, wrong property matched
**Workaround**: User can manually edit fields
**Solution**: Add confidence scoring (future)

---

## Quick Fixes

| Problem | Quick Fix |
|---------|-----------|
| Frontend not updating | Clear `.next/` folder, restart `npm run dev` |
| Backend changes not applying | Check `--reload` flag on uvicorn |
| Env vars not loading | Restart server after changing `.env` |
| Types not recognized | Run `npm run build` to regenerate |
| Python imports failing | Activate venv: `source venv/bin/activate` |

---

## How to Add to This Index

When you solve a problem:

1. Add quick entry here with one-line solution
2. Create full bug report in `logs/bugs/YYYY-MM-DD-description.md`
3. Reference the full report from here
