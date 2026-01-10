-- Migration: Remove 30-day maturation period
-- Comissions now become available on the 1st day of the next month (no 30-day wait)
-- Seller can only request payments from days 1-5 of each month

-- Update recalculate_monthly_commissions to set available_for_withdrawal_at to first day of next month
CREATE OR REPLACE FUNCTION recalculate_monthly_commissions(
  p_seller_id TEXT,
  p_month_date DATE DEFAULT CURRENT_DATE
)
RETURNS VOID AS $$
DECLARE
  v_start_of_month TIMESTAMPTZ;
  v_end_of_month TIMESTAMPTZ;
  v_total_net_amount DECIMAL(10, 2);
  v_commission_percentage DECIMAL(5, 2);
  v_order_record RECORD;
  v_order_json JSONB;
  v_net_amount DECIMAL(10, 2);
  v_commission_amount DECIMAL(10, 2);
  v_commission_id UUID;
  v_available_date TIMESTAMPTZ; -- First day of next month
BEGIN
  -- Calculate start and end of month
  v_start_of_month := date_trunc('month', p_month_date::TIMESTAMPTZ);
  v_end_of_month := (date_trunc('month', p_month_date::TIMESTAMPTZ) + INTERVAL '1 month' - INTERVAL '1 day')::TIMESTAMPTZ + INTERVAL '23 hours 59 minutes 59 seconds';
  
  -- Calculate when commissions become available: first day of next month
  v_available_date := (date_trunc('month', p_month_date::TIMESTAMPTZ) + INTERVAL '1 month')::TIMESTAMPTZ;
  
  -- Get all completed orders for this seller in the current month
  -- Calculate total net amount for the month
  SELECT COALESCE(SUM(
    CASE 
      WHEN payment_metadata IS NOT NULL AND payment_metadata ? 'fee_amount' THEN
        GREATEST(total_price_usd - COALESCE((payment_metadata->>'fee_amount')::DECIMAL, 0), 0)
      ELSE
        GREATEST(total_price_usd, 0)
    END
  ), 0) INTO v_total_net_amount
  FROM visa_orders
  WHERE seller_id = p_seller_id
    AND payment_status = 'completed'
    AND created_at >= v_start_of_month
    AND created_at <= v_end_of_month;
  
  -- If no sales or zero total, delete existing commissions for the month
  IF v_total_net_amount <= 0 THEN
    DELETE FROM seller_commissions
    WHERE seller_id = p_seller_id
      AND created_at >= v_start_of_month
      AND created_at <= v_end_of_month;
    RETURN;
  END IF;
  
  -- Get commission percentage based on total monthly net amount (progressive tiers)
  v_commission_percentage := get_commission_percentage(v_total_net_amount);
  
  RAISE NOTICE 'Recalculating commissions for seller % in month %: total_net=%, percentage=%, available_at=%', 
    p_seller_id, p_month_date, v_total_net_amount, v_commission_percentage, v_available_date;
  
  -- Delete existing commissions for this month (will recreate them)
  DELETE FROM seller_commissions
  WHERE seller_id = p_seller_id
    AND created_at >= v_start_of_month
    AND created_at <= v_end_of_month;
  
  -- Loop through all completed orders of the month and create commissions
  FOR v_order_record IN
    SELECT 
      id,
      total_price_usd,
      payment_metadata,
      created_at
    FROM visa_orders
    WHERE seller_id = p_seller_id
      AND payment_status = 'completed'
      AND created_at >= v_start_of_month
      AND created_at <= v_end_of_month
    ORDER BY created_at
  LOOP
    -- Calculate net amount for this order
    v_order_json := jsonb_build_object(
      'total_price_usd', v_order_record.total_price_usd,
      'payment_metadata', v_order_record.payment_metadata
    );
    v_net_amount := calculate_net_amount(v_order_json);
    
    -- Skip if net amount is zero or negative
    IF v_net_amount <= 0 THEN
      CONTINUE;
    END IF;
    
    -- Calculate commission amount using monthly percentage
    v_commission_amount := ROUND(v_net_amount * v_commission_percentage / 100.0, 2);
    
    -- Insert commission with available date = first day of next month
    INSERT INTO seller_commissions (
      seller_id,
      order_id,
      net_amount_usd,
      commission_percentage,
      commission_amount_usd,
      calculation_method,
      available_for_withdrawal_at,
      withdrawn_amount,
      reserved_amount,
      created_at,
      updated_at
    ) VALUES (
      p_seller_id,
      v_order_record.id,
      v_net_amount,
      v_commission_percentage,
      v_commission_amount,
      'monthly_accumulated',
      v_available_date, -- First day of next month (no 30-day wait)
      0,
      0,
      NOW(),
      NOW()
    );
  END LOOP;
  
  RAISE NOTICE 'Commissions recalculated for seller % in month %', p_seller_id, p_month_date;
