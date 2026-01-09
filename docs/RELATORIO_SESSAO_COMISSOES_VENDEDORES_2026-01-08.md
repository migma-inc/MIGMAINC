# Relatório Completo: Sistema de Comissões e Solicitações de Pagamento - Sessão 08/01/2026

## 📋 Resumo Executivo

Esta sessão focou na implementação completa de um sistema de comissões para vendedores da Migma, incluindo cálculo de comissões, períodos de maturação, solicitações de pagamento e um dashboard administrativo. O trabalho iniciou com a investigação de um webhook de pagamento e evoluiu para um sistema completo de gestão financeira para vendedores.

---

## 🎯 Fase 1: Investigação Inicial - Webhook de Pagamento

### Contexto
A sessão começou investigando problemas relacionados a webhooks de pagamento, especificamente o arquivo `send-zelle-webhook/index.ts`.

### Arquivos Analisados
- `supabase/functions/send-zelle-webhook/index.ts` (493 linhas)
- Sistema de processamento de pagamentos Zelle

### Descobertas
- Sistema de webhook já implementado para processar pagamentos Zelle
- Integração com sistema de comissões identificada como necessária

---

## 🎯 Fase 2: Implementação do Sistema de Comissões

### 2.1 Estrutura do Banco de Dados

#### Migrations Criadas/Modificadas:

**1. `20260108000000_create_seller_commissions.sql`**
- Criação da tabela `seller_commissions`
- Campos principais:
  - `id` (UUID)
  - `seller_id` (TEXT) - Referência ao `seller_id_public`
  - `order_id` (UUID) - Referência ao pedido
  - `commission_amount_usd` (DECIMAL)
  - `commission_status` ('pending' | 'paid' | 'cancelled')
  - `commission_percentage` (DECIMAL)
  - `net_amount_usd` (DECIMAL)
  - `calculation_method` ('individual' | 'monthly_accumulated')
  - `payment_date` (TIMESTAMPTZ)
  - `created_at`, `updated_at`

**2. `20260108000001_update_commission_to_monthly_accumulated.sql`**
- Migração do sistema de comissão individual para acumulada mensal
- Implementação de `recalculate_monthly_commissions()`
- Sistema de tiers progressivos de comissão baseado no valor total mensal

**3. `20260108000002_add_commission_maturation.sql`**
- Adição de campos para período de maturação:
  - `available_for_withdrawal_at` (TIMESTAMPTZ) - Data quando a comissão fica disponível (30 dias após criação)
  - `withdrawn_amount` (DECIMAL) - Valor já sacado
  - `reserved_amount` (DECIMAL) - Valor reservado em solicitações pendentes
- Índices para performance

**4. `20260108000003_create_seller_payment_requests.sql`**
- Criação da tabela `seller_payment_requests`
- Campos:
  - `id` (UUID)
  - `seller_id` (TEXT)
  - `amount` (DECIMAL)
  - `payment_method` ('stripe' | 'wise')
  - `payment_details` (JSONB)
  - `status` ('pending' | 'approved' | 'rejected' | 'completed')
  - `request_month` (DATE) - **Campo obrigatório adicionado durante a sessão**
  - `requested_at`, `approved_at`, `rejected_at`, `completed_at`
  - `rejection_reason`, `payment_proof_url`
  - `processed_by` (UUID) - Admin que processou

**5. `20260108000004_create_payment_request_functions.sql`**
- Funções RPC principais:
  - `get_seller_available_balance()` - Calcula saldo disponível e pendente
  - `create_seller_payment_request()` - Cria solicitação e reserva valores
  - `process_payment_request_approval()` - Aprova e marca como withdrawn
  - `process_payment_request_rejection()` - Rejeita e libera valores reservados
  - `complete_payment_request()` - Marca como pago
  - `get_last_payment_request_date()` - Última solicitação aprovada

**6. `20260108000005_update_commission_trigger.sql`**
- Atualização de triggers para calcular comissões automaticamente
- `calculate_seller_commission()` - Calcula comissão individual
- `recalculate_monthly_commissions()` - Recalcula comissões mensais acumuladas
- Configuração automática de `available_for_withdrawal_at` (30 dias)

