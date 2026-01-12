-- Migration: Remove commission_status field from seller_commissions
-- The status is redundant since we track availability via available_for_withdrawal_at
-- and payment via withdrawn_amount. All commissions are effectively "pending" until withdrawn.

-- Step 1: Update all functions that use commission_status to use withdrawn_amount instead
-- Update get_seller_available_balance to check withdrawn_amount instead of commission_status
CREATE OR REPLACE FUNCTION get_seller_available_balance(p_seller_id TEXT)
RETURNS TABLE (
  available_balance DECIMAL(10, 2),
  pending_balance DECIMAL(10, 2),
  next_withdrawal_date TIMESTAMPTZ,
  can_request BOOLEAN,
  last_request_date TIMESTAMPTZ
) AS $$
DECLARE
  v_available DECIMAL(10, 2) := 0;
  v_pending DECIMAL(10, 2) := 0;
  v_next_date TIMESTAMPTZ;
  v_last_request TIMESTAMPTZ;
  v_can_request BOOLEAN := false;
BEGIN
  -- Calculate available balance (matured commissions - withdrawn - reserved)
  -- A commission is available if it's matured and not fully withdrawn
  SELECT COALESCE(SUM(
    CASE 
      WHEN available_for_withdrawal_at IS NOT NULL 
       AND available_for_withdrawal_at <= NOW()
       AND (commission_amount_usd - COALESCE(withdrawn_amount, 0) - COALESCE(reserved_amount, 0)) > 0
      THEN commission_amount_usd - COALESCE(withdrawn_amount, 0) - COALESCE(reserved_amount, 0)
      ELSE 0
    END
  ), 0)
  INTO v_available
  FROM seller_commissions
  WHERE seller_id = p_seller_id;

  -- Calculate pending balance (commissions still maturing)
  SELECT COALESCE(SUM(
    CASE 
      WHEN available_for_withdrawal_at IS NOT NULL 
       AND available_for_withdrawal_at > NOW()
       AND (commission_amount_usd - COALESCE(withdrawn_amount, 0) - COALESCE(reserved_amount, 0)) > 0
      THEN commission_amount_usd - COALESCE(withdrawn_amount, 0) - COALESCE(reserved_amount, 0)
      ELSE 0
    END
  ), 0)
  INTO v_pending
  FROM seller_commissions
  WHERE seller_id = p_seller_id;

  -- Get next withdrawal date (earliest available_for_withdrawal_at that is in the future)
  SELECT MIN(available_for_withdrawal_at)
  INTO v_next_date
  FROM seller_commissions
  WHERE seller_id = p_seller_id
    AND available_for_withdrawal_at > NOW()
    AND (commission_amount_usd - COALESCE(withdrawn_amount, 0) - COALESCE(reserved_amount, 0)) > 0;

  -- Get last approved/completed request date (for reference only, not used for validation)
  SELECT MAX(requested_at)
  INTO v_last_request
  FROM seller_payment_requests
  WHERE seller_id = p_seller_id
    AND status IN ('approved', 'completed');

  -- Can request if there's available balance (no frequency limit)
  v_can_request := v_available > 0;

  RETURN QUERY SELECT 
    v_available,
    v_pending,
    v_next_date,
    v_can_request,
    v_last_request;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update create_seller_payment_request to not check commission_status
CREATE OR REPLACE FUNCTION create_seller_payment_request(
  p_seller_id TEXT,
  p_amount DECIMAL(10, 2),
  p_payment_method TEXT,
  p_payment_details JSONB
)
RETURNS UUID AS $$
DECLARE
  v_request_id UUID;
  v_balance_record RECORD;
  v_remaining_amount DECIMAL(10, 2);
  v_commission RECORD;
  v_reserved DECIMAL(10, 2);
BEGIN
  -- Validate seller exists (check if has any commissions)
  SELECT COUNT(*) INTO v_remaining_amount
  FROM seller_commissions
  WHERE seller_id = p_seller_id;
  
  IF v_remaining_amount = 0 THEN
    RAISE EXCEPTION 'Seller has no commissions';
  END IF;

  -- Get available balance
  SELECT * INTO v_balance_record
  FROM get_seller_available_balance(p_seller_id);

  -- Validate amount
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;

  IF p_amount > v_balance_record.available_balance THEN
    RAISE EXCEPTION 'Requested amount (%) exceeds available balance (%)', p_amount, v_balance_record.available_balance;
  END IF;

  -- Validate payment method
  IF p_payment_method NOT IN ('stripe', 'wise') THEN
    RAISE EXCEPTION 'Invalid payment method. Must be stripe or wise';
  END IF;

  -- Validate payment_details has email
  IF NOT (p_payment_details ? 'email') OR p_payment_details->>'email' IS NULL OR p_payment_details->>'email' = '' THEN
    RAISE EXCEPTION 'Payment details must include email';
  END IF;

  -- Create payment request
  INSERT INTO seller_payment_requests (
    seller_id,
    amount,
    payment_method,
    payment_details,
    status,
    request_month,
    requested_at
  ) VALUES (
    p_seller_id,
    p_amount,
    p_payment_method,
    p_payment_details,
    'pending',
    DATE_TRUNC('month', NOW())::DATE,
    NOW()
  )
  RETURNING id INTO v_request_id;

  -- Reserve amount in commissions (FIFO - oldest first)
  -- Only reserve from commissions that are available and not fully withdrawn
  v_remaining_amount := p_amount;
  
  FOR v_commission IN
    SELECT id, 
           (commission_amount_usd - COALESCE(withdrawn_amount, 0) - COALESCE(reserved_amount, 0)) as available
    FROM seller_commissions
    WHERE seller_id = p_seller_id
      AND available_for_withdrawal_at IS NOT NULL
      AND available_for_withdrawal_at <= NOW()
      AND (commission_amount_usd - COALESCE(withdrawn_amount, 0) - COALESCE(reserved_amount, 0)) > 0
    ORDER BY created_at ASC
  LOOP
    IF v_remaining_amount <= 0 THEN
      EXIT;
    END IF;

    v_reserved := LEAST(v_commission.available, v_remaining_amount);
    
    UPDATE seller_commissions
    SET reserved_amount = COALESCE(reserved_amount, 0) + v_reserved,
        updated_at = NOW()
    WHERE id = v_commission.id;

    v_remaining_amount := v_remaining_amount - v_reserved;
  END LOOP;

  IF v_remaining_amount > 0.01 THEN -- Allow small rounding differences
    RAISE EXCEPTION 'Could not reserve full amount. This should not happen.';
  END IF;

  RETURN v_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Remove the commission_status column
ALTER TABLE seller_commissions DROP COLUMN IF EXISTS commission_status;

-- Step 3: Remove the index on commission_status
DROP INDEX IF EXISTS idx_seller_commissions_status;

-- Step 4: Remove payment_date column (also redundant - we track via withdrawn_amount)
ALTER TABLE seller_commissions DROP COLUMN IF EXISTS payment_date;
