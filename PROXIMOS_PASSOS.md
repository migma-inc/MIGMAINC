# 🚀 Próximos Passos - Sistema de Vendas MIGMA

## ✅ BANCO DE DADOS - REESTRUTURAÇÃO COMPLETA (CONCLUÍDO)

### Novas Tabelas Criadas:

1. ✅ **`clients`** - Dados pessoais completos do cliente
   - Campos: full_name, date_of_birth, nationality, document_type, document_number
   - Endereço: address_line, city, state, postal_code, country
   - Contato: email, phone
   - Estado civil: marital_status
   - RLS habilitado com políticas públicas

2. ✅ **`service_requests`** - Pedidos de serviço (complementa visa_orders)
   - Vincula com `clients` via `client_id`
   - Campos: service_id (product_slug), dependents_count, seller_id
   - Status: onboarding, pending_payment, paid, cancelled
   - RLS habilitado

3. ✅ **`identity_files`** - Uploads de documentos e selfies
   - Tipos: document_front, document_back, selfie_doc
   - Campos: file_path, file_name, file_size, created_ip, user_agent
   - Vincula com `service_requests` via `service_request_id`
   - RLS habilitado

4. ✅ **`terms_acceptance`** - Aceite de termos e condições
   - Campos: accepted, accepted_at, terms_version
   - Segundo checkbox: data_authorization (autorização de uso de dados/imagens)
   - Campos de segurança: accepted_ip, user_agent
   - Vincula com `service_requests` via `service_request_id`
   - RLS habilitado

5. ✅ **`payments`** - Registros de pagamento
   - Campos: external_payment_id (Stripe), amount, currency, status
   - Status: pending, paid, failed, dispute
   - raw_webhook_log (JSONB) para logs
   - Vincula com `service_requests` via `service_request_id`
   - RLS habilitado

6. ✅ **`visa_orders`** - Atualizada
   - Adicionado campo `service_request_id` para vincular com nova estrutura
   - Mantém compatibilidade com sistema existente

### Estrutura de Relacionamentos:
```
clients (1) ──< (N) service_requests (1) ──< (N) identity_files
                                              └──< (N) terms_acceptance
                                              └──< (N) payments
                                              └──< (N) visa_orders
```

### Próximo Passo: Frontend ✅ (CONCLUÍDO)
- ✅ Reestruturar `VisaCheckout.tsx` em 3 etapas obrigatórias
- ✅ Adicionar todos os campos do formulário
- ✅ Separar upload de documento do selfie
- ✅ Implementar barra de progresso multi-step

### Edge Functions Atualizadas ✅ (CONCLUÍDO)

1. ✅ **`create-visa-checkout-session`**:
   - Aceita `service_request_id` opcional do frontend
   - Cria registro em `payments` table
   - Vincula `service_request_id` ao `visa_orders`
   - Mantém compatibilidade com sistema antigo

2. ✅ **`stripe-visa-webhook`**:
   - Atualiza `payments` table quando pagamento confirmado/falhou/expirado
   - Atualiza `service_requests.status` para 'paid' quando pagamento confirmado
   - Mantém atualização de `visa_orders` para compatibilidade

3. ⚠️ **`generate-visa-contract-pdf`**:
   - Funciona com dados de `visa_orders` (já implementado)
   - Opcional: Pode buscar dados de `clients` e `service_requests` para informações mais completas (não crítico)

---

## ✅ O QUE JÁ ESTÁ PRONTO

1. ✅ **Sistema de Checkout Completo**
   - URLs ghost para checkout
   - 10 produtos configurados
   - Cálculo dinâmico (base_plus_units / units_only)
   - Integração Stripe (Card + PIX)
   - Zelle com upload de comprovante

2. ✅ **Sistema de Vendedores**
   - Registro/login de vendedores
   - Dashboard do vendedor
   - Gerador de links personalizados
   - Visualização de vendas
   - Stats (Total, Completed, Pending, Revenue)

3. ✅ **Backend Completo**
   - Edge Functions deployadas
   - Webhooks Stripe funcionando
   - Emails automáticos
   - Banco de dados estruturado

