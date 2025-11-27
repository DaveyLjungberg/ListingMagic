# Listing Magic - Project Structure

This project is built on [ShipFast](https://shipfa.st/), a Next.js 15 boilerplate with App Router.

## Directory Overview

### `/app` - Next.js App Router

The main application directory using Next.js App Router conventions.

| Path | Purpose |
|------|---------|
| `layout.js` | Root layout with providers, fonts, and global metadata |
| `page.js` | Homepage (landing page) |
| `globals.css` | Global Tailwind CSS styles |
| `error.js` | Global error boundary |
| `not-found.js` | Custom 404 page |
| `favicon.ico`, `icon.png`, `apple-icon.png` | App icons |
| `opengraph-image.png`, `twitter-image.png` | Social sharing images |

#### `/app/api` - API Routes
| Route | Purpose |
|-------|---------|
| `/api/auth/[...nextauth]` | NextAuth.js authentication endpoints |
| `/api/lead` | Lead capture endpoint (email collection) |
| `/api/stripe` | Stripe checkout session creation |
| `/api/webhook` | Stripe webhook handler |

#### `/app/blog` - Blog System
| Path | Purpose |
|------|---------|
| `page.js` | Blog listing page |
| `layout.js` | Blog-specific layout |
| `[articleId]/` | Dynamic article pages |
| `author/` | Author pages |
| `category/` | Category pages |
| `_assets/` | Blog-specific assets |

#### Other Pages
| Path | Purpose |
|------|---------|
| `/app/dashboard` | Protected user dashboard |
| `/app/tos` | Terms of Service page |
| `/app/privacy-policy` | Privacy Policy page |

---

### `/components` - React Components

Reusable UI components for the landing page and app.

| Component | Purpose |
|-----------|---------|
| **Layout** | |
| `Header.js` | Navigation header with auth buttons |
| `Footer.js` | Site footer with links |
| `LayoutClient.js` | Client-side layout wrapper |
| **Landing Page** | |
| `Hero.js` | Hero section with CTA |
| `Problem.js` | Problem/pain points section |
| `FeaturesAccordion.js` | Features with accordion UI |
| `FeaturesGrid.js` | Features in grid layout |
| `FeaturesListicle.js` | Features as numbered list |
| `Pricing.js` | Pricing plans display |
| `FAQ.js` | Frequently asked questions |
| `CTA.js` | Call-to-action section |
| `WithWithout.js` | Before/after comparison |
| `Tabs.js` | Tabbed content component |
| **Testimonials** | |
| `Testimonials1.js`, `Testimonials3.js`, `Testimonials11.js` | Different testimonial layouts |
| `TestimonialRating.js` | Star rating display |
| `TestimonialsAvatars.js` | Avatar row for social proof |
| `Testimonial1Small.js` | Compact testimonial card |
| **Buttons & Interactive** | |
| `ButtonSignin.js` | Sign in button with modal |
| `ButtonAccount.js` | User account dropdown |
| `ButtonCheckout.js` | Stripe checkout button |
| `ButtonSupport.js` | Customer support (Crisp) toggle |
| `ButtonLead.js` | Email capture button |
| `ButtonGradient.js` | Gradient styled button |
| `ButtonPopover.js` | Button with popover menu |
| **Utilities** | |
| `Modal.js` | Reusable modal component |
| `BetterIcon.js` | Icon wrapper component |

---

### `/libs` - Utility Libraries

Backend and utility functions.

| File | Purpose |
|------|---------|
| `api.js` | API client with auth handling |
| `auth.js` | NextAuth.js configuration (Google OAuth, email) |
| `gpt.js` | OpenAI/GPT integration helper |
| `mongo.js` | MongoDB connection utility |
| `mongoose.js` | Mongoose connection wrapper |
| `resend.js` | Resend email sending functions |
| `seo.js` | SEO metadata generators |
| `stripe.js` | Stripe helpers (checkout, webhooks) |

---

### `/models` - Database Models

Mongoose schemas for MongoDB.

| File | Purpose |
|------|---------|
| `User.js` | User model (auth, subscription status) |
| `Lead.js` | Email leads collection |
| `plugins/toJSON.js` | Mongoose plugin for JSON serialization |

---

### `/public` - Static Assets

Static files served at root URL.

| Path | Purpose |
|------|---------|
| `/blog/` | Blog post images and assets |

---

## Key Configuration Files

| File | Purpose |
|------|---------|
| `config.js` | **Main app configuration** - branding, pricing, colors, auth |
| `.env.local` | Environment variables (secrets, API keys) |
| `next.config.js` | Next.js configuration |
| `middleware.js` | Auth middleware for protected routes |
| `next-sitemap.config.js` | Sitemap generation config |
| `postcss.config.js` | PostCSS/Tailwind config |
| `jsconfig.json` | JS path aliases |

---

## Next.js 15 App Router Conventions

This project uses the Next.js App Router (not Pages Router):

- **`page.js`** - Defines a route's UI
- **`layout.js`** - Shared UI wrapper for child routes
- **`error.js`** - Error boundary for a route segment
- **`loading.js`** - Loading UI (not currently used)
- **`route.js`** - API endpoint (in `/api` folders)
- **`[param]`** - Dynamic route segments
- **`[...param]`** - Catch-all route segments

### Data Fetching

- Server Components fetch data directly (no `getServerSideProps`)
- Client Components use `"use client"` directive
- API routes in `/app/api/*/route.js`

### Protected Routes

The `middleware.js` file protects routes like `/dashboard` using NextAuth.js session checks.
