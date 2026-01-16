-- Migration: Fix Commission Calculation Net Amount and Recalculate
-- This fix ensures that fees (Stripe/Parcelow) are correctly subtracted from the gross amount
-- and that the monthly accumulated percentage is applied correctly.

-- 1. Helper Function to calculate True Net Amount with fallbacks
CREATE OR REPLACE FUNCTION calculate_net_amount(order_record JSONB)
RETURNS DECIMAL(10, 2) AS $$
DECLARE
  total_price DECIMAL(10, 2);
  fee_amount DECIMAL(10, 2);
  metadata JSONB;
  payment_method TEXT;
BEGIN
  -- Get total_price_usd from order
  total_price := COALESCE((order_record->>'total_price_usd')::DECIMAL, 0);
  
  -- Fix for total_price being in cents (e.g. 100000 instead of 1000.00)
  -- Stripe and Parcelow some codes use cents
  IF total_price > 10000 THEN
    total_price := total_price / 100.0;
  END IF;

  -- Get payment_metadata and payment_method
  metadata := order_record->'payment_metadata';
  payment_method := order_record->>'payment_method';
  
  -- If metadata exists and has fee_amount, subtract it (most accurate)
  IF metadata IS NOT NULL AND metadata ? 'fee_amount' THEN
    fee_amount := COALESCE((metadata->>'fee_amount')::DECIMAL, 0);
    -- Handle fee_amount also potentially being in cents
    IF fee_amount > total_price AND fee_amount > 10000 THEN
      fee_amount := fee_amount / 100.0;
    END IF;
    RETURN GREATEST(total_price - fee_amount, 0);
  END IF;
  
  -- Fallback for Parcelow (5% markup in total_price_usd)
  IF payment_method = 'parcelow' THEN
     RETURN ROUND(total_price / 1.05, 2);
  END IF;

  -- Fallback for Stripe (approx 3.5% fee subtracted from total_price_usd)
  IF payment_method LIKE 'stripe%' THEN
     RETURN ROUND(total_price * 0.965, 2);
  END IF;
  
  -- Zelle or other methods without standard percentage fees: return total_price
  RETURN GREATEST(total_price, 0);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Update recalculate_monthly_commissions to use the updated calculate_net_amount
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
  v_end_of_month := (date_trunc('month', p_month_date::TIMESTAMPTZ) + INTERVAL '1 month' - INTERVAL '1 second');
  
  -- Calculate total net amount for the month using the ROBUST calculate_net_amount function
  SELECT COALESCE(SUM(
    calculate_net_amount(jsonb_build_object(
      'total_price_usd', total_price_usd,
      'payment_metadata', payment_metadata,
      'payment_method', payment_method
    ))
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
  
  -- Loop through all completed orders of the month and update/create commissions
  FOR v_order_record IN
    SELECT 
      id,
      total_price_usd,
      payment_metadata,
      payment_method,
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
      'payment_metadata', v_order_record.payment_metadata,
      'payment_method', v_order_record.payment_method
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
        calculation_method,
        created_at,
        updated_at
      ) VALUES (
        p_seller_id,
        v_order_record.id,
        v_net_amount,
        v_commission_percentage,
        v_commission_amount,
        'monthly_accumulated',
        v_order_record.created_at, -- Use order creation date
        NOW()
      );
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 3. Trigger ALL sellers recalculation for January 2026 and December 2025
-- This will fix all existing "totally wrong" commissions
DO $$
DECLARE
  v_seller_id TEXT;
BEGIN
  -- For each seller who has sales in Jan 2026
  FOR v_seller_id IN SELECT DISTINCT seller_id FROM visa_orders WHERE created_at >= '2026-01-01' AND payment_status = 'completed' AND seller_id IS NOT NULL LOOP
    PERFORM recalculate_monthly_commissions(v_seller_id, '2026-01-01'::DATE);
  END LOOP;
  
  -- For each seller who has sales in Dec 2025
  FOR v_seller_id IN SELECT DISTINCT seller_id FROM visa_orders WHERE created_at >= '2025-12-01' AND created_at < '2026-01-01' AND payment_status = 'completed' AND seller_id IS NOT NULL LOOP
    PERFORM recalculate_monthly_commissions(v_seller_id, '2025-12-01'::DATE);
  END LOOP;
END $$;
