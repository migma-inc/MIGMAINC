# 🔐 Variáveis de Ambiente - Integração Wise

## 📋 Lista Completa de Variáveis Necessárias

### ✅ OBRIGATÓRIAS (Sistema não funciona sem elas)

#### 1. Autenticação Wise API

| Variável | Descrição | Onde Obter |
|----------|-----------|------------|
| `WISE_PERSONAL_TOKEN` | Token de autenticação da API Wise | **Your Account** > **Integrations and Tools** > **API tokens** > **Add new Token** |
| `WISE_ENVIRONMENT` | Ambiente: `sandbox` ou `production` | Definir manualmente (recomendado: `sandbox` para testes) |

#### 2. Webhook Wise

| Variável | Descrição | Onde Obter |
|----------|-----------|------------|
| `WISE_WEBHOOK_SECRET` | Secret para verificar assinatura dos webhooks | Configurado na conta Wise ao criar o webhook |

#### 3. Dados Bancários da Migma (Recipient)

**IMPORTANTE**: Esses são os dados da conta da MIGMA que RECEBE os pagamentos.

| Variável | Descrição | Onde Obter | Obrigatória se |
|----------|-----------|------------|----------------|
| `WISE_MIGMA_ACCOUNT_HOLDER_NAME` | Nome do titular da conta | Dados bancários da Migma | Sempre (default: "Migma Inc") |
| `WISE_MIGMA_CURRENCY` | Moeda da conta (ex: USD, EUR) | Dados bancários da Migma | Sempre (default: "USD") |
| `WISE_MIGMA_ACCOUNT_TYPE` | Tipo de conta: `aba`, `iban`, `swift`, `sort_code` | Dados bancários da Migma | Sempre (default: "aba") |
| `WISE_MIGMA_LEGAL_TYPE` | Tipo legal: `PRIVATE` ou `BUSINESS` | Dados bancários da Migma | Sempre (default: "BUSINESS") |
| `WISE_MIGMA_ABA` | Número ABA (routing number) | Dados bancários da Migma | **Se `ACCOUNT_TYPE = aba`** |
| `WISE_MIGMA_ACCOUNT_NUMBER` | Número da conta bancária | Dados bancários da Migma | **Se `ACCOUNT_TYPE = aba`** |
| `WISE_MIGMA_SWIFT` | Código SWIFT | Dados bancários da Migma | **Se `ACCOUNT_TYPE = swift`** |
| `WISE_MIGMA_IBAN` | Código IBAN | Dados bancários da Migma | **Se `ACCOUNT_TYPE = iban`** |
| `WISE_MIGMA_SORT_CODE` | Sort Code | Dados bancários da Migma | **Se `ACCOUNT_TYPE = sort_code`** |

**Campos Adicionais (Opcionais mas Recomendados):**

| Variável | Descrição | Onde Obter | Obrigatória se |
|----------|-----------|------------|----------------|
| `WISE_MIGMA_BANK_NAME` | Nome do banco | Dados bancários da Migma | Opcional |
| `WISE_MIGMA_BANK_ADDRESS` | Endereço do banco | Dados bancários da Migma | **Se `ACCOUNT_TYPE = aba`** (usado como `address.firstLine`) |
| `WISE_MIGMA_CITY` | Cidade | Dados bancários da Migma | **Se `ACCOUNT_TYPE = aba`** (usado em `address.city`) |
| `WISE_MIGMA_COUNTRY` | País (código ISO, ex: US, BR) | Dados bancários da Migma | **Se `ACCOUNT_TYPE = aba`** (usado em `address.country`, default: "US") |
| `WISE_MIGMA_STATE` | Estado (código de 2 letras, ex: CA, NY) | Dados bancários da Migma | **Se `ACCOUNT_TYPE = aba`** (usado em `address.state`) |
| `WISE_MIGMA_POST_CODE` | CEP/ZIP Code | Dados bancários da Migma | **Se `ACCOUNT_TYPE = aba`** (usado em `address.postCode`) |