END;
$$ LANGUAGE plpgsql;

-- Update calculate_seller_commission to use next month's first day
CREATE OR REPLACE FUNCTION calculate_seller_commission(
  p_order_id UUID,
  p_calculation_method TEXT DEFAULT 'monthly_accumulated'
)
RETURNS UUID AS $$
DECLARE
  v_order RECORD;
  v_commission_id UUID;
BEGIN
  -- Get order data to find seller_id
  SELECT 
    id,
    seller_id,
    payment_status,
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
  
  -- For monthly accumulated method, recalculate all commissions for the month
  IF p_calculation_method = 'monthly_accumulated' THEN
    PERFORM recalculate_monthly_commissions(v_order.seller_id, v_order.created_at::DATE);
    
    -- Return the commission ID for this order
    SELECT id INTO v_commission_id
    FROM seller_commissions
    WHERE order_id = p_order_id;
    
    RETURN v_commission_id;
  ELSE
    -- Individual method (legacy, kept for backward compatibility)
    DECLARE
      v_net_amount DECIMAL(10, 2);
      v_commission_percentage DECIMAL(5, 2);
      v_commission_amount DECIMAL(10, 2);
      v_order_json JSONB;
      v_available_date TIMESTAMPTZ;
    BEGIN
      -- Check if commission already exists
      SELECT id INTO v_commission_id
      FROM seller_commissions
      WHERE order_id = p_order_id;
      
      IF v_commission_id IS NOT NULL THEN
        RETURN v_commission_id;
      END IF;
      
      -- Get full order data
      SELECT 
        total_price_usd,
        payment_metadata,
        created_at
      INTO v_order
      FROM visa_orders
      WHERE id = p_order_id;
      
      -- Build JSONB for calculate_net_amount
      v_order_json := jsonb_build_object(
        'total_price_usd', v_order.total_price_usd,
        'payment_metadata', v_order.payment_metadata
      );
      
      -- Calculate net amount
      v_net_amount := calculate_net_amount(v_order_json);
      
      IF v_net_amount <= 0 THEN
        RETURN NULL;
      END IF;
      
      -- Get commission percentage
      v_commission_percentage := get_commission_percentage(v_net_amount);
      
      -- Calculate commission amount
      v_commission_amount := ROUND(v_net_amount * v_commission_percentage / 100.0, 2);
      
      -- Calculate available date: first day of next month
      v_available_date := (DATE_TRUNC('month', v_order.created_at) + INTERVAL '1 month')::TIMESTAMPTZ;
      
      -- Insert commission
      INSERT INTO seller_commissions (
        seller_id,
        order_id,
        net_amount_usd,
        commission_percentage,
        commission_amount_usd,
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
        'individual',
        v_available_date, -- First day of next month (no 30-day wait)
        0,
        0,
        NOW(),
        NOW()
      )
      RETURNING id INTO v_commission_id;
      
      RETURN v_commission_id;
    END;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Update existing commissions to use first day of next month instead of 30 days
-- For each commission, set available_for_withdrawal_at to the first day of the month after created_at
UPDATE seller_commissions
SET available_for_withdrawal_at = (DATE_TRUNC('month', created_at) + INTERVAL '1 month')::TIMESTAMPTZ
WHERE available_for_withdrawal_at IS NOT NULL
  AND available_for_withdrawal_at != (DATE_TRUNC('month', created_at) + INTERVAL '1 month')::TIMESTAMPTZ;

-- Update comment
COMMENT ON COLUMN seller_commissions.available_for_withdrawal_at IS 'Date when commission becomes available for withdrawal (first day of next month after order creation)';
