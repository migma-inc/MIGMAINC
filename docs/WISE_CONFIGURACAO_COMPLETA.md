# 🔧 Configuração Completa - Variáveis de Ambiente Wise

**Data**: 2026-01-12  
**Status**: ✅ Informações obtidas - Pronto para configurar

---

## 📋 VARIÁVEIS OBTIDAS

### Variáveis Obrigatórias

| Variável | Valor | Status |
|----------|-------|--------|
| `WISE_PERSONAL_TOKEN` | `<seu_token>` | ⚠️ Precisa do valor completo |
| `WISE_ENVIRONMENT` | `sandbox` | ✅ |
| `WISE_MIGMA_ACCOUNT_HOLDER_NAME` | `MIGMA INC` | ✅ |
| `WISE_MIGMA_CURRENCY` | `USD` | ✅ |
| `WISE_MIGMA_ACCOUNT_TYPE` | `aba` | ✅ |
| `WISE_MIGMA_LEGAL_TYPE` | `BUSINESS` | ✅ |
| `WISE_MIGMA_ABA` | `084009519` | ✅ |
| `WISE_MIGMA_ACCOUNT_NUMBER` | `777855076826940` | ✅ |

### Variáveis Opcionais (Recomendadas)

| Variável | Valor Sugerido | Status |
|----------|---------------|--------|
| `WISE_MIGMA_BANK_NAME` | `Column National Association` | ✅ |
| `WISE_MIGMA_BANK_ADDRESS` | `A4-700 1 Letterman Drive` | ✅ |
| `WISE_MIGMA_CITY` | `San Francisco` | ✅ |
| `WISE_MIGMA_COUNTRY` | `US` | ✅ |
| `WISE_MIGMA_SWIFT` | `TRWIUS35XXX` | ✅ (opcional, para SWIFT) |

### Informações Adicionais (Não são variáveis de ambiente)

- **Membership Number**: `P99300169`
- **Referência**: `807064`
- **Swift/BIC**: `TRWIUS35XXX`
- **Tipo de Conta**: Corrente

---

## 🚀 COMO CONFIGURAR NO SUPABASE

### Passo 1: Acessar o Supabase Dashboard

1. Acesse: https://supabase.com/dashboard
2. Selecione o projeto: `ekxftwrjvxtpnqbraszv`
3. Vá em: **Project Settings** > **Edge Functions** > **Secrets**

### Passo 2: Adicionar Variáveis de Ambiente

Clique em **"Add new secret"** e adicione cada variável abaixo:

#### 1. WISE_PERSONAL_TOKEN
```
Name: WISE_PERSONAL_TOKEN
Value: [COLE O TOKEN COMPLETO AQUI]
```
⚠️ **IMPORTANTE**: Você precisa do token completo. Se não tiver, acesse:
- Conta Wise > **Integrations and Tools** > **API tokens**
- Copie o token completo

#### 2. WISE_ENVIRONMENT
```
Name: WISE_ENVIRONMENT
Value: production
```

**⚠️ IMPORTANTE**: 
- Se você criou o token em **wise.com** → Use `production`
- Se você criou o token em **sandbox.wise.com** → Use `sandbox`
- O token e o ambiente **DEVEM corresponder**!

#### 3. WISE_MIGMA_ACCOUNT_HOLDER_NAME
```
Name: WISE_MIGMA_ACCOUNT_HOLDER_NAME
Value: MIGMA INC
```

**Nota**: Use apenas o nome legal da empresa. O "@migmainc" que aparece na interface da Wise é um identificador/username da conta, não parte do nome bancário legal.

#### 4. WISE_MIGMA_CURRENCY
```
Name: WISE_MIGMA_CURRENCY
Value: USD
```

#### 5. WISE_MIGMA_ACCOUNT_TYPE
```
Name: WISE_MIGMA_ACCOUNT_TYPE
Value: aba
```

**IMPORTANTE**: Escolha **UM tipo de conta por vez**:
- `aba` - Para contas nos EUA (recomendado para USD)
- `swift` - Para transferências internacionais
- `iban` - Para contas na Europa
- `sort_code` - Para contas no Reino Unido

**A Migma tem dados para**:
- ✅ **ABA**: `084009519` + Account `777855076826940` (recomendado inicialmente)
- ✅ **SWIFT**: `TRWIUS35XXX` + Account `777855076826940` (para clientes internacionais)

Ver `docs/WISE_TIPOS_CONTA.md` para guia completo.

#### 6. WISE_MIGMA_LEGAL_TYPE
```
Name: WISE_MIGMA_LEGAL_TYPE
Value: BUSINESS
```

