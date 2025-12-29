# 🚀 Pre-Production Deployment Checklist
**Date**: December 29, 2025  
**Branch**: main → production  
**Target**: Vercel deployment for business partner testing

---

## ⚠️ CRITICAL ISSUES FOUND

### 🔴 HIGH PRIORITY - Must Fix Before Deploy

1. **Missing Production Site URL**
   - **Issue**: `NEXT_PUBLIC_SITE_URL` not set
   - **Impact**: Stripe checkout redirects will use localhost
   - **Location**: Multiple API routes fallback to `http://localhost:3000`
   - **Fix Required**: Set in Vercel environment variables

2. **Stripe Test Keys Active**
   - **Issue**: Currently using test Stripe keys
   - **Impact**: Real payments won't work, webhooks will fail
   - **Current Keys**: 
     - `pk_test_51SgxvlAXe63YikFp...`
     - `sk_test_51SgxvlAXe63YikFp...`
   - **Fix Required**: Switch to live keys in production

3. **Google OAuth Credentials Missing**
   - **Issue**: `GOOGLE_ID` and `GOOGLE_SECRET` are empty
   - **Impact**: Google sign-in won't work
   - **Fix Required**: Add production OAuth credentials

### 🟡 MEDIUM PRIORITY - Recommended Before Deploy

4. **NextAuth Secret Should Be Regenerated**
   - **Issue**: Using development secret in production
   - **Impact**: Security risk if exposed
   - **Fix**: Generate new secret for production

5. **Hardcoded localhost in Stripe Checkout**
   - **Location**: `app/api/stripe/checkout/route.js:94`
   - **Code**: `"http://localhost:3000"` in allowed origins
   - **Impact**: Security hole in production
   - **Fix Required**: Remove or make conditional

---

## 📋 Step-by-Step Deployment Plan

### Phase 1: Prepare Stripe (BEFORE Deploying)

#### Create Live Stripe Products
1. Go to Stripe Dashboard: https://dashboard.stripe.com
2. **Switch from Test Mode to Live Mode** (toggle in top-right)
3. Navigate to: **Products** → **Add Product**
4. Create 3 products matching your pricing:

**Product 1: Starter**
- Name: `1 Listing Credit`
- Price: `$20.00 USD`
- Type: `One-time`
- After creation, copy the Price ID (starts with `price_`)

**Product 2: Pro**
- Name: `10 Listing Credits`
- Price: `$150.00 USD`
- Type: `One-time`
- After creation, copy the Price ID

**Product 3: Agency**
- Name: `50 Listing Credits`
- Price: `$400.00 USD`
- Type: `One-time`
- After creation, copy the Price ID