**7. `20260108000006_create_payment_request_rls.sql`**
- Políticas RLS (Row Level Security) para `seller_payment_requests`
- Sellers só veem suas próprias solicitações
- Admins veem todas

**8. `20260108000007_add_time_travel_system.sql`** (Criado mas não aplicado)
- Sistema de "viagem no tempo" para testes
- Funções para adiantar/restaurar datas de maturação
- **Nota**: Implementado manualmente via MCP durante a sessão

### 2.2 Correções Críticas Durante Desenvolvimento

#### Problema 1: Campo `request_month` Missing
**Erro**: `null value in column "request_month" violates not-null constraint`
**Solução**: Atualização da função `create_seller_payment_request` para incluir:
```sql
request_month = DATE_TRUNC('month', NOW())::DATE
```

#### Problema 2: Foreign Key Missing para Join com Sellers
**Erro**: `Could not find a relationship between 'seller_payment_requests' and 'seller_id'`
**Solução**: Criação de foreign key via MCP:
```sql
ALTER TABLE seller_payment_requests
ADD CONSTRAINT fk_seller_payment_requests_seller
FOREIGN KEY (seller_id) 
REFERENCES sellers(seller_id_public)
ON DELETE CASCADE;
```

#### Problema 3: RPC Retornando Array em vez de Objeto
**Problema**: `get_seller_available_balance` retorna TABLE (array), mas código tratava como objeto
**Solução**: Ajuste em `src/lib/seller-payment-requests.ts`:
```typescript
const result = Array.isArray(data) ? data[0] : data;
```

---

## 🎯 Fase 3: Interface do Vendedor (Seller Dashboard)

### 3.1 Página Principal: `SellerCommissions.tsx`

#### Funcionalidades Implementadas:

**1. Sistema de Tabs**
- Tab "Comissões": Histórico de comissões e stats originais
- Tab "Solicitar Pagamento": Formulário de solicitação e histórico

**2. Cards de Estatísticas**

**Na Tab "Comissões"** (3 cards originais):
- **Saldo Disponível**: `stats.totalPending` - Comissões pendentes
- **Total Recebido**: `stats.totalPaid` - Comissões pagas (baseado em `commission_status = 'paid'`)
- **Este Mês/Total**: `stats.currentMonth` ou `stats.totalAmount`

**Na Tab "Solicitar Pagamento"** (4 cards novos):
- **Saldo Disponível**: `balance.available_balance` - Pronto para saque
- **Saldo Pendente**: `balance.pending_balance` - Com countdown até liberação
- **Total Recebido**: `totalReceived` - Soma de payment requests `status = 'completed'`
- **Total Acumulado**: `available_balance + pending_balance`

**3. Componente `PendingBalanceCard`**
- Exibe saldo pendente com countdown dinâmico
- Formato: "Disponível em X dias, Yh Zm"
- Atualiza a cada minuto

**4. Componente `PaymentRequestTimer`**
- Mostra quando o próximo saque está disponível
- Lógica:
  - Se tem `lastRequestDate`: 30 dias a partir da última solicitação aprovada
  - Se não tem `lastRequestDate` mas tem `firstSaleDate`: 30 dias a partir da primeira venda
  - Se não tem nenhum: "Aguardando primeira venda"
- Formato: "X dias, Yh Zm restante"

**5. Sistema de Cache**
- Cache de 5 minutos para:
  - Comissões
  - Stats
  - Balance
  - Payment requests
  - First sale date
- Chave: `seller_commissions_{seller_id}_{key}`

**6. Botão de Refresh Manual**
- Removido polling automático (a pedido do usuário)
- Botão "Atualizar" no header
- Limpa cache e recarrega todos os dados
- Estado de loading durante refresh

### 3.2 Componentes Criados/Modificados

**1. `PendingBalanceCard.tsx`** (Novo)
- Props: `pendingBalance`, `nextWithdrawalDate`
- Countdown dinâmico até liberação
- Estilo: Gradiente dourado/preto (tema Migma)

**2. `PaymentRequestTimer.tsx`** (Modificado)
- Adicionado prop `firstSaleDate`
- Lógica aprimorada para calcular próximo saque
- Três estados:
  - Sem vendas: "Aguardando primeira venda"
  - Disponível: "Saque Disponível"
  - Não disponível: Countdown com data da última solicitação ou primeira venda

