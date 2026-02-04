# 📘 Documentação Técnica - Sistema de Split Payment

## 🎯 Visão Geral

Sistema que permite clientes dividirem o pagamento de um serviço em **2 partes**, usando **métodos diferentes** (Cartão, PIX ou TED) via Parcelow.

---

## 🏗️ Arquitetura

### **Fluxo de Dados**

```
Cliente → Frontend (UI) → Edge Function → Parcelow API
                              ↓
                         Supabase DB
                              ↓
                    Parcelow Webhook → Edge Function → Atualiza DB
                                                            ↓
                                                    Gera Contratos (quando completo)
```

---

## 📊 Estrutura do Banco de Dados

### **Tabela: `split_payments`**

```sql
CREATE TABLE split_payments (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES visa_orders(id),
  
  -- Configuração
  total_amount_usd DECIMAL(10, 2) NOT NULL,
  split_count INTEGER DEFAULT 2,
  
  -- Part 1
  part1_amount_usd DECIMAL(10, 2) NOT NULL,
  part1_payment_method TEXT NOT NULL, -- 'card', 'pix', 'ted'
  part1_parcelow_order_id TEXT,
  part1_parcelow_checkout_url TEXT,
  part1_payment_status TEXT DEFAULT 'pending',
  part1_completed_at TIMESTAMPTZ,
  
  -- Part 2
  part2_amount_usd DECIMAL(10, 2) NOT NULL,
  part2_payment_method TEXT NOT NULL,
  part2_parcelow_order_id TEXT,
  part2_parcelow_checkout_url TEXT,
  part2_payment_status TEXT DEFAULT 'pending',
  part2_completed_at TIMESTAMPTZ,
  
  -- Status Geral
  overall_status TEXT DEFAULT 'pending',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_split_sum CHECK (part1_amount_usd + part2_amount_usd = total_amount_usd),
  CONSTRAINT different_payment_methods CHECK (part1_payment_method != part2_payment_method)
);
```

### **Campos Adicionados em `visa_orders`**

```sql
ALTER TABLE visa_orders 
  ADD COLUMN is_split_payment BOOLEAN DEFAULT FALSE,
  ADD COLUMN split_payment_id UUID REFERENCES split_payments(id);
```

---

## 🔧 Edge Functions

### **1. `create-split-parcelow-checkout`**

**Responsabilidade:** Criar split payment e gerar 2 checkouts Parcelow

**Input:**
```typescript
{
  order_id: string;
  part1_amount: number;
  part1_method: 'card' | 'pix' | 'ted';
  part2_amount: number;
  part2_method: 'card' | 'pix' | 'ted';
}
```

**Output:**
```typescript
{
  success: true,
  split_payment_id: string,
  part1_checkout_url: string,
  part2_checkout_url: string
}
```

**Fluxo:**
1. Valida parâmetros usando `validate_split_payment()`
2. Cria registro em `split_payments`
3. Atualiza `visa_orders` com `is_split_payment = true`
4. Chama `create-parcelow-checkout` 2x (Part 1 e Part 2)
5. Atualiza `split_payments` com URLs e IDs dos checkouts
6. Retorna URLs para redirecionamento

---

### **2. `get-next-split-checkout`**

**Responsabilidade:** Retornar próximo checkout pendente

**Input:**
```typescript
{
  split_payment_id: string;
}
```

**Output:**
```typescript
{
  success: true,
  has_next_checkout: boolean,
  next_checkout_url?: string,
  part_number?: 1 | 2,
  overall_status: string
}
```

**Casos:**
- Part 1 pendente → Retorna URL Part 1
- Part 1 paga, Part 2 pendente → Retorna URL Part 2
- Ambas pagas → `has_next_checkout: false`

---

### **3. `parcelow-webhook` (Modificado)**

**Responsabilidade:** Processar webhooks Parcelow para split payments

**Detecção:**
```typescript
const { data: splitPayment } = await supabase
  .from("split_payments")
  .select("*")
  .or(`part1_parcelow_order_id.eq.${parcelowOrder.id},part2_parcelow_order_id.eq.${parcelowOrder.id}`)
  .single();

if (splitPayment) {
  // Processar como split payment
  await processSplitPaymentWebhook(...);
  return;
}
```

**Lógica de Processamento:**

#### **Part 1 Paga:**
```typescript
updateData.part1_payment_status = 'completed';
updateData.part1_completed_at = NOW();
updateData.overall_status = 'part1_completed';

// NÃO GERA CONTRATOS
```

#### **Part 2 Paga (e Part 1 já paga):**
```typescript
updateData.part2_payment_status = 'completed';
updateData.part2_completed_at = NOW();
updateData.overall_status = 'fully_completed';

// GERA CONTRATOS
await supabase.functions.invoke("generate-visa-contract-pdf", ...);
await supabase.functions.invoke("generate-annex-pdf", ...);
await supabase.functions.invoke("generate-invoice-pdf", ...);

// ENVIA EMAIL
await supabase.functions.invoke("send-payment-confirmation-email", ...);
```

---

## 🎨 Frontend

### **Componentes**

#### **1. `SplitPaymentSelector`**

**Localização:** `src/features/visa-checkout/components/steps/step3/SplitPaymentSelector.tsx`

**Props:**
```typescript
interface SplitPaymentSelectorProps {
  totalAmount: number;
  onSplitChange: (config: SplitPaymentConfig | null) => void;
  disabled?: boolean;
}
```

