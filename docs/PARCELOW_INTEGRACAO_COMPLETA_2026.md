# 📚 Documentação Completa - Integração Parcelow

**Data de Criação**: 20 de Janeiro de 2026  
**Última Atualização**: 20 de Janeiro de 2026  
**Status**: 🟢 **Produção - Funcionando Completamente**  
**Projeto**: MIGMA - Sistema de Venda de Vistos

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura da Solução](#arquitetura-da-solução)
3. [Componentes Frontend](#componentes-frontend)
4. [Edge Functions (Backend)](#edge-functions-backend)
5. [Banco de Dados](#banco-de-dados)
6. [Fluxo Completo de Pagamento](#fluxo-completo-de-pagamento)
7. [Webhooks](#webhooks)
8. [Configuração e Variáveis de Ambiente](#configuração-e-variáveis-de-ambiente)
9. [Testes e Debugging](#testes-e-debugging)
10. [Troubleshooting](#troubleshooting)

---

## 🎯 Visão Geral

### O que é a Parcelow?

A Parcelow é uma plataforma de pagamento que permite brasileiros pagarem valores em dólares (USD) parceladamente em reais (BRL), usando cartão de crédito, PIX ou TED. É especialmente útil para serviços de visto que têm preços em USD.

### Objetivo da Integração

Permitir que clientes brasileiros paguem por serviços de visto em até 12 parcelas, com conversão automática de USD para BRL e processamento de pagamento completo via Parcelow.

### Características Principais

- ✅ **Pagamento Parcelado**: Até 12x no cartão de crédito
- ✅ **Conversão Automática**: USD → BRL com taxa de câmbio atual
- ✅ **Múltiplos Métodos**: Cartão, PIX, TED
- ✅ **Webhook Automático**: Notificações de status de pagamento
- ✅ **Processamento Completo**: PDFs, emails e tracking automáticos
- ✅ **Ambiente Sandbox**: Testes sem  custo antes da produção

---

## 🏗️ Arquitetura da Solução

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  VisaCheckoutPage.tsx                                            │
│  └─> PaymentButtons.tsx                                          │
│       └─> useParcelowCheckout.ts (Hook)                          │
│            └─> ParcelowService.ts                                │
│                 │                                                 │
│                 ▼                                                 │
└─────────────────────────────────────────────────────────────────┘
                  │
                  │ POST /create-parcelow-checkout
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE EDGE FUNCTIONS                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  create-parcelow-checkout/index.ts                               │
│   ├─> Autentica com Parcelow (OAuth 2.0)                        │
│   ├─> Busca dados do cliente (CPF obrigatório)                  │
│   ├─> Cria order na API Parcelow                                │
│   └─> Retorna checkout_url                                      │
│                                                                   │
│  parcelow-webhook/index.ts                                       │
│   ├─> Recebe notificações da Parcelow                           │
│   ├─> Atualiza status  do pagamento                              │
│   ├─> Gera PDFs (contrato + ANNEX I)                            │
│   ├─> Envia emails (cliente, seller, admin)                     │
│   └─> Envia webhooks para n8n                                   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                  │                        ▲
                  │                        │
                  ▼                        │ Webhook POST
┌─────────────────────────────────────────────────────────────────┐
│                       PARCELOW API                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Staging: https://sandbox-2.parcelow.com.br                     │
│  Production: https://app.parcelow.com                           │
│                                                                   │
│  Endpoints:                                                      │
│   • POST /oauth/token (Autenticação)                            │
│   • POST /api/orders (Criar pedido em USD)                      │
│   • POST /api/orders/brl (Criar pedido em BRL)                  │
│   • GET /api/simulate (Simular valores)                         │
│   • GET /api/order/{id} (Consultar pedido)                      │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                  │
                  │ Redireciona cliente
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                  PÁGINA DE CHECKOUT PARCELOW                     │
│                (Hosted pela Parcelow)                            │
│                                                                   │
│  Cliente:                                                        │
│   • Escolhe número de parcelas                                  │
│   • Insere dados do cartão                                      │
│   • Confirma pagamento                                          │
│                                                                   │
│  Após conclusão:                                                 │
│   • Success → Redireciona para /checkout/success                │
│   • Failure → Redireciona para /checkout/cancel                 │
│   • Webhook → POST para parcelow-webhook                        │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📦 Componentes Frontend

### 1. Estrutura de Arquivos

```
src/features/visa-checkout/
├── hooks/
│   └── useParcelowCheckout.ts          # Hook principal
├── services/
│   └── payment/
│       └── parcelowService.ts          # Cliente da API
├── types/
│   └── parcelow.types.ts               # Tipos TypeScript
└── components/
    └── steps/
        └── step3/
            └── PaymentButtons.tsx       # Botão de pagamento
```

### 2. useParcelowCheckout.ts (Hook)

**Responsabilidades:**
- Gerenciar estado do checkout Parcelow
- Criar checkout via Edge Function
- Controlar modal de confirmação
- Redirecionar para Parcelow

**Principais Métodos:**

```typescript
const {
  checkoutData,           // Dados do checkout (URLs, valores)
  showConfirmationModal,  // Estado do modal
  isCreatingCheckout,     // Loading state
  error,                  // Mensagem de erro
  createCheckout,         // Criar checkout
  confirmAndRedirect,     // Confirmar e redirecionar
  cancelCheckout,         // Cancelar checkout
  clearError              // Limpar erro
} = useParcelowCheckout();
```

**Exemplo de Uso:**

```typescript
// No componente PaymentButtons.tsx
const parcelow = useParcelowCheckout();

const handleParcelowClick = async () => {
  try {
    await parcelow.createCheckout(orderId);
    // Modal abre automaticamente
  } catch (err) {
    console.error('Erro ao criar checkout:', err);
  }
};
```

### 3. ParcelowService.ts

**Métodos Disponíveis:**

```typescript
// Criar checkout
const response = await ParcelowService.createCheckout(orderId, 'USD');
// Retorna: { success, checkout_url, total_usd, total_brl, order_id }

// Formatar valor (cents → dollars)
const formatted = ParcelowService.formatAmount(50000); // "500.00"

// Calcular taxas
const fees = ParcelowService.calculateFees(55000, 50000); // 5000 (cents)
```

### 4. Tipos TypeScript

```typescript
// parcelow.types.ts

export interface ParcelowCheckoutRequest {
  order_id: string;
  currency: 'USD' | 'BRL';
  action?: 'create' | 'simulate';
  amount_usd?: number; // Para simulation apenas
}

export interface ParcelowCheckoutResponse {
  success: boolean;
  checkout_url: string;
  order_id: number;
  total_usd: number;    // em centavos
  total_brl: number;    // em centavos
  order_amount: number; // em centavos
  status?: string;
}

export interface ParcelowCheckoutData {
  checkout_url: string;
  total_usd: number;
  total_brl: number;
  order_amount: number;
  order_id: number;
}
```

---

## 🔧 Edge Functions (Backend)

### 1. create-parcelow-checkout

**Localização**: `supabase/functions/create-parcelow-checkout/index.ts`

**Endpoint**: `https://[PROJECT].supabase.co/functions/v1/create-parcelow-checkout`

**Método**: POST

#### Request Body

```json
{
  "order_id": "uuid-do-pedido",
  "currency": "USD",
  "action": "create"
}
```

#### Response (Sucesso)

```json
{
  "success": true,
  "order_id": 5060,
  "checkout_url": "https://sandbox.splipay.com/payment/xyz/abc",
  "status": "Open",
  "total_usd": 100000,
  "total_brl": 542080,
  "order_amount": 100000
}
```

#### Fluxo Interno

1. **Detectar Ambiente** (staging vs production)
2. **Inicializar Cliente Supabase**
3. **Buscar Order do Banco** (`visa_orders`)
4. **Buscar CPF do Cliente** (via `service_request_id` → `clients`)
5. **Validar CPF** (11 dígitos obrigatórios)
6. **Autenticar com Parcelow** (OAuth 2.0)
7. **Criar Order na API Parcelow**
8. **Salvar Dados no Banco** (`parcelow_order_id`, `parcelow_checkout_url`)
9. **Retornar checkout_url**

#### Autenticação OAuth

```typescript
// Classe ParcelowClient
private async getAccessToken(): Promise<string> {
  // Request
  const response = await fetch(`${this.baseUrl}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: this.clientId,      // 212 (staging) ou outro
      client_secret: this.clientSecret, 
      grant_type: 'client_credentials'
    })
  });
  
  // Response
  const data = await response.json();
  // { access_token, token_type: "Bearer", expires_in: 31536000 }
  
  return data.access_token;
}
```

#### Tratamento de Erros Especiais

```typescript
// Erro: "Email do cliente existente"
// Solução: Adicionar timestamp ao email
if (err.message.includes('Email do cliente existente')) {
  const aliasedEmail = `user+${Date.now()}@domain.com`;
  // Retry com email modificado
}
```

### 2. parcelow-webhook

**Localização**: `supabase/functions/parcelow-webhook/index.ts`

**Endpoint**: `https://[PROJECT].supabase.co/functions/v1/parcelow-webhook`

**Método**: POST

**JWT Verification**: ❌ DISABLED (necessário para webhooks externos)

#### Payload do Webhook

```json
{
  "event": "event_order_paid",
  "data": {
    "id": 5060,
    "reference": "ORD-20260113-4814",
    "status": 1,
    "status_text": "Paid",
    "order_amount": 10000,
    "total_usd": 10500,
    "total_brl": 54208,
    "installments": 3,
    "order_date": "2026-01-20T10:30:00Z",
    "payments": [{
      "total_brl": 56120,  // ✅ Valor CORRETO com juros de parcelamento
      "installments": 3
    }],
    "client": {
      "name": "Cliente Teste",
      "email": "teste@example.com",
      "cpf": "999.999.999-99"
    }
  }
}
```

#### Eventos Suportados

| Evento | Descrição | Ação no Sistema |
|--------|-----------|-----------------|
| `event_order_paid` | ✅ Pagamento confirmado | Processa fluxo completo |
| `event_order_confirmed` | ℹ️ Order confirmada | Atualiza status |
| `event_order_declined` | ❌ Pagamento recusado | Status: `failed` |
| `event_order_canceled` | ❌ Order cancelada | Status: `cancelled` |
| `event_order_expired` | ⏰ Order expirada | Status: `cancelled` |
| `event_order_waiting` | ⏸️ Aguardando | Status: `pending` |
| `event_order_waiting_payment` | ⏸️ Aguardando pagamento | Status: `pending` |
| `event_order_waiting_docs` | ⏸️ Aguardando docs | Status: `pending` |

#### Fluxo de Processamento (event_order_paid)

```typescript
async function processParcelowWebhookEvent(event, supabase) {
  // 1. Buscar order no banco
  const { data: order } = await supabase
    .from('visa_orders')
    .select('*')
    .eq('parcelow_order_id', parcelowOrder.id)
    .single();
  
  // 2. Atualizar visa_orders
  await supabase
    .from('visa_orders')
    .update({
      payment_status: 'completed',
      payment_method: 'parcelow',
      parcelow_status: data.status_text,
      parcelow_status_code: data.status,
      payment_metadata: {
        parcelow_order_id: data.id,
        installments: data.payments[0].installments,
        total_usd: data.total_usd,
        total_brl: data.payments[0].total_brl, // Valor com juros
        completed_at: new Date().toISOString()
      }
    })
    .eq('id', order.id);
  
  // 3. Atualizar payments (se service_request_id existe)
  await supabase
    .from('payments')
    .update({ status: 'paid' })
    .eq('service_request_id', order.service_request_id);
  
  // 4. Atualizar service_requests
  await supabase
    .from('service_requests')
    .update({ status: 'paid' })
    .eq('id', order.service_request_id);
  
  // 5. Tracking em seller_funnel_events
  await supabase
    .from('seller_funnel_events')
    .insert({
      seller_id: order.seller_id,
      event_type: 'payment_completed',
      metadata: { order_id, payment_method: 'parcelow', ... }
    });
  
  // 6. Gerar PDF do contrato
  await supabase.functions.invoke('generate-visa-contract-pdf', {
    body: { order_id: order.id }
  });
  
  // 7. Gerar PDF do ANNEX I (obrigatório para todos)
  await supabase.functions.invoke('generate-annex-pdf', {
    body: { order_id: order.id }
  });
  
  // 8. Enviar email de confirmação
  await supabase.functions.invoke('send-payment-confirmation-email', {
    body: {
      clientName, clientEmail, orderNumber,
      paymentMethod: 'parcelow',
      currency: 'BRL',
      finalAmount: data.payments[0].total_brl / 100
    }
  });
  
  // 9. Enviar webhooks para n8n
  await sendClientWebhook(order, supabase);
  
  // 10. Notificar seller
  await supabase.functions.invoke('send-seller-payment-notification', {...});
  
  // 11. Notificar admins
  await supabase.functions.invoke('send-admin-payment-notification', {...});
}
```

#### Webhook para n8n

A função `sendClientWebhook()` envia **múltiplos webhooks**:

1. **1 webhook para o cliente principal**
2. **1 webhook para cada dependente** (se houver)

```typescript
// Payload Cliente Principal
{
  "servico": "F1 Initial",              // Nome normalizado
  "plano_servico": "initial-scholarship",
  "nome_completo": "João Silva",
  "whatsapp": "+5511999999999",
  "email": "joao@example.com",
  "valor_servico": "900.00",            // Apenas base_price_usd
  "vendedor": "seller-uuid",
  "quantidade_dependentes": 2
}

// Payload Dependente
{
  "nome_completo_cliente_principal": "João Silva",
  "nome_completo_dependente": "Maria Silva",
  "valor_servico": "99.00"              // extra_unit_price_usd
}
```

**Variável de Ambiente Necessária:**
```bash
CLIENT_WEBHOOK_URL=https://seu-webhook-n8n.com/webhook
```

---

## 💾 Banco de Dados

### Migration Aplicada

**Arquivo**: `supabase/migrations/20260112000001_add_parcelow_fields_to_visa_orders.sql`

```sql
-- Adicionar campos Parcelow à tabela visa_orders
ALTER TABLE visa_orders
ADD COLUMN IF NOT EXISTS parcelow_order_id TEXT,
ADD COLUMN IF NOT EXISTS parcelow_checkout_url TEXT,
ADD COLUMN IF NOT EXISTS parcelow_status TEXT,
ADD COLUMN IF NOT EXISTS parcelow_status_code INTEGER;

-- Criar índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_visa_orders_parcelow_order_id 
ON visa_orders(parcelow_order_id);

-- Comentários
COMMENT ON COLUMN visa_orders.parcelow_order_id IS 'ID da order na Parcelow API';
COMMENT ON COLUMN visa_orders.parcelow_checkout_url IS 'URL do checkout Parcelow';
COMMENT ON COLUMN visa_orders.parcelow_status IS 'Status textual (Open, Paid, Declined)';
COMMENT ON COLUMN visa_orders.parcelow_status_code IS 'Código numérico do status (0=Open, 1=Paid)';
```

### Campos da Tabela visa_orders

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | ID único do pedido |
| `order_number` | TEXT | Número do pedido (ORD-20260113-4814) |
| `payment_method` | TEXT | Método (parcelow, stripe_card, zelle, wise) |
| `payment_status` | TEXT | Status (pending, completed, failed, cancelled) |
| `parcelow_order_id` | TEXT | ✨ ID da order na Parcelow |
| `parcelow_checkout_url` | TEXT | ✨ URL do checkout |
| `parcelow_status` | TEXT | ✨ Status textual (Paid, Open) |
| `parcelow_status_code` | INTEGER | ✨ Código do status (0, 1) |
| `payment_metadata` | JSONB | Metadados do pagamento |
| `total_price_usd` | NUMERIC | Valor total em USD |

### payment_metadata (JSONB)

```json
{
  "payment_method": "parcelow",
  "completed_at": "2026-01-20T10:30:00Z",
  "parcelow_order_id": 5060,
  "installments": 3,
  "total_usd": 100000,      // em centavos
  "total_brl": 542080,      // em centavos
  "base_brl": 540000,       // BRL sem juros
  "fee_amount": 500,        // Taxa Parcelow em centavos
  "order_date": "2026-01-20T10:25:00Z"
}
```

### Relacionamentos

```
visa_orders
  ├─> service_request_id → service_requests.id
  │    └─> client_id → clients.id (para buscar CPF)
  └─> seller_id → sellers.seller_id_public
```

---

## 🔄 Fluxo Completo de Pagamento

### Diagrama de Sequência

```
Cliente         Frontend        Edge Function       Parcelow API       Webhook
  │                │                  │                    │               │
  │  Clica Pagar   │                  │                    │               │
  │───────────────>│                  │                    │               │
  │                │ POST checkout    │                    │               │
  │                │─────────────────>│                    │               │
  │                │                  │ POST /oauth/token  │               │
  │                │                  │───────────────────>│               │
  │                │                  │<───────────────────│               │
  │                │                  │  access_token      │               │
  │                │                  │                    │               │
  │                │                  │ POST /api/orders   │               │
  │                │                  │───────────────────>│               │
  │                │                  │<───────────────────│               │
  │                │<─────────────────│  order_id, url     │               │
  │ Modal Confirm  │ checkout_url     │                    │               │
  │<───────────────│                  │                    │               │
  │                │                  │                    │               │
  │  Confirma      │                  │                    │               │
  │───────────────>│                  │                    │               │
  │                │ window.location  │                    │               │
  │─────────────────────────────────────────────────────────>│             │
  │                Parcelow Checkout Page                   │             │
  │                                                          │             │
  │  Preenche dados do cartão                               │             │
  │  Confirma pagamento                                      │             │
  │─────────────────────────────────────────────────────────>│             │
  │                                                          │ POST webhook│
  │                                                          │────────────>│
  │                                                          │             │
  │                                                          │  Processa   │
  │                                                          │  └─ Update DB
  │                                                          │  └─ PDFs    │
  │                                                          │  └─ Emails  │
  │                                                          │  └─ n8n     │
  │                                                          │             │
  │<─────────────────────────────────────────────────────────│             │
  │              Redirect /checkout/success                  │             │
  │                                                                        │
```

### Etapas Detalhadas

#### **Fase 1: Criação do Checkout**

1. Cliente clica em "Pagar com Parcelow"
2. Frontend chama `createCheckout(orderId)`
3. Edge Function busca order e CPF
4. Edge Function autentica com Parcelow (OAuth)
5. Edge Function cria order na API Parcelow
6. Edge Function salva `parcelow_order_id` no banco
7. Edge Function retorna `checkout_url`
8. Frontend exibe modal de confirmação com valores em BRL
9. Cliente confirma e é redirecionado para Parcelow

#### **Fase 2: Pagamento na Parcelow**

10. Cliente escolhe parcelas (1x, 2x, 3x... até 12x)
11. Cliente insere dados do cartão
12. Parcelow processa pagamento
13. Se aprovado → Status: Paid
14. Se recusado → Status: Declined

#### **Fase 3: Webhook e Pós-Processamento**

15. Parcelow envia webhook `event_order_paid`
16. Webhook busca order por `parcelow_order_id`
17. Webhook atualiza `payment_status` → `completed`
18. Webhook atualiza `payments` e `service_requests`
19. Webhook registra em `seller_funnel_events`
20. Webhook gera PDF do contrato
21. Webhook gera PDF do ANNEX I
22. Webhook envia email para cliente
23. Webhook envia webhook para n8n (cliente + dependentes)
24. Webhook envia email para seller
25. Webhook envia email para admins
26. Cliente é redirecionado para `/checkout/success`

---

## ⚙️ Configuração e Variáveis de Ambiente

### Variáveis Obrigatórias

Configure no **Supabase Dashboard > Project Settings > Edge Functions > Secrets**

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `PARCELOW_CLIENT_ID` | Client ID da API | `212` (staging) |
| `PARCELOW_CLIENT_SECRET` | Client Secret | `1aOr1e3M...` |
| `PARCELOW_ENVIRONMENT` | Ambiente ativo | `staging` ou `production` |

### Variáveis Opcionais por Ambiente

| Variável | Uso |
|----------|-----|
| `PARCELOW_CLIENT_ID_STAGING` | Client ID específico para staging |
| `PARCELOW_CLIENT_SECRET_STAGING` | Secret específico para staging |
| `PARCELOW_CLIENT_ID_PRODUCTION` | Client ID específico para produção |
| `PARCELOW_CLIENT_SECRET_PRODUCTION` | Secret específico para produção |

### Variáveis para Webhooks

| Variável | Descrição |
|----------|-----------|
| `CLIENT_WEBHOOK_URL` | URL do webhook n8n para notificações |
| `SITE_URL` | URL base do site (para redirects) |

### Credenciais de Sandbox (Staging)

**Obtidas em**: 14/01/2026

**API**:
- **Endpoint**: `https://sandbox-2.parcelow.com.br`
- **Client ID**: `212`
- **Client Secret**: `1aOr1e3MjDVACC7rvyfsfx1XAMDhKBJXiP8gpi5d`

**Painel Web**:
- **URL**: https://sandbox.parcelow.com/login
- **Email**: `victuribdev@gmail.com`
- **Senha**: `uynj4YH64zPR`

### Webhook URL Registrado

```
https://ekxftwrjvxtpnqbraszv.supabase.co/functions/v1/parcelow-webhook
```

---

## 🧪 Testes e Debugging

### Cartão de Teste (Sandbox)

Use estes dados para simular pagamentos aprovados no ambiente de Sandbox:

| Dado | Valor |
|------|-------|
| **Número do Cartão** | `5214254988499590` |
| **Expiração** | `03/26` |
| **CVV** | `220` |
| **Nome** | Qualquer nome |

### CPF de Teste

Use CPFs válidos (gerador online) ou:
- `999.999.999-99` (pode funcionar em staging)

### Flow de Teste Completo

1. **Criar Order de Teste**
   - Produto com CPF cadastrado
   - Valor mínimo: $10.00 USD

2. **Iniciar Checkout**
   ```bash
   # Verificar logs da Edge Function
   supabase functions logs create-parcelow-checkout
   ```

3. **Completar Pagamento**
   - Usar cartão de teste
   - Escolher 1x (à vista) para facilitar

4. **Verificar Webhook**
   ```bash
   # Logs do webhook
   supabase functions logs parcelow-webhook
   ```

5. **Validar Banco de Dados**
   ```sql
   SELECT 
     order_number,
     payment_status,
     parcelow_status,
     payment_metadata
   FROM visa_orders
   WHERE parcelow_order_id = '5060';
   ```

### Logs Importantes

```
[Parcelow Checkout] ✅ Parcelow order created successfully
[Parcelow Checkout] Order ID: 5060
[Parcelow Webhook] ✅ Found order ORD-20260113-4814
[Parcelow Webhook] ✅ Updated order to status: completed
[Parcelow Webhook] ✅ Payment confirmation email sent
[Parcelow Webhook Client] ✅ Successfully sent CLIENTE PRINCIPAL webhook
```

---

## 🔧 Troubleshooting

### Erro: "CPF is required for Parcelow payment"

**Causa**: CPF não encontrado no banco ou inválido

**Solução**:
1. Verificar se  `clients.document_number` está preenchido
2. Verificar se CPF tem 11 dígitos
3. Garantir que `service_request_id` está correto

### Erro: "Email do cliente existente"

**Causa**: Parcelow já tem um cliente cadastrado com esse email

**Solução**: Automática - sistema adiciona timestamp ao email
```typescript
const aliasedEmail = `user+${Date.now()}@domain.com`;
```

### Erro: "Order not found for Parcelow order"

**Causa**: Webhook recebido antes de salvar `parcelow_order_id`

**Solução**: 
- Verificar se Edge Function salvou dados no banco
- Verificar se Parcelow enviou webhook muito rápido
- Parcelow fará retry automático (5 tentativas)

### Webhook Não Recebido

**Verificações**:
1. Edge Function está deployada?
   ```bash
   supabase functions list
   ```

2. JWT verification está desabilitado?
   ```typescript
   // Em parcelow-webhook/index.ts
   // Verificar no deploy: verify_jwt=false
   ```

3. URL está cadastrada na Parcelow?
   - Acessar painel: https://sandbox.parcelow.com
   - Verificar configurações de webhook

### Pagamento Aprovado mas Status Pending

**Causa**: Webhook `event_order_paid` não processado

**Debug**:
```sql
-- Verificar logs do webhook
SELECT * FROM edge_logs 
WHERE function_name = 'parcelow-webhook'
ORDER BY timestamp DESC 
LIMIT 10;
```

### Total BRL Incorreto

**Importante**: O valor correto está em `payments[0].total_brl`, não em `total_brl` raiz:

```json
{
  "total_brl": 540000,        // ❌ Base sem juros
  "payments": [{
    "total_brl": 556120       // ✅ Valor real com juros de parcelamento
  }]
}
```

---

## 📊 Métricas e Monitoramento

### Queries Úteis

```sql
-- Total de pagamentos Parcelow por status
SELECT 
  payment_status,
  COUNT(*) as total,
  SUM(total_price_usd::numeric) as total_usd
FROM visa_orders
WHERE payment_method = 'parcelow'
GROUP BY payment_status;

-- Pedidos Parcelow pendentes há mais de 24h
SELECT 
  order_number,
  created_at,
  parcelow_status,
  parcelow_checkout_url
FROM visa_orders
WHERE payment_method = 'parcelow'
  AND payment_status = 'pending'
  AND created_at < NOW() - INTERVAL '24 hours';

-- Taxas médias da Parcelow
SELECT 
  AVG((payment_metadata->>'fee_amount')::numeric) / 100 as avg_fee_usd,
  AVG((payment_metadata->>'installments')::numeric) as avg_installments
FROM visa_orders
WHERE payment_method = 'parcelow'
  AND payment_status = 'completed';
```

---

## 📚 Referências

### Documentação Oficial Parcelow

- **Swagger API**: https://app.swaggerhub.com/apis/ParcelowAPI/parcelow-api/1.0.5
- **Suporte**: contato@parcelow.com

### Arquivos do Projeto

```
migma-lp/
├── docs/
│   └── PARCELOW_INTEGRACAO_COMPLETA_2026.md  # Este arquivo
├── src/
│   └── features/visa-checkout/
│       ├── hooks/useParcelowCheckout.ts
│       ├── services/payment/parcelowService.ts
│       └── types/parcelow.types.ts
├── supabase/
│   ├── functions/
│   │   ├── create-parcelow-checkout/index.ts
│   │   └── parcelow-webhook/index.ts
│   └── migrations/
│       └── 20260112000001_add_parcelow_fields_to_visa_orders.sql
└── test-parcelow-webhook.ts  # Script de teste manual
```

---

## ✅ Checklist de Implementação

### Setup Inicial
- [x] Credenciais Parcelow obtidas
- [x] Variáveis de ambiente configuradas
- [x] Webhook URL registrado na Parcelow
- [x] Migration aplicada ao banco

### Frontend
- [x] Hook `useParcelowCheckout` implementado
- [x] Service `ParcelowService` criado
- [x] Tipos TypeScript definidos
- [x] Botão de pagamento integrado
- [x] Modal de confirmação funcional

### Backend
- [x] Edge Function `create-parcelow-checkout` deployada
- [x] Edge Function `parcelow-webhook` deployada
- [x] Autenticação OAuth funcional
- [x] Busca de CPF implementada
- [x] Tratamento de erros robusto
- [x] Logs detalhados implementados

### Pós-Pagamento
- [x] Geração de PDFs (contrato + ANNEX I)
- [x] Email de confirmação para cliente
- [x] Email de notificação para seller
- [x] Email de notificação para admins
- [x] Webhook para n8n (cliente + dependentes)
- [x] Tracking em `seller_funnel_events`

### Testes
- [x] Teste de criação de checkout
- [x] Teste de pagamento completo (sandbox)
- [x] Teste de webhook
- [x] Teste de emails
- [x] Teste de PDFs
- [x] Teste de webhooks n8n

---

## 🎉 Status Final

**✅ INTEGRAÇÃO 100% COMPLETA E FUNCIONAL**

A integração Parcelow está totalmente implementada, testada e pronta para uso em produção. Todos os componentes estão funcionando corretamente:

- ✅ Criação de checkout
- ✅ Processamento de pagamento
- ✅ Webhooks automáticos
- ✅ Geração de PDFs
- ✅ Envio de emails
- ✅ Notificações n8n
- ✅ Tracking e analytics

**Próximos Passos**:
1. Passar para produção (trocar credenciais)
2. Monitorar métricas
3. Otimizar taxas se necessário

---

**Documentação mantida por**: Equipe de Desenvolvimento MIGMA  
**Última revisão**: 20 de Janeiro de 2026  
**Versão**: 2.0
