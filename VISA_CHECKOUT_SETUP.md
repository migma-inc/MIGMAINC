# Sistema de Checkout de Vistos - Guia de Configuração

## 📋 Visão Geral

Sistema completo de checkout "ghost" para vendas de serviços de visto com integração Stripe.

### Características Implementadas

- ✅ URLs privadas (ghost) para checkout: `/checkout/visa/:productSlug`
- ✅ Rastreamento de vendedores via query param: `?seller=VENDEDOR_ID`
- ✅ Formulário completo com 5 seções
- ✅ Cálculo automático de dependentes
- ✅ Integração Stripe (Card + PIX)
- ✅ Opção Zelle (upload manual de comprovante)
- ✅ Webhooks para confirmação de pagamento
- ✅ Emails de confirmação automáticos
- ✅ Banco de dados completo (products + orders)

---

## 🔧 Configuração Inicial

### 1. Variáveis de Ambiente no Supabase

Configure no **Supabase Dashboard → Project Settings → Edge Functions → Secrets**:

```bash
# Chaves do Stripe
STRIPE_SECRET_KEY=sk_test_...          # Chave de teste
STRIPE_SECRET_KEY_TEST=sk_test_...     # Opcional: chave de teste específica
STRIPE_SECRET_KEY_LIVE=sk_live_...     # Opcional: chave de produção específica

# Webhook Secret (obtido após configurar webhook no Stripe)
STRIPE_WEBHOOK_SECRET=whsec_...

# URL do site
SITE_URL=https://seusite.com           # Produção
# ou
SITE_URL=http://localhost:5173         # Desenvolvimento
```

### 2. Configurar Webhook no Stripe Dashboard

1. Acesse: https://dashboard.stripe.com/webhooks
2. Clique em **"Add endpoint"**
3. Configure:
   - **Endpoint URL:** `https://[seu-projeto].supabase.co/functions/v1/stripe-visa-webhook`
   - **Eventos a escutar:**
     - `checkout.session.completed`
     - `checkout.session.async_payment_succeeded`
     - `checkout.session.async_payment_failed`
     - `checkout.session.expired`
4. Após criar, copie o **"Signing secret"** (começa com `whsec_`)
5. Cole no Supabase como `STRIPE_WEBHOOK_SECRET`

### 3. Deploy das Edge Functions

```bash
# Deploy create-visa-checkout-session
supabase functions deploy create-visa-checkout-session

# Deploy stripe-visa-webhook
supabase functions deploy stripe-visa-webhook
```

---

## 📊 Estrutura do Banco de Dados

### Tabela: `visa_products`

Armazena os produtos (serviços de visto) disponíveis.

