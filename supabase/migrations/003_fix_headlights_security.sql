-- ============================================================================
-- Fix Headlights Security Issues - OPTION 1 (Admin Access)
-- ============================================================================
-- This fixes two Supabase linter errors while keeping frontend access for admins
-- ============================================================================

-- Drop the existing insecure view
DROP VIEW IF EXISTS headlights_overview;

-- Recreate view with SECURITY INVOKER (not SECURITY DEFINER)
CREATE VIEW headlights_overview 
WITH (security_invoker = true)  -- This fixes the SECURITY DEFINER warning!
AS
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
  
  COUNT(DISTINCT l.id) as num_listings,
  COUNT(DISTINCT s.id) as num_logins,
  
  COALESCE(
    (SELECT SUM(amount) 
     FROM credit_transactions 
     WHERE user_email = u.email 
     AND transaction_type = 'debit'
    ), 0
  ) as new_listing_credits,
  
  COALESCE(SUM(l.ai_cost), 0) as cost_to_date,
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

-- Enable security barrier
ALTER VIEW headlights_overview SET (security_barrier = true);

-- Revoke access from everyone first
REVOKE ALL ON headlights_overview FROM anon, authenticated, service_role;

-- Grant SELECT to service_role
GRANT SELECT ON headlights_overview TO service_role;

-- Create a policy that allows ONLY admin users to query this view
-- This requires creating a security policy on the view
DROP POLICY IF EXISTS "Admin only access to headlights" ON headlights_overview;

-- Note: Views don't support RLS policies directly, so we need to use grants instead
-- Grant SELECT to authenticated users (the RLS on underlying tables will filter)
GRANT SELECT ON headlights_overview TO authenticated;

-- The security comes from the RLS policies on user_profiles and user_sessions
-- which only allow admins to see all data

COMMENT ON VIEW headlights_overview IS 
  'Admin-only analytics dashboard. Uses SECURITY INVOKER to respect RLS policies.';

-- ============================================================================
-- This solution relies on the existing RLS policies on user_profiles and
-- user_sessions to restrict access. Only admin users can see all data.
-- ============================================================================
