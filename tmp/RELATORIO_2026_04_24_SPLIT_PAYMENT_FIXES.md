# Relatório de Sessão — 2026-04-24
## Split Payment & Migma Checkout: Diagnóstico e Correções

---

## Contexto

Sessão focada em corrigir uma série de bugs encadeados no fluxo de **split payment** (pagamento dividido em duas partes via Parcelow) para o checkout Migma e para o Placement Fee do onboarding de alunos V11.

---

## Bugs Corrigidos

---

### Bug 1 — Split Payment retornava HTTP 500 (FK violation)

**Arquivo:** `supabase/functions/migma-split-parcelow-checkout/index.ts`

**Root cause:**
A tabela `split_payments` foi criada com `order_id UUID NOT NULL REFERENCES visa_orders(id)`. A migration `20260415000000_add_migma_split_support.sql` removeu o `NOT NULL`, mas a **FK `REFERENCES visa_orders(id)` continuou existindo**.

Para o fluxo migma (ex: `/student/checkout/cos`), a função passava como `order_id` o UUID retornado por `migma-create-student` — que **não existe em `visa_orders`** — causando FK violation no INSERT → status 500.

**Fix:**
```typescript
// Antes:
order_id: isPlacementFee ? null : finalOrderId,

// Depois:
order_id: null, // Sempre null — migma e placement_fee não têm FK em visa_orders
```

Também alterados todos os `status: 500` internos para `status: 200` com `{ success: false, error: "..." }` para o frontend conseguir ver a mensagem de erro real (antes chegava como `FunctionsHttpError` opaco).

---

### Bug 2 — Loop infinito no split payment do Placement Fee

**Arquivo:** `supabase/functions/parcelow-webhook/index.ts`

**Root cause:**
O webhook da Parcelow processava `source === 'migma'` e `source === 'visa'` corretamente, mas `source === 'placement_fee'` **caía no bloco de visa_orders** (que tenta buscar `visa_orders` via `order_id = null`) → retornava early sem atualizar `part1_payment_status` → nunca marcava P1 como `completed` → `SplitPaymentRedirectFlow` ficava redirecionando o usuário de volta para P1 (já pago) infinitamente.

**Fix:** Três linhas no webhook:
```typescript
// Rotear placement_fee igual ao migma (sem visa_orders)
if (splitPayment.source === 'migma' || splitPayment.source === 'placement_fee') {
  await processSplitPaymentWebhook(...);
  return;
}

// Excluir placement_fee do bloco visa bothPartsPaid
if (bothPartsPaid && splitPayment.source !== 'migma' && splitPayment.source !== 'placement_fee') { ... }

// Excluir placement_fee do email de P2
if (isPart1 && splitPayment.source !== 'migma' && splitPayment.source !== 'placement_fee') { ... }
```

---

### Bug 3 — Após pagamento completo, usuário ficava no Step 1 do MigmaCheckout

**Arquivo:** `src/pages/MigmaCheckout/index.tsx`

**Root cause:**
`handleVerifyAndAdvance` tentava `supabase.auth.getSession()` para obter o `userId`. O usuário do checkout Migma é criado via `migma-create-student` (conta sem senha, passwordless) — **nunca faz sign-in**, então `getSession()` retorna `null`.

Com `finalUserId = null`, o fallback `if (finalUserId) { força avanço para Step 2 }` também falhava silenciosamente → usuário ficava no Step 1.

**Fix:**
```typescript
// Fallback: recuperar userId do draft salvo no localStorage antes do redirect
if (!finalUserId && draftRaw) {
  try {
    const draft = JSON.parse(draftRaw);
    if (draft?.state?.userId) finalUserId = draft.state.userId;
  } catch {}
}
```

---

### Bug 4 — Usuário não ficava logado após criar conta no checkout

**Arquivos:**
- `supabase/functions/migma-create-student/index.ts`
- `src/pages/MigmaCheckout/index.tsx`