---

### ⚠️ OPCIONAIS (Sistema funciona sem elas, mas com limitações)

| Variável | Descrição | Onde Obter | Comportamento se não configurada |
|----------|-----------|------------|----------------------------------|
| `WISE_PROFILE_ID` | ID do perfil da conta Wise | API Wise (`GET /v1/profiles`) ou conta Wise | Será buscado automaticamente via API na primeira requisição |

---

## 📝 Exemplo de Configuração Completa

### Para Conta ABA (Estados Unidos) - RECOMENDADO

```env
# ============================================
# WISE API - AUTENTICAÇÃO
# ============================================
WISE_PERSONAL_TOKEN=your_personal_token_here
WISE_ENVIRONMENT=sandbox
WISE_PROFILE_ID=12345678  # Opcional

# ============================================
# WISE WEBHOOK
# ============================================
WISE_WEBHOOK_SECRET=your_webhook_secret_here

# ============================================
# DADOS BANCÁRIOS MIGMA (RECIPIENT)
# ============================================
# Tipo de Conta: ABA (Estados Unidos)
WISE_MIGMA_ACCOUNT_HOLDER_NAME=Migma Inc
WISE_MIGMA_CURRENCY=USD
WISE_MIGMA_ACCOUNT_TYPE=aba
WISE_MIGMA_LEGAL_TYPE=BUSINESS
WISE_MIGMA_ABA=123456789
WISE_MIGMA_ACCOUNT_NUMBER=9876543210
WISE_MIGMA_BANK_NAME=Bank of America
WISE_MIGMA_BANK_ADDRESS=123 Main St
WISE_MIGMA_CITY=New York
WISE_MIGMA_COUNTRY=US
```

### Para Conta IBAN (Europa)

```env
# ============================================
# WISE API - AUTENTICAÇÃO
# ============================================
WISE_PERSONAL_TOKEN=your_personal_token_here
WISE_ENVIRONMENT=sandbox

# ============================================
# WISE WEBHOOK
# ============================================
WISE_WEBHOOK_SECRET=your_webhook_secret_here

# ============================================
# DADOS BANCÁRIOS MIGMA (RECIPIENT)
# ============================================
# Tipo de Conta: IBAN (Europa)
WISE_MIGMA_ACCOUNT_HOLDER_NAME=Migma Inc
WISE_MIGMA_CURRENCY=EUR
WISE_MIGMA_ACCOUNT_TYPE=iban
WISE_MIGMA_LEGAL_TYPE=BUSINESS
WISE_MIGMA_IBAN=DE89370400440532013000
WISE_MIGMA_BANK_NAME=Deutsche Bank
WISE_MIGMA_BANK_ADDRESS=Taunusanlage 12
WISE_MIGMA_CITY=Frankfurt
WISE_MIGMA_COUNTRY=DE
```

### Para Conta SWIFT (Outros Países)

```env
# ============================================
# WISE API - AUTENTICAÇÃO
# ============================================
WISE_PERSONAL_TOKEN=your_personal_token_here
WISE_ENVIRONMENT=sandbox

# ============================================
# WISE WEBHOOK
# ============================================
WISE_WEBHOOK_SECRET=your_webhook_secret_here

# ============================================
# DADOS BANCÁRIOS MIGMA (RECIPIENT)
# ============================================
# Tipo de Conta: SWIFT
WISE_MIGMA_ACCOUNT_HOLDER_NAME=Migma Inc
WISE_MIGMA_CURRENCY=USD
WISE_MIGMA_ACCOUNT_TYPE=swift
WISE_MIGMA_LEGAL_TYPE=BUSINESS
WISE_MIGMA_SWIFT=CHASUS33
WISE_MIGMA_ACCOUNT_NUMBER=1234567890
WISE_MIGMA_BANK_NAME=JPMorgan Chase
WISE_MIGMA_BANK_ADDRESS=270 Park Avenue
WISE_MIGMA_CITY=New York
WISE_MIGMA_COUNTRY=US
```

