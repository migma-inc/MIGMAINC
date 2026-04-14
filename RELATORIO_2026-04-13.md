# Relatório Técnico — Sessão de Desenvolvimento
**Data:** 13 de Abril de 2026  
**Branch:** `tracking-paulo`  
**Projeto:** migma-lp  
**Escopo:** Fluxo de checkout do aluno (MigmaCheckout), Edge Functions Supabase, páginas auxiliares

---

## Sumário Executivo

Nesta sessão foram identificados e corrigidos **9 problemas distintos**, variando de bugs críticos de backend (pagamento nunca sendo registrado) a problemas de UX (modal travado, página não rola para o topo, contratos exibindo HTML bruto). Foram modificados arquivos em três camadas: Edge Functions Deno (Supabase), componentes React (frontend) e páginas standalone.

---

## 1. Bug Crítico — `has_paid_selection_process_fee` Nunca Setado no Fluxo Parcelow

### Contexto
O fluxo de pagamento via Parcelow para o Selection Process Fee segue esta sequência:
1. Frontend → chama `migma-parcelow-checkout` → Parcelow cria a cobrança
2. Parcelow → dispara webhook para `parcelow-webhook` imediatamente após aprovação
3. Frontend → aluno completa Step 2 (documentos) → chama `migma-payment-completed` com `finalize_contract_only: true`

### Problema Identificado
O webhook do Parcelow (`parcelow-webhook`) chegava **antes** de qualquer `visa_order` existir no banco. O handler do webhook tentava localizar a ordem por `product_slug` nas tabelas `visa_orders` e `visa_order_packages` — não encontrava nada — e **bailava** com log:

```
[Parcelow Webhook] Order não encontrada em nenhuma das tabelas
```

Como resultado, a função `migma-payment-completed` era chamada pelo frontend somente com `finalize_contract_only: true` (Step 2), e nesse modo o **BLOCO 1** (responsável por setar `has_paid_selection_process_fee = true`) era completamente pulado. O aluno completava o checkout, mas o campo nunca era marcado como pago, bloqueando o acesso ao onboarding.

### Diagnóstico Aprofundado

```
BLOCO 1 (migma-payment-completed):
  if (!finalize_only) {
    // seta has_paid, insere individual_fee_payments, etc.
  }
  // sem else → finalize_only simplesmente pula tudo
```

Para Parcelow, o webhook deveria ter setado o flag, mas falhou. O `finalize_only` do Step 2 deveria ser apenas para documentos, não para pagamento — mas como era o único path que chegava à função, o pagamento ficava em limbo.

### Solução — Parte 1: `supabase/functions/parcelow-webhook/index.ts`

Adicionado bloco após `syncMigmaUserProfile()` no path de pagamento aprovado. Se o `product_slug` contém `"selection-process"`, busca o perfil do aluno por email e seta o flag diretamente:

```typescript
if (mainOrder.product_slug?.includes("selection-process") && mainOrder.client_email) {
  const { data: migmaProfile } = await supabase
    .from("user_profiles")
    .select("user_id, has_paid_selection_process_fee")
    .eq("email", mainOrder.client_email)
    .maybeSingle();

  if (migmaProfile?.user_id && !migmaProfile.has_paid_selection_process_fee) {
    await supabase.from("user_profiles").update({
      has_paid_selection_process_fee: true,
      onboarding_current_step: "selection_survey",
      selection_process_fee_payment_method: "parcelow",
    }).eq("user_id", migmaProfile.user_id);
  }
}
```

### Solução — Parte 2: `supabase/functions/migma-payment-completed/index.ts`

Adicionado `else if` no BLOCO 1 para cobrir o cenário onde `finalize_only=true` **mas** o pagamento já foi aprovado (via Parcelow, card, pix). Se o método não é `zelle` nem `manual` (que requerem aprovação humana), seta o flag com verificação de idempotência:

