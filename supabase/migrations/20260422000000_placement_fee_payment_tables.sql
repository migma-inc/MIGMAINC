-- ============================================================
-- Placement Fee Payment Tables
-- Suporta pagamentos via Stripe e Zelle para o Placement Fee
-- do fluxo de onboarding V11 (alunos autenticados).
-- ============================================================

-- Mapeamento de sessões Stripe → application_id (para roteamento do webhook)
CREATE TABLE IF NOT EXISTS placement_fee_stripe_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_session_id text NOT NULL UNIQUE,
  application_id uuid NOT NULL,
  profile_id uuid NOT NULL,  -- = auth.users.id (institution_applications.profile_id)
  amount_usd numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',  -- pending | completed | expired
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE placement_fee_stripe_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students read own stripe sessions"
  ON placement_fee_stripe_sessions FOR SELECT TO authenticated
  USING (auth.uid() = profile_id);

CREATE POLICY "Service role full access stripe sessions"
  ON placement_fee_stripe_sessions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Comprovantes Zelle pendentes de aprovação para Placement Fee
CREATE TABLE IF NOT EXISTS migma_placement_fee_zelle_pending (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL,
  profile_id uuid NOT NULL,  -- = auth.users.id
  amount_usd numeric NOT NULL,
  receipt_url text,
  n8n_payment_id text,
  n8n_response jsonb,
  status text NOT NULL DEFAULT 'pending_verification',  -- pending_verification | approved | rejected
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE migma_placement_fee_zelle_pending ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students insert own placement zelle pending"
  ON migma_placement_fee_zelle_pending FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Students read own placement zelle pending"
  ON migma_placement_fee_zelle_pending FOR SELECT TO authenticated
  USING (auth.uid() = profile_id);

CREATE POLICY "Service role full access placement zelle pending"
  ON migma_placement_fee_zelle_pending FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Campo extra para metadados de pagamento em institution_applications
ALTER TABLE institution_applications ADD COLUMN IF NOT EXISTS payment_metadata jsonb;
