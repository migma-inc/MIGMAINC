# Relatório Técnico - 2026-04-15



- **Correções no Fluxo Operacional (CRM)**:
    - **Aprovação de Pagamentos Zelle**: Removida a redundância de aprovação repetitiva; agora o Checkout também sincroniza corretamente a tabela `migma_payments`, limpando o registro de pendência no dashboard "Pending Approvals" automaticamente.
    - **Filtro de Lotes no CRM**: Clientes com `user_profiles.service_type = null` que haviam finalizado pedidos corretamente voltaram a aparecer nas esteiras de 'Transfer' ou 'COS', através da implementação do fallback para usar o `product_slug` de `visa_orders`.

- **Correções de Recuperação de Sessão (Migma Checkout)**:
    - **Visualização de Documentos Seguros (Signed URLs)**: Solucionado o bug de imagens quebradas na "Revisão Final" do processo. Como o bucket `migma-student-documents` é privado, as URLs de visualização foram substituídas por tokens seguros e dinâmicos gerados via `createSignedUrl`.
    - **Correção da Quebra de Precificação (Fallback Isolado)**: Resolvido o erro em que o sistema apresentava `U$ 0.00` na etapa final. Estabelecemos a tabela `user_identity` como nova "fonte de verdade isolada" adicionando as colunas nativas `checkout_service` e `checkout_price` exclusivas dessa jornada.
    - **Restauração Inteligente do Progresso**: Alinhado o redirecionamento dos usuários provindos de aprovação de pagamentos recentes que efetuam novo login, assegurando que continuem a partir do Step 2 (Documentação) ao invés do zero (Step 1).

## Detalhes Técnicos
- **Método**: Passwordless OTP via e-mail (Token de 6 dígitos).
- **Validação OTP**: Consulta `maybeSingle()` em `user_profiles` antes da chamada de Auth.
- **Configuração de DB Adicional**: Foram injetadas duas novas colunas na tabela `user_identity` (`checkout_service` do tipo text; e `checkout_price` numérica) para evitar concorrências ou zumbis de price no Supabase.
- **Configuração Recomendada**: OTP expirando em 3600s e template de e-mail usando `{{ .Token }}`.

## Observações
- Os logins de Admin e Seller permanecem inalterados (via senha), garantindo compatibilidade com o sistema atual.
- A configuração global de "Confirm Email" no Supabase deve permanecer em OFF para não afetar outros provadores.

## Próximos Passos (Backlog Ativo)
- Otimização contínua das interfaces Mobile First no painel admin / Kanban.
- Conclusão das integrações com as etapas 6 e 7 na Spec de Onboarding Atual.
- Monitoramento do fluxo de conversões com os Fallbacks recém implementados.

- **Internacionalização (i18n) e Refinamento do Onboarding**:
    - **Internacionalização Completa do Survey**:
        - **Suporte Multi-idioma**: Implementada a tradução completa da etapa de Pesquisa (Step 3) para Português, Inglês, Espanhol e Francês.
        - **Dicionários Dinâmicos**: Criação e atualização dos arquivos `pt.json`, `en.json`, `es.json` e `fr.json` em `MIGMAINC/src/locales/`.
        - **Formatação de Dados**: O contador animado na tela de conclusão agora utiliza `toLocaleString(i18n.language)` para exibir o número `1.481` corretamente de acordo com a cultura do usuário (ex: vírgula vs ponto).
    - **Redesign do StepIndicator (Barra de Progresso)**:
        - **Estética Premium**: Aplicação de Glassmorphism (`backdrop-blur-xl`) e ambient glow para alinhar com a identidade visual Migma.
        - **Lógica de Conclusão**: Ajustada a definição de `isCompleted` para que o ícone verde (Check) tenha prioridade visual, mesmo quando o usuário ainda está na tela de sucesso de um step.
        - **Precisão Visual**: Refatorado o cálculo de `progressLinePercentage`. Como os itens usam `flex-1`, a barra dourada agora aponta exatamente para o centro da bolinha do step atual/concluido através de cálculo percentual absoluto (`(index + 0.5) / totalSteps`).
    - **Limpeza de Dados (Survey Questions)**:
        - Removida a opção defasada de investimento financeiro "Até $3.800/ano" em todos os idiomas para manter a consistência com os preços atuais dos processos.