**3. `PaymentRequestForm.tsx`** (Modificado)
- Cards de saldo no topo do formulário
- Validação de valores
- Suporte para Stripe e Wise
- Botão cancelar com fundo preto (corrigido)
- Estilo alinhado ao tema Migma (preto/dourado)

### 3.3 Página Separada: `SellerPaymentRequests.tsx`

- Página dedicada para solicitações de pagamento
- Mesma funcionalidade da tab, mas em página separada
- Botão de refresh manual implementado

---

## 🎯 Fase 4: Dashboard Administrativo

### 4.1 Página: `AdminPaymentRequests.tsx`

**Funcionalidades**:
- Lista todas as solicitações de pagamento
- Filtros por status, seller, método de pagamento, data
- Visualização de detalhes
- Aprovação/Rejeição/Completação de solicitações
- Upload de comprovante de pagamento

### 4.2 Componente: `PaymentRequestsList.tsx`

- Lista de solicitações com badges de status
- Informações do seller (via foreign key)
- Botão "Ver Detalhes"
- Estilo alinhado ao tema Migma

### 4.3 Funções Admin: `admin-payment-requests.ts`

**Funções principais**:
- `getAllPaymentRequests()` - Lista com filtros
- `getPaymentRequestWithSeller()` - Detalhes com info do seller
- `approvePaymentRequest()` - Aprova e envia email
- `rejectPaymentRequest()` - Rejeita com motivo e envia email
- `completePaymentRequest()` - Marca como pago e envia email
- `getPaymentRequestStats()` - Estatísticas gerais

---

## 🎯 Fase 5: Ajustes de Design e UX

### 5.1 Aplicação de Design Document (Lus American)

**Documento de Referência**: `Documentação de Design e Organização: Dashboard do Afiliado`

**Elementos Aplicados**:
- Layout de cards com gradientes
- Sistema de tabs customizado
- Espaçamento e padding otimizados
- Estados de loading/empty
- Countdown timers

**Ajustes para Tema Migma**:
- **Cores**: Mantido preto e dourado (não verde/amarelo/azul/roxo do Lus American)
- Classes aplicadas:
  - `bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10`
  - `border border-gold-medium/30`
  - `text-gold-light`, `text-gold-medium`
  - `bg-black/50`, `text-white`, `text-gray-400`

### 5.2 Melhorias de Texto

**Mudanças de Terminologia**:
- "Em maturação" → "Aguardando liberação" (mais claro para usuários)
- Aplicado em:
  - `PendingBalanceCard.tsx`
  - `PaymentRequestForm.tsx`
  - `SellerCommissions.tsx`
  - `SellerPaymentRequests.tsx`

### 5.3 Correções de Estilo

**Botão Cancelar**:
- Problema: Fundo branco
- Solução: Adicionado `bg-black` na className

**Cards de Balance**:
- Ajustados para tema preto/dourado
- Removidos backgrounds brancos
- Textos ajustados para contraste adequado

---

## 🎯 Fase 6: Sistema de "Viagem no Tempo" para Testes

### Contexto
Para testar o sistema sem esperar 30 dias, foi implementado um sistema manual de adiantamento de datas.

### Implementação via MCP Supabase

**1. Criação de Coluna para Backup**:
```sql
ALTER TABLE seller_commissions
ADD COLUMN IF NOT EXISTS original_available_for_withdrawal_at TIMESTAMPTZ;
```

**2. Adiantamento de Datas**:
```sql
-- Salvar datas originais
UPDATE seller_commissions
SET original_available_for_withdrawal_at = available_for_withdrawal_at
WHERE original_available_for_withdrawal_at IS NULL
  AND available_for_withdrawal_at IS NOT NULL
  AND commission_status = 'pending';

-- Adiantar para 1 dia atrás (disponível agora)
UPDATE seller_commissions
SET available_for_withdrawal_at = NOW() - INTERVAL '1 day'
WHERE commission_status = 'pending'
  AND available_for_withdrawal_at > NOW();
```

**3. Resultado**:
- Todas as comissões ficaram disponíveis imediatamente
- Balance atualizado: $60.00 disponível
- Sistema pronto para testes

