-- Add upsell fields to visa_orders table
ALTER TABLE visa_orders
ADD COLUMN IF NOT EXISTS upsell_product_slug TEXT,
ADD COLUMN IF NOT EXISTS upsell_price_usd DECIMAL(10, 2);

-- Add comment for documentation
COMMENT ON COLUMN visa_orders.upsell_product_slug IS 'Product slug of the upsell item (e.g., canada-tourist-premium), null if no upsell';
COMMENT ON COLUMN visa_orders.upsell_price_usd IS 'Total price of the upsell in USD (including dependents), null if no upsell';