**Root cause:**
`migma-create-student` criava o usuário via `auth.admin.createUser({ email_confirm: true })` mas **nunca criava uma sessão**. Sem sessão, o upload de documentos no Step 2 falhava com `StorageApiError: new row violates row-level security policy`.

**Fix — Edge Function:**
Após criar/encontrar o usuário, gerar um magic link token server-side:
```typescript
const { data: linkData } = await migma.auth.admin.generateLink({
  type: 'magiclink',
  email,
});
sessionToken = linkData?.properties?.hashed_token || null;
// Retorna session_token junto com user_id e order_id
```

**Fix — Frontend:**
```typescript
if (res?.session_token) {
  await supabase.auth.verifyOtp({
    token_hash: res.session_token,
    type: 'magiclink',
  });
  await refreshProfile();
}
```

Login silencioso criado sem o usuário precisar checar email.

---

### Bug 5 — Step 2 chamava `migma-create-student` desnecessariamente (400)

**Arquivo:** `src/pages/MigmaCheckout/index.tsx`

**Root cause:**
Em `handleStep2Complete`, havia uma chamada a `matriculaApi.createStudent(...)` para sincronizar `country/nationality`. Agora que `migma-create-student` tenta gerar um magic link token (via `generateLink`), essa chamada redundante no Step 2 às vezes falhava com status 400.

**Fix:** Substituído por update direto no banco:
```typescript
// Antes (chamada desnecessária à edge function):
await matriculaApi.createStudent({ migma_user_id, email, country, nationality, ... });

// Depois (update direto):
await supabase.from('user_profiles').update({
  country: data.country || null,
  nationality: data.nationality || null,
}).eq('user_id', effectiveUserId);
```

---

### Bug 6 — Placement Fee: tela genérica "Pagamento Bem-sucedido" após split completo

**Arquivo:** `src/pages/SplitPaymentRedirectSuccessStyle.tsx`

**Root cause:**
O `handleSplitState` tratava `source === 'migma'` mas não `source === 'placement_fee'` quando `overall_status === 'fully_completed'`. O `else` redirecionava para `/checkout/success?order_id=null` → tela genérica.

**Fix:**
```typescript
// Adicionado caso placement_fee:
} else if (split.source === 'placement_fee') {
  navigate(`/student/onboarding?step=placement_fee&success=true&application_id=${split.application_id}`);
}
```

---

### Bug 7 — Placement Fee: não avançava automaticamente para próxima etapa

**Arquivo:** `src/pages/StudentOnboarding/components/PlacementFeeStep.tsx`

**Root cause:**
Quando o usuário voltava para `/student/onboarding?step=placement_fee&success=true`, o `PlacementFeeStep` mostrava o estado "Pagamento Confirmado!" mas exigia clique manual no botão "Continuar para Próximos Passos".

**Fix:**
```typescript
// Auto-avançar quando success=true + pagamento confirmado no banco
const isPaidForAutoAdvance = applications.some(a => a.status === 'payment_confirmed');
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('success') !== 'true' || !isPaidForAutoAdvance) return;
  const timer = setTimeout(() => onNext(), 2500);
  return () => clearTimeout(timer);
}, [isPaidForAutoAdvance, onNext]);
```

---

### Bug 8 — `StudentAuthContext` não era aproveitado no MigmaCheckout

**Arquivo:** `src/pages/MigmaCheckout/index.tsx`

**Root cause:**
`handleRegisterUser` chamava `migma-create-student` sem passar `migma_user_id` mesmo quando o estudante já tinha sessão ativa via OTP/magic link — forçando recriação desnecessária.

**Fix:**
```typescript
const { refreshProfile, user: studentAuthUser } = useStudentAuth();
// ...
await matriculaApi.createStudent({
  // ...
  migma_user_id: studentAuthUser?.id || undefined, // reusa sessão se existir
});
```

---

### Bug 9 — Alunos presos na tela de sucesso genérica sem botão de retorno

**Arquivo:** `src/pages/CheckoutSuccess.tsx`

