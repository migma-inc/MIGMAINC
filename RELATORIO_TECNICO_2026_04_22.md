# Relatório Técnico Diário — 22/04/2026

**Sessão:** Migma V11 — Placement Fee Multi-Payment + Bug Crítico de Ordens Acidentais
**Ambiente:** `ekxftwrjvxtpnqbraszv.supabase.co` (Production)

---

## 1. Correção da Discrepância Financeira do Stripe (Gross vs Net)

### Problema
Pagamentos via Stripe para alunos autenticados eram registrados no banco com o valor líquido (Net), ignorando as taxas do Stripe. Causava inconsistências no dashboard financeiro.

### Causa Raiz
`handleStripeReturn` em `MigmaCheckout/index.tsx` lia o valor do `localStorage` (salvo antes do redirect) e enviava para `migma-payment-completed` como total. A função `calculateOrderAmounts` do dashboard aplicava uma taxa fixa de 3.5% sobre esse valor líquido, gerando cálculo incorreto.

### Solução Implementada

**1. Nova rota GET em `migma-student-stripe-checkout`:**
- Endpoint GET recebe `session_id` e consulta a API do Stripe
- Retorna valores reais: `gross_amount_usd`, `net_amount_usd`, `fee_amount_usd`

**2. `MigmaCheckout/index.tsx` — `handleStripeReturn`:**
- Antes de finalizar, busca valores reais via GET com o `session_id` da URL
- Envia `amount` (Gross), `net_amount` e `fee_amount` para `migma-payment-completed`

**3. `migma-payment-completed`:**
- Aceita `net_amount` e `fee_amount` no payload
- Constrói `payment_metadata` com decomposição exata e salva em `visa_orders`

**4. `stripe-visa-webhook`:**
- Extrai `amount_total` real (Gross) dos eventos do Stripe
- Calcula e registra `payment_metadata` com precisão

### Validação
Testado com `brendan7859@uorak.com`: Gross = $883.45, Fee = $33.45, Net = $850.00 — refletido corretamente no Dashboard.

---

## 2. Placement Fee — Sistema Multi-Pagamento (Feature Completa)

### Contexto
Antes: `PlacementFeeStep` exibia um `payment_link_url` estático configurado pelo admin (link manual para Parcelow). Sem suporte a múltiplos métodos, sem tratamento de bolsa $0.

### Objetivo
Pagamento automatizado com seleção inline de método: Parcelow (Card/PIX/TED), Stripe, Zelle. Aluno está **autenticado** (JWT via `StudentAuthContext`) — diferente do MigmaCheckout que é anônimo.

### Arquitetura Implementada

```
PlacementFeeStep (frontend autenticado)
  └─ seletor de método inline
       ├─ Parcelow card/pix/ted  → create-placement-fee-checkout → Parcelow API
       ├─ Stripe                  → create-placement-fee-checkout → Stripe Checkout
       └─ Zelle                   → upload direto + migma_placement_fee_zelle_pending

Webhooks (sem alteração necessária no parcelow-webhook):
  parcelow-webhook  → detecta -APP-{appId} → migma-payment-completed(fee_type=placement_fee)
  stripe-visa-webhook → fallback novo → placement_fee_stripe_sessions → migma-payment-completed
```

### Arquivos Criados / Modificados

#### 2.1 `supabase/migrations/20260422000000_placement_fee_payment_tables.sql` (NOVO)

Cria duas tabelas com RLS completo:

```sql
-- Mapeamento sessão Stripe → application_id para webhook rotear
CREATE TABLE placement_fee_stripe_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_session_id text NOT NULL UNIQUE,
  application_id uuid NOT NULL,
  profile_id uuid NOT NULL,   -- = auth.users.id (para RLS com auth.uid())
  amount_usd numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
-- RLS: estudantes leem próprias sessões; service_role acesso total

-- Comprovantes Zelle aguardando aprovação manual
CREATE TABLE migma_placement_fee_zelle_pending (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  amount_usd numeric NOT NULL,
  receipt_url text,
  n8n_payment_id text,
  n8n_response jsonb,
  status text NOT NULL DEFAULT 'pending_verification',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- RLS: estudantes INSERT/SELECT próprios; service_role acesso total

ALTER TABLE institution_applications ADD COLUMN IF NOT EXISTS payment_metadata jsonb;
```

