# Pergunta ao MatriculaUSA — Fluxo de Insert do Pagamento Zelle

> **Contexto:** Estamos integrando o fluxo de Zelle da *Application Fee* da Migma com o dashboard admin do MatriculaUSA. Fizemos o primeiro teste end-to-end e o comprovante **passou pelo n8n** corretamente, mas **não apareceu na página de aprovação** do admin do MatriculaUSA. Isso nos fez questionar como o insert em `zelle_payments` acontece no fluxo nativo de vocês.

---

## Nossa Hipótese

Analisando o código do MatriculaUSA, encontramos a edge function `create-zelle-payment`. O fluxo dela parece ser:

1. **Insert direto:** Chama `supabase.rpc('create_zelle_payment', rpcParams)` → cria o registro em `zelle_payments` **imediatamente**, com `screenshot_url` e `status: 'pending_verification'`
2. **N8n em background:** *Depois* do insert, envia o payload para `https://nwh.suaiden.com/webhook/zelle-global` via `EdgeRuntime.waitUntil()` (fire and forget)
3. **N8n complementa:** O n8n processa a validação e chama de volta `validate-zelle-payment-result` para atualizar o status

Ou seja: **o registro já existe em `zelle_payments` antes do n8n sequer ser chamado.** O n8n é só validação/complemento, não é quem cria o registro.

**Isso está correto?**

---

## O que fizemos na Migma (e por que não funcionou)

No nosso fluxo atual, a Migma faz:

1. Upload do comprovante → Migma Storage
2. Insert em `application_fee_zelle_pending` (tabela local da Migma)
3. POST para `https://nwh.suaiden.com/webhook/zelle-global` com os dados do pagamento

O problema: **só mandamos para o n8n, mas não fizemos insert direto em `zelle_payments` do MatriculaUSA.** O n8n recebeu, mas provavelmente não criou o registro em `zelle_payments` (ou criou sem os campos necessários para aparecer no dashboard).

---

## Perguntas

### 1. Confirmação do fluxo
O fluxo é realmente: **insert direto em `zelle_payments` → n8n em background**? Ou o n8n é quem faz o insert?

### 2. RPC `create_zelle_payment`
Qual a assinatura completa do RPC `create_zelle_payment`? Especificamente:
- `p_user_id` aceita `null`? (alunos da Migma não têm conta no MatriculaUSA)
- `p_fee_type` aceita `'application_fee_migma'` ou precisa ser um dos tipos existentes?
- `p_metadata` é armazenado diretamente em `zelle_payments.metadata`?

### 3. Como chamar `create-zelle-payment` para aluno externo
A edge function `create-zelle-payment` exige um Bearer token de usuário autenticado no MatriculaUSA:
```typescript
const { data: { user }, error: authError } = await supabase.auth.getUser(token);
if (authError || !user) return corsResponse({ error: 'Invalid token' }, 401);
```
Como podemos chamar ela para um aluno que não tem conta no MatriculaUSA? Opções que vemos:
- Usar `target_user_id` com um token de service role
- Criar um usuário "fantasma" no MatriculaUSA para alunos da Migma
- Criar uma nova rota/endpoint que aceite o `x-migma-webhook-secret` no lugar do Bearer token
- Inserir direto via RPC autenticado com service key

Qual vocês recomendam?

### 4. O que o n8n `zelle-global` faz com o payload
Quando o n8n recebe o payload, ele:
- (a) Cria um novo registro em `zelle_payments`?
- (b) Atualiza um registro existente (usando `payment_id` do payload)?
- (c) Só valida e chama o callback?

Se for (a), então precisamos garantir que o payload tenha todos os campos que o n8n espera para criar o registro corretamente (incluindo `fee_type_global`, `metadata` com os IDs da Migma, etc.).

---

## Nossa Proposta

Com base na hipótese acima, a solução mais limpa seria:

**Migma chama dois endpoints em sequência:**

```
1. POST → MatriculaUSA create-zelle-payment (ou endpoint equivalente)
         → Cria registro em zelle_payments com fee_type_global='application_fee_migma' e metadata da Migma
         → Retorna payment_id

2. POST → https://nwh.suaiden.com/webhook/zelle-global
         → Passa payment_id retornado no passo 1
         → N8n complementa/valida como de costume
```

Para isso funcionar sem autenticação de usuário MatriculaUSA, precisamos que vocês criem (ou nos indiquem) um endpoint que aceite o `x-migma-webhook-secret` para autenticar a chamada da Migma.

**Alternativamente:** vocês poderiam nos passar um service role key restrito (ou anon key com policy adequada) para que a Migma insira diretamente em `zelle_payments` via Supabase client, sem precisar de um endpoint intermediário.

---

## O que precisamos de vocês

1. **Confirmar o fluxo** (insert direto vs n8n cria o registro)
2. **Indicar como a Migma deve fazer o insert em `zelle_payments`** para o caso de aluno externo (sem conta MatriculaUSA)
3. **Confirmar se o n8n armazena `fee_type_global` e `metadata`** quando recebe o payload (ou se ignora campos extras)
