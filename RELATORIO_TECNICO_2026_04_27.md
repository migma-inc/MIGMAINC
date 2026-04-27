# Relatório Técnico - 2026-04-27

## TASK: Correção de Erros no Checkout (PaymentStep)

### Erros Identificados:
1. **ReferenceError: scholarship is not defined**: O componente `PaymentStep.tsx` tentava acessar uma variável global `scholarship` que não existia no escopo, causando crash na renderização.
2. **Supabase 400 (Bad Request)**: A função `fetchApplications` tentava realizar um join com as tabelas `scholarships` e `universities`, que foram removidas/substituídas na versão V11 do banco de dados.

### Ações Realizadas:
- No arquivo `src/pages/StudentOnboarding/components/PaymentStep.tsx`:
    - Alterada a linha 326 para usar `firstApp` em vez de `scholarship`.
    - Comentada a consulta legada à tabela `scholarship_applications` que causava o erro 400, priorizando apenas a consulta V11 (`institution_applications`).
    - Adicionados logs de erro detalhados na função `fetchApplications`.

### TASK: Sincronização de Ambientes Stripe (Test vs Prod)

### Problema Identificado:
- O sistema precisava garantir que requisições originadas em ambientes de teste (localhost) usem sempre chaves de teste, e o domínio oficial use chaves de produção.
- O webhook estava tentando validar segredos de produção em eventos de teste, gerando ruído e confusão nos logs.

### Ações Realizadas:
- **Edge Function (`create-application-fee-checkout`)**:
    - Validado que a função já utiliza o `origin` da requisição para decidir entre `MATRICULAUSA_STRIPE_SECRET_KEY_PROD` ou `_TEST`.
    - Isso garante que se o frontend estiver em `localhost`, a sessão de checkout será criada no ambiente de teste do Stripe.
- **Edge Function (`matriculausa-stripe-webhook`)**:
    - Implementada detecção inteligente via campo `livemode` do payload do Stripe.
    - O código agora identifica se o evento é real ou de teste antes da validação e usa **apenas** o segredo correspondente.
    - Eliminado o loop de tentativas cegas, tornando o log muito mais limpo e direto.

### TASK: Correção da Taxa de Matrícula (Application Fee)

### Problema Identificado:
- O cálculo da taxa de matrícula estava incorreto ($250 em vez de $350 + $100 por dependente).
- A nomenclatura na interface estava inconsistente (Taxa de Inscrição vs Taxa de Matrícula).

### Ações Realizadas:
- **Edge Function (`migma-split-parcelow-checkout`)**: 
    - Corrigido o cálculo do montante para ser fixo em $350 USD (taxa base) + $100 USD por dependente.
- **Traduções (`pt.json`)**:
    - Atualizado o termo "Taxa de Inscrição" para "Taxa de Matrícula" em todo o sistema para alinhar com a nova política da instituição.

### TASK: Ocultação de Dados de Teste (Prefix "MIG-") via Banco de Dados

### Problema Identificado:
- Pedidos de teste criados com o prefixo "MIG-" estavam aparecendo no painel administrativo em produção.
- O usuário solicitou uma solução via banco de dados para evitar deploys imediatos de lógica complexa.

### Ações Realizadas:
- **Migração de Banco de Dados**:
    - Adicionada a coluna `is_test` (default false) às tabelas `migma_payments` e `migma_checkout_zelle_pending`.
    - Atualizados todos os registros existentes com prefixo `MIG-` na tabela `visa_orders` para `is_test = true`. Como o código de produção já filtra `visa_orders` por `is_test = false`, estes registros foram ocultados instantaneamente.
    - Marcados os registros das novas tabelas `migma_` como teste para referência futura.
- **Atualização de Código (Branch de Produção)**:
    - Re-implementada a lógica de filtro `.eq('is_test', false)` nos componentes `ZelleApprovalPage.tsx` e `SellerZelleApprovalPage.tsx` após troca de branch pelo usuário.
    - O filtro é aplicado apenas quando **não** estamos em ambiente local (`!isLocal`), permitindo que desenvolvedores continuem vendo os dados de teste em `localhost`.
    - Esta branch agora está pronta para deploy seguro, garantindo que os dados de teste sejam ocultados no dashboard administrativo oficial.

### Próximos Passos:
- Realizar deploy dos componentes de Zelle para consolidar a ocultação completa no dashboard administrativo.
- Validar o fluxo de Webhook para pagamentos reais de Matrícula.

