# Tasks Trello - Sessão 09 de Janeiro de 2026

## 📋 Resumo das Tasks Implementadas

Este documento contém todas as tasks implementadas na sessão de 09/01/2026 que precisam ser adicionadas ao Trello.

---

## ✅ TASK 1: Remover Período de Maturação de 30 Dias das Comissões

**Prioridade:** Alta  
**Status:** ✅ Concluído  
**Categoria:** Backend / Banco de Dados

### Descrição
Alterar a lógica de disponibilidade de comissões para que fiquem disponíveis no primeiro dia do mês seguinte, removendo o período de espera de 30 dias.

### Detalhes Técnicos
- **Migration:** `supabase/migrations/20260110000002_remove_30_day_maturation.sql`
- **Funções Modificadas:**
  - `recalculate_monthly_commissions()` - Agora define `available_for_withdrawal_at` como primeiro dia do mês seguinte
  - `calculate_seller_commission()` - Atualizada para usar mesma lógica
- **Impacto:** Todas as comissões existentes foram atualizadas automaticamente

### Checklist
- [x] Criar migration SQL
- [x] Atualizar função `recalculate_monthly_commissions`
- [x] Atualizar função `calculate_seller_commission`
- [x] Script para atualizar comissões existentes
- [x] Aplicar migration no banco
- [x] Validar que comissões estão sendo criadas com data correta

### Arquivos Modificados
- `supabase/migrations/20260110000002_remove_30_day_maturation.sql` (NOVO)

---

## ✅ TASK 2: Ajustar Cronômetro de Saldo Pendente para Considerar Janela de Solicitação

**Prioridade:** Alta  
**Status:** ✅ Concluído  
**Categoria:** Frontend / UX

### Descrição
Ajustar o componente `PendingBalanceCard` para mostrar corretamente quando o seller poderá solicitar pagamento, considerando apenas a janela de solicitação (dias 1-5 de cada mês) e não mais os 30 dias de maturação.

### Detalhes Técnicos
- **Arquivo:** `src/components/seller/PendingBalanceCard.tsx`
- **Mudança Principal:** Simplificação da lógica para considerar apenas a janela de solicitação
- **Comportamento:** 
  - Se está na janela (dias 1-5) e tem saldo pendente: mostra "Available in current window"
  - Caso contrário: mostra countdown até o dia 1 do próximo mês

### Checklist
- [x] Simplificar lógica do cronômetro
- [x] Remover dependência de `nextWithdrawalDate` (30 dias)
- [x] Considerar apenas `nextRequestWindowStart` (dia 1 do mês)
- [x] Ajustar mensagens exibidas
- [x] Testar em diferentes cenários (dentro/fora da janela)

### Arquivos Modificados
- `src/components/seller/PendingBalanceCard.tsx`

---

## ✅ TASK 3: Desabilitar Temporariamente Funcionalidades de Payment Requests

**Prioridade:** Média  
**Status:** ✅ Concluído  
**Categoria:** Frontend / Feature Toggle

### Descrição
Comentar temporariamente todas as funcionalidades relacionadas a payment requests (solicitação de pagamento) tanto no lado do vendedor quanto do admin, mantendo o código para facilitar reativação futura.

### Detalhes Técnicos

#### Frontend - Vendedor
- Botão "Request Payment" comentado
- Aba "Request Payment" comentada
- Formulário de solicitação comentado
- Histórico de solicitações comentado
- Modal de sucesso comentado

#### Frontend - Admin
- Rota `/dashboard/payment-requests` comentada
- Item de menu "Payment Requests" comentado
- Exibição de payment requests pendentes comentada

#### Hooks e Utilitários
- Cálculo de `totalReceived` desabilitado
- Carregamento de payment requests desabilitado

### Checklist
- [x] Comentar imports de payment requests
- [x] Comentar botão "Request Payment"
- [x] Comentar aba de payment requests
- [x] Comentar rota no admin
- [x] Comentar link no sidebar do admin
- [x] Comentar carregamento de payment requests
- [x] Criar funções temporárias para evitar erros de compilação
- [x] Adicionar comentários `// PAYMENT REQUEST - COMENTADO TEMPORARIAMENTE` em todas as seções

