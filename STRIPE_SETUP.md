# Stripe Credit Purchase Setup Guide

## Quick Start: Where to Add Your 3 Stripe Price IDs

You have 3 Stripe Price IDs from your Stripe Dashboard. Here's where to add them:

### 1. Production (Vercel) - REQUIRED

Go to your Vercel project settings:
1. Navigate to: **Vercel Dashboard → listing-magic → Settings → Environment Variables**
2. Add these 3 variables (for **Production** environment):

```
NEXT_PUBLIC_STRIPE_PRICE_STARTER = price_xxxxxxxxxxxxx  (your 1 credit pack ID)
NEXT_PUBLIC_STRIPE_PRICE_PRO = price_xxxxxxxxxxxxx      (your 10 credits pack ID)
NEXT_PUBLIC_STRIPE_PRICE_AGENCY = price_xxxxxxxxxxxxx   (your 50 credits pack ID)
```

3. **Important**: After adding, redeploy your frontend for changes to take effect

### 2. Local Development (Optional)

If you want to test locally, create a `.env.local` file in the project root:

```bash
# .env.local (this file is gitignored)

# Stripe Credit Pack Price IDs
NEXT_PUBLIC_STRIPE_PRICE_STARTER=price_xxxxxxxxxxxxx  # 1 credit ($20)
NEXT_PUBLIC_STRIPE_PRICE_PRO=price_xxxxxxxxxxxxx      # 10 credits ($150)
NEXT_PUBLIC_STRIPE_PRICE_AGENCY=price_xxxxxxxxxxxxx   # 50 credits ($400)

# Other required env vars (copy from Vercel if needed)
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxx
STRIPE_CREDITS_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
NEXT_PUBLIC_SUPABASE_URL=https://vbfwcemtkgymygccgffl.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxxxxxxxxxxxx
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## How It Works

### Pricing Tiers
- **Starter**: 1 credit for $20
- **Pro**: 10 credits for $150 ($15/credit - Most Popular)
- **Agency**: 50 credits for $400 ($8/credit - Best Value)

### Per-Pack Pricing Model
The code has been configured for **per-pack pricing**:
- Your Stripe Prices should be set to the **total pack cost** (e.g., $20, $150, $400)
- **NOT** per-credit pricing (e.g., $20 × 10 = $200)
- The frontend sends `quantity: 1` to Stripe (buy one pack)
- The webhook uses `creditsAmount` metadata to grant the correct number of credits (1, 10, or 50)

### Purchase Flow
1. User visits `/dashboard/pricing`
2. Selects Personal or Team (domain) credits
3. Clicks a tier (Starter/Pro/Agency)
4. Frontend creates Stripe Checkout with:
   - `priceId`: Your Stripe Price ID
   - `quantity`: 1 (always 1 for per-pack)
   - `creditsAmount`: 1, 10, or 50 (for fulfillment)
   - `creditType`: "personal" or "domain"
5. User pays on Stripe-hosted checkout page
6. Stripe webhook receives `checkout.session.completed`
7. Webhook grants credits to user's email or team domain pool

## Verifying Your Stripe Setup

Make sure your Stripe Prices are configured correctly:

### ✅ Correct Setup (Per-Pack)
```
Product: QuickList Credits - Starter Pack
Price: $20.00 (one-time payment)
Description: 1 generation credit

Product: QuickList Credits - Pro Pack
Price: $150.00 (one-time payment)
Description: 10 generation credits

Product: QuickList Credits - Agency Pack
Price: $400.00 (one-time payment)
Description: 50 generation credits
```

### ❌ Incorrect Setup (Per-Credit)
```
Product: QuickList Credit
Price: $20.00 per unit
(This would charge $20 × 10 = $200 for the Pro pack)
```

## Required Environment Variables Checklist

### Frontend (Vercel Environment Variables)
- [ ] `NEXT_PUBLIC_STRIPE_PRICE_STARTER`
- [ ] `NEXT_PUBLIC_STRIPE_PRICE_PRO`
- [ ] `NEXT_PUBLIC_STRIPE_PRICE_AGENCY`
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SITE_URL`

### Backend/Server (Vercel Environment Variables)
- [ ] `STRIPE_SECRET_KEY`
- [ ] `STRIPE_CREDITS_WEBHOOK_SECRET` (or `STRIPE_WEBHOOK_SECRET`)
- [ ] `SUPABASE_SERVICE_ROLE_KEY`

## Webhook Configuration

Make sure your Stripe webhook is configured:
1. Go to: **Stripe Dashboard → Developers → Webhooks**
2. Add endpoint: `https://listing-magic.vercel.app/api/stripe/webhook`
3. Listen to event: `checkout.session.completed`
4. Copy the **Signing secret** and set it as `STRIPE_CREDITS_WEBHOOK_SECRET` in Vercel

## Testing the Integration

1. Add the 3 Price IDs to Vercel
2. Redeploy your app
3. Visit: `https://listing-magic.vercel.app/dashboard/pricing`
4. You should see:
   - Starter: 1 Credit - $20
   - Pro: 10 Credits - $150 (with "Most Popular" badge)
   - Agency: 50 Credits - $400
5. Use Stripe test mode to verify checkout flow works

## Need Help?

If purchases aren't working:
1. Check Vercel logs for errors
2. Check Stripe webhook logs in Stripe Dashboard
3. Verify all environment variables are set
4. Ensure webhook endpoint is receiving events
5. Check Supabase credit_balances table for credit updates

---

**Updated**: December 21, 2025
**Files Modified**:
- `app/dashboard/pricing/page.jsx` - Frontend pricing UI
- `app/api/stripe/checkout/route.js` - Checkout API
- `CLAUDE.md` - Documentation
- `.cursorrules` - Agent rules

