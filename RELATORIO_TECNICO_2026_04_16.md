# Relatório Técnico - 2026-04-16

## Correção Pontual de Método de Pagamento — Invoice PDF

### Contexto Operacional

Pedido de cliente internacional (`ritamaikuang12@gmail.com`) em que o pagador era um parente em outro país. Por restrição de fuso horário, o pagamento foi realizado via link externo do Parcelow antes da assinatura do contrato. O order havia sido criado originalmente com `payment_method = 'zelle'`, fazendo com que o PDF da invoice exibisse instruções de Zelle ao invés de Parcelow.

### Ação Executada

- **UPDATE em `visa_orders`**: campo `payment_method` alterado de `'zelle'` para `'parcelow'` no order `ORD-INT-20260416051626-78`.
- **Regeneração do Invoice PDF**: Edge Function `generate-invoice-pdf` invocada diretamente via curl para o order `87802052-6b83-4ab8-a133-7760644cdb57`. O PDF foi sobrescrito no storage (`upsert: true`) com as instruções corretas de Parcelow.

### Detalhes Técnicos

- **Tabela impactada**: `visa_orders`
- **Campo**: `payment_method`: `'zelle'` → `'parcelow'`
- **Order Number**: `ORD-INT-20260416051626-78`
- **Cliente**: `ritamaikuang12@gmail.com` (Kelly Mai Kuang)
- **Edge Function**: `generate-invoice-pdf` — lógica de Payment Instructions baseada em `order.payment_method`; valor `'parcelow'` (ou qualquer string iniciando com `'parcelow'`) exibe "Payment Method: Parcelow" no PDF.
- **Storage**: arquivo sobrescrito em `contracts/invoices/INVOICE_Kelly_Mai_Kuang_ORD-INT-20260416051626-78_INITIAL_Application___Full_Process_Payment_V2.pdf`

### Observação

Ação pontual e isolada. Não houve alteração de código — apenas manipulação direta de dado no banco e re-trigger da geração do PDF.
