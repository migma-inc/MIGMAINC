# Relatório Técnico — 2026-04-30

**Projeto:** Migma LP + MatriculaUSA MVP  
**Branch:** `tracking-paulo`  
**Sessão:** Continuação da sessão anterior (compactada)

---

## Resumo Executivo

Sessão focada em três frentes:
1. **Correção do fluxo do Transfer Form** — bug crítico onde o formulário enviado pelo admin nunca chegava ao dashboard do aluno
2. **Melhorias de UX no StudentDashboard** — instrução de entrega do Transfer Form + UI do botão de confirmação
3. **Correção no painel admin** — remoção de input manual redundante da carta de aceite
4. **Planejamento** — dark/light mode para o StudentOnboarding (execução agendada para amanhã)

---

## 1. Bug Crítico: Transfer Form nunca chegava ao Dashboard do Aluno

### Diagnóstico

O aluno submetia o formulário no MatriculaUSA, mas o dashboard Migma não exibia nada.  
Investigação revelou que a Edge Function `receive-matriculausa-letter` nunca era chamada com `transfer_form_url`.

**Fluxo atual (quebrado):**
```
Admin MatriculaUSA faz upload do Transfer Form
  → URL salva em scholarship_applications.transfer_form_url (MatriculaUSA DB)
  → ❌ Nenhuma chamada ao webhook Migma
  → Aluno não vê nada no dashboard
```

**Causa raiz:** Em `useTransferForm.ts` (MatriculaUSA), a função `handleUploadTransferForm` fazia o upload e salvava no banco, mas **nunca chamava** o webhook `receive-matriculausa-letter` com `transfer_form_url`.

As únicas chamadas ao webhook existentes eram:
- `handleApproveMigmaTransferForm` → enviava apenas `transfer_form_admin_status: 'approved'`
- `handleRejectMigmaTransferForm` → enviava apenas `transfer_form_admin_status: 'rejected'`

### Correção Aplicada

**Arquivo:** `C:\Users\victurib\Matricula USA\matriculausa-mvp\project\src\hooks\useTransferForm.ts`

Adicionado bloco de webhook call dentro de `handleUploadTransferForm`, após salvar no banco e antes do `logAction`:

```typescript
// Notify Migma so the student can see the transfer form in their dashboard
try {
  const MIGMA_FUNCTIONS_URL = (import.meta as any).env.VITE_MIGMA_FUNCTIONS_URL as string;
  const MIGMA_SECRET = (import.meta as any).env.VITE_MIGMA_WEBHOOK_SECRET as string;
  const MIGMA_ANON_KEY = (import.meta as any).env.VITE_MIGMA_SUPABASE_ANON_KEY as string;

  const { data: studentProfile } = await supabase
    .from('user_profiles').select('email').eq('user_id', student.user_id).maybeSingle();

  if (MIGMA_FUNCTIONS_URL && MIGMA_SECRET && studentProfile?.email) {
    await fetch(`${MIGMA_FUNCTIONS_URL}/receive-matriculausa-letter`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MIGMA_ANON_KEY || ''}`,
        'x-migma-webhook-secret': MIGMA_SECRET,
      },
      body: JSON.stringify({
        student_email: studentProfile.email,
        transfer_form_url: publicUrl,
      }),
    });
  }
} catch (webhookErr) {
  console.warn('Could not notify Migma of transfer form URL (non-fatal):', webhookErr);
}
```

**Fluxo corrigido:**
```
Admin MatriculaUSA faz upload do Transfer Form
  → URL salva em scholarship_applications.transfer_form_url (MatriculaUSA DB)
  → ✅ Webhook chamado → receive-matriculausa-letter recebe { student_email, transfer_form_url }
  → Migma atualiza institution_applications.transfer_form_url
  → Dashboard do aluno exibe o formulário
