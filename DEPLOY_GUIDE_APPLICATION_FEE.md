# Guia de Deploy — Taxa de Matrícula (Application Fee)

> **Secrets já adicionadas pelo usuário.** Este guia cobre tudo mais que precisa ser feito para colocar o fluxo em produção.

---

## PASSO 1 — Rodar a Migration no Supabase (Migma)

**Arquivo:** `supabase/migrations/20260427000000_application_fee_payment_tables.sql`

Cria duas tabelas na Migma:
- `application_fee_stripe_sessions` — mapeia Stripe session → scholarship_application
- `application_fee_zelle_pending` — registra comprovantes Zelle pendentes

```bash
# Via CLI Supabase (no diretório do projeto):
supabase db push

# OU via Supabase Dashboard:
# SQL Editor → colar o conteúdo do arquivo → Run
```

---

## PASSO 2 — Verificar / Criar Colunas no MatriculaUSA

Verificar se a tabela `scholarship_applications` do **projeto MatriculaUSA** já tem:
- `application_fee_payment_method text`
- `application_fee_paid_at timestamptz`

Se NÃO existirem, rodar **no SQL Editor do Supabase do MatriculaUSA**:

```sql
ALTER TABLE scholarship_applications
  ADD COLUMN IF NOT EXISTS application_fee_payment_method text,
  ADD COLUMN IF NOT EXISTS application_fee_paid_at timestamptz;
```

> ⚠️ Isso é uma migration no **MatriculaUSA**, não na Migma. Precisa de acesso ao dashboard do MatriculaUSA (`fitpynguasqqutuhzifx`).

---

## PASSO 3 — Deploy das Edge Functions (Migma Supabase)

```bash
# Funções NOVAS:
supabase functions deploy create-application-fee-checkout
supabase functions deploy matriculausa-stripe-webhook
supabase functions deploy matriculausa-split-parcelow-checkout

# Funções MODIFICADAS (routing MatriculaUSA + sync):
supabase functions deploy parcelow-webhook
```

> **Alternativa via GitHub Actions:** fazer push para o branch principal dispara o deploy automaticamente.

---

## PASSO 4 — Registrar Webhook no Stripe Dashboard (Conta MatriculaUSA)

Acessar o **Stripe Dashboard da conta MatriculaUSA** (não da Migma):

1. **Developers → Webhooks → Add endpoint**
2. URL do endpoint:
   ```
   https://ekxftwrjvxtpnqbraszv.supabase.co/functions/v1/matriculausa-stripe-webhook
   ```
3. Eventos a escutar:
   - `checkout.session.completed`
4. Após criar, copiar o **Signing Secret** gerado pelo Stripe
5. Adicionar como secret no Supabase **Migma**:
   - `MATRICULAUSA_STRIPE_WEBHOOK_SECRET_TEST` → webhook do ambiente **Test mode**
   - `MATRICULAUSA_STRIPE_WEBHOOK_SECRET_PROD` → webhook do ambiente **Live mode**

> ⚠️ Criar **dois webhooks separados** (um em Test mode, um em Live mode). Cada um tem seu próprio signing secret.

---

## PASSO 5 — Checklist de Secrets no Supabase (Migma)

Confirmar em **Settings → Edge Functions → Secrets**:

| Secret | Status |
|---|---|
| `MATRICULAUSA_STRIPE_SECRET_KEY_TEST` | ✅ já adicionado |
| `MATRICULAUSA_STRIPE_SECRET_KEY_PROD` | ✅ já adicionado |
| `MATRICULAUSA_STRIPE_WEBHOOK_SECRET_TEST` | ⬜ adicionar após Passo 4 |
| `MATRICULAUSA_STRIPE_WEBHOOK_SECRET_PROD` | ⬜ adicionar após Passo 4 |
| `MATRICULAUSA_PARCELOW_CLIENT_ID_STAGING` | ✅ já adicionado |
| `MATRICULAUSA_PARCELOW_CLIENT_SECRET_STAGING` | ✅ já adicionado |
| `MATRICULAUSA_PARCELOW_CLIENT_ID_PRODUCTION` | ✅ já adicionado |
| `MATRICULAUSA_PARCELOW_CLIENT_SECRET_PRODUCTION` | ✅ já adicionado |
| `MATRICULAUSA_URL` | ✅ já existe (usado pelo sync-to-matriculausa) |
| `MATRICULAUSA_SERVICE_ROLE` | ✅ já existe (usado pelo sync-to-matriculausa) |

