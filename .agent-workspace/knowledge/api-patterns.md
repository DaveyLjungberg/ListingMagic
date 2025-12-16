# API Patterns Reference

> Reusable code patterns for QuickList development.

---

## Frontend Patterns

### API Call with Loading State
```javascript
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState(null);

const handleAction = async () => {
  setIsLoading(true);
  setError(null);
  
  try {
    const result = await apiCall();
    // Handle success
    toast.success("Action completed!");
  } catch (err) {
    setError(err.message);
    toast.error(err.message || "Something went wrong");
  } finally {
    setIsLoading(false);
  }
};
```

### Generation API Call (with timeout)
```javascript
// From libs/generate-api.ts
const response = await fetch(`${BACKEND_URL}/api/endpoint`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${session.access_token}`
  },
  body: JSON.stringify(data),
  signal: AbortSignal.timeout(300000) // 5 minute timeout
});

if (!response.ok) {
  const error = await response.json();
  throw new Error(error.message || "Request failed");
}

return await response.json();
```

### Supabase Database Call
```javascript
import { supabase } from "@/libs/supabase";

// Insert
const { data, error } = await supabase
  .from("listings")
  .insert({ ...listingData, user_id: session.user.id })
  .select()
  .single();

// Update
const { data, error } = await supabase
  .from("listings")
  .update({ public_remarks: newRemarks })
  .eq("id", listingId)
  .select()
  .single();

// Select with user filter (RLS handles this too)
const { data, error } = await supabase
  .from("listings")
  .select("*")
  .eq("user_id", session.user.id)
  .order("created_at", { ascending: false });
```

### Supabase Storage Upload
```javascript
const { data, error } = await supabase.storage
  .from("property-photos")
  .upload(`${userId}/${listingId}/${filename}`, file, {
    contentType: file.type,
    upsert: false
  });

// Get public URL
const { data: { publicUrl } } = supabase.storage
  .from("property-photos")
  .getPublicUrl(data.path);
```

---

## Backend Patterns

### FastAPI Endpoint
```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

class RequestModel(BaseModel):
    photos: list[str]
    address: str

class ResponseModel(BaseModel):
    result: str
    generation_time: float
    ai_cost: float

@router.post("/api/endpoint", response_model=ResponseModel)
async def endpoint_name(request: RequestModel):
    try:
        # Validation
        if not request.photos:
            raise HTTPException(status_code=400, detail="Photos required")
        
        # Business logic
        start_time = time.time()
        result = await some_service.process(request)
        elapsed = time.time() - start_time
        
        return ResponseModel(
            result=result,
            generation_time=elapsed,
            ai_cost=0.05
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Endpoint error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
```

### AI Service Call with Retry
```python
async def call_ai_with_retry(
    prompt: str,
    max_retries: int = 3,
    providers: list = ["anthropic", "openai", "gemini"]
):
    for provider in providers:
        for attempt in range(max_retries):
            try:
                if provider == "anthropic":
                    return await anthropic_service.generate(prompt)
                elif provider == "openai":
                    return await openai_service.generate(prompt)
                else:
                    return await gemini_service.generate(prompt)
                    
            except RateLimitError:
                await asyncio.sleep(2 ** attempt)
                continue
            except Exception as e:
                logger.warning(f"{provider} attempt {attempt} failed: {e}")
                break
    
    raise Exception("All AI providers failed")
```

### Claude API Call
```python
from anthropic import Anthropic

client = Anthropic(api_key=ANTHROPIC_API_KEY)

response = await client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    messages=[
        {
            "role": "user",
            "content": prompt
        }
    ],
    system=FAIR_HOUSING_SYSTEM_PROMPT
)

result = response.content[0].text
```

### GPT-4o Vision Call
```python
from openai import OpenAI

client = OpenAI(api_key=OPENAI_API_KEY)

response = await client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {
                    "type": "image_url",
                    "image_url": {"url": image_url}
                }
            ]
        }
    ],
    max_tokens=1024
)

result = response.choices[0].message.content
```

---

## Error Handling Patterns

### Frontend Error Boundary
```javascript
// Wrap components that might fail
<ErrorBoundary fallback={<ErrorFallback />}>
  <RiskyComponent />
</ErrorBoundary>
```

### Backend Error Response Format
```python
# Always return consistent error format
{
    "error": {
        "type": "validation_error",  # or ai_service_error, internal_error
        "message": "Human readable message",
        "details": {
            "field": "photos",
            "reason": "At least one photo required"
        }
    }
}
```

### Toast Notifications
```javascript
import { toast } from "react-hot-toast";

// Success
toast.success("Content generated successfully!");

// Error
toast.error(error.message || "Something went wrong");

// Loading (dismissible)
const toastId = toast.loading("Generating content...");
// Later:
toast.dismiss(toastId);
```

---

## State Management Patterns

### Custom Hook Pattern
```javascript
// hooks/useGeneration.js
export function useGeneration() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  
  const generate = async (photos, address) => {
    setIsGenerating(true);
    setProgress(0);
    setError(null);
    
    try {
      // Step 1
      setProgress(25);
      const analysis = await analyzePhotos(photos);
      
      // Step 2
      setProgress(50);
      const mls = await extractMLS(photos, analysis);
      
      // etc...
      
      return { analysis, mls };
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setIsGenerating(false);
    }
  };
  
  return { generate, isGenerating, progress, error };
}
```

---

## Performance Patterns

### Image Compression Before AI
```python
from PIL import Image
from io import BytesIO

def compress_image(image_url: str, max_width: int = 1920) -> str:
    img = Image.open(requests.get(image_url, stream=True).raw)
    
    if img.width > max_width:
        ratio = max_width / img.width
        new_height = int(img.height * ratio)
        img = img.resize((max_width, new_height), Image.LANCZOS)
    
    buffer = BytesIO()
    img.convert("RGB").save(buffer, format="JPEG", quality=85)
    
    return base64.b64encode(buffer.getvalue()).decode()
```

### Limit Photos to AI
```python
MAX_PHOTOS_PER_REQUEST = 20

photos_to_process = photos[:MAX_PHOTOS_PER_REQUEST]
```
