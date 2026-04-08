ALTER TABLE public.sellers
ADD COLUMN IF NOT EXISTS head_of_sales_started_at timestamptz;

COMMENT ON COLUMN public.sellers.head_of_sales_started_at IS
'Effective start date for Head of Sales team-performance analytics.';