---

## 🔍 Como Obter Cada Variável

### 1. `WISE_PERSONAL_TOKEN`

**Passo a passo:**
1. Acesse sua conta Wise: https://wise.com
2. Vá em **Your Account** > **Integrations and Tools** > **API tokens**
3. Clique em **"Add new Token"**
4. ⚠️ **IMPORTANTE**: Requer 2FA (two-factor authentication) ativado
5. Copie o token gerado (só aparece uma vez! Guarde com segurança)

**Nota**: O token é uma string longa que começa com algo como `a1b2c3d4...`

---

### 2. `WISE_ENVIRONMENT`

**Valores possíveis:**
- `sandbox` - Para testes (recomendado inicialmente)
- `production` - Para produção (após testes)

**Recomendação**: Comece com `sandbox` e mude para `production` quando estiver tudo funcionando.

---

### 3. `WISE_PROFILE_ID` (Opcional)

**Opção 1 - Via API (Automático):**
- Se não configurar, o sistema busca automaticamente na primeira requisição
- Não precisa configurar manualmente

**Opção 2 - Manual:**
1. Faça uma requisição para a API Wise:
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" \
        https://api.wise-sandbox.com/v1/profiles
   ```
2. Pegue o `id` do primeiro perfil retornado
3. Configure como `WISE_PROFILE_ID`

---

### 4. `WISE_WEBHOOK_SECRET`

**Passo a passo:**
1. Acesse sua conta Wise: https://wise.com
2. Vá em **Your Account** > **Integrations and Tools** > **Webhooks**
3. Clique em **"Add webhook"** ou **"Create webhook"**
4. Configure:
   - **URL**: `https://ekxftwrjvxtpnqbraszv.supabase.co/functions/v1/wise-webhook`
   - **Event**: `transfers#state-change`
5. Após criar, copie o **Webhook Secret** (geralmente uma string longa)
6. Configure como `WISE_WEBHOOK_SECRET`

**Nota**: O secret é usado para verificar que os webhooks realmente vêm da Wise.

---

### 5. Dados Bancários da Migma

**IMPORTANTE**: Esses são os dados da conta da MIGMA que RECEBE os pagamentos dos clientes.

**Onde encontrar:**
- Extrato bancário
- Contrato com o banco
- Portal do banco online
- Contato com o banco

**Campos necessários por tipo de conta:**

#### Para ABA (Estados Unidos):
- ✅ `WISE_MIGMA_ABA` - Routing Number (9 dígitos)
- ✅ `WISE_MIGMA_ACCOUNT_NUMBER` - Número da conta
- ✅ `WISE_MIGMA_ACCOUNT_HOLDER_NAME` - Nome exato como está no banco
- ✅ `WISE_MIGMA_BANK_NAME` - Nome do banco
- ✅ `WISE_MIGMA_CITY` - Cidade
- ✅ `WISE_MIGMA_COUNTRY` - "US"

#### Para IBAN (Europa):
- ✅ `WISE_MIGMA_IBAN` - Código IBAN completo
- ✅ `WISE_MIGMA_ACCOUNT_HOLDER_NAME` - Nome exato como está no banco
- ✅ `WISE_MIGMA_BANK_NAME` - Nome do banco
- ✅ `WISE_MIGMA_CITY` - Cidade
- ✅ `WISE_MIGMA_COUNTRY` - Código do país (ex: "DE", "FR", "GB")

#### Para SWIFT (Outros Países):
- ✅ `WISE_MIGMA_SWIFT` - Código SWIFT (8 ou 11 caracteres)
- ✅ `WISE_MIGMA_ACCOUNT_NUMBER` - Número da conta
- ✅ `WISE_MIGMA_ACCOUNT_HOLDER_NAME` - Nome exato como está no banco
- ✅ `WISE_MIGMA_BANK_NAME` - Nome do banco
- ✅ `WISE_MIGMA_BANK_ADDRESS` - Endereço completo do banco
- ✅ `WISE_MIGMA_CITY` - Cidade
- ✅ `WISE_MIGMA_COUNTRY` - Código do país

