# 🔍 Erro: URL de Pagamento Wise Retorna "Página Não Existe"

**Data**: 2026-01-12  
**Erro**: `https://wise.com/payments/{transferId}` retorna "Desculpe, parece que esta página não existe mais"

---

## 🔍 DIAGNÓSTICO DO PROBLEMA

### Problema Identificado

Quando você tenta acessar a URL de pagamento do Wise (mesmo após fazer login), recebe um erro dizendo que a página não existe mais.

### Causas Possíveis

1. **❌ Ambiente Incorreto (PRINCIPAL)**
   - Código está usando **sandbox** (`WISE_ENVIRONMENT=sandbox`)
   - Mas URL está apontando para **production** (`https://wise.com/payments/...`)
   - Transfer foi criado no **sandbox**, mas URL aponta para **production**
   - Resultado: Transfer não existe em production, então página não existe

2. **❌ Transfer Não Fundado**
   - Com Personal Token, não podemos fundar transfers via API
   - Transfer pode estar em estado `incoming_payment_waiting`
   - URL de pagamento pode não estar disponível até transfer ser fundado

3. **❌ Transfer Expirado ou Cancelado**
   - Transfer pode ter expirado (quotes expiram em 30 minutos)
   - Transfer pode ter sido cancelado
   - URL não funciona mais

4. **❌ Formato de URL Incorreto**
   - URL pode precisar de parâmetros adicionais
   - URL pode ser diferente para sandbox vs production

---

## ✅ SOLUÇÃO IMPLEMENTADA

### Correção no Código

Atualizei o código para usar a URL correta baseada no ambiente:

**Antes**:
```typescript
const paymentUrl = `https://wise.com/payments/${transfer.id}`;
```

**Depois**:
```typescript
// Verificar ambiente e construir URL correta
if (wiseEnvironment === 'sandbox') {
  paymentUrl = `https://sandbox.wise.com/payments/${transfer.id}`;
} else {
  paymentUrl = `https://wise.com/payments/${transfer.id}`;
}
```

### Arquivo Atualizado

- `supabase/functions/create-wise-checkout/index.ts` (linha ~563)

---

## 🔧 VERIFICAÇÕES ADICIONAIS

### 1. Verificar Ambiente Configurado

**No Supabase Dashboard**:
- Variável `WISE_ENVIRONMENT` deve ser:
  - `sandbox` para testes
  - `production` para produção

**Verificar logs**:
```
[Wise Checkout] Environment: sandbox
[Wise Checkout] Payment URL: https://sandbox.wise.com/payments/1917267072
```

### 2. Verificar Status do Transfer

O transfer precisa estar em um estado válido para ter URL de pagamento:

**Estados válidos**:
- `incoming_payment_waiting` ✅ (aguardando pagamento)
- `processing` ✅ (processando)

**Estados inválidos**:
- `cancelled` ❌
- `funds_refunded` ❌
- `bounced_back` ❌

### 3. Verificar se Transfer Existe

**No Sandbox**:
- Acesse: https://sandbox.wise.com
- Faça login com conta sandbox
- Verifique se transfer existe

**No Production**:
- Acesse: https://wise.com
- Faça login com conta production
- Verifique se transfer existe

---

## 📋 PASSOS PARA RESOLVER

### Passo 1: Verificar Ambiente

1. Acesse Supabase Dashboard
2. Vá em **Edge Functions** > **create-wise-checkout** > **Settings**
3. Verifique variável `WISE_ENVIRONMENT`
4. Se estiver em `sandbox`, URL deve ser `sandbox.wise.com`
5. Se estiver em `production`, URL deve ser `wise.com`

### Passo 2: Verificar Transfer no Ambiente Correto

**Se usando Sandbox**:
1. Acesse https://sandbox.wise.com
2. Faça login com conta sandbox (não conta production!)
3. Procure pelo transfer ID nos logs
4. Verifique se transfer existe e está acessível

**Se usando Production**:
1. Acesse https://wise.com
2. Faça login com conta production
3. Verifique se transfer existe

### Passo 3: Testar Nova URL

Após deploy da correção:

1. Criar novo checkout Wise
2. Verificar logs para URL gerada:
   ```
   [Wise Checkout] Environment: sandbox
   [Wise Checkout] Payment URL: https://sandbox.wise.com/payments/{transferId}
   ```
3. Acessar URL no ambiente correto (sandbox ou production)

---

## ⚠️ LIMITAÇÕES DO PERSONAL TOKEN

### O que Personal Token NÃO pode fazer:

1. **❌ Fundar transfers via API**
   - Transfer precisa ser fundado manualmente ou pelo cliente
   - Cliente precisa fazer login na Wise para fundar

2. **❌ Obter URL de pagamento via API**
   - Wise API não fornece URL de pagamento diretamente
   - Precisamos construir URL manualmente

3. **❌ Ver balance statements**
   - Limitação devido a PSD2

### O que Personal Token PODE fazer:

1. **✅ Criar quotes**
2. **✅ Criar recipients**
3. **✅ Criar transfers**
4. **✅ Ver status de transfers**
5. **✅ Receber webhooks**

---

## 🔄 FLUXO CORRETO COM PERSONAL TOKEN

### 1. Criar Transfer (via API)
- Sistema cria quote, recipient e transfer
- Transfer fica em estado `incoming_payment_waiting`

### 2. Obter URL de Pagamento
- Sistema constrói URL baseada no ambiente:
  - Sandbox: `https://sandbox.wise.com/payments/{transferId}`
  - Production: `https://wise.com/payments/{transferId}`

### 3. Cliente Acessa URL
- Cliente é redirecionado para Wise
- **Cliente precisa fazer login** (limitação do Personal Token)
- Cliente completa pagamento na plataforma Wise

### 4. Webhook Confirma Pagamento
- Wise envia webhook quando pagamento é confirmado
- Sistema atualiza pedido para `payment_status = 'completed'`

---

## 📝 NOTAS IMPORTANTES

### Sandbox vs Production

**Sandbox**:
- URL: `https://sandbox.wise.com/payments/{transferId}`
- Requer conta sandbox separada
- Não usa dinheiro real
- Para testes

**Production**:
- URL: `https://wise.com/payments/{transferId}`
- Usa conta production
- Usa dinheiro real
- Para produção

### Transfer ID

- Transfer ID é numérico (ex: `1917267072`)
- Deve corresponder ao ambiente correto
- Transfer criado em sandbox não existe em production (e vice-versa)

---

## ✅ CHECKLIST DE RESOLUÇÃO

- [ ] Verificar `WISE_ENVIRONMENT` no Supabase
- [ ] Verificar se URL está usando ambiente correto
- [ ] Verificar se transfer existe no ambiente correto
- [ ] Verificar se está fazendo login no ambiente correto
- [ ] Testar criação de novo transfer após correção
- [ ] Verificar logs para confirmar URL gerada

---

## 🔗 LINKS ÚTEIS

- **Wise Sandbox**: https://sandbox.wise.com
- **Wise Production**: https://wise.com
- **Wise API Docs**: https://docs.wise.com/api-reference/
- **Ambientes Wise**: https://docs.wise.com/api-docs/api-reference/environments

---

**Última atualização**: 2026-01-12