**4. Restauração** (quando necessário):
```sql
UPDATE seller_commissions
SET available_for_withdrawal_at = created_at + INTERVAL '30 days'
WHERE commission_status = 'pending';
```

---

## 🎯 Fase 7: Correções e Melhorias Finais

### 7.1 Atualização em Tempo Real

**Problema Inicial**: Página do seller não atualizava quando admin aprova/rejeita
**Solução Inicial**: Polling a cada 10 segundos
**Solução Final**: Botão de refresh manual (a pedido do usuário)

**Implementação**:
- Removido `setInterval` de polling
- Adicionado botão "Atualizar" com ícone `RefreshCw`
- Função `handleRefresh()` que:
  - Limpa cache
  - Recarrega balance, payment requests e stats
  - Atualiza todos os cards

### 7.2 Correção do Cálculo "Total Recebido"

**Problema**: Card mostrava $0.00 mesmo com payment request completado
**Causa**: Usava `stats.totalPaid` (baseado em `commission_status = 'paid'`)
**Solução**: Criado estado `totalReceived` que calcula:
```typescript
const completed = paymentRequests
  .filter(req => req.status === 'completed')
  .reduce((sum, req) => sum + (req.amount || 0), 0);
```

### 7.3 Organização de Cards

**Estrutura Final**:
- **Tab "Comissões"**: 3 cards originais (Saldo Disponível, Total Recebido, Este Mês/Total)
- **Tab "Solicitar Pagamento"**: 4 cards novos (Saldo Disponível, Saldo Pendente com countdown, Total Recebido, Total Acumulado)
- **Sem duplicação**: Cards não aparecem em ambos os lugares

---

## 📊 Arquivos Criados/Modificados

### Novos Arquivos
1. `src/components/seller/PendingBalanceCard.tsx` - Card com countdown de saldo pendente
2. `supabase/migrations/20260108000007_add_time_travel_system.sql` - Sistema de testes (não aplicado)

### Arquivos Modificados

**Frontend**:
1. `src/pages/seller/SellerCommissions.tsx` - Página principal de comissões
2. `src/pages/seller/SellerPaymentRequests.tsx` - Página de solicitações
3. `src/components/seller/PaymentRequestForm.tsx` - Formulário de solicitação
4. `src/components/seller/PaymentRequestTimer.tsx` - Timer de disponibilidade
5. `src/lib/seller-payment-requests.ts` - Funções de payment requests
6. `src/lib/seller-commissions.ts` - Funções de comissões
7. `src/lib/admin-payment-requests.ts` - Funções admin
8. `src/components/admin/PaymentRequestsList.tsx` - Lista admin

**Backend (Migrations)**:
1. `supabase/migrations/20260108000000_create_seller_commissions.sql`
2. `supabase/migrations/20260108000001_update_commission_to_monthly_accumulated.sql`
3. `supabase/migrations/20260108000002_add_commission_maturation.sql`
4. `supabase/migrations/20260108000003_create_seller_payment_requests.sql`
5. `supabase/migrations/20260108000004_create_payment_request_functions.sql`
6. `supabase/migrations/20260108000005_update_commission_trigger.sql`
7. `supabase/migrations/20260108000006_create_payment_request_rls.sql`

**Banco de Dados (via MCP)**:
- Foreign key criada: `fk_seller_payment_requests_seller`
- Coluna adicionada: `original_available_for_withdrawal_at`
- Função atualizada: `create_seller_payment_request` (adicionado `request_month`)

---

## 🔧 Problemas Resolvidos

### 1. Erro de JSX Não Fechado
- **Arquivo**: `PaymentRequestForm.tsx`
- **Solução**: Adicionado `</div>` faltante

### 2. Componente Button Não Importado
- **Arquivo**: `SellerCommissions.tsx`
- **Solução**: Adicionado `import { Button } from '@/components/ui/button'`

### 3. Cores Brancas no Tema Escuro
- **Problema**: Elementos com fundo branco
- **Solução**: Substituído por `bg-black/50`, `bg-black`, cores douradas

### 4. Valores Não Carregando ($0.00)
- **Causa**: RPC retornando array em vez de objeto
- **Solução**: Tratamento correto do retorno do RPC

