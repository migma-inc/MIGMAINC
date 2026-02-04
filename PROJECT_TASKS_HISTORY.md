# Histórico de Tarefas e Implementações do Sistema

Este documento serve como um registro centralizado de todas as funcionalidades implementadas, tarefas concluídas e melhorias técnicas realizadas no projeto, servindo como base para futuras referências e planejamento.

## 🚀 Split Payment System (Pagamento Dividido)
O sistema permite que clientes dividam pagamentos em duas partes, utilizando métodos distintos (Cartão, PIX, TED), aumentando a flexibilidade financeira.

### Backend & Banco de Dados
- [x] **Estrutura de Dados `split_payments`**
    - Criação da tabela com suporte a duas partes de pagamento (`part1`, `part2`).
    - Colunas para controle de status individual e global (`overall_status`).
    - Constraints de integridade para garantir soma correta dos valores.
- [x] **Integração `visa_orders`**
    - Adição de flags (`is_split_payment`) e chaves estrangeiras para vincular pedidos a pagamentos divididos.

### Edge Functions
- [x] **`create-split-parcelow-checkout`**
    - Lógica para validar divisão de valores.
    - Criação atômica de registros no banco.
    - Geração de 2 checkouts simultâneos na API da Parcelow.
- [x] **`get-next-split-checkout`**
    - Orquestração inteligente de redirecionamento (leva o usuário para a Parte 2 assim que a Parte 1 é paga).
- [x] **Webhook Avançado (`parcelow-webhook`)**
    - Lógica condicional para detectar pagamentos parciais.
    - Gatilho de geração de contratos apenas quando `overall_status` atinge `fully_completed`.

### Frontend (User Experience)
- [x] **Componente `SplitPaymentSelector`**
    - Interface intuitiva para o usuário escolher valores e métodos de cada parte.
    - Validação em tempo real (fração mínima, soma total).
- [x] **Fluxo de Redirecionamento (`SplitPaymentRedirect`)**
    - Página intermediária com feedback visual de progresso.
    - Auto-redirect suave entre pagamentos.

### Status de Deploy (Split Payment)
- [ ] **Migração de Banco Prod**: Executar `supabase db push` em produção.
- [ ] **Deploy Edge Functions**: `create-split-parcelow-checkout`, `get-next-split-checkout`, `parcelow-webhook`.
- [ ] **Testes de Webhook**: Validar recebimento de postbacks da Parcelow.

---

## 🔗 Sales Links & Seller Dashboard
Ferramentas para vendedores e administradores gerarem links de pagamento personalizados.

- [x] **Geração de Links de Venda**
    - Criação de links pré-preenchidos para produtos Visa e Contratos.
    - Cópia rápida para clipboard.
- [x] **Remoção de Atribuição Automática (Admin)**
    - **Refatoração Recente**: Links gerados por administradores agora são "neutros" (sem `seller_id` vinculado).
    - Remoção da interface de seleção de vendedor para evitar atribuições acidentais.
    - Limpeza de lógica de busca de vendedores no componente `SellerLinks`.
- [x] **Organização Visual**
    - Agrupamento de produtos por categoria (Initial, COS, Transfer).
    - Exibição clara de preços base e extras por dependente.

---

## 🛠️ Correções e Melhorias Recentes

### Pagamentos e Integrações (Zelle/Parcelow)
- [x] **Zelle & Comprovantes**
    - Correção no fluxo de upload de comprovantes Zelle para garantir que a URL da imagem seja salva corretamente em `migma_payments`.
    - Ajustes na visualização de imagens na interface administrativa.
- [x] **Cupons de Desconto**
    - Correção na lógica de aplicação de descontos no checkout (garantindo que o valor final enviado ao gateway esteja correto).

### Segurança e Acesso
- [x] **Document Upload RLS**
    - Ajuste nas políticas de segurança (Row Level Security) para permitir uploads de documentos por usuários anônimos/autenticados corretamente.
- [x] **Acesso a Documentos Privados**
    - Implementação de URLs assinadas (`getSecureUrl`) para que admins possam visualizar documentos sensíveis (CVs, passaportes) sem expô-los publicamente.

### Interface Administrativa
- [x] **Zero Spinner Policy**
    - Implementação massiva de Skeleton UI para carregamento percebido mais rápido.
- [x] **Auditoria**
    - Rastreamento de quem aprovou pagamentos (`processed_by_user_id`).

---

## 📋 Próximos Passos Sugeridos

- [ ] **Monitoramento de Split Payments**: Dashboard específico para ver quantos splits estão "travados" na Parte 1.
- [ ] **Refinamento de Logs**: Melhorar a visualização de erros de webhook no painel admin.
- [ ] **Testes E2E**: Criar testes automatizados para o fluxo crítico de pagamento dividido.