#### 2.2 `supabase/functions/create-placement-fee-checkout/index.ts` (NOVO)

Edge function JWT-validada e com verificação de ownership:

**Fluxo:**
1. **JWT validation** — extrai Bearer token, cria client user-scoped, chama `auth.getUser()`
2. **Ownership check** — busca `user_profiles.id` via `user_id = auth_user.id`; compara com `app.profile_id` (evita que aluno X pague application do aluno Y)
3. **Status check** — só processa `payment_pending` ou `approved`
4. Branch por método:
   - **Parcelow**: referência `MIGMA-PF-APP-{application_id}` (parcelow-webhook detecta via split em `-APP-`)
   - **Stripe**: cria sessão + INSERT em `placement_fee_stripe_sessions` para webhook rotear
5. Retorna `{ checkout_url }` ou `{ checkout_url, session_id }`

**Ponto crítico descoberto e corrigido:** `institution_applications.profile_id` = `user_profiles.id` (UUID de perfil), **NÃO** `auth.users.id`. A comparação `app.profile_id !== user.id` estava incorreta — corrigida para buscar `myProfile.id` via `user_profiles WHERE user_id = auth_user.id` e então comparar.

#### 2.3 `supabase/functions/stripe-visa-webhook/index.ts` (MODIFICADO)

Adicionado fallback após lookup de `visa_orders` não encontrar resultado:

```ts
// Quando não há visa_order para o session_id:
const { data: pfSession } = await supabase
  .from('placement_fee_stripe_sessions')
  .select('application_id, profile_id, amount_usd, status')
  .eq('stripe_session_id', session.id)
  .maybeSingle();

if (pfSession) {
  if (pfSession.status === 'completed') return; // idempotência
  await supabase.from('placement_fee_stripe_sessions')
    .update({ status: 'completed' })
    .eq('stripe_session_id', session.id);
  await supabase.functions.invoke('migma-payment-completed', {
    body: {
      user_id: pfSession.profile_id,
      fee_type: 'placement_fee',
      amount: pfSession.amount_usd,
      payment_method: 'stripe',
      service_type: 'v11-onboarding',
      application_id: pfSession.application_id,
    },
  });
  return;
}
```

#### 2.4 `src/pages/StudentOnboarding/components/PlacementFeeStep.tsx` (REFATORADO)

- **5 métodos de pagamento**: parcelow_card, parcelow_pix, parcelow_ted, stripe, zelle
- **`selectedMethod` começa como `null`** (sem pré-seleção — diferente do MigmaCheckout)
- CPF field aparece para métodos Parcelow
- `handleProcessPayment` chama `create-placement-fee-checkout` via `supabase.functions.invoke()` — JWT é encaminhado automaticamente pelo client autenticado
- Zelle: upload de comprovante + INSERT em `migma_placement_fee_zelle_pending` (RLS valida `auth.uid() = profile_id`)
- Detecção de retorno via parâmetros URL (`pf_return`, `session_id`)
- Path $0 (bolsa gratuita): `handleConfirmZeroFee` preservado intacto
- **Bug de ordenação de hooks corrigido**: `useMemo` para `activeApp` e `placementFee` movidos para **antes** dos callbacks que os referenciam

#### 2.5 `SUPABASE_DEPLOY.md` (NOVO)

Checklist completo de tudo que precisa ser executado no Supabase:
- SQL da migration e como aplicar
- Criação do bucket `migma-placement-receipts` + policies
- Secrets necessários (`SUPABASE_ANON_KEY`, Parcelow, Stripe)
- Comandos de deploy das edge functions
- SQL de verificação pós-deploy
- Comandos de rollback completos

---

## 3. Bug Crítico — Ordens Parcelow Acidentais no MigmaCheckout Step 1

### Relato Inicial
Ordem Parcelow #12742 criada para `eliane2584@uorak.com` durante teste com Stripe. Aluno não selecionou Parcelow em nenhum momento.

### Investigação

**Causa raiz identificada:** `useState<PaymentMethod>('parcelow_card')` em `Step1PersonalInfo.tsx` pré-seleciona Parcelow por padrão. Ao submeter o formulário sem trocar o método, a aplicação criava uma ordem real na Parcelow em produção.

