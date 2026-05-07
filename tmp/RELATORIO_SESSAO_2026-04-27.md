# Relatório de Sessão — 27/04/2026

## Resumo Geral

Sessão focada em correções no fluxo de sincronização Migma → MatriculaUSA e bugs de UI no onboarding do aluno.

---

## 1. Fix: `migma_seller_id` inválido quebrando insert em `scholarship_applications`

**Problema:** PASSO 5 do sync falhava com `invalid input syntax for type uuid: "tester"`.
O campo `profile.migma_seller_id` tinha o valor literal `"tester"` sendo passado como `seller_id` (coluna UUID) no payload de insert.

**Fix:** Adicionada validação de UUID antes de incluir `seller_id` no payload.

**Arquivo:** `supabase/functions/sync-to-matriculausa/index.ts` linha ~411
```typescript
const isValidUuid = (v: unknown) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
if (isValidUuid(profile.migma_seller_id)) applicationPayload.seller_id = profile.migma_seller_id;
else if (profile.migma_seller_id) console.warn(`... migma_seller_id inválido (não UUID): "${profile.migma_seller_id}" — ignorado.`);
```

---

## 2. Fix: `application_fee_amount` em `scholarship_applications` — tentativa e rollback

**Problema:** Tentamos adicionar `application_fee_amount` ao payload do STEP 5 para o banco do MatriculaUSA, mas a coluna não existia ainda.

**Erro:** `Could not find the 'application_fee_amount' column of 'scholarship_applications' in the schema cache`

**Ação:** Campo removido do payload enquanto aguardávamos confirmação do MatriculaUSA.

---

## 3. Investigação: $550 aparecendo em vez de $450 no dashboard MatriculaUSA

**Problema:** Dashboard do MatriculaUSA mostrava Application Fee = $550 para aluno com 1 dependente (correto seria $450 = 350 + 1×100).

**Causa raiz:** Sync anterior tinha rodado com `num_dependents` diferente (ou com fallback via `visa_orders` que foi removido em sessão anterior). O campo `scholarships.application_fee_amount` estava com valor antigo e o `scholarship_applications` não tinha o campo.

**Conclusão:** O dashboard lê de `scholarships.application_fee_amount`. O STEP 4 do sync já atualiza esse campo corretamente. Necessário redisparar o sync para corrigir alunos com valores antigos.

---

## 4. Proposta do MatriculaUSA: Individual Application Fee Tracking

**Proposta recebida:** MatriculaUSA propôs adicionar colunas para armazenar o fee individual por aluno:

```sql
-- No banco do MatriculaUSA:
ALTER TABLE public.scholarship_applications
  ADD COLUMN IF NOT EXISTS application_fee_amount numeric,
  ADD COLUMN IF NOT EXISTS application_fee_paid_at timestamptz;

ALTER TABLE public.user_fee_overrides
  ADD COLUMN IF NOT EXISTS application_fee numeric;
```

**Decisão arquitetural:** Escrever esses valores **durante o sync** (aprovação da bolsa), não no momento do pagamento. Motivo: durante o sync já conhecemos o `num_dependents` do aluno e calculamos o fee correto.

**Tabela `user_fee_overrides`:**
- FK: `user_id` → `auth.users.id` (confirmado pelo MatriculaUSA)
- Upsert com `onConflict: "user_id"`
- Campo: `application_fee numeric`

**Prioridade de exibição no dashboard MatriculaUSA:**
1. `scholarship_applications.application_fee_amount` (valor real por aluno)
2. `user_fee_overrides.application_fee` (override manual do admin)
3. Cálculo dinâmico padrão ($350 + dependentes × $100)

---

## 5. Implementação: STEP 4.5 no sync — upsert `user_fee_overrides`

**Arquivo:** `supabase/functions/sync-to-matriculausa/index.ts`

**Novo bloco inserido entre STEP 4 e STEP 5:**
```typescript
// ── STEP 4.5: Upsert user_fee_overrides com application_fee individual ────
if (remoteUserId) {
  const { error: overrideErr } = await matricula
    .from("user_fee_overrides")
    .upsert(
      { user_id: remoteUserId, application_fee: applicationFeeAmount },
      { onConflict: "user_id" }
    );
  if (overrideErr) {
    console.warn(`[SYNC-${executionId}] [PASSO 4.5] ⚠️ Erro ao upsert user_fee_overrides:`, overrideErr.message);
  } else {
    console.log(`[SYNC-${executionId}] [PASSO 4.5] ✅ user_fee_overrides atualizado.`);
  }
}
```

---

## 6. Fix: Permissão negada na sequence `user_fee_overrides_id_seq`

