# Documentação Técnica: Implementação do Parcelow

Esta documentação detalha a implementação completa do Parcelow (gateway de pagamentos para parcelamento via cartão de crédito brasileiro) no sistema Migma. A integração envolve desde o acionamento no frontend, a geração do link de checkout, até o processamento profundo no webhook após o pagamento.

---

## 1. Visão Geral do Fluxo

O fluxo de pagamento via Parcelow segue 4 etapas principais:
1. **Seleção e Coleta de Dados:** O usuário escolhe o Parcelow no frontend e fornece os dados necessários (como CPF e Nome impresso no cartão).
2. **Geração do Checkout:** O frontend invoca uma Edge Function do Supabase (`create-parcelow-checkout`) que se comunica com a API do Parcelow para gerar uma sessão de pagamento.
3. **Redirecionamento:** O cliente é redirecionado para o URL de pagamento oficial da Parcelow para inserir os dados do cartão de crédito.
4. **Processamento do Webhook:** O Parcelow processa o pagamento e envia um evento (Webhook) para a Edge Function `parcelow-webhook`, que valida o pagamento, gera contratos, envia e-mails e lida com lógicas avançadas como Split Payment e Recorrências.

---

## 2. Implementação no Frontend

A chamada para criar o checkout ocorre em páginas como `EB3InstallmentCheckout.tsx` ou no `Step3Payment.tsx` do fluxo da Visa. 

Quando a opção `parcelow` é escolhida nas etapas de pagamento:
- São exigidos campos extras específicos para pagamentos via cartão de crédito no formato brasileiro: **Brazilian CPF** e **Name on Card**.
- É possível preencher configurações alternativas (caso o pagador seja um terceiro) via o componente `PayerAlternativeForm`.
- Um objeto `visa_orders` é inicialmente criado com o status `pending`.

**Trecho de Acionamento do Checkout no Frontend:**
```typescript
const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke(
    'create-parcelow-checkout',
    {
        body: {
            order_id: orderData.id,
            amount: totalAmount,
            currency: 'USD',
            customer_email: installment.client_email,
            customer_name: installment.client_name,
            description: `Migma Checkout...`,
            metadata: {
                type: '...', // ex: 'eb3-installment'
                schedule_id: installment.id, // Opcional
                cpf: payerInfo?.cpf || cpf,
                payer_info: payerInfo
            }
        }
    }
);

if (!checkoutError && checkoutData?.checkoutUrl) {
    // Redireciona para o link de pagamento do Parcelow
    window.location.href = checkoutData.checkoutUrl;
}
```

A base de interação interna entre tipos também ocorre utilizando o `ParcelowService` (`src/features/visa-checkout/services/payment/parcelowService.ts`).

---

## 3. O Webhook de Confirmação (`parcelow-webhook`)

O arquivo principal que gerencia o estado final das compras é a **Edge Function `parcelow-webhook`** localizada em `supabase/functions/parcelow-webhook/index.ts`. 

Essa Edge Function possui uma arquitetura altamente sofisticada, lidando com os seguintes fluxos:

### 3.1. Processamento de Split Payment
Logo que o webhook recebe o payload, ele busca de forma preemptiva por ocorrências na tabela `split_payments`, tentando casar o `order.id` retornado pelo Parcelow com `part1_parcelow_order_id` ou `part2_parcelow_order_id`.

- **Se for detectado um Split:**
  - O webhook verifica se a respectiva parte está como `"event_order_paid"`.
  - Atualiza a parte correspondente na tabela de `split_payments`.
  - Checa se **ambas as partes** foram pagas. Caso apenas a Parte 1 tenha sido paga, ele mantém a confirmação travada esperando a Parte 2.
  - Se ambas estiverem pagas, ele une e consolida a ordem principal em `visa_orders`, calculando os pagamentos totais (Fees, USD, BRL) para criar a meta-data unificada.

### 3.2. Pagamentos Regulares
Caso não seja um Split Payment, a Engine consulta a tabela `visa_orders` baseando-se na coluna de relacionamento `parcelow_order_id` (que é previamente atrelada). Dependendo da resposta da Parcelow ele atualiza os status:
- `event_order_paid` -> `completed`
- `event_order_declined` -> `failed`
- `event_order_canceled` -> `cancelled`

### 3.3. Pós-Processamento e Integrações (Sucesso)
Assim que uma ordem (ou o conjunto de split) atinge o status `completed`, uma série de automações entram em vigor no Webhook:

1. **Atualização de Tabelas Relacionadas:** 
   O webhook atualiza não só a `visa_orders`, mas também marca pagadores em tabelas espelho (`payments`, `service_requests`) e gera um evento de "payment_completed" na tabela de analíticos dos vendedores (`seller_funnel_events`).
   
2. **Ativações de Lógicas de Recorrência (RPC):**
   - **Job Catalog (EB-3):** Caso o `product_slug` seja `eb3-installment-catalog`, invoca a Procedure `activate_eb3_recurrence` para registrar a matriz das 8 parcelas de manutenção do cliente.
   - **Scholarship (F1):** Caso seja `scholarship-maintenance-fee`, ativa a Procedure `activate_scholarship_recurrence`.
   - Caso seja um simples **pagamento de parcela** do plano (checado via `payment_metadata.eb3_schedule_id`), a RPC `mark_eb3_installment_paid` marca a parcela ativa como paga.

3. **Geração Silenciosa de PDFs:**
   Invoca micro-serviços assíncronos (`generate-visa-contract-pdf`, `generate-annex-pdf` e `generate-invoice-pdf`) que constroem de imediato os PDFs das documentações e integram as assinaturas eletrônicas preenchidas na Etapa 2 do Frontend.

4. **Notificações via Email:**
   O Webhook finaliza o fluxo chamando o `send-payment-confirmation-email` para despachar o email rico ao cliente (contendo os PDFs via anexo ou link), além de disparar um aviso administrativo (`send-admin-payment-notification`).

---

## 4. Tipos e Entidades do Parcelow
Para modelagem interna dentro dos serviços da aplicação, o Parcelow atua através da biblioteca construída nos arquivos (`src/lib/parcelow/parcelow-checkout.ts` e `parcelow-types.ts`):
- `ParcelowClientData`: Coleta os dados limpos do cliente para geração das cobranças, incluindo estritamente o `cpf` e o endereço faturado completo.
- `ParcelowCreateOrderRequest`: Monta o payload complexo contendo os links de redirecionamento (caso configurados), os itens ("reference", "amount") onde os preços são processados sempre transformados de/para **centavos** (`amountInCents = Math.round(orderData.total_price_usd * 100)`).