```typescript
} else if (
  fee_type === "selection_process" &&
  payment_method !== "zelle" &&
  payment_method !== "manual"
) {
  const { data: currentProfile } = await migma
    .from("user_profiles")
    .select("has_paid_selection_process_fee")
    .eq("user_id", user_id)
    .maybeSingle();

  if (!currentProfile?.has_paid_selection_process_fee) {
    await migma.from("user_profiles").update({
      has_paid_selection_process_fee: true,
      onboarding_current_step: "selection_survey",
      selection_process_fee_payment_method: payment_method,
    }).eq("user_id", user_id);
  }
}
```

**Resultado:** Dupla proteção. O webhook seta o flag assim que Parcelow confirma. Se o webhook falhar por qualquer motivo, o Step 2 (finalize_only path) ainda garante o flag.

---

## 2. Análise do Fluxo Zelle — Confirmação de Ausência de Bug

### Contexto
Após corrigir o bug do Parcelow, foi solicitada análise equivalente para o fluxo Zelle, para garantir que o mesmo problema não existia.

### Análise Comparativa

| Característica | Parcelow | Zelle |
|---|---|---|
| Quem seta `has_paid`? | Webhook automático | Admin manualmente |
| Quando dispara? | Imediatamente após pagamento | Depois que admin aprova comprovante |
| Chama `migma-payment-completed`? | Sim, via webhook | Sim, `approveMigmaCheckoutZelle()` |
| `finalize_only` interfere? | Sim — webhook falhou antes | Não — admin chama sem `finalize_only` |

### Fluxo Zelle (Selection Process) — Correto por Design

```
Aluno → upload comprovante (Step 1)
  → migma_checkout_zelle_pending: status='pending_verification'

Aluno → Step 2 (documentos)
  → migma-payment-completed com finalize_only=true, method='zelle'
  → BLOCO 1 PULADO (correto — admin ainda não aprovou) ✅
  → visa_order criada com payment_status='manual_pending'

Admin → aprova em ZelleApprovalPage
  → approveMigmaCheckoutZelle()
  → migma-payment-completed SEM finalize_only
  → BLOCO 1 RODA: has_paid_selection_process_fee=true ✅
  → onboarding_current_step='selection_survey' ✅
```

**Conclusão:** Nenhuma alteração necessária no fluxo de aprovação Zelle. Arquiteturalmente correto.

---

## 3. Bug — Modal de Progresso Travado Após Upload Zelle

### Contexto
No `MigmaCheckout`, após o aluno completar o Step 1 com pagamento via Zelle e clicar em "Continuar", um modal de progresso era exibido com animação. O modal travava em 100% e **nunca fechava**, impedindo o aluno de prosseguir para o Step 2.

### Causa Raiz

```typescript
// Trecho original no handleStep1Complete:
if (payment.method === 'parcelow_card' || payment.method === 'parcelow_pix' || payment.method === 'stripe') {
  // redirect externo → função retorna aqui, modal nunca fecha
  return;
}
// setProcessing(false) havia sido REMOVIDO para evitar flash no redirect
// Mas Zelle não redireciona → modal ficava travado
```

A remoção de `setProcessing(false)` foi feita para que o modal permanecesse visível durante o redirect externo (Parcelow/Stripe). Porém, para Zelle, não há redirect — o aluno continua no mesmo contexto, e o modal nunca era fechado.

### Solução — `src/pages/MigmaCheckout/index.tsx`

```typescript
// Após completar Step 1 para todos os métodos:
setProgress(75);
await new Promise(r => setTimeout(r, 200));
setProgress(100);

setStep1Data({ ...data, payment_method: payment.method });
setState(prev => ({
  ...prev,
  userId,
  totalPrice: total,
  step1Completed: true,
  currentStep: 2,
  zelleProcessing: payment.method === 'zelle'
}));

// 500ms delay — Parcelow/Stripe retornam ANTES desta linha (early return acima)
// Logo, só Zelle e outros métodos sem redirect chegam aqui
await new Promise(r => setTimeout(r, 500));
window.scrollTo({ top: 0, behavior: 'smooth' });
setProcessing(false); // fecha modal
```

**Resultado:** Modal fecha suavemente após 500ms para Zelle. Parcelow/Stripe nunca chegam nessa linha (retornam antes via redirect).

---

## 4. UX — Página Não Rola Para o Topo nas Transições de Step

