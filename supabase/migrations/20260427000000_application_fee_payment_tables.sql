-- application_fee_stripe_sessions: maps Stripe session → scholarship_application
CREATE TABLE IF NOT EXISTS application_fee_stripe_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_session_id text NOT NULL UNIQUE,
  scholarship_application_id uuid NOT NULL REFERENCES scholarship_applications(id),
  profile_id uuid NOT NULL,
  amount_usd numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- application_fee_zelle_pending: Zelle comprovantes for application fee (taxa de matrícula)
CREATE TABLE IF NOT EXISTS application_fee_zelle_pending (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scholarship_application_id uuid NOT NULL REFERENCES scholarship_applications(id),
  profile_id uuid NOT NULL,
  migma_user_id uuid NOT NULL,
  amount_usd numeric NOT NULL,
  receipt_url text,
  n8n_payment_id text,
  n8n_response jsonb,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
