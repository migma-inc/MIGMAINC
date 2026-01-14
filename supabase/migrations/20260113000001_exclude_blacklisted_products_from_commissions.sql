-- Migration: Exclude blacklisted products from commission calculation
-- Products that should NOT generate commissions:
-- - consultation-brant
-- - consultation-common
-- - visa-retry-defense
-- - rfe-defense
-- - Any product ending with -scholarship
-- - Any product ending with -i20-control

-- Function: Check if a product is blacklisted (should not generate commission)
-- Drop existing functions first to avoid parameter defaults conflicts
DROP FUNCTION IF EXISTS calculate_seller_commission(UUID, TEXT);
DROP FUNCTION IF EXISTS recalculate_monthly_commissions(TEXT, DATE);

CREATE OR REPLACE FUNCTION is_commission_blacklisted_product(p_product_slug TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- If product_slug is null or empty, allow commission (shouldn't happen, but safe)
  IF p_product_slug IS NULL OR p_product_slug = '' THEN
    RETURN FALSE;
  END IF;
  
  -- Check direct blacklist
  IF p_product_slug IN ('consultation-brant', 'consultation-common', 'visa-retry-defense', 'rfe-defense') THEN
    RETURN TRUE;
  END IF;
  
  -- Check if ends with -scholarship or -i20-control
  IF p_product_slug LIKE '%-scholarship' OR p_product_slug LIKE '%-i20-control' THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update calculate_seller_commission to check blacklist
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
  
  -- Get order data (including product_slug)
  SELECT 
    id,
    seller_id,
    product_slug,
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
  
  -- Check if product is blacklisted (should not generate commission)
  IF is_commission_blacklisted_product(v_order.product_slug) THEN
    RAISE NOTICE 'Order % product % is blacklisted and will not generate commission', p_order_id, v_order.product_slug;
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
    p_calculation_method,
    NOW(), -- No maturation period (removed in previous migration)
    0, -- No amount withdrawn yet
    0, -- No amount reserved yet
    NOW(),
    NOW()
  )
  RETURNING id INTO v_commission_id;
  
  RAISE NOTICE 'Commission calculated for order %: net_amount=%, percentage=%, amount=%', 
    p_order_id, v_net_amount, v_commission_percentage, v_commission_amount;
  
  RETURN v_commission_id;
END;
$$ LANGUAGE plpgsql;

-- Update recalculate_monthly_commissions to exclude blacklisted products
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

  -- Calculate total net amount for the month (excluding blacklisted products)
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
    AND created_at <= v_month_end
    AND NOT is_commission_blacklisted_product(product_slug); -- Exclude blacklisted products

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
  -- (excluding blacklisted products)
  FOR v_order IN
    SELECT 
      id,
      product_slug,
      total_price_usd,
      payment_metadata,
      created_at
    FROM visa_orders
    WHERE seller_id = p_seller_id
      AND payment_status = 'completed'
      AND created_at >= v_month_start
      AND created_at <= v_month_end
      AND NOT is_commission_blacklisted_product(product_slug) -- Exclude blacklisted products
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
      'monthly_accumulated',
      NOW(), -- No maturation period (removed in previous migration)
      0,
      0,
      NOW(),
      NOW()
    );
  END LOOP;

  RAISE NOTICE 'Recalculated monthly commissions for seller % in month %: total_net=%, percentage=%, orders processed (excluding blacklisted)', 
    p_seller_id, p_month_date, v_total_net, v_commission_percentage;
END;
$$ LANGUAGE plpgsql;

-- Add comment to function
COMMENT ON FUNCTION is_commission_blacklisted_product IS 'Returns TRUE if product should NOT generate commission. Blacklisted: consultation-brant, consultation-common, visa-retry-defense, rfe-defense, and any product ending with -scholarship or -i20-control';

-- Remove existing commissions for blacklisted products
-- This cleans up any commissions that were created before this migration
DELETE FROM seller_commissions
WHERE order_id IN (
  SELECT id 
  FROM visa_orders 
  WHERE is_commission_blacklisted_product(product_slug) = TRUE
);

-- Log the cleanup
DO $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE 'Removed % commission(s) for blacklisted products', v_deleted_count;
END $$;
