# 🧪 Guia de Testes - Sistema de Split Payment

## 📋 Pré-requisitos

### 1. Ambiente de Desenvolvimento
- ✅ Servidor local rodando (`npm run dev`)
- ✅ Supabase conectado
- ✅ Edge Functions deployadas (ou rodando localmente)

### 2. Migração do Banco de Dados
```bash
# Aplicar migração no Supabase
supabase db push

# OU via Supabase Dashboard:
# 1. Acesse: https://supabase.com/dashboard/project/[seu-projeto]/sql
# 2. Cole o conteúdo de: supabase/migrations/20260203000000_create_split_payments.sql
# 3. Execute
```

### 3. Deploy das Edge Functions
```bash
# Deploy create-split-parcelow-checkout
supabase functions deploy create-split-parcelow-checkout

# Deploy get-next-split-checkout
supabase functions deploy get-next-split-checkout

# Deploy parcelow-webhook (atualizado)
supabase functions deploy parcelow-webhook
```

---

## 🧪 Testes Funcionais

### **Teste 1: UI do Split Payment Selector**

#### Objetivo
Verificar se o componente de split payment aparece e funciona corretamente.

#### Passos
1. Acesse: `http://localhost:5173/checkout/visa/b1-premium`
2. Preencha **Step 1** (Informações Pessoais)
3. Preencha **Step 2** (Upload de Documentos)
4. No **Step 3**:
   - Aceite os termos
   - Confirme a assinatura
   - Selecione método de pagamento: **Parcelow**

#### Resultado Esperado
✅ Deve aparecer um botão: **"Dividir Pagamento em 2 Partes"**

---

### **Teste 2: Ativação do Split Payment**

#### Passos
1. Clique em **"Dividir Pagamento em 2 Partes"**

#### Resultado Esperado
✅ Deve aparecer um card com:
- Total a pagar (ex: $400.00)
- Slider para ajustar valores
- Seleção de métodos para Part 1 (Cartão/PIX/TED)
- Seleção de métodos para Part 2 (Cartão/PIX/TED)
- Resumo do split

---

### **Teste 3: Validação de Métodos Duplicados**

#### Passos
1. Ative o split payment
2. Selecione **Cartão** para Part 1
3. Tente selecionar **Cartão** para Part 2

#### Resultado Esperado
✅ Part 2 deve automaticamente mudar para outro método (PIX ou TED)
✅ Deve aparecer mensagem: "⚠️ Os métodos de pagamento devem ser diferentes"

---

### **Teste 4: Ajuste de Valores com Slider**

#### Passos
1. Ative o split payment
2. Mova o slider para ajustar Part 1
3. Observe Part 2 sendo recalculada automaticamente

#### Resultado Esperado
✅ Part 1 + Part 2 = Total (sempre)
✅ Valores devem ser atualizados em tempo real
✅ Resumo deve mostrar valores corretos

---

### **Teste 5: Criação de Split Payment (Backend)**

#### Passos
1. Configure split payment:
   - Part 1: $200 - Cartão
   - Part 2: $200 - PIX
2. Preencha **Nome no Cartão** e **CPF**
3. Clique em **"Pay with Parcelow"**

#### Resultado Esperado
✅ Console deve mostrar:
```
[Parcelow] 🔍 Verificando se é split payment...
[Parcelow] 🎯 SPLIT PAYMENT DETECTADO!
[Parcelow Split] ✅ Order criada: [uuid]
[Parcelow Split] 🔄 Chamando create-split-parcelow-checkout...
[Parcelow Split] ✅ Split checkout criado
[Parcelow Split] 🚀 Redirecionando para Part 1...
```

✅ Deve redirecionar para checkout Parcelow (Part 1)

---

### **Teste 6: Verificação no Banco de Dados**

#### Passos
1. Após criar split payment, acesse Supabase Dashboard
2. Vá para **Table Editor** → `split_payments`