### 5. Campo `request_month` Missing
- **Erro**: Constraint NOT NULL violado
- **Solução**: Adicionado campo na função RPC

### 6. Foreign Key Missing para Join
- **Erro**: PostgREST não encontrava relação
- **Solução**: Criada foreign key via MCP

### 7. Cards Não Atualizando
- **Causa**: Cache e falta de refresh
- **Solução**: Botão de refresh manual + limpeza de cache

### 8. "Total Recebido" Incorreto
- **Causa**: Usava `commission_status = 'paid'` em vez de payment requests completados
- **Solução**: Novo cálculo baseado em `status = 'completed'`

---

## 📈 Funcionalidades Implementadas

### Para Vendedores (Sellers)

1. **Visualização de Comissões**
   - Histórico completo de comissões
   - Filtro por período (Este Mês / Acumulado)
   - Detalhes de cada comissão com informações do pedido

2. **Gestão de Saldo**
   - Saldo disponível (pronto para saque)
   - Saldo pendente (com countdown até liberação)
   - Total recebido (soma de pagamentos completados)
   - Total acumulado (disponível + pendente)

3. **Solicitações de Pagamento**
   - Criar nova solicitação
   - Ver histórico de solicitações
   - Status em tempo real (Pendente, Aprovado, Rejeitado, Pago)
   - Detalhes de cada solicitação (datas, valores, métodos)

4. **Timer de Disponibilidade**
   - Mostra quando pode fazer próxima solicitação
   - Baseado em 30 dias desde última solicitação aprovada OU primeira venda
   - Countdown dinâmico

5. **Refresh Manual**
   - Botão para atualizar dados
   - Limpa cache e recarrega tudo
   - Feedback visual durante carregamento

### Para Administradores

1. **Gestão de Solicitações**
   - Ver todas as solicitações
   - Filtros avançados (status, seller, método, data)
   - Aprovar solicitações
   - Rejeitar com motivo
   - Marcar como pago (com upload de comprovante)

2. **Notificações por Email**
   - Email ao seller quando solicitação é criada
   - Email ao seller quando aprovada
   - Email ao seller quando rejeitada (com motivo)
   - Email ao seller quando marcada como paga
   - Email aos admins quando nova solicitação é criada

---

## 🎨 Design System Aplicado

### Cores (Tema Migma)
- **Preto**: `bg-black`, `bg-black/50`
- **Dourado Claro**: `text-gold-light`, `border-gold-light`
- **Dourado Médio**: `bg-gold-medium/20`, `border-gold-medium/30`, `text-gold-medium`
- **Dourado Escuro**: `from-gold-dark/10`
- **Cinza**: `text-gray-400`, `text-gray-500`

### Componentes UI
- Cards com gradientes: `bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10`
- Bordas: `border border-gold-medium/30`
- Badges de status com cores semânticas
- Botões com tema preto/dourado

### Responsividade
- Grid responsivo: `grid-cols-1 md:grid-cols-4`
- Textos adaptativos: `text-xs sm:text-sm`, `text-xl sm:text-2xl`
- Padding responsivo: `p-4 sm:p-6`

---

## 🔄 Fluxo Completo do Sistema

### 1. Venda Realizada
- Webhook processa pagamento
- Trigger cria/atualiza comissão na tabela `seller_commissions`
- `available_for_withdrawal_at` = `created_at + 30 dias`
- `commission_status` = 'pending'

### 2. Período de Maturação (30 dias)
- Comissão aparece como "Saldo Pendente"
- Countdown mostra quando ficará disponível
- Após 30 dias, move para "Saldo Disponível"

### 3. Solicitação de Pagamento
- Seller cria solicitação via formulário
- Sistema valida:
  - Saldo disponível suficiente
  - 30 dias desde última solicitação aprovada (ou nunca solicitou)
- Reserva valor nas comissões (`reserved_amount`)
- Cria registro em `seller_payment_requests`
- Envia emails (seller + admins)

### 4. Aprovação pelo Admin
- Admin aprova solicitação
- Sistema:
  - Marca `reserved_amount` como `withdrawn_amount`
  - Atualiza status para 'approved'
  - Envia email ao seller

