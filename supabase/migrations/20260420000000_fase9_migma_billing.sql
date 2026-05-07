-- Fase 9: Migma Billing Recorrente
-- Adiciona campos de controle em recurring_charges

ALTER TABLE public.recurring_charges
  ADD COLUMN IF NOT EXISTS application_id UUID REFERENCES public.institution_applications(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'cancelled', 'exempted')),
  ADD COLUMN IF NOT EXISTS next_billing_date DATE,
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_recurring_charges_application
  ON public.recurring_charges(application_id);

CREATE INDEX IF NOT EXISTS idx_recurring_charges_status
  ON public.recurring_charges(status);

-- Índice parcial para lookup rápido no cron
CREATE INDEX IF NOT EXISTS idx_recurring_charges_due
  ON public.recurring_charges(next_billing_date)
  WHERE status = 'active';
