# 🚀 Guia Rápido de Testes - Webhook

## ✅ **CORREÇÃO APLICADA**

O webhook agora envia **apenas o valor base do serviço** (`base_price_usd`) no campo `valor_servico`, **SEM dependentes e SEM taxas**.

---

## 📋 **Lista Rápida para Testar (13 serviços)**

### **Grupo 1 - Consultas e Base**
1. ⬜ Consulta com Matheus Brant - `consultation-brant` - $500
2. ⬜ Consulta comum - `consultation-common` - $29
3. ⬜ F1 Initial - `initial` - $999 (⚠️ cliente espera $1,800)
4. ⬜ COS & Transfer - vários slugs (⚠️ verificar estrutura)
5. ⬜ Consultoria Canadá - `canada-work` - $1,800

### **Grupo 2 - B1**
6. ⬜ B1 Brant - `b1-brant` - $900 + $99/dep
7. ⬜ B1 Revolution - `b1-revolution` - $299 + $49/dep

### **Grupo 3 - Defesas**
8. ⬜ Defesa por solicitante - `visa-retry-defense` - $99/unidade
9. ⬜ RFE Defense - `rfe-defense` - $250/evidência

### **Grupo 4 - Premium**
10. ⬜ O-1 - `o1-visa` - $11,000 + $1,000/dep
11. ⬜ EB-3 - `eb3-visa` - $22,750 + $1,000/dep
12. ⬜ EB-2 - `eb2-visa` - $24,750 + $1,000/dep
13. ⬜ E-2, L-1 - `e2-l1-visa` - $12,999 + $1,000/dep

---

## 🔍 **O que verificar no webhook recebido:**

```json
{
  "servico": "Nome do serviço",
  "plano_servico": "slug-do-produto",
  "nome_completo": "Nome",
  "whatsapp": "+55...",
  "email": "email@email.com",
  "valor_servico": "500.00",  // ⚠️ DEVE SER O VALOR BASE APENAS
  "vendedor": "seller-id"
}
```

---

## 📝 **Como marcar progresso:**

Quando você testar um serviço, me avise:
- ✅ "Testei o [nome do serviço] - funcionou"
- ❌ "Testei o [nome do serviço] - deu erro: [descrição]"

Eu vou atualizando o tracker para você não se perder!

---

## ⚠️ **IMPORTANTE:**

- Use **Stripe Card** para todos os testes
- O `valor_servico` deve ser **APENAS o base_price_usd** (sem dep, sem taxas)
- Se encontrar algum erro, me avise imediatamente!

