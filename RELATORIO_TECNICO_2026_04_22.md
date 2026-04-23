# Relatório Técnico - 2026-04-22

## Atividades Realizadas

### TASK: Filtragem de Dados de Teste @uorak
- **Descrição**: Implementação de filtro global para ocultar pedidos associados ao domínio `@uorak.com` no ambiente de produção.
- **Arquivos Modificados**:
  - `src/pages/VisaOrdersPage.tsx`: Adicionado filtro no `buildOrdersQuery`.
  - `src/pages/admin/AdminTracking.tsx`: Adicionado filtro no `loadData` e definição de `isLocal`.
  - `src/pages/ZelleApprovalPage.tsx`: Adicionado filtro no `loadOrders` (pendentes e histórico).
  - `src/pages/admin/AdminSellerOrders.tsx`: Adicionado filtro no `loadOrders` e definição de `isLocal`.
- **Banco de Dados**:
  - Exclusão do pedido de teste remanescente `MIGMA-TRANSFER-645248`.

### Outras Correções
- Limpeza de registros de teste solicitados pelo usuário.
- Verificação de consistência na exibição de termos de aceite para pedidos legados.

### TASK: Correção UX Checkout Step 1
- **Descrição**: Unificação do passo de criação de conta e pagamento no `Step1PersonalInfo` e remoção da pré-seleção da Parcelow para forçar a escolha ativa do meio de pagamento.
- **Arquivos Modificados**:
  - `src/pages/MigmaCheckout/components/Step1PersonalInfo.tsx`: Removido estado padrão de pagamento e refatorado `handleSubmit` para centralizar fluxo de conta + pagamento.

### TASK: Pesquisa no Histórico Zelle Approval
- **Descrição**: Adição de barra de pesquisa (Search) para permitir buscar o histórico completo por nome, e-mail ou número de pedido, em vez de mostrar apenas os últimos 20 itens.
- **Arquivos Modificados**:
  - `src/pages/ZelleApprovalPage.tsx`: Implementado input de busca com debounce, atualização das queries de banco no `loadOrders` para `visa_orders` e `migma_payments`.
