# 📋 Plano de Integração: Wise API para Pagamentos Internacionais

## 🎯 Objetivo

Implementar a integração com a Wise Platform API para adicionar Wise como método de pagamento alternativo ao Stripe e Zelle no checkout de serviços de visto (Sales Links).

Usando Personal API Token (não requer contato com Wise) e webhooks para confirmação de recebimento.

**IMPORTANTE**: Wise será usado APENAS para pagamentos no checkout de produtos, NÃO para transferências de comissões.

---

## ✅ DECISÃO: Usar Personal Token (SEM Contato Necessário)

**Método Escolhido:** Personal API Token

**Por quê:**
- ✅ Token já disponível na conta Wise
- ✅ **NÃO precisa entrar em contato com Wise**
- ✅ Mais simples (sem mTLS, sem certificados)
- ✅ Suficiente para checkout onde cliente paga diretamente

**Limitações Aceitas:**
- ❌ Não pode fundar transfers via API (devido PSD2)
- ❌ Cliente precisa fazer o pagamento na plataforma Wise
- ❌ Não pode ver balance statements via API

**Endpoints:**
- **Sandbox**: `https://api.wise-sandbox.com`
- **Production**: `https://api.wise.com`
- **Autenticação**: `Authorization: Bearer <personal_token>`

---

## 📍 Contexto do Sistema

### Métodos de Pagamento Atuais no Checkout:
- ✅ **Stripe Card**: Cartão de crédito/débito (USD) - Taxa: 3.9% + $0.30
- ✅ **Stripe PIX**: PIX brasileiro (BRL) - Taxa: ~1.79%
- ✅ **Zelle**: Transferência manual com upload de comprovante - Verificação manual

### Novo Método:
- 🔜 **Wise**: Transferência internacional com taxas reduzidas - Processamento automático via API

---

## 📚 Documentação de Referência

### Links Importantes
- **Wise Platform Docs**: https://docs.wise.com/
- **Auth & Security Guide**: https://docs.wise.com/guides/developer/auth-and-security/
- **OAuth 2.0 & mTLS** (não necessário para este caso): https://docs.wise.com/guides/developer/auth-and-security/mtls
- **API Reference**: https://docs.wise.com/api-reference/
- **Webhooks Guide**: https://docs.wise.com/guides/product/send-money/tracking-transfers
- **Standard API Transfers**: https://docs.wise.com/guides/product/send-money/standard-api-transfers

### Credenciais

**Opção 1 - Personal Token (Recomendado para começar):**
- ✅ Já disponível na conta Wise
- ✅ Não precisa de contato
- Token gerado em: **Your Account** > **Integrations and Tools** > **API tokens**

**Nota sobre OAuth 2.0:**
- Não será usado neste projeto (apenas Personal Token)
- Se no futuro precisar de funding automático via API, considerar migrar para OAuth 2.0

---

## 🔐 Autenticação e Segurança

### Personal API Token (Método Escolhido)

**O que é:**
- Token gerado diretamente na conta Wise (já disponível)
- Não requer contato com Wise
- Não requer mTLS ou certificados
- Endpoints normais: `https://api.wise.com` ou `https://api.wise-sandbox.com`

**O que PODE fazer:**
- ✅ Criar quotes
- ✅ Criar recipients
- ✅ Criar transfers
- ✅ Ver status de transfers
- ✅ Receber webhooks

**O que NÃO PODE fazer (devido PSD2):**
- ❌ **Fund transfers via API** (funding automático)
- ❌ Ver balance statements via API

**Limitação Crítica:**
- Para fundar a transfer (iniciar o pagamento), é necessário fazer **manualmente na conta Wise** ou o **cliente precisa fazer o funding** através da plataforma Wise

**Fluxo de Pagamento no Checkout:**
1. Cliente seleciona Wise como método de pagamento
2. Sistema cria quote, recipient e transfer no Wise
3. Cliente é redirecionado para Wise para fazer o pagamento
4. Cliente completa o pagamento na plataforma Wise
5. Webhook do Wise confirma quando pagamento é recebido
6. Order é atualizado para `payment_status = 'completed'`
7. PDF de contrato é gerado automaticamente
8. Email de confirmação é enviado

