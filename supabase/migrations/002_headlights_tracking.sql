-- ============================================================================
-- Headlights Dashboard - Analytics & Tracking for Beta Testing
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/vbfwcemtkgymygccgffl/sql
-- ============================================================================

-- 1. User Profiles Table (extends auth.users with business tracking)
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  brokerage_domain TEXT,  -- Auto-extracted from email (e.g., "kw.com", "remax.com")
  date_first_paid TIMESTAMPTZ,  -- When they first purchased credits
  revenue_to_date NUMERIC(10,2) DEFAULT 0,  -- Total revenue from this user (from Stripe)
  source TEXT,  -- How they found us: 'YouTube', 'TikTok', 'Facebook', 'Referral', 'Other'
  source_date TIMESTAMPTZ,  -- When they came from that source
  source_demo_title TEXT,  -- Title of demo video they watched (if applicable)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_source ON user_profiles(source);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_user_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_profiles_updated_at ON user_profiles;
CREATE TRIGGER user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_user_profiles_updated_at();

-- 2. Function to auto-create user profile on signup with brokerage domain
CREATE OR REPLACE FUNCTION create_user_profile_on_signup()
RETURNS TRIGGER AS $$
DECLARE
  email_domain TEXT;
BEGIN
  -- Extract domain from email (e.g., "john@kw.com" -> "kw.com")
  email_domain := split_part(NEW.email, '@', 2);
  
  -- Create profile with auto-extracted brokerage domain
  INSERT INTO user_profiles (user_id, brokerage_domain, created_at)
  VALUES (NEW.id, email_domain, NOW())
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profile on user signup
DROP TRIGGER IF EXISTS create_user_profile_trigger ON auth.users;
CREATE TRIGGER create_user_profile_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_profile_on_signup();

-- 3. User Sessions Table (track logins and session costs)
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  login_at TIMESTAMPTZ DEFAULT NOW(),
  session_cost NUMERIC(10,4) DEFAULT 0,  -- AI costs incurred during this session
  listings_created INTEGER DEFAULT 0,  -- Listings created in this session
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_login_at ON user_sessions(login_at DESC);

-- 4. Update listings table to track refinement costs
-- Check if ai_cost_details column exists, if not add it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'listings' AND column_name = 'ai_cost_details'
  ) THEN
    ALTER TABLE listings ADD COLUMN ai_cost_details JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- ai_cost_details structure:
-- {
--   "initial_generation": 0.05,
--   "refinements": [
--     { "type": "public_remarks", "cost": 0.02, "timestamp": "2025-01-01T10:00:00Z" },
--     { "type": "features", "cost": 0.01, "timestamp": "2025-01-01T10:05:00Z" }
--   ],
--   "total": 0.08
-- }

-- 5. Headlights Overview VIEW (real-time dashboard data)
-- Drop existing view first to avoid column name conflicts
DROP VIEW IF EXISTS headlights_overview;

CREATE VIEW headlights_overview AS
SELECT
  u.id as user_id,
  u.email as listor_email,
  u.created_at as date_account_opened,
  p.date_first_paid,
  p.brokerage_domain,
  p.source,
  p.source_date as date_from_source,
  p.source_demo_title as title_of_source_demo,
  p.revenue_to_date,
  
  -- Listings count
  COUNT(DISTINCT l.id) as num_listings,
  
  -- Logins count
  COUNT(DISTINCT s.id) as num_logins,
  
  -- Credits purchased (sum of all credit additions)
  COALESCE(
    (SELECT SUM(amount) 
     FROM credit_transactions 
     WHERE user_email = u.email 
     AND transaction_type = 'debit'
    ), 0
  ) as new_listing_credits,
  
  -- Total AI cost (sum from all listings)
  COALESCE(SUM(l.ai_cost), 0) as cost_to_date,
  
  -- Most recent login
  MAX(s.login_at) as last_login
  
