# 🔧 Erro 422: customerTransactionId Inválido ao Criar Transfer

**Data**: 2026-01-12  
**Erro**: `422 Unprocessable Entity` ao criar transfer com `customerTransactionId` inválido

---

## 🔍 PROBLEMA IDENTIFICADO

A API Wise retornou erro 422 com a seguinte mensagem:

```json
{
  "errors": [{
    "code": "illegal.argument.exception",
    "message": "Illegal query argument",
    "field": "customerTransactionId",
    "arguments": ["customerTransactionId"]
  }]
}
```

**Payload enviado**:
```json
{
  "targetAccount": 1317701453,
  "quoteUuid": "db1aa617-43ae-4fa5-a4dc-4facc809b763",
  "customerTransactionId": "ORD-20260112-3558",  // ❌ Não é um UUID válido
  "reference": "Order ORD-20260112-3558 - paulo victor ribeiro dos santos"
}
```

---

## ✅ SOLUÇÃO APLICADA

O problema era que `customerTransactionId` **DEVE ser um UUID válido** (formato: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`), mas estávamos enviando `"ORD-20260112-3558"` que não é um UUID.

### Correção:

1. ✅ Verificar se `order.id` já é um UUID válido
2. ✅ Se não for, gerar um novo UUID usando `crypto.randomUUID()`
3. ✅ Usar esse UUID como `customerTransactionId`

### Código Corrigido:

```typescript
// Generate a valid UUID for customerTransactionId (required by Wise API)
let customerTransactionId: string;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (order.id && uuidPattern.test(order.id)) {
  customerTransactionId = order.id; // Use order.id if it's already a UUID
} else {
  customerTransactionId = crypto.randomUUID(); // Generate new UUID
}

const transferParams = {
  targetAccount: recipient.id,
  quoteUuid: quote.id,
  customerTransactionId: customerTransactionId, // ✅ Now a valid UUID
  reference: `Order ${order.order_number} - ${order.client_name}`,
};
```

---

## 📋 REQUISITOS DA API WISE

### `customerTransactionId`:
- ✅ **DEVE** ser um UUID válido (formato: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)
- ✅ Usado para idempotência (evitar transfers duplicados)
- ✅ Se você tentar criar o mesmo transfer duas vezes com o mesmo `customerTransactionId`, a segunda tentativa não criará um transfer duplicado

### Outros Campos Obrigatórios:
- ✅ `targetAccount` - ID do recipient (conta que recebe)
- ✅ `quoteUuid` - UUID da quote criada anteriormente
- ✅ `reference` - Referência opcional (texto livre)

### Campos Condicionalmente Obrigatórios:
Dependendo das moedas envolvidas, pode ser necessário adicionar:
- `sourceAccount` - ID da conta de origem (se aplicável)
- `transferPurpose` - Propósito da transferência
- `transferPurposeSubTransferPurpose` - Sub-propósito
- `sourceOfFunds` - Origem dos fundos

**Nota**: Para transfers USD → USD (mesma moeda), esses campos geralmente não são obrigatórios.

---

## 🧪 TESTAR NOVAMENTE

Após o deploy da correção:

1. Tente criar um checkout Wise novamente
2. Verifique os logs no Supabase Dashboard
3. Deve aparecer: `✅ Transfer created successfully`
4. O `customerTransactionId` nos logs deve ser um UUID válido

---

## 📝 LOGS ESPERADOS (Quando Funcionar)

```
[Wise Checkout] 📋 Step 10: Creating Wise transfer...
[Wise Checkout] Customer Transaction ID (UUID): 23e7aedc-97d1-4b9e-968f-03a80df02764
[Wise Checkout] Transfer parameters: {
  "targetAccount": 1317701453,
  "quoteUuid": "db1aa617-43ae-4fa5-a4dc-4facc809b763",
  "customerTransactionId": "23e7aedc-97d1-4b9e-968f-03a80df02764",
  "reference": "Order ORD-20260112-3558 - paulo victor ribeiro dos santos"
}
[Wise API] POST https://api.wise.com/v1/transfers
[Wise API] Response status: 200 OK
[Wise Checkout] ✅ Transfer created successfully
```

---

## ⚠️ NOTAS IMPORTANTES

1. **Idempotência**: O `customerTransactionId` garante que, se houver uma falha de rede e você tentar criar o transfer novamente com o mesmo UUID, a Wise não criará um transfer duplicado.

2. **Armazenamento**: Considere armazenar o `customerTransactionId` usado em `visa_orders` ou `wise_transfers` para referência futura e para permitir retry seguro.

3. **Formato**: Sempre use UUIDs válidos. Não use IDs customizados como `"ORD-20260112-3558"` diretamente.

---

**Última atualização**: 2026-01-12
