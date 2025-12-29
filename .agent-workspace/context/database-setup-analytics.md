# Database Setup for User Analytics (Dec 28, 2025)

This document contains all the SQL needed to support the new user analytics and authentication features.

## 1. User Sessions Table

Tracks all user login events for analytics.

```sql
-- Create user sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_email TEXT NOT NULL,
  logged_in_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for fast lookups by email
CREATE INDEX IF NOT EXISTS idx_user_sessions_email ON user_sessions(user_email);

-- Add index for time-based queries
CREATE INDEX IF NOT EXISTS idx_user_sessions_logged_in_at ON user_sessions(logged_in_at DESC);
```

## 2. Profiles Table Updates

Add columns for source tracking and revenue.

```sql
-- Add source column (where user heard about QuickList)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS source TEXT;

-- Add revenue tracking column
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS revenue_to_date DECIMAL(10,2) DEFAULT 0;

-- Add indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_profiles_source ON profiles(source);
CREATE INDEX IF NOT EXISTS idx_profiles_revenue ON profiles(revenue_to_date DESC);
```

## 3. RPC Functions

### Log User Session

```sql
CREATE OR REPLACE FUNCTION log_user_session(
  user_email_param TEXT
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO user_sessions (user_email, logged_in_at)
  VALUES (user_email_param, NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION log_user_session TO authenticated;
```

### Update User Source

```sql
CREATE OR REPLACE FUNCTION update_user_source(
  user_email_param TEXT,
  source_param TEXT
)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles
  SET source = source_param
  WHERE email = user_email_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION update_user_source TO authenticated;
```

### Update User Revenue

```sql
CREATE OR REPLACE FUNCTION update_user_revenue(
  user_email_param TEXT,
  amount_param DECIMAL
)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles
  SET revenue_to_date = COALESCE(revenue_to_date, 0) + amount_param
  WHERE email = user_email_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION update_user_revenue TO service_role;
```

## 4. Analytics View for Admin Dashboard

```sql
CREATE OR REPLACE VIEW headlights_overview AS
SELECT 
  p.id AS user_id,
  p.email AS listor_email,
  p.brokerage_domain,
  p.created_at AS date_account_opened,
  p.source,
  
  -- Count listings for this user
  (SELECT COUNT(*) FROM listings WHERE user_id = p.id) AS num_listings,
  
  -- Count logins for this user
  (SELECT COUNT(*) FROM user_sessions WHERE user_email = p.email) AS num_logins,
  
  -- Count credit purchases (from credit_transactions where transaction_type = 'credit')
  COALESCE(
    (SELECT SUM(amount) 
     FROM credit_transactions 
     WHERE owner = p.email 
     AND transaction_type = 'credit'),
    0
  ) AS new_listing_credits,
  
  -- Revenue to date
  COALESCE(p.revenue_to_date, 0) AS revenue_to_date,
  
  -- Cost to date (you may need to adjust this based on your cost tracking)
  0.00 AS cost_to_date
  
FROM profiles p
ORDER BY p.created_at DESC;

-- Grant select permission to authenticated users (admin check is in the frontend)
GRANT SELECT ON headlights_overview TO authenticated;
```

## 5. Row Level Security (Optional but Recommended)

If you want to ensure only admins can access the analytics view:

```sql
-- Enable RLS on profiles if not already enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create policy for admin access to analytics view
CREATE POLICY "Admin access to headlights view" ON profiles
  FOR SELECT
  USING (
    auth.email() IN ('admin@lm-intel.ai', 'jmcdrmtt00@gmail.com')
  );
```

## 6. Verify Setup

Run these queries to verify everything is set up correctly:

```sql
-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('user_sessions', 'profiles', 'credit_transactions');

-- Check if columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name IN ('source', 'revenue_to_date');

-- Check if functions exist
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('log_user_session', 'update_user_source', 'update_user_revenue');

-- Check if view exists
SELECT table_name 
FROM information_schema.views 
WHERE table_schema = 'public' 
AND table_name = 'headlights_overview';

-- Test the analytics view
SELECT * FROM headlights_overview LIMIT 5;
```

## Implementation Order

1. Run sections 1-2 (tables and columns)
2. Run section 3 (RPC functions)
3. Run section 4 (analytics view)
4. Run section 5 (RLS - optional)
5. Run section 6 (verification)
6. Test in application

## Notes

- All RPC functions use `SECURITY DEFINER` to run with elevated privileges
- The `update_user_revenue` function is only granted to `service_role` since it's called from the Stripe webhook
- The analytics view assumes you have a `listings` table with a `user_id` column
- Cost tracking (`cost_to_date`) is set to 0 in the view - adjust based on how you track AI/infrastructure costs
- The `credit_transactions` table is used for counting credit purchases

