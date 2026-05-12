-- Track mentor email notification windows for unread student support messages.
--
-- A student can send many messages while the assigned mentor has not opened
-- the chat. We only want one mentor email per unread window. The window key is
-- derived from the mentor's support_chat_read_receipts.last_read_at value.

CREATE TABLE IF NOT EXISTS public.support_chat_mentor_email_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  mentor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mentor_profile_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  message_id uuid NOT NULL REFERENCES public.support_chat_messages(id) ON DELETE CASCADE,
  read_receipt_key text NOT NULL,
  read_receipt_last_read_at timestamptz,
  sent_to_email text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  email_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_chat_mentor_email_notifications_status_check
    CHECK (status IN ('pending', 'sent', 'failed')),
  CONSTRAINT support_chat_mentor_email_notifications_window_unique
    UNIQUE (profile_id, mentor_user_id, read_receipt_key)
);

CREATE INDEX IF NOT EXISTS idx_support_chat_mentor_email_notifications_profile
  ON public.support_chat_mentor_email_notifications(profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_chat_mentor_email_notifications_mentor
  ON public.support_chat_mentor_email_notifications(mentor_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_chat_mentor_email_notifications_message
  ON public.support_chat_mentor_email_notifications(message_id);

ALTER TABLE public.support_chat_mentor_email_notifications ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.support_chat_mentor_email_notifications FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_chat_mentor_email_notifications TO service_role;