### Arquivos Modificados
- `src/pages/seller/SellerCommissions.tsx`
- `src/App.tsx`
- `src/components/admin/Sidebar.tsx`
- `src/pages/SellersPage.tsx`
- `src/hooks/useSellerStats.ts`
- `src/pages/seller/SellerAnalytics.tsx`

### Notas
- Todo código foi comentado, não removido
- Funções temporárias criadas para evitar erros de compilação
- Fácil reativação: descomentar seções marcadas com `// PAYMENT REQUEST - COMENTADO TEMPORARIAMENTE`

---

## ✅ TASK 4: Corrigir Erros de Build (Variáveis Não Utilizadas)

**Prioridade:** Alta  
**Status:** ✅ Concluído  
**Categoria:** Code Quality / Build

### Descrição
Corrigir todos os erros de TypeScript relacionados a variáveis, imports e funções não utilizadas que estavam impedindo o build do projeto.

### Erros Corrigidos

1. **`src/components/admin/Sidebar.tsx`**
   - Removido import `Wallet` não utilizado

2. **`src/components/seller/PendingBalanceCard.tsx`**
   - Adicionado prefixo `_` em `nextWithdrawalDate` e `nextRequestWindowEnd`
   - Removida variável `currentDay` não utilizada

3. **`src/hooks/useSellerStats.ts`**
   - Comentado import `getSellerPaymentRequests` não utilizado

4. **`src/pages/seller/SellerAnalytics.tsx`**
   - Removidas variáveis `commissionStats` e `totalReceived` do destructuring

5. **`src/pages/seller/SellerCommissions.tsx`**
   - Removido import `XCircle` não utilizado
   - Comentado import `createPaymentRequest`
   - Renomeado `setSubmitting` para `_setSubmitting`
   - Adicionados setters com prefixo `_` para variáveis não utilizadas

6. **`src/components/ui/signature-pad.tsx`**
   - Renomeado parâmetro `width` para `_width`

### Checklist
- [x] Identificar todos os erros de build
- [x] Remover imports não utilizados
- [x] Adicionar prefixo `_` em variáveis não utilizadas
- [x] Comentar código não utilizado
- [x] Validar build sem erros (`npm run build`)

### Arquivos Modificados
- `src/components/admin/Sidebar.tsx`
- `src/components/seller/PendingBalanceCard.tsx`
- `src/hooks/useSellerStats.ts`
- `src/pages/seller/SellerAnalytics.tsx`
- `src/pages/seller/SellerCommissions.tsx`
- `src/components/ui/signature-pad.tsx`

---

## 📊 Resumo de Arquivos Modificados

### Migrations (1 arquivo)
- ✅ `supabase/migrations/20260110000002_remove_30_day_maturation.sql` (NOVO)

### Componentes Frontend (5 arquivos)
- ✅ `src/components/seller/PendingBalanceCard.tsx`
- ✅ `src/pages/seller/SellerCommissions.tsx`
- ✅ `src/components/admin/Sidebar.tsx`
- ✅ `src/pages/SellersPage.tsx`
- ✅ `src/components/ui/signature-pad.tsx`

### Hooks e Utilitários (2 arquivos)
- ✅ `src/hooks/useSellerStats.ts`
- ✅ `src/pages/seller/SellerAnalytics.tsx`

### Rotas (1 arquivo)
- ✅ `src/App.tsx`

**Total:** 9 arquivos modificados/criados

---

## 🎯 Próximas Tasks Sugeridas (Para Adicionar ao Trello)

### TASK 5: Testes em Produção
**Prioridade:** Alta  
**Status:** ⏳ Pendente  
**Categoria:** QA / Validação

#### Descrição
Validar em ambiente de produção que todas as mudanças estão funcionando corretamente.

