-- Migration: Create seller_commissions table and automatic calculation system
-- Implements progressive commission tiers based on net sale amount (gross - payment fee)

-- Create seller_commissions table
CREATE TABLE IF NOT EXISTS seller_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id TEXT NOT NULL,
  order_id UUID NOT NULL UNIQUE,
  net_amount_usd DECIMAL(10, 2) NOT NULL,
  commission_percentage DECIMAL(5, 2) NOT NULL,
  commission_amount_usd DECIMAL(10, 2) NOT NULL,
  calculation_method TEXT NOT NULL DEFAULT 'individual' CHECK (calculation_method IN ('individual', 'monthly_accumulated')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_seller_commissions_seller_id ON seller_commissions(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_commissions_order_id ON seller_commissions(order_id);
CREATE INDEX IF NOT EXISTS idx_seller_commissions_created_at ON seller_commissions(created_at DESC);

-- Add foreign key constraint (optional, for referential integrity)
-- Note: seller_id references sellers.seller_id_public (TEXT), not a standard FK
-- Note: order_id references visa_orders.id (UUID), but we'll add FK if table exists

-- Add comments
COMMENT ON TABLE seller_commissions IS 'Stores calculated commissions for sellers based on completed sales';
COMMENT ON COLUMN seller_commissions.net_amount_usd IS 'Net sale amount after payment fees (gross - fee)';
COMMENT ON COLUMN seller_commissions.commission_percentage IS 'Commission percentage applied based on tier';
COMMENT ON COLUMN seller_commissions.commission_amount_usd IS 'Calculated commission amount (net_amount * percentage / 100)';
COMMENT ON COLUMN seller_commissions.calculation_method IS 'Method used: individual (per sale) or monthly_accumulated';

-- Function: Get commission percentage based on net amount (progressive tiers)
CREATE OR REPLACE FUNCTION get_commission_percentage(net_amount DECIMAL)
RETURNS DECIMAL(5, 2) AS $$
BEGIN
  -- Progressive commission tiers:
  -- Até USD 4,999.99: 0.5%
  -- USD 5,000.00 – USD 9,999.99: 1%
  -- USD 10,000.00 – USD 14,999.99: 2%
  -- USD 15,000.00 – USD 19,999.99: 3%
  -- USD 20,000.00 – USD 24,999.99: 4%
  -- A partir de USD 25,000.00: 5%
  
  IF net_amount < 5000.00 THEN
    RETURN 0.50;
  ELSIF net_amount < 10000.00 THEN
    RETURN 1.00;
  ELSIF net_amount < 15000.00 THEN
    RETURN 2.00;
  ELSIF net_amount < 20000.00 THEN
    RETURN 3.00;
  ELSIF net_amount < 25000.00 THEN
    RETURN 4.00;
  ELSE
    RETURN 5.00;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function: Calculate net amount from order (total_price_usd - fee_amount)
CREATE OR REPLACE FUNCTION calculate_net_amount(order_record JSONB)
RETURNS DECIMAL(10, 2) AS $$
DECLARE
  total_price DECIMAL(10, 2);
  fee_amount DECIMAL(10, 2);
  metadata JSONB;
BEGIN
  -- Get total_price_usd from order
  total_price := COALESCE((order_record->>'total_price_usd')::DECIMAL, 0);
  
  -- Get payment_metadata
  metadata := order_record->'payment_metadata';
  
  -- If metadata exists and has fee_amount, subtract it
  IF metadata IS NOT NULL AND metadata ? 'fee_amount' THEN
    fee_amount := COALESCE((metadata->>'fee_amount')::DECIMAL, 0);
    RETURN GREATEST(total_price - fee_amount, 0); -- Ensure non-negative
  END IF;
  
  -- Zelle or other methods without fees: return total_price
  RETURN GREATEST(total_price, 0);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function: Calculate and insert seller commission
CREATE OR REPLACE FUNCTION calculate_seller_commission(
  p_order_id UUID,
  p_calculation_method TEXT DEFAULT 'individual'
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
  
  -- Get commission percentage based on net amount (progressive tiers)
  v_commission_percentage := get_commission_percentage(v_net_amount);
  
  -- Calculate commission amount
  v_commission_amount := ROUND(v_net_amount * v_commission_percentage / 100.0, 2);
  
  -- Insert commission record
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
    v_order.seller_id,
    p_order_id,
    v_net_amount,
    v_commission_percentage,
    v_commission_amount,
    p_calculation_method,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_commission_id;
  
  RAISE NOTICE 'Commission calculated for order %: net_amount=%, percentage=%, amount=%', 
    p_order_id, v_net_amount, v_commission_percentage, v_commission_amount;
  
  RETURN v_commission_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger function: Calculate commission when payment is completed
CREATE OR REPLACE FUNCTION trigger_calculate_seller_commission()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if payment_status changed to 'completed'
  IF NEW.payment_status = 'completed' AND 
     (OLD.payment_status IS NULL OR OLD.payment_status != 'completed') AND
     NEW.seller_id IS NOT NULL AND
     NEW.seller_id != '' THEN
    
    -- Calculate commission (default: individual method)
    PERFORM calculate_seller_commission(NEW.id, 'individual');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on visa_orders table
DROP TRIGGER IF EXISTS trigger_calculate_seller_commission ON visa_orders;

CREATE TRIGGER trigger_calculate_seller_commission
  AFTER INSERT OR UPDATE OF payment_status
  ON visa_orders
  FOR EACH ROW
  WHEN (NEW.payment_status = 'completed' AND NEW.seller_id IS NOT NULL)
  EXECUTE FUNCTION trigger_calculate_seller_commission();

-- Add comment to trigger
COMMENT ON FUNCTION trigger_calculate_seller_commission() IS 'Automatically calculates seller commission when payment status changes to completed';