### Contexto
Nas transições Step 1→2 e Step 2→3, o conteúdo novo era renderizado mas a posição de scroll da página era mantida — o aluno via o início do Step 2 ou 3 no meio da página, com scroll já para baixo.

### Solução

**Step 1→2** (dentro do handler do modal, após `setProcessing(false)` — ver item 3):
```typescript
window.scrollTo({ top: 0, behavior: 'smooth' });
```

**Step 2→3** (`handleStep2Complete`):
```typescript
setState(prev => ({ ...prev, step2Completed: true, currentStep: 3 }));
window.scrollTo({ top: 0, behavior: 'smooth' });
```

---

## 5. UX — Remoção de Placeholders do Step 2

### Contexto
O Step 2 (documentos e dados pessoais) em `Step2Documents.tsx` possuía placeholder text em todos os campos de input (`placeholder="Ex: 01/01/1990"`, `placeholder="Ex: 12345-678"`, etc.). O usuário considerou desnecessário.

### Solução

Removidos todos os atributos `placeholder` dos inputs em `src/pages/MigmaCheckout/components/Step2Documents.tsx`.

Adicionalmente, foi identificado e corrigido um bug de duplicação de texto: o label "Civil Status" aparecia como `"Estado Civil (opcional) (opcional)"` porque:
1. A string de tradução já continha `"(opcional)"` na chave `i18n`
2. O JSX adicionava um `<span>(opcional)</span>` separado

Removido o `<span>` redundante.

---

## 6. Redesign Completo do Step 3 — Resumo do Checkout

### Contexto
O Step 3 original (`Step3Summary.tsx`) exibia apenas badges genéricas ("Verificação Completa", "Documentos Validados", "Dados Confirmados") sem nenhuma informação real sobre o que o aluno havia submetido. Era visualmente pobre e funcionalmente inútil.

### Nova Implementação — `src/pages/MigmaCheckout/components/Step3Summary.tsx`

Componente completamente reescrito com as seguintes seções:

#### 6.1 — Preview de Documentos
Componente interno `DocPreview` que usa `URL.createObjectURL(file)` para gerar preview local dos arquivos enviados pelo aluno:

```typescript
const DocPreview: React.FC<{ file: File | null; label: string }> = ({ file, label }) => {
  const [url, setUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl); // cleanup para evitar memory leak
  }, [file]);

  // Renderiza imagem com overlay de checkmark verde se arquivo presente
  // Renderiza placeholder cinza se não houver arquivo
};
```

Grid de 3 colunas exibindo: Documento Frente, Documento Verso, Selfie — cada um com overlay de `CheckCircle2` verde quando presente.

#### 6.2 — Dados Pessoais
Seção mostrando todas as informações submetidas no Step 2:
- Data de nascimento
- Tipo e número do documento  
- Nacionalidade
- Estado civil
- Endereço completo (rua, número, complemento, bairro, cidade, estado, CEP, país)
- Observações (se preenchidas)

#### 6.3 — Remoção da Seção "Validados"
Removida a seção "Verificação Completa" com badges decorativas que não adicionavam valor informacional.

#### 6.4 — Props Adicionadas

```typescript
interface Props {
  serviceConfig: ServiceConfig;
  step1Data: Step1Data;
  paymentMethod: PaymentMethod;
  zelleProcessing?: boolean;
  onFinish: () => void;
  documents: {           // NOVO
    docFront: File | null;
    docBack: File | null;
    selfie: File | null;
  };
  personalInfo: {        // NOVO
    birth_date: string;
    doc_type: DocType;
    doc_number: string;
    nationality: string;
    civil_status: CivilStatus;
    address: string;
    // ... demais campos Step2Data
  };
}
```

---

## 7. Bug Crítico — Auto-Aprovação de Pagamento Zelle Sem Intervenção do Admin

### Contexto
Foi reportado que alunos que pagavam via Zelle estavam sendo marcados como pagos **sem** aprovação do admin. O flag `has_paid_selection_process_fee` era setado durante o Step 2, antes mesmo de qualquer aprovação.

### Causa Raiz

Em `handleStep2Complete` dentro de `MigmaCheckout/index.tsx`, havia um campo hardcoded:

