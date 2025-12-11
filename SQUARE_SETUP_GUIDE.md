# 🔑 Guia de Configuração Square - MIGMA

## 📋 Credenciais Necessárias do Square

Para integrar o Square no projeto MIGMA, você precisa das seguintes **4 credenciais principais**:

### **1. Application ID** (Público)
- **O que é:** Identifica sua aplicação no Square
- **Formato:** Começa com `sandbox-` (teste) ou `sq0idp-` (produção)
- **Onde usar:** Frontend (pode ser público)
- **Exemplo:** `sandbox-sq0idb-ABC123...` ou `sq0idp-XYZ789...`

### **2. Access Token** (Secreto) ⚠️
- **O que é:** Token de autenticação para chamadas à API
- **Formato:** Começa com `EAAA` (sandbox) ou `EAAAB` (produção)
- **Onde usar:** Backend apenas (NUNCA expor no frontend)
- **Exemplo:** `EAAA...` ou `EAAAB...`

### **3. Location ID** (Público)
- **O que é:** ID da localização física/virtual onde ocorrem as transações
- **Formato:** String alfanumérica
- **Onde usar:** Frontend e Backend
- **Exemplo:** `L8XK5P2N3M4Q1

### **4. Environment** (Configuração)
- **O que é:** Ambiente (Sandbox para teste, Production para produção)
- **Valores:** `sandbox` ou `production`
- **Onde usar:** Backend

---

## 🔐 Como Obter as Credenciais

### **Passo 1: Criar Conta no Square**

1. Acesse: https://squareup.com
2. Clique em **"Sign Up"** ou **"Get Started"**
3. Complete o cadastro da empresa MIGMA
4. Complete a verificação de identidade (necessário para aceitar pagamentos)

### **Passo 2: Acessar o Developer Dashboard**

1. Acesse: https://developer.squareup.com/apps
2. Faça login com a conta da MIGMA
3. Você verá o dashboard de desenvolvedor

### **Passo 3: Criar uma Aplicação**

1. Clique em **"Create Application"** ou **"New Application"**
2. Preencha:
   - **Application Name:** `MIGMA Visa Services`
   - **Description:** `Payment processing for visa services`
3. Clique em **"Create Application"**

### **Passo 4: Obter Application ID e Access Token**

1. Na página da aplicação criada, você verá duas abas:
   - **Sandbox** (para testes)
   - **Production** (para produção)

2. **Para Sandbox (Teste):**
   - Clique na aba **"Sandbox"**
   - Você verá:
     - **Application ID:** `sandbox-sq0idb-...` ← Copie isso
     - **Access Token:** `EAAA...` ← Clique em **"Show"** e copie

3. **Para Production:**
   - Clique na aba **"Production"**
   - Você verá:
     - **Application ID:** `sq0idp-...` ← Copie isso
     - **Access Token:** `EAAAB...` ← Clique em **"Show"** e copie

### **Passo 5: Obter Location ID**

1. No menu lateral, clique em **"Locations"**
2. Você verá uma lista de locais
3. Se não houver local, crie um:
   - Clique em **"Add Location"**
   - Preencha os dados da MIGMA
   - Salve
4. Copie o **Location ID** do local desejado
   - Formato: `L8XK5P2N3M4Q1` (alfanumérico)

---

## ⚙️ Configuração no Supabase

### **Acessar Configurações**

1. Acesse: **Supabase Dashboard**
2. Vá em: **Project Settings** → **Edge Functions** → **Secrets**

### **Variáveis de Ambiente para TESTE (Sandbox)**

Adicione as seguintes variáveis:

```bash
# Square Sandbox (Teste)
SQUARE_APPLICATION_ID_TEST=sandbox-sq0idb-ABC123...
SQUARE_ACCESS_TOKEN_TEST=EAAA...
SQUARE_LOCATION_ID_TEST=L8XK5P2N3M4Q1
SQUARE_ENVIRONMENT_TEST=sandbox
```

### **Variáveis de Ambiente para PRODUÇÃO**

Adicione as seguintes variáveis:

```bash
# Square Production
SQUARE_APPLICATION_ID_PROD=sq0idp-XYZ789...
SQUARE_ACCESS_TOKEN_PROD=EAAAB...
SQUARE_LOCATION_ID_PROD=L8XK5P2N3M4Q1
SQUARE_ENVIRONMENT_PROD=production
```

### **Variáveis Adicionais (Opcional)**

```bash
# URL do site (já deve existir)
SITE_URL=https://migma.com

