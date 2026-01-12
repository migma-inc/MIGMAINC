# 🔐 Erro: Token Inválido (401) - Wise API

**Data**: 2026-01-12  
**Erro**: `invalid_token` - Wise API error: 401

---

## 🔍 DIAGNÓSTICO

O erro indica que o `WISE_PERSONAL_TOKEN` configurado no Supabase está **inválido ou incorreto**.

**Erro nos logs**:
```
[Wise API] ❌ Error response: {"error":"invalid_token","error_description":"Invalid token"}
[Wise API] Response status: 401 Unauthorized
```

---

## ✅ SOLUÇÕES

### 1. Verificar se o Token foi Copiado Completamente

**Problema comum**: Token foi cortado ou não copiado completamente.

**Solução**:
1. Acesse: https://wise.com
2. Faça login na conta
3. Vá em: **Your Account** > **Integrations and Tools** > **API tokens**
4. Se já existe um token, **delete-o** e crie um novo
5. **Copie o token COMPLETO** (geralmente é uma string longa)
6. Cole no Supabase Dashboard **sem espaços antes ou depois**

---

### 2. Verificar Ambiente (Sandbox vs Production)

**IMPORTANTE**: O token deve corresponder ao ambiente configurado!

**Verificar**:
- Se `WISE_ENVIRONMENT=sandbox` → Use token do **sandbox**
- Se `WISE_ENVIRONMENT=production` → Use token do **production**

**Como obter token do sandbox**:
1. Acesse: https://sandbox.transferwise.com (ou sandbox.wise.com)
2. Faça login na conta sandbox
3. Vá em: **Your Account** > **Integrations and Tools** > **API tokens**
4. Crie um novo token

**Como obter token do production**:
1. Acesse: https://wise.com
2. Faça login na conta production
3. Vá em: **Your Account** > **Integrations and Tools** > **API tokens**
4. Crie um novo token

---

### 3. Verificar se há Espaços ou Caracteres Extras

**Problema comum**: Espaços antes ou depois do token.

**Solução**:
1. No Supabase Dashboard, edite a variável `WISE_PERSONAL_TOKEN`
2. **Selecione todo o conteúdo** e delete
3. Cole o token novamente **sem espaços**
4. Verifique se não há quebras de linha

---

### 4. Verificar se o Token Está Ativo

**Problema comum**: Token foi revogado ou expirado.

**Solução**:
1. Acesse a conta Wise
2. Vá em: **Integrations and Tools** > **API tokens**
3. Verifique se o token está **ativo**
4. Se não estiver, crie um novo

---

### 5. Verificar Formato do Token

**Formato esperado**: O token geralmente é uma string longa, sem espaços.

**Exemplo de formato** (não use este, é apenas exemplo):
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

**NÃO deve ter**:
- Espaços
- Quebras de linha
- Caracteres especiais (exceto letras e números)
- Aspas ou parênteses

---

## 🔧 PASSOS PARA CORRIGIR

### Passo 1: Obter Novo Token

1. **Acesse a conta Wise** (sandbox ou production, conforme `WISE_ENVIRONMENT`)
2. Vá em: **Your Account** > **Integrations and Tools** > **API tokens**
3. **Delete o token antigo** (se existir)
4. Clique em **"Add new Token"** ou **"Create Token"**
5. **Copie o token imediatamente** (só aparece uma vez!)

### Passo 2: Configurar no Supabase

1. Acesse: Supabase Dashboard > **Project Settings** > **Edge Functions** > **Secrets**
2. Encontre `WISE_PERSONAL_TOKEN`
3. Clique em **"Edit"** ou **"Update"**
4. **Delete todo o conteúdo** atual
5. **Cole o novo token** (sem espaços)
6. Clique em **"Save"**

### Passo 3: Verificar Ambiente

Certifique-se de que `WISE_ENVIRONMENT` corresponde ao token:
- Token do sandbox → `WISE_ENVIRONMENT=sandbox`
- Token do production → `WISE_ENVIRONMENT=production`

### Passo 4: Testar Novamente

1. Tente criar um checkout Wise novamente
2. Verifique os logs no Supabase Dashboard
3. Deve aparecer: `✅ Profile ID fetched from API: [número]`

---

## 📋 CHECKLIST DE VERIFICAÇÃO

- [ ] Token foi copiado **completamente** (sem cortes)
- [ ] Token corresponde ao ambiente (`sandbox` ou `production`)
- [ ] Não há **espaços** antes ou depois do token
- [ ] Não há **quebras de linha** no token
- [ ] Token está **ativo** na conta Wise
- [ ] Token foi configurado corretamente no Supabase Dashboard

---

## ⚠️ OBSERVAÇÕES IMPORTANTES

### Sandbox vs Production

**Sandbox**:
- URL: `https://api.wise-sandbox.com`
- Use para testes
- Tokens são separados do production

**Production**:
- URL: `https://api.wise.com`
- Use para pagamentos reais
- Tokens são separados do sandbox

**IMPORTANTE**: Um token do sandbox **não funciona** no production e vice-versa!

---

## 🔍 LOGS ESPERADOS (Após Corrigir)

Se o token estiver correto, você deve ver:

```
[Wise Checkout] 📋 Step 7: Getting Wise profile ID...
[Wise Checkout] Profile ID not configured, fetching from API...
[Wise API] GET https://api.wise-sandbox.com/v1/profiles
[Wise API] Response status: 200 OK
[Wise Checkout] ✅ Profile ID fetched from API: [número]
```

---

## ❌ SE AINDA DER ERRO

Se após seguir todos os passos ainda der erro 401:

1. **Verifique se está usando a conta correta**:
   - Sandbox: https://sandbox.transferwise.com
   - Production: https://wise.com

2. **Verifique se o token tem permissões corretas**:
   - O token precisa ter permissão para acessar `/v1/profiles`
   - Alguns tokens podem ter permissões limitadas

3. **Tente criar um novo token**:
   - Delete o token antigo
   - Crie um novo token
   - Configure novamente no Supabase

4. **Verifique se há problemas na conta Wise**:
   - A conta pode estar suspensa ou com problemas
   - Entre em contato com o suporte da Wise se necessário

---

**Última atualização**: 2026-01-12