**IMPORTANTE**: Como não podemos fundar transfers via API com Personal Token, o cliente precisa fazer o pagamento diretamente na plataforma Wise (redirect flow).

#### Requisitos:
- **Client ID** e **Client Secret** (fornecidos pela Wise)
- **Certificado de Cliente** (gerado via CSR)
- **Chave Privada** (RSA 2048, 3072 ou 4096 bits, ou ECC 256/384 bits)
- **Certificado CA da Wise** (para trust store)

#### Endpoints:
- **Sandbox**: `https://api.wise-sandbox.com`
- **Production**: `https://api.wise.com`
- **Autenticação**: `Authorization: Bearer <personal_token>`

#### Como Usar Personal Token:

1. **Gerar Token na Conta Wise:**
   - Acesse: **Your Account** > **Integrations and Tools** > **API tokens**
   - Clique em **"Add new Token"**
   - ⚠️ Requer 2FA (two-factor authentication) ativado
   - Copie o token gerado (só aparece uma vez!)

2. **Usar Token nas Requisições:**
   ```bash
   curl -H "Authorization: Bearer <seu_personal_token>" \
        https://api.wise-sandbox.com/v1/profiles
   ```

3. **Configurar Webhook:**
   - Acesse: **Your Account** > **Integrations and Tools** > **Webhooks**
   - Adicione URL: `https://<project>.supabase.co/functions/v1/wise-webhook`
   - Evento: `transfers#state-change`

---

## 🔄 Fluxo de Transferência Wise

### Etapas do Processo:

1. **Criar Quote** (`POST /v3/profiles/{{profileId}}/quotes`)
   - Define moedas origem/destino
   - Define valor a transferir
   - Trava taxa de câmbio por 30 minutos
   - Retorna `quoteUuid`

2. **Criar Recipient Account** (`POST /v1/accounts`)
   - Define dados do beneficiário
   - Tipo de conta (IBAN, sort_code, etc.)
   - Retorna `accountId`

3. **Criar Transfer** (`POST /v1/transfers`)
   - Vincula quote e recipient
   - Define `customerTransactionId` (idempotência)
   - Retorna `transferId`

4. **Cliente Faz o Pagamento** (NÃO via API)
   - ⚠️ **Personal Token NÃO pode fundar transfers via API** (devido PSD2)
   - Cliente é redirecionado para Wise para fazer o pagamento
   - Cliente completa o pagamento na plataforma Wise
   - Webhook confirma quando pagamento é recebido

---

## 📊 Estrutura de Dados

### Tabela: `visa_orders` (Checkout de Produtos)

**Campos de Pagamento Atuais:**
```sql
payment_method TEXT,  -- 'stripe_card', 'stripe_pix', 'zelle'
payment_status TEXT,  -- 'pending', 'completed', 'failed', 'cancelled'
stripe_session_id TEXT,
stripe_payment_intent_id TEXT,
zelle_proof_url TEXT,
payment_metadata JSONB
```

**Atualização Necessária:**
- Adicionar suporte para `payment_method = 'wise'`
- Adicionar campos para Wise:
  - `wise_transfer_id TEXT`
  - `wise_quote_uuid TEXT`
  - `wise_recipient_id TEXT`
  - `wise_payment_status TEXT` -- Status específico do Wise