**Erro:** `permission denied for sequence user_fee_overrides_id_seq`

**Causa:** O `service_role` da Migma não tinha permissão de INSERT na tabela `user_fee_overrides` do MatriculaUSA (sequence bloqueada).

**Fix aplicado no MatriculaUSA:**
```sql
GRANT USAGE, SELECT ON SEQUENCE user_fee_overrides_id_seq TO service_role;
GRANT ALL ON TABLE public.user_fee_overrides TO service_role;
```

**Resultado após fix:** `[PASSO 4.5] ✅ user_fee_overrides atualizado.` — funcionando corretamente.

---

## Estado Final dos Arquivos Modificados

| Arquivo | Mudanças |
|---|---|
| `supabase/functions/sync-to-matriculausa/index.ts` | (1) Validação UUID para `migma_seller_id`; (2) STEP 4.5 upsert `user_fee_overrides` |
| `src/pages/StudentOnboarding/components/PlacementFeeStep.tsx` | Removida mensagem de contato pós-sucesso. |
| `src/pages/StudentOnboarding/components/PaymentStep.tsx` | Adicionado seletor de dono do cartão. |
| `supabase/functions/create-application-fee-checkout/index.ts` | Registro obrigatório em `migma_parcelow_pending`. |
| `supabase/functions/parcelow-webhook/index.ts` | Fallback robusto via ID Parcelow e sync manual para MatriculaUSA. |

---

## 7. UI Fix: Mensagem de contato após pagamento da Placement Fee

**Problema:** No passo de confirmação de pagamento da Placement Fee, aparecia o texto "Nossa equipe entrará em contato para iniciar o processo do I-20", que não deveria mais ser exibido para esses alunos.

**Fix:** Removido o parágrafo da mensagem de sucesso no componente.

**Arquivo:** `src/pages/StudentOnboarding/components/PlacementFeeStep.tsx`

---

## 8. Implementação: Seletor de Dono do Cartão ("Is this your card?")

**Problema:** Necessidade de identificar se o cartão utilizado no pagamento é do próprio aluno ou de terceiros para fins de conformidade e KYC.

**Ação:**
- Adicionado suporte ao campo `is_own_card` (booleano) nos Edge Functions de checkout.
- Adicionado seletor visual no componente de UI `PaymentStep.tsx` (Pre-onboarding Step 1).
- O valor é persistido na tabela de controle para auditoria posterior.

---

## 9. Rastreamento e Fallback de Pagamentos (Application Fee) via Parcelow

**Problema:** Pagamentos de Application Fee via Parcelow às vezes falhavam no processamento do webhook por falta de referência ou detecção inconsistente entre versões (Legacy vs V11).

**Solução:**
- **Registro Pendente:** Implementado registro obrigatório na tabela `migma_parcelow_pending` no `create-application-fee-checkout`.
- **Fallback Webhook:** Refinado o `parcelow-webhook` para utilizar o ID da ordem do Parcelow como chave de busca caso a referência falhe.
- **Paridade Stripe:** Sincronização automática com `public.payments` do MatriculaUSA no fluxo de fallback.
- **Prevenção de Redundância:** Webhook agora pula a invocação do `migma-payment-completed` para taxas de aplicação, evitando a geração desnecessária de contratos.

---

## Pendências

| Item | Status |
|---|---|
| `scholarship_applications.application_fee_amount` no MatriculaUSA | ⬜ Coluna ainda não confirmada — aguardar MatriculaUSA adicionar e confirmar |
| Deploy `sync-to-matriculausa` | ✅ Feito |
| Deploy `create-application-fee-checkout` | ✅ Feito (v7) |
| Deploy `parcelow-webhook` | ✅ Feito (v146) |
| Validar $750 para aluno com 4 dependentes no dashboard MatriculaUSA | ⬜ Pendente confirmação do usuário |

---

## Comandos de Deploy Executados

```bash
supabase functions deploy sync-to-matriculausa
supabase functions deploy create-application-fee-checkout
supabase functions deploy parcelow-webhook
```

---

## Contexto Técnico de Referência

- **Cálculo do fee:** `350 + num_dependents * 100` — fonte única: `user_profiles.num_dependents`
- **Fallback via `migma_parcelow_pending`:** agora é o método primário de recuperação quando a referência de metadados do Parcelow é perdida ou inconsistente.
- **Is_Application_Fee Check:** bloqueia fluxos de side-effects pesados (contratos/pdfs) que só devem ocorrer na Placement Fee ou Selection Process.
- **Slug mismatch Oikos:** Migma usa `oikos-university`, MatriculaUSA usa `oikos-university-los-angeles` → fallback por nome ILIKE implementado em sessão anterior.