---

## ⚠️ Validações do Sistema

O sistema valida automaticamente:

1. **Se `WISE_PERSONAL_TOKEN` não estiver configurado:**
   - ❌ Edge Function `create-wise-checkout` retorna erro 500
   - Mensagem: "WISE_PERSONAL_TOKEN not configured"

2. **Se `WISE_WEBHOOK_SECRET` não estiver configurado:**
   - ❌ Edge Function `wise-webhook` retorna erro 500
   - Mensagem: "Webhook secret not configured"

3. **Se dados bancários obrigatórios estiverem faltando:**
   - Para `ACCOUNT_TYPE = aba`: precisa de `WISE_MIGMA_ABA` e `WISE_MIGMA_ACCOUNT_NUMBER`
   - Para `ACCOUNT_TYPE = iban`: precisa de `WISE_MIGMA_IBAN`
   - Para `ACCOUNT_TYPE = swift`: precisa de `WISE_MIGMA_SWIFT` e `WISE_MIGMA_ACCOUNT_NUMBER`
   - Para `ACCOUNT_TYPE = sort_code`: precisa de `WISE_MIGMA_SORT_CODE` e `WISE_MIGMA_ACCOUNT_NUMBER`

---

## 📍 Onde Configurar no Supabase

1. Acesse: **Supabase Dashboard** > **Project Settings** > **Edge Functions** > **Secrets**
2. Adicione cada variável clicando em **"Add new secret"**
3. Cole o nome da variável e o valor
4. Clique em **"Save"**

**IMPORTANTE**: 
- Não commite essas variáveis no Git
- Mantenha-as seguras
- Use diferentes valores para `sandbox` e `production`

---

## ✅ Checklist de Configuração

Antes de usar o sistema Wise, verifique:

- [ ] `WISE_PERSONAL_TOKEN` configurado
- [ ] `WISE_ENVIRONMENT` configurado (`sandbox` ou `production`)
- [ ] `WISE_WEBHOOK_SECRET` configurado
- [ ] `WISE_MIGMA_ACCOUNT_HOLDER_NAME` configurado
- [ ] `WISE_MIGMA_CURRENCY` configurado
- [ ] `WISE_MIGMA_ACCOUNT_TYPE` configurado
- [ ] `WISE_MIGMA_LEGAL_TYPE` configurado
- [ ] Dados bancários específicos do tipo de conta configurados:
  - [ ] Se `aba`: `WISE_MIGMA_ABA` e `WISE_MIGMA_ACCOUNT_NUMBER`
  - [ ] Se `iban`: `WISE_MIGMA_IBAN`
  - [ ] Se `swift`: `WISE_MIGMA_SWIFT` e `WISE_MIGMA_ACCOUNT_NUMBER`
  - [ ] Se `sort_code`: `WISE_MIGMA_SORT_CODE` e `WISE_MIGMA_ACCOUNT_NUMBER`
- [ ] Webhook configurado na conta Wise apontando para: `https://ekxftwrjvxtpnqbraszv.supabase.co/functions/v1/wise-webhook`

---

## 🧪 Como Testar se Está Configurado Corretamente

1. **Testar Personal Token:**
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" \
        https://api.wise-sandbox.com/v1/profiles
   ```
   - Deve retornar lista de perfis (status 200)

2. **Testar Edge Function `create-wise-checkout`:**
   - Faça um pedido no checkout selecionando "Wise"
   - Verifique os logs no Supabase Dashboard
   - Deve criar quote, recipient e transfer sem erros

3. **Testar Webhook:**
   - Configure o webhook na conta Wise
   - Faça um teste de pagamento
   - Verifique os logs do `wise-webhook` no Supabase Dashboard
   - Deve processar o evento sem erros

---

**Última atualização**: 2026-01-10  
**Status**: ✅ Documentação completa
