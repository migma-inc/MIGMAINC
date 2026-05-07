# Checklist de Deploy — Split Payment MigmaCheckout

## 1. Aplicar a Migration (OBRIGATÓRIO PRIMEIRO)

**Opção A — Via Supabase CLI (recomendado):**
```bash
supabase db push
```

**Opção B — Via Dashboard (SQL Editor):**
Abrir `supabase/migrations/20260415000000_add_migma_split_support.sql` e executar no Dashboard → SQL Editor.

> ⚠️ A migration DEVE rodar antes do deploy das functions.
> Se a tabela `split_payments` não tiver as novas colunas, a nova function vai crashar ao tentar inserir `migma_user_id` e `source`.

---

## 2. Verificar RLS na tabela `split_payments`

Executar no SQL Editor do Dashboard para garantir que RLS está ativo:

```sql
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname = 'split_payments';
```

Se `relrowsecurity = false`, habilitar:
```sql
ALTER TABLE split_payments ENABLE ROW LEVEL SECURITY;
```

> A migration já cria a policy `"Students can read own migma split"`, mas ela só funciona se RLS estiver ativo.

---

## 3. Deploy das Edge Functions

Executar na raiz do projeto (onde está o `supabase/` folder):

```bash
# Nova function (criar do zero)
supabase functions deploy migma-split-parcelow-checkout

# Functions modificadas
supabase functions deploy migma-parcelow-checkout
supabase functions deploy parcelow-webhook
```

**Ou deployar todas de uma vez:**
```bash
supabase functions deploy
```

---

## 4. Verificar Secrets das Edge Functions

A nova function `migma-split-parcelow-checkout` usa os mesmos secrets das outras. Confirmar que estão setados:

```bash
supabase secrets list
```

Deve conter (pelo menos um de cada par):
- `PARCELOW_CLIENT_ID_STAGING` ou `PARCELOW_CLIENT_ID`
- `PARCELOW_CLIENT_SECRET_STAGING` ou `PARCELOW_CLIENT_SECRET`
- `PARCELOW_CLIENT_ID_PRODUCTION` ou `PARCELOW_CLIENT_ID`
- `PARCELOW_CLIENT_SECRET_PRODUCTION` ou `PARCELOW_CLIENT_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

> Secrets são herdados automaticamente pelas novas functions — nenhum novo secret é necessário.

---

## 5. Verificar Constraint `unique_order_split`

A tabela tem `CONSTRAINT unique_order_split UNIQUE (order_id)`.  
Em PostgreSQL, `NULL` não viola `UNIQUE` — múltiplos rows com `order_id = NULL` são permitidos (cada NULL é distinto). **Nenhuma ação necessária.**

---

## 6. Teste de Smoke (após deploy)

### Testar a nova function diretamente:
```bash
curl -X POST \
  'https://<SEU_PROJECT_ID>.supabase.co/functions/v1/migma-split-parcelow-checkout' \
  -H 'Authorization: Bearer <ANON_KEY>' \
  -H 'Content-Type: application/json' \
  -d '{
    "user_id": "<UUID_TESTE>",
    "order_id": "TEST-SPLIT-001",
    "email": "teste@migma.com",
    "full_name": "Teste Split",
    "cpf": "11144477735",
    "service_type": "transfer",
    "total_amount": 400,
    "part1_amount": 200,
    "part1_method": "card",
    "part2_amount": 200,
    "part2_method": "pix",
    "origin": "http://localhost:5173"
  }'
```

**Resposta esperada:**
```json
{
  "success": true,
  "split_payment_id": "<uuid>",
  "part1_checkout_url": "https://sandbox-2.parcelow.com.br/...",
  "part2_checkout_url": "https://sandbox-2.parcelow.com.br/..."
}
```

### Verificar no banco que o registro foi criado:
```sql
SELECT id, source, migma_user_id, migma_service_type, overall_status,
       part1_amount_usd, part1_payment_method,
       part2_amount_usd, part2_payment_method
FROM split_payments
WHERE source = 'migma'
ORDER BY created_at DESC
LIMIT 5;
```

---

## 7. Verificar Webhook URL (sem mudança necessária)

A URL do webhook Parcelow não mudou:
```
https://<PROJECT_ID>.supabase.co/functions/v1/parcelow-webhook
```

Confirmar no Dashboard da Parcelow (sandbox e produção) que essa URL está registrada como `notify_url`.

---

## Ordem Resumida

| # | Ação | Onde |
|---|---|---|
| 1 | `supabase db push` | Terminal |
| 2 | Verificar/habilitar RLS em `split_payments` | Dashboard → SQL Editor |
| 3 | `supabase functions deploy migma-split-parcelow-checkout` | Terminal |
| 4 | `supabase functions deploy migma-parcelow-checkout` | Terminal |
| 5 | `supabase functions deploy parcelow-webhook` | Terminal |
| 6 | Smoke test via curl | Terminal |
| 7 | Verificar registro no banco | Dashboard → Table Editor |
