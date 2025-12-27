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

-- 6b. RPC Function: Increment personal credits (refund mechanism - LEGACY)
-- Intended for refunding a credit to the authenticated user's personal balance.
-- NOTE: This increments the *personal* (email) owner_identifier, not the domain pool.
-- DEPRECATED: Use refund_credit_attempt() for idempotent refunds.
CREATE OR REPLACE FUNCTION increment_credits(user_email TEXT, amount INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_balance INTEGER;
  owner_identifier TEXT;
BEGIN
  IF user_email IS NULL OR btrim(user_email) = '' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid user_email');
  END IF;

  IF amount IS NULL OR amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Amount must be positive');
  END IF;

  owner_identifier := lower(btrim(user_email));

  -- Insert or update personal credits for this email
  INSERT INTO credit_balances (owner_identifier, credits)
  VALUES (owner_identifier, amount)
  ON CONFLICT (owner_identifier)
  DO UPDATE SET credits = credit_balances.credits + amount
  RETURNING credits INTO new_balance;

  RETURN jsonb_build_object(
    'success', true,
    'owner', owner_identifier,
    'credits_added', amount,
    'new_balance', new_balance
  );
END;
$$;

-- 6c. Credit Transactions Table (for idempotent refunds)
-- Tracks all credit debits and refunds with unique attempt_id for idempotency
CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL,  -- Generation attempt identifier
  user_email TEXT NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('debit', 'refund')),
  amount INTEGER NOT NULL,
  source TEXT CHECK (source IN ('domain', 'personal', 'unknown')),  -- Where credit came from/went to
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(attempt_id, transaction_type)  -- Prevents duplicate debits or refunds for same attempt
);

-- Index for fast lookups by attempt_id
CREATE INDEX IF NOT EXISTS idx_credit_transactions_attempt ON credit_transactions(attempt_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user ON credit_transactions(user_email, created_at DESC);

-- 6d. RPC Function: Idempotent refund by attempt_id
-- Only refunds once per attempt_id, preventing double-refunds
CREATE OR REPLACE FUNCTION refund_credit_attempt(user_email TEXT, attempt_id UUID, amount INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  owner_identifier TEXT;
  new_balance INTEGER;
  existing_refund RECORD;
  debit_source TEXT;
BEGIN
  -- Validate inputs
  IF user_email IS NULL OR btrim(user_email) = '' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid user_email');
  END IF;

  IF attempt_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid attempt_id');
  END IF;

  IF amount IS NULL OR amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Amount must be positive');
  END IF;

  owner_identifier := lower(btrim(user_email));

  -- Check if refund already exists for this attempt
  SELECT * INTO existing_refund
  FROM credit_transactions
  WHERE attempt_id = refund_credit_attempt.attempt_id
    AND transaction_type = 'refund';

  IF existing_refund.id IS NOT NULL THEN
    -- Refund already processed - return idempotent success
    RETURN jsonb_build_object(
      'success', true,
      'already_refunded', true,
      'message', 'Credit was already refunded for this attempt',
      'transaction_id', existing_refund.id,
      'refunded_at', existing_refund.created_at
    );
  END IF;

  -- Look up the original debit to determine which pool to refund to
  SELECT source INTO debit_source
  FROM credit_transactions
  WHERE attempt_id = refund_credit_attempt.attempt_id
    AND transaction_type = 'debit'
  LIMIT 1;

  -- Default to personal if no debit record found
  IF debit_source IS NULL THEN
    debit_source := 'personal';
  END IF;

  -- Refund to personal credits (always personal for safety)
  INSERT INTO credit_balances (owner_identifier, credits)
  VALUES (owner_identifier, amount)
  ON CONFLICT (owner_identifier)
  DO UPDATE SET credits = credit_balances.credits + amount
  RETURNING credits INTO new_balance;

  -- Record the refund transaction
  INSERT INTO credit_transactions (attempt_id, user_email, transaction_type, amount, source)
  VALUES (refund_credit_attempt.attempt_id, owner_identifier, 'refund', amount, 'personal');

  RETURN jsonb_build_object(
    'success', true,
    'already_refunded', false,
    'message', 'Credit refunded successfully',
    'owner', owner_identifier,
    'amount_refunded', amount,
    'new_balance', new_balance,
    'refunded_to', 'personal'
  );
END;
$$;

-- 6e. Update check_and_decrement_credits to optionally record attempt_id
-- Allows tracking of debits for later refunds
CREATE OR REPLACE FUNCTION check_and_decrement_credits_with_attempt(user_email TEXT, attempt_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  email_domain TEXT;
  domain_credits INTEGER;
  personal_credits INTEGER;
  result JSONB;
  credit_source TEXT;
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

  IF attempt_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'source', null,
      'remaining', 0,
      'message', 'Invalid attempt_id'
    );
  END IF;

  -- Extract domain from email
  email_domain := split_part(lower(user_email), '@', 2);

  IF email_domain = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'source', null,
      'remaining', 0,
      'message', 'Could not extract domain from email'
    );
  END IF;

  -- Check domain credits first
  SELECT credits INTO domain_credits
  FROM credit_balances
  WHERE owner_identifier = email_domain
  FOR UPDATE;

  IF domain_credits IS NOT NULL AND domain_credits > 0 THEN
    -- Decrement domain credits
    UPDATE credit_balances
    SET credits = credits - 1
    WHERE owner_identifier = email_domain;

    credit_source := 'domain';

    -- Record the debit transaction
    INSERT INTO credit_transactions (attempt_id, user_email, transaction_type, amount, source)
    VALUES (attempt_id, lower(user_email), 'debit', 1, credit_source);

    RETURN jsonb_build_object(
      'success', true,
      'source', 'domain',
      'remaining', domain_credits - 1,
      'message', 'Credit deducted from team pool',
      'attempt_id', attempt_id
    );
  END IF;

  -- Check personal credits
  SELECT credits INTO personal_credits
  FROM credit_balances
  WHERE owner_identifier = lower(user_email)
  FOR UPDATE;

  IF personal_credits IS NOT NULL AND personal_credits > 0 THEN
    -- Decrement personal credits
    UPDATE credit_balances
    SET credits = credits - 1
    WHERE owner_identifier = lower(user_email);

    credit_source := 'personal';

    -- Record the debit transaction
    INSERT INTO credit_transactions (attempt_id, user_email, transaction_type, amount, source)
    VALUES (attempt_id, lower(user_email), 'debit', 1, credit_source);

    RETURN jsonb_build_object(
      'success', true,
      'source', 'personal',
      'remaining', personal_credits - 1,
      'message', 'Credit deducted from personal balance',
      'attempt_id', attempt_id
    );
  END IF;

  -- No credits available
  RETURN jsonb_build_object(
    'success', false,
    'source', null,
    'remaining', 0,
    'message', 'Insufficient credits'
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

-- RLS for credit_transactions table
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own transactions
CREATE POLICY "Users can view own transactions" ON credit_transactions
  FOR SELECT
  USING (user_email = lower(auth.jwt() ->> 'email'));

-- Service role full access for transactions
CREATE POLICY "Service role full access transactions" ON credit_transactions
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
-- Use a credit (legacy - no attempt tracking):
-- SELECT check_and_decrement_credits('john@example.com');
--
-- Use a credit with attempt tracking (recommended):
-- SELECT check_and_decrement_credits_with_attempt('john@example.com', gen_random_uuid());
--
-- Refund a credit idempotently:
-- SELECT refund_credit_attempt('john@example.com', '<attempt-uuid>', 1);
-- ============================================================================
