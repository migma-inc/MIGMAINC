-- Migration: Add dependent_names field to visa_orders table
-- Allows storing individual names of dependents for webhook processing

ALTER TABLE visa_orders
ADD COLUMN IF NOT EXISTS dependent_names TEXT[];

-- Add comment for documentation
COMMENT ON COLUMN visa_orders.dependent_names IS 'Array of dependent names. Example: ["João Silva", "Maria Silva", "Pedro Silva"]. Used to send separate webhooks for each dependent.';