**Restrição de negócio:** Não é possível remover a pré-seleção de Parcelow. O motivo: os componentes de UI de titularidade do cartão (próprio/terceiro), o campo CPF, e o `SplitPaymentSelector` só aparecem quando `method === 'parcelow_card'`. Remover a pré-seleção quebraria toda a experiência visual do checkout.

### Primeira Tentativa de Correção — Modal de Confirmação

Implementado modal de confirmação interceptando o submit antes de criar a ordem Parcelow:

```ts
// handleSubmit — intercepta Parcelow antes da chamada à API
if (isParcelow || isSplitEnabled) {
  setPendingSubmitPayload({ form, userId, total, payment });
  setShowParcelowConfirm(true);
  return; // NÃO chama API ainda
}
// Stripe/Zelle: prossegue direto
await doSubmit(userId, form, total, payment);
```

Modal exibia método, valor e e-mail com botões "Cancelar" e "Confirmar →".

### Problema Persistente — Ordem #12743

Novo teste com `aracelis3164@uorak.com` gerou Ordem #12743 ($1,099.06). O modal estava presente no código, mas a ordem foi criada mesmo assim — o usuário viu o modal e clicou "Confirmar" (intencionalmente ou não), e a ordem Parcelow foi gerada.

**Conclusão:** O modal de confirmação reduz mas não elimina o risco de ordens acidentais — o fluxo de registro + confirmação no mesmo submit ainda cria pressão psicológica para o usuário confirmar sem entender que está criando uma ordem de $1.000+ no Parcelow.

### Correção Definitiva — Separação de Registro e Pagamento

**Princípio:** `handleSubmit` nunca mais cria uma ordem de pagamento. Registro e pagamento são etapas separadas com ações explícitas distintas.

**Implementação em `Step1PersonalInfo.tsx`:**

**Estados adicionados:**
```ts
const [regDone, setRegDone] = useState(!!existingUserId);
const [regUserId, setRegUserId] = useState<string | null>(existingUserId || null);
```

**`handleSubmit` — SOMENTE cria conta:**
```ts
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!validate()) return;

  if (existingUserId) {
    setRegDone(true);
    setRegUserId(existingUserId);
    return;
  }

  setSaving(true);
  try {
    const uid = await onRegisterUser(...);
    setRegUserId(uid);
    setRegDone(true); // avança para tela de pagamento
  } catch (err) { ... } finally { setSaving(false); }
};
```

**`handlePayNow` — NOVO — inicia pagamento explicitamente:**
```ts
const handlePayNow = async () => {
  if (!regUserId) return;
  const payment = { method, receipt, cardOwnership, cpf, payerInfo };

  if (isParcelow || isSplitEnabled) {
    setPendingSubmitPayload({ form, userId: regUserId, total, payment });
    setShowParcelowConfirm(true); // modal ainda existe para confirmação final
    return;
  }
  await doSubmit(regUserId, form, total, payment);
};
```

**UX resultante:**

| Estado | Botão visível | O que acontece |
|--------|--------------|----------------|
| `regDone = false` | "Criar Conta →" | Só registra o usuário |
| `regDone = true` | Banner verde "Conta criada!" + "Pagar com Cartão (Parcelow) — $1000 →" | Inicia pagamento explicitamente |
| Parcelow selecionado + Pay clicado | Modal: "Tudo certo? Confirmar →" | Cria ordem Parcelow |

**Seção de pagamento fica visualmente bloqueada** (`opacity-40 pointer-events-none`) antes da conta ser criada — reforço visual de que pagamento é etapa separada.

**Pré-seleção visual preservada:** `method` continua como `'parcelow_card'` por padrão — CPF, card-owner UI e SplitPaymentSelector continuam aparecendo corretamente.

**Resultado:** Ordem Parcelow requer **dois cliques explícitos**: botão "Pagar com Parcelow" + botão "Confirmar →" no modal. Impossível criar acidentalmente ao testar registro.

---

