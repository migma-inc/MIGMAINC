# Documentação do Problema: Aplicação do Desconto no Checkout Parcelow

## 1. Visão Geral do Problema
O sistema de checkout permite a aplicação de cupons de desconto, mas o valor do desconto calculado não está sendo persistido corretamente no banco de dados (`visa_orders`) no momento da criação do pedido. Como resultado, o pedido é enviado para a API de pagamento (Parcelow) com o valor "cheio", sem o desconto, causando cobrança indevida ao cliente e inconsistência nos registros.

## 2. Sintomas Observados
- O usuário aplica o cupom na interface e visualiza o desconto no "Resumo do Pedido" (frontend).
- No banco de dados, o campo `coupon_code` é salvo corretamente (ex: `INITIAL50%`).
- No entanto, o campo `discount_amount` é salvo como `0.00`.
- A API da Parcelow recebe o valor total original ($1000.00) em vez do valor com desconto ($800.00 ou outro).
- O log do sistema mostra `discount_amount: 0.00` mesmo quando o cupom está presente.

## 3. Análise da Causa Raiz

### Fluxo de Dados Atual (Com Falha)
1.  **Aplicação do Cupom:** O usuário digita o cupom. O componente `CouponSection` valida e atualiza o estado `appliedCoupon`.
2.  **Cálculo do Desconto:** O componente pai (`VisaCheckoutPage`) calcula o `discountAmount` (variável local) com base no `appliedCoupon`.
3.  **Sincronização de Estado (O Ponto Crítico):** Existe um `useEffect` em `VisaCheckoutPage` responsável por sincronizar essa variável local `discountAmount` para o estado global do formulário (`state.discountAmount`) através de `actions.setDiscountAmount`.
    ```typescript
    useEffect(() => {
        actions.setDiscountAmount(discountAmount);
    }, [discountAmount]);
    ```
4.  **Criação do Pedido:** Quando o usuário clica em "Pagar", o hook `usePaymentHandlers` lê `state.discountAmount` para inserir no banco.

### O "Race Condition" (Condição de Corrida)
O problema é que a atualização do estado via `useEffect` é assíncrona e pode não ter sido propagada completamente para o hook `usePaymentHandlers` no momento em que a função de pagamento é recriada ou executada.
- O `couponCode` funciona porque é atualizado diretamente no input.
- O `discountAmount` falha porque depende de um ciclo de renderização extra (`useEffect` -> `setState` -> `re-render`) para ficar disponível no `state` global que o handler de pagamento consome.

Como resultado, o handler de pagamento muitas vezes lê o valor inicial `0` em vez do valor calculado, enviando zero para o banco de dados.

## 4. Solução Proposta e Implementada

Para resolver isso definitivamente, devemos remover a dependência da sincronização de estado assíncrona para o valor crítico do desconto.

### Mudanças Realizadas:
1.  **Cálculo "Just-in-Time":** Em vez de confiar apenas em `state.discountAmount` (que pode estar desatualizado), passaremos o valor calculado do desconto diretamente como argumento para o hook `usePaymentHandlers`, garantindo que ele tenha o valor mais fresco disponível na renderização da página.
2.  **Atualização da Assinatura do Hook:** Modificar `usePaymentHandlers` para aceitar `discountAmount` explicitamente como parâmetro.
3.  **Lógica de Fallback:** Dentro do handler de pagamento, usar esse valor explícito prioritariamente.

Isso elimina o atraso da sincronização e garante que o valor que o usuário vê na tela (que é calculado na renderização) seja *exatamente* o mesmo enviado para o banco de dados.

---
**Status:** Correção técnica em andamento para implementar a passagem direta do valor.
