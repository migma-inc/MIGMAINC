# Supabase Deploy — Placement Fee Multi-Payment

Checklist de tudo que precisa ser executado no Supabase (via MCP ou CLI).

---

## 1. Migrations (DB)

### 1.1 Criar tabelas de pagamento

**Arquivo:** `supabase/migrations/20260422000000_placement_fee_payment_tables.sql`

Cria:
- `placement_fee_stripe_sessions` — mapeia `stripe_session_id → application_id` para o webhook rotear
- `migma_placement_fee_zelle_pending` — comprovantes Zelle aguardando aprovação manual
- `ALTER TABLE institution_applications ADD COLUMN IF NOT EXISTS payment_metadata jsonb`

**Via MCP:**
```
supabase db push
```
ou executar o SQL diretamente no painel Supabase → SQL Editor.

**Verificar após:**
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('placement_fee_stripe_sessions', 'migma_placement_fee_zelle_pending');
```

---

### 1.2 Criar bucket de armazenamento para comprovantes Zelle

O upload de comprovantes Zelle usa o bucket `migma-placement-receipts`.
Se não existir, criar via painel Supabase → Storage → New Bucket:

- **Nome:** `migma-placement-receipts`
- **Público:** Sim (para gerar publicUrl)
- **Allowed MIME types:** `image/png, image/jpeg, application/pdf`

Ou via SQL:
```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('migma-placement-receipts', 'migma-placement-receipts', true)
ON CONFLICT (id) DO NOTHING;
```

**Policy para upload autenticado:**
```sql
CREATE POLICY "Students upload own zelle receipts"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'migma-placement-receipts' AND (storage.foldername(name))[1] = 'zelle');

CREATE POLICY "Public read placement receipts"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'migma-placement-receipts');
```

---

## 2. Edge Functions (Deploy)

### 2.1 Nova função: `create-placement-fee-checkout`

**Arquivo:** `supabase/functions/create-placement-fee-checkout/index.ts`

O que faz:
- Valida JWT do aluno autenticado
- Verifica ownership da application_id
- Cria checkout Parcelow (card/pix/ted) com referência `MIGMA-PF-APP-{applicationId}`
- Cria sessão Stripe e grava em `placement_fee_stripe_sessions`

**Deploy:**
```bash
supabase functions deploy create-placement-fee-checkout
```

**Env vars necessárias** (já devem existir, confirmar):
- `SUPABASE_URL` ✓
- `SUPABASE_SERVICE_ROLE_KEY` ✓
- `SUPABASE_ANON_KEY` ← verificar se está definida como secret
- `PARCELOW_CLIENT_ID_STAGING` / `PARCELOW_CLIENT_ID_PRODUCTION`
- `PARCELOW_CLIENT_SECRET_STAGING` / `PARCELOW_CLIENT_SECRET_PRODUCTION`
- `STRIPE_SECRET_KEY_TEST` / `STRIPE_SECRET_KEY`

**Verificar SUPABASE_ANON_KEY:**
```bash
supabase secrets list
```
Se não estiver, adicionar:
```bash
supabase secrets set SUPABASE_ANON_KEY=<valor_da_anon_key>
```

---

### 2.2 Função atualizada: `stripe-visa-webhook`

**Arquivo:** `supabase/functions/stripe-visa-webhook/index.ts`

O que mudou: adicionado fallback após lookup de `visa_orders` falhar — verifica `placement_fee_stripe_sessions` e chama `migma-payment-completed(fee_type=placement_fee)`.

**Deploy:**
```bash
supabase functions deploy stripe-visa-webhook
```

---

## 3. Verificação pós-deploy

### 3.1 Teste Parcelow (card/pix/ted)

1. Admin aprova bolsa (não $0) de aluno de teste
2. Aluno entra na PlacementFeeStep
3. Seleciona "Cartão de Crédito", digita CPF, clica "Pagar"
4. Deve redirecionar para Parcelow
5. Após pagamento no sandbox Parcelow:
   - `institution_applications.status` → `payment_confirmed`
   - `user_profiles.is_placement_fee_paid` → `true`
   - Aluno avança para próximo step automaticamente

**Checar logs:**
```
supabase functions logs parcelow-webhook
supabase functions logs create-placement-fee-checkout
supabase functions logs migma-payment-completed
```

### 3.2 Teste Stripe

1. Mesmo fluxo, selecionar "Cartão Internacional"
2. Redireciona para Stripe Checkout
3. Após pagamento:
   - `placement_fee_stripe_sessions.status` → `completed`
   - `institution_applications.status` → `payment_confirmed`

**Checar logs:**
```
supabase functions logs stripe-visa-webhook
supabase functions logs migma-payment-completed
```

### 3.3 Teste Zelle

1. Selecionar "Zelle", clicar no campo de upload, selecionar arquivo
2. Clicar "Enviar Comprovante"
3. Verificar no banco:
```sql
SELECT * FROM migma_placement_fee_zelle_pending ORDER BY created_at DESC LIMIT 5;
```
4. Tela deve mudar para "Comprovante Enviado — aguardando confirmação"

### 3.4 Teste $0 fee (Nível 1)

1. Admin aprova bolsa com `placement_fee_usd = 0`
2. Aluno vê botão "Confirmar Vaga" (sem seletor de método)
3. Clica → avança direto

---

## 4. Ordem de execução recomendada

```
1. supabase db push                                         # migration tables
2. Criar bucket migma-placement-receipts (se não existir)  # storage
3. supabase secrets set SUPABASE_ANON_KEY=...              # se não estiver
4. supabase functions deploy create-placement-fee-checkout  # nova função
5. supabase functions deploy stripe-visa-webhook            # função atualizada
```

---

## 5. Rollback (se necessário)

- **stripe-visa-webhook:** A mudança é apenas um bloco `if (!pfSession)` extra — não quebra o fluxo existente de visa_orders.
- **create-placement-fee-checkout:** Função nova, só afeta PlacementFeeStep. Deletar se necessário:
  ```bash
  supabase functions delete create-placement-fee-checkout
  ```
- **Migration:** Tabelas novas, não altera nada existente. DROP seguro:
  ```sql
  DROP TABLE IF EXISTS placement_fee_stripe_sessions;
  DROP TABLE IF EXISTS migma_placement_fee_zelle_pending;
  ALTER TABLE institution_applications DROP COLUMN IF EXISTS payment_metadata;
  ```