# Webhook Secret (será obtido após configurar webhook)
SQUARE_WEBHOOK_SIGNATURE_KEY=...
```

---

## 📝 Resumo das Credenciais Necessárias

### **Para TESTE (Sandbox):**
| Credencial | Variável de Ambiente | Onde Obter |
|-----------|---------------------|------------|
| Application ID | `SQUARE_APPLICATION_ID_TEST` | Developer Dashboard → App → Sandbox |
| Access Token | `SQUARE_ACCESS_TOKEN_TEST` | Developer Dashboard → App → Sandbox → Show |
| Location ID | `SQUARE_LOCATION_ID_TEST` | Developer Dashboard → Locations |
| Environment | `SQUARE_ENVIRONMENT_TEST` | `sandbox` (fixo) |

### **Para PRODUÇÃO:**
| Credencial | Variável de Ambiente | Onde Obter |
|-----------|---------------------|------------|
| Application ID | `SQUARE_APPLICATION_ID_PROD` | Developer Dashboard → App → Production |
| Access Token | `SQUARE_ACCESS_TOKEN_PROD` | Developer Dashboard → App → Production → Show |
| Location ID | `SQUARE_LOCATION_ID_PROD` | Developer Dashboard → Locations |
| Environment | `SQUARE_ENVIRONMENT_PROD` | `production` (fixo) |

---

## 🔒 Segurança das Credenciais

### **⚠️ NUNCA Expor no Frontend:**
- ❌ `SQUARE_ACCESS_TOKEN_*` (secreto)
- ✅ `SQUARE_APPLICATION_ID_*` (pode ser público)
- ✅ `SQUARE_LOCATION_ID_*` (pode ser público)

### **✅ Sempre Usar no Backend:**
- ✅ Todas as credenciais devem ser usadas apenas em Edge Functions
- ✅ Nunca enviar Access Token para o frontend
- ✅ Usar variáveis de ambiente do Supabase

---

## 🧪 Testar as Credenciais

Após configurar, você pode testar fazendo uma chamada simples à API do Square:

```typescript
// Teste básico (não usar em produção)
const response = await fetch('https://connect.squareup.com/v2/locations', {
  headers: {
    'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN_TEST}`,
    'Square-Version': '2024-01-18',
  },
});

const data = await response.json();
console.log('Locations:', data);
```

Se retornar uma lista de locations, as credenciais estão corretas! ✅

---

## 📋 Checklist de Configuração

- [ ] Conta criada no Square
- [ ] Aplicação criada no Developer Dashboard
- [ ] **Application ID (Sandbox)** copiado
- [ ] **Access Token (Sandbox)** copiado
- [ ] **Location ID** copiado
- [ ] Variáveis de TESTE configuradas no Supabase
- [ ] **Application ID (Production)** copiado
- [ ] **Access Token (Production)** copiado
- [ ] Variáveis de PRODUÇÃO configuradas no Supabase
- [ ] Credenciais testadas (chamada de teste funcionando)

---

## 🔗 Links Úteis

- **Square Developer Dashboard:** https://developer.squareup.com/apps
- **Square API Docs:** https://developer.squareup.com/reference/square
- **Square Payments API:** https://developer.squareup.com/docs/payments-api/overview
- **Square Webhooks:** https://developer.squareup.com/docs/webhooks/overview

---

## ❓ Próximos Passos

Após obter todas as credenciais e configurar no Supabase:

1. ✅ **Implementar Edge Functions do Square** (similar ao Stripe)
2. ✅ **Atualizar frontend** para usar Square.js
3. ✅ **Configurar webhooks** do Square
4. ✅ **Testar integração completa**

---

**Última atualização:** 2025-01-15

