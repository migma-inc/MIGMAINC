-- Align V11 Migma recurring billing with section 15.
-- This migration keeps recurring_charges as the V11 source of truth and adds
-- installment-level state so gateway webhooks can close the billing loop.

ALTER TABLE public.institution_applications
  ADD COLUMN IF NOT EXISTS acceptance_letter_received_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cos_approved_at TIMESTAMPTZ;

UPDATE public.institution_applications
SET acceptance_letter_received_at = COALESCE(package_sent_at, created_at)
WHERE acceptance_letter_url IS NOT NULL
  AND acceptance_letter_received_at IS NULL;

ALTER TABLE public.recurring_charges
  DROP CONSTRAINT IF EXISTS recurring_charges_status_check;

ALTER TABLE public.recurring_charges
  ADD CONSTRAINT recurring_charges_status_check
  CHECK (status IN ('active', 'suspended', 'cancelled', 'exempted', 'completed'));

DROP POLICY IF EXISTS "Users can view their own recurring charges" ON public.recurring_charges;

CREATE POLICY "Users can view their own recurring charges"
  ON public.recurring_charges
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.id = recurring_charges.profile_id
        AND up.user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS public.recurring_charge_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  charge_id UUID NOT NULL REFERENCES public.recurring_charges(id) ON DELETE CASCADE,
  application_id UUID REFERENCES public.institution_applications(id) ON DELETE SET NULL,
  profile_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL CHECK (installment_number > 0),
  amount_usd NUMERIC NOT NULL CHECK (amount_usd >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  provider TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'failed', 'cancelled')),
  due_date DATE NOT NULL,
  payment_link_url TEXT,
  provider_payment_link_id TEXT,
  provider_order_id TEXT,
  provider_payment_id TEXT,
  provider_receipt_url TEXT,
  paid_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (charge_id, installment_number)
);

CREATE INDEX IF NOT EXISTS idx_recurring_charge_payments_charge
  ON public.recurring_charge_payments(charge_id);

CREATE INDEX IF NOT EXISTS idx_recurring_charge_payments_provider_order
  ON public.recurring_charge_payments(provider_order_id)
  WHERE provider_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_recurring_charge_payments_status_due
  ON public.recurring_charge_payments(status, due_date);

ALTER TABLE public.recurring_charge_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own recurring charge payments" ON public.recurring_charge_payments;

CREATE POLICY "Users can view their own recurring charge payments"
  ON public.recurring_charge_payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.id = recurring_charge_payments.profile_id
        AND up.user_id = auth.uid()
    )
  );

GRANT SELECT ON public.recurring_charges TO authenticated;
GRANT SELECT ON public.recurring_charge_payments TO authenticated;
