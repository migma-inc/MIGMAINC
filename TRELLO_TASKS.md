# Tarefas Migma - 27 de Janeiro de 2026

## 🚀 Migma Inc (Admin & Seller Experience)
- [x] **Transformação UI/UX: Zero Spinner Policy** 
    - Implementar Skeleton UI nas páginas: `ZelleApprovalPage`, `VisaContractApprovalPage`, `VisaOrdersPage`, `ContractsPage`, `SlackReportsPage`, `DashboardContent` e `AdminProfile`.
    - Criar componente `ImageWithSkeleton` para carregamento de documentos e selfies.
- [x] **Auditoria e Rastreabilidade**
    - Adicionar coluna `processed_by_user_id` nas tabelas `migma_payments` e `zelle_payments`.
    - Implementar badge "Approved by: [User Name]" na UI de histórico.
    - Executar script de backfilling SQL para aprovações retroativas.
- [x] **Central de Leads "Book a Call"**
    - Desenvolver `BookACallPage.tsx` (Listagem e Estatísticas).
    - Desenvolver `BookACallDetailPage.tsx` (Detalhes, IP Tracking, User Agent).
    - Criar hook `useBookACall.ts` e interfaces de tipos.
- [x] **Monitoramento Slack**
    - Corrigir sincronização de payload (Slack Event API).
    - Mapeamento manual e restauração de 31 eventos do dia 27/01.

---

## 💰 Lush America (Financeiro & Integridade)
- [x] **Cálculos Financeiros de Precisão**
    - Implementar fórmula Gross Amount vs Net Value para taxas de plataforma.
    - Automatizar extração de `pages` (volume) para relatórios financeiros.
- [x] **Exportação de Dados (Excel)**
    - Refatorar `paymentsExcelExport.ts` para paridade 1:1 com a visão Admin.
    - Implementar filtros de exclusão de rascunhos e testes.
    - Formatação estética: Header Color, Number Format (USD) e AutoFilter.
- [x] **Rastreabilidade Relacional**
    - Implementar trilha lógica: Payment -> Document -> Verification.
    - Corrigir fallback de 3 camadas para nomes de autenticadores e datas.

---

## 🛠️ Qualidade Técnica e Infraestrutura
- [x] **Build & Lint**
    - Validar build de produção (`npm run build`).
    - Resolver erros de lint TS6133 (variáveis não utilizadas).
- [x] **Otimização de Performance**
    - Refatorar `usePaymentsData.ts` para reduzir consumo de memória no cliente.
- [x] **Data Hygiene**
    - Limpeza de registros de teste (`visa_orders`, `migma_payments`, `contact_messages`).

---

## 📋 Próximas Tarefas (Roadmap)
- [ ] **Lead CRM Enhancements**: Adicionar Status (Pendente/Finalizado) e Notas Internas.
- [ ] **Slack Trigger Bot**: Migrar lógica de consolidação para Postgres Trigger.
- [ ] **Analytics Dash**: Gráficos AmCharts5 na Home do Dashboard.
- [ ] **Edge Functions Refactor**: Corrigir imports de PDF no Deno para remover avisos de lint.