### Tabela Nova: `wise_transfers` (proposta)
```sql
CREATE TABLE wise_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visa_order_id UUID REFERENCES visa_orders(id),  -- Referência ao pedido do checkout
  wise_transfer_id TEXT UNIQUE NOT NULL,
  wise_quote_uuid TEXT,
  wise_recipient_id TEXT,
  source_currency TEXT NOT NULL DEFAULT 'USD',
  target_currency TEXT NOT NULL,
  source_amount DECIMAL(10, 2) NOT NULL,
  target_amount DECIMAL(10, 2),
  exchange_rate DECIMAL(10, 6),
  fee_amount DECIMAL(10, 2),
  status TEXT NOT NULL, -- 'incoming_payment_waiting', 'processing', 'funds_converted', 'outgoing_payment_sent', 'bounced_back', 'funds_refunded', 'cancelled', 'charged_back'
  status_details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 🏗️ Arquitetura da Implementação

### Estrutura de Arquivos:

```
src/lib/
  ├── wise/
  │   ├── wise-client.ts          # Cliente principal da API Wise
  │   ├── wise-auth.ts            # Autenticação com Personal Token
  │   ├── wise-quotes.ts          # Gerenciamento de quotes
  │   ├── wise-recipients.ts      # Gerenciamento de recipients
  │   ├── wise-transfers.ts       # Gerenciamento de transfers
  │   ├── wise-webhooks.ts        # Processamento de webhooks
  │   ├── wise-checkout.ts        # Integração com checkout de produtos
  │   └── wise-types.ts           # TypeScript types/interfaces
  └── visa-checkout-service.ts    # Atualizar para incluir Wise

src/pages/
  └── VisaCheckout.tsx            # Adicionar opção Wise no select

supabase/
  ├── functions/
  │   ├── wise-webhook/
  │   │   └── index.ts            # Edge Function para webhooks Wise
  │   └── create-wise-checkout/   # Edge Function para criar checkout Wise
  │       └── index.ts
  └── migrations/
      ├── YYYYMMDD_add_wise_to_visa_orders.sql
      └── YYYYMMDD_create_wise_transfers.sql
```

---

## 🔧 Implementação Detalhada

### 1. Configuração de Ambiente

#### Variáveis de Ambiente (.env):
```env
# Wise API Configuration - Personal Token
WISE_PERSONAL_TOKEN=<token_gerado_na_conta>
WISE_ENVIRONMENT=sandbox  # ou 'production'
WISE_PROFILE_ID=<profile_id>  # ID do perfil da conta Wise

# Webhook
WISE_WEBHOOK_SECRET=<webhook_secret>  # Configurado na conta Wise
WISE_WEBHOOK_URL=https://<project>.supabase.co/functions/v1/wise-webhook

# URLs de Redirect (para cliente pagar)
WISE_REDIRECT_SUCCESS_URL=https://<site>/checkout/success
WISE_REDIRECT_CANCEL_URL=https://<site>/checkout/cancel
```

### 2. Cliente Wise (`wise-client.ts`)

**Responsabilidades:**
- Gerenciar autenticação (Personal Token OU OAuth 2.0)
- Fazer requisições HTTP (com ou sem mTLS, dependendo do método)
- Tratar rate limiting
- Retry logic para falhas temporárias

**Métodos Principais:**
```typescript
class WiseClient {
  private personalToken: string;
  private baseUrl: string;
  
  constructor(personalToken: string, environment: 'sandbox' | 'production' = 'sandbox') {
    this.personalToken = personalToken;
    this.baseUrl = environment === 'sandbox' 
      ? 'https://api.wise-sandbox.com'
      : 'https://api.wise.com';
  }
  
