# Frontend Task Prompt

> Use this prompt when asking Claude/Cursor to work on frontend code.
> Copy, fill in the blanks, and paste into your coding tool.

---

## Prompt Template

```
I need to [DESCRIBE WHAT YOU WANT TO DO] in the QuickList frontend.

## Context
- QuickList is a real estate listing generation SaaS
- Frontend: Next.js 15 + React 19 + TypeScript + Tailwind CSS
- Main generation page: `app/dashboard/generate/`
- Key components: DescriptionsTab.jsx, MLSDataTab.jsx
- Backend API client: `libs/generate-api.ts`
- Auth: Supabase

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
- Must maintain Fair Housing compliance (no "you", "welcome to", etc.)
- Must have proper loading states
- Must handle errors gracefully with toast notifications
- Must be responsive (mobile-friendly)

## If this involves state:
- Check existing hooks in `app/dashboard/generate/hooks/`
- Follow existing patterns (useState, useEffect)
```

---

## Example: Add a New Button

```
I need to add a "Copy All" button that copies all three descriptions to clipboard.

## Context
- QuickList is a real estate listing generation SaaS
- Frontend: Next.js 15 + React 19 + TypeScript + Tailwind CSS
- Main generation page: `app/dashboard/generate/`
- Key components: DescriptionsTab.jsx

## The Task
Add a button that copies the Formal, Casual, and Social Media descriptions to clipboard as one combined text block with headers.

## Current Behavior
Users can only copy one description at a time.

## Expected Behavior
One click copies all three with format:
---
FORMAL DESCRIPTION:
[formal text]

CASUAL DESCRIPTION:
[casual text]

SOCIAL MEDIA POST:
[social text]
---

## Relevant Files
- `app/dashboard/generate/components/DescriptionsTab.jsx`

## Constraints
- Show toast notification on success
- Button should be disabled if no descriptions exist
- Use existing button styling patterns
```

---

## Quick Reference: Component Locations

| Component | Location |
|-----------|----------|
| Main generation UI | `app/dashboard/generate/components/DescriptionsTab.jsx` |
| MLS data display | `app/dashboard/generate/components/MLSDataTab.jsx` |
| Page header | `app/dashboard/generate/components/Header.jsx` |
| Tab navigation | `app/dashboard/generate/components/TabNavigation.jsx` |
| State hooks | `app/dashboard/generate/hooks/` |
| API client | `libs/generate-api.ts` |
| Supabase client | `libs/supabase.ts` |
