# Configuração do n8n para Supabase

## ⚠️ IMPORTANTE: Credenciais do Supabase no n8n

O n8n precisa usar a **service_role key** (não a anon key) para inserir registros na tabela `migma_payments`.

## Como Obter a Service Role Key

1. Acesse o **Supabase Dashboard**
2. Vá em **Settings** → **API**
3. Na seção **Project API keys**, encontre a **`service_role`** key
4. **⚠️ ATENÇÃO**: Esta key tem acesso total ao banco de dados. Mantenha-a segura!

## Configuração no n8n

### No Node do Supabase no n8n:

1. **Resource**: `Row`
2. **Operation**: `Create`
3. **Table**: `migma_payments`
4. **Credential Type**: `Supabase API`
5. **Credential Settings**:
   - **Host**: `https://[seu-project-ref].supabase.co`
   - **Service Role Secret**: Use a **service_role key** (não a anon key)

### Campos da Tabela `migma_payments`

A tabela tem os seguintes campos:

- `user_id` (text, obrigatório) - ID do usuário
- `fee_type_global` (text, obrigatório) - Tipo de taxa (product_slug)
- `amount` (numeric, opcional) - Valor do pagamento
- `confirmation_code` (text, opcional) - Código de confirmação do pagamento

### Exemplo de Payload no n8n

```json
{
  "user_id": "{{ $json.user_id }}",
  "fee_type_global": "{{ $json.fee_type }}",
  "amount": "{{ $json.value }}",
  "confirmation_code": "{{ $json.confirmation_code }}"
}
```

## Políticas RLS Configuradas

As seguintes políticas RLS foram criadas para a tabela `migma_payments`:

1. **Service role can manage migma_payments**
   - Permite que `service_role` faça todas as operações (INSERT, UPDATE, DELETE, SELECT)
   - Esta é a política que o n8n deve usar

2. **Users can read their own payments**
   - Permite que usuários autenticados leiam seus próprios pagamentos
   - Usa `auth.uid()::text = user_id`

## Troubleshooting

### Erro: "new row violates row-level security policy"

**Causa**: O n8n está usando a **anon key** ao invés da **service_role key**.

**Solução**:
1. Verifique se a credencial do Supabase no n8n está usando a **service_role key**
2. Se estiver usando anon key, crie uma nova credencial com a service_role key
3. Atualize o node do Supabase para usar a nova credencial

### Como Verificar Qual Key Está Sendo Usada

No n8n, verifique a credencial do Supabase:
- Se a key começa com `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` e tem permissões limitadas → É a **anon key**
- Se a key tem acesso total e é mais longa → É a **service_role key**

## Segurança

⚠️ **IMPORTANTE**: A service_role key tem acesso total ao banco de dados e **NUNCA** deve ser exposta no frontend ou em código público. Use apenas no n8n ou em Edge Functions do Supabase.
