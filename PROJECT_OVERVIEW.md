# Visão Geral do Projeto - MIGMA INC

## Arquitetura
O projeto é construído usando uma stack moderna:
- **Frontend**: React com Vite
- **Estilização**: Tailwind CSS + Shadcn UI
- **Backend/Banco de Dados**: Supabase (PostgreSQL + Auth + Edge Functions)
- **Roteamento**: React Router DOM v6
- **Gerenciamento de Estado**: Hooks do React (useState, useEffect, useSearchParams)

## Estrutura de Pastas
- `src/pages`: Componentes principais das páginas agrupados por função (admin, vendedor, público).
- `src/components`: Componentes de UI reutilizáveis (ui, admin, vendedor, layout).
- `src/features`: Lógica específica de funcionalidades complexas (ex: checkout de vistos).
- `src/lib`: Utilitários principais (cliente Supabase, geração de documentos, exportações).
- `src/contexts`: Contextos de estado global da aplicação.
- `src/hooks`: Hooks customizados para busca de dados e lógica.
- `supabase/`: Migrações de banco de dados, dados de semente (seed) e configuração.

## Funcionalidades Principais

### 1. Dashboard Unificado (`/dashboard`)
O centro de comando para administradores e equipes de operações.
### 1.1 Dashboards Administrativos
- **Sales Analytics**: Visão geral de métricas.
- **Zelle Approval**: Fluxo de aprovação manual.
- **Payment Tracking**: Monitoramento em tempo real de abandonos e progresso de etapas.
- **Service Management**: Criação de links de venda com slugs dinâmicos.
- **Gerenciamento de Vendas**: Monitoramento e gestão do desempenho de Vendedores e Heads of Sales (HoS).
- **Conteúdo/Comunicação**: Tratamento de mensagens de contato e pagamentos recorrentes de bolsas/EB3.

### 2. Portal do Vendedor (`/seller`)
Um espaço dedicado para a equipe de vendas.
- **Analytics de Desempenho**: Acompanhamento visual de cliques, leads e taxas de conversão.
- **Gerenciamento de Links**: Geração de links de checkout personalizados para clientes.
- **Rastreamento de Leads**: Funcionalidade básica de CRM para gerenciar clientes em potencial.

### 3. Fluxo de Checkout de Vistos (`/checkout`)
Um processo de várias etapas otimizado para a compra de serviços de visto.
- **Métodos de Pagamento**: Integração com Stripe (Cartão/Pix), Parcelow (Parcelamento) e Zelle (Transferência Direta).
- **Geração de Documentos**: Criação automatizada de contratos e anexos usando `visa-utils`.

## Modelo de Dados (Parcial)
- `visa_orders`: Armazena detalhes da aplicação, status de pagamento e links para PDFs. Implementa paginação no servidor (30/página) e filtros complexos.
- `sellers`: Perfis da equipe de vendas e métricas de desempenho.
- `visa_products`: Configuração dos serviços de visto disponíveis.
- `leads`: Informações de clientes potenciais capturadas via funis de marketing.