**Root cause:**
Se o redirecionamento da Parcelow caísse na rota genérica `/checkout/success` (ou se o polling de split falhasse em detectar o passo seguinte), o aluno via uma tela de sucesso sem link de volta para o Onboarding, precisando voltar manualmente para a home.

**Fix:**
Implementada detecção de estudante Migma baseada no `source` do perfil, do split payment ou do pedido. Se detectado:
1. Exibe botão proeminente "Continuar para Onboarding".
2. Implementa **redirecionamento automático de 5 segundos** para `/student/onboarding`.

---

### Bug 10 — Split Payments de "placement_fee" sem application_id

**Root cause:**
Versões anteriores da edge function não salvavam o `application_id` no registro de `split_payments`, dificultando o redirecionamento automático pós-pagamento.

**Fix:**
Alterada a tabela via migration para aceitar `application_id` e atualizada a edge function `migma-split-parcelow-checkout` para persistir esse dado.

---

### Sincronização Manual e Correções de Dados

Realizamos uma intervenção direta via SQL para desbloquear o aluno `pepa9245@uorak.com`:
- Marcado `is_placement_fee_paid = true`.
- Atualizado status da aplicação para `payment_confirmed`.
- Definido `migma_checkout_completed_at = NOW()` para garantir avanço no hook de progresso.

---

## Dependências SQL Criadas

**Arquivo:** `tmp/SETUP_MIGMA_PARCELOW_DEPENDENCIES.sql`

Duas dependências que estavam faltando no banco:

1. **Tabela `migma_parcelow_pending`** — usada por `migma-parcelow-checkout` para registrar pedidos individuais (não-split) e pelo `parcelow-webhook` para confirmar pagamento.

2. **RPC `get_user_id_by_email(p_email TEXT)`** — usada por `migma-create-student` como fallback quando `auth.admin.createUser` retorna "already exists".

Ambas aplicadas via Supabase MCP na sessão.

---

## Arquivos Modificados

| Arquivo | Tipo | Mudança |
|---------|------|---------|
| `supabase/functions/migma-split-parcelow-checkout/index.ts` | Edge Function | `order_id: null` para migma/placement_fee + status 200 em todos erros |
| `supabase/functions/parcelow-webhook/index.ts` | Edge Function | Roteamento `placement_fee` igual a `migma` + exclusões de bloco visa |
| `supabase/functions/migma-create-student/index.ts` | Edge Function | Gera `session_token` (magic link) para login silencioso |
| `src/pages/MigmaCheckout/index.tsx` | Frontend | Login silencioso + fallback userId de draft + sem chamada desnecessária no Step 2 |
| `src/pages/SplitPaymentRedirectSuccessStyle.tsx` | Frontend | Redirect correto para `placement_fee` fully_completed |
| `src/pages/CheckoutSuccess.tsx` | Frontend | Detecção de aluno Migma + Auto-redirect para onboarding |
| `src/pages/StudentOnboarding/components/PlacementFeeStep.tsx` | Frontend | Auto-avança para próxima etapa com `success=true` |
| `src/locales/pt.json` | Localização | Adicionada chave `go_to_onboarding` |

---

## Deploy Necessário

```bash
bash tmp/DEPLOY_SPLIT_FIX.sh
```

Funções a deployar:
- `migma-split-parcelow-checkout`
- `parcelow-webhook`
- `migma-parcelow-checkout`
- `migma-create-student`

---

## Utilitários Criados

| Arquivo | Finalidade |
|---------|-----------|
| `tmp/SETUP_MIGMA_PARCELOW_DEPENDENCIES.sql` | Cria `migma_parcelow_pending` + RPC `get_user_id_by_email` |
| `tmp/DEPLOY_SPLIT_FIX.sh` | Script de deploy das 4 edge functions |
| `tmp/FIX_STUDENT_PLACEMENT_FEE.sql` | Corrigir manualmente alunos presos no placement fee |
| `tmp/DIAGNOSTICO_SPLIT_PAYMENT_BUG.sql` | Diagnóstico de split payments com status pendente |

---

*Gerado em 2026-04-24*