  // Método genérico para requisições
  private async request<T>(method: string, endpoint: string, data?: any): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${this.personalToken}`,
        'Content-Type': 'application/json',
      },
      body: data ? JSON.stringify(data) : undefined,
    });
    
    if (!response.ok) {
      throw new Error(`Wise API error: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  // Operações disponíveis com Personal Token
  async createQuote(params: CreateQuoteParams): Promise<Quote>
  async createRecipient(params: CreateRecipientParams): Promise<Recipient>
  async createTransfer(params: CreateTransferParams): Promise<Transfer>
  async getTransferStatus(transferId: string): Promise<TransferStatus>
  async getPaymentUrl(transferId: string): Promise<string>  // URL para cliente pagar
}
```

### 3. Gerenciamento de Quotes (`wise-quotes.ts`)

**Função:**
```typescript
export async function createWiseQuote(
  profileId: string,
  sourceCurrency: string,
  targetCurrency: string,
  sourceAmount?: number,
  targetAmount?: number
): Promise<WiseQuote>
```

**Validações:**
- Moedas suportadas
- Valores mínimos/máximos
- Profile ID válido

### 4. Gerenciamento de Recipients (`wise-recipients.ts`)

**Função:**
```typescript
export async function createWiseRecipient(
  profileId: string,
  currency: string,
  accountType: 'iban' | 'sort_code' | 'aba' | 'swift',
  accountDetails: RecipientAccountDetails,
  accountHolderName: string
): Promise<WiseRecipient>
```

**Tipos de Conta Suportados:**
- **IBAN**: Para países europeus
- **Sort Code**: Para Reino Unido
- **ABA**: Para Estados Unidos
- **SWIFT**: Para outros países

### 5. Gerenciamento de Transfers (`wise-transfers.ts`)

**Função Principal:**
```typescript
export async function initiateWiseTransfer(
  paymentRequestId: string,
  quoteUuid: string,
  recipientId: string,
  customerTransactionId: string,
  reference?: string
): Promise<WiseTransfer>
```

**Fluxo Completo para Checkout:**
```typescript
export async function processWiseCheckout(
  orderData: VisaOrderData,
  clientBankDetails?: WiseBankDetails  // Opcional, pode não ser necessário
): Promise<WiseCheckoutResult> {
  // 1. Criar quote (cliente paga em sua moeda -> Migma recebe em USD)
  const quote = await createWiseQuote(
    profileId,
    clientBankDetails?.currency || 'USD',  // Moeda que o cliente vai pagar
    'USD',                                 // Moeda que a Migma recebe
    undefined,
    orderData.total_price_usd  // Valor que a Migma precisa receber
  );
  
  // 2. Criar recipient com dados bancários da MIGMA (conta que recebe)
  // NOTA: O recipient é sempre a conta da Migma que recebe o pagamento
  const recipient = await createWiseRecipient(
    profileId,
    'USD',  // Conta da Migma em USD
    'aba',  // Tipo de conta da Migma (ajustar conforme necessário)
    migmaBankDetails,  // Dados bancários da Migma
    'Migma Inc'  // Nome da empresa
  );
  
  // 3. Criar transfer
  const transfer = await createWiseTransfer({
    quoteUuid: quote.id,
    recipientId: recipient.id,
    customerTransactionId: orderData.order_number, // Usar order_number como ID único
    reference: `Order ${orderData.order_number} - ${orderData.client_name}`
  });
  
  // 4. Obter URL de pagamento para redirecionar cliente
  // O cliente será redirecionado para Wise para fazer o pagamento
  const paymentUrl = await getWisePaymentUrl(transfer.id);
  
  // 5. Salvar order com status pending
  await saveOrderWithWise(orderData.id, transfer, quote, recipient);
  
  return { 
    transfer, 
    quote, 
    recipient, 
    paymentUrl,  // URL para redirecionar cliente
    transferId: transfer.id 
  };
}
```

**IMPORTANTE**: 
- Cliente será redirecionado para Wise para fazer o pagamento
- Após pagamento, cliente retorna para nossa plataforma
- Webhook confirma quando pagamento é recebido
- Não podemos fundar automaticamente (limitação do Personal Token)

### 6. Webhook Handler (`wise-webhooks.ts`)

**Eventos a Processar:**
- `transfers#state-change`: Mudanças de status de transferência
- `transfers#funds-converted`: Conversão de moeda concluída
- `transfers#outgoing-payment-sent`: Pagamento enviado
- `transfers#bounced_back`: Transferência rejeitada
- `transfers#funds_refunded`: Reembolso processado

**Estrutura do Webhook:**
```typescript
interface WiseWebhookEvent {
  subscription_id: string;
  event_type: string;
  data: {
    resource: string;
    current_state: string;
    previous_state?: string;
    occurred_at: string;
    transfer_id?: string;
    // ... outros campos
  };
}
```

