# 🔧 Erro 422: Formato Incorreto ao Criar Recipient

**Data**: 2026-01-12  
**Erro**: `422 Unprocessable Entity` ao criar recipient com conta ABA

---

## 🔍 PROBLEMA IDENTIFICADO

A API Wise retornou erro 422 com as seguintes mensagens:

```
"Please enter a routing number." (path: "abartn")
"Please select an account type." (path: "accountType")
"Please select a country." (path: "address.country")
"Please enter a city." (path: "address.city")
"Please enter a residential address." (path: "address.firstLine")
"Please enter a post code." (path: "address.postCode")
"Additional account field city is not permitted." (path: "details", argument: "city")
```

---

## ✅ SOLUÇÃO APLICADA

O código foi corrigido para usar o formato correto da API Wise para contas ABA:

### Formato Correto (ABA):

```json
{
  "currency": "USD",
  "type": "aba",
  "accountHolderName": "MIGMA INC",
  "details": {
    "legalType": "BUSINESS",
    "abartn": "084009519",           // ✅ Use 'abartn' não 'aba'
    "accountNumber": "777855076826940",
    "accountType": "CHECKING",        // ✅ CHECKING ou SAVINGS
    "address": {                      // ✅ Address dentro de details
      "country": "US",
      "state": "CA",                  // ✅ Código de estado (2 letras)
      "city": "San Francisco",
      "postCode": "94129",            // ✅ ZIP Code
      "firstLine": "A4-700 1 Letterman Drive"
    }
  }
}
```

### Formato Incorreto (Antes):

```json
{
  "currency": "USD",
  "type": "aba",
  "accountHolderName": "MIGMA INC",
  "legalType": "BUSINESS",            // ❌ Não deve estar aqui
  "details": {
    "aba": "084009519",               // ❌ Deve ser 'abartn'
    "accountNumber": "777855076826940",
    "city": "San Francisco",          // ❌ Não deve estar aqui
    "country": "US",                  // ❌ Não deve estar aqui
    "bankAddress": "A4-700 1 Letterman Drive"
  }
}
```

---

## 📋 VARIÁVEIS NECESSÁRIAS

### Obrigatórias:

- `WISE_MIGMA_ABA` = `084009519` (será usado como `abartn`)
- `WISE_MIGMA_ACCOUNT_NUMBER` = `777855076826940`

### Opcionais (mas recomendadas):

- `WISE_MIGMA_STATE` = `CA` (código de estado de 2 letras)
- `WISE_MIGMA_POST_CODE` = `94129` (ZIP Code)
- `WISE_MIGMA_CITY` = `San Francisco`
- `WISE_MIGMA_BANK_ADDRESS` = `A4-700 1 Letterman Drive` (usado como `address.firstLine`)
- `WISE_MIGMA_COUNTRY` = `US`

**Nota**: Se `WISE_MIGMA_STATE` e `WISE_MIGMA_POST_CODE` não estiverem configurados, o código usa valores padrão:
- `state`: `CA` (California)
- `postCode`: `94129` (ZIP de San Francisco)

---

## 🔧 CORREÇÕES APLICADAS

1. ✅ Mudei `aba` para `abartn` no payload
2. ✅ Adicionei `accountType: 'CHECKING'` dentro de `details`
3. ✅ Movi `legalType` para dentro de `details`
4. ✅ Criei objeto `address` dentro de `details` com:
   - `country`
   - `state`
   - `city`
   - `postCode`
   - `firstLine`
5. ✅ Removi `city` e `country` de `details` (agora estão em `address`)

---

## 🧪 TESTAR NOVAMENTE

Após o deploy da correção:

1. Tente criar um checkout Wise novamente
2. Verifique os logs no Supabase Dashboard
3. Deve aparecer: `✅ Recipient created successfully`

---

## 📝 LOGS ESPERADOS (Quando Funcionar)

```
[Wise Checkout] 📋 Step 9: Creating Wise recipient...
[Wise Checkout] ABA recipient details:
[Wise Checkout] - abartn: 084009519
[Wise Checkout] - accountNumber: 777855076826940
[Wise Checkout] - accountType: CHECKING
[Wise Checkout] - address: {
  "country": "US",
  "state": "CA",
  "city": "San Francisco",
  "postCode": "94129",
  "firstLine": "A4-700 1 Letterman Drive"
}
[Wise API] POST https://api.wise.com/v1/accounts
[Wise API] Response status: 200 OK
[Wise Checkout] ✅ Recipient created successfully
```

---

**Última atualização**: 2026-01-12