#### Resultado Esperado
✅ Deve existir um registro com:
- `order_id`: UUID da order
- `total_amount_usd`: 400.00
- `part1_amount_usd`: 200.00
- `part1_payment_method`: 'card'
- `part2_amount_usd`: 200.00
- `part2_payment_method`: 'pix'
- `part1_parcelow_checkout_url`: URL válida
- `part2_parcelow_checkout_url`: URL válida
- `overall_status`: 'pending'

---

### **Teste 7: Simulação de Webhook - Part 1 Paga**

#### Passos
1. Simule webhook Parcelow enviando:
```json
{
  "event": "event_order_paid",
  "order": {
    "id": "[part1_parcelow_order_id]",
    "status": "paid",
    "status_text": "Paid",
    "total_usd": 20000,
    "total_brl": 1000,
    "payments": [{
      "total_brl": 1000,
      "installments": 1
    }]
  }
}
```

#### Resultado Esperado
✅ Console do webhook deve mostrar:
```
[Split Webhook] 🎯 Processando webhook de split payment...
[Split Webhook] 📦 Parte detectada: Part 1
[Split Webhook] 💰 Part 1 PAGA! Atualizando banco...
[Split Webhook] ⏳ Apenas Part 1 paga. Aguardando Part 2...
```

✅ No banco, `split_payments` deve ter:
- `part1_payment_status`: 'completed'
- `part1_completed_at`: timestamp
- `overall_status`: 'part1_completed'

✅ **NÃO** deve gerar contratos ainda

---

### **Teste 8: Página de Redirecionamento**

#### Passos
1. Acesse: `http://localhost:5173/checkout/split-payment/redirect?split_payment_id=[uuid]`

#### Resultado Esperado
✅ Deve mostrar:
- ✅ "Primeira Parte Paga!"
- Resumo com Part 1 marcada (✅) e Part 2 pendente
- Countdown de 3 segundos
- Botão "Ir para Próximo Pagamento Agora"

✅ Após 3 segundos, deve redirecionar para Part 2 checkout URL

---

### **Teste 9: Simulação de Webhook - Part 2 Paga**

#### Passos
1. Simule webhook Parcelow enviando:
```json
{
  "event": "event_order_paid",
  "order": {
    "id": "[part2_parcelow_order_id]",
    "status": "paid",
    "status_text": "Paid",
    "total_usd": 20000,
    "total_brl": 1000,
    "payments": [{
      "total_brl": 1000,
      "installments": 1
    }]
  }
}
```

#### Resultado Esperado
✅ Console do webhook deve mostrar:
```
[Split Webhook] 🎯 Processando webhook de split payment...
[Split Webhook] 📦 Parte detectada: Part 2
[Split Webhook] 💰 Part 2 PAGA! Atualizando banco...
[Split Webhook] 🎉 AMBAS AS PARTES PAGAS! Finalizando pedido...
[Split Webhook] 📄 Gerando contratos e documentos...
[Split Webhook] 📧 Enviando email de confirmação...
[Split Webhook] 🎉 Split payment totalmente processado!
```

✅ No banco, `split_payments` deve ter:
- `part2_payment_status`: 'completed'
- `part2_completed_at`: timestamp
- `overall_status`: 'fully_completed'

✅ No banco, `visa_orders` deve ter:
- `payment_status`: 'completed'
- `parcelow_status`: 'Paid (Split)'

✅ **DEVE** gerar todos os PDFs:
- Contract PDF
- Annex PDF
- Invoice PDF

✅ **DEVE** enviar email de confirmação

---

## 🔍 Testes de Edge Cases

### **Teste 10: Split Payment Desativado**

#### Passos
1. No Step 3, selecione Parcelow
2. **NÃO** ative split payment
3. Clique em "Pay with Parcelow"

#### Resultado Esperado
✅ Console deve mostrar:
```
[Parcelow] 🔍 Verificando se é split payment...
[Parcelow] ℹ️ Pagamento normal (não é split)
```

