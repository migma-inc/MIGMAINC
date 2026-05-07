-- Allow active referral mentors to read only the referral links and leads
-- connected to their own mentor profile.

ALTER TABLE public.referral_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_leads ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_referral_leads_referral_link_id
  ON public.referral_leads(referral_link_id);

DROP POLICY IF EXISTS "Mentors can read own referral links" ON public.referral_links;
CREATE POLICY "Mentors can read own referral links"
  ON public.referral_links
  FOR SELECT
  TO authenticated
  USING (
    profile_id = (SELECT private.current_active_mentor_profile_id())
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
      WHERE rl.profile_id = (SELECT private.current_active_mentor_profile_id())
    )
  );
