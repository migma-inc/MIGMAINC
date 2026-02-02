-- Drop the old policy
DROP POLICY IF EXISTS "Admins can manage coupons" ON public.promotional_coupons;

-- Create the new optimized policy using JWT claims
CREATE POLICY "Admins can manage coupons" ON public.promotional_coupons
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' OR
    auth.role() = 'service_role'
  )
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' OR
    auth.role() = 'service_role'
  );