#### Checklist
- [ ] Validar que comissões estão sendo criadas com `available_for_withdrawal_at` = primeiro dia do mês seguinte
- [ ] Verificar que cronômetro mostra corretamente o tempo até a próxima janela
- [ ] Confirmar que botão "Request Payment" não aparece
- [ ] Confirmar que aba de payment requests não está acessível
- [ ] Verificar que nenhuma funcionalidade de payment request está acessível
- [ ] Testar em diferentes datas (dentro/fora da janela de dias 1-5)

---

### TASK 6: Reativar Payment Requests (Quando Necessário)
**Prioridade:** Baixa  
**Status:** ⏳ Pendente  
**Categoria:** Feature Toggle

#### Descrição
Quando necessário reativar as funcionalidades de payment requests, descomentar todo o código marcado e remover funções temporárias.

#### Checklist
- [ ] Buscar por `// PAYMENT REQUEST - COMENTADO TEMPORARIAMENTE` em todos os arquivos
- [ ] Descomentar imports de payment requests
- [ ] Descomentar funções relacionadas
- [ ] Descomentar componentes UI (botão, aba, modal)
- [ ] Descomentar rotas e links
- [ ] Remover funções temporárias (com prefixo `_`)
- [ ] Testar fluxo completo: solicitação → aprovação → pagamento
- [ ] Validar que emails de notificação estão funcionando

#### Arquivos a Modificar
- `src/pages/seller/SellerCommissions.tsx`
- `src/App.tsx`
- `src/components/admin/Sidebar.tsx`
- `src/pages/SellersPage.tsx`
- `src/hooks/useSellerStats.ts`
- `src/pages/seller/SellerAnalytics.tsx`

---

### TASK 7: Melhorias Futuras - Notificações de Janela de Solicitação
**Prioridade:** Baixa  
**Status:** ⏳ Pendente  
**Categoria:** Feature Enhancement

#### Descrição
Adicionar notificações (email/push) quando a janela de solicitação de pagamento abrir (dia 1 de cada mês) para lembrar os sellers que podem solicitar seus pagamentos.

#### Checklist
- [ ] Criar função de notificação
- [ ] Configurar job/cron para executar no dia 1 de cada mês
- [ ] Criar template de email de notificação
- [ ] Testar envio de notificações

---

### TASK 8: Validação Backend - Janela de Solicitação
**Prioridade:** Média  
**Status:** ⏳ Pendente  
**Categoria:** Backend / Segurança

#### Descrição
Adicionar validação no backend (função `create_seller_payment_request`) para garantir que solicitações só sejam aceitas nos dias 1-5 de cada mês, mesmo que alguém tente fazer uma requisição direta à API.

#### Checklist
- [ ] Verificar se validação já existe na função `create_seller_payment_request`
- [ ] Se não existir, adicionar validação de data
- [ ] Testar tentativa de solicitação fora da janela
- [ ] Validar mensagem de erro retornada

---

## 📝 Notas Importantes

1. **Código Comentado:** Todo código relacionado a payment requests foi comentado, não removido, facilitando reativação futura.

2. **Funções Temporárias:** Foram criadas funções temporárias com prefixo `_` para evitar erros de compilação. Essas devem ser removidas quando reativar payment requests.

3. **Migration Aplicada:** A migration `20260110000002_remove_30_day_maturation.sql` já foi aplicada no banco de dados.

4. **Build Validado:** O projeto compila sem erros após todas as correções.

5. **Lógica de Negócio:** 
   - Comissões do mês X ficam disponíveis no dia 1 do mês X+1
   - Sellers só podem solicitar pagamentos nos dias 1-5 de cada mês
   - Cronômetro mostra quando a próxima janela abre

---

## 🔗 Links Úteis

- **Relatório Completo:** `docs/RELATORIO_SESSAO_09_JANEIRO_2026.md`
- **Migration:** `supabase/migrations/20260110000002_remove_30_day_maturation.sql`

---

**Data:** 09 de Janeiro de 2026  
**Status Geral:** ✅ Todas as tasks principais concluídas
