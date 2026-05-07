-- Add payment_submitted_at to user_profiles
-- Tracks the moment the client clicked "pay", regardless of confirmation status.
-- Used to redirect returning clients to Step 2 (documents) instead of Step 1 (payment).

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS payment_submitted_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN user_profiles.payment_submitted_at IS
  'Timestamp when the client submitted a payment (any method). Set immediately on pay click, before gateway confirmation or admin approval. Used to skip Step 1 on return.';