```typescript
// BUGADO — sempre enviava 'parcelow_card' independente do método real
matriculaApi.paymentCompleted({
  user_id: state.userId!,
  payment_method: 'parcelow_card', // ← HARDCODED!
  finalize_contract_only: true,
  // ...
});
```

Com `payment_method: 'parcelow_card'` e `finalize_contract_only: true`, o `else if` adicionado no `migma-payment-completed` para o fix do Parcelow era acionado:

```typescript
} else if (
  fee_type === "selection_process" &&
  payment_method !== "zelle" &&  // 'parcelow_card' !== 'zelle' → TRUE
  payment_method !== "manual"    // 'parcelow_card' !== 'manual' → TRUE
) {
  // Setava has_paid = true PARA ALUNOS ZELLE INDEVIDAMENTE!
```

O método real (`zelle`) era ignorado. O sistema acreditava ser Parcelow e setava o flag sem aguardar aprovação do admin.

### Solução — Dois Passos

**Passo 1:** Salvar o `payment_method` real no `Step1Data` ao completar o Step 1.

Adicionado campo à interface `Step1Data` em `types.ts`:
```typescript
export interface Step1Data {
  // ... campos existentes
  payment_method?: PaymentMethod; // NOVO
}
```

Ao finalizar Step 1 em `index.tsx`:
```typescript
setStep1Data({ ...data, payment_method: payment.method }); // salva método real
```

**Passo 2:** Usar o método real no Step 2.

```typescript
const realPaymentMethod = step1Data?.payment_method || 'parcelow_card';

matriculaApi.paymentCompleted({
  user_id: state.userId!,
  payment_method: realPaymentMethod, // ← agora usa 'zelle' para alunos Zelle
  finalize_contract_only: true,
  // ...
});
```

**Resultado:** Para alunos Zelle, `payment_method: 'zelle'` é enviado. O `else if` tem condição `payment_method !== 'zelle'` → **falso** → bloco não executa → `has_paid` NÃO é setado. Admin precisa aprovar manualmente como esperado.

---

## 8. Bug — Duplicação de Alunos MigmaCheckout na ZelleApprovalPage

### Contexto
A página de aprovação de comprovantes Zelle (`ZelleApprovalPage.tsx`) exibia os alunos do MigmaCheckout em **duas seções distintas**:
1. Na seção "MigmaCheckout" (via `migma_checkout_zelle_pending`)
2. Na seção de "Visa Orders" (via `visa_orders` com `payment_method='zelle'`)

Isso ocorria porque o Step 2 criava uma `visa_order` com `payment_status='manual_pending'` e `payment_method='zelle'`, que era então listada junto com as visa orders reais.

### Análise das Opções

**Opção 1 (Escolhida):** Filtrar no frontend — remover da lista de visa orders qualquer entrada cujo email corresponda a um aluno MigmaCheckout pendente.

**Opção 2:** Modificar o Step 2 para não criar visa_order com payment_method='zelle'. Descartada — a visa_order é necessária para o resto do pipeline.

### Solução — `src/pages/ZelleApprovalPage.tsx`

Adicionado fetch antecipado (lightweight) da tabela `migma_checkout_zelle_pending` antes do fetch principal:

```typescript
// Busca emails de alunos MigmaCheckout com Zelle pendente
const { data: migmaZelleDataEarly } = await supabase
  .from('migma_checkout_zelle_pending')
  .select('migma_user_email')
  .eq('status', 'pending_verification');

const migmaCheckoutEmails = new Set(
  (migmaZelleDataEarly || [])
    .map((p: any) => p.migma_user_email?.trim().toLowerCase())
    .filter(Boolean)
);
```

Filtro aplicado ao construir `finalPending`:

```typescript
// Remove visa_orders que são na verdade MigmaCheckout Zelle pendentes
if (
  item.type === 'migma' &&
  item.client_email &&
  migmaCheckoutEmails.has(item.client_email.trim().toLowerCase())
) return false;
```

**Nota técnica:** O fetch foi feito como `migmaZelleDataEarly` (separado) porque `migmaZelleData` era declarado mais abaixo no mesmo escopo — usar a variável antes da declaração causaria erro de runtime (TDZ — Temporal Dead Zone em `const`).

