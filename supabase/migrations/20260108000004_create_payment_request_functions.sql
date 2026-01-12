-- Migration: Create functions for payment request system
-- Functions to handle payment request creation, approval, rejection, and balance calculation

-- Function: Get seller available balance and payment request eligibility
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

  -- Get last approved/completed request date
  SELECT MAX(requested_at)
  INTO v_last_request
  FROM seller_payment_requests
  WHERE seller_id = p_seller_id
    AND status IN ('approved', 'completed');

  -- Check if can request (30 days since last request or never requested)
  IF v_last_request IS NULL THEN
    v_can_request := true; -- Never requested before
  ELSE
    v_can_request := (NOW() - v_last_request) >= INTERVAL '30 days';
  END IF;

  RETURN QUERY SELECT 
    v_available,
    v_pending,
    v_next_date,
    v_can_request,
    v_last_request;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get last payment request date for a seller
CREATE OR REPLACE FUNCTION get_last_payment_request_date(p_seller_id TEXT)
RETURNS TIMESTAMPTZ AS $$
DECLARE
  v_last_date TIMESTAMPTZ;
BEGIN
  SELECT MAX(requested_at)
  INTO v_last_date
  FROM seller_payment_requests
  WHERE seller_id = p_seller_id
    AND status IN ('approved', 'completed');
  
  RETURN v_last_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Create seller payment request
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
  v_last_request_date TIMESTAMPTZ;
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

  -- Validate 30 days period
  IF NOT v_balance_record.can_request THEN
    RAISE EXCEPTION 'Cannot request payment yet. Last request was on %. Next request available after 30 days.', v_balance_record.last_request_date;
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

-- Function: Process payment request approval
CREATE OR REPLACE FUNCTION process_payment_request_approval(
  p_request_id UUID,
  p_admin_id UUID
)
RETURNS VOID AS $$
DECLARE
  v_request RECORD;
  v_remaining_amount DECIMAL(10, 2);
  v_commission RECORD;
  v_withdrawn DECIMAL(10, 2);
BEGIN
  -- Get request
  SELECT * INTO v_request
  FROM seller_payment_requests
  WHERE id = p_request_id;

  IF v_request.id IS NULL THEN
    RAISE EXCEPTION 'Payment request not found';
  END IF;

  IF v_request.status != 'pending' THEN
    RAISE EXCEPTION 'Payment request is not pending. Current status: %', v_request.status;
  END IF;

  -- Process commissions in FIFO order
  v_remaining_amount := v_request.amount;

  FOR v_commission IN
    SELECT id,
           reserved_amount,
           (commission_amount_usd - COALESCE(withdrawn_amount, 0)) as available
    FROM seller_commissions
    WHERE seller_id = v_request.seller_id
      AND reserved_amount > 0
    ORDER BY created_at ASC
  LOOP
    IF v_remaining_amount <= 0 THEN
      EXIT;
    END IF;

    -- Use the reserved amount
    v_withdrawn := LEAST(v_commission.reserved_amount, v_remaining_amount);

    UPDATE seller_commissions
    SET withdrawn_amount = COALESCE(withdrawn_amount, 0) + v_withdrawn,
        reserved_amount = reserved_amount - v_withdrawn,
        updated_at = NOW()
    WHERE id = v_commission.id;

    v_remaining_amount := v_remaining_amount - v_withdrawn;
  END LOOP;

  -- Update request status
  UPDATE seller_payment_requests
  SET status = 'approved',
      approved_at = NOW(),
      processed_by = p_admin_id,
      updated_at = NOW()
  WHERE id = p_request_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Process payment request rejection
CREATE OR REPLACE FUNCTION process_payment_request_rejection(
  p_request_id UUID,
  p_admin_id UUID,
  p_reason TEXT
)
RETURNS VOID AS $$
DECLARE
  v_request RECORD;
  v_commission RECORD;
BEGIN
  -- Get request
  SELECT * INTO v_request
  FROM seller_payment_requests
  WHERE id = p_request_id;

  IF v_request.id IS NULL THEN
    RAISE EXCEPTION 'Payment request not found';
  END IF;

  IF v_request.status != 'pending' THEN
    RAISE EXCEPTION 'Payment request is not pending. Current status: %', v_request.status;
  END IF;

  IF p_reason IS NULL OR p_reason = '' THEN
    RAISE EXCEPTION 'Rejection reason is required';
  END IF;

  -- Release reserved amounts
  FOR v_commission IN
    SELECT id, reserved_amount
    FROM seller_commissions
    WHERE seller_id = v_request.seller_id
      AND reserved_amount > 0
  LOOP
    UPDATE seller_commissions
    SET reserved_amount = 0,
        updated_at = NOW()
    WHERE id = v_commission.id;
  END LOOP;

  -- Update request status
  UPDATE seller_payment_requests
  SET status = 'rejected',
      rejected_at = NOW(),
      rejection_reason = p_reason,
      processed_by = p_admin_id,
      updated_at = NOW()
  WHERE id = p_request_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Complete payment request (mark as paid)
CREATE OR REPLACE FUNCTION complete_payment_request(
  p_request_id UUID,
  p_proof_url TEXT,
  p_proof_file_path TEXT
)
RETURNS VOID AS $$
DECLARE
  v_request RECORD;
BEGIN
  -- Get request
  SELECT * INTO v_request
  FROM seller_payment_requests
  WHERE id = p_request_id;

  IF v_request.id IS NULL THEN
    RAISE EXCEPTION 'Payment request not found';
  END IF;

  IF v_request.status != 'approved' THEN
    RAISE EXCEPTION 'Payment request must be approved before completion. Current status: %', v_request.status;
  END IF;

  -- Update request status
  UPDATE seller_payment_requests
  SET status = 'completed',
      completed_at = NOW(),
      payment_proof_url = p_proof_url,
      payment_proof_file_path = p_proof_file_path,
      updated_at = NOW()
  WHERE id = p_request_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
