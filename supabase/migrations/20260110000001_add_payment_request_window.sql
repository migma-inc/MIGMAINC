-- Migration: Add payment request window (days 1-5 of each month)
-- Sellers can only request payments during the first 5 days of each month

-- Update get_seller_available_balance to include window information
CREATE OR REPLACE FUNCTION get_seller_available_balance(p_seller_id TEXT)
RETURNS TABLE (
  available_balance DECIMAL(10, 2),
  pending_balance DECIMAL(10, 2),
  next_withdrawal_date TIMESTAMPTZ,
  can_request BOOLEAN,
  last_request_date TIMESTAMPTZ,
  next_request_window_start TIMESTAMPTZ,
  next_request_window_end TIMESTAMPTZ,
  is_in_request_window BOOLEAN
) AS $$
DECLARE
  v_available DECIMAL(10, 2) := 0;
  v_pending DECIMAL(10, 2) := 0;
  v_next_date TIMESTAMPTZ;
  v_last_request TIMESTAMPTZ;
  v_can_request BOOLEAN := false;
  v_current_day INT;
  v_current_month INT;
  v_current_year INT;
  v_next_window_start TIMESTAMPTZ;
  v_next_window_end TIMESTAMPTZ;
  v_is_in_window BOOLEAN := false;
BEGIN
  -- Calculate available balance (matured commissions - withdrawn - reserved)
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

  -- Get last approved/completed request date
  SELECT MAX(requested_at)
  INTO v_last_request
  FROM seller_payment_requests
  WHERE seller_id = p_seller_id
    AND status IN ('approved', 'completed');

  -- Calculate current date components
  v_current_day := EXTRACT(DAY FROM NOW())::INT;
  v_current_month := EXTRACT(MONTH FROM NOW())::INT;
  v_current_year := EXTRACT(YEAR FROM NOW())::INT;

  -- Check if we're in the request window (days 1-5)
  IF v_current_day >= 1 AND v_current_day <= 5 THEN
    v_is_in_window := true;
    -- Current window: start of current month (day 1) to day 5
    v_next_window_start := DATE_TRUNC('month', NOW())::TIMESTAMPTZ;
    v_next_window_end := (DATE_TRUNC('month', NOW()) + INTERVAL '4 days')::TIMESTAMPTZ + INTERVAL '23 hours 59 minutes 59 seconds';
  ELSE
    -- Next window: start of next month (day 1) to day 5
    v_next_window_start := (DATE_TRUNC('month', NOW()) + INTERVAL '1 month')::TIMESTAMPTZ;
    v_next_window_end := (DATE_TRUNC('month', NOW()) + INTERVAL '1 month' + INTERVAL '4 days')::TIMESTAMPTZ + INTERVAL '23 hours 59 minutes 59 seconds';
  END IF;

  -- Can request if: has available balance AND is in the request window
  v_can_request := v_available > 0 AND v_is_in_window;

  RETURN QUERY SELECT 
    v_available,
    v_pending,
    v_next_date,
    v_can_request,
    v_last_request,
    v_next_window_start,
    v_next_window_end,
    v_is_in_window;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update create_seller_payment_request to validate request window
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
  v_current_day INT;
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

  -- Validate request window (days 1-5 of the month)
  IF NOT v_balance_record.is_in_request_window THEN
    RAISE EXCEPTION 'Payment requests can only be made from the 1st to the 5th day of each month. Next window: % to %', 
      v_balance_record.next_request_window_start, 
      v_balance_record.next_request_window_end;
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
