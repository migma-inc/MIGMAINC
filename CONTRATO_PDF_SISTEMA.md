# 📄 Sistema de Geração de Contrato PDF - Visa Services

## ✅ IMPLEMENTAÇÃO COMPLETA

### 📋 Resumo

Sistema completo de geração de PDF de contrato eletrônico para serviços de visto. O PDF é gerado automaticamente quando:
- **Stripe (Card/PIX)**: Pagamento confirmado via webhook
- **Zelle**: Após upload do comprovante e criação do pedido

---

## 🔄 FLUXO COMPLETO

### **1. Cliente Assina Contrato**

```
Cliente no checkout
  ↓
Upload selfie com documento
  ↓
Aceita termos do contrato
  ↓
Dados salvos no banco:
  - contract_selfie_url
  - contract_document_url (mesma URL da selfie)
  - contract_accepted = true
  - contract_signed_at = NOW()
  - ip_address (capturado automaticamente)
```

### **2. Cliente Faz Pagamento**

#### **Opção A: Stripe (Card/PIX)**
```
Cliente paga via Stripe
  ↓
Webhook recebe: checkout.session.completed
  ↓
Status atualizado: payment_status = 'completed'
  ↓
🔴 GERAÇÃO AUTOMÁTICA DE PDF
  - Edge Function: generate-visa-contract-pdf
  - PDF salvo em: contracts/visa-contracts/
  - URL salva em: visa_orders.contract_pdf_url
```

#### **Opção B: Zelle**
```
Cliente faz upload do comprovante
  ↓
Pedido criado: payment_status = 'pending'
  ↓
🔴 GERAÇÃO IMEDIATA DE PDF
  - Edge Function: generate-visa-contract-pdf
  - PDF gerado antes mesmo da aprovação
  - URL salva em: visa_orders.contract_pdf_url
```

---

## 📊 ESTRUTURA DO PDF

O PDF gerado contém:

### **1. Header**
- Título: "VISA SERVICE CONTRACT"
- Subtítulo: "MIGMA"

### **2. Order Information**
- Order Number
- Service (nome do produto)
- Total Amount
- Payment Method
- Seller ID (se aplicável)

### **3. Client Information**
- Full Name
- Email
- WhatsApp (se fornecido)
- Country (se fornecido)
- Nationality (se fornecido)
- Extra Units (dependentes/RFEs/etc)

### **4. Terms & Conditions**
- Termos completos do serviço
- 8 cláusulas principais
- Aceite eletrônico confirmado

### **5. Signature Section**
- Data de assinatura
- **Selfie com documento** (imagem embutida no PDF)
- Linha de assinatura
- Nome do cliente (sublinhado)

### **6. Technical Information**
- Contract Signed At
- Order Created At
- **IP Address** (capturado no checkout)
- Payment Status

### **7. Footer (em todas as páginas)**
- Data/hora de geração
- Nota legal de validade

---

## 🗄️ BANCO DE DADOS

### Campos Adicionados:

```sql
-- Tabela: visa_orders

contract_document_url TEXT        -- URL do documento (selfie)
contract_selfie_url TEXT          -- URL da selfie com documento
contract_signed_at TIMESTAMPTZ    -- Data/hora da assinatura
contract_accepted BOOLEAN         -- Se aceitou os termos
contract_pdf_url TEXT             -- URL do PDF gerado
ip_address TEXT                   -- IP do cliente
```

---

## 🔧 EDGE FUNCTIONS

### **1. `generate-visa-contract-pdf`**

**Input:**
```json
{
  "order_id": "uuid-do-pedido"
}
```

**Output:**
```json
{
  "success": true,
  "pdf_url": "https://...",
  "file_path": "visa-contracts/visa_contract_..."
}
```

**O que faz:**
1. Busca dados do pedido no banco
2. Busca dados do produto
3. Gera PDF com jsPDF
4. Carrega selfie do Storage
5. Adiciona selfie no PDF
6. Faz upload do PDF para `contracts/visa-contracts/`
7. Atualiza `visa_orders.contract_pdf_url`

---

## 🔗 INTEGRAÇÕES

### **Webhook Stripe**

**Eventos que geram PDF:**
- `checkout.session.completed` (Card)
- `checkout.session.async_payment_succeeded` (PIX)

**Fluxo:**
```typescript
// Após atualizar payment_status = 'completed'
await supabase.functions.invoke("generate-visa-contract-pdf", {
  body: { order_id: order.id }
});
```

### **Fluxo Zelle**

**Quando:**
- Imediatamente após criar o pedido
- Antes de redirecionar para página de sucesso

**Código:**
```typescript
// Após criar order no banco
await supabase.functions.invoke('generate-visa-contract-pdf', {
  body: { order_id: order.id },
});
```

---

## 👁️ VISUALIZAÇÃO DO PDF

### **Dashboard do Vendedor**

**Onde:**
- `/seller/dashboard` - Lista de vendas (botão PDF)
- `/seller/orders/:id` - Detalhes do pedido (link "View Contract PDF")

**Como aparece:**
- Botão com ícone `FileText` ao lado de "View"
- Link "View Contract PDF" na seção Payment Information

### **Dashboard Admin**

**Onde:**
- `/dashboard/visa-orders` - Lista completa de pedidos

**Como aparece:**
- Coluna "Contract" na tabela
- Link "View PDF" se PDF foi gerado
- "Not generated" se ainda não foi gerado

**Sidebar:**
- Novo item "Visa Orders" no menu admin

---

## 📝 CONTEÚDO DO PDF

### **Seções do Contrato:**

1. **Order Information**
   - Número do pedido
   - Serviço contratado
   - Valor total
   - Método de pagamento
   - Seller ID

