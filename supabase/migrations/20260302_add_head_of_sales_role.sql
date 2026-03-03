-- Add Head of Sales Role and Relationship Support
-- This migration updates the sellers table to support a simple hierarchy

-- 1. Add 'role' column (defaults to 'seller')
ALTER TABLE public.sellers 
ADD COLUMN IF NOT EXISTS role text DEFAULT 'seller' CHECK (role IN ('seller', 'head_of_sales'));

-- 2. Add 'head_of_sales_id' column (self-referencing foreign key)
ALTER TABLE public.sellers
ADD COLUMN IF NOT EXISTS head_of_sales_id uuid REFERENCES public.sellers(id) ON DELETE SET NULL;

-- 3. Create an index for faster lookups when finding a team
CREATE INDEX IF NOT EXISTS sellers_head_of_sales_id_idx ON public.sellers (head_of_sales_id);

-- 4. Update existing RLS policies or create new ones if needed
-- To ensure a Head of Sales could (in the future) query their team details,
-- For now, Sellers can see themselves, and Admins can see everything (which should already be covered).
