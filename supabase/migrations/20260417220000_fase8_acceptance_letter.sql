-- Fase 8: Acceptance Letter step + gate financeiro 2ª parcela

-- 1. Adicionar acceptance_letter ao CHECK constraint de onboarding_current_step
ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_onboarding_current_step_check;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_onboarding_current_step_check
  CHECK (
    onboarding_current_step IS NULL
    OR onboarding_current_step = ANY (ARRAY[
      'selection_fee',
      'identity_verification',
      'selection_survey',
      'scholarship_selection',
      'process_type',
      'documents_upload',
      'payment',
      'scholarship_fee',
      'placement_fee',
      'reinstatement_fee',
      'my_applications',
      'acceptance_letter',
      'completed',
      'awaiting_client_data',
      'welcome_email_failed'
    ])
  );

-- 2. Coluna para rastrear 2ª parcela do Placement Fee
ALTER TABLE public.institution_applications
  ADD COLUMN IF NOT EXISTS placement_fee_2nd_installment_paid_at TIMESTAMPTZ;

-- 3. Coluna para URL da carta de aceite / I-20 (emitida pelo MatriculaUSA no futuro)
ALTER TABLE public.institution_applications
  ADD COLUMN IF NOT EXISTS acceptance_letter_url TEXT;
