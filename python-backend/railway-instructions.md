# Deploying Listing Magic Backend to Railway

This guide covers deploying the Python FastAPI backend to Railway.

## Prerequisites

- Railway account ([railway.app](https://railway.app))
- GitHub repository connected to Railway
- API keys for OpenAI, Anthropic, and Google AI

## Quick Deploy

### Option 1: Deploy from GitHub (Recommended)

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose `DaveyLjungberg/ListingMagic` repository
5. Railway will auto-detect the Python project in `/python-backend`
6. Set the **Root Directory** to `python-backend`
7. Click **"Deploy"**

### Option 2: Deploy via Railway CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Navigate to backend directory
cd python-backend

# Initialize and deploy
railway init
railway up
```

## Environment Variables

Set these environment variables in Railway Dashboard → Your Project → Variables:

### Required API Keys

| Variable | Description | Example |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key for GPT-4.1 | `sk-...` |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude | `sk-ant-...` |
| `GEMINI_API_KEY` | Google AI API key for Gemini | `AIza...` |

### Model Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_MODEL` | OpenAI model to use | `gpt-4.1` |
| `ANTHROPIC_MODEL` | Anthropic model to use | `claude-sonnet-4-20250514` |
| `GEMINI_MODEL` | Google model to use | `gemini-3-pro-preview` |

### Application Settings

| Variable | Description | Default |
|----------|-------------|---------|
| `ENVIRONMENT` | Environment name | `production` |
| `DEBUG` | Enable debug mode | `false` |
| `ALLOWED_ORIGINS` | CORS allowed origins | See below |

### CORS Configuration

Set `ALLOWED_ORIGINS` to your frontend domains (comma-separated):

```
https://listing-magic.vercel.app,https://listingmagic.com,https://www.listingmagic.com
```

For development/staging with Vercel preview URLs, the backend automatically allows all `*.vercel.app` domains via regex matching.

### Cost Tracking (Optional)

| Variable | Description | Default |
|----------|-------------|---------|
| `ENABLE_COST_TRACKING` | Track API costs | `true` |
| `COST_ALERT_THRESHOLD` | Alert threshold in USD | `10.0` |

## Copy-Paste Environment Variables

Here's a template you can copy into Railway:

```env
# Required API Keys
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
GEMINI_API_KEY=AIza-your-gemini-key

# Model Configuration
OPENAI_MODEL=gpt-4.1
ANTHROPIC_MODEL=claude-sonnet-4-20250514
GEMINI_MODEL=gemini-3-pro-preview

# Application Settings
ENVIRONMENT=production
DEBUG=false
ALLOWED_ORIGINS=https://listing-magic.vercel.app,https://listingmagic.com

# Cost Tracking
ENABLE_COST_TRACKING=true
COST_ALERT_THRESHOLD=10.0
```

## Verify Deployment

After deploying, verify the API is running:

1. Railway will provide a URL like `https://listing-magic-backend-production.up.railway.app`
2. Visit `https://YOUR-RAILWAY-URL/health` to check health status
3. Visit `https://YOUR-RAILWAY-URL/docs` for interactive API documentation

### Health Check Response

```json
{
  "status": "healthy",
  "services": {
    "openai": true,
    "anthropic": true,
    "gemini": true,
    "video": true
  },
  "models": {
    "public_remarks": "gpt-4.1",
    "walkthru_script": "claude-sonnet-4-20250514",
    "features": "gemini-3-pro-preview",
    "reso_data": "gemini-3-pro-preview"
  }
}
```

## Update Frontend

After deploying the backend, update your Next.js frontend environment:

### Vercel Environment Variables

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add: `PYTHON_BACKEND_URL=https://YOUR-RAILWAY-URL`

Example:
```
PYTHON_BACKEND_URL=https://listing-magic-backend-production.up.railway.app
```

## Monitoring

### View Logs

```bash
# Via Railway CLI
railway logs

# Or via Railway Dashboard → Deployments → View Logs
```

### Cost Tracking

View API usage costs at:
- `GET /api/costs/summary` - Today's cost summary
- Logs show per-request cost tracking

## Troubleshooting

### Common Issues

1. **"Connection refused" errors**
   - Check Railway deployment status
   - Verify environment variables are set
   - Check logs for startup errors

2. **CORS errors in browser**
   - Verify `ALLOWED_ORIGINS` includes your frontend URL
   - Vercel preview URLs are automatically allowed

3. **"API key invalid" errors**
   - Double-check API keys are correctly copied
   - Ensure no extra whitespace in environment variables

4. **Rate limit errors**
   - The frontend calls APIs sequentially to avoid this
   - Consider upgrading API tier if persistent

### Get Help

- Railway Docs: https://docs.railway.app
- FastAPI Docs: https://fastapi.tiangolo.com
- Open an issue: https://github.com/DaveyLjungberg/ListingMagic/issues

## Alternative Platforms

The backend is also compatible with:

- **Render**: Use `Procfile` for configuration
- **Heroku**: Use `Procfile` for configuration
- **Fly.io**: Create `fly.toml` based on `railway.json`
- **Docker**: Use provided `Dockerfile`

Example for Render/Heroku using Procfile:
```
web: uvicorn main:app --host 0.0.0.0 --port $PORT
```