✅ Deve seguir fluxo normal de Parcelow (sem split)

---

### **Teste 11: Valores Inválidos**

#### Passos
1. Tente criar split com Part 1 = $0
2. Tente criar split com Part 1 = Total

#### Resultado Esperado
✅ Slider deve ter limites: min=$1, max=Total-1
✅ Não deve permitir valores inválidos

---

### **Teste 12: Webhook com Order ID Inválido**

#### Passos
1. Envie webhook com `order_id` que não existe em `split_payments`

#### Resultado Esperado
✅ Webhook deve processar como pagamento normal
✅ Não deve dar erro

---

## 📊 Checklist de Validação Final

Antes de considerar o sistema pronto para produção:

- [ ] ✅ UI do Split Payment Selector funciona
- [ ] ✅ Validação de métodos duplicados funciona
- [ ] ✅ Slider ajusta valores corretamente
- [ ] ✅ Backend cria split payment corretamente
- [ ] ✅ Registro em `split_payments` está correto
- [ ] ✅ Webhook detecta split payment
- [ ] ✅ Webhook atualiza Part 1 corretamente
- [ ] ✅ Webhook **NÃO** gera contratos após Part 1
- [ ] ✅ Página de redirecionamento funciona
- [ ] ✅ Countdown funciona
- [ ] ✅ Redirecionamento para Part 2 funciona
- [ ] ✅ Webhook atualiza Part 2 corretamente
- [ ] ✅ Webhook **GERA** contratos após Part 2
- [ ] ✅ Email de confirmação é enviado
- [ ] ✅ Fluxo normal (sem split) ainda funciona

---

## 🐛 Troubleshooting

### Problema: Split Payment Selector não aparece
**Solução:** Verifique se `paymentMethod === 'parcelow'` está correto

### Problema: Erro ao criar split payment
**Solução:** Verifique logs do console e Edge Function logs no Supabase

### Problema: Webhook não detecta split
**Solução:** Verifique se `part1_parcelow_order_id` e `part2_parcelow_order_id` estão corretos

### Problema: Contratos gerados após Part 1
**Solução:** Verifique lógica do webhook - só deve gerar quando `bothPartsPaid === true`

### Problema: Redirecionamento não funciona
**Solução:** Verifique se URLs de checkout estão corretas em `split_payments`

---

## 📝 Logs Importantes para Monitorar

### Frontend (Console do Browser)
```
[Parcelow] 🔍 Verificando se é split payment...
[Parcelow] 🎯 SPLIT PAYMENT DETECTADO!
[Parcelow Split] ✅ Order criada
[Parcelow Split] 🔄 Chamando create-split-parcelow-checkout...
[Parcelow Split] ✅ Split checkout criado
[Parcelow Split] 🚀 Redirecionando para Part 1...
```

### Backend (Supabase Edge Function Logs)
```
[Split Checkout] Iniciando criação de split payment...
[Split Checkout] Request: { order_id, part1: "card - $200", part2: "pix - $200" }
[Split Checkout] ✅ Order encontrada
[Split Checkout] ✅ Validação passou
[Split Checkout] ✅ Split payment criado
[Split Checkout] 🔄 Criando checkout Part 1 (Parcelow)...
[Split Checkout] 🔄 Criando checkout Part 2 (Parcelow)...
[Split Checkout] ✅ Ambos os checkouts criados
```

### Webhook (Supabase Edge Function Logs)
```
[Split Webhook] 🎯 Processando webhook de split payment...
[Split Webhook] 📦 Parte detectada: Part 1
[Split Webhook] 💰 Part 1 PAGA! Atualizando banco...
[Split Webhook] ⏳ Apenas Part 1 paga. Aguardando Part 2...
```

---

## ✅ Conclusão

Após completar todos os testes acima, o sistema de Split Payment estará validado e pronto para uso em produção! 🎉