**Estado Interno:**
```typescript
const [useSplit, setUseSplit] = useState(false);
const [part1Amount, setPart1Amount] = useState(totalAmount / 2);
const [part1Method, setPart1Method] = useState<'card' | 'pix' | 'ted'>('card');
const [part2Method, setPart2Method] = useState<'card' | 'pix' | 'ted'>('pix');
```

**Validações:**
- ✅ Métodos não podem ser iguais
- ✅ Part 1 + Part 2 = Total
- ✅ Valores > 0

---

#### **2. `SplitPaymentRedirect`**

**Localização:** `src/pages/SplitPaymentRedirect.tsx`

**Rota:** `/checkout/split-payment/redirect?split_payment_id=[uuid]`

**Funcionalidades:**
- Busca status do split payment
- Mostra resumo visual (Part 1 ✅, Part 2 ⏳)
- Countdown de 3 segundos
- Redirecionamento automático para próximo checkout

---

### **Estado Global**

**Adicionado em `VisaCheckoutState`:**
```typescript
interface VisaCheckoutState {
  // ... outros campos
  splitPaymentConfig: SplitPaymentConfig | null;
  totalPriceUsd: string;
}
```

**Adicionado em `VisaCheckoutActions`:**
```typescript
interface VisaCheckoutActions {
  // ... outras actions
  setSplitPaymentConfig: (val: SplitPaymentConfig | null) => void;
}
```

---

### **Handler de Pagamento**

**Modificado:** `usePaymentHandlers.ts` → `handleParcelowPayment`

**Lógica:**
```typescript
if (state.splitPaymentConfig && state.splitPaymentConfig.enabled) {
  // 1. Criar order com is_split_payment = true
  // 2. Chamar create-split-parcelow-checkout
  // 3. Redirecionar para Part 1
  return;
}

// Fluxo normal (sem split)
```

---

## 🔐 Segurança

### **RLS Policies**

```sql
-- Admins têm acesso total
CREATE POLICY "Admins can manage split payments"
ON split_payments FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users 
    WHERE admin_users.user_id = auth.uid()
  )
);

-- Service role tem acesso total
CREATE POLICY "Service role full access"
ON split_payments FOR ALL
TO service_role
USING (true);
```

---

## 📈 Monitoramento

### **Logs Importantes**

#### **Frontend:**
```
[Parcelow] 🔍 Verificando se é split payment...
[Parcelow] 🎯 SPLIT PAYMENT DETECTADO!
[Parcelow Split] ✅ Order criada: [uuid]
[Parcelow Split] 🔄 Chamando create-split-parcelow-checkout...
[Parcelow Split] ✅ Split checkout criado
[Parcelow Split] 🚀 Redirecionando para Part 1...
```

#### **Backend (Edge Functions):**
```
[Split Checkout] Iniciando criação de split payment...
[Split Checkout] ✅ Validação passou
[Split Checkout] ✅ Split payment criado: [uuid]
[Split Checkout] 🔄 Criando checkout Part 1 (Parcelow)...
[Split Checkout] 🔄 Criando checkout Part 2 (Parcelow)...
[Split Checkout] ✅ Ambos os checkouts criados
```

#### **Webhook:**
```
[Split Webhook] 🎯 Processando webhook de split payment...
[Split Webhook] 📦 Parte detectada: Part 1
[Split Webhook] 💰 Part 1 PAGA! Atualizando banco...
[Split Webhook] ⏳ Apenas Part 1 paga. Aguardando Part 2...
```

---

## 🚀 Deploy

### **1. Migração do Banco**
```bash
supabase db push
```

### **2. Deploy Edge Functions**
```bash
supabase functions deploy create-split-parcelow-checkout
supabase functions deploy get-next-split-checkout
supabase functions deploy parcelow-webhook
```

### **3. Frontend**
```bash
npm run build
# Deploy conforme processo normal
```

---

## 🐛 Troubleshooting

### **Problema:** Contratos gerados após Part 1
**Causa:** Lógica do webhook incorreta
**Solução:** Verificar `bothPartsPaid` antes de gerar contratos

### **Problema:** Redirecionamento não funciona
**Causa:** URLs de checkout não foram salvas
**Solução:** Verificar se `create-parcelow-checkout` retorna URLs corretas

### **Problema:** Métodos duplicados permitidos
**Causa:** Validação frontend não está funcionando
**Solução:** Verificar `methodsValid` em `SplitPaymentSelector`

---

## 📚 Referências

- **Migração:** `supabase/migrations/20260203000000_create_split_payments.sql`
- **Edge Functions:** `supabase/functions/create-split-parcelow-checkout/`
- **Componente UI:** `src/features/visa-checkout/components/steps/step3/SplitPaymentSelector.tsx`
- **Página Redirect:** `src/pages/SplitPaymentRedirect.tsx`
- **Guia de Testes:** `SPLIT_PAYMENT_TESTING_GUIDE.md`

---

## ✅ Checklist de Produção

Antes de ir para produção:

- [ ] Migração aplicada no banco de produção
- [ ] Edge Functions deployadas
- [ ] Testes funcionais completos
- [ ] Testes de webhook com Parcelow
- [ ] Monitoramento configurado
- [ ] Logs sendo capturados
- [ ] Documentação atualizada
- [ ] Equipe treinada

---

**Versão:** 1.0.0  
**Data:** 2026-02-03  
**Autor:** Antigravity AI