## 4. Resumo dos Arquivos Modificados

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `supabase/migrations/20260422000000_placement_fee_payment_tables.sql` | NOVO | Tabelas `placement_fee_stripe_sessions` e `migma_placement_fee_zelle_pending` com RLS |
| `supabase/functions/create-placement-fee-checkout/index.ts` | NOVO | Edge function JWT-validada para multi-payment da Placement Fee |
| `supabase/functions/stripe-visa-webhook/index.ts` | MODIFICADO | Fallback para `placement_fee_stripe_sessions` quando não há `visa_order` |
| `src/pages/StudentOnboarding/components/PlacementFeeStep.tsx` | REFATORADO | Seletor de 5 métodos de pagamento, Zelle upload, retorno de redirect |
| `src/pages/MigmaCheckout/components/Step1PersonalInfo.tsx` | MODIFICADO | Separação de registro e pagamento; `handlePayNow` explícito |
| `SUPABASE_DEPLOY.md` | NOVO | Checklist completo de deploy no Supabase |

---

## 5. Deploy Pendente

Executar na ordem:

```bash
# 1. Aplicar migration de tabelas
supabase db push

# 2. Criar bucket de comprovantes (se não existir)
# Via painel Supabase → Storage → New Bucket: migma-placement-receipts (público)

# 3. Verificar/adicionar secret
supabase secrets list
supabase secrets set SUPABASE_ANON_KEY=<valor>

# 4. Deploy das edge functions
supabase functions deploy create-placement-fee-checkout
supabase functions deploy stripe-visa-webhook
```

Frontend (`Step1PersonalInfo.tsx` e `PlacementFeeStep.tsx`) já compilado sem erros TypeScript — deploy via processo normal de build do projeto.

---

## 6. Pendências e Próximos Passos

- [ ] Cancelar ordens Parcelow de teste #12742 (`eliane2584@uorak.com`) e #12743 (`aracelis3164@uorak.com`) no painel Parcelow
- [ ] Executar deploy completo (migration + functions + frontend)
- [ ] Teste E2E do fluxo PlacementFeeStep: Parcelow Card, PIX, TED, Stripe, Zelle
- [ ] Teste do novo fluxo MigmaCheckout Step 1: verificar que submit só registra conta e nunca cria ordem Parcelow automaticamente
- [ ] Aprovação manual de comprovantes Zelle (painel admin — feature futura)

---

**Status da Sessão:** ✅ Finalizada com Sucesso
**TypeScript:** 0 erros em todos os arquivos modificados

---

## Anexo vindo da main durante merge 2026-05-04

# Relatório Técnico - 2026-04-22

## Atividades Realizadas

### TASK: Filtragem de Dados de Teste @uorak
- **Descrição**: Implementação de filtro global para ocultar pedidos associados ao domínio `@uorak.com` no ambiente de produção.
- **Arquivos Modificados**:
  - `src/pages/VisaOrdersPage.tsx`: Adicionado filtro no `buildOrdersQuery`.
  - `src/pages/admin/AdminTracking.tsx`: Adicionado filtro no `loadData` e definição de `isLocal`.
  - `src/pages/ZelleApprovalPage.tsx`: Adicionado filtro no `loadOrders` (pendentes e histórico).
  - `src/pages/admin/AdminSellerOrders.tsx`: Adicionado filtro no `loadOrders` e definição de `isLocal`.
- **Banco de Dados**:
  - Exclusão do pedido de teste remanescente `MIGMA-TRANSFER-645248`.

### Outras Correções
- Limpeza de registros de teste solicitados pelo usuário.
- Verificação de consistência na exibição de termos de aceite para pedidos legados.

### TASK: Correção UX Checkout Step 1
- **Descrição**: Unificação do passo de criação de conta e pagamento no `Step1PersonalInfo` e remoção da pré-seleção da Parcelow para forçar a escolha ativa do meio de pagamento.
- **Arquivos Modificados**:
  - `src/pages/MigmaCheckout/components/Step1PersonalInfo.tsx`: Removido estado padrão de pagamento e refatorado `handleSubmit` para centralizar fluxo de conta + pagamento.

### TASK: Pesquisa no Histórico Zelle Approval
- **Descrição**: Adição de barra de pesquisa (Search) para permitir buscar o histórico completo por nome, e-mail ou número de pedido, em vez de mostrar apenas os últimos 20 itens.
- **Arquivos Modificados**:
  - `src/pages/ZelleApprovalPage.tsx`: Implementado input de busca com debounce, atualização das queries de banco no `loadOrders` para `visa_orders` e `migma_payments`.
