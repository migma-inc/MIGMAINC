-- Fix student referral ownership and add first-click attribution for Rewards.

CREATE POLICY "Students can view own referral links"
ON public.referral_links
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = referral_links.profile_id
      AND up.user_id = auth.uid()
  )
);

CREATE POLICY "Students can create own referral links"
ON public.referral_links
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = referral_links.profile_id
      AND up.user_id = auth.uid()
  )
);

CREATE POLICY "Students can update own referral links"
ON public.referral_links
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = referral_links.profile_id
      AND up.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = referral_links.profile_id
      AND up.user_id = auth.uid()
  )
);

CREATE POLICY "Students can view own calendly events"
ON public.calendly_events
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = calendly_events.owner_profile_id
      AND up.user_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.increment_referral_click(p_unique_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.referral_links
  SET clicks = clicks + 1
  WHERE unique_code = p_unique_code;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_referral_click(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.resolve_referral_link_id(p_unique_code text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.referral_links
  WHERE unique_code = p_unique_code
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.resolve_referral_link_id(text) TO anon, authenticated;

ALTER TABLE public.book_a_call_submissions
  ADD COLUMN IF NOT EXISTS referral_code text,
  ADD COLUMN IF NOT EXISTS referral_link_id uuid REFERENCES public.referral_links(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_book_a_call_submissions_referral_code
  ON public.book_a_call_submissions(referral_code);