**Edge Function (`supabase/functions/wise-webhook/index.ts`):**
```typescript
Deno.serve(async (req) => {
  // 1. Verificar assinatura do webhook
  const signature = req.headers.get('X-Signature-SHA256');
  const isValid = verifyWiseWebhookSignature(req.body, signature);
  
  if (!isValid) {
    return new Response('Invalid signature', { status: 401 });
  }
  
  // 2. Processar evento
  const event = await req.json();
  await processWiseWebhookEvent(event);
  
  // 3. Atualizar status no banco
  await updateTransferStatus(event.data);
  
  return new Response('OK', { status: 200 });
});
```

---

## 🔄 Integração com Sistema Existente

### 1. Atualizar Checkout de Produtos (`VisaCheckout.tsx`)

**Adicionar Wise como opção de pagamento:**

```typescript
// No select de payment method (linha ~2895)
<SelectContent>
  <SelectItem value="card">Credit/Debit Card (Stripe)</SelectItem>
  <SelectItem value="pix">PIX (Stripe - BRL)</SelectItem>
  <SelectItem value="zelle">Zelle</SelectItem>
  <SelectItem value="wise">Wise (International Transfer)</SelectItem> {/* NOVO */}
</SelectContent>
```

**Criar handler para pagamento Wise:**

```typescript
const handleWisePayment = async () => {
  // 1. Coletar dados do beneficiário (cliente)
  // 2. Criar quote no Wise
  // 3. Criar recipient no Wise
  // 4. Criar transfer no Wise
  // 5. Salvar order com payment_method = 'wise'
  // 6. Redirecionar para página de confirmação Wise
};
```

**Fluxo de Pagamento Wise no Checkout:**
1. Cliente preenche formulário completo
2. Cliente seleciona "Wise" como método de pagamento
3. Cliente fornece dados bancários (IBAN, SWIFT, etc.) - **NOVO CAMPO**
4. Sistema cria quote, recipient e transfer no Wise
5. Cliente é redirecionado para Wise para completar pagamento (ou usa embedded checkout)
6. Cliente faz o pagamento na plataforma Wise
7. Webhook do Wise confirma quando pagamento é recebido
8. Order é atualizado para `payment_status = 'completed'`
9. PDF de contrato é gerado automaticamente
10. Email de confirmação é enviado

**Nota**: O fluxo pode variar dependendo se usamos:
- **Embedded Checkout**: Cliente paga dentro da nossa plataforma
- **Redirect Flow**: Cliente é redirecionado para Wise e retorna após pagamento

### 2. Atualizar Webhook para Atualizar Orders

O webhook do Wise deve atualizar a tabela `visa_orders` quando o pagamento for confirmado:

```typescript
// No webhook handler
if (event.data.current_state === 'outgoing_payment_sent') {
  // Buscar order pelo wise_transfer_id
  const { data: wiseTransfer } = await supabase
    .from('wise_transfers')
    .select('visa_order_id')
    .eq('wise_transfer_id', event.data.transfer_id)
    .single();
  
  if (wiseTransfer) {
    // Atualizar order para completed
    await supabase
      .from('visa_orders')
      .update({
        payment_status: 'completed',
        wise_payment_status: 'outgoing_payment_sent',
      })
      .eq('id', wiseTransfer.visa_order_id);
    
    // Gerar PDF do contrato (similar ao Stripe)
    await generateContractPDF(wiseTransfer.visa_order_id);
    
    // Enviar email de confirmação
    await sendOrderConfirmationEmail(wiseTransfer.visa_order_id);
  }
}
```

---

## 🧪 Testes

### Ambiente Sandbox:
- Usar credenciais de sandbox
- Testar todos os fluxos antes de produção
- Validar webhooks com ngrok ou similar

