-- Migration: Update commission calculation to monthly accumulated method
-- Changes from individual per-sale to accumulated monthly total

-- Function: Recalculate all commissions for a seller in the current month
-- This is called when a new sale is completed to update all commissions based on new monthly total
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
BEGIN
  -- Calculate start and end of month
  v_start_of_month := date_trunc('month', p_month_date::TIMESTAMPTZ);
  v_end_of_month := (date_trunc('month', p_month_date::TIMESTAMPTZ) + INTERVAL '1 month' - INTERVAL '1 day')::TIMESTAMPTZ + INTERVAL '23 hours 59 minutes 59 seconds';
  
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
  
  RAISE NOTICE 'Recalculating commissions for seller % in month %: total_net=%, percentage=%', 
    p_seller_id, p_month_date, v_total_net_amount, v_commission_percentage;
  
  -- Loop through all completed orders of the month and update/create commissions
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
    
    -- Check if commission already exists
    SELECT id INTO v_commission_id
    FROM seller_commissions
    WHERE order_id = v_order_record.id;
    
    IF v_commission_id IS NOT NULL THEN
      -- Update existing commission
      UPDATE seller_commissions
      SET 
        net_amount_usd = v_net_amount,
        commission_percentage = v_commission_percentage,
        commission_amount_usd = v_commission_amount,
        calculation_method = 'monthly_accumulated',
        updated_at = NOW()
      WHERE id = v_commission_id;
    ELSE
      -- Insert new commission
      INSERT INTO seller_commissions (
        seller_id,
        order_id,
        net_amount_usd,
        commission_percentage,
        commission_amount_usd,
        commission_status,
        calculation_method,
        created_at,
        updated_at
      ) VALUES (
        p_seller_id,
        v_order_record.id,
        v_net_amount,
        v_commission_percentage,
        v_commission_amount,
        'pending',
        'monthly_accumulated',
        NOW(),
        NOW()
      );
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Commissions recalculated for seller % in month %', p_seller_id, p_month_date;
END;
$$ LANGUAGE plpgsql;

-- Update the main commission calculation function to use monthly accumulated method
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
    -- This is the old logic - kept in case needed
    DECLARE
      v_net_amount DECIMAL(10, 2);
      v_commission_percentage DECIMAL(5, 2);
      v_commission_amount DECIMAL(10, 2);
      v_order_json JSONB;
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
        payment_metadata
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
      
      -- Insert commission
      INSERT INTO seller_commissions (
        seller_id,
        order_id,
        net_amount_usd,
        commission_percentage,
        commission_amount_usd,
        commission_status,
        calculation_method,
        created_at,
        updated_at
      ) VALUES (
        v_order.seller_id,
        p_order_id,
        v_net_amount,
        v_commission_percentage,
        v_commission_amount,
        'pending',
        'individual',
        NOW(),
        NOW()
      )
      RETURNING id INTO v_commission_id;
      
      RETURN v_commission_id;
    END;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Update trigger to use monthly_accumulated method
CREATE OR REPLACE FUNCTION trigger_calculate_seller_commission()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if payment_status changed to 'completed'
  IF NEW.payment_status = 'completed' AND 
     (OLD.payment_status IS NULL OR OLD.payment_status != 'completed') AND
     NEW.seller_id IS NOT NULL AND
     NEW.seller_id != '' THEN
    
    -- Calculate commission using monthly accumulated method
    PERFORM calculate_seller_commission(NEW.id, 'monthly_accumulated');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update comment
COMMENT ON FUNCTION recalculate_monthly_commissions(TEXT, DATE) IS 'Recalculates all commissions for a seller in a given month based on accumulated total';
COMMENT ON FUNCTION calculate_seller_commission(UUID, TEXT) IS 'Calculates seller commission. Uses monthly_accumulated method by default (recalculates all month commissions based on total)';
