-- Migration to add `is_test` flag for dummy sellers
ALTER TABLE public.sellers 
ADD COLUMN is_test BOOLEAN DEFAULT false;

-- Update the existing 'victordev' seller to be marked as test
UPDATE public.sellers 
SET is_test = true 
WHERE seller_id_public = 'victordev';