#### 7. WISE_MIGMA_ABA
```
Name: WISE_MIGMA_ABA
Value: 084009519
```

#### 8. WISE_MIGMA_ACCOUNT_NUMBER
```
Name: WISE_MIGMA_ACCOUNT_NUMBER
Value: 777855076826940
```

#### 9. WISE_MIGMA_BANK_NAME (Opcional mas recomendado)
```
Name: WISE_MIGMA_BANK_NAME
Value: Column National Association
```

#### 10. WISE_MIGMA_BANK_ADDRESS (Opcional mas recomendado)
```
Name: WISE_MIGMA_BANK_ADDRESS
Value: A4-700 1 Letterman Drive
```

#### 11. WISE_MIGMA_CITY (Opcional mas recomendado)
```
Name: WISE_MIGMA_CITY
Value: San Francisco
```

#### 12. WISE_MIGMA_COUNTRY (Opcional mas recomendado)
```
Name: WISE_MIGMA_COUNTRY
Value: US
```

---

## ✅ CHECKLIST DE CONFIGURAÇÃO

Após adicionar todas as variáveis, verifique:

- [ ] `WISE_PERSONAL_TOKEN` configurado (valor completo)
- [ ] `WISE_ENVIRONMENT` = `sandbox`
- [ ] `WISE_MIGMA_ACCOUNT_HOLDER_NAME` = `MIGMA INC / @migmainc`
- [ ] `WISE_MIGMA_CURRENCY` = `USD`
- [ ] `WISE_MIGMA_ACCOUNT_TYPE` = `aba`
- [ ] `WISE_MIGMA_LEGAL_TYPE` = `BUSINESS`
- [ ] `WISE_MIGMA_ABA` = `084009519`
- [ ] `WISE_MIGMA_ACCOUNT_NUMBER` = `777855076826940`
- [ ] Variáveis opcionais adicionadas (recomendado)

---

## 🧪 TESTAR CONFIGURAÇÃO

Após configurar todas as variáveis:

1. **Testar criação de checkout**:
   - Acesse o checkout de um produto
   - Selecione "Wise" como método de pagamento
   - Clique em "Pay with Wise"
   - Verifique os logs no Supabase Dashboard

2. **Verificar logs**:
   - Supabase Dashboard > **Edge Functions** > **Logs**
   - Procure por `create-wise-checkout`
   - Verifique se não há erros de variáveis faltando

3. **Erros comuns**:
   - Se aparecer erro de "Missing required bank details", verifique se `WISE_MIGMA_ABA` e `WISE_MIGMA_ACCOUNT_NUMBER` estão configurados corretamente
   - Se aparecer erro de "WISE_PERSONAL_TOKEN not configured", verifique se o token foi copiado completamente

---

## 📝 NOTAS IMPORTANTES

### Sobre o WISE_PERSONAL_TOKEN

⚠️ **ATENÇÃO**: Você precisa do token completo. O valor `<seu_token>` é apenas um placeholder.

**Como obter**:
1. Acesse: https://wise.com
2. Faça login na conta
3. Vá em: **Your Account** > **Integrations and Tools** > **API tokens**
4. Se já existe um token, copie-o
5. Se não existe, crie um novo e copie imediatamente (só aparece uma vez)

### Sobre o WISE_ENVIRONMENT

- **sandbox**: Ambiente de testes (recomendado para começar)
- **production**: Ambiente de produção (usar apenas após testes completos)

### Sobre os Dados Bancários

Você forneceu informações para dois tipos de conta:

1. **ABA (ACH/Wire)**:
   - Routing Number: `084009519`
   - Account Number: `777855076826940`
   - Banco: Column National Association
   - Endereço: A4-700 1 Letterman Drive, San Francisco CA 94129

2. **SWIFT**:
   - Swift/BIC: `TRWIUS35XXX`
   - Account Number: `777855076826940`
   - Banco: Wise US Inc
   - Endereço: 108 W 13th St, Wilmington DE 19801

**Para o checkout, estamos usando ABA**, então as variáveis estão configuradas para ABA.

---

## 🔄 PRÓXIMOS PASSOS

1. ✅ Configurar todas as variáveis no Supabase Dashboard
2. ⏸️ Obter o `WISE_PERSONAL_TOKEN` completo (se ainda não tiver)
3. 🧪 Testar criação de checkout
4. 📊 Verificar logs para garantir que tudo está funcionando
5. 🔗 Testar o fluxo completo (quote → recipient → transfer → redirect)

---

**Última atualização**: 2026-01-12