---

## 📋 PRÓXIMOS PASSOS PRIORITÁRIOS

### 🔴 **PRIORIDADE ALTA (Fazer Agora)**

#### 1. **Assinatura de Contrato Eletrônico** ⚡
**O que fazer:**
- Adicionar etapa no checkout ANTES do pagamento
- Cliente precisa:
  1. Ler e aceitar termos (checkbox obrigatório)
  2. Fazer upload de foto do documento (RG/Passaporte)
  3. Fazer selfie segurando o documento
  4. Sistema valida que é a mesma pessoa

**Onde implementar:**
- `src/pages/VisaCheckout.tsx` - Adicionar nova seção antes do pagamento
- Criar componente `ContractSigning.tsx`
- Salvar fotos no Supabase Storage (`visa-documents`)
- Salvar URLs no banco (`visa_orders.contract_document_url`, `contract_selfie_url`)
- Validar que checkbox foi marcado antes de permitir pagamento

**Tabela precisa de:**
```sql
ALTER TABLE visa_orders
ADD COLUMN IF NOT EXISTS contract_document_url TEXT,
ADD COLUMN IF NOT EXISTS contract_selfie_url TEXT,
ADD COLUMN IF NOT EXISTS contract_signed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS contract_accepted BOOLEAN DEFAULT false;
```

---

#### 2. **Dashboard Admin - Aprovação de Zelle** ⚡
**O que fazer:**
- Criar página `/dashboard/zelle-approvals` (ou adicionar no dashboard existente)
- Listar todos os pedidos Zelle com status `pending`
- Mostrar:
  - Informações do pedido
  - Link do comprovante Zelle
  - Dados do cliente
- Botões: "Aprovar" e "Rejeitar"
- Ao aprovar: atualizar `payment_status = 'completed'` e enviar emails

**Onde implementar:**
- `src/pages/Dashboard.tsx` - Adicionar nova aba/seção
- Criar componente `ZelleApprovalList.tsx`
- Criar Edge Function ou usar Supabase RPC para aprovar
- Enviar email de confirmação ao cliente e vendedor

**Queries necessárias:**
```sql
-- Ver pedidos Zelle pendentes
SELECT * FROM visa_orders 
WHERE payment_method = 'zelle' 
AND payment_status = 'pending'
ORDER BY created_at DESC;

-- Aprovar pedido Zelle
UPDATE visa_orders
SET payment_status = 'completed',
    completed_at = NOW()
WHERE id = :order_id;
```

---

### 🟡 **PRIORIDADE MÉDIA (Próxima Fase)**

#### 3. **Analytics de Funil de Vendas** 📊
**O que fazer:**
- Rastrear cliques nos links dos vendedores
- Rastrear preenchimento de formulário
- Rastrear início de pagamento
- Rastrear conclusão de pagamento
- Mostrar funil no dashboard do vendedor

**Onde implementar:**
- Criar tabela `seller_link_analytics`
- Adicionar tracking no checkout (query params, cookies, ou localStorage)
- Dashboard do vendedor mostra:
  - Total de cliques
   - Total de formulários iniciados
   - Total de pagamentos iniciados
  - Total de pagamentos completados
  - Taxa de conversão