### Casos de Teste - Checkout de Produtos:
1. ✅ Cliente seleciona Wise como método de pagamento
2. ✅ Cliente preenche dados bancários (IBAN/SWIFT)
3. ✅ Sistema cria quote, recipient e transfer
4. ✅ Cliente é redirecionado para Wise
5. ✅ Webhook confirma pagamento e atualiza order
6. ✅ PDF de contrato é gerado automaticamente
7. ✅ Email de confirmação é enviado

### Casos de Teste Adicionais:
1. ✅ Criar quote com diferentes moedas (USD -> EUR, USD -> BRL, etc.)
2. ✅ Criar recipient com diferentes tipos de conta (IBAN, SWIFT, ABA, Sort Code)
3. ✅ Validar dados bancários antes de criar recipient
4. ✅ Tratar erros (quote expirado, recipient inválido, etc.)
5. ✅ Idempotência (mesmo order_number não cria transfer duplicada)
6. ✅ Webhook atualiza order corretamente
7. ✅ PDF de contrato é gerado após confirmação
8. ✅ Email de confirmação é enviado após pagamento

---

## 📝 Checklist de Implementação

### Fase 1: Configuração Inicial
- [x] **DECIDIDO**: Personal Token (não precisa contato)
- [ ] Obter Personal Token da conta Wise (já disponível)
- [ ] Obter Profile ID da conta Wise
- [ ] Configurar webhook na conta Wise
- [ ] Configurar variáveis de ambiente no Supabase
- [ ] Criar tabela `wise_transfers`
- [ ] Criar migration para adicionar campos Wise em `visa_orders`

### Fase 2: Cliente API
- [ ] Implementar `WiseClient` com Personal Token
- [ ] Implementar autenticação com Bearer token
- [ ] Implementar retry logic
- [ ] Implementar tratamento de erros
- [ ] Testar conexão com sandbox

### Fase 3: Funcionalidades Core
- [ ] Implementar criação de quotes
- [ ] Implementar criação de recipients
- [ ] Implementar criação de transfers
- [ ] Implementar funding de transfers

### Fase 4: Webhooks
- [ ] Criar Edge Function para webhooks
- [ ] Implementar verificação de assinatura
- [ ] Implementar processamento de eventos
- [ ] Atualizar status no banco

### Fase 5: Integração Checkout
- [ ] Adicionar "Wise" como opção no select de payment method
- [ ] Implementar `handleWisePayment` no VisaCheckout.tsx
- [ ] Criar Edge Function `create-wise-checkout` para criar quote/transfer
- [ ] Implementar redirect para Wise após criar transfer
- [ ] Criar página de retorno (success/cancel) do Wise
- [ ] Atualizar tabela `visa_orders` com campos Wise
- [ ] Integrar webhook para atualizar status de orders quando pagamento confirmado

### Fase 6: Testes e Deploy
- [ ] Testes completos em sandbox (checkout)
- [ ] Testar fluxo completo de checkout com Wise
- [ ] Testar diferentes moedas e tipos de conta
- [ ] Testar webhooks de confirmação
- [ ] Validar geração de PDF e emails
- [ ] Migrar para produção
- [ ] Documentação para usuários
- [ ] Monitoramento pós-deploy

---

## 🚨 Considerações Importantes

### Segurança:
- **NUNCA** commitar certificados ou chaves privadas no Git
- Usar variáveis de ambiente ou Supabase Secrets
- Validar sempre assinaturas de webhooks
- Implementar rate limiting

### Taxas e Custos:
- Wise cobra taxas por transferência
- Taxas variam por rota de moeda
- Considerar taxas ao calcular valores

### Limites:
- Verificar limites de transferência por moeda
- Implementar validações de valores mínimos/máximos
- Tratar casos de quote expirado (30 minutos)

### Idempotência:
- Sempre usar `customerTransactionId` único
- Evitar transferências duplicadas
- Implementar verificação antes de criar transfer

---

## 📚 Recursos Adicionais

