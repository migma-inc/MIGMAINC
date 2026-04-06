-- Migration: Track part 2 split payment checkout emails
-- Description: Adds idempotent tracking fields for the immediate and reminder emails
-- Date: 2026-04-06

ALTER TABLE public.split_payments
  ADD COLUMN IF NOT EXISTS part2_checkout_email_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS part2_checkout_email_reminder_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS part2_checkout_email_send_count INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.split_payments.part2_checkout_email_sent_at IS
  'Timestamp of the first email sent to guide the client to the second split payment checkout';

COMMENT ON COLUMN public.split_payments.part2_checkout_email_reminder_sent_at IS
  'Timestamp of the automatic reminder email sent when the second split payment remains pending';

COMMENT ON COLUMN public.split_payments.part2_checkout_email_send_count IS
  'Total number of emails sent for the second split payment checkout flow';

CREATE INDEX IF NOT EXISTS idx_split_payments_part2_email_sent_at
  ON public.split_payments(part2_checkout_email_sent_at)
  WHERE part2_checkout_email_sent_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_split_payments_part2_email_reminder_sent_at
  ON public.split_payments(part2_checkout_email_reminder_sent_at)
  WHERE part2_checkout_email_reminder_sent_at IS NOT NULL;