---

## 9. Limpeza UX — Remoção do Link "Ainda Não Tem Conta?" no StudentLogin

### Contexto
A página `/student/login` exibia um CTA de registro ("Ainda não tem conta? / Fazer inscrição") que redirecionava para uma rota de registro. O fluxo de registro via MigmaCheckout foi internalizado — não há mais rota separada de inscrição pública.

### Solução — `src/pages/StudentLogin.tsx`

Removido o bloco completo:

```tsx
{/* Removido: */}
<p className="text-center text-xs text-gray-500 mt-4">
  Ainda não tem conta?{' '}
  <button onClick={() => navigate('/student/register')} ...>
    Fazer inscrição
  </button>
</p>
```

---

## 10. Fix — Fluxo de Recuperação de Senha (`ResetPassword.tsx`)

### Contexto
A página de redefinição de senha (`/student/reset-password`) foi analisada. O fluxo de recuperação no Supabase v2 funciona assim:

1. Supabase envia email com link `?type=recovery&token_hash=...`
2. Ao clicar, o Supabase JS SDK processa o hash da URL de forma **assíncrona**
3. O evento `PASSWORD_RECOVERY` é disparado via `onAuthStateChange`
4. Só então `supabase.auth.updateUser({ password })` é válido

### Problema Original

A implementação anterior usava `getSession()` de forma síncrona no `useEffect`, que retornava sessão nula enquanto o SDK ainda processava o token do hash. Isso resultava em erro imediato de "sessão inválida" antes mesmo do aluno tentar submeter.

### Solução — `src/pages/ResetPassword.tsx`

Substituído `getSession()` por `onAuthStateChange`:

```typescript
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      console.log('[ResetPassword] Sessão de recovery estabelecida.');
    } else if (!session && event !== 'INITIAL_SESSION') {
      // INITIAL_SESSION é disparado no mount — ignorar para não dar falso positivo
      setError('Link de recuperação inválido ou expirado. Solicite um novo link.');
    }
  });
  return () => subscription.unsubscribe();
}, []);
```

**Por que ignorar `INITIAL_SESSION`?** O SDK sempre dispara `INITIAL_SESSION` com `session=null` no mount, antes de processar o hash. Sem esse filtro, o erro seria exibido imediatamente para todos os usuários.

Adicionalmente, `autoComplete="new-password"` nos dois campos de senha — instrui o browser a não sugerir senhas antigas, reduzindo confusão UX.

---

## 11. Fix — Renderização de Contratos no MigmaCheckout

### Contexto
O contrato de adesão exibido no modal de termos (`TermsModal.tsx`) do MigmaCheckout era armazenado no banco como HTML (com tags `<p>`, `<strong>`, `<br>`, parágrafos, etc.). Porém, o componente renderizava o conteúdo como texto plano via `<pre>`, exibindo as tags HTML literalmente:

```
<p><strong>CONTRATO DE PRESTAÇÃO DE SERVIÇOS</strong></p>
<p>Entre as partes:</p>
<p><strong>CONTRATANTE:</strong> ...
```

### Comparação com Visa Checkout

O Visa Checkout (`ContractTermsSection.tsx`) renderiza o mesmo tipo de conteúdo corretamente usando:

```tsx
<div dangerouslySetInnerHTML={{ __html: contractTemplate.content }} />
```

### Solução — `src/pages/MigmaCheckout/components/TermsModal.tsx`

```tsx
// ANTES:
<pre className="text-gray-300 text-xs leading-relaxed whitespace-pre-wrap font-sans">
  {contractText}
</pre>

// DEPOIS:
<div
  className="text-gray-300 text-sm leading-relaxed prose prose-invert prose-sm max-w-none"
  dangerouslySetInnerHTML={{ __html: contractText }}
/>
```

**Sobre `dangerouslySetInnerHTML`:** Seguro neste contexto porque o conteúdo HTML vem de tabela interna do Supabase (controlada pela equipe), não de input do usuário. O risco de XSS é gerenciado na origem (quem insere o contrato no banco).