- [Wise API Reference](https://docs.wise.com/api-reference/)
- [Wise Developer Hub](https://developer.wise.com/)
- [Wise Transfer Tracking Guide](https://docs.wise.com/guides/product/send-money/tracking-transfers)
- [Wise Webhook API](https://docs.wise.com/api-reference/webhook)

---

## 📋 Configuração Necessária

### Dados Bancários da Migma (Recipient)

**IMPORTANTE**: O recipient é sempre a conta da Migma que recebe os pagamentos. Esses dados devem ser configurados uma vez e reutilizados para todos os transfers.

```typescript
interface MigmaBankDetails {
  accountHolderName: string;      // "Migma Inc" ou nome da empresa
  currency: string;               // "USD" (moeda que a Migma recebe)
  accountType: 'iban' | 'sort_code' | 'aba' | 'swift';
  
  // Dados bancários da conta da Migma
  // Exemplo para ABA (Estados Unidos):
  aba?: string;
  accountNumber?: string;
  
  // Ou para IBAN (Europa):
  iban?: string;
  
  // etc...
}
```

**Onde Configurar:**
- Armazenar em variáveis de ambiente ou Supabase Secrets
- Usar o mesmo recipient para todos os transfers
- Não precisa coletar dados do cliente (ele apenas paga)

---

## ❓ Perguntas a Resolver Antes da Implementação

### 1. Método de Autenticação ✅ DECIDIDO
- ✅ **Personal Token** (já decidido)
- ✅ Não precisa entrar em contato com Wise
- ✅ Cliente faz o pagamento na plataforma Wise

### 2. Fluxo de Pagamento
- **Como o cliente paga via Wise?**
  - Opção A: Cliente é redirecionado para Wise e paga lá (redirect flow)
  - Opção B: Cliente paga via widget embedded na nossa plataforma
  - Opção C: Cliente recebe link/QR code para pagar depois
  
- **Quem faz o funding?**
  - ✅ Cliente faz o funding na plataforma Wise (redirect flow)
  - ✅ Personal Token funciona perfeitamente para isso

### 3. Dados Bancários da Migma
- **Qual conta da Migma receberá os pagamentos?**
  - Definir dados bancários da conta Migma (recipient)
  - Armazenar em variáveis de ambiente
  - Usar o mesmo recipient para todos os transfers
  
  **NOTA**: 
  - Cliente NÃO precisa fornecer dados bancários
  - Cliente apenas paga na plataforma Wise
  - Recipient = Conta da Migma que recebe

### 4. Moedas Suportadas
- **Quais moedas serão aceitas?**
  - Cliente paga em sua moeda local e Migma recebe em USD?
  - Ou cliente paga em USD diretamente?

### 5. Taxas
- **Como as taxas são calculadas?**
  - Taxa do Wise é cobrada do cliente ou da Migma?
  - Como exibir o valor final para o cliente?

### 6. Confirmação de Pagamento
- **Como confirmar que o pagamento foi recebido?**
  - Via webhook quando dinheiro chega na conta?
  - Ou quando transfer é criada?

---

## 🎯 Próximos Passos

### Decisão Inicial (CRÍTICA):

**Se escolher Personal Token (Recomendado para começar):**
1. ✅ Token já está disponível na conta Wise
2. ✅ **NÃO precisa entrar em contato com Wise**
3. ✅ Começar implementação imediatamente
4. ⚠️ Lembrar: não pode fundar transfers via API (cliente precisa fazer manualmente)

### Passos Imediatos:
1. ✅ **Método decidido**: Personal Token (não precisa contato)
2. **Obter Personal Token** da conta Wise (já disponível)
3. **Obter Profile ID** da conta Wise
4. **Configurar webhook** na conta Wise
5. **Definir dados bancários da Migma** (recipient que recebe pagamentos)
6. **Definir quais países/moedas serão suportados** no checkout
7. **Começar implementação** pela Fase 1

---

**Última atualização**: 2026-01-09  
**Status**: 📋 Planejamento  
**Contexto**: Integração para Checkout de Produtos (Sales Links) - APENAS para pagamentos de clientes, NÃO para comissões
