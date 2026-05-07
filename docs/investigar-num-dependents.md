# Investigação — num_dependents não chegando ao MatriculaUSA

## Problema
Aluno `achucha5857@uorak.com` tem 4 dependentes na Migma,
mas o sync enviou `dependents: 0` para o MatriculaUSA.

O log confirma:
```
[SYNC-732921] 👨‍👩‍👧 Dependentes: 0 | Application Fee calculada: $350
```

O campo `profile.num_dependents` estava `null` ou `0` no banco.

---

## Queries para rodar no Supabase da Migma

### 1. Confirmar o valor atual em user_profiles
```sql
SELECT id, email, num_dependents, service_type, student_process_type
FROM user_profiles
WHERE email = 'achucha5857@uorak.com';
```
**Esperado:** `num_dependents = 4`
**Se vier `null` ou `0`:** o campo não foi salvo no checkout

---

### 2. Verificar se o dado está em individual_fee_payments
```sql
SELECT user_id, fee_type, amount, payment_method, created_at
FROM individual_fee_payments
WHERE user_id = (
  SELECT user_id FROM user_profiles WHERE email = 'achucha5857@uorak.com'
)
ORDER BY created_at DESC;
```
O `amount` do pagamento deveria refletir os dependentes
(ex: 4 dep = $400 + 4×$150 = $1000).
Se o amount bater com dependentes, o problema é só na coluna `num_dependents`.

---

### 3. Verificar se está em visa_orders
```sql
SELECT number_of_dependents, total_price_usd, client_email
FROM visa_orders
WHERE client_email = 'achucha5857@uorak.com'
ORDER BY created_at DESC
LIMIT 1;
```

---

### 4. Verificar migma-create-student — o campo é salvo lá?
A função `migma-create-student` recebe `num_dependents` e deve salvar em `user_profiles`.
Checar se o upsert inclui esse campo:

```sql
-- Ver o valor que chegou no momento do cadastro
SELECT id, user_id, email, num_dependents, total_price_usd, created_at
FROM user_profiles
WHERE email = 'achucha5857@uorak.com';
```

---

## Causa provável
O campo `num_dependents` **não está sendo salvo** em `user_profiles` 
pelo fluxo do MigmaCheckout. O aluno seleciona os dependentes no Step 1,
mas o valor pode não estar chegando até a coluna no banco.

Verificar em `migma-create-student/index.ts`:
- O payload recebe `num_dependents`?
- O upsert em `user_profiles` inclui `num_dependents`?

---

## Fix provável no sync (fallback)
Se `num_dependents` não estiver em `user_profiles`, podemos inferir
a partir do `total_price_usd` pago na selection process fee:

```
num_dependents = (total_price_usd - 400) / 150
```

Ex: $1000 pago → (1000 - 400) / 150 = 4 dependentes

Isso seria um fallback de emergência — o correto é corrigir a origem.
