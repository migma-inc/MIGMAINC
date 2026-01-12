# ⚡ Configuração Rápida - Wise no Supabase

**Status**: ✅ Todas as informações obtidas - Pronto para configurar

---

## 🎯 PASSO A PASSO RÁPIDO

### 1. Acessar Supabase Dashboard

1. Acesse: https://supabase.com/dashboard
2. Selecione o projeto: `ekxftwrjvxtpnqbraszv`
3. Vá em: **Project Settings** > **Edge Functions** > **Secrets**

### 2. Adicionar Variáveis (Uma por uma)

Clique em **"Add new secret"** e adicione cada uma abaixo:

#### Variáveis Obrigatórias:

```
Nome: WISE_PERSONAL_TOKEN
Valor: [cole o token completo aqui]
```

```
Nome: WISE_ENVIRONMENT
Valor: production
```

**⚠️ IMPORTANTE**: 
- Se o token foi criado em **wise.com** (produção) → Use `production`
- Se o token foi criado em **sandbox.wise.com** (sandbox) → Use `sandbox`
- O token e o ambiente **DEVEM corresponder**!

```
Nome: WISE_MIGMA_ACCOUNT_HOLDER_NAME
Valor: MIGMA INC
```

**Nota**: Use apenas o nome legal da empresa. O "@migmainc" é um identificador da conta Wise, não parte do nome bancário.

```
Nome: WISE_MIGMA_CURRENCY
Valor: USD
```

```
Nome: WISE_MIGMA_ACCOUNT_TYPE
Valor: aba
```

**Nota**: Escolha UM tipo de conta por vez:
- `aba` - Para clientes dos EUA (recomendado inicialmente)
- `swift` - Para clientes internacionais
- `iban` - Para clientes da Europa
- `sort_code` - Para clientes do Reino Unido

Ver `docs/WISE_TIPOS_CONTA.md` para mais detalhes.

```
Nome: WISE_MIGMA_LEGAL_TYPE
Valor: BUSINESS
```

```
Nome: WISE_MIGMA_ABA
Valor: 084009519
```

```
Nome: WISE_MIGMA_ACCOUNT_NUMBER
Valor: 777855076826940
```

#### Variáveis Opcionais (Recomendadas):

```
Nome: WISE_MIGMA_BANK_NAME
Valor: Column National Association
```

```
Nome: WISE_MIGMA_BANK_ADDRESS
Valor: A4-700 1 Letterman Drive
```

```
Nome: WISE_MIGMA_CITY
Valor: San Francisco
```

```
Nome: WISE_MIGMA_COUNTRY
Valor: US
```

```
Nome: WISE_MIGMA_STATE
Valor: CA
```

**Nota**: Código de estado de 2 letras (ex: CA para California, NY para New York)

```
Nome: WISE_MIGMA_POST_CODE
Valor: 94129
```

**Nota**: ZIP Code (CEP) do endereço do banco

---

## ✅ VERIFICAÇÃO

Após adicionar todas, você deve ter **12 variáveis** configuradas:

- [ ] WISE_PERSONAL_TOKEN
- [ ] WISE_ENVIRONMENT
- [ ] WISE_MIGMA_ACCOUNT_HOLDER_NAME
- [ ] WISE_MIGMA_CURRENCY
- [ ] WISE_MIGMA_ACCOUNT_TYPE
- [ ] WISE_MIGMA_LEGAL_TYPE
- [ ] WISE_MIGMA_ABA
- [ ] WISE_MIGMA_ACCOUNT_NUMBER
- [ ] WISE_MIGMA_BANK_NAME (opcional)
- [ ] WISE_MIGMA_BANK_ADDRESS (opcional)
- [ ] WISE_MIGMA_CITY (opcional)
- [ ] WISE_MIGMA_COUNTRY (opcional)
- [ ] WISE_MIGMA_STATE (opcional, mas recomendado para ABA)
- [ ] WISE_MIGMA_POST_CODE (opcional, mas recomendado para ABA)

---

## 🧪 TESTAR

Após configurar:

1. **Acesse o checkout de um produto**
2. **Selecione "Wise" como método de pagamento**
3. **Clique em "Pay with Wise"**
4. **Verifique os logs** no Supabase Dashboard:
   - Edge Functions > Logs > `create-wise-checkout`
   - Deve aparecer: `✅ Quote created successfully`
   - Deve aparecer: `✅ Recipient created successfully`
   - Deve aparecer: `✅ Transfer created successfully`

---

## ❌ SE DER ERRO

### Erro: "Missing required bank details"
- Verifique se `WISE_MIGMA_ABA` e `WISE_MIGMA_ACCOUNT_NUMBER` estão configurados corretamente
- Verifique se não há espaços extras nos valores

### Erro: "WISE_PERSONAL_TOKEN not configured"
- Verifique se o token foi copiado completamente
- Verifique se não há espaços antes ou depois do token

### Erro: "Failed to get Wise profile ID"
- Verifique se o `WISE_PERSONAL_TOKEN` está correto
- Verifique se está usando o ambiente correto (`sandbox`)

---

**Pronto!** Após configurar, podemos testar o fluxo completo. 🚀
