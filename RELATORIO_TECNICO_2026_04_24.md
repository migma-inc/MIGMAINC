# Relatório Técnico - 2026-04-24

## TASK: Resolução do Erro 500 no Migma Split Checkout

### Descrição do Problema
O fluxo de pagamento dividido (split payment) para novos estudantes estava falhando intermitentemente com erro 500.

### Causa Raiz Identificada (O "Verdadeiro Culpado")
1.  **Violação de Chave Estrangeira (FK)**: As Edge Functions `migma-create-student` e `migma-split-parcelow-checkout` possuíam uma lógica de fallback que gerava um `crypto.randomUUID()` quando o `order_id` estava ausente. No entanto, a tabela `split_payments` possui uma constraint de FK que exige que o `order_id` exista na tabela `visa_orders`. Como o UUID gerado era aleatório e não persistido, o banco de dados rejeitava a inserção.
2.  **Erro de Referência**: O uso da variável `p2_method` em vez de `part2_method` causava falha na atribuição dos dados de inserção.
3.  **Inconsistência de Dados**: O frontend nem sempre enviava o `service_request_id` necessário para criar a intenção de pedido oficial, disparando o fallback problemático.

### Ações Realizadas
-   **migma-split-parcelow-checkout**: Alterado fallback de `order_id` para `null` (coluna permite nulo), garantindo integridade referencial.
-   **migma-create-student**: Removida geração de UUID "fake". Agora retorna `null` se o RPC de intenção falhar, informando corretamente o estado ao frontend.
-   **Estabilização**: Implementado sistema de `debug_logs` serializados para visibilidade total do erro no console do navegador.
-   **Deploy**: Realizado deploy da v16 (Split Checkout) e v35 (Create Student).

### Status Atual
-   [x] Bug de UUID resolvido.
-   [x] Erro de variável `p2_method` corrigido.
-   [x] Logs de depuração ativos.
-   [ ] **Ação Requerida**: Usuário deve realizar um novo teste de matrícula para confirmar o redirecionamento para a Parcelow.

---

## TASK: Aplicação de Dependências Migma Parcelow (MCP)

### Descrição
Aplicação de scripts SQL via MCP para garantir a existência de tabelas e funções necessárias para o checkout individual da Parcelow.

### Ações Realizadas
- **Tabela `migma_parcelow_pending`**: Criada para registrar pedidos individuais (non-split) com suporte a RLS.
- **Função `get_user_id_by_email`**: Criada como fallback para buscar UUIDs de usuários existentes pelo email (Security Definer).
- **Políticas de RLS**: Configuradas para `service_role` e acesso individual de usuários autenticados.

### Status Atual
- [x] Tabela criada.
- [x] Função RPC ativa.
- [x] Permissões concedidas.

---

## TASK: Deploy de Edge Functions (Fixes Split Payment)

### Descrição
Realizado o deploy das funções corrigidas para resolver o Erro 500 no checkout de split payment e corrigir o loop no webhook da Parcelow.

### Funções Atualizadas
- **`migma-split-parcelow-checkout`**: Fix para `order_id` (agora enviando `null` para evitar FK violation) e retorno de status 200 em erros tratados.
- **`parcelow-webhook`**: Correção na lógica de processamento de `placement_fee` e suporte a split payments.
- **`migma-parcelow-checkout`**: Adicionado suporte a `partner_reference_override`.

### Status Atual
- [x] Deploy das 3 funções concluído via MCP.
- [x] Verificação de dependências compartilhadas realizada.

---

## TASK: Deploy de migma-create-student (V35)

### Descrição
Realizado o deploy da função `migma-create-student` com correções no fluxo de criação de usuário e integração com o RPC `get_user_id_by_email`.

### Ações Realizadas
- **Fallback de Order ID**: Removida a geração de UUID aleatório. Agora retorna `null` se não houver `service_request_id`, garantindo integridade com a tabela `split_payments`.
- **Recuperação de ID**: Integrada a nova função RPC `get_user_id_by_email` para lidar com usuários que já existem no Auth mas não no `user_profiles`.

### Status Atual
- [x] Deploy da função concluído (v58).

---

## TASK: Correção Manual de Pagamento (Placement Fee) - pepa9245@uorak.com

### Descrição
Correção manual do status de pagamento para o aluno `pepa9245@uorak.com`, que teve o split payment completado mas o status não sincronizou automaticamente devido a uma inconsistência de `profile_id`.

### Ações Realizadas
- **`user_profiles`**: `is_placement_fee_paid` marcado como `true`.
- **`institution_applications`**: Status da aplicação `b9794bb2-571e-4ca0-86e7-1782170ec66d` alterado para `payment_confirmed`.
- **`split_payments`**: Confirmado status `fully_completed`.

### 2. Melhorias de UX no Redirecionamento (Migma Students)
*   **Problema**: Alunos da Migma que completam pagamentos split podiam ficar "presos" na tela de sucesso genérica sem saber como voltar ao onboarding.
*   **Solução**: 
    *   Modificamos `CheckoutSuccess.tsx` para detectar estudantes Migma via `source` do perfil ou do pagamento.
    *   Adicionamos botão "Continuar para Onboarding" e redirecionamento automático de 5 segundos para `/student/onboarding`.
*   **Status**: Implementado e traduzido em `pt.json`.

Relatório atualizado por Antigravity.
