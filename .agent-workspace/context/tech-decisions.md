# Technical Decisions Log

> Record of significant technical decisions and their rationale.
> This helps avoid re-discussing settled decisions.

---

## December 2025

### Walkthrough Script Feature Removed
**Date**: December 15, 2025
**Decision**: Completely remove the Walk-thru Script feature from both frontend and backend
**Rationale**:
- Walkthrough narration scripts added complexity without clear value
- ElevenLabs voiceover was already removed (too slow/expensive)
- Silent videos are sufficient for beta testing
- Reduces AI API calls and generation time
- Simplifies the UI (3 result tabs instead of 4)
**Changes Made**:
- Frontend: Removed script generation, UI tabs, state management, refinement
- Backend: Removed `/api/generate-walkthru-script` endpoint, models, prompts
- Video: Now generates directly from photos without script input
**Result**: Faster generation, simpler UX, reduced costs

### Phase-Based Progress Overlay
**Date**: December 15, 2025
**Decision**: Replace step-based progress with phase-based model showing real-time photo analysis
**Rationale**:
- Users complained about progress bar stuck at 30%
- Need to show actual progress, not fake interpolation
- Photo analysis is the slowest step - show X of Y
**Implementation**:
- Three phases: `uploadingPhotos`, `analyzingPhotos`, `generatingPublicRemarks`
- `analyzingPhotos` shows real progress bar with "Analyzing photo X of Y"
- Overlay closes immediately when public remarks return
**Result**: Users see accurate progress and feel in control

### Sequential Background Generation Order
**Date**: December 15, 2025
**Decision**: Changed from parallel to sequential: Features → Video → MLS
**Rationale**:
- Video needs features data available
- MLS should always run even if video fails
- Prevents duplicate photo uploads (MLS reuses existing URLs)
**Result**: More reliable generation, no duplicate API calls

### Address Persistence via Controlled Component
**Date**: December 15, 2025
**Decision**: Make AddressInput a controlled component synced with parent state
**Rationale**:
- Address was lost when switching tabs (component unmount/remount)
- useDescriptionsState hook already persists address
- Component needed to read from parent state on mount
**Result**: Address persists across tab switches

### GPT-4o Instead of GPT-4.1 for Content Generation
**Date**: December 3, 2025
**Decision**: Use GPT-4o, not GPT-4.1
**Rationale**:
- GPT-4.1 is a slow reasoning model (2-3 minutes per request)
- GPT-4o is fast multimodal (10-30 seconds)
- We don't need deep reasoning for description generation
**Result**: 70% performance improvement (300s → 90s)

### Increased Timeouts
**Date**: December 3, 2025
**Decision**: Increased all timeouts
**Changes**:
- Generation: 120s → 300s
- MLS extraction: 180s → 300s
- Video generation: 300s → 600s
**Rationale**: AI operations can be slow, especially with many photos

### Multi-Provider AI Fallback
**Date**: November 2025
**Decision**: Use Claude + GPT + Gemini with automatic fallback
**Rationale**:
- No single point of failure
- 99.9% uptime even when one provider is down
- Cost optimization (use cheapest provider when possible)
- Best model for each task type

### Separate Frontend/Backend Architecture
**Date**: October 2025
**Decision**: Next.js on Vercel + FastAPI on Railway (not monolith)
**Rationale**:
- AI libraries are Python-native
- Vercel has 60s timeout limit (too short for AI)
- Railway allows 300s+ timeouts
- Independent scaling
- Different runtime requirements

### Fair Housing Compliance in Prompts
**Date**: October 2025
**Decision**: Build Fair Housing rules into every AI prompt
**Rationale**:
- Legal requirement for real estate
- Better to prevent violations than detect them
- Market differentiator
- Reduces need for human review

### ElevenLabs Voiceover Removed
**Date**: November 2025
**Decision**: Remove video voiceover feature
**Rationale**:
- Added 30-60 seconds to generation time
- Too expensive for MVP
- Not critical for core value proposition
- Can add back later with better implementation
**Lesson**: Less is more, focus on core value

---

## How to Add New Decisions

When making a significant technical decision:

```markdown
### [Decision Title]
**Date**: [Date]
**Decision**: [What you decided]
**Rationale**:
- [Reason 1]
- [Reason 2]
**Result/Lesson**: [Outcome or lesson learned]
```
