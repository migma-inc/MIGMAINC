# 💰 Payment Links Dinâmicos da Wise

**Data**: 2026-01-12  
**Pergunta**: É possível criar links de pagamento com valores dinâmicos via API?

---

## ❌ RESPOSTA CURTA

**Não**, a API pública da Wise **não suporta** criar Payment Links com valores dinâmicos diretamente.

---

## 📋 O QUE A API SUPORTA

### ✅ O Que Podemos Fazer (Via API)

1. **Criar Transfer com Valor Dinâmico**
   - ✅ Criar Quote com valor específico
   - ✅ Criar Transfer vinculado à Quote
   - ✅ Obter `payinSessionId` do Transfer
   - ✅ Gerar URL: `https://wise.com/pay/r/{payinSessionId}`
   - ✅ **O valor já está definido no Transfer!**

### ❌ O Que NÃO Podemos Fazer (Via API)

1. **Criar Payment Links Genéricos**
   - ❌ Não há endpoint `/v1/payment-links` ou similar
   - ❌ Não podemos criar links sem criar Transfer primeiro
   - ❌ Payment Links da interface web não têm API pública

---

## 🔍 COMO FUNCIONA ATUALMENTE

### Fluxo Atual (Já Implementado)

1. **Cliente faz checkout** → Sistema cria Transfer via API
2. **Transfer criado** → Wise retorna `payinSessionId`
3. **URL gerada** → `https://wise.com/pay/r/{payinSessionId}`
4. **Cliente acessa URL** → Wise mostra valor do Transfer (já definido)

**✅ O valor já está dinâmico!** Cada Transfer tem seu próprio valor.

### Exemplo

```typescript
// 1. Criar Quote com valor dinâmico
const quote = await wiseClient.createQuote(profileId, {
  sourceCurrency: 'USD',
  targetCurrency: 'USD',
  targetAmount: 23750 // ← Valor dinâmico do pedido
});

// 2. Criar Transfer vinculado à Quote
const transfer = await wiseClient.createTransfer(profileId, {
  targetAccount: recipient.id,
  quoteUuid: quote.id,
  customerTransactionId: order.id,
  reference: `Order ${order.order_number}`
});

// 3. Gerar URL de pagamento
const paymentUrl = `https://wise.com/pay/r/${transfer.payinSessionId}`;
// ✅ URL já contém o valor correto (23750 USD neste caso)
```

---

## 📊 COMPARAÇÃO: Payment Links vs Transfers

| Aspecto | Payment Links (Web) | Transfers (API) |
|---------|---------------------|-----------------|
| **Valor Dinâmico** | ✅ Sim (via web) | ✅ Sim (via API) |
| **Criação via API** | ❌ Não | ✅ Sim |
| **Valor Definido** | No link | No Transfer |
| **URL Gerada** | `wise.com/pay#*****` | `wise.com/pay/r/{payinSessionId}` |
| **Uso** | Manual (web) | Automático (API) |

---

## 💡 CONCLUSÃO

### ✅ O Que Já Estamos Fazendo É Correto!

O sistema atual **já cria links dinâmicos**:

1. ✅ Cada pedido cria um Transfer único
2. ✅ Cada Transfer tem valor específico do pedido
3. ✅ Cada Transfer gera URL única com `payinSessionId`
4. ✅ Cliente acessa URL e vê valor correto

### ⚠️ Limitação da API

- ❌ Não podemos criar "Payment Links genéricos" sem Transfer
- ❌ Não há endpoint específico para Payment Links
- ✅ Mas não precisamos! Transfer já faz isso

---

## 🔗 REFERÊNCIAS

- **Wise API Documentation**: https://docs.wise.com/api-reference/
- **Wise Support**: Payment Links não são suportados via API pública
- **Formato Correto URL**: `https://wise.com/pay/r/{payinSessionId}`

---

**Última Atualização**: 2026-01-12
