-- Fix application_fee_zelle_pending:
-- 1. Troca FK de scholarship_applications → institution_applications
-- 2. Renomeia coluna para institution_application_id
-- 3. Adiciona is_application_fee_paid em institution_applications

-- Passo 1: Dropar constraint FK antiga
ALTER TABLE application_fee_zelle_pending
  DROP CONSTRAINT IF EXISTS application_fee_zelle_pending_scholarship_application_id_fkey;

-- Passo 2: Renomear coluna
ALTER TABLE application_fee_zelle_pending
  RENAME COLUMN scholarship_application_id TO institution_application_id;

-- Passo 3: Adicionar nova FK para institution_applications
ALTER TABLE application_fee_zelle_pending
  ADD CONSTRAINT application_fee_zelle_pending_institution_application_id_fkey
  FOREIGN KEY (institution_application_id) REFERENCES institution_applications(id) ON DELETE CASCADE;

-- Passo 4: Adicionar is_application_fee_paid em institution_applications
ALTER TABLE institution_applications
  ADD COLUMN IF NOT EXISTS is_application_fee_paid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS application_fee_payment_method text;
