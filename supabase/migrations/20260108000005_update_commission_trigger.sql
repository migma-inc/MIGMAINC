-- Migration: Update commission trigger to set maturation date
-- Modifies the commission calculation function to automatically set available_for_withdrawal_at

-- First, update existing function to set available_for_withdrawal_at
CREATE OR REPLACE FUNCTION calculate_seller_commission(
  p_order_id UUID,
  p_calculation_method TEXT DEFAULT 'monthly_accumulated'
)
RETURNS UUID AS $$
DECLARE
  v_order RECORD;
  v_net_amount DECIMAL(10, 2);
  v_commission_percentage DECIMAL(5, 2);
  v_commission_amount DECIMAL(10, 2);
  v_commission_id UUID;
  v_order_json JSONB;
BEGIN
  -- Check if commission already exists for this order
  SELECT id INTO v_commission_id
  FROM seller_commissions
  WHERE order_id = p_order_id;
  
  IF v_commission_id IS NOT NULL THEN
    RAISE NOTICE 'Commission already exists for order %', p_order_id;
    RETURN v_commission_id;
  END IF;
  
  -- Get order data
  SELECT 
    id,
    seller_id,
    payment_status,
    total_price_usd,
    payment_metadata,
    created_at
  INTO v_order
  FROM visa_orders
  WHERE id = p_order_id;
  
  -- Validate order exists
  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Order % not found', p_order_id;
  END IF;
  
  -- Validate payment status
  IF v_order.payment_status != 'completed' THEN
    RAISE NOTICE 'Order % payment status is not completed: %', p_order_id, v_order.payment_status;
    RETURN NULL;
  END IF;
  
  -- Validate seller_id exists
  IF v_order.seller_id IS NULL OR v_order.seller_id = '' THEN
    RAISE NOTICE 'Order % has no seller_id', p_order_id;
    RETURN NULL;
  END IF;
  
  -- Build JSONB from order record for calculate_net_amount function
  v_order_json := jsonb_build_object(
    'total_price_usd', v_order.total_price_usd,
    'payment_metadata', v_order.payment_metadata
  );
  
  -- Calculate net amount (total_price_usd - fee_amount)
  v_net_amount := calculate_net_amount(v_order_json);
  
  -- If net amount is zero or negative, skip commission
  IF v_net_amount <= 0 THEN
    RAISE NOTICE 'Order % has zero or negative net amount: %', p_order_id, v_net_amount;
    RETURN NULL;
  END IF;
  
  -- If monthly_accumulated, use recalculate_monthly_commissions
  IF p_calculation_method = 'monthly_accumulated' THEN
    PERFORM recalculate_monthly_commissions(v_order.seller_id, DATE_TRUNC('month', v_order.created_at)::DATE);
    -- Return the commission ID for this order
    SELECT id INTO v_commission_id
    FROM seller_commissions
    WHERE order_id = p_order_id;
    RETURN v_commission_id;
  END IF;
  
  -- Get commission percentage based on net amount (progressive tiers)
  v_commission_percentage := get_commission_percentage(v_net_amount);
  
  -- Calculate commission amount
  v_commission_amount := ROUND(v_net_amount * v_commission_percentage / 100.0, 2);
  
  -- Insert commission record with maturation date
  INSERT INTO seller_commissions (
    seller_id,
    order_id,
    net_amount_usd,
    commission_percentage,
    commission_amount_usd,
    commission_status,
    calculation_method,
    available_for_withdrawal_at,
    withdrawn_amount,
    reserved_amount,
    created_at,
    updated_at
  ) VALUES (
    v_order.seller_id,
    p_order_id,
    v_net_amount,
    v_commission_percentage,
    v_commission_amount,
    'pending',
    p_calculation_method,
    NOW() + INTERVAL '30 days', -- Maturation period: 30 days
    0, -- No amount withdrawn yet
    0, -- No amount reserved yet
    NOW(),
    NOW()
  )
  RETURNING id INTO v_commission_id;
  
  RAISE NOTICE 'Commission calculated for order %: net_amount=%, percentage=%, amount=%, available_at=%', 
    p_order_id, v_net_amount, v_commission_percentage, v_commission_amount, NOW() + INTERVAL '30 days';
  
  RETURN v_commission_id;
END;
$$ LANGUAGE plpgsql;