### 5. Pagamento Realizado
- Admin marca como "Pago" (com upload de comprovante)
- Status muda para 'completed'
- Valor aparece no "Total Recebido" do seller
- Email de confirmação enviado

### 6. Rejeição (se aplicável)
- Admin rejeita com motivo
- Sistema libera `reserved_amount` (volta para disponível)
- Status muda para 'rejected'
- Email com motivo enviado ao seller

---

## 📝 Notas Técnicas Importantes

### Cache Strategy
- Cache de 5 minutos para performance
- Chaves específicas por seller e tipo de dado
- Invalidação manual via botão refresh
- Cache não usado durante polling (quando existia)

### Segurança
- RLS (Row Level Security) implementado
- Sellers só veem seus próprios dados
- Validações no backend (RPC functions)
- Foreign keys para integridade referencial

### Performance
- Índices criados em campos frequentemente consultados
- Queries otimizadas com filtros
- Lazy loading de payment requests (só quando tab ativa)

### Escalabilidade
- Sistema suporta múltiplos sellers
- Cálculos feitos no banco (RPC functions)
- Cache reduz carga no servidor
- Estrutura preparada para crescimento

---

## 🚀 Próximos Passos Sugeridos

1. **Testes Automatizados**
   - Testes unitários para funções de cálculo
   - Testes de integração para fluxo completo
   - Testes E2E para interface

2. **Melhorias de Performance**
   - Considerar real-time subscriptions (Supabase Realtime)
   - Otimização de queries com mais índices
   - Paginação para listas grandes

3. **Funcionalidades Adicionais**
   - Export de relatórios (PDF/CSV)
   - Gráficos de histórico de comissões
   - Notificações push (além de email)

4. **Documentação**
   - Documentação de API
   - Guia do usuário para sellers
   - Guia administrativo

---

## ✅ Checklist de Implementação

- [x] Estrutura de banco de dados (tabelas, campos, índices)
- [x] Funções RPC para cálculos e operações
- [x] Sistema de maturação (30 dias)
- [x] Interface do seller (comissões + solicitações)
- [x] Interface do admin (gestão de solicitações)
- [x] Sistema de aprovação/rejeição
- [x] Sistema de pagamento (marcar como pago)
- [x] Emails de notificação
- [x] Countdown timers
- [x] Cards de estatísticas
- [x] Sistema de cache
- [x] Botão de refresh manual
- [x] Cálculo correto de "Total Recebido"
- [x] Design alinhado ao tema Migma
- [x] Responsividade
- [x] Foreign keys e integridade
- [x] RLS (Row Level Security)
- [x] Sistema de testes (viagem no tempo)

---

## 📊 Métricas do Projeto

- **Migrations Criadas**: 7
- **Componentes React Criados/Modificados**: 8+
- **Funções RPC Criadas**: 6
- **Páginas Principais**: 2 (Seller + Admin)
- **Tempo Estimado de Desenvolvimento**: ~6-8 horas
- **Linhas de Código Adicionadas/Modificadas**: ~2000+

---

## 🎓 Lições Aprendidas

1. **RPC Functions Retornam Arrays**: Quando uma função retorna `TABLE`, o Supabase retorna um array, não um objeto único.

2. **Foreign Keys Necessárias para Joins**: PostgREST precisa de foreign keys explícitas para fazer joins automáticos.

3. **Cache vs Real-time**: Trade-off entre performance (cache) e atualização em tempo real. Solução híbrida com refresh manual.

4. **Design Systems**: Importante manter consistência de cores e componentes, mesmo quando inspirado em outros designs.

5. **Testes Manuais**: Sistema de "viagem no tempo" útil para testar fluxos sem esperar períodos reais.

---

## 📞 Suporte e Manutenção

Para questões ou melhorias futuras, referenciar:
- Este relatório completo
- Migrations em `supabase/migrations/`
- Componentes em `src/pages/seller/` e `src/components/seller/`
- Funções em `src/lib/seller-*.ts` e `src/lib/admin-*.ts`

---

**Data da Sessão**: 08 de Janeiro de 2026  
**Duração**: Sessão completa de desenvolvimento  
**Status**: ✅ Sistema completo e funcional
