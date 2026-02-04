# 📋 Exportação para Trello - Migma Inc.

Abaixo estão as tarefas formatadas para criação de cards no Trello, com detalhes técnicos e critérios de aceitação.

---

## 🚀 ÉPICO: Split Payment System (Pagamento Dividido)

### [Backend] Estrutura DB e Edge Functions para Split Payment
**Descrição:**
Implementar a infraestrutura backend para suportar a divisão de pagamentos em duas partes distintas.
**Detalhes Técnicos:**
- Tabela `split_payments` criada com chaves para `part1` e `part2`, status individual e global.
- FK `split_payment_id` adicionada em `visa_orders`.
- Edge Function `create-split-parcelow-checkout` criada para orquestrar 2 checkouts simultâneos.
- Edge Function `get-next-split-checkout` para lógica de roteamento pós-pagamento.
- Webhook `parcelow-webhook` atualizado para tratar pagamentos parciais (não gerar contrato até que ambas as partes sejam pagas).
**Arquivos Afetados:**
- `/supabase/migrations/*_create_split_payments.sql`
- `/supabase/functions/create-split-parcelow-checkout/index.ts`
- `/supabase/functions/parcelow-webhook/index.ts`

### [Frontend] Interface de Seleção e Fluxo (Split Payment)
**Descrição:**
Criar componentes de UI para permitir que o usuário escolha como dividir o pagamento e fluxo de redirecionamento.
**Detalhes Técnicos:**
- Componente `SplitPaymentSelector`: Inputs para valor (validação de soma total) e seleção de método (Pix, Card, TED).
- Página `SplitPaymentRedirect`: Lógica de polling/verificação para encaminhar o usuário para o pagamento pendente correto.
- Integração com `usePaymentHandlers` para interceptar checkout normal e iniciar fluxo split.
**Arquivos Afetados:**
- `src/features/visa-checkout/components/steps/step3/SplitPaymentSelector.tsx`
- `src/pages/SplitPaymentRedirect.tsx`
- `src/hooks/usePaymentHandlers.ts`

### [Deploy] Release Split Payment System
**Descrição:**
Executar passos de deploy para colocar a feature de Split Payment em produção.
**Checklist:**
- [ ] Executar migration de produção (`supabase db push`).
- [ ] Deploy Edge Function: `create-split-parcelow-checkout`.
- [ ] Deploy Edge Function: `get-next-split-checkout`.
- [ ] Deploy Edge Function: `parcelow-webhook` (Atualizado).
- [ ] Validar Webhook Endpoint no Dashboard da Parcelow.
- [ ] Teste E2E em ambiente de Staging/Prod com valor irrisório.

---

## 🔗 ÉPICO: Seller Links & Admin Tools

### [Admin] Remoção de Atribuição Automática de Seller
**Descrição:**
Garantir que links gerados por administradores sejam "neutros" e não vinculem automaticamente um vendedor, prevenindo comissionamento incorreto.
**Detalhes Técnicos:**
- Removido envio de `seller_id` no insert da tabela `checkout_prefill_tokens` no componente `SellerLinks`.
- Removido componente de UI `Select` (Dropdown) que permitia admin escolher vendedor.
- Lógica de fallback: Admin não assume mais identidade de vendedor por padrão.
**Arquivos Afetados:**
- `src/pages/seller/SellerLinks.tsx`

### [UI] Melhorias no Dashboard de Links (SellerLinks)
**Descrição:**
Organizar visualmente os produtos para facilitar a busca pelo vendedor e melhorar a performance de carregamento.
**Detalhes Técnicos:**
- Implementação de cache local (`getCachedProducts`) para evitar loading spinners desnecessários.
- Agrupamento de produtos por categoria: `Initial`, `COS`, `Transfer`.
- Exibição condicional de preços (Base + Dependente).
- Correção de validação de formulário "Quick Client Setup".

---

### [Fix] Parcelow Checkout para RFE Service
**Descrição:**
Correção crítica no fluxo de checkout da Parcelow especificamente para o serviço de RFE (Request for Evidence).
**Detalhes Técnicos:**
- Ajuste no payload enviado para a Edge Function `create-parcelow-checkout` para garantir que o serviço RFE seja processado corretamente.
- Validação de valores e itens do carrinho para este SKU específico.

### [Content] Upload Manual do Gestor (HTML)
**Descrição:**
Disponibilização do "Manual do Gestor" em uma URL pública específica.
**Detalhes Técnicos:**
- Upload do arquivo HTML estático para o bucket `public-assets` (ou diretório `public/`).
- Configuração de rota/URL amigável para acesso direto pelos gestores.
- Validação de renderização e responsividade da página HTML.

### [UI] Parcelow Payment Experience
**Descrição:**
Melhorias visuais e de feedback no botão de pagamento da Parcelow.
**Detalhes Técnicos:**
- **Loading State:** Implementação de feedback visual (spinner/texto "Processing...") no botão "Pay with Parcelow" para evitar múltiplos cliques e ansiedade do usuário.
- **Nomenclatura (`SelectPayment`):** Ajuste de labels e textos na etapa de seleção de pagamento para maior clareza (ex: detalhamento de taxas se aplicável, termos mais amigáveis).

---

## 🐛 Correções e Sustentação (Bug Fixes)

