# Backend Task Prompt

> Use this prompt when asking Claude Code to work on the Python backend.
> Copy, fill in the blanks, and paste into terminal.

---

## Prompt Template

```
I need to [DESCRIBE WHAT YOU WANT TO DO] in the QuickList backend.

## Context
- QuickList backend: Python FastAPI on Railway
- Location: `python-backend/`
- Entry point: `main.py`
- AI services: `services/anthropic_service.py`, `services/openai_service.py`, `services/gemini_service.py`
- Endpoints: `endpoints/`
- Config: `config.py`

## The Task
[DESCRIBE IN DETAIL WHAT YOU WANT]

## Current Behavior
[WHAT HAPPENS NOW]

## Expected Behavior
[WHAT SHOULD HAPPEN]

## Relevant Files
- [FILE 1]
- [FILE 2]

## Constraints
- All AI-generated content must follow Fair Housing rules
- Use async/await for AI calls
- Include proper error handling with try/except
- Log errors to console
- Return consistent JSON error format

## Environment
- Python 3.11+
- FastAPI 0.104+
- Models: gpt-4o, claude-sonnet-4-20250514, gemini-2.0-flash-exp
```

---

## Example: Add New Endpoint

```
I need to add an endpoint that regenerates just the social media post without regenerating everything else.

## Context
- QuickList backend: Python FastAPI on Railway
- Location: `python-backend/`
- Entry point: `main.py`
- AI services: `services/anthropic_service.py`

## The Task
Create `/api/regenerate-social` endpoint that:
1. Takes existing formal description as input
2. Generates new social media post from it
3. Returns just the social post (not full generation)

## Current Behavior
Users must regenerate all content to get new social post.

## Expected Behavior
POST /api/regenerate-social
Body: { "formalDescription": "...", "address": "..." }
Response: { "socialPost": "...", "generationTime": 5.2, "aiCost": 0.02 }

## Relevant Files
- `python-backend/endpoints/description_generation.py`
- `python-backend/services/anthropic_service.py`
- `python-backend/utils/prompt_templates.py`

## Constraints
- Use Claude Sonnet as primary (best for social copy)
- Include Fair Housing rules in prompt
- Max 280 characters for Twitter compatibility
- Return generation time and cost
```

---

## Quick Reference: Backend Structure

| Component | Location |
|-----------|----------|
| FastAPI entry | `python-backend/main.py` |
| API endpoints | `python-backend/endpoints/` |
| Claude integration | `python-backend/services/anthropic_service.py` |
| GPT integration | `python-backend/services/openai_service.py` |
| Gemini integration | `python-backend/services/gemini_service.py` |
| AI prompts | `python-backend/utils/prompt_templates.py` |
| Fair Housing | `python-backend/compliance/fair_housing.py` |
| Config | `python-backend/config.py` |

## Common Patterns

### New Endpoint
```python
@app.post("/api/new-endpoint")
async def new_endpoint(request: RequestModel):
    try:
        # Validation
        if not request.required_field:
            return JSONResponse(
                {"error": "Required field missing"},
                status_code=400
            )
        
        # Business logic
        result = await some_service.do_thing(request)
        
        return {"success": True, "data": result}
        
    except Exception as e:
        logger.error(f"Error: {e}")
        return JSONResponse(
            {"error": "Internal server error"},
            status_code=500
        )
```

### AI Call with Fallback
```python
async def generate_with_fallback(prompt):
    providers = ["anthropic", "openai", "gemini"]
    
    for provider in providers:
        try:
            return await call_provider(provider, prompt)
        except Exception as e:
            logger.warning(f"{provider} failed: {e}")
            continue
    
    raise Exception("All providers failed")
```
