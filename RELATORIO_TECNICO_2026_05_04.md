# Relatório Técnico - 2026-05-04

## Atividades Realizadas

### TASK: Debugging Zelle Payment Inconsistency (Renan Lima Regis)
- **Problema**: O pedido ORD-20260502-3113 (Renan Lima Regis) exibia status "0/2" no dashboard administrativo, apesar de ser um pagamento único via Zelle.
- **Causa**: O registro na tabela `visa_orders` estava com `is_split_payment = true` e possuía um `split_payment_id` associado incorretamente.
- **Soluções Aplicadas**:
  - **Cleanup de Banco de Dados**:
    - Atualizado `visa_orders` para definir `is_split_payment = false` e `split_payment_id = NULL`.
    - Aprovado o pagamento Zelle na tabela `zelle_payments`.
    - Atualizado o status da `service_requests` para `paid`.
    - Cancelado o registro órfão na tabela `split_payments`.
  - **Melhoria no Frontend**:
    - Adicionada lógica defensiva no componente `VisaOrdersPage.tsx` para garantir que o progresso de parcelamento só seja exibido se o método de pagamento for `parcelow`. Isso evita que inconsistências nos dados do banco afetem a exibição de pagamentos via Zelle ou Stripe Direto.
- **Resultado**: O status do cliente agora aparece corretamente como pago e sem o indicador de parcelas "0/2".

### TASK: Debugging Global Partner Contract Signature (Igor Luiz do Carmo Rodrigues)
- **Problema**: O parceiro Igor Luiz do Carmo Rodrigues não conseguia finalizar a assinatura do contrato, ficando travado na mensagem "Processando seu aceite...".
- **Causa**: Identificado que chamadas externas para serviços de busca de IP (`api.ipify.org`) e geolocalização (`ipapi.co`) no frontend (`PartnerTerms.tsx`) não possuíam timeout. Em conexões restritas ou lentas, essas chamadas podiam travar a execução do `handleAccept`, impedindo a atualização do banco de dados e a navegação. Além disso, o envio de e-mail de confirmação era um processo bloqueante (`await`).
- **Soluções Aplicadas**:
  - **Timeouts e Resiliência**:
    - Adicionado timeout de 4s para a busca de IP no componente `PartnerTerms.tsx`.
    - Adicionado timeout de 5s para a API de geolocalização no helper `contracts.ts`.
    - Adicionado tratamento de erro robusto (`AbortError`) para garantir que o fluxo continue mesmo se as APIs externas falharem (dados não críticos).
  - **Otimização de Performance**:
    - Removido o `await` do envio de e-mail de confirmação no frontend, tornando-o um processo não bloqueante que não impede a navegação imediata do usuário após a assinatura ser salva no banco.
  - **Melhoria de Debug**:
    - Adicionados diversos pontos de log (`console.log/warn`) no fluxo de submissão para facilitar o rastreamento em casos futuros de falha.
- **Resultado**: O fluxo de assinatura tornou-se resiliente a falhas ou lentidão de APIs externas de terceiros, garantindo que o registro no banco de dados seja priorizado e o usuário não fique travado na interface.

---

## Sessão Tarde — 2026-05-04

### 1. Fix KPI `soldContracts` — Inflação por Sufixos Dinâmicos de Slug

**Problema:** O KPI `soldContracts` no dashboard do vendedor inflava o número de contratos quando um mesmo cliente possuía múltiplos pedidos do mesmo produto com sufixos numéricos diferentes (ex: `transfer-selection-process-12` vs `transfer-selection-process-22`). A lógica de deduplicação em `isFirstPayment()` usava comparação exata de `product_slug`, não reconhecendo esses como o mesmo produto.

**Arquivos modificados:** `src/lib/seller-analytics.ts`

**Solução aplicada:**
- Adicionada função `normalizeSlug(slug)` — converte para lowercase e remove todos os caracteres não-alfanuméricos (padrão idêntico ao `AdminTracking`).
- Adicionada função `getBaseSlug(productSlug)` — remove sufixos dinâmicos (`-\d+`, `-outstanding`, `-\d+-of-\d+`) antes de normalizar.
- Alterado o step 4 de `isFirstPayment()`: comparação de slug trocada de `o.product_slug === order.product_slug` para `getBaseSlug(o.product_slug) !== orderBaseSlug`.

```ts
function normalizeSlug(slug: string): string {
  return slug.toLowerCase().replace(/[^a-z0-9]/g, '');
}
function getBaseSlug(productSlug: string | null | undefined): string {
  if (!productSlug) return '';
  const stripped = productSlug
    .replace(/-\d+-of-\d+$/, '')
    .replace(/-outstanding$/, '')
    .replace(/-\d+$/, '');
  return normalizeSlug(stripped);
}
```

**Resultado:** `transfer-selection-process-12` e `transfer-selection-process-22` são tratados como o mesmo produto para fins de deduplicação. KPI `soldContracts` não infla mais por sufixos numéricos dinâmicos.

---

