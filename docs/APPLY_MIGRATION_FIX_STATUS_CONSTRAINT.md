# Aplicar Migração: Corrigir Constraint de Status do zelle_payments

## Problema
O erro `new row for relation "zelle_payments" violates check constraint "zelle_payments_status_check"` está ocorrendo mesmo quando o status é `"approved"`, que deveria ser válido.

## Solução
Execute este SQL no **SQL Editor** do Supabase Dashboard para corrigir a constraint:

```sql
-- Migration: Fix zelle_payments status constraint
-- This ensures the constraint matches the expected values

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
    END IF;
END $$;

-- Add correct constraint
ALTER TABLE zelle_payments
ADD CONSTRAINT zelle_payments_status_check 
CHECK (status IN ('pending_verification', 'approved', 'rejected'));
```

## Como Aplicar

1. Acesse o **Supabase Dashboard**
2. Vá em **SQL Editor**
3. Cole o SQL acima
4. Clique em **Run** ou pressione `Ctrl+Enter`
5. Verifique se a mensagem de sucesso aparece

## Verificação

Após aplicar, você pode verificar se a constraint foi criada corretamente:

```sql
SELECT 
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'zelle_payments'::regclass
  AND contype = 'c'
  AND conname = 'zelle_payments_status_check';
```

Deve retornar:
```
constraint_name: zelle_payments_status_check
constraint_definition: CHECK (status = ANY (ARRAY['pending_verification'::text, 'approved'::text, 'rejected'::text]))
```