---

## PASSO 6 — Parcelow Webhook (nenhuma config extra necessária)

A `notify_url` passada na criação do pedido já aponta para:
```
https://ekxftwrjvxtpnqbraszv.supabase.co/functions/v1/parcelow-webhook
```

O routing é feito por prefixo de referência (`MATRICULAUSA-AF-APP-`). Nenhuma configuração adicional é necessária no Parcelow.

---

## PASSO 7 — Verificar `matricula_user_id` populado antes da step `payment`

Para que o sync ao MatriculaUSA funcione, o aluno precisa ter sido sincronizado previamente via `sync-to-matriculausa` (que preenche `user_profiles.matricula_user_id` na Migma).

**Verificar:** o fluxo de aprovação de bolsa que chama `sync-to-matriculausa` está funcionando e preenchendo `matricula_user_id` antes do aluno chegar na step `payment`.

Se `matricula_user_id` for `null`, o sync usa fallback por `email`. Se o email também não encontrar match, o sync loga um warning mas **não falha** — a confirmação local (Migma) já foi feita.

---

## PASSO 8 — Teste End-to-End

### Stripe (Test Mode)
1. Acesse `/student/onboarding?step=payment` com aluno que tem `scholarship_applications`
2. Selecione **Cartão de Crédito**
3. Card de teste: `4242 4242 4242 4242` / exp: qualquer / cvv: qualquer
4. Confirmar redirect `?af_return=success` ao voltar
5. Verificar no Supabase Migma: `scholarship_applications.is_application_fee_paid = true`
6. Verificar no Supabase MatriculaUSA: mesmo campo + `application_fee_payment_method = 'stripe'` + `application_fee_paid_at`
7. Step indicator avança para `documents_upload`

### Parcelow (Staging)
1. Selecione **Parcelow — Cartão**, insira CPF válido
2. Completar no ambiente sandbox da Parcelow
3. Verificar webhook `parcelow-webhook` processou referência `MATRICULAUSA-AF-APP-{id}`
4. Verificar Migma + MatriculaUSA atualizados

### Parcelow Split
1. Selecione Parcelow, CPF → SplitPaymentSelector aparece → configurar split
2. Completar P1 → redirect para P2 → completar P2
3. Verificar `split_payments.overall_status = 'fully_completed'`
4. Verificar Migma + MatriculaUSA atualizados

### Zelle
1. Selecione **Zelle**
2. Confirmar UI mostra `pay@matriculausa.com` (não `adm@migmainc.com`)
3. Fazer upload de comprovante
4. Verificar registro em `application_fee_zelle_pending` na Migma

### Isolamento de Keys
- Confirmar nos logs do Supabase que as novas functions usam `MATRICULAUSA_STRIPE_SECRET_KEY_*` e `MATRICULAUSA_PARCELOW_CLIENT_ID/SECRET_*` — e não as keys Migma

---

## Resumo dos Arquivos

| Arquivo | Tipo | O que faz |
|---|---|---|
| `supabase/migrations/20260427000000_application_fee_payment_tables.sql` | NOVO | Tabelas `application_fee_stripe_sessions` e `application_fee_zelle_pending` |
| `supabase/functions/create-application-fee-checkout/index.ts` | NOVO | Cria checkout Stripe/Parcelow com keys MatriculaUSA |
| `supabase/functions/matriculausa-stripe-webhook/index.ts` | NOVO | Recebe confirmação Stripe + atualiza Migma + sync MatriculaUSA |
| `supabase/functions/matriculausa-split-parcelow-checkout/index.ts` | NOVO | Split payment Parcelow com keys MatriculaUSA |
| `supabase/functions/parcelow-webhook/index.ts` | MODIFICADO | Routing `MATRICULAUSA-AF-APP-` + sync MatriculaUSA (normal + split) |
| `src/features/visa-checkout/components/steps/step3/ZelleUpload.tsx` | MODIFICADO | Prop `recipientEmail` configurável |
| `src/pages/StudentOnboarding/components/PaymentStep.tsx` | MODIFICADO | Lógica completa com todos os métodos + Zelle MatriculaUSA |
| `src/pages/StudentOnboarding/components/StepIndicator.tsx` | MODIFICADO | Removido alias errado `payment: 'my_applications'` |
| `src/locales/pt.json` | MODIFICADO | `placement_fee` → "Taxa de Colocação", `payment` → "Taxa de Matrícula" |
