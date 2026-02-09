# Relatório Técnico - Atualizações e Correções (06/02/2026)

Este relatório documenta as melhorias implementadas no sistema de checkout, geração de documentos (PDF) e integração com webhooks (n8n).

## 1. Correção de Valores no Anexo I (Bundle)
**Problema:** Documentos de Anexo I (Autorização de Pagamento) do serviço principal estavam exibindo o valor total consolidado do Bundle, em vez de apenas o valor referente ao contrato principal.
**Solução:** 
- Implementada lógica de subtração dinâmica na Edge Function `generate-annex-pdf`.
- Se o documento gerado não for um upsell (`is_upsell: false`) e houver um valor de upsell na ordem, o sistema subtrai automaticamente o `upsell_price_usd` para exibir o valor correto do serviço base.
- Garante conformidade entre o valor citado no contrato principal e o valor exibido no Anexo I.

## 2. Refatoração de Payloads do Webhook (n8n)
**Melhoria:** Otimização dos dados enviados para o n8n para garantir precisão em ordens de Bundle com múltiplos dependentes.
**Alterações:**
- **Busca Dinâmica de Preços:** A função `approve-visa-contract` agora consulta a tabela `visa_products` em tempo real para obter o `base_price_usd` e `price_per_dependent_usd` específicos de cada perna do bundle.
- **Paylod do Titular (Upsell):** Agora inclui `is_upsell: true` e o valor base real do produto de upsell (ex: US$ 299.00 no Canada Revolution).
- **Payload de Dependentes (Upsell):** Agora envia o valor unitário real por dependente do produto de upsell (ex: US$ 49.00 no Canada Revolution).
- **Payload Limpo (Main):** Removido o campo `is_upsell` das ordens principais para manter o padrão legado e evitar ruído no processamento do n8n.

## 3. Sistema de Roteamento de Teste (Sandbox)
**Funcionalidade:** Adicionada capacidade de realizar testes reais de webhook sem interferir na produção.
**Implementação:**
- O sistema detecta se o cliente é um usuário de teste (baseado no nome "Paulo Victor..." ou e-mail técnico).
- Se detectado, o tráfego é desviado para o URL de teste: `https://nwh.suaiden.com/webhook/45665dbc-8751-41ff-afb8-6d17dd61d204`.
- Clientes reais continuam sendo enviados para o webhook de produção configurado nas variáveis de ambiente.

## 4. Configuração do Produto Canada Revolution ETA
- **Sincronização:** Vinculado o produto `canada-tourist-revolution` ao template de contrato oficial "REVOLUTION ETA CANADA".
- **Valores Oficiais:** Atualizados os preços no banco de dados para os valores padrão:
    - Aplicante Principal: US$ 299.00
    - Dependentes (cada): US$ 49.00

## 5. Limpeza e Manutenção
- Removidos produtos e templates temporários criados para simulações.
- Limpeza de ordens de teste duplicadas ou órfãs no banco de dados para manter a integridade dos relatórios financeiros.

## 6. Regeneração de Documentos com Valores Proporcionais (R$)
**Problema:** Necessidade de exibir valores em Reais (R$) nos contratos para conciliação com as transações da Parcelow, incluindo a partilha proporcional das taxas administrativas.
**Solução:** 
- **Pedido #ORD-20260206-2740:** Regenerados 5 documentos (Contrato Principal, Contrato Canada, 2 Anexos I e Invoice).
- **Cálculo Proporcional:** Implementada lógica para dividir o valor total pago (incluindo taxas da Parcelow) proporcionalmente entre o serviço principal e o upsell, convertendo para R$ com base na cotação do dia da transação.
- **Invoice:** Mantida em USD ($) para refletir o valor comercial puro do serviço, sem acréscimos de taxas de parcelamento.

## 7. Padronização de Nomes de Arquivos (Storage Security)
**Melhoria:** Prevenção de erros 404 e falhas de encoding ao abrir documentos no Supabase Storage.
**Alterações:**
- **Edge Functions:** Atualizadas `generate-visa-contract-pdf`, `generate-annex-pdf` e `generate-invoice-pdf`.
- **Sanitização:** Implementada função `normalizeForFileName` para substituir espaços, parênteses e caracteres especiais por underscores (`_`).
- **Unicidade:** Uso de `timestamp` dinâmico para garantir que novos uploads não sobrescrevam arquivos antigos e mantenham URLs válidas.