## Detalhes Técnicos Adicionais
- **i18n Stack**: Utilização de `react-i18next` com detecção de idioma via Header global.
- **Cálculo de Progresso**: Implementada variável `visualIndex` no `StepIndicator` que considera o maior índice entre o step atual e o último passo concluído no banco de dados.
- **Bypass de Testes (DB)**: Realizada manipulação direta via Supabase CLI para avançar usuários de teste (`libby1849...`) reduzindo o tempo de conclusão do survey e pulando manualmente para a etapa de `documents_upload`.

## Próximos Passos (Backlog Ativo)
- Otimização contínua das interfaces Mobile First no painel admin / Kanban.
- Conclusão das integrações com as etapas 6 e 7 na Spec de Onboarding Atual.
- Monitoramento do fluxo de conversões com os Fallbacks recém implementados.
- Implementação de lembretes automáticos de upload de documentos para usuários estagnados no Step 4.

- **Refinamento e Padronização do Analytics (Dashboards de Vendas)**:
    - **Padronização de Terminologia**: Substituição de "Net Revenue" por "Revenue" em todos os componentes de Analytics e Overview (Seller e Head of Sales) para maior clareza comercial.
    - **Otimização de Visualização Mobile**:
        - Correção de sobreposição de labels no gráfico `MonthlySellerRevenueHistoryChart` (Histórico por Vendedor): labels agora centralizados internamente (`locationY: 0.5`) com cor branca fixa para contraste.
        - Redução de `minGridDistance` para `1` nos eixos X/Y, garantindo a exibição de todos os 12 meses em telas menores.
        - Rotação de labels em -90 graus nos gráficos de alta densidade.
    - **Mapeamento de Serviços Exaustivo**:
        - Reescrita da função `shortenServiceLabel` com mapeamento manual para os 47 produtos ativos da tabela `visa_products` (EB-2, EB-3, COS, Transfer, etc.).
        - Implementação de lógica de fallback por keywords e truncamento inteligente.
    - **Títulos de Gráficos Dinâmicos**: Implementada lógica de sufixos dinâmicos que injetam o nome do serviço e o mês selecionado diretamente nos títulos dos gráficos (ex: "Revenue per seller — EB-2 Step 1").
    - **Lógica de Médias Calibrada**: A linha de média no dashboard de vendas agora utiliza cálculo Year-to-Date (YTD) para o ano corrente, evitando distorções por meses futuros não processados.

## Detalhes Técnicos Adicionais (Analytics)
- **amCharts Configuration**: Ajuste de `bullets` para usar `centerX/centerY: am5.p50` garantindo centralização absoluta dentro das colunas agrupadas.
- **Mapping Strategy**: O dicionário de serviços prioriza o `slug` exato do banco de dados, com fallback secundário por busca de texto no nome completo.
- **YTD Calculation**: Injetada lógica de `new Date().getMonth() + 1` no denominador da média para o ano atual.

## Arquivos Impactados (Hoje - Bloco Analytics)
- `HeadOfSalesAnalytics.tsx`, `HeadOfSalesOverview.tsx`, `SellerOverview.tsx`
- `chartFormatters.ts`, `MonthlySellerRevenueHistoryChart.tsx`
- `WeeklyHistoryChart.tsx`, `WeeklyRevenueBarChart.tsx`

---

## Bloco de Commits — Tarde/Noite (tasks-nemer + fix/visa-orders-sorting)

### Ordenação de Pedidos no CRM (`fix/visa-orders-sorting`)

- **Ordenação por Data de Pagamento**: `VisaOrdersPage.tsx` agora ordena os pedidos filtrados visíveis em ordem decrescente usando `paid_at` como critério primário, com fallback para `created_at`. Garante que os pedidos mais recentes apareçam no topo das esteiras.
- **Cache de Produtos do Seller (v7)**: Chave de cache dos produtos do `SellerLinks` atualizada para `v7` para forçar invalidação e garantir que a lógica de visibilidade mais recente seja refletida corretamente.

### Cupom Promocional no EB-3 Installment Checkout

