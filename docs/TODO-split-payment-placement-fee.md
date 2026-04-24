# TODO — Split Payment na Placement Fee Step

## 1. SQL (Supabase Dashboard — projeto Migma)

Rodar no SQL Editor do Supabase:

```sql
-- Expandir check constraint source para incluir placement_fee
ALTER TABLE split_payments DROP CONSTRAINT IF EXISTS split_payments_source_check;
ALTER TABLE split_payments ADD CONSTRAINT split_payments_source_check
  CHECK (source IN ('visa', 'migma', 'placement_fee'));

-- Adicionar coluna application_id
ALTER TABLE split_payments
  ADD COLUMN IF NOT EXISTS application_id UUID REFERENCES institution_applications(id);

-- Index para lookups por application_id
CREATE INDEX IF NOT EXISTS idx_split_payments_application_id
  ON split_payments(application_id)
  WHERE application_id IS NOT NULL;
```

---

## 2. Deploy Edge Functions

No terminal, dentro de `migma-lp/`:

```bash
supabase functions deploy parcelow-webhook
supabase functions deploy sync-to-matriculausa
```

> `migma-split-parcelow-checkout` não precisa de deploy — não foi alterado.

---

## 3. Verificação pós-deploy

### 3.1 Split Payment
1. Entrar no onboarding como aluno de teste
2. Ir até a step Placement Fee
3. Selecionar Parcelow (Cartão, PIX ou TED)
4. Conferir se `SplitPaymentSelector` aparece
5. Configurar split (ex: $900 + $900), inserir CPF → clicar Pagar
6. Verificar redirect para Parcelow Part 1
7. Após pagar Part 1 → testar redirect para Part 2
8. Após ambas pagas → conferir `institution_applications.status = 'payment_confirmed'`
9. Verificar que tela de sucesso aparece no onboarding

### 3.2 Sync placement_fee_amount correto
Re-sincronizar aluno `achucha5857@uorak.com` via admin e confirmar:
- `placement_fee_amount = $750` (base $350 + 4 dependentes × $100)
- Scholarship criada per-student (`is_active: false`) no MatriculaUSA

---

## 4. Pendente se necessário

- [ ] Verificar se `placement_fee_paid_at` existe em `institution_applications` — se não, adicionar:
  ```sql
  ALTER TABLE institution_applications
    ADD COLUMN IF NOT EXISTS placement_fee_paid_at TIMESTAMPTZ;
  ```
- [ ] Confirmar que realtime subscription no `PlacementFeeStep` detecta `status = 'payment_confirmed'` após webhook processar split completo