FROM auth.users u
LEFT JOIN user_profiles p ON p.user_id = u.id
LEFT JOIN listings l ON l.user_id = u.id
LEFT JOIN user_sessions s ON s.user_id = u.id
GROUP BY 
  u.id, 
  u.email, 
  u.created_at, 
  p.date_first_paid, 
  p.brokerage_domain, 
  p.source, 
  p.source_date,
  p.source_demo_title,
  p.revenue_to_date
ORDER BY u.created_at DESC;

-- 6. Function to update user profile revenue from Stripe
CREATE OR REPLACE FUNCTION update_user_revenue(user_email_param TEXT, amount_param NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_user_id UUID;
  new_revenue NUMERIC;
BEGIN
  -- Get user ID from email
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = lower(user_email_param);
  
  IF target_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'User not found');
  END IF;
  
  -- Update revenue
  UPDATE user_profiles
  SET revenue_to_date = revenue_to_date + amount_param,
      date_first_paid = COALESCE(date_first_paid, NOW())
  WHERE user_id = target_user_id
  RETURNING revenue_to_date INTO new_revenue;
  
  RETURN jsonb_build_object(
    'success', true,
    'user_email', user_email_param,
    'amount_added', amount_param,
    'new_revenue', new_revenue
  );
END;
$$;

-- 7. Function to log user session
CREATE OR REPLACE FUNCTION log_user_session(user_email_param TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_user_id UUID;
  session_id UUID;
BEGIN
  -- Get user ID from email
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = lower(user_email_param);
  
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found: %', user_email_param;
  END IF;
  
  -- Create session record
  INSERT INTO user_sessions (user_id, user_email, login_at)
  VALUES (target_user_id, lower(user_email_param), NOW())
  RETURNING id INTO session_id;
  
  RETURN session_id;
END;
$$;

-- 8. Function to update source info (for onboarding flow)
CREATE OR REPLACE FUNCTION update_user_source(
  user_email_param TEXT,
  source_param TEXT,
  demo_title_param TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_user_id UUID;
BEGIN
  -- Get user ID from email
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = lower(user_email_param);
  
  IF target_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'User not found');
  END IF;
  
  -- Update source info (only if not already set)
  UPDATE user_profiles
  SET 
    source = COALESCE(source, source_param),
    source_date = COALESCE(source_date, NOW()),
    source_demo_title = COALESCE(source_demo_title, demo_title_param)
  WHERE user_id = target_user_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'user_email', user_email_param,
    'source', source_param
  );
END;
$$;

-- 9. Row Level Security (RLS)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Users can view/edit their own profile
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE
  USING (user_id = auth.uid());

-- Users can view their own sessions
CREATE POLICY "Users can view own sessions" ON user_sessions
  FOR SELECT
  USING (user_id = auth.uid());

-- Service role has full access (for backend operations)
CREATE POLICY "Service role full access profiles" ON user_profiles
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access sessions" ON user_sessions
  FOR ALL
  USING (auth.role() = 'service_role');

-- Admin access for Headlights dashboard
-- Only Davey and John can query the headlights_overview VIEW
CREATE POLICY "Admin access to headlights" ON user_profiles
  FOR SELECT
  USING (
    auth.jwt() ->> 'email' IN ('admin@lm-intel.ai', 'jmcdrmtt00@gmail.com')
  );

-- 10. Create admin role check function (for dashboard access control)
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (auth.jwt() ->> 'email') IN ('admin@lm-intel.ai', 'jmcdrmtt00@gmail.com');
END;
$$;

-- ============================================================================
-- Example usage:
--
-- Log a user session:
-- SELECT log_user_session('user@example.com');
--
-- Update user source:
-- SELECT update_user_source('user@example.com', 'YouTube', 'QuickList Demo Video');
--
-- Update revenue from Stripe:
-- SELECT update_user_revenue('user@example.com', 150.00);
--
-- Query headlights dashboard:
-- SELECT * FROM headlights_overview;
-- ============================================================================
