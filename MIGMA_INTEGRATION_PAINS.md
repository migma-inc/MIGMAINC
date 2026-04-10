# Relatório de Integração: Migma <> Matricula USA
## Dores Técnicas e Desafios de Checkout

Este documento detalha os obstáculos técnicos encontrados pela equipe da Migma ao tentar integrar o fluxo de matrícula com as Edge Functions globais do Matricula USA.

### 1. Acoplamento Excessivo com o Fluxo de Visto (Legacy Cloud)
**A Dor**: A função global `create-parcelow-checkout` está profundamente amarrada às tabelas `visa_orders`, `service_requests` e `clients`.
**Impacto**: Um aluno Migma está no "Step 0" (taxa de seleção). Ele ainda não tem um `service_request_id` completo nem um perfil de `client` com todos os dados de endereço salvos no banco. 
**Mensagem de Erro**: Ocorre um `TypeError` ou `500 Internal Server Error` porque a função tenta fazer `JOINS` em registros que ainda não existem para o aluno Migma.

### 2. Dependência de Dados Pré-Existentes no Banco
**A Dor**: Atualmente, para gerar um link de pagamento na Parcelow, a função global tenta ler o CPF e o endereço do aluno diretamente das tabelas do Matricula USA.
**Necessidade**: No momento do checkout, o aluno Migma **já digitou** todos os dados no formulário (CPF, Endereço, Nome). 
**Sugestão**: Precisamos que a função de checkout aceite esses dados diretamente via `POST` payload. Se os dados forem passados no body, a função não deveria tentar buscá-los no banco, evitando o crash por "registro não encontrado".

### 3. Workaround de "Intent" de Pedido (Gambiarras de Sincronização)
**A Dor**: Para conseguir um `order_id` válido para a Parcelow, a Migma precisa chamar uma RPC (`register_visa_order_intent`) e criar registros "fantasmagóricos" em `visa_orders` antes mesmo do pagamento ser processado.
**Desejo**: Um fluxo de "Checkout Stateless" ou uma tabela de "Pending Payments" específica (como a `migma_parcelow_pending` que tentamos implementar localmente) que seja gerenciada pelo Matricula USA e que saiba processar o webhook de retorno de forma genérica.

### 4. Gestão de Webhooks (A "Caixa Preta")
**A Dor**: O `parcelow-webhook` global hoje só sabe atualizar a tabela `visa_orders`. Se o pagamento for Migma, ele se perde.
**Desejo**: Que o webhook global tenha uma lógica de "Fallback":
1. Se o pedido não estiver em `visa_orders`, verifique em uma tabela de `migma_payments_pending`.
2. Se encontrar, dispare o trigger de liberação de sistema para o aluno Migma.

### Conclusão e Próximos Passos Sugeridos
Para que a IA do Matricula USA possa nos ajudar, ela precisa implementar:
- [ ] Uma versão da `create-parcelow-checkout` que aceite o objeto `client` completo via payload (bypass no banco).
- [ ] Uma lógica no Webhook global que reconheça referências de pagamento da Migma (Ex: Prefixo `MIG-`).
- [ ] Um endpoint de criação de conta atômico que retorne o `user_id` e o `order_id` em uma única chamada.

---
*Documento gerado para facilitar a colaboração entre os times de engenharia Migma e Matricula USA.*