**Tabela necessária:**
```sql
CREATE TABLE seller_link_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id TEXT NOT NULL,
  product_slug TEXT,
  event_type TEXT NOT NULL, -- 'click', 'form_started', 'payment_started', 'payment_completed'
  order_id UUID REFERENCES visa_orders(id),
  ip_address TEXT,
  user_agent TEXT,
  referer TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

#### 4. **Proteções Anti-Chargeback** 🛡️
**O que fazer:**
- Configurar Stripe Radar (anti-fraude)
- Habilitar 3D Secure para cartões internacionais
- Criar termos de aceite mais robustos
- Adicionar avisos sobre chargebacks
- Configurar regras de bloqueio automático

**Onde implementar:**
- Edge Function `create-visa-checkout-session` - Adicionar parâmetros do Stripe:
  ```typescript
  payment_intent_data: {
    payment_method_options: {
      card: {
        request_three_d_secure: 'automatic'
      }
    }
  }
  ```
- Dashboard Stripe - Configurar Radar rules
- Atualizar termos em `VisaServiceTerms.tsx`

---

### 🟢 **PRIORIDADE BAIXA (Melhorias Futuras)**

#### 5. **Sistema de Comissões** 💰
- Calcular comissões por vendedor
- Dashboard mostra comissões pendentes/pagas
- Histórico de pagamentos

#### 6. **Relatórios Avançados** 📈
- Gráficos de vendas por período
- Top vendedores
- Produtos mais vendidos
- Análise de conversão

#### 7. **Notificações em Tempo Real** 🔔
- Notificar vendedor quando houver nova venda
- Notificar admin quando houver Zelle pendente
- Email/SMS/WhatsApp

#### 8. **Sistema de Cupons/Descontos** 🎟️
- Criar cupons de desconto
- Aplicar no checkout
- Rastrear uso

---

## 🎯 PLANO DE IMPLEMENTAÇÃO RECOMENDADO

### **FASE 1: Segurança e Validação (1-2 semanas)**
1. ✅ Assinatura de Contrato Eletrônico
2. ✅ Dashboard Admin - Aprovação Zelle
3. ✅ Proteções Anti-Chargeback básicas

**Resultado:** Sistema seguro e validado antes de cada venda

---

### **FASE 2: Analytics e Insights (1 semana)**
4. ✅ Analytics de Funil
5. ✅ Dashboard melhorado com métricas

**Resultado:** Vendedores podem ver performance e otimizar vendas

---

### **FASE 3: Melhorias e Otimizações (Ongoing)**
6. Sistema de Comissões
7. Relatórios Avançados
8. Notificações
9. Cupons/Descontos

---

## 📝 CHECKLIST DETALHADO - FASE 1

### ✅ Assinatura de Contrato Eletrônico

- [ ] Criar componente `ContractSigning.tsx`
- [ ] Adicionar campos no banco (`contract_document_url`, `contract_selfie_url`, etc)
- [ ] Adicionar seção no `VisaCheckout.tsx` antes do pagamento
- [ ] Implementar upload de documento (RG/Passaporte)
- [ ] Implementar upload de selfie segurando documento
- [ ] Validação básica (tamanho, formato)
- [ ] Salvar no Supabase Storage
- [ ] Atualizar `visa_orders` com URLs
- [ ] Bloquear pagamento se contrato não assinado
- [ ] Testar fluxo completo

### ✅ Dashboard Admin - Aprovação Zelle

- [ ] Criar componente `ZelleApprovalList.tsx`
- [ ] Adicionar rota `/dashboard/zelle-approvals` ou aba no dashboard
- [ ] Listar pedidos Zelle pendentes
- [ ] Mostrar comprovante (imagem/PDF)
- [ ] Botão "Aprovar" (atualiza status + envia emails)
- [ ] Botão "Rejeitar" (atualiza status + notifica cliente)
- [ ] Enviar email ao cliente quando aprovado
- [ ] Enviar email ao vendedor quando aprovado
- [ ] Testar aprovação/rejeição

### ✅ Proteções Anti-Chargeback

- [ ] Pesquisar configurações Stripe Radar
- [ ] Habilitar 3D Secure na Edge Function
- [ ] Atualizar termos com avisos sobre chargebacks
- [ ] Configurar regras básicas no Stripe Dashboard
- [ ] Testar com cartão internacional

---

## 🚀 COMEÇAR AGORA

**Recomendação:** Começar pela **Assinatura de Contrato Eletrônico** porque:
1. É obrigatório antes do pagamento
2. Protege contra fraudes
3. Valida identidade do cliente
4. É requisito legal em muitos casos

**Depois:** Dashboard Admin para aprovar Zelle (já tem pedidos pendentes esperando)

---

## 📞 Dúvidas?

Se precisar de ajuda para implementar qualquer uma dessas features, é só pedir! 🚀