### 2. Fix Build Error — Imports Não Utilizados em `SellerAnalytics.tsx`

**Problema:** Erro de build por imports de `PeriodFilter` e `ExportButton` declarados mas não utilizados no componente.

**Arquivo modificado:** `src/pages/seller/SellerAnalytics.tsx`

**Solução:** Removidos os imports de componente (`PeriodFilter`, `ExportButton`). Mantidos apenas os imports de tipo (`PeriodOption`, `CustomDateRange`).

---

### 3. Habilitação do Serviço "Initial Application" nos Links de Onboarding

**Problema:** O serviço `Initial Application` (processo F-1 para quem está fora dos EUA) estava com `available: false` em `SellerStudentLinks.tsx`, impedindo que vendedores e admins gerassem o link de onboarding para esse serviço.

**Arquivo modificado:** `src/pages/seller/SellerStudentLinks.tsx`

**Solução:**
```ts
// ANTES
{ key: 'initial', label: 'Initial Application', description: 'First-time F-1 visa application', available: false },

// DEPOIS
{ key: 'initial', label: 'Initial Application', description: 'First-time F-1 visa application', available: true },
```

**Resultado:** Card "Initial Application" aparece habilitado em `/seller/dashboard/student-links` e `/dashboard/student-links`. Link gerado no formato `/student/checkout/initial?ref={seller_id_public}`.

---

### 4. Remoção do Stripe de Todos os Fluxos de Pagamento do Aluno

**Problema:** O método de pagamento Stripe ainda aparecia em múltiplos componentes do fluxo de onboarding e dashboard do aluno. Decisão de produto: apenas Zelle e Parcelow disponíveis para o aluno.

**Arquivos modificados:**
- `src/pages/MigmaCheckout/components/Step1PersonalInfo.tsx`
- `src/pages/StudentOnboarding/components/PaymentStep.tsx`
- `src/pages/StudentOnboarding/components/PlacementFeeStep.tsx`
- `src/pages/StudentDashboard/PlacementFee2ndInstallmentPage.tsx`

**Ações por arquivo:**
- Removido botão/card do Stripe do JSX em todos os 4 arquivos.
- Removido componente inline `StripeIcon` (SVG definido localmente em cada arquivo).
- Removido import e uso de `calculateCardAmountWithFees` em todos os arquivos.
- Simplificada expressão condicional no botão de pagamento: `(selectedMethod === 'stripe' ? cardAmount : fee)` → `fee` diretamente.

**Erros de build corrigidos no processo:**
- `StripeIcon` declarado mas nunca lido (era componente inline, não import).
- `cardAmount` / `cardAmountDue` referenciados no JSX após remoção da variável.
- `;` órfão em `PlacementFee2ndInstallmentPage.tsx` após remoção do bloco do `StripeIcon`.

---

### 5. Fix Crítico — Bypass de Pagamento via URL `?success=true`

**Problema:** `MigmaCheckout/index.tsx` possuía um fallback em `handleVerifyAndAdvance()` que, após 3 tentativas de polling sem confirmação de pagamento no banco, forçava `paymentConfirmed: true` e avançava o aluno para o Step 2. Isso permitia que qualquer pessoa abrisse o checkout externo (Parcelow/Zelle), saísse sem pagar, e retornasse com `?success=true` na URL para ser marcada como paga.

**Arquivo modificado:** `src/pages/MigmaCheckout/index.tsx`

**Solução:**
- Removido o bloco que forçava avanço após timeout (linhas ~261–272).
- Adicionado estado `paymentVerificationFailed`.
- Quando polling esgota sem confirmação no banco: exibe banner de erro vermelho com botão "Verificar novamente" — aluno **não avança**.

```tsx
// ANTES — forçava avanço
dispatch({ type: 'SET_PAYMENT_CONFIRMED', payload: true });

// DEPOIS — bloqueia e mostra erro
console.warn('[MigmaCheckout] ⚠️ Pagamento não confirmado no banco após 3 tentativas. Não avançando.');
setPaymentVerificationFailed(true);
```

**Resultado:** Aluno só avança para Step 2 mediante confirmação real no banco de dados via webhook. Não é mais possível bypassar o pagamento.

---

### 6. Reestruturação de Termos e Condições + Anexo I no Modal

**Problema:** O modal de Termos e Condições exibia contrato principal e Anexo I concatenados com separador de traços (`----`). Além disso, o texto "Anexo I" no checkbox 1 não era clicável de forma independente.

**Arquivos modificados:**
- `src/pages/MigmaCheckout/components/TermsModal.tsx`
- `src/pages/MigmaCheckout/components/Step1PersonalInfo.tsx`

**Solução:**
- Separados `mainContractText` e `annexText` em estados distintos no `Step1PersonalInfo`.
- Renderizados **dois modais independentes**: um para o contrato (`termsOpen`) e outro para o Anexo I (`annexOpen`).
- `TermsModal` simplificado: sem abas, exibe apenas o conteúdo recebido via prop.
- Checkbox 1: "Termos e Condições" abre modal do contrato; "Anexo I" abre modal do anexo. Ambos clicáveis e independentes.
- Checkbox 2: "Termos e Condições" abre apenas modal do contrato.