2. **Client Information**
   - Dados completos do cliente
   - Unidades extras (dependentes/RFEs)

3. **Terms & Conditions**
   - 8 cláusulas principais
   - Termos de aceite eletrônico

4. **Signature**
   - Data formatada
   - **Foto da selfie com documento** (60x60mm, centralizada)
   - Linha de assinatura
   - Nome do cliente (sublinhado)

5. **Technical Information**
   - Timestamps
   - **IP Address**
   - Status do pagamento

---

## 🧪 COMO TESTAR

### **Teste 1: Zelle (Geração Imediata)**

1. Acesse: `http://localhost:5173/checkout/visa/canada-work?seller=TESTE`
2. Preencha formulário
3. Assine contrato (upload selfie)
4. Selecione "Zelle"
5. Faça upload de qualquer imagem
6. Clique em "Submit Zelle Payment"
7. ✅ PDF deve ser gerado **imediatamente**
8. Verifique no banco: `contract_pdf_url` deve ter URL

### **Teste 2: Stripe Card (Geração via Webhook)**

1. Acesse checkout
2. Assine contrato
3. Selecione "Card"
4. Use cartão de teste: `4242 4242 4242 4242`
5. Complete pagamento
6. ✅ Webhook recebe evento
7. ✅ PDF é gerado automaticamente
8. Verifique no banco: `contract_pdf_url` deve ter URL

### **Teste 3: Visualizar PDF**

**Como Vendedor:**
1. Login em: `/seller/login`
2. Acesse: `/seller/dashboard`
3. Clique no ícone PDF ao lado de uma venda
4. ✅ PDF abre em nova aba

**Como Admin:**
1. Login em: `/dashboard`
2. Clique em "Visa Orders" no sidebar
3. Clique em "View PDF" em qualquer pedido
4. ✅ PDF abre em nova aba

---

## 📂 ESTRUTURA DE ARQUIVOS

### **Edge Functions:**
- `supabase/functions/generate-visa-contract-pdf/index.ts` ✅

### **Frontend:**
- `src/pages/VisaCheckout.tsx` - Captura IP, integra assinatura
- `src/components/checkout/ContractSigning.tsx` - Componente de assinatura
- `src/pages/SellerDashboard.tsx` - Visualização PDF
- `src/pages/SellerOrderDetail.tsx` - Visualização PDF
- `src/pages/VisaOrdersPage.tsx` - Lista admin de pedidos

### **Banco de Dados:**
- Campo `contract_pdf_url` em `visa_orders` ✅
- Campo `ip_address` em `visa_orders` ✅
- Campos de contrato (`contract_selfie_url`, `contract_signed_at`, etc) ✅

---

## 🎯 QUANDO O PDF É GERADO

### **Stripe (Card/PIX):**
- ✅ Quando webhook recebe `checkout.session.completed`
- ✅ Quando webhook recebe `checkout.session.async_payment_succeeded` (PIX)
- ⏱️ **Timing**: Imediatamente após confirmação de pagamento

### **Zelle:**
- ✅ Quando pedido é criado (após upload do comprovante)
- ⏱️ **Timing**: Imediatamente após criar o pedido
- 📝 **Nota**: PDF é gerado mesmo com status `pending`

---

## 🔍 ONDE VER O PDF

### **Para Vendedor:**
1. Dashboard: `/seller/dashboard`
   - Botão PDF na coluna "Actions"
2. Detalhes: `/seller/orders/:id`
   - Link "View Contract PDF" na seção Payment

### **Para Admin:**
1. Lista de Pedidos: `/dashboard/visa-orders`
   - Link "View PDF" na coluna "Contract"
   - Mostra "Not generated" se ainda não foi gerado

---

## 📊 CONTEÚDO DO PDF (Detalhado)

### **Página 1:**
- Header (Título + MIGMA)
- Order Information (completo)
- Client Information (completo)

### **Página 2:**
- Terms & Conditions (texto completo)
- Signature Section:
  - Data
  - **Selfie com documento** (imagem)
  - Linha de assinatura
  - Nome do cliente

### **Página 3 (se necessário):**
- Technical Information:
  - Timestamps
  - IP Address
  - Payment Status

### **Todas as páginas:**
- Footer com data de geração
- Nota legal

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

- [x] Campo `contract_pdf_url` no banco
- [x] Campo `ip_address` no banco
- [x] Edge Function `generate-visa-contract-pdf` criada
- [x] Edge Function deployada
- [x] Integração no webhook Stripe (Card)
- [x] Integração no webhook Stripe (PIX)
- [x] Integração no fluxo Zelle
- [x] Captura de IP no checkout
- [x] Visualização PDF no dashboard vendedor
- [x] Visualização PDF no dashboard admin
- [x] Página admin `/dashboard/visa-orders`
- [x] Link no sidebar admin

---

## 🎉 SISTEMA 100% FUNCIONAL!

**O PDF é gerado automaticamente quando:**
- ✅ Pagamento Stripe confirmado (Card ou PIX)
- ✅ Pedido Zelle criado (após upload)

**O PDF contém:**
- ✅ Todas as informações do pedido
- ✅ Dados completos do cliente
- ✅ Selfie com documento (imagem embutida)
- ✅ IP Address
- ✅ Termos e condições
- ✅ Assinatura eletrônica

**O PDF pode ser visualizado por:**
- ✅ Vendedor (no dashboard dele)
- ✅ Admin (na página Visa Orders)

---

## 🚀 PRONTO PARA USO!

O sistema está completo e funcional. Teste fazendo um pedido de teste e verifique se o PDF é gerado corretamente! 🎊
