-- Update recalculate_monthly_commissions to also set available_for_withdrawal_at
CREATE OR REPLACE FUNCTION recalculate_monthly_commissions(
  p_seller_id TEXT,
  p_month_date DATE
)
RETURNS VOID AS $$
DECLARE
  v_total_net DECIMAL(10, 2);
  v_commission_percentage DECIMAL(5, 2);
  v_order RECORD;
  v_order_json JSONB;
  v_net_amount DECIMAL(10, 2);
  v_commission_amount DECIMAL(10, 2);
  v_commission_id UUID;
  v_month_start TIMESTAMPTZ;
  v_month_end TIMESTAMPTZ;
BEGIN
  -- Calculate month boundaries
  v_month_start := DATE_TRUNC('month', p_month_date::TIMESTAMPTZ);
  v_month_end := (DATE_TRUNC('month', p_month_date::TIMESTAMPTZ) + INTERVAL '1 month' - INTERVAL '1 day')::TIMESTAMPTZ + INTERVAL '23 hours 59 minutes 59 seconds';

  -- Calculate total net amount for the month
  SELECT COALESCE(SUM(
    CASE 
      WHEN payment_metadata IS NOT NULL AND payment_metadata ? 'fee_amount' THEN
        total_price_usd - COALESCE((payment_metadata->>'fee_amount')::DECIMAL, 0)
      ELSE total_price_usd
    END
  ), 0)
  INTO v_total_net
  FROM visa_orders
  WHERE seller_id = p_seller_id
    AND payment_status = 'completed'
    AND created_at >= v_month_start
    AND created_at <= v_month_end;

  -- If total is zero or negative, delete any existing commissions for this month
  IF v_total_net <= 0 THEN
    DELETE FROM seller_commissions
    WHERE seller_id = p_seller_id
      AND created_at >= v_month_start
      AND created_at <= v_month_end
      AND calculation_method = 'monthly_accumulated';
    RETURN;
  END IF;

  -- Get commission percentage based on total net amount
  v_commission_percentage := get_commission_percentage(v_total_net);

  -- Delete existing monthly accumulated commissions for this month
  DELETE FROM seller_commissions
  WHERE seller_id = p_seller_id
    AND created_at >= v_month_start
    AND created_at <= v_month_end
    AND calculation_method = 'monthly_accumulated';

  -- Recalculate commissions for each order in the month using the monthly percentage
  FOR v_order IN
    SELECT 
      id,
      total_price_usd,
      payment_metadata,
      created_at
    FROM visa_orders
    WHERE seller_id = p_seller_id
      AND payment_status = 'completed'
      AND created_at >= v_month_start
      AND created_at <= v_month_end
    ORDER BY created_at ASC
  LOOP
    -- Build JSONB for calculate_net_amount
    v_order_json := jsonb_build_object(
      'total_price_usd', v_order.total_price_usd,
      'payment_metadata', v_order.payment_metadata
    );
    
    -- Calculate net amount for this order
    v_net_amount := calculate_net_amount(v_order_json);
    
    -- Skip if net amount is zero or negative
    IF v_net_amount <= 0 THEN
      CONTINUE;
    END IF;
    
    -- Calculate commission amount using monthly percentage
    v_commission_amount := ROUND(v_net_amount * v_commission_percentage / 100.0, 2);
    
    -- Insert commission with maturation date
    INSERT INTO seller_commissions (
      seller_id,
      order_id,
      net_amount_usd,
      commission_percentage,
      commission_amount_usd,
      commission_status,
      calculation_method,
      available_for_withdrawal_at,
      withdrawn_amount,
      reserved_amount,
      created_at,
      updated_at
    ) VALUES (
      p_seller_id,
      v_order.id,
      v_net_amount,
      v_commission_percentage,
      v_commission_amount,
      'pending',
      'monthly_accumulated',
      v_order.created_at + INTERVAL '30 days', -- Maturation: 30 days from order creation
      0,
      0,
      NOW(),
      NOW()
    );
  END LOOP;

  RAISE NOTICE 'Recalculated monthly commissions for seller % in month %: total_net=%, percentage=%, orders processed', 
    p_seller_id, p_month_date, v_total_net, v_commission_percentage;
END;
$$ LANGUAGE plpgsql;