```

**Nota:** Erro no webhook é não-fatal (try/catch com warn) — o upload não é bloqueado.

---

## 2. UX: Instrução de Entrega do Transfer Form (Spec v11 §14.3)

### Requisito da Spec

> "Transfer Form — instrução didática exibida no sistema:
> - Este formulário deve ser entregue à sua escola atual para solicitar a liberação do seu SEVIS
> - Leve pessoalmente ao DSO (Designated School Official) ou envie por email conforme orientação da sua escola
> - Campo de confirmação no sistema: Já entreguei o Transfer Form para minha escola atual ✓
> - Após confirmação: notificação automática para admin da Migma"

### Problemas Encontrados no Código

1. **Texto descritivo incorreto** — dizia "Visualize o modelo abaixo, assine na sua universidade atual e envie o arquivo preenchido" (não era o texto da spec)
2. **Confirmação condicional errada** — o bloco de confirmação só aparecia quando `adminStatus === 'approved'`, mas a spec diz que deve aparecer assim que o admin enviar o formulário (`hasTemplate`)
3. **UI do botão de confirmação** — era um botão simples sem hierarquia visual clara

### Correções Aplicadas

**Arquivo:** `src/pages/StudentDashboard/StudentDashboard.tsx`

#### 2.1 Texto descritivo corrigido

```tsx
// Antes:
'Visualize o modelo abaixo, assine na sua universidade atual e envie o arquivo preenchido.'

// Depois:
'Este formulário deve ser entregue à sua escola atual para solicitar a liberação do seu SEVIS.'
```

#### 2.2 Condição do bloco de confirmação corrigida

```tsx
// Antes: só aparecia quando adminStatus === 'approved'
{!compact && adminStatus === 'approved' && !isConcluded && ( ... )}

// Depois: aparece assim que hasTemplate for verdadeiro
{!compact && hasTemplate && !isConcluded && ( ... )}
```

#### 2.3 UI do bloco redesenhada

```tsx
<div className="mt-4 rounded-xl border border-[#CE9F48]/30 bg-[#CE9F48]/5 p-5 space-y-4">
  <div>
    <p className="text-xs font-black uppercase tracking-widest text-[#CE9F48]/70 mb-1">Próximo passo</p>
    <p className="text-sm text-[#8a7b66] dark:text-gray-300 leading-relaxed">
      Este formulário deve ser entregue à sua escola atual para solicitar a liberação do seu SEVIS.
      Leve pessoalmente ao DSO (Designated School Official) ou envie por email conforme orientação da sua escola.
    </p>
  </div>

  {isDelivered ? (
    // Banner verde de confirmação com ícone + duas linhas de texto
    <div className="flex items-center gap-3 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-4 py-3">
      <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
      <div>
        <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Entrega confirmada</p>
        <p className="text-xs text-emerald-600/80 dark:text-emerald-500 mt-0.5">
          Você confirmou a entrega do Transfer Form à sua escola atual.
        </p>
      </div>
    </div>
  ) : (
    // Card clicável com ícone circular + título + subtítulo
    <button onClick={handleConfirmDelivery} ...>
      <div className="ícone circular dourado" />
      <div>
        <p>Já entreguei o Transfer Form à minha escola atual</p>
        <p className="subtítulo">Clique para confirmar a entrega</p>
      </div>
    </button>
  )}
</div>
```

---

## 3. Bug: Admin não via confirmação de entrega corretamente

**Arquivo:** `src/pages/admin/AdminUserDetail.tsx`  
**Localização:** Aba "Documents" → seção "Status MatriculaUSA → Aluno" → card "Transfer Form"

### Problema

`transfer_form_delivered_at` só era exibido dentro do bloco condicional `transfer_form_filled_url` — ou seja, o admin só via a confirmação de entrega se o aluno também tivesse feito upload do formulário preenchido. Se o aluno só confirmou a entrega (sem upload), o admin não via nada.

### Correção

```tsx
// Antes: entrega confirmada aninhada dentro de transfer_form_filled_url
{institutionApplication.transfer_form_filled_url ? (
  <div>
    <a>Aluno enviou preenchido</a>
    {institutionApplication.transfer_form_delivered_at && (
      <p>✅ Entregue à escola em ...</p>  // ← só aparecia aqui dentro
    )}
  </div>
) : ( ... )}

