# 🔍 Debug: Token Ainda Inválido Após Mudar para Production

**Data**: 2026-01-12  
**Status**: Ambiente correto, mas token ainda inválido

---

## 🔍 ANÁLISE DOS LOGS

**O que está correto**:
- ✅ `Environment: production` - Ambiente correto
- ✅ `GET https://api.wise.com/v1/profiles` - URL correta
- ✅ Todas as outras variáveis estão configuradas

**O que está errado**:
- ❌ `{"error_description":"Invalid token","error":"invalid_token"}` - Token inválido

---

## 🔧 POSSÍVEIS CAUSAS

### 1. Token Não Foi Copiado Completamente

**Sintoma**: Token foi cortado ao copiar

**Solução**:
1. Acesse: https://wise.com
2. Vá em: **Your Account** > **Integrations and Tools** > **API tokens**
3. Se o token não está mais visível, **delete-o** e crie um novo
4. **Copie o token COMPLETO** (geralmente é uma string bem longa)
5. Cole no Supabase **sem espaços**

---

### 2. Há Espaços ou Caracteres Extras no Token

**Sintoma**: Token tem espaços antes/depois ou quebras de linha

**Solução**:
1. No Supabase Dashboard, edite `WISE_PERSONAL_TOKEN`
2. **Selecione TODO o conteúdo** (Ctrl+A)
3. **Delete tudo**
4. Cole o token novamente **sem espaços**
5. Verifique que não há quebras de linha
6. Salve

---

### 3. Token Foi Revogado ou Expirado

**Sintoma**: Token estava funcionando antes mas agora não funciona

**Solução**:
1. Acesse: https://wise.com
2. Vá em: **Integrations and Tools** > **API tokens**
3. Verifique se o token está **ativo**
4. Se não estiver ou estiver expirado, **crie um novo**

---

### 4. Token Não Tem Permissões Corretas

**Sintoma**: Token existe mas não consegue acessar `/v1/profiles`

**Solução**:
1. Verifique se o token tem permissões para acessar a API
2. Alguns tokens podem ter permissões limitadas
3. Tente criar um novo token com **todas as permissões**

---

### 5. Token Está Incorreto

**Sintoma**: Token foi digitado incorretamente

**Solução**:
1. **Delete o token atual** no Supabase
2. Obtenha um **novo token** da conta Wise
3. Configure novamente no Supabase
4. Teste novamente

---

## ✅ PASSOS PARA RESOLVER

### Passo 1: Verificar Token na Conta Wise

1. Acesse: https://wise.com
2. Faça login
3. Vá em: **Your Account** > **Integrations and Tools** > **API tokens**
4. Verifique se o token está **ativo**
5. Se não estiver visível, você precisa criar um novo

### Passo 2: Criar Novo Token (Se Necessário)

1. Na página de API tokens, clique em **"Add new Token"** ou **"Create Token"**
2. Dê um nome descritivo (ex: "Migma Integration")
3. **Copie o token imediatamente** (só aparece uma vez!)
4. **IMPORTANTE**: Copie o token COMPLETO, sem cortar

### Passo 3: Configurar no Supabase

1. Acesse: Supabase Dashboard > **Project Settings** > **Edge Functions** > **Secrets**
2. Encontre `WISE_PERSONAL_TOKEN`
3. Clique em **"Edit"** ou **"Update"**
4. **Selecione TODO o conteúdo** (Ctrl+A)
5. **Delete tudo**
6. **Cole o novo token** (sem espaços antes ou depois)
7. Verifique que não há quebras de linha
8. Clique em **"Save"**

### Passo 4: Verificar Formato do Token

O token deve ser:
- ✅ Uma string longa (geralmente 40+ caracteres)
- ✅ Apenas letras e números (sem espaços)
- ✅ Sem caracteres especiais (exceto letras e números)
- ✅ Sem quebras de linha

**Exemplo de formato** (não use este, é apenas exemplo):
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

### Passo 5: Testar Novamente

1. Tente criar um checkout Wise novamente
2. Verifique os logs no Supabase Dashboard
3. Deve aparecer: `✅ Profile ID fetched from API: [número]`

---

## 🔍 VERIFICAÇÃO ADICIONAL

### Verificar se o Token Está Sendo Lido Corretamente

O código loga apenas os primeiros 10 caracteres do token por segurança. Se quiser verificar se está sendo lido:

1. Nos logs, procure por: `[Wise API] GET https://api.wise.com/v1/profiles`
2. O token está sendo usado (mas não aparece completo por segurança)

### Verificar Permissões do Token

Alguns tokens podem ter permissões limitadas. Certifique-se de que o token tem permissão para:
- ✅ Acessar `/v1/profiles`
- ✅ Criar quotes (`/v3/profiles/{profileId}/quotes`)
- ✅ Criar recipients (`/v1/accounts`)
- ✅ Criar transfers (`/v1/transfers`)

---

## 📋 CHECKLIST COMPLETO

- [ ] Token foi copiado **completamente** (sem cortes)
- [ ] Não há **espaços** antes ou depois do token
- [ ] Não há **quebras de linha** no token
- [ ] Token está **ativo** na conta Wise
- [ ] Token foi criado em **wise.com** (produção)
- [ ] `WISE_ENVIRONMENT=production` está configurado
- [ ] Token tem **permissões corretas**
- [ ] Token foi configurado corretamente no Supabase

---

## ❌ SE AINDA DER ERRO

Se após seguir todos os passos ainda der erro 401:

1. **Tente criar um token completamente novo**:
   - Delete o token antigo na conta Wise
   - Crie um novo token
   - Configure no Supabase

2. **Verifique se a conta Wise está ativa**:
   - A conta pode estar suspensa ou com problemas
   - Entre em contato com o suporte da Wise se necessário

3. **Verifique se há problemas de rede/firewall**:
   - A Edge Function precisa conseguir acessar `https://api.wise.com`
   - Verifique se não há bloqueios

4. **Entre em contato com o suporte da Wise**:
   - Pode haver um problema com a conta ou com os tokens
   - O suporte pode ajudar a diagnosticar

---

## 🔍 LOGS ESPERADOS (Quando Funcionar)

Se o token estiver correto, você deve ver:

```
[Wise Checkout] Environment: production
[Wise Checkout] 📋 Step 7: Getting Wise profile ID...
[Wise Checkout] Profile ID not configured, fetching from API...
[Wise API] GET https://api.wise.com/v1/profiles
[Wise API] Response status: 200 OK
[Wise API] ✅ Success response: [{"id": 12345678, ...}]
[Wise Checkout] ✅ Profile ID fetched from API: 12345678
```

---

**Última atualização**: 2026-01-12
