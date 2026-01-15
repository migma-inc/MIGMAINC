# 📚 Documentação Completa - Integração Parcelow

**Data de Criação**: 13 de Janeiro de 2026  
**Última Atualização**: 13 de Janeiro de 2026  
**Status Geral**: 🟢 **Implementação Completa - Pronto para Testes (Sandbox Configurado)**

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Documentação da API Parcelow](#documentação-da-api-parcelow)
3. [Arquitetura da Integração](#arquitetura-da-integração)
4. [Checkout Parcelow](#checkout-parcelow)
5. [Webhook Parcelow](#webhook-parcelow)
6. [Banco de Dados](#banco-de-dados)
7. [Configuração e Variáveis de Ambiente](#configuração-e-variáveis-de-ambiente)
8. [Status Atual e Bloqueadores](#status-atual-e-bloqueadores)
9. [Fluxo Completo de Pagamento](#fluxo-completo-de-pagamento)
10. [Próximos Passos](#próximos-passos)

---

## 🎯 Visão Geral

A integração Parcelow permite que clientes brasileiros paguem serviços de visto em parcelas, utilizando cartão de crédito ou outros métodos de pagamento disponíveis na plataforma Parcelow. A integração foi desenvolvida seguindo a documentação oficial da API Parcelow versão 1.0.5.

### Objetivos da Integração

- ✅ Permitir pagamento parcelado em reais (BRL) para o público brasileiro
- ✅ Redirecionar cliente para checkout Parcelow (redirect flow)
- ✅ Receber notificações de status de pagamento via webhook
- ✅ Processar automaticamente confirmações de pagamento
- ✅ Gerar contratos e enviar emails após pagamento confirmado

### Características Técnicas

- **Autenticação**: OAuth 2.0 (Client Credentials Grant)
- **Ambientes**: Sandbox (`https://sandbox.parcelow.com`) e Production (`https://app.parcelow.com`)
- **Moedas Suportadas**: USD (Dólar) e BRL (Real)
- **Métodos de Pagamento**: Cartão de crédito, PIX, TED (conforme disponibilidade Parcelow)
- **Parcelamento**: Até 12x (conforme condições Parcelow)

---

## 📖 Documentação da API Parcelow

### Link Oficial

**Swagger Documentation**: https://app.swaggerhub.com/apis/ParcelowAPI/parcelow-api/1.0.5

### Endpoints Principais Utilizados

#### 1. Autenticação OAuth

**Endpoint**: `POST /oauth/token`

**Descrição**: Gera token de autenticação para consumo da API. O `grant_type` é obrigatório e fixo com `client_credentials`.

**Request Body** (JSON ou form-urlencoded):
```json
{
  "client_id": 1118,
  "client_secret": "uQsbSCdQ1c98yT7xL20ur1M5p5FUhg802nvut7Ar",
  "grant_type": "client_credentials"
}
```

**Response**:
```json
{
  "token_type": "Bearer",
  "expires_in": 31536000,
  "access_token": "eyJ0eiOiJSUzI1NiJ9..."
}
```

**Observações Importantes**:
- A API aceita tanto `application/json` quanto `application/x-www-form-urlencoded`
- Para Client IDs numéricos (produção), funciona melhor com `form-urlencoded`
- Para Client IDs hexadecimais (staging), pode funcionar com JSON
- Token expira em 1 ano (31536000 segundos)

#### 2. Simular Valores e Parcelamento

**Endpoint**: `GET /api/simulate?amount={valor_em_centavos}`

**Descrição**: Consulta valores em reais por um valor em dólar. Retorna opções de parcelamento e taxas de câmbio.

**Exemplo de Response**:
```json
{
  "data": {
    "order": "1042.93",
    "dolar": "5.7333",
    "ted": {
      "amount": "5869.50"
    },
    "creditcard": [
      {
        "installment": 1,
        "monthly": "6062.40",
        "total": "6062.40"
      },
      {
        "installment": 2,
        "monthly": "3061.21",
        "total": "6122.43"
      }
      // ... até 12 parcelas
    ]
  }
}
```

#### 3. Criar Order em Dólar

**Endpoint**: `POST /api/orders`

**Descrição**: Cria uma nova order em dólar (USD). Todos os valores devem ser enviados em centavos.

**Request Body**:
```json
{
  "reference": "ORD-20260113-4814",
  "partner_reference": "7b9d7437-285b-45e6-ac11-5154024eef91",
  "client": {
    "cpf": "99987954687",
    "name": "John Doe",
    "email": "john@doe.com",
    "birthdate": "1982-01-14",
    "phone": "15985698569",
    "cep": "12345698"
  },
  "items": [
    {
      "reference": "ORD-20260113-4814",
      "description": "Order ORD-20260113-4814 - John Doe",
      "quantity": 1,
      "amount": 1000000
    }
  ],
  "redirect": {
    "success": "https://example.com/checkout/success?order_id=...",
    "failed": "https://example.com/checkout/cancel?order_id=..."
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "order_id": 58,
    "url_checkout": "https://sandbox.splipay.com/payment/4openRe7Az/kzPdyP7bQr"
  }
}
```

#### 4. Criar Order em Reais

**Endpoint**: `POST /api/orders/brl`

**Descrição**: Similar ao endpoint anterior, mas todos os valores devem ser enviados em BRL (Real Brasileiro).

#### 5. Consultar Order

**Endpoint**: `GET /api/order/{orderId}`

**Descrição**: Busca uma order pelo ID. Retorna dados atualizados da transação e URL atualizada para pagamento se ainda não estiver finalizada.

### Cadastrar Client de Acesso

Conforme a documentação oficial:

> "Para ter acesso à API, primeiramente deve-se solicitar por e-mail o cadastramento de seu client. É necessário que o sistema que está integrando tenha uma Account já ativa no sistema Parcelow. Ao solicitar o cadastramento do client é necessário enviar uma URL padrão para receber notificações POST (webhook) com a atualização dos pedidos feitos através da API. Então você receberá o `client_id` e o `client_secret` que devem ser guardados em segurança e utilizados para autenticação na API."

**URL do Webhook para Informar**:
```
https://ekxftwrjvxtpnqbraszv.supabase.co/functions/v1/parcelow-webhook
```

---

## 🏗️ Arquitetura da Integração

### Estrutura de Arquivos

```
migma-lp/
├── src/
│   ├── lib/
│   │   └── parcelow/
│   │       ├── parcelow-types.ts          # Tipos TypeScript
│   │       ├── parcelow-client.ts         # Cliente da API
│   │       ├── parcelow-simulate.ts       # Simulação de valores
│   │       └── parcelow-checkout.ts       # Integração checkout
│   └── pages/
│       └── VisaCheckout.tsx              # UI do checkout (modificado)
│
├── supabase/
│   ├── functions/
│   │   ├── create-parcelow-checkout/
│   │   │   └── index.ts                  # Edge Function: Criar checkout
│   │   └── parcelow-webhook/
│   │       └── index.ts                  # Edge Function: Processar webhooks
│   └── migrations/
│       └── 20260112000001_add_parcelow_fields_to_visa_orders.sql
│
└── docs/
    └── PARCELOW_INTEGRACAO_COMPLETA.md   # Esta documentação
```

### Componentes Principais

#### 1. Frontend (`src/lib/parcelow/`)

**`parcelow-types.ts`** (216 linhas)
- Define todos os tipos TypeScript para a API Parcelow
- Interfaces para: tokens, orders, clientes, pagamentos, webhooks
- Tipos para simulação de valores e parcelamento

**`parcelow-client.ts`** (311 linhas)
- Cliente da API Parcelow com autenticação OAuth
- Gerenciamento automático de tokens (refresh automático)
- Retry logic com exponential backoff
- Métodos para todas as operações da API

**`parcelow-simulate.ts`** (95 linhas)
- Funções para simular valores e parcelamento
- Formatação de opções de parcelamento
- Cálculo de totais com juros

**`parcelow-checkout.ts`** (95 linhas)
- Integração com checkout de produtos
- Preparação automática de dados do cliente

#### 2. Backend (Edge Functions)

**`create-parcelow-checkout`** (690+ linhas)
- Cria checkout Parcelow
- Autenticação OAuth
- Busca dados do cliente no banco
- Cria order na API Parcelow
- Salva dados no banco

**`parcelow-webhook`** (650+ linhas)
- Processa webhooks da Parcelow
- Atualiza status de pagamento
- Gera PDFs e envia emails
- Envia webhooks para n8n

---

## 🛒 Checkout Parcelow

### Fluxo de Criação de Checkout

1. **Cliente seleciona Parcelow no checkout**
   - Frontend chama `handleParcelowPayment()`
   - Envia requisição para Edge Function `create-parcelow-checkout`

2. **Edge Function processa requisição**
   - Busca order no banco de dados
   - Busca CPF do cliente (via `service_request_id` → `clients`)
   - Valida CPF obrigatório
   - Autentica com Parcelow (OAuth)
   - Cria order na API Parcelow
   - Salva dados Parcelow no banco

3. **Retorno para frontend**
   - Edge Function retorna `url_checkout` da Parcelow
   - Frontend redireciona cliente para URL Parcelow

4. **Cliente paga na Parcelow**
   - Cliente completa pagamento na plataforma Parcelow
   - Parcelow redireciona para URLs de sucesso/falha

### Edge Function: `create-parcelow-checkout`

**Localização**: `supabase/functions/create-parcelow-checkout/index.ts`

**Endpoint**: `https://ekxftwrjvxtpnqbraszv.supabase.co/functions/v1/create-parcelow-checkout`

**Método**: POST

**Request Body**:
```json
{
  "order_id": "uuid-do-order",
  "currency": "USD" // ou "BRL"
}
```

**Response (Sucesso)**:
```json
{
  "success": true,
  "checkout_url": "https://sandbox.splipay.com/payment/...",
  "parcelow_order_id": 58,
  "order_number": "ORD-20260113-4814"
}
```

**Response (Erro)**:
```json
{
  "error": "Mensagem de erro",
  "details": "Detalhes adicionais"
}
```

### Funcionalidades Implementadas

✅ **Autenticação OAuth**
- Suporte para Client IDs numéricos e hexadecimais
- Cache de tokens (evita requisições desnecessárias)
- Retry automático em caso de falha

✅ **Busca de Dados do Cliente**
- Busca CPF automaticamente via `service_request_id`
- Validação e limpeza de CPF/CNPJ
- Tratamento de dados faltantes

✅ **Criação de Order**
- Suporte para USD e BRL
- Preparação automática de dados
- URLs de redirect configuráveis

✅ **Logs Detalhados**
- Logs em todas as etapas
- Facilita debugging
- Rastreamento de erros

✅ **Tratamento de Erros**
- Mensagens de erro claras
- Validação de dados
- Fallbacks quando necessário

### Variáveis de Ambiente Necessárias

```bash
# Obrigatórias
PARCELOW_CLIENT_ID=1118                    # ou PARCELOW_CLIENT_ID_STAGING/PRODUCTION
PARCELOW_CLIENT_SECRET=uQsbSCdQ1c98y...    # ou PARCELOW_CLIENT_SECRET_STAGING/PRODUCTION
PARCELOW_ENVIRONMENT=production            # ou "staging"

# Opcionais (com fallback)
SITE_URL=https://seu-site.com              # Para URLs de redirect
SUPABASE_URL=https://...supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
```

### Exemplo de Uso no Frontend

```typescript
// Em VisaCheckout.tsx
const handleParcelowPayment = async () => {
  try {
    const { data, error } = await supabase.functions.invoke('create-parcelow-checkout', {
      body: {
        order_id: orderId,
        currency: 'USD'
      }
    });

    if (error) throw error;

    if (data.checkout_url) {
      window.location.href = data.checkout_url;
    }
  } catch (error) {
    console.error('[Parcelow] Error:', error);
  }
};
```

---

## 🔔 Webhook Parcelow

### Visão Geral

O webhook Parcelow é responsável por receber notificações da Parcelow sobre mudanças de status de pedidos. Quando um pagamento é confirmado, o webhook processa automaticamente:

1. Atualização de status no banco de dados
2. Geração de PDFs (contrato e ANNEX I)
3. Envio de email de confirmação
4. Webhooks para n8n (cliente e dependentes)
5. Tracking em `seller_funnel_events`

### Edge Function: `parcelow-webhook`

**Localização**: `supabase/functions/parcelow-webhook/index.ts`

**Endpoint**: `https://ekxftwrjvxtpnqbraszv.supabase.co/functions/v1/parcelow-webhook`

**Método**: POST

**JWT Verification**: Desabilitado (necessário para webhooks externos)

**Versão Deployada**: 19

**Status**: ACTIVE

### Eventos Suportados

A Parcelow envia os seguintes eventos (conforme documentação):

| Evento | Descrição | Ação no Sistema |
|--------|-----------|-----------------|
| `event_order_paid` | Pagamento confirmado | ✅ Processa fluxo completo |
| `event_order_confirmed` | Order confirmada | ℹ️ Atualiza status |
| `event_order_declined` | Pagamento recusado | ❌ Status: `failed` |
| `event_order_canceled` | Order cancelada | ❌ Status: `cancelled` |
| `event_order_expired` | Order expirada | ❌ Status: `cancelled` |
| `event_order_waiting` | Aguardando ação | ⏸️ Status: `pending` |
| `event_order_waiting_payment` | Aguardando pagamento | ⏸️ Status: `pending` |
| `event_order_waiting_docs` | Aguardando documentos | ⏸️ Status: `pending` |

### Estrutura do Webhook Payload

```json
{
  "event": "event_order_paid",
  "data": {
    "id": 5060,
    "reference": "ORD-20260113-4814",
    "status": 1,
    "status_text": "Paid",
    "order_amount": 10000,
    "total_usd": 10000,
    "total_brl": 54208,
    "installments": 1,
    "order_date": "2021-08-04T13:47:07.000000Z",
    "client": {
      "name": "Cliente Teste",
      "email": "clienteteste@teste.com",
      "cpf": "999.999.999-99"
    },
    "items": [...]
  }
}
```

### Fluxo de Processamento

#### 1. Recebimento do Webhook

```typescript
// Webhook recebe requisição POST da Parcelow
const event = JSON.parse(bodyText);
// Valida JSON e processa evento
```

#### 2. Busca da Order no Banco

```typescript
// Busca order por parcelow_order_id ou reference
const { data: order } = await supabase
  .from("visa_orders")
  .select("*")
  .or(`parcelow_order_id.eq.${data.id},reference.eq.${data.reference}`)
  .single();
```

#### 3. Atualização de Status

```typescript
// Atualiza visa_orders com novo status
await supabase
  .from("visa_orders")
  .update({
    payment_status: "completed",
    payment_method: "parcelow",
    parcelow_status: data.status_text,
    parcelow_status_code: data.status,
    payment_metadata: {
      parcelow_order_id: data.id,
      installments: data.installments,
      total_usd: data.total_usd,
      total_brl: data.total_brl,
      completed_at: new Date().toISOString()
    }
  })
  .eq("id", order.id);
```

#### 4. Processamento Pós-Pagamento (Apenas para `event_order_paid`)

**4.1. Atualização de `payments`**
```typescript
if (order.service_request_id) {
  await supabase
    .from("payments")
    .update({
      status: "paid",
      external_payment_id: data.id.toString(),
      raw_webhook_log: { /* detalhes do evento */ }
    })
    .eq("service_request_id", order.service_request_id);
}
```

**4.2. Atualização de `service_requests`**
```typescript
await supabase
  .from("service_requests")
  .update({ status: "paid" })
  .eq("id", order.service_request_id);
```

**4.3. Tracking em `seller_funnel_events`**
```typescript
if (order.seller_id) {
  await supabase
    .from('seller_funnel_events')
    .insert({
      seller_id: order.seller_id,
      event_type: 'payment_completed',
      metadata: { /* detalhes do pagamento */ }
    });
}
```

**4.4. Geração de PDFs**
```typescript
// Gera PDF do contrato completo
await supabase.functions.invoke("generate-visa-contract-pdf", {
  body: { order_id: order.id }
});

// Gera PDF do ANNEX I (obrigatório para todos)
await supabase.functions.invoke("generate-annex-pdf", {
  body: { order_id: order.id }
});
```

**4.5. Envio de Email**
```typescript
await supabase.functions.invoke("send-payment-confirmation-email", {
  body: {
    clientName: order.client_name,
    clientEmail: order.client_email,
    orderNumber: order.order_number,
    productSlug: order.product_slug,
    paymentMethod: "parcelow",
    currency: "BRL" || "USD",
    finalAmount: data.total_usd || data.total_brl
  }
});
```

**4.6. Webhook para n8n**
```typescript
// Envia webhook principal para cliente
await sendClientWebhook(order, supabase);

// Envia webhooks separados para cada dependente
// (se houver dependentes)
```

### Função `sendClientWebhook`

A função `sendClientWebhook` envia webhooks para o n8n com dados do cliente e do pagamento.

**Payload Principal (Cliente)**:
```json
{
  "servico": "F1 Initial",
  "plano_servico": "initial-selection-process",
  "nome_completo": "João Silva",
  "whatsapp": "+5511999999999",
  "email": "joao@example.com",
  "valor_servico": "99.00",
  "vendedor": "seller-uuid",
  "quantidade_dependentes": 2
}
```

**Payload Dependente**:
```json
{
  "nome_completo_cliente_principal": "João Silva",
  "nome_completo_dependente": "Maria Silva",
  "valor_servico": "99.00"
}
```

**Variável de Ambiente Necessária**:
```bash
CLIENT_WEBHOOK_URL=https://seu-webhook-n8n.com/webhook
```

### Renotificação de Webhooks

Conforme a documentação Parcelow:

> "Se a URL cadastrada como webhook receber uma notificação e retornar um HTTP Status diferente de 200, consideramos que ocorreu uma falha no recebimento dessa notificação. Quando isso ocorrer, essa notificação será reenviada até 5 vezes seguindo as regras:
> - 5 minutos depois da primeira tentativa
> - 15 minutos depois da primeira tentativa
> - 45 minutos depois da primeira tentativa
> - 2 horas e 15 minutos depois da primeira tentativa
> - 6 horas e 45 minutos depois da primeira tentativa"

**Importante**: O webhook sempre deve retornar HTTP 200 para indicar sucesso, mesmo que haja erros não-críticos (como falha no envio de email).

### Cartão de Teste (Sandbox)

Utilize os dados abaixo para simular pagamentos aprovados no ambiente de Sandbox:

| Dado | Valor |
|------|-------|
| **Número do Cartão** | `5214254988499590` |
| **Expiração** | `03/26` |
| **CVV** | `220` |
| **Nome** | Qualquer nome |


### Logs e Debugging

O webhook possui logs detalhados em todas as etapas:

```
[Parcelow Webhook] ========== REQUEST RECEIVED ==========
[Parcelow Webhook] Event type: event_order_paid
[Parcelow Webhook] Parcelow Order ID: 5060
[Parcelow Webhook] ✅ Found order ORD-20260113-4814
[Parcelow Webhook] ✅ Updated order to status: completed
[Parcelow Webhook] 📋 Updating payment record...
[Parcelow Webhook] ✅ Payment record updated
[Parcelow Webhook] 📄 Generating contract PDF...
[Parcelow Webhook] ✅ Contract PDF generated successfully
[Parcelow Webhook] 📧 Sending payment confirmation email...
[Parcelow Webhook] ✅ Payment confirmation email sent
[Parcelow Webhook] ========== PROCESSING COMPLETE ==========
```

---

## 💾 Banco de Dados

### Migration Aplicada

**Arquivo**: `supabase/migrations/20260112000001_add_parcelow_fields_to_visa_orders.sql`

**Campos Adicionados à Tabela `visa_orders`**:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `parcelow_order_id` | TEXT | ID da order na Parcelow |
| `parcelow_checkout_url` | TEXT | URL do checkout Parcelow |
| `parcelow_status` | TEXT | Status textual (Open, Paid, Declined, etc.) |
| `parcelow_status_code` | INTEGER | Código numérico do status (0 = Open, etc.) |

**Índice Criado**:
```sql
CREATE INDEX idx_visa_orders_parcelow_order_id ON visa_orders(parcelow_order_id);
```

### Campos Relacionados

A tabela `visa_orders` também utiliza:

- `payment_method`: Agora pode ser `"parcelow"` (além de `stripe_card`, `stripe_pix`, `zelle`, `wise`)
- `payment_status`: Status do pagamento (`pending`, `completed`, `failed`, `cancelled`)
- `payment_metadata`: JSON com metadados do pagamento Parcelow:
  ```json
  {
    "payment_method": "parcelow",
    "completed_at": "2026-01-13T10:30:00Z",
    "parcelow_order_id": 5060,
    "installments": 3,
    "total_usd": 50000,
    "total_brl": 286665,
    "order_date": "2026-01-13T10:25:00Z"
  }
  ```

### Relacionamentos

- `visa_orders.service_request_id` → `service_requests.id`
- `visa_orders.seller_id` → `sellers.id` (opcional)
- `service_requests.client_id` → `clients.id` (para buscar CPF)

---

## ⚙️ Configuração e Variáveis de Ambiente

### Variáveis Obrigatórias

**Local**: Supabase Dashboard > Project Settings > Edge Functions > Secrets

| Variável | Descrição | Exemplo | Status |
|----------|-----------|---------|--------|
| `PARCELOW_CLIENT_ID` | Client ID da Parcelow | `282` (Sandbox) / `1118` (Prod) | ✅ Configurado |
| `PARCELOW_CLIENT_SECRET` | Client Secret da Parcelow | `1aOr1...` | ✅ Configurado |
| `PARCELOW_ENVIRONMENT` | Ambiente (`staging` ou `production`) | `staging` | ✅ Configurado |

### Credenciais de Sandbox (Obtidas em 14/01/2026)

**Endpoint**: `https://sandbox.parcelow.com`

**Credenciais de API**:
- **Client ID**: `282`
- **Client Secret**: `1aOr1e3MjDVACC7rvyfsfx1XAMDhKBJXiP8gpi5d`

**Acesso ao Painel Sandbox**:
- **URL**: [https://sandbox.parcelow.com/login](https://sandbox.parcelow.com/login)
- **Email**: `victuribdev@gmail.com`
- **Senha**: `uynj4YH64zPR`

### Variáveis por Ambiente

O sistema suporta credenciais diferentes para staging e production:

**Staging**:
- `PARCELOW_CLIENT_ID_STAGING`
- `PARCELOW_CLIENT_SECRET_STAGING`

**Production**:
- `PARCELOW_CLIENT_ID_PRODUCTION`
- `PARCELOW_CLIENT_SECRET_PRODUCTION`

**Fallback**: Se as variáveis específicas não existirem, usa `PARCELOW_CLIENT_ID` e `PARCELOW_CLIENT_SECRET` genéricas.

### Variáveis Opcionais

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `CLIENT_WEBHOOK_URL` | URL do webhook n8n para notificações | - |
| `SITE_URL` | URL base do site (para redirects) | `http://localhost:5173` |

### Variáveis do Supabase (Automáticas)

Estas são configuradas automaticamente pelo Supabase:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### Como Configurar

1. Acesse o Supabase Dashboard
2. Vá em **Project Settings** > **Edge Functions** > **Secrets**
3. Clique em **Add new secret**
4. Adicione cada variável:
   - Name: `PARCELOW_CLIENT_ID`
   - Value: `1118` (ou valor fornecido pela Parcelow)
5. Repita para todas as variáveis necessárias

---

## 🚧 Status Atual e Bloqueadores

### Status Geral

🟢 **100% Completo - Pronto para Testes**

### O Que Está Funcionando

✅ **Código Implementado**
- Todo o código frontend e backend está implementado
- Edge Functions criadas e deployadas
- Integração no checkout pronta

✅ **Ambiente de Testes**
- Credenciais de Sandbox obtidas
- Webhook configurado na Parcelow
- Cartão de teste disponível
- Acesso ao painel de Sandbox garantido

### Histórico de Resolução de Bloqueadores

✅ **Credenciais de Staging**
- **Resolvido em**: 14/01/2026
- **Solução**: Parcelow forneceu acesso ao ambiente Sandbox (Client ID 282).
- **Endpoint**: Alterado de `staging.parcelow.com` para `sandbox.parcelow.com`.

✅ **Configuração do Webhook**
- **Resolvido em**: 14/01/2026
- **Solução**: Suporte da Parcelow cadastrou a URL `https://ekxftwrjvxtpnqbraszv.supabase.co/functions/v1/parcelow-webhook` na conta de Sandbox.

### Próximas Ações Necessárias

1. **Contatar Parcelow** (via WhatsApp ou email)
   - Solicitar credenciais de staging
   - Confirmar configuração do webhook
   - Verificar se há dashboard para gerenciar configurações

2. **Configurar Variáveis de Ambiente**
   - Após receber credenciais, configurar no Supabase Dashboard
   - Testar criação de checkout

3. **Testar Fluxo Completo**
   - Criar order de teste
   - Validar redirect para Parcelow
   - Simular pagamento (staging)
   - Validar webhook recebe evento
   - Validar processamento completo

---

## 🔄 Fluxo Completo de Pagamento

### Diagrama de Fluxo

```
┌─────────────┐
│   Cliente   │
│  (Frontend) │
└──────┬──────┘
       │ 1. Seleciona Parcelow
       │ 2. Clica "Pay with Parcelow"
       ▼
┌─────────────────────────────┐
│  VisaCheckout.tsx           │
│  handleParcelowPayment()    │
└──────┬──────────────────────┘
       │ 3. POST /create-parcelow-checkout
       ▼
┌─────────────────────────────┐
│  create-parcelow-checkout   │
│  (Edge Function)            │
│  - Busca order no banco     │
│  - Busca CPF do cliente     │
│  - Autentica OAuth          │
│  - Cria order na Parcelow   │
│  - Salva dados no banco     │
└──────┬──────────────────────┘
       │ 4. Retorna url_checkout
       ▼
┌─────────────┐
│   Cliente   │
│ Redireciona │
└──────┬──────┘
       │ 5. Redirect para Parcelow
       ▼
┌─────────────────────────────┐
│   Parcelow Checkout         │
│   (Plataforma Externa)      │
│   - Cliente paga            │
│   - Parcelow processa       │
└──────┬──────────────────────┘
       │ 6. Pagamento confirmado
       │ 7. POST webhook
       ▼
┌─────────────────────────────┐
│  parcelow-webhook           │
│  (Edge Function)            │
│  - Recebe evento            │
│  - Atualiza visa_orders     │
│  - Atualiza payments        │
│  - Atualiza service_requests│
│  - Gera PDFs                │
│  - Envia email              │
│  - Webhook n8n              │
└──────┬──────────────────────┘
       │ 8. Processamento completo
       ▼
┌─────────────────────────────┐
│   Banco de Dados            │
│   - Status atualizado       │
│   - PDFs gerados            │
│   - Emails enviados         │
└─────────────────────────────┘
```

### Passo a Passo Detalhado

#### 1. Cliente Inicia Pagamento

**Frontend** (`VisaCheckout.tsx`):
```typescript
const handleParcelowPayment = async () => {
  // Chama Edge Function
  const { data } = await supabase.functions.invoke('create-parcelow-checkout', {
    body: { order_id, currency: 'USD' }
  });
  
  // Redireciona para Parcelow
  if (data?.checkout_url) {
    window.location.href = data.checkout_url;
  }
};
```

#### 2. Edge Function Cria Checkout

**Backend** (`create-parcelow-checkout/index.ts`):
- Busca order no banco
- Busca CPF do cliente
- Autentica com Parcelow (OAuth)
- Cria order na API Parcelow
- Salva `parcelow_order_id` e `parcelow_checkout_url` no banco
- Retorna `url_checkout` para frontend

#### 3. Cliente Paga na Parcelow

- Cliente é redirecionado para `https://sandbox.splipay.com/payment/...`
- Cliente completa pagamento na plataforma Parcelow
- Parcelow processa pagamento

#### 4. Parcelow Envia Webhook

**Parcelow** → **parcelow-webhook**:
```json
{
  "event": "event_order_paid",
  "data": {
    "id": 5060,
    "reference": "ORD-20260113-4814",
    "status_text": "Paid",
    ...
  }
}
```

#### 5. Webhook Processa Pagamento

**Backend** (`parcelow-webhook/index.ts`):
- Recebe evento `event_order_paid`
- Busca order no banco
- Atualiza `payment_status = "completed"`
- Atualiza `payments` e `service_requests`
- Gera PDFs (contrato e ANNEX I)
- Envia email de confirmação
- Envia webhooks para n8n

#### 6. Cliente Recebe Confirmação

- Email de confirmação enviado
- PDFs disponíveis no sistema
- Status atualizado no banco

---

## 🚀 Próximos Passos

### Fase 1: Configuração Inicial (RESOLVIDO)

✅ **Contatar Parcelow**: Credenciais e Webhook configurados em 14/01/2026.

✅ **Configurar Variáveis de Ambiente**:
1. Acessar Supabase Dashboard.
2. Adicionar `PARCELOW_CLIENT_ID=282`
3. Adicionar `PARCELOW_CLIENT_SECRET=1aOr1e3MjDVACC7rvyfsfx1XAMDhKBJXiP8gpi5d`
4. Adicionar `PARCELOW_ENVIRONMENT=staging`

### Fase 2: Testes Completos

### Fase 2: Testes Completos

**Checklist de Testes**:
- [ ] Testar criação de order em USD
- [ ] Testar criação de order em BRL
- [ ] Validar redirect para Parcelow
- [ ] Simular pagamento (staging)
- [ ] Validar webhook recebe `event_order_paid`
- [ ] Validar atualização de status no banco
- [ ] Validar geração de PDFs
- [ ] Validar envio de email
- [ ] Validar webhooks para n8n
- [ ] Testar eventos de erro (declined, canceled, expired)

### Fase 3: Produção

**Antes de Ir para Produção**:
- [ ] Configurar credenciais de produção
- [ ] Configurar webhook em produção
- [ ] Testar fluxo completo em produção
- [ ] Validar com pagamento real (valor baixo)
- [ ] Monitorar logs por alguns dias
- [ ] Documentar para usuários finais

### Fase 4: Melhorias Futuras (Opcional)

**Melhorias Não-Bloqueadoras**:
- [ ] Exibir opções de parcelamento no frontend
- [ ] Adicionar suporte a cupons de desconto
- [ ] Implementar checkout transparente (sem redirect)
- [ ] Adicionar retry logic mais robusto
- [ ] Melhorar tratamento de erros
- [ ] Adicionar métricas e monitoramento

---

## 📞 Contatos e Suporte

### Informações da Parcelow

**Documentação**: https://app.swaggerhub.com/apis/ParcelowAPI/parcelow-api/1.0.5

**Ambientes**:
- Staging: `https://staging.parcelow.com`
- Production: `https://app.parcelow.com`

**Credenciais Atuais**:
- **Sandbox (Staging)**: ID `282` | `sandbox.parcelow.com`
- **Production**: ID `1118` | `app.parcelow.com`

### URLs Importantes

**Edge Functions**:
- Create Checkout: `https://ekxftwrjvxtpnqbraszv.supabase.co/functions/v1/create-parcelow-checkout`
- Webhook: `https://ekxftwrjvxtpnqbraszv.supabase.co/functions/v1/parcelow-webhook`

**Supabase Dashboard**:
- Project: `ekxftwrjvxtpnqbraszv`
- Secrets: Project Settings > Edge Functions > Secrets

---

## 📝 Notas Técnicas

### Decisões de Implementação

1. **Autenticação OAuth**: Implementado com cache de tokens e retry logic
2. **Fluxo de Pagamento**: Redirect flow (cliente paga na Parcelow)
3. **Webhook**: Processamento completo replicado do Stripe
4. **Moedas**: Suporte para USD e BRL
5. **Logs**: Logs detalhados em todas as etapas

### Limitações Conhecidas

- ❌ Checkout transparente não implementado (requer confirmação de identidade)
- ✅ Cliente precisa fazer pagamento na plataforma Parcelow
- ✅ Webhook confirma quando pagamento é recebido

### Compatibilidade

- ✅ Compatível com estrutura existente do sistema
- ✅ Segue padrões do Stripe webhook
- ✅ Integrado com sistema de PDFs e emails existente

---

## ✅ Resumo Executivo

**Status**: 🟢 **100% Completo - Pronto para Testes**

**O Que Funciona**:
- ✅ Todo o código está implementado
- ✅ Banco de dados configurado
- ✅ Edge Functions criadas e deployadas
- ✅ Integração no checkout pronta
- ✅ Webhook processador completo
- ✅ Credenciais de Sandbox obtidas
- ✅ Webhook configurado na Parcelow

**O Que Falta**:
- ⏸️ Configurar variáveis de ambiente no Supabase
- ⏸️ Executar testes do fluxo completo

**Estimativa para Completar**:
- Configuração: ~5 minutos
- Testes completos: ~30-60 minutos
- Produção: ~30 minutos após testes

---

**Última Atualização**: 13 de Janeiro de 2026  
**Próxima Revisão**: Após obter credenciais e configurar webhook
