-- ============================================
-- MIGRAÇÃO: Corrigir Constraint de Status
-- ============================================
-- Execute este SQL no SQL Editor do Supabase Dashboard
-- Copie e cole tudo abaixo no SQL Editor e clique em "Run"
-- ============================================

-- Drop existing constraint if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'zelle_payments_status_check'
        AND conrelid = 'zelle_payments'::regclass
    ) THEN
        ALTER TABLE zelle_payments 
        DROP CONSTRAINT zelle_payments_status_check;
        RAISE NOTICE 'Constraint antiga removida';
    ELSE
        RAISE NOTICE 'Constraint não encontrada (será criada)';
    END IF;
END $$;

-- Add correct constraint
ALTER TABLE zelle_payments
ADD CONSTRAINT zelle_payments_status_check 
CHECK (status IN ('pending_verification', 'approved', 'rejected'));

-- Verificar se foi criada corretamente
SELECT 
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'zelle_payments'::regclass
  AND contype = 'c'
  AND conname = 'zelle_payments_status_check';