### [Fix] Upload de Comprovantes Zelle
**Descrição:**
Corrigir falha onde a URL da imagem do comprovante Zelle não estava sendo salva no banco de dados, impedindo visualização no admin.
**Solução:**
- Ajuste no fluxo de upload para garantir retorno da Public URL correta do Storage.
- Atualização do registro em `migma_payments` com a URL válida.

### [Fix] RLS Policies para Upload de Documentos
**Descrição:**
Usuários (anônimos ou não) enfrentavam erro de permissão ao fazer upload de documentos no fluxo Visa.
**Solução:**
- Revisão e correção das Policies do Storage Supabase (`visa-documents`).
- Permissão `INSERT` habilitada para `public`/`anon` com restrições adequadas de pasta.

## Infrastructure

### [Doc] Documentação Técnica Split Payment
**Descrição:**
Documentação completa da arquitetura do novo sistema de divisão de pagamentos para referência futura.
**Entregável:**
- Arquivo `SPLIT_PAYMENT_DOCUMENTATION.md` contendo Schema DB, Payloads de API e Lógica de Webhook.

---

## 📈 ÉPICO: Seller Analytics V2

### [Analytics] Lógica de Comparação Inteligente (MTD vs Last MTD)
**Descrição:**
Ajustar a lógica de "Previous Period" para que comparações mensais façam sentido para o usuário.
**Problema Atual:**
A função `getPreviousPeriod` apenas subtrai a duração em ms do período atual. Se o usuário filtra "Este Mês" (ex: 10 dias), o sistema compara com os "últimos 10 dias do mês anterior", o que gera dados distorcidos.
**Solução Técnica:**
- Refatorar `getPreviousPeriod` em `src/lib/seller-analytics.ts`.
- Implementar lógica que detecta se o período é mensal ('thismonth') e compara com o mesmo intervalo de dias do mês anterior ("Month to Date" vs "Last Month to Date").
- Garantir que "Mês Passado" compare com "Mês Retrasado" integralmente.

### [Analytics] Novo Filtro "Acumulado" (All Time)
**Descrição:**
Adicionar opção para visualizar o histórico completo ou anual (YTD) no dashboard.
**Detalhes Técnicos:**
- Adicionar case `all_time` (ou `ytd`) na função `getPeriodDates`.
- Definir `start` como data de criação do seller ou início do ano (conforme definição de "acumulado").
- Atualizar componente Frontend `SellerAnalytics.tsx` para incluir a opção no dropdown.

### [UI] Reordenação e UX dos Filtros
**Descrição:**
Reorganizar a lista de períodos para priorizar as opções mais utilizadas pelos vendedores.
**Ordem Sugerida:**
1. Este Mês (Padrão)
2. Mês Passado
3. Hoje
4. Ontem
5. Customizado
**Arquivos Afetados:**
- `src/pages/seller/SellerAnalytics.tsx` (Componente Select).

### [Fix] Discrepância de Dados (Card vs Gráfico)
**Descrição:**
Investigar e corrigir divergência apontada onde o card "Contratos Vendidos" mostra 1 e o gráfico mostra 4 (ou vice-versa).
**Hipótese Técnica:**
- A função `calculateStats` pode estar filtrando `isFirstPayment` de forma diferente da query que popula o gráfico.
- Verificar se o gráfico está contando todos os pedidos (incluindo upgrades/parcelas) enquanto o card conta apenas contratos únicos.
- Unificar a lógica de contagem usando a mesma função `isFirstPayment` para ambos.

---

## 🛍️ ÉPICO: Seller Orders Management

### [Feature] Botão de Deletar Pedidos Pendentes
**Descrição:**
Permitir que vendedores excluam pedidos que ainda estão com status "Pending", facilitando a limpeza de testes ou desistências.
**Requisitos Lógicos:**
- O botão só deve aparecer se `payment_status === 'pending'`.
- Ao clicar, exibir confirmação (`window.confirm` ou Modal UI).
- Executar `DELETE FROM visa_orders WHERE id = X AND seller_id = Y` (Garantir que só apaga se pertencer ao vendedor).
- Atualizar a lista localmente após exclusão.
**Arquivos Afetados:**
- `src/pages/seller/SellerOrders.tsx`

### [Feature] Filtro de Status na Lista de Pedidos
**Descrição:**
Adicionar um filtro Dropdown para visualizar pedidos por status (Todos, Paid, Pending, Failed).
**Detalhes Técnicos:**
- Adicionar estado `statusFilter` no componente `SellerOrders`.
- Implementar componente `Select` na barra de filtros.
- Atualizar lógica de filtragem `useMemo` para considerar o status.

### [UX] Card "Pending Orders" Clicável no Dashboard
**Descrição:**
Adicionar card de métrica "Pending Orders" no Analytics e torná-lo um atalho para a lista de pedidos filtrada.
**Detalhes Técnicos:**
- **Analytics:** Criar/Exibir card "Pending Orders" (atualmente oculto ou inexistente) usando `analyticsData.summary.pendingOrders`.
- **Navegação:** Ao clicar no card, redirecionar para `/seller/orders?status=pending`.
- **Lista de Pedidos:** Ler Query Param `?status=pending` ao carregar a página e aplicar o filtro automaticamente.
**Arquivos Afetados:**
- `src/pages/seller/SellerAnalytics.tsx`
- `src/pages/seller/SellerOrders.tsx`


