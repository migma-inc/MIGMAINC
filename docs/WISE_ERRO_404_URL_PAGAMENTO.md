# 🔍 Erro 404: URL de Pagamento Wise Retorna "Página Não Existe"

**Data**: 2026-01-12  
**Erro**: `https://wise.com/pay/{payinSessionId}` retorna 404 mesmo após login

---

## 🔍 ANÁLISE DO PROBLEMA

### Problema Identificado

A URL `https://wise.com/pay/6ed0e5a4-92a0-4f72-20eb-4fc1f7787c0c` (usando `payinSessionId`) está retornando 404 mesmo após fazer login no Wise.

### Logs Observados

```
[Wise Checkout] 🔗 Payment URL: https://wise.com/pay/6ed0e5a4-92a0-4f72-20eb-4fc1f7787c0c
[Wise Checkout] 📊 Transfer ID: 1917280884
[Wise Checkout] 🔑 Payin Session ID: 6ed0e5a4-92a0-4f72-20eb-4fc1f7787c0c
[Wise Checkout] 🌍 Environment: production
```

### Possíveis Causas

1. **❌ Formato de URL Incorreto**
   - `/pay/{payinSessionId}` pode não ser o endpoint público correto
   - Pode ser necessário usar `/payments/{transferId}` ao invés de `/pay/{payinSessionId}`
   - `payinSessionId` pode ser usado apenas internamente pela API

2. **❌ Limitação do Personal Token**
   - Com Personal Token, não podemos fundar transfers via API
   - Transfer está em estado `incoming_payment_waiting`
   - URL de pagamento pode não estar disponível até transfer ser fundado manualmente

3. **❌ Transfer Não Pronto para Pagamento**
   - Transfer pode precisar de configuração adicional
   - Pode precisar de um método de pagamento selecionado primeiro
   - Pode precisar de informações adicionais do cliente

4. **❌ Endpoint Específico Necessário**
   - Pode existir um endpoint específico na API para obter a URL de pagamento
   - Pode ser necessário chamar `/v1/transfers/{transferId}/payment` ou similar

---

## ✅ SOLUÇÃO IMPLEMENTADA

### Estratégia de Múltiplas Tentativas

Implementei uma estratégia com múltiplas tentativas para encontrar a URL de pagamento correta:

**Prioridade 1**: Verificar campos de URL no transfer object
```typescript
if (transfer.paymentLink || transfer.payment_url || transfer.payinUrl || transfer.payin_url || transfer.paymentUrl) {
  paymentUrl = transfer.paymentLink || transfer.payment_url || transfer.payinUrl || transfer.payin_url || transfer.paymentUrl;
}
```

**Prioridade 2**: Buscar transfer novamente para verificar campos adicionais
```typescript
const transferDetails = await wiseClient.getTransferStatus(transfer.id.toString());
if (transferDetails.paymentLink || transferDetails.payment_url || transferDetails.payinUrl || transferDetails.payin_url) {
  paymentUrl = transferDetails.paymentLink || transferDetails.payment_url || transferDetails.payinUrl || transferDetails.payin_url;
}
```

**Prioridade 3**: Usar payinSessionId com formato correto `/r/`
```typescript
// Formato correto: https://wise.com/pay/r/{payinSessionId} (com /r/)
if (transfer.payinSessionId) {
  paymentUrl = `https://wise.com/pay/r/${transfer.payinSessionId}`;
}
```

**Prioridade 4**: Fallback com transfer ID
```typescript
// Formato: https://wise.com/payments/{transferId}
paymentUrl = `https://wise.com/payments/${transfer.id}`;
```

### Arquivo Atualizado

- `supabase/functions/create-wise-checkout/index.ts` (linha ~420-480)
- Deploy realizado: versão 22

---

## 🔧 PRÓXIMOS PASSOS PARA TESTE

### 1. Testar Nova URL

Teste a URL gerada com o formato `/payments/{transferId}`:
- Sandbox: `https://sandbox.wise.com/payments/{transferId}`
- Production: `https://wise.com/payments/{transferId}`

### 2. Verificar Transfer Object

Verifique se o objeto `transfer` retornado pela API contém:
- `paymentLink` ou `payment_url` (URL direta fornecida pela Wise)
- `payinSessionId` (pode não ser usado para URL pública)
- `status` (deve ser `incoming_payment_waiting`)

### 3. Consultar Documentação Wise

Verifique na documentação oficial da Wise:
- Formato correto da URL de pagamento para clientes
- Se há endpoint específico para obter URL de pagamento
- Se `payinSessionId` é usado apenas internamente

### 4. Contatar Suporte Wise

Se o problema persistir, contate o suporte da Wise:
- Email: `partnerwise@wise.com`
- Explique que está usando Personal Token
- Pergunte sobre o formato correto da URL de pagamento
- Mencione que `/pay/{payinSessionId}` retorna 404

---

## 📝 LOGS LIMPOS

Removidos logs desnecessários que estavam poluindo a visualização:

- ✅ Removidos logs detalhados de token (length, format, etc.)
- ✅ Removidos logs verbosos de respostas da API
- ✅ Removidos logs de debug de recipient details
- ✅ Mantidos apenas logs essenciais para debug

**Logs Mantidos**:
- Environment e configuração básica
- IDs de Quote, Recipient, Transfer
- Status do transfer
- URL de pagamento gerada
- Erros importantes

---

## 🔍 INVESTIGAÇÃO ADICIONAL NECESSÁRIA

### Verificar na Documentação Wise

1. **Formato de URL de Pagamento**
   - Qual é o formato correto da URL para redirecionar clientes?
   - `/pay/{payinSessionId}` ou `/payments/{transferId}`?

2. **Endpoint para Obter URL**
   - Existe endpoint específico como `/v1/transfers/{transferId}/payment`?
   - Ou `/v1/transfers/{transferId}/payment-url`?

3. **Uso do payinSessionId**
   - `payinSessionId` é usado apenas internamente?
   - Ou pode ser usado para construir URL pública?

### Possíveis Soluções Alternativas

1. **Usar Transfer ID**
   - Formato: `https://wise.com/payments/{transferId}`
   - Mais comum e documentado

2. **Obter URL da API**
   - Chamar endpoint específico para obter URL de pagamento
   - Usar URL retornada diretamente pela API

3. **Verificar Status do Transfer**
   - Transfer pode precisar estar em estado específico
   - Pode precisar de método de pagamento selecionado

---

## 📊 RESUMO

- **Problema**: URLs de pagamento retornam 404 (`/pay/{payinSessionId}` e `/payments/{transferId}`)
- **Solução Implementada**: Estratégia com múltiplas tentativas:
  1. Verificar campos de URL no transfer object
  2. Buscar transfer novamente para campos adicionais
  3. Tentar formato com hash: `https://wise.com/pay#{payinSessionId}`
  4. Fallback: `https://wise.com/payments/{transferId}`
- **Status**: Aguardando teste com novos formatos
- **Próximo Passo**: 
  - Testar URL gerada e verificar qual formato foi usado (ver logs)
  - Se todos falharem, pode ser limitação do Personal Token - contatar Wise

---

**Última Atualização**: 2026-01-12