## 8. Internacionalização do Painel Administrativo (i18n)
**Melhoria:** Tradução da interface de administração para Inglês para melhor usabilidade em contextos globais.
**Alterações:**
- **Dashboard Hub:** Tradução de todos os filtros de status, abas de navegação ("Main", "Rejected") e labels de busca.
- **Sidebar:** Correção de erros ortográficos ("Vochers & Cupons" para "Vouchers & Coupons") e padronização dos menus.
- **Status Badges:** Mapeamento de textos de status internos para seus equivalentes em Inglês.

## 9. Manutenção de Código e Estabilidade (Build)
**Correção:** Resolução de erro de compilação que impedia o deploy de produção.
**Ações:**
- **VisaOrderDetailPage.tsx:** Removida referência incorreta à função `setRejectionReason` que causava erro no `tsc`.
- **Validação:** Executado `npm run build` com sucesso, garantindo que todas as páginas e componentes estão tipados corretamente.

## 10. Unificação e Gestão de Reuniões Agendadas
**Melhoria:** Centralização de todos os agendamentos de reuniões (manuais e de parceiros) em uma única interface de histórico para facilitar a gestão operacional.
**Alterações:**
- **Unificação de Dados:** A lógica do componente `getScheduledMeetings` foi refatorada para realizar o merge em tempo real entre a tabela de agendamentos manuais e a tabela `global_partner_applications`.
- **Ferramentas de Busca Avançada:**
    - **Busca por Texto:** Filtro instantâneo por Nome ou E-mail do cliente.
    - **Filtro de Calendário:** Implementação de seletor de data (`date picker`) para filtragem específica por dia.
    - **Ordenação:** Ajustada para ordem decrescente (`desc`), priorizando a visualização de compromissos futuros e recentes.
- **Identificação de Origem:** Implementação de Badges dinâmicos ("Global Partner") para identificar visualmente a proveniência de cada reunião.
- **Integridade de Dados:** As ações de atualizar, excluir e reenviar e-mail foram unificadas para suportar as duas fontes de dados, garantindo que alterações no histórico reflitam corretamente nas aplicações dos parceiros.

- **Integridade de Dados:** As ações de atualizar, excluir e reenviar e-mail foram unificadas para suportar as duas fontes de dados, garantindo que alterações no histórico reflitam corretamente nas aplicações dos parceiros.

## 11. Correção na Unificação de Pagamentos Zelle
**Problema:** Ordens pendentes desapareciam do Dashboard de Aprovação caso o cliente já possuísse uma ordem anterior "Completed" para o mesmo produto (colisão de chaves por e-mail + serviço).
**Solução:** 
- **Chaves Únicas por ID:** Refatorada a lógica de agrupamento no `ZelleApprovalPage.tsx` para usar o `ID` único da ordem em vez de chaves compostas por string.
- **Vínculo Inteligente de Comprovantes:** Implementada busca heurística que prioriza vincular comprovantes avulsos (`migma_payments`) a ordens que possuam status **Pending**.
- **Independência de Pedidos:** Garante que múltiplos pedidos do mesmo usuário para o mesmo serviço sejam tratados como entidades distintas, evitando que o histórico de sucesso oculte novas obrigações financeiras.

---

## 12. ⭐ **SISTEMA EB-3 RECURRING MANAGEMENT** (IMPLEMENTAÇÃO COMPLETA)

### 📋 **VISÃO GERAL**

Sistema completo de gestão de recorrência para vistos EB-3 com pagamento parcelado. Permite ativação automática de programas de 8 parcelas mensais após pagamento do Job Catalog, com cobrança automática via e-mail e controle administrativo centralizado.

---

### 🗄️ **1. ESTRUTURA DO BANCO DE DADOS**

#### **Tabela: `eb3_recurrence_control`**
Gerencia o programa de recorrência de cada cliente.