**Resultado:** Usuário vê contrato puro ao clicar em "Termos e Condições" e anexo puro ao clicar em "Anexo I". Sem mistura de conteúdo.

---

### 7. Parcelow — Remoção de "Cartão Brasileiro" + Disponibilidade Global + Disclaimer

**Problema:** O método `parcelow_card` tinha label "Parcelow – Cartão Brasileiro" e estava restrito à região `BR`. Com a aceitação de cartões americanos pelo Parcelow, o label precisava ser neutro e o método precisava estar disponível para todas as regiões. Além disso, faltava disclaimer sobre o comportamento de parcelamento para cartões internacionais.

**Arquivos modificados:**
- `src/locales/pt.json`
- `src/locales/en.json`
- `src/locales/es.json`
- `src/locales/fr.json`
- `src/pages/MigmaCheckout/components/Step1PersonalInfo.tsx`

**Mudanças nos locales (todas as 4 línguas):**

| Campo | Antes | Depois |
|---|---|---|
| `method_parcelow_card_label` (pt) | Parcelow – Cartão Brasileiro | Parcelow – Cartão |
| `method_parcelow_card_sub` (pt) | Pagamento parcelado em BRL (até 12x) | Cartão de crédito via Parcelow |
| `parcelow_card_us_notice` (pt) | — | O Parcelow aceita cartões americanos e brasileiros. Cartões internacionais são processados em cobrança única — parcelamento disponível apenas para cartões brasileiros. |

**Mudanças no componente:**
- `regions` de `parcelow_card`: `['BR']` → `['US', 'BR', 'OTHER']`
- Adicionado disclaimer em azul (idêntico ao visa-checkout) quando `method === 'parcelow_card'`

**Resultado:** Parcelow Cartão aparece para todos os usuários independente de IP. Disclaimer informa claramente sobre parcelamento condicional por tipo de cartão.

---

### 8. Análise: Modal de Detalhes de Universidade vs Spec v11.0

**Contexto:** Comparação entre a estrutura atual do `UniversitySelectionModal.tsx` e a Spec MIGMA INC v11.0 (seção 7.5).

**Status por seção:**

| Seção (Spec 7.5) | Status |
|---|---|
| Identificação (logo, nome, localização) | ✅ Implementado |
| Escolha do Nível de Bolsa (tabela interativa) | ⚠️ Sem calculadora de economia e sem badge "Mais Popular" |
| Quanto vou pagar? (AGORA / APÓS ACEITE / AO INICIAR / ANUALMENTE) | ⚠️ Presente, mas Application Fee exibe $250 em vez de $350 (erro de dado no Supabase, campo `application_fee_usd`) |
| Informações do Programa (cursos, CPT/OPT, duração) | ⚠️ Frequência presencial não exibida explicitamente |
| Requisitos (GPA, inglês, documentação + Bank Statement) | ✅ Implementado em "Entry Requirements" |
| FAQ Inline | ✅ Implementado |
| Benefício por Indicação | ✅ Implementado |

**Pendências identificadas (não implementadas nessa sessão):**
1. Calculadora automática de economia na seção de bolsa (ex: "Se você estudar 2 anos, você economiza $X")
2. Badge "Mais Popular" na linha mais escolhida da tabela de bolsas
3. Campo "Frequência presencial" explícito na seção de Informações do Programa
4. Correção do valor `application_fee_usd` no Supabase: $250 → $350 (dado, não código)

---

### Resumo de Arquivos Modificados na Sessão

| Arquivo | Tipo de Alteração |
|---|---|
| `src/lib/seller-analytics.ts` | Fix KPI — deduplicação por base slug |
| `src/pages/seller/SellerAnalytics.tsx` | Fix build — imports não utilizados |
| `src/pages/seller/SellerStudentLinks.tsx` | Feature — habilitar serviço Initial |
| `src/pages/MigmaCheckout/components/Step1PersonalInfo.tsx` | Stripe removal, Parcelow global, dois modais T&C/Anexo |
| `src/pages/MigmaCheckout/components/TermsModal.tsx` | Reestruturação — dois modais independentes |
| `src/pages/MigmaCheckout/index.tsx` | Fix crítico — bloqueio bypass de pagamento |
| `src/pages/StudentOnboarding/components/PaymentStep.tsx` | Stripe removal |
| `src/pages/StudentOnboarding/components/PlacementFeeStep.tsx` | Stripe removal |
| `src/pages/StudentDashboard/PlacementFee2ndInstallmentPage.tsx` | Stripe removal |
| `src/locales/pt.json` | Label Parcelow + disclaimer |
| `src/locales/en.json` | Label Parcelow + disclaimer |
| `src/locales/es.json` | Label Parcelow + disclaimer |
| `src/locales/fr.json` | Label Parcelow + disclaimer |
