-- Create promotional_coupons table
CREATE TABLE IF NOT EXISTS public.promotional_coupons (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE,
  description text,
  discount_type text NOT NULL CHECK (discount_type IN ('fixed', 'percentage')),
  discount_value numeric NOT NULL CHECK (discount_value > 0),
  max_uses int,
  current_uses int DEFAULT 0,
  valid_from timestamptz NOT NULL,
  valid_until timestamptz,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.promotional_coupons ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can manage coupons
CREATE POLICY "Admins can manage coupons" ON public.promotional_coupons
  USING (auth.role() = 'service_role' OR EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = auth.uid() AND (auth.users.raw_user_meta_data->>'role')::text = 'admin'))
  WITH CHECK (auth.role() = 'service_role' OR EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = auth.uid() AND (auth.users.raw_user_meta_data->>'role')::text = 'admin'));

-- Policy: Authenticated users can read valid coupons (for validation purposes)
-- Actually, we use a SECURITY DEFINER function for validation, so we can keep the table private or allow read for active coupons.
-- Let's allow read for validation just in case, or stick to the function. 
-- The function validate_promotional_coupon is SECURITY DEFINER, so it bypasses RLS. 
-- Thus, we don't strictly need a public read policy if we only access via the function.
-- But the admin policy is good.

-- Add columns to visa_orders
ALTER TABLE public.visa_orders 
ADD COLUMN IF NOT EXISTS coupon_code text,
ADD COLUMN IF NOT EXISTS discount_amount numeric(10,2);

-- Function to validate coupon
CREATE OR REPLACE FUNCTION public.validate_promotional_coupon(p_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_coupon record;
BEGIN
  -- Find coupon, case insensitive
  SELECT * INTO v_coupon
  FROM public.promotional_coupons
  WHERE upper(code) = upper(p_code)
  AND is_active = true;

  IF NOT FOUND THEN
    RETURN json_build_object('valid', false, 'message', 'Cupom inválido ou inativo.');
  END IF;

  -- Check dates
  IF now() < v_coupon.valid_from THEN
     RETURN json_build_object('valid', false, 'message', 'Este cupom ainda não é válido.');
  END IF;

  IF v_coupon.valid_until IS NOT NULL AND now() > v_coupon.valid_until THEN
     RETURN json_build_object('valid', false, 'message', 'Este cupom expirou.');
  END IF;

  -- Check usage limits
  IF v_coupon.max_uses IS NOT NULL AND v_coupon.current_uses >= v_coupon.max_uses THEN
     RETURN json_build_object('valid', false, 'message', 'Limite de uso deste cupom atingido.');
  END IF;

  -- Return success details
  RETURN json_build_object(
    'valid', true,
    'type', v_coupon.discount_type,
    'value', v_coupon.discount_value,
    'code', v_coupon.code, -- Return normalized code
    'message', 'Cupom aplicado com sucesso!'
  );
END;
$$;

-- Function to increment usage (to be called by backend on successful payment)
CREATE OR REPLACE FUNCTION public.increment_coupon_usage(p_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.promotional_coupons
  SET current_uses = current_uses + 1
  WHERE upper(code) = upper(p_code);
END;
$$;
