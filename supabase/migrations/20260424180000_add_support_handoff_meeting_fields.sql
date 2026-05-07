-- Track the scheduling link created when support escalates to a human.

ALTER TABLE public.support_handoffs
  ADD COLUMN IF NOT EXISTS meeting_url text,
  ADD COLUMN IF NOT EXISTS meeting_requested_at timestamptz;
