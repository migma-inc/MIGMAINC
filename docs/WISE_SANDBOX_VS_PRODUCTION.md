# 🔄 Sandbox vs Production - Wise API

**Data**: 2026-01-12

---

## 📋 RESUMO

A Wise tem **dois ambientes separados**:
- **Sandbox**: Para testes (não usa dinheiro real)
- **Production**: Para pagamentos reais

**IMPORTANTE**: Tokens de um ambiente **NÃO funcionam** no outro!

---

## 🎯 QUAL AMBIENTE USAR?

### Production (Recomendado se já tem token)

**Quando usar**:
- ✅ Você já criou o token em **wise.com** (produção)
- ✅ Quer processar pagamentos reais
- ✅ Conta já está verificada e ativa

**Configuração**:
```env
WISE_ENVIRONMENT=production
```

**URL da API**: `https://api.wise.com`

---

### Sandbox (Para testes iniciais)

**Quando usar**:
- ✅ Quer testar sem usar dinheiro real
- ✅ Está desenvolvendo/integrando
- ✅ Quer validar o fluxo antes de ir para produção

**Como obter token do sandbox**:
1. Acesse: https://sandbox.transferwise.com ou https://sandbox.wise.com
2. Crie uma conta sandbox (ou faça login se já tiver)
3. Vá em: **Your Account** > **Integrations and Tools** > **API tokens**
4. Crie um novo token
5. Configure: `WISE_ENVIRONMENT=sandbox`

**Configuração**:
```env
WISE_ENVIRONMENT=sandbox
```

**URL da API**: `https://api.wise-sandbox.com`

---

## ⚠️ PROBLEMA COMUM

### Erro: Token Inválido (401)

**Causa**: Token e ambiente não correspondem.

**Exemplos**:
- ❌ Token de produção + `WISE_ENVIRONMENT=sandbox` → Erro 401
- ❌ Token de sandbox + `WISE_ENVIRONMENT=production` → Erro 401
- ✅ Token de produção + `WISE_ENVIRONMENT=production` → Funciona
- ✅ Token de sandbox + `WISE_ENVIRONMENT=sandbox` → Funciona

---

## 🔍 COMO IDENTIFICAR QUAL TOKEN VOCÊ TEM

### Token de Produção:
- Criado em: **wise.com**
- Usado para: Pagamentos reais
- Configure: `WISE_ENVIRONMENT=production`

### Token de Sandbox:
- Criado em: **sandbox.wise.com** ou **sandbox.transferwise.com**
- Usado para: Testes
- Configure: `WISE_ENVIRONMENT=sandbox`

---

## ✅ SOLUÇÃO PARA O SEU CASO

**Situação**: Você criou o token em **wise.com** (produção)

**Solução**: Configure `WISE_ENVIRONMENT=production` no Supabase Dashboard

**Passos**:
1. Acesse: Supabase Dashboard > **Project Settings** > **Edge Functions** > **Secrets**
2. Encontre `WISE_ENVIRONMENT`
3. Edite e mude para: `production`
4. Salve
5. Teste novamente

---

## 📝 NOTAS IMPORTANTES

### Diferenças entre Ambientes

**Sandbox**:
- ✅ Não usa dinheiro real
- ✅ Ideal para desenvolvimento
- ✅ Contas podem ser criadas facilmente
- ⚠️ Dados são separados do production

**Production**:
- ✅ Pagamentos reais
- ✅ Conta precisa estar verificada
- ✅ Dados reais de clientes
- ⚠️ Cuidado ao testar!

### Migração Sandbox → Production

Quando estiver pronto para produção:
1. Obtenha token de produção em **wise.com**
2. Configure `WISE_ENVIRONMENT=production`
3. Configure `WISE_PERSONAL_TOKEN` com o token de produção
4. Teste cuidadosamente antes de usar em produção

---

**Última atualização**: 2026-01-12
