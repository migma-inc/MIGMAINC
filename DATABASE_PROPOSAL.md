# Proposta de Estrutura de Banco de Dados para Tracking de Jornadas

Esta proposta visa adicionar metadados às tabelas de checkout para permitir o agrupamento de múltiplos serviços em uma única jornada de cliente.

## 1. Alterações em `visa_products` (Metadados de Jornada)
Adicionar colunas para identificar quais produtos pertencem à mesma sequência:

- **`journey_group`** (text): Identificador da jornada (ex: `initial_application`).
- **`step_number`** (integer): Ordem do produto na jornada (ex: 1, 2, 3).
- **`is_full_process`** (boolean): Flag para indicar se o produto é o pagamento total da jornada.

## 2. Lógica de Cruzamento (Dashboard Adm)
O Dashboard de Tracking utilizará a seguinte lógica para determinar o status do cliente através do **Nome/Slug do Produto**:

1. **Agrupamento**: O sistema unifica as tentativas por e-mail do cliente.
2. **Identificação de Etapas**: 
   - Se o slug contém `selection-process` -> Mapeado para **Step 1**.
   - Se o slug contém `scholarship` -> Mapeado para **Step 2**.
   - Se o slug contém `i20` ou `control` -> Mapeado para **Step 3**.
3. **Full Process Payment**: Caso o produto possua `full-process` ou `payment-total` no slug/nome, a jornada é marcada como **Concluída Integralmente**.

## 3. Parâmetros de URL (Tracking)
Conforme solicitado, manteremos a simplicidade dos parâmetros originais:
`?prefill=TOKEN_ID&seller=SELLER_ID`

A inteligência de identificar em qual step o cliente está (ou se ele pagou o total) residirá na lógica do Dashboard, comparando o `product_slug` do `prefill_token` com o histórico de `visa_orders`.

---

## Benefícios
- **Simplicidade**: Zero alteração na lógica de geração de links dos vendedores.
- **Transparência**: O Admin vê em tempo real se o cliente abandonou o checkout de um step específico.
- **Flexibilidade**: Permite adicionar novos steps no futuro apenas atualizando o mapeamento de nomes.