// Depois: entrega confirmada independente do filled_url
{institutionApplication.transfer_form_delivered_at && (
  <p className="text-xs text-emerald-400 font-semibold">
    ✅ Entregue à escola em {new Date(...).toLocaleDateString('pt-BR')}
  </p>
)}
{institutionApplication.transfer_form_filled_url ? (
  <a>Aluno enviou preenchido</a>
) : (
  !institutionApplication.transfer_form_delivered_at && (
    <p className="text-xs text-gray-500">Aguardando confirmação do aluno</p>
  )
)}
```

---

## 4. Remoção do Input Manual de Carta de Aceite

**Arquivo:** `src/pages/admin/ScholarshipApprovalTab.tsx`  
**Seção:** "Fluxo V11 — Pós-Pagamento" → card "Carta de Aceite / I-20"

### Contexto

O card tinha um `<input type="url">` + botão "Salvar" para o admin colar manualmente a URL da carta de aceite.

### Por que foi removido

A spec v11 §14.3 define que o fluxo é **totalmente automático**:

> "O MatriculaUSA processa a documentação e emite a carta de aceite e o Transfer Form.  
> **O sistema comunica automaticamente ao sistema Migma** quando esses documentos estão prontos."

A Edge Function `receive-matriculausa-letter` já recebe o webhook do MatriculaUSA e salva `acceptance_letter_url` automaticamente. O input manual era redundante e criava risco de inconsistência.

### Resultado

```tsx
// Input e botão Salvar removidos
// Card agora é informativo: mostra status (Aguardando / Disponível) + link se já chegou
// Texto: "Enviada automaticamente pelo MatriculaUSA via webhook. Nenhuma ação necessária."
```

---

## 5. Análise da Spec v11 — Carta de Aceite (Pergunta do Cliente)

**Pergunta:** O admin Migma precisa clicar para liberar a carta de aceite, ou ela vai direto para o aluno?

**Resposta baseada na spec v11 §14.3:**

O fluxo é **automático** — sem aprovação manual do admin Migma.  
A única trava é **financeira**:

| Situação | Liberação da Carta |
|---|---|
| Placement Fee pago em 1x | Liberada imediatamente via webhook |
| Placement Fee parcelado em 2x, 2ª parcela pendente | Bloqueada até pagamento da 2ª parcela |
| Placement Fee parcelado em 2x, 2ª parcela paga | Liberada automaticamente |

**Fluxo completo:**
```
MatriculaUSA emite carta
  → POST receive-matriculausa-letter { student_email, acceptance_letter_url }
  → Migma salva na institution_applications
  → Se 1x: carta liberada no dashboard imediatamente
  → Se 2x e 2ª pendente: badge "2ª Parcela Pendente", sem botões de download
  → Após admin confirmar 2ª parcela: carta liberada automaticamente