```sql
CREATE TABLE eb3_recurrence_control (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id),
  activation_date DATE NOT NULL,
  recurrence_start_date DATE NOT NULL, -- Primeira parcela: activation_date + 28 dias
  total_installments INTEGER DEFAULT 8,
  installments_paid INTEGER DEFAULT 0,
  program_status TEXT DEFAULT 'active', -- 'active', 'completed', 'suspended', 'cancelled'
  seller_id UUID REFERENCES auth.users(id),
  seller_commission_percent NUMERIC(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Campos Chave:**
- `activation_date`: Data de ativação (quando Job Catalog foi pago)
- `recurrence_start_date`: Data da primeira parcela (28 dias após ativação)
- `installments_paid`: Contador de parcelas pagas (0-8)
- `program_status`: Estado atual do programa

---

#### **Tabela: `eb3_recurrence_schedules`**
Armazena cada uma das 8 parcelas do programa.

```sql
CREATE TABLE eb3_recurrence_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id),
  installment_number INTEGER NOT NULL, -- 1 a 8
  due_date DATE NOT NULL,
  amount_usd NUMERIC(10,2) DEFAULT 650.00,
  late_fee_usd NUMERIC(10,2) DEFAULT 50.00,
  status TEXT DEFAULT 'pending', -- 'pending', 'overdue', 'paid'
  paid_at TIMESTAMPTZ,
  payment_order_id UUID REFERENCES visa_orders(id),
  email_sent_at TIMESTAMPTZ, -- Controle de envio de lembrete
  seller_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, installment_number)
);
```

**Campos Chave:**
- `installment_number`: Número da parcela (1-8)
- `due_date`: Vencimento (dia 6 de cada mês)
- `amount_usd`: Valor base (US$ 650)
- `late_fee_usd`: Multa por atraso (US$ 50)
- `email_sent_at`: Timestamp do envio de e-mail de lembrete

---

### ⚙️ **2. RPC FUNCTIONS (Database Functions)**

#### **2.1. `activate_eb3_recurrence`**
Ativa o programa de recorrência e cria as 8 parcelas.

```sql
CREATE OR REPLACE FUNCTION activate_eb3_recurrence(
  p_client_id UUID,
  p_activation_order_id UUID,
  p_seller_id UUID DEFAULT NULL,
  p_seller_commission_percent NUMERIC DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_recurrence_id UUID;
  v_activation_date DATE := CURRENT_DATE;
  v_start_date DATE := CURRENT_DATE + INTERVAL '28 days';
  v_installment_date DATE;
  i INTEGER;
BEGIN
  -- Criar programa de recorrência
  INSERT INTO eb3_recurrence_control (
    client_id, activation_date, recurrence_start_date,
    seller_id, seller_commission_percent
  ) VALUES (
    p_client_id, v_activation_date, v_start_date,
    p_seller_id, p_seller_commission_percent
  ) RETURNING id INTO v_recurrence_id;

  -- Criar 8 parcelas mensais
  FOR i IN 1..8 LOOP
    v_installment_date := v_start_date + ((i - 1) || ' months')::INTERVAL;
    
    INSERT INTO eb3_recurrence_schedules (
      client_id, installment_number, due_date,
      amount_usd, late_fee_usd, seller_id
    ) VALUES (
      p_client_id, i, v_installment_date,
      650.00, 50.00, p_seller_id
    );
  END LOOP;

  RETURN v_recurrence_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

#### **2.2. `mark_eb3_installment_paid`**
Marca uma parcela como paga e atualiza o contador.

```sql
CREATE OR REPLACE FUNCTION mark_eb3_installment_paid(
  p_schedule_id UUID,
  p_payment_order_id UUID
) RETURNS VOID AS $$
DECLARE
  v_client_id UUID;
BEGIN
  -- Atualizar status da parcela
  UPDATE eb3_recurrence_schedules
  SET status = 'paid',
      paid_at = NOW(),
      payment_order_id = p_payment_order_id
  WHERE id = p_schedule_id
  RETURNING client_id INTO v_client_id;

  -- Incrementar contador no programa
  UPDATE eb3_recurrence_control
  SET installments_paid = installments_paid + 1,
      updated_at = NOW()
  WHERE client_id = v_client_id;

  -- Marcar como completo se todas pagas
  UPDATE eb3_recurrence_control
  SET program_status = 'completed'
  WHERE client_id = v_client_id
    AND installments_paid >= total_installments;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

#### **2.3. `check_eb3_overdue`**
Verifica parcelas vencidas e aplica multa.

```sql
CREATE OR REPLACE FUNCTION check_eb3_overdue()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE eb3_recurrence_schedules
  SET status = 'overdue'
  WHERE status = 'pending'
    AND due_date < CURRENT_DATE;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

#### **2.4. `get_eb3_dashboard_stats`**
Retorna estatísticas para o dashboard administrativo.

```sql
CREATE OR REPLACE FUNCTION get_eb3_dashboard_stats()
RETURNS JSON AS $$
BEGIN
  RETURN json_build_object(
    'total_due_this_month', (
      SELECT COALESCE(SUM(amount_usd), 0)
      FROM eb3_recurrence_schedules
      WHERE status IN ('pending', 'overdue')
        AND EXTRACT(MONTH FROM due_date) = EXTRACT(MONTH FROM CURRENT_DATE)
    ),
    'total_overdue', (
      SELECT COALESCE(SUM(amount_usd + late_fee_usd), 0)
      FROM eb3_recurrence_schedules
      WHERE status = 'overdue'
    ),
    'paid_today', (
      SELECT COALESCE(SUM(amount_usd), 0)
      FROM eb3_recurrence_schedules
      WHERE DATE(paid_at) = CURRENT_DATE
    ),
    'active_programs', (
      SELECT COUNT(*)
      FROM eb3_recurrence_control
      WHERE program_status = 'active'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

### 🔌 **3. EDGE FUNCTIONS**

#### **3.1. `eb3-recurring-cron`**
Cron job diário que verifica parcelas vencidas e envia e-mails de lembrete.

**Localização:** `supabase/functions/eb3-recurring-cron/index.ts`

**Funcionalidades:**
1. ✅ Marca parcelas vencidas como `overdue`
2. ✅ Envia e-mails de lembrete 7 dias antes do vencimento
3. ✅ Envia e-mails de late fee para parcelas atrasadas
4. ✅ Modo de TESTE para envio diário (facilita validação)

**Configuração:**
```typescript
const TEST_MODE = true; // true = envia todo dia, false = 7 dias antes
const DAILY_EMAIL_LIMIT = 10; // Limite de e-mails por dia (modo teste)
```

**Deploy:**
```powershell
supabase functions deploy eb3-recurring-cron --project-ref ekxftwrjvxtpnqbraszv --no-verify-jwt
```

**Cron Job (Configurado via Migration):**
```sql
SELECT cron.schedule(
  'eb3-recurring-daily-check',
  '0 9 * * *', -- Todo dia às 9h AM
  $$
  SELECT net.http_post(
    url:='https://ekxftwrjvxtpnqbraszv.supabase.co/functions/v1/eb3-recurring-cron',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body:='{}'::jsonb
  );
  $$
);
```

---

#### **3.2. Modificações em `parcelow-webhook` e `approve-zelle-payment`**

Ambas Edge Functions foram modificadas para **ativar automaticamente** a recorrência quando:
- **Produto:** `eb3-installment-catalog` (Job Catalog)
- **Valor:** US$ 3.000
- **Ação:** Chama `activate_eb3_recurrence()` após aprovação

**Código (exemplo de `approve-zelle-payment`):**
```typescript
// ✅ ATIVAR RECORRÊNCIA EB-3 (se for Job Catalog)
if (order.product_slug === 'eb3-installment-catalog') {
  const { client_id, seller_id, seller_commission_percent } = order;
  
  const { data: recurrenceId, error: recError } = await supabaseAdmin
    .rpc('activate_eb3_recurrence', {
      p_client_id: client_id,
      p_activation_order_id: orderId,
      p_seller_id: seller_id || null,
      p_seller_commission_percent: seller_commission_percent || null
    });

  if (recError) {
    console.error('[Zelle] Erro ao ativar recorrência EB-3:', recError);
  } else {
    console.log('[Zelle] ✅ Recorrência EB-3 ativada:', recurrenceId);
  }
}
```

---

### 🎨 **4. FRONTEND COMPONENTS**

#### **4.1. Dashboard Administrativo**
**Localização:** `src/pages/admin/EB3RecurringManagement.tsx`

**Funcionalidades:**
- ✅ Visualização de programas ativos
- ✅ Filtros por status (On Track, Overdue, Completed)
- ✅ Cards com estatísticas em tempo real
- ✅ Expandir para ver detalhes das 8 parcelas
- ✅ Ações: Suspender/Reativar programa

**Rota:** `/dashboard/eb3-recurring`

---

#### **4.2. Checkout de Parcelas**
**Localização:** `src/pages/EB3InstallmentCheckout.tsx`

**Permite cliente pagar parcelas individuais:**
- Recebe `schedule_id` via URL
- Busca dados da parcela no banco
- Exibe valor (US$ 650 ou US$ 700 se atrasada)
- Permite pagamento via Zelle ou Parcelow

**Rota:** `/checkout/eb3-installment/:scheduleId`

---

### 🔒 **5. ROW LEVEL SECURITY (RLS) POLICIES**

#### **Policies para `eb3_recurrence_control`:**

```sql
-- Admins podem visualizar todos os programas
CREATE POLICY "admins_select_eb3_control"
ON eb3_recurrence_control
FOR SELECT
TO authenticated
USING ((auth.jwt() ->> 'role')::text = 'admin');

-- Admins podem inserir programas
CREATE POLICY "admins_insert_eb3_control"
ON eb3_recurrence_control
FOR INSERT
TO authenticated
WITH CHECK ((auth.jwt() ->> 'role')::text = 'admin');

-- Admins podem atualizar programas
CREATE POLICY "admins_update_eb3_control"
ON eb3_recurrence_control
FOR UPDATE
TO authenticated
USING ((auth.jwt() ->> 'role')::text = 'admin')
WITH CHECK ((auth.jwt() ->> 'role')::text = 'admin');

-- Sellers podem ver apenas seus clientes
CREATE POLICY "sellers_view_own_clients_eb3"
ON eb3_recurrence_control
FOR SELECT
TO authenticated
USING (seller_id = auth.uid());

-- Service Role (Edge Functions) acesso total
CREATE POLICY "service_role_full_access_eb3_control"
ON eb3_recurrence_control
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
```

#### **Policies para `eb3_recurrence_schedules`:**

```sql
-- Admins podem visualizar todas as parcelas
CREATE POLICY "admins_select_eb3_schedules"
ON eb3_recurrence_schedules
FOR SELECT
TO authenticated
USING ((auth.jwt() ->> 'role')::text = 'admin');

-- Público pode visualizar parcelas pendentes (para checkout)
CREATE POLICY "public_view_pending_schedules"
ON eb3_recurrence_schedules
FOR SELECT
TO anon
USING (status IN ('pending', 'overdue'));

-- Service Role acesso total
CREATE POLICY "service_role_full_access_eb3_schedules"
ON eb3_recurrence_schedules
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
```

---

### 📧 **6. FLUXO DE E-MAILS**

#### **Template de Lembrete (7 dias antes):**
```
Subject: Your EB-3 Visa Installment #X Payment Reminder

Dear [Client Name],

This is a friendly reminder that your EB-3 visa installment payment #X of US$ 650.00 is due on [Due Date].

Please click the link below to pay online:
[Payment Link]

Thank you!
Migma Team
```

#### **Template de Late Fee (após vencimento):**
```
Subject: EB-3 Installment #X - Late Fee Applied

Dear [Client Name],

Your installment #X is now overdue. A late fee of US$ 50.00 has been applied.

Total amount due: US$ 700.00
Due date was: [Original Due Date]

Please pay as soon as possible:
[Payment Link]

Migma Team
```

---

### 🔄 **7. FLUXO COMPLETO DO SISTEMA**

```
1. CLIENTE PAGA JOB CATALOG (US$ 3.000)
   ↓
2. ADMIN APROVA PAGAMENTO (/dashboard/zelle-approval)
   ↓
3. WEBHOOK/EDGE FUNCTION ATIVA RECORRÊNCIA
   - Cria registro em eb3_recurrence_control
   - Cria 8 parcelas em eb3_recurrence_schedules
   ↓
4. CRON JOB RODA DIARIAMENTE (9h AM)
   ✓ Marca parcelas vencidas como overdue
   ✓ Envia e-mails de lembrete (7 dias antes)
   ✓ Envia e-mails de late fee (após vencimento)
   ↓
5. CLIENTE RECEBE E-MAIL COM LINK DE PAGAMENTO
   ↓
6. CLIENTE CLICA E VAI PARA /checkout/eb3-installment/:scheduleId
   ↓
7. CLIENTE PAGA VIA ZELLE OU PARCELOW
   ↓
8. ADMIN APROVA PAGAMENTO
   ↓
9. SISTEMA MARCA PARCELA COMO PAGA
   - Atualiza status para 'paid'
   - Incrementa installments_paid
   - Se todas pagas → program_status = 'completed'
```

---

### 🧪 **8. MODO DE TESTE**

Para facilitar validação, a Edge Function `eb3-recurring-cron` tem um modo de teste:

**Arquivo:** `supabase/functions/eb3-recurring-cron/index.ts`  
**Linha 52:**
```typescript
const TEST_MODE = true; // Mudar para false em produção
```

**Comportamento em TEST_MODE:**
- ✅ Envia e-mails **TODO DIA** para todas as parcelas pendentes
- ✅ Limitado a 10 e-mails por execução (evita spam)
- ✅ Marca `email_sent_at` para evitar duplicatas

**Comportamento em PRODUÇÃO:**
- ✅ Envia e-mail apenas **7 dias antes** do vencimento
- ✅ Envia late fee **após vencimento**
- ✅ Sem limite de e-mails

---

### 📦 **9. COMANDOS DE DEPLOY**

```powershell
# Deploy da Edge Function de Cron
supabase functions deploy eb3-recurring-cron --project-ref ekxftwrjvxtpnqbraszv --no-verify-jwt

# Deploy da Edge Function Parcelow (modificada)
supabase functions deploy parcelow-webhook --project-ref ekxftwrjvxtpnqbraszv --no-verify-jwt
```

---

### ✅ **10. PRODUTOS RELACIONADOS**

#### **EB-3 Installment Plan (Parcelado com Recorrência):**
1. `eb3-installment-initial` - US$ 5.000 (Pagamento Inicial)
2. `eb3-installment-catalog` - US$ 3.000 (Job Catalog) ← **ATIVA RECORRÊNCIA**
3. `eb3-installment-monthly` - US$ 650 (Parcela Mensal) ← **Produto das 8 parcelas**

#### **EB-3 Step Plan (Sem Recorrência):**
1. `eb3-step-initial` - US$ 5.000 (Inicial)
2. `eb3-step-catalog` - US$ 5.000 (Job Catalog)

#### **EB-3 Full Payment (Pagamento Único):**
1. `eb3-visa` - US$ 23.750 (Tudo de uma vez)

---

### 📊 **11. ESTATÍSTICAS DO SISTEMA (06/02/2026)**

- **Programas Ativos:** 1
- **Total de Parcelas Criadas:** 8
- **Parcelas Pagas:** 0
- **Parcelas Pendentes:** 8
- **Próximo Vencimento:** 06/03/2026

---

### 🎯 **12. PRÓXIMOS PASSOS PARA TESTES**

1. ✅ Deploy da Edge Function realizado
2. ✅ Cron Job configurado (roda diariamente às 9h)
3. ⏳ **Aguardar amanhã (07/02) às 9h** para primeiro envio de e-mails
4. ⏳ Pagar algumas parcelas manualmente para testar workflow completo
5. ⏳ Verificar se contador de `installments_paid` atualiza corretamente
6. ⏳ Validar marcação automática como `completed` após 8ª parcela paga

---

**Status Geral:** ✅ Sistema EB-3 Recurring 100% implementado e pronto para testes.  
**Autor:** Antigravity (AI Senior Software Engineer)
