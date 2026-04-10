# Relatório Técnico de Atividades - 10/04/2026

## Título: Restauração da Integridade do Fluxo de Checkout Migma

### Problemas Resolvidos:
1. **Erro de `order_id` Undefined**: Resolvida a falha onde o frontend tentava ler `order_id` de uma resposta vazia do servidor, travando o processo de registro.
2. **Regressão no `matriculaApi.ts`**: Corrigida a desestruturação incorreta do retorno do Supabase que causava falha silenciosa em todas as chamadas de Edge Function.
3. **Mapeamento de Pedidos no Servidor**: A função `migma-create-student` agora gera corretamente a intenção de pedido no banco de dados através da RPC `register_visa_order_intent`.
4. **Deploy de Infraestrutura**: Atualizada a função SQL e a Edge Function para suportar o retorno de UUID, garantindo que o `order_id` esteja disponível para Stripe e Parcelow.

### Mudanças Realizadas:
- **SQL**: `register_visa_order_intent` atualizada para `RETURNS uuid`.
- **Edge Function**: `migma-create-student` v41 deployada com lógica de criação de pedido.
- **Frontend**: 
    - `matriculaApi.ts`: Ajuste na interface `CreateStudentPayload` e simplificação do `invokeFunction`.
    - `index.tsx`: Inclusão de `service_request_id` e metadados de cupom no payload de criação.

### Status Final: 
✅ Fluxo Restaurado. 
✅ Stripe e Parcelow operacionais (Parcelow agora usa migma-parcelow-checkout dedicada).
✅ Redirecionamento pós-pagamento configurado.

### Evolução da Solução (Parcelow 500):
- **Causa**: O `create-parcelow-checkout` original falhava ao tentar realizar JOINS com tabelas de visto (`clients`, `service_requests`) que ainda não existiam para o aluno Migma.
- **Correção**: Implementada a Edge Function `migma-parcelow-checkout` que recebe dados do cliente via POST e utiliza a nova tabela `migma_parcelow_pending` para controle de webhooks.
