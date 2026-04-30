# Relatório Técnico: Correção Sistêmica de Taxas Stripe (Gross-up)

Este documento detalha o erro de cálculo encontrado nas integrações com Stripe em múltiplas Edge Functions do projeto e fornece o plano de ação para a correção.

## 1. Descrição do Problema

Atualmente, o sistema utiliza uma fórmula de **Markup (Adição Simples)** para repassar a taxa do Stripe ao cliente. No entanto, o Stripe cobra sua porcentagem sobre o **valor total processado** (valor bruto), e não sobre o valor líquido original.

### Fórmula Atual (Incorreta)
`Total = Líquido + (Líquido * 0.039) + $0.30`

### O Problema Matemático
Se o valor líquido desejado é **$1,000.00**:
1. O sistema calcula: `1000 + 39 + 0.30` = **$1,039.30**.
2. O Stripe processa **$1,039.30**.
3. O Stripe desconta 3.9% de $1,039.30 (~$40.53) + $0.30 = **$40.83**.
4. O valor recebido na conta é: `1,039.30 - 40.83` = **$998.47**.
**Perda: $1.53** (Essa perda aumenta proporcionalmente ao valor da transação).

---

## 2. Solução Proposta (Gross-up)

Para garantir que o valor recebido seja exatamente o valor líquido desejado, devemos usar a fórmula de **Gross-up**.

### Nova Fórmula (Correta)
`Total = (Líquido + $0.30) / (1 - 0.039)`

### Validação da Solução
Para o mesmo valor de **$1,000.00**:
1. O sistema calcula: `(1000 + 0.30) / 0.961` = **$1,040.89**.
2. O Stripe processa **$1,040.89**.
3. O Stripe desconta 3.9% de $1,040.89 (~$40.59) + $0.30 = **$40.89**.
4. O valor recebido na conta é: `1,040.89 - 40.89` = **$1,000.00**.
**Resultado: Valor líquido preservado.**

---

## 3. Funções Afetadas (Para Correção Amanhã)

As seguintes funções foram identificadas com o cálculo de Markup e precisam ser atualizadas:

### A. `create-application-fee-checkout` (Step 6 Onboarding)
*   **Arquivo:** `supabase/functions/create-application-fee-checkout/index.ts`
*   **Linha:** 201
*   **Alteração:** Mudar para lógica de divisão (Gross-up).

### B. `create-visa-checkout-session` (Serviços Migma Inc)
*   **Arquivo:** `supabase/functions/create-visa-checkout-session/index.ts`
*   **Linha:** 283
*   **Observação:** O cálculo de PIX nesta função já utiliza a lógica correta de divisão, mas o de Cartão está incorreto.

### C. `migma-student-stripe-checkout`
*   **Arquivo:** `supabase/functions/migma-student-stripe-checkout/index.ts`
*   **Linha:** 44
*   **Alteração:** Mudar para lógica de divisão (Gross-up).

---

## 4. Próximos Passos (Ação Requerida)

1.  Aplicar as alterações em todas as funções acima.
2.  Realizar o **Deploy** de cada função via Supabase CLI ou ferramenta de deploy:
    ```bash
    supabase functions deploy create-application-fee-checkout
    supabase functions deploy create-visa-checkout-session
    supabase functions deploy migma-student-stripe-checkout
    ```
3.  Validar se os valores no dashboard do Stripe batem exatamente com o valor esperado (líquido).

---
**Nota:** Conforme solicitado, o método PIX não será o foco desta correção, mantendo-se as atenções na preservação do valor líquido em transações de cartão de crédito USD.
