-- ============================================================================
-- Domain-Aware Credit System for QuickList
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/vbfwcemtkgymygccgffl/sql
-- ============================================================================

-- 1. Create credit_balances table
CREATE TABLE IF NOT EXISTS credit_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_identifier TEXT UNIQUE NOT NULL,  -- Email ("john@example.com") OR Domain ("example.com")
  credits INTEGER DEFAULT 0 CHECK (credits >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_credit_balances_owner ON credit_balances(owner_identifier);

-- 3. Create updated_at trigger
CREATE OR REPLACE FUNCTION update_credit_balances_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS credit_balances_updated_at ON credit_balances;
CREATE TRIGGER credit_balances_updated_at
  BEFORE UPDATE ON credit_balances
  FOR EACH ROW
  EXECUTE FUNCTION update_credit_balances_updated_at();

-- 4. RPC Function: Check and decrement credits (domain-aware)
-- Returns: { success: boolean, source: 'domain' | 'personal' | null, remaining: number, message: string }
CREATE OR REPLACE FUNCTION check_and_decrement_credits(user_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER  -- Runs with elevated privileges
AS $$
DECLARE
  email_domain TEXT;
  domain_credits INTEGER;
  personal_credits INTEGER;
  result JSONB;
BEGIN
  -- Validate input
  IF user_email IS NULL OR user_email = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'source', null,
      'remaining', 0,
      'message', 'Invalid email provided'
    );
  END IF;

  -- Extract domain from email (e.g., "john@example.com" -> "example.com")
  email_domain := split_part(lower(user_email), '@', 2);

  IF email_domain = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'source', null,
      'remaining', 0,
      'message', 'Could not extract domain from email'
    );
  END IF;

  -- Step A & B: Check domain credits first
  SELECT credits INTO domain_credits
  FROM credit_balances
  WHERE owner_identifier = email_domain
  FOR UPDATE;  -- Lock row for atomic update

  IF domain_credits IS NOT NULL AND domain_credits > 0 THEN
    -- Decrement domain credits
    UPDATE credit_balances
    SET credits = credits - 1
    WHERE owner_identifier = email_domain;

    RETURN jsonb_build_object(
      'success', true,
      'source', 'domain',
      'remaining', domain_credits - 1,
      'message', 'Credit deducted from team pool'
    );
  END IF;

  -- Step C: Check personal (email) credits
  SELECT credits INTO personal_credits
  FROM credit_balances
  WHERE owner_identifier = lower(user_email)
  FOR UPDATE;

  IF personal_credits IS NOT NULL AND personal_credits > 0 THEN
    -- Decrement personal credits
    UPDATE credit_balances
    SET credits = credits - 1
    WHERE owner_identifier = lower(user_email);

    RETURN jsonb_build_object(
      'success', true,
      'source', 'personal',
      'remaining', personal_credits - 1,
      'message', 'Credit deducted from personal balance'
    );
  END IF;

  -- Step D: No credits available
  RETURN jsonb_build_object(
    'success', false,
    'source', null,
    'remaining', 0,
    'message', 'Insufficient credits'
  );
END;
$$;

-- 5. RPC Function: Get credit balance (domain + personal combined view)
CREATE OR REPLACE FUNCTION get_credit_balance(user_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  email_domain TEXT;
  domain_credits INTEGER DEFAULT 0;
  personal_credits INTEGER DEFAULT 0;
BEGIN
  IF user_email IS NULL OR user_email = '' THEN
    RETURN jsonb_build_object(
      'domain_credits', 0,
      'personal_credits', 0,
      'total_credits', 0,
      'domain', null
    );
  END IF;

  email_domain := split_part(lower(user_email), '@', 2);

  -- Get domain credits
  SELECT COALESCE(credits, 0) INTO domain_credits
  FROM credit_balances
  WHERE owner_identifier = email_domain;

  -- Get personal credits
  SELECT COALESCE(credits, 0) INTO personal_credits
  FROM credit_balances
  WHERE owner_identifier = lower(user_email);

  RETURN jsonb_build_object(
    'domain_credits', domain_credits,
    'personal_credits', personal_credits,
    'total_credits', domain_credits + personal_credits,
    'domain', email_domain
  );
END;
$$;

-- 6. RPC Function: Add credits (for Stripe webhook / admin)
CREATE OR REPLACE FUNCTION add_credits(owner TEXT, amount INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_balance INTEGER;
BEGIN
  IF owner IS NULL OR owner = '' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid owner');
  END IF;

  IF amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Amount must be positive');
  END IF;

  -- Insert or update credits
  INSERT INTO credit_balances (owner_identifier, credits)
  VALUES (lower(owner), amount)
  ON CONFLICT (owner_identifier)
  DO UPDATE SET credits = credit_balances.credits + amount
  RETURNING credits INTO new_balance;

  RETURN jsonb_build_object(
    'success', true,
    'owner', lower(owner),
    'credits_added', amount,
    'new_balance', new_balance
  );
END;
$$;

-- 7. Row Level Security (RLS)
ALTER TABLE credit_balances ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own email or domain credits
CREATE POLICY "Users can view own credits" ON credit_balances
  FOR SELECT
  USING (
    owner_identifier = lower(auth.jwt() ->> 'email')
    OR owner_identifier = split_part(lower(auth.jwt() ->> 'email'), '@', 2)
  );

-- Service role can do everything (for backend operations)
CREATE POLICY "Service role full access" ON credit_balances
  FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================================
-- Example usage:
--
-- Add credits to a domain (team pool):
-- SELECT add_credits('example.com', 50);
--
-- Add credits to an individual:
-- SELECT add_credits('john@example.com', 10);
--
-- Check balance for a user:
-- SELECT get_credit_balance('john@example.com');
--
-- Use a credit:
-- SELECT check_and_decrement_credits('john@example.com');
-- ============================================================================