Classes Tailwind `prose prose-invert prose-sm` (Tailwind Typography plugin) aplicam estilos automáticos de tipografia para HTML gerado — headings, parágrafos, negrito, listas.

---

## Resumo das Alterações por Arquivo

| Arquivo | Tipo | Alterações |
|---|---|---|
| `supabase/functions/migma-payment-completed/index.ts` | Edge Function | `else if` no BLOCO 1 para cobrir finalize_only + Parcelow aprovado |
| `supabase/functions/parcelow-webhook/index.ts` | Edge Function | Set direto de `has_paid_selection_process_fee` após aprovação Parcelow |
| `src/pages/MigmaCheckout/index.tsx` | React Page | Fix modal Zelle, scroll to top, salvar `payment_method` real, fix hardcoded method no Step 2 |
| `src/pages/MigmaCheckout/types.ts` | Types | Adicionado `payment_method?: PaymentMethod` em `Step1Data` |
| `src/pages/MigmaCheckout/components/Step2Documents.tsx` | React Component | Removidos todos os placeholders, removido `(opcional)` duplicado |
| `src/pages/MigmaCheckout/components/Step3Summary.tsx` | React Component | Reescrita completa — doc previews, dados pessoais, remoção de badges |
| `src/pages/MigmaCheckout/components/TermsModal.tsx` | React Component | `<pre>` → `dangerouslySetInnerHTML` para renderizar HTML do contrato |
| `src/pages/ZelleApprovalPage.tsx` | React Page | Deduplicação de alunos MigmaCheckout no admin panel |
| `src/pages/StudentLogin.tsx` | React Page | Remoção do CTA de registro |
| `src/pages/ResetPassword.tsx` | React Page | Fix do fluxo de recovery com `onAuthStateChange` |

---

## Classificação por Severidade

| # | Problema | Severidade | Impacto |
|---|---|---|---|
| 1 | `has_paid` nunca setado no Parcelow | **Crítico** | Aluno paga e não acessa onboarding |
| 7 | Auto-aprovação Zelle sem admin | **Crítico** | Aluno acessa onboarding sem pagar |
| 3 | Modal travado após upload Zelle | **Alto** | Bloqueio total do fluxo Step 1→2 |
| 8 | Duplicação na ZelleApprovalPage | **Médio** | Confusão no admin, risco de dupla aprovação |
| 10 | Recovery de senha falha imediatamente | **Médio** | Aluno não consegue redefinir senha |
| 11 | Contrato exibe HTML bruto | **Médio** | Contrato ilegível, risco legal |
| 4 | Sem scroll to top na transição | **Baixo** | UX degradada |
| 5 | Placeholders desnecessários | **Baixo** | Ruído visual |
| 6 | Step 3 sem informação real | **Baixo** | UX degradada, sem feedback ao aluno |
| 9 | Link de registro obsoleto | **Baixo** | Rota morta exposta ao usuário |

---

## Observações Finais

### Gaps Identificados Mas Não Corrigidos (baixa prioridade)

1. **`send-zelle-webhook`** (fluxo visa_orders Zelle) não seta `has_paid_selection_process_fee`. Afeta apenas visa orders diretas, não o MigmaCheckout Selection Process.

2. **Idempotência na aprovação Zelle:** `approveMigmaCheckoutZelle()` não verifica se o aluno já foi aprovado antes de chamar `migma-payment-completed`. Se admin clicar duas vezes, pode inserir dois registros em `individual_fee_payments`.

3. **Constraint UNIQUE ausente** em `individual_fee_payments (user_id, fee_type)` — sem proteção no banco contra inserções duplicadas.

### Padrões Consolidados

- **Fluxo finalize_only:** Usado exclusivamente para Step 2 (documentos). Não deve setar `has_paid` para métodos que requerem aprovação humana (Zelle, manual). Para métodos automáticos (Parcelow, card), o webhook é a fonte primária de verdade, com o finalize_only como fallback.
- **`payment_method` no Step1Data:** Agora é o contrato entre Steps — o método escolhido no Step 1 deve ser propagado para qualquer chamada de API feita no Step 2.
- **Deduplicação no admin:** Preferido filtro no frontend a modificar a criação de `visa_orders` — preserva o pipeline downstream.
