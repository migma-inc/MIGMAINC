-- Gap 3 hardening: Rewards + Support panels.
-- Aligns local migrations with the student dashboard panels and closes overly broad
-- Calendly event visibility.

-- ---------------------------------------------------------------------------
-- Support chat tables used by src/pages/StudentSupport/index.tsx
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.support_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.support_handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  triggered_by text NOT NULL,
  reason text,
  last_ai_message text,
  assigned_to text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved')),
  resolved_at timestamptz,
  resolved_note text,
  meeting_url text,
  meeting_requested_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.support_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_handoffs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_support_chat_messages_profile_created
  ON public.support_chat_messages(profile_id, created_at);

CREATE INDEX IF NOT EXISTS idx_support_handoffs_profile_created
  ON public.support_handoffs(profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_handoffs_status
  ON public.support_handoffs(status);

-- Normalize support RLS. Admin access follows the project's existing JWT
-- metadata convention because this remote user_profiles table has no role column.

DROP POLICY IF EXISTS "Admin insert chat messages" ON public.support_chat_messages;
DROP POLICY IF EXISTS "Admin read all chat" ON public.support_chat_messages;
DROP POLICY IF EXISTS "Student insert own chat" ON public.support_chat_messages;
DROP POLICY IF EXISTS "Student read own chat" ON public.support_chat_messages;

CREATE POLICY "Students can read own support chat"
ON public.support_chat_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = support_chat_messages.profile_id
      AND up.user_id = auth.uid()
  )
);

CREATE POLICY "Students can insert own support chat"
ON public.support_chat_messages
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = support_chat_messages.profile_id
      AND up.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can read all support chat"
ON public.support_chat_messages
FOR SELECT
TO authenticated
USING (
  ((auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'superadmin', 'super_admin'))
);

CREATE POLICY "Admins can insert support chat"
ON public.support_chat_messages
FOR INSERT
TO authenticated
WITH CHECK (
  ((auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'superadmin', 'super_admin'))
);

DROP POLICY IF EXISTS "Admin all handoffs" ON public.support_handoffs;
DROP POLICY IF EXISTS "Student insert own handoffs" ON public.support_handoffs;
DROP POLICY IF EXISTS "Student read own handoffs" ON public.support_handoffs;

CREATE POLICY "Students can read own support handoffs"
ON public.support_handoffs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = support_handoffs.profile_id
      AND up.user_id = auth.uid()
  )
);

CREATE POLICY "Students can insert own support handoffs"
ON public.support_handoffs
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = support_handoffs.profile_id
      AND up.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage support handoffs"
ON public.support_handoffs
FOR ALL
TO authenticated
USING (
  ((auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'superadmin', 'super_admin'))
)
WITH CHECK (
  ((auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'superadmin', 'super_admin'))
);

-- ---------------------------------------------------------------------------
-- Rewards/Calendly visibility
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Admin read all calendly events" ON public.calendly_events;

CREATE POLICY "Admins can read all calendly events"
ON public.calendly_events
FOR SELECT
TO authenticated
USING (
  ((auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'superadmin', 'super_admin'))
);

DROP POLICY IF EXISTS "Users can view their own referral link" ON public.referral_links;
