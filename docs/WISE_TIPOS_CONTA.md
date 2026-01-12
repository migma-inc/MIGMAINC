# 🏦 Tipos de Conta Wise - Guia Completo

**Data**: 2026-01-12

---

## 📋 RESUMO

Na Wise API, você escolhe **UM tipo de conta por vez** ao criar um recipient. Cada tipo tem campos obrigatórios específicos.

**Tipos disponíveis**:
- `aba` - Para contas nos EUA (ACH/Wire)
- `iban` - Para contas na Europa
- `swift` - Para transferências internacionais via SWIFT
- `sort_code` - Para contas no Reino Unido

---

## 🏦 TIPOS DE CONTA DISPONÍVEIS

### 1. ABA (Estados Unidos) - RECOMENDADO PARA USD

**Quando usar**: Clientes pagando de contas bancárias nos EUA

**Campos obrigatórios**:
- `WISE_MIGMA_ACCOUNT_TYPE` = `aba`
- `WISE_MIGMA_ABA` = Routing number (ex: `084009519`)
- `WISE_MIGMA_ACCOUNT_NUMBER` = Número da conta (ex: `777855076826940`)

**Dados da Migma**:
```
WISE_MIGMA_ACCOUNT_TYPE=aba
WISE_MIGMA_ABA=084009519
WISE_MIGMA_ACCOUNT_NUMBER=777855076826940
WISE_MIGMA_BANK_NAME=Column National Association
WISE_MIGMA_BANK_ADDRESS=A4-700 1 Letterman Drive
WISE_MIGMA_CITY=San Francisco
WISE_MIGMA_COUNTRY=US
```

**Vantagens**:
- ✅ Mais rápido para pagamentos dentro dos EUA
- ✅ Taxas menores para transferências domésticas
- ✅ Ideal para clientes americanos

---

### 2. SWIFT (Internacional)

**Quando usar**: Clientes pagando de outros países (fora dos EUA)

**Campos obrigatórios**:
- `WISE_MIGMA_ACCOUNT_TYPE` = `swift`
- `WISE_MIGMA_SWIFT` = Código SWIFT/BIC (ex: `TRWIUS35XXX`)
- `WISE_MIGMA_ACCOUNT_NUMBER` = Número da conta (ex: `777855076826940`)

**Dados da Migma**:
```
WISE_MIGMA_ACCOUNT_TYPE=swift
WISE_MIGMA_SWIFT=TRWIUS35XXX
WISE_MIGMA_ACCOUNT_NUMBER=777855076826940
WISE_MIGMA_BANK_NAME=Wise US Inc
WISE_MIGMA_BANK_ADDRESS=108 W 13th St
WISE_MIGMA_CITY=Wilmington
WISE_MIGMA_COUNTRY=US
```

**Vantagens**:
- ✅ Funciona para clientes de qualquer país
- ✅ Padrão internacional
- ⚠️ Pode ter taxas maiores que ABA

---

### 3. IBAN (Europa)

**Quando usar**: Clientes pagando de contas bancárias na Europa

**Campos obrigatórios**:
- `WISE_MIGMA_ACCOUNT_TYPE` = `iban`
- `WISE_MIGMA_IBAN` = Código IBAN completo

**Exemplo**:
```
WISE_MIGMA_ACCOUNT_TYPE=iban
WISE_MIGMA_IBAN=GB82WEST12345698765432
```

---

### 4. Sort Code (Reino Unido)

**Quando usar**: Clientes pagando de contas bancárias no Reino Unido

**Campos obrigatórios**:
- `WISE_MIGMA_ACCOUNT_TYPE` = `sort_code`
- `WISE_MIGMA_SORT_CODE` = Sort code (6 dígitos)
- `WISE_MIGMA_ACCOUNT_NUMBER` = Número da conta

**Exemplo**:
```
WISE_MIGMA_ACCOUNT_TYPE=sort_code
WISE_MIGMA_SORT_CODE=123456
WISE_MIGMA_ACCOUNT_NUMBER=12345678
```

---

## 🎯 QUAL TIPO USAR?

### Para a Migma (USD):

**Opção 1: ABA** (Recomendado inicialmente)
- ✅ Clientes dos EUA (maioria provavelmente)
- ✅ Mais rápido e barato
- ✅ Já temos todos os dados

**Opção 2: SWIFT**
- ✅ Clientes internacionais
- ✅ Funciona para todos os países
- ✅ Já temos todos os dados

**Recomendação**: Começar com **ABA** para simplificar. Se precisar de clientes internacionais, podemos adicionar lógica para escolher dinamicamente baseado na origem do pagamento.

---

## 🔄 ESCOLHA DINÂMICA (Futuro)

**Ideal**: Escolher o tipo de conta automaticamente baseado na origem do pagamento:
- Cliente nos EUA → Usa `aba`
- Cliente fora dos EUA → Usa `swift`

**Implementação futura**:
1. Detectar país do cliente (via IP ou seleção)
2. Escolher tipo de conta apropriado
3. Criar recipient com o tipo correto

---

## 📝 CONFIGURAÇÃO ATUAL

**Para começar, vamos usar ABA**:

```env
WISE_MIGMA_ACCOUNT_TYPE=aba
WISE_MIGMA_ABA=084009519
WISE_MIGMA_ACCOUNT_NUMBER=777855076826940
```

**Se precisar mudar para SWIFT depois**:

```env
WISE_MIGMA_ACCOUNT_TYPE=swift
WISE_MIGMA_SWIFT=TRWIUS35XXX
WISE_MIGMA_ACCOUNT_NUMBER=777855076826940
```

---

## ✅ VALIDAÇÃO NO CÓDIGO

O código agora valida corretamente cada tipo:

- ✅ **ABA**: Verifica `aba` + `accountNumber`
- ✅ **SWIFT**: Verifica `swift` + `accountNumber`
- ✅ **IBAN**: Verifica apenas `iban`
- ✅ **Sort Code**: Verifica `sortCode` + `accountNumber`

---

**Última atualização**: 2026-01-12
