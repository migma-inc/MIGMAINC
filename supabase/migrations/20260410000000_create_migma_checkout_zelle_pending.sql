-- Table to track Zelle payments from MigmaCheckout that require admin approval
-- before marking the student's selection_process_fee as paid in Matricula USA.
CREATE TABLE IF NOT EXISTS migma_checkout_zelle_pending (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  migma_user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_request_id TEXT,
  service_type      TEXT NOT NULL DEFAULT 'transfer',
  amount            NUMERIC NOT NULL,
  receipt_url       TEXT NOT NULL,
  image_path        TEXT,
  n8n_payment_id    TEXT,
  n8n_response      JSONB,
  n8n_confidence    NUMERIC,
  status            TEXT NOT NULL DEFAULT 'pending_verification'
                      CHECK (status IN ('pending_verification', 'approved', 'rejected')),
  admin_notes       TEXT,
  approved_at       TIMESTAMPTZ,
  approved_by       UUID REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_migma_checkout_zelle_pending_user
  ON migma_checkout_zelle_pending (migma_user_id);

CREATE INDEX IF NOT EXISTS idx_migma_checkout_zelle_pending_status
  ON migma_checkout_zelle_pending (status);

-- RLS
ALTER TABLE migma_checkout_zelle_pending ENABLE ROW LEVEL SECURITY;

-- Students can insert their own pending payment record
CREATE POLICY "Students insert own zelle pending"
  ON migma_checkout_zelle_pending FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = migma_user_id);

-- Students can read their own pending records
CREATE POLICY "Students read own zelle pending"
  ON migma_checkout_zelle_pending FOR SELECT TO authenticated
  USING (auth.uid() = migma_user_id);

-- Admins (service_role) can do everything — handled by supabase service role key
-- For anon/authenticated admins we rely on a separate admin check via the edge function.
-- The ZelleApprovalPage uses the authenticated client directly, so we allow updates
-- from authenticated users to support admin approval from the dashboard.
CREATE POLICY "Authenticated users can update zelle pending"
  ON migma_checkout_zelle_pending FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can select all zelle pending"
  ON migma_checkout_zelle_pending FOR SELECT TO authenticated
  USING (true);
