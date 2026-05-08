-- Fix mentor visibility for rewards/referral leads.
--
-- referral_links.profile_id stores the referrer student's profile id, not the
-- mentor profile id. Mentors should see leads for referral links owned by
-- students assigned to them via user_profiles.mentor_id.

DROP POLICY IF EXISTS "Mentors can read own referral links" ON public.referral_links;
CREATE POLICY "Mentors can read own referral links"
  ON public.referral_links
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.id = referral_links.profile_id
        AND up.mentor_id = (SELECT private.current_active_mentor_profile_id())
    )
  );

DROP POLICY IF EXISTS "Mentors can read own referral leads" ON public.referral_leads;
CREATE POLICY "Mentors can read own referral leads"
  ON public.referral_leads
  FOR SELECT
  TO authenticated
  USING (
    referral_link_id IN (
      SELECT rl.id
      FROM public.referral_links rl
      JOIN public.user_profiles up ON up.id = rl.profile_id
      WHERE up.mentor_id = (SELECT private.current_active_mentor_profile_id())
    )
  );