- **Funcionalidade Completa de Cupom**: Implementado campo de input e lógica de validação de cupons em `EB3InstallmentCheckout.tsx`.
    - Integração com RPC `validate_promotional_coupon` no Supabase para validação server-side.
    - Suporte a desconto fixo (`fixed`) e percentual (`percentage`).
    - UI com feedback visual de sucesso/erro e botão de remoção do cupom aplicado.
    - Desconto calculado sobre o valor base (parcela + multa por atraso, se aplicável), enviando `coupon_code` e `discount_amount` no payload do pagamento.
- **Exibição Dinâmica de Steps no SellerLinks**: Refatorada lógica de `displayPaymentNumber` e `displayDenominator` para diferenciar corretamente produtos "Step Plan" (`step-*`) de "Installment Plan" (`installment-*`), exibindo o numerador/denominador correto para cada família de produto.

### Robustez do MigmaCheckout — Sessão e Preços

- **Nova Migração de DB**: `20260415000000_add_payment_submitted_at_to_user_profiles.sql` — adicionada coluna `payment_submitted_at TIMESTAMPTZ` em `user_profiles` para rastrear o momento exato em que o cliente clicou em "pagar", independentemente de confirmação do gateway ou aprovação admin.
- **Recuperação de Sessão via `payment_submitted_at`**: Condição de redirecionamento para Step 2 ampliada — agora verifica `has_paid_selection_process_fee OR payment_submitted_at` (além de `identity_verified = false`), cobrindo pagamentos Zelle ainda em análise.
- **Cascade Fallback de Preço Reforçado**:
    - Fallback adicional de último nível: se nenhum preço for resolvido via `user_profiles`, `visa_orders` ou `individual_fee_payments`, o sistema usa `config.basePrice` como valor final antes de exibir `$0.00`.
    - Email resolvido via `profile.email || session.user.email` em todas as queries de `visa_orders` para evitar falhas quando `profile.email` é nulo.
    - Lógica de cascade implementada consistentemente nos três pontos de recuperação de sessão (Step 3 zerado, pós-pagamento aguardando docs, retorno com identity verificada).
- **Visualização de Documentos na Revisão Final (Step 3 Summary)**:
    - `Step3Summary.tsx` recebe nova prop `documentUrls` com signed URLs dos documentos já enviados.
    - `DocPreview` aceita `fallbackUrl` — exibe imagem a partir da URL segura quando nenhum `File` local está disponível (retorno de sessão).
    - `recoveredDocUrls` state adicionado ao `MigmaCheckout` para persistir as URLs recuperadas durante a restauração de sessão.

### ZelleApprovalPage — Aprovação Automática de `visa_orders`

- **Sincronização Automática de Orders Pendentes**: Ao aprovar um pagamento Zelle, o sistema agora também localiza a `visa_order` mais recente do usuário com `payment_status = 'manual_pending'` e a atualiza para `approved`, registrando `paid_at`.
- **Disparo Automático de PDFs**: Após a aprovação da order, são invocadas as Edge Functions `generate-visa-contract-pdf`, `generate-annex-pdf` e `generate-invoice-pdf` como fallback assíncrono.
- **AdminUserDetail — Visualização de Arquivos**: Corrigida lógica de abertura de documentos — PDFs abrem em nova aba (`window.open`), demais arquivos abrem no modal interno.

## Detalhes Técnicos (Bloco Tarde/Noite)

- **Migração**: `payment_submitted_at` gravado no momento do clique em "pagar" (antes da confirmação do gateway).
- **Sorting**: `VisaOrdersPage` usa `.sort((a, b) => dateB - dateA)` após o filtro de visibilidade, sem alterar queries remotas.
- **Coupon RPC**: `validate_promotional_coupon(p_code)` retorna `{ valid, code, type, value, message }`.
- **Cascade Fallback Final**: `config.basePrice` como sentinela de último recurso nos 3 pontos de resolução de preço do checkout.

## Arquivos Impactados (Bloco Tarde/Noite)

- `src/pages/MigmaCheckout/index.tsx`
- `src/pages/MigmaCheckout/components/Step3Summary.tsx`
- `src/pages/EB3InstallmentCheckout.tsx`
- `src/pages/seller/SellerLinks.tsx`
- `src/pages/VisaOrdersPage.tsx`
- `src/pages/ZelleApprovalPage.tsx`
- `src/pages/admin/AdminUserDetail.tsx`
- `supabase/migrations/20260415000000_add_payment_submitted_at_to_user_profiles.sql`