#### Get Live Stripe Keys
5. Navigate to: **Developers** → **API Keys** (make sure you're in Live Mode!)
6. Copy **Publishable key** (starts with `pk_live_`)
7. **Reveal** and copy **Secret key** (starts with `sk_live_`)

#### Set Up Production Webhook
8. Navigate to: **Developers** → **Webhooks**
9. Click **Add endpoint**
10. Endpoint URL: `https://listing-magic.vercel.app/api/stripe/webhook`
    - Note: Use your actual Vercel URL if different
11. Description: `Credit purchase webhook - production`
12. Events to send: Select `checkout.session.completed`
13. Click **Add endpoint**
14. Copy the **Signing secret** (starts with `whsec_`)

---

### Phase 2: Configure Google OAuth (BEFORE Deploying)

1. Go to: https://console.cloud.google.com/
2. Select your project (or create one)
3. Navigate to: **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth 2.0 Client ID**
5. Application type: **Web application**
6. Name: `QuickList Production`
7. **Authorized JavaScript origins**:
   - `https://listing-magic.vercel.app`
   - `https://listingmagic.com` (if using custom domain)
8. **Authorized redirect URIs**:
   - `https://listing-magic.vercel.app/api/auth/callback`
   - `https://listing-magic.vercel.app/auth/callback`
   - Add custom domain versions if applicable
9. Click **Create**
10. Copy **Client ID** and **Client Secret**

---

### Phase 3: Generate New Secrets

#### NextAuth Secret (Production)
```bash
openssl rand -base64 32
```
Copy the output - this is your production `NEXTAUTH_SECRET`

---

### Phase 4: Configure Vercel Environment Variables

1. Go to: https://vercel.com/dashboard
2. Select your QuickList project
3. Go to: **Settings** → **Environment Variables**
4. Add/Update these variables for **Production** environment:

#### 🔐 Authentication & Session
```
NEXTAUTH_URL=https://listing-magic.vercel.app
NEXTAUTH_SECRET=[NEW_SECRET_FROM_PHASE_3]
AUTH_TRUST_HOST=https://listing-magic.vercel.app
```

#### 🔐 Google OAuth
```
GOOGLE_ID=[FROM_PHASE_2_STEP_10]
GOOGLE_SECRET=[FROM_PHASE_2_STEP_10]
```

#### 💳 Stripe (LIVE KEYS)
```
STRIPE_PUBLIC_KEY=[FROM_PHASE_1_STEP_6_pk_live]
STRIPE_SECRET_KEY=[FROM_PHASE_1_STEP_7_sk_live]
STRIPE_WEBHOOK_SECRET=[FROM_PHASE_1_STEP_14_whsec]
```

#### 💳 Stripe Product Price IDs (LIVE)
```
NEXT_PUBLIC_STRIPE_PRICE_STARTER=[FROM_PHASE_1_PRODUCT_1]
NEXT_PUBLIC_STRIPE_PRICE_PRO=[FROM_PHASE_1_PRODUCT_2]
NEXT_PUBLIC_STRIPE_PRICE_AGENCY=[FROM_PHASE_1_PRODUCT_3]
```

#### 🌐 URLs & Backend
```
NEXT_PUBLIC_SITE_URL=https://listing-magic.vercel.app
NEXT_PUBLIC_API_URL=https://listingmagic-production.up.railway.app
PYTHON_BACKEND_URL=https://listingmagic-production.up.railway.app
NEXT_PUBLIC_BACKEND_URL=https://listingmagic-production.up.railway.app
```

#### 🗄️ Supabase (Already Set)
```
NEXT_PUBLIC_SUPABASE_URL=https://vbfwcemtkgymygccgffl.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[ALREADY_SET]
SUPABASE_SERVICE_ROLE_KEY=[ALREADY_SET]
```

#### 🔑 ATTOM API (Already Set)
```
ATTOM_API_KEY=[ALREADY_SET]
```

5. Click **Save** after adding each variable

---

### Phase 5: Fix Code Issues

#### Fix 1: Remove Hardcoded localhost from Stripe Checkout

**File**: `app/api/stripe/checkout/route.js`

**Find** (around line 94):
```javascript
const allowedOrigins = [
  process.env.NEXT_PUBLIC_SITE_URL,
  "https://listing-magic.vercel.app",
  "http://localhost:3000",  // ← Remove this in production
  "http://localhost:3001",  // ← Remove this in production
].filter(Boolean);
```

**Replace with**:
```javascript
const allowedOrigins = [
  process.env.NEXT_PUBLIC_SITE_URL,
  "https://listing-magic.vercel.app",
  ...(process.env.NODE_ENV === "development" ? ["http://localhost:3000", "http://localhost:3001"] : [])
].filter(Boolean);
```

**Commit this change before deploying!**

---

### Phase 6: Verify Supabase Database

1. Go to: https://supabase.com/dashboard/project/vbfwcemtkgymygccgffl
2. Click: **SQL Editor** → **New Query**
3. Run this verification:

```sql
-- Verify add_credits RPC exists
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'add_credits';

-- Should return: add_credits | FUNCTION

-- Test it works
SELECT add_credits('test@example.com', 1);

-- Should return: {"success": true, "owner": "test@example.com", ...}

-- Clean up test
DELETE FROM credit_balances WHERE owner_identifier = 'test@example.com';
```

4. Verify all analytics tables exist:
```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('user_analytics', 'login_events', 'generation_attempts', 'credit_balances');

-- Should return 4 rows
```

---

### Phase 7: Commit & Push to Main

```bash
# Commit the localhost fix
git add app/api/stripe/checkout/route.js
git commit -m "fix: Remove hardcoded localhost from Stripe allowed origins"

# Push to main (triggers Vercel deployment)
git push origin main
```

---

### Phase 8: Post-Deployment Verification

#### Wait for Vercel Deployment (2-3 minutes)

1. Go to: https://vercel.com/dashboard
2. Wait for "Building" → "Ready"
3. Click **Visit** to open production site

#### Test Authentication Flow

1. **Open**: https://listing-magic.vercel.app
2. **Click**: "Sign in"
3. **Test Google OAuth**:
   - Click "Continue with Google"
   - Should redirect to Google login
   - Should redirect back to dashboard
   - Should show your name in header

#### Test Dashboard Access

1. **Verify**: Dashboard loads without errors
2. **Check**: Credit balance appears in header
3. **Check**: All navigation links work

#### Test Pricing Page (DON'T ACTUALLY PURCHASE YET)

1. **Navigate**: `/dashboard/pricing`
2. **Verify**: All 3 tiers show correct prices
3. **Verify**: Prices match your live Stripe products
4. **Check DevTools Console**: No errors

#### Test Admin Dashboard (If Authorized)

1. **Navigate**: `/admin/headlights`
2. **Verify**: Analytics load
3. **Check**: No database errors in console

---

### Phase 9: First Real Payment Test (SMALL AMOUNT)

⚠️ **This will charge a real card!**

1. **Use**: Your personal card (or test with $20 Starter pack)
2. **Navigate**: `/dashboard/pricing`
3. **Click**: "Starter - 1 Credit" ($20)
4. **Complete**: Real Stripe checkout
5. **Verify After Purchase**:
   - Redirected to dashboard
   - Credit appears in header (+1)
   - Check Supabase: `SELECT * FROM credit_balances WHERE owner_identifier = 'YOUR_EMAIL'`
   - Credit count increased by 1

6. **Check Stripe Dashboard**:
   - Go to: https://dashboard.stripe.com/payments
   - Verify payment appears
   - Check webhook succeeded: Developers → Webhooks → View logs

#### If Payment Test Fails

**Check Vercel Logs**:
1. Go to: https://vercel.com/dashboard
2. Click your project → **Logs**
3. Look for `[Webhook]` entries
4. Check for errors

**Check Stripe Webhook Logs**:
1. Stripe Dashboard → Developers → Webhooks
2. Click your webhook endpoint
3. Click **Logs** tab
4. Look for failed attempts
5. Click failed event → See error details

---

### Phase 10: Invite Business Partner

Once all tests pass:

1. **Send invitation email**:
```
Subject: QuickList Beta - Ready for Testing!

Hey [Partner Name],

QuickList is now live and ready for you to test! 🎉

Access: https://listing-magic.vercel.app

Features to test:
• Google sign-in
• Upload property photos
• Generate AI listings
• Test credit purchases (use test card 4242 4242 4242 4242)
• Admin analytics dashboard

Let me know if you run into any issues!

- Davey
```

2. **Monitor**: Keep Vercel logs open during testing
3. **Be available**: For troubleshooting if needed

---

## 🔍 Monitoring Checklist (During Testing)

### Watch These Logs

**Vercel Logs**:
- https://vercel.com/dashboard → Your Project → Logs
- Filter: "error" or "webhook"

**Stripe Dashboard**:
- https://dashboard.stripe.com/webhooks → Your webhook → Logs

**Supabase**:
- https://supabase.com/dashboard/project/vbfwcemtkgymygccgffl/logs/explorer

### Key Metrics to Monitor

- [ ] Successful logins
- [ ] Credit purchases completing
- [ ] Webhook success rate (should be 100%)
- [ ] Generation attempts succeeding
- [ ] No 500 errors in Vercel logs

---

## 🚨 Rollback Plan (If Things Break)

### Quick Rollback

```bash
# Revert to previous commit
git revert HEAD
git push origin main

# Or revert the merge entirely
git reset --hard [commit-before-merge]
git push origin main --force
```

### Vercel Instant Rollback

1. Go to: https://vercel.com/dashboard
2. Click: **Deployments**
3. Find: Previous working deployment
4. Click: **⋯** → **Promote to Production**

### Emergency: Switch Back to Test Mode

If payments are failing, temporarily switch Vercel env vars back to test keys:
1. Vercel → Settings → Environment Variables
2. Edit: `STRIPE_PUBLIC_KEY` → Use `pk_test_` key
3. Edit: `STRIPE_SECRET_KEY` → Use `sk_test_` key
4. Redeploy

---

## 📝 Common Issues & Solutions

### Issue: "Google Sign-In Failed"
**Cause**: OAuth credentials not set or wrong redirect URI
**Fix**: Double-check Phase 2 setup, verify redirect URIs match exactly

### Issue: "Stripe Checkout Redirects to localhost"
**Cause**: `NEXT_PUBLIC_SITE_URL` not set
**Fix**: Add to Vercel env vars, redeploy

### Issue: "Credits Not Adding After Purchase"
**Cause**: Webhook signature mismatch or RPC function missing
**Fix**: 
1. Verify webhook secret is correct
2. Check Stripe webhook logs
3. Verify `add_credits` RPC exists in Supabase

### Issue: "Internal Server Error on Dashboard"
**Cause**: Missing environment variable
**Fix**: Check Vercel logs for "undefined" errors, add missing var

---

## ✅ Final Pre-Push Checklist

Before running `git push origin main`:

- [ ] Fixed hardcoded localhost in Stripe checkout
- [ ] Committed the fix
- [ ] Verified Supabase `add_credits` RPC exists
- [ ] Created live Stripe products (3 products)
- [ ] Got live Stripe keys (pk_live, sk_live)
- [ ] Created production webhook in Stripe
- [ ] Set up Google OAuth production credentials
- [ ] Generated new NextAuth secret
- [ ] Added ALL environment variables to Vercel
- [ ] Double-checked all URLs are production URLs
- [ ] Reviewed this checklist with business partner

**Only proceed when ALL boxes are checked!**

---

## 🎯 Success Criteria

Deployment is successful when:
- ✅ You can sign in with Google
- ✅ Dashboard loads with no errors
- ✅ Credits show in header
- ✅ Test payment works (Starter $20)
- ✅ Credits increase after payment
- ✅ Webhook returns 200 in Stripe logs
- ✅ Business partner can access and test
- ✅ No errors in Vercel logs

---

**Good luck with the deployment! 🚀**

*Last updated: December 29, 2025*