```

---

## 6. Planejamento: Dark/Light Mode no StudentOnboarding

**Status:** Planejado — execução agendada para 2026-05-01  
**Plano salvo em:** `C:\Users\victurib\.claude\plans\luminous-beaming-platypus.md`

### Diagnóstico

- StudentDashboard: toggle funcional (localStorage + `document.documentElement.classList`)
- StudentOnboarding: **100% hardcoded em dark** — nenhuma classe `dark:` em nenhum dos 11 componentes

### Escopo do Plano

**11 arquivos** a modificar:

| # | Arquivo |
|---|---|
| 1 | `StudentOnboarding.tsx` — toggle button + container bg |
| 2 | `StepIndicator.tsx` — progress card + dots |
| 3 | `SelectionFeeStep/index.tsx` |
| 4 | `MigmaSurveyStep.tsx` |
| 5 | `UniversitySelectionStep.tsx` |
| 6 | `DocumentsUploadStep.tsx` |
| 7 | `PaymentStep.tsx` |
| 8 | `DadosComplementaresStep.tsx` |
| 9 | `PlacementFeeStep.tsx` |
| 10 | `WaitingApprovalStep.tsx` |
| 11 | `AcceptanceLetterStep.tsx` |

**Paleta light mode (consistente com o dashboard):**

| Uso | Classe light |
|---|---|
| Fundo da página | `bg-[#fdf8f0]` |
| Cards | `bg-white` |
| Fundo sutil | `bg-[#f3ead9]` |
| Borda | `border-[#e8d5b7]` |
| Texto primário | `text-[#1f1a14]` |
| Texto secundário | `text-[#8a7b66]` |
| Gold accents | inalterados |

**Infraestrutura já pronta:** `main.tsx` inicializa a classe `.dark` a partir do localStorage na carga — nenhuma nova infraestrutura necessária.

---

## Resumo de Arquivos Modificados Hoje

| Repositório | Arquivo | Tipo de Mudança |
|---|---|---|
| MatriculaUSA | `src/hooks/useTransferForm.ts` | Bug fix crítico — webhook com `transfer_form_url` |
| Migma LP | `src/pages/StudentDashboard/StudentDashboard.tsx` | UX — instrução + UI confirmação transfer form |
| Migma LP | `src/pages/admin/AdminUserDetail.tsx` | Bug fix — exibição de `transfer_form_delivered_at` |
| Migma LP | `src/pages/admin/ScholarshipApprovalTab.tsx` | Remoção de input manual redundante |

---

## Pendências para Amanhã

1. **Dark/Light Mode no StudentOnboarding** — plano pronto, 11 arquivos a modificar
2. **Deploy do frontend MatriculaUSA** — necessário para que o fix do Transfer Form entre em produção

---

## 7. RFE Defense Invoices e Checkout (Refatoração de Valores e Labels)

### Diagnóstico
Para o produto **RFE Defense**, a cobrança é baseada na quantidade de evidências submetidas (units_only) e não tem preço base. No entanto:
1. O PDF de Invoice estava usando labels genéricas (`Qty` e `Unit Price`).
2. O Front-end do Checkout (`VisaCheckoutPage.tsx`) exibia a linha de `Preço Base: US$ 0.00`.
3. O front-end exibia a label de `Por dependente`, `Número de requerentes` e `Evidência X descrição X`.

### Correções Aplicadas

**1. Supabase Edge Function (`generate-invoice-pdf`)**
- Refatorado o template do Invoice para identificar pedidos com slug `rfe-defense`.
- Substituído `Qty` por **Evidence** e `Unit Price` por **Price per Evidence**.
- Implementado cálculo dinâmico de contagem de evidências no PDF (`(total - base) / extra_unit_price`).
- Faturamentos regerados com sucesso via script Node diretamente no servidor para testar ordens recentes (`ORD-20260417-7349` e `ORD-ZEL-1775775182142`).

**2. Ocultação do Preço Base no Frontend**
- Ocultado o bloco de **Preço Base** (`checkout.base_price`) condicionalmente quando o `productSlug === 'rfe-defense'` em `VisaCheckoutPage.tsx` e `CheckoutSuccess.tsx`.

**3. Atualização de Nomenclatura para Evidências (Múltiplos Idiomas)**
- Criadas as chaves de internacionalização (`evidence_description_label`, `per_evidence`, `evidences`) nos 4 arquivos de idiomas (`pt.json`, `en.json`, `es.json`, `fr.json`).
- **`QuantitySelector.tsx`**: Corrigido o bug onde o índice era renderizado duas vezes na string (`Evidência 1 descrição 1`). Agora renderiza corretamente `Descrição da evidência 1`.
- **`OrderSummary.tsx` e `CheckoutSuccess.tsx`**: Substituído o label de "Número de dependentes" e "Number of applicants" por **"Evidências"**.

---

## 8. UX: White-label Migma e 2nd Installment Overlay

### Correções Aplicadas
- **UI do 2nd Installment Payment**: Finalizado o comportamento de sucesso (`PaymentSuccess`) para a 2ª parcela. A tela agora utiliza o padrão MatriculaUSA de *blurred background* sobre o dashboard do aluno, ao invés de uma página isolada.
- **Remoção de referências ao MatriculaUSA**: Ajustado `AcceptanceLetterStep.tsx` e `StudentDashboard.tsx` para retirar citações como "Seu pacote foi enviado ao MatriculaUSA". Modificado para termos genéricos (ex: "nossa equipe"), garantindo a estratégia White-label da Migma.

---

## 9. Banco de Dados e MCP (Testes E2E)
- Verificado via Supabase MCP que o RPC `approve_migma_zelle_payment` já lida corretamente com aprovações duplicadas do N8N (descartando o payload redundante).
- Resetado `transfer_form_filled_url` e `transfer_form_student_status` de um usuário teste (`nouradine2191@uorak.com`) para validar novamente o fluxo E2E de upload de formulários de transferência.

---

*Relatório gerado em 2026-04-30 | Branch: tracking-paulo*