```sql
CREATE TABLE visa_products (
  id UUID PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,              -- Ex: 'initial', 'b1-premium'
  name TEXT NOT NULL,                     -- Nome do produto
  description TEXT,                       -- Descrição
  base_price_usd DECIMAL(10, 2) NOT NULL, -- Preço base em USD
  price_per_dependent_usd DECIMAL(10, 2), -- Preço por dependente
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

**Produtos de Exemplo Criados:**
- `initial` - U.S. Visa - Initial Application (F1) - $999 + $150/dependent
- `b1-premium` - U.S. Visa B1 - Premium Plan - $1,200 + $180/dependent
- `b1-basic` - U.S. Visa B1 - Basic Plan - $800 + $120/dependent

### Tabela: `visa_orders`

Armazena os pedidos/ordens de compra.

```sql
CREATE TABLE visa_orders (
  id UUID PRIMARY KEY,
  order_number TEXT UNIQUE NOT NULL,       -- Ex: ORD-20250108-1234
  
  -- Informações do produto
  product_slug TEXT NOT NULL,
  base_price_usd DECIMAL(10, 2),
  price_per_dependent_usd DECIMAL(10, 2),
  number_of_dependents INTEGER,
  total_price_usd DECIMAL(10, 2),
  
  -- Informações do vendedor
  seller_id TEXT,                          -- ID do vendedor (query param)
  
  -- Informações do cliente
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  client_whatsapp TEXT,
  client_country TEXT,
  client_nationality TEXT,
  client_observations TEXT,
  
  -- Informações de pagamento
  payment_method TEXT,                     -- 'stripe_card', 'stripe_pix', 'zelle'
  payment_status TEXT DEFAULT 'pending',   -- 'pending', 'completed', 'failed', 'cancelled'
  stripe_session_id TEXT,
  stripe_payment_intent_id TEXT,
  
  -- Zelle específico
  zelle_proof_url TEXT,                    -- URL do comprovante
  
  -- Metadata
  payment_metadata JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

---

## 🔗 URLs Disponíveis

### URLs Ghost (Checkout)

Formato: `/checkout/visa/:productSlug?seller=VENDEDOR_ID`

**Exemplos:**
```
https://seusite.com/checkout/visa/initial
https://seusite.com/checkout/visa/initial?seller=MATHEUS01
https://seusite.com/checkout/visa/b1-premium?seller=NATALIA-RJ
https://seusite.com/checkout/visa/b1-basic?seller=JOAO-BH
```

### Outras URLs

- `/legal/visa-service-terms` - Termos & Condições
- `/checkout/success` - Página de sucesso
- `/checkout/cancel` - Página de cancelamento

---

## 💳 Métodos de Pagamento

### 1. Cartão de Crédito (Stripe)

- Processa em USD
- Taxa: 3.9% + $0.30
- Confirmação instantânea
- Webhook: `checkout.session.completed`

### 2. PIX (Stripe)

- Processa em BRL
- Conversão automática de USD → BRL
- Taxa: ~1.79% (1.19% processamento + 0.6% conversão)
- Confirmação em até 24h
- Webhook: `checkout.session.async_payment_succeeded`

### 3. Zelle (Manual)

- Upload de comprovante de pagamento
- Verificação manual pela equipe
- Sem processamento automático
- Status inicial: `pending`

---

## 📧 Emails Automáticos

### Email de Confirmação (Cliente)

Enviado automaticamente quando:
- Pagamento com cartão é confirmado
- Pagamento PIX é confirmado

**Conteúdo:**
- Número do pedido
- Detalhes do produto
- Número de dependentes
- Valor total
- Próximos passos

### Email de Notificação (Vendedor)

_TODO: Implementar quando dashboard de vendedor estiver pronto_

---

## 🧪 Como Testar

### 1. Testar Stripe (Modo Teste)

Use cartões de teste do Stripe:
- **Sucesso:** `4242 4242 4242 4242`
- **Falha:** `4000 0000 0000 0002`
- **3D Secure:** `4000 0027 6000 3184`

Data de validade: Qualquer data futura  
CVV: Qualquer 3 dígitos  
CEP: Qualquer 5 dígitos

### 2. Testar PIX (Modo Teste)

No modo teste do Stripe, o PIX gera um QR code de teste que pode ser "pago" pela interface do Stripe.

### 3. Testar Zelle

1. Selecione "Zelle" como método de pagamento
2. Faça upload de qualquer imagem/PDF como comprovante
3. Pedido é criado com status `pending`
4. Verificar na tabela `visa_orders`

---

## 📈 Dashboard de Vendas (Futuro)

### Funcionalidades Planejadas

- Dashboard por vendedor (`/dashboard/sales`)
- Login de vendedor
- Visualização de vendas por `seller_id`
- Total de vendas e comissões
- Filtros por status e período

### Estrutura já preparada

Todos os pedidos já salvam `seller_id`, então o dashboard pode ser implementado a qualquer momento.

---

## 🔍 Consultas Úteis

### Ver todos os produtos

```sql
SELECT * FROM visa_products WHERE is_active = true;
```

### Ver pedidos pendentes

```sql
SELECT * FROM visa_orders WHERE payment_status = 'pending' ORDER BY created_at DESC;
```

### Ver pedidos de um vendedor

```sql
SELECT * FROM visa_orders WHERE seller_id = 'MATHEUS01' ORDER BY created_at DESC;
```

### Ver pedidos com Zelle pendentes

```sql
SELECT * FROM visa_orders 
WHERE payment_method = 'zelle' AND payment_status = 'pending'
ORDER BY created_at DESC;
```

---

## 🐛 Troubleshooting

### Erro: "Stripe secret key not configured"

**Solução:** Configure `STRIPE_SECRET_KEY` no Supabase Edge Functions.

### Erro: "Webhook signature verification failed"

**Solução:** Verifique se `STRIPE_WEBHOOK_SECRET` está correto no Supabase.

### Pedido não atualiza após pagamento

**Solução:** 
1. Verifique se o webhook está configurado corretamente no Stripe
2. Verifique os logs da Edge Function `stripe-visa-webhook`

### Email não enviado

**Solução:** Verifique se a Edge Function `send-email` está funcionando.

---

## 📝 Notas Importantes

1. **Segurança:** Todas as URLs de checkout são públicas, mas "ghost" (não aparecem no menu)
2. **Taxas:** Stripe cobra taxas adicionais que são calculadas automaticamente
3. **Moeda:** Todos os preços base são em USD, PIX converte automaticamente
4. **Zelle:** Requer verificação manual pela equipe
5. **Vendedores:** Use IDs únicos e rastreáveis (ex: MATHEUS01, NATALIA-RJ)

---

## 🚀 Próximos Passos

1. ✅ Sistema de checkout completo
2. ✅ Integração Stripe
3. ✅ Emails automáticos
4. 🔜 Dashboard de vendedor
5. 🔜 Dashboard admin para gerenciar pedidos
6. 🔜 Relatórios de vendas
7. 🔜 Sistema de comissões

---

## 📞 Suporte

Para dúvidas ou problemas, contate o desenvolvedor.

---

**Última atualização:** Janeiro 2025
















