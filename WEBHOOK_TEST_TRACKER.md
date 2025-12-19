# 🧪 Webhook Test Tracker - Testes Manuais

## 📋 Lista de Serviços para Testar

### ✅ Status dos Testes
- ⬜ = Não testado
- ✅ = Testado e funcionando
- ❌ = Testado com erro
- 🔄 = Em teste

---

## 📦 **GRUPO 1: Consultas e Serviços Base**

### 1. Consulta com Matheus Brant
- **Slug:** `consultation-brant`
- **Preço:** US$ 500.00
- **Dependentes:** Não
- **Status:** ⬜
- **Notas:** 

### 2. Consulta comum
- **Slug:** `consultation-common`
- **Preço:** US$ 29.00
- **Dependentes:** Não
- **Status:** ⬜
- **Notas:** 

### 3. F1 Initial
- **Slug:** `initial`
- **Preço:** US$ 999.00 (⚠️ Cliente espera US$ 1.800)
- **Dependentes:** Sim (US$ 150/dep)
- **Status:** ⬜
- **Notas:** ⚠️ **ATENÇÃO:** Preço no sistema está diferente do esperado pelo cliente

### 4. COS & Transfer
- **Slug:** `cos-selection-process`, `cos-scholarship`, `cos-i20-control`, `transfer-selection-process`, `transfer-scholarship`, `transfer-i20-control`
- **Preço:** Varia (Selection Process: $400, Scholarship: $900, I-20: $900)
- **Dependentes:** Sim (Selection Process: $150/dep)
- **Status:** ⬜
- **Notas:** ⚠️ Cliente mencionou "US$ 1.800" mas temos produtos separados

### 5. Consultoria Canadá (trabalho)
- **Slug:** `canada-work`
- **Preço:** US$ 1,800.00
- **Dependentes:** Sim (US$ 150/dep)
- **Status:** ⬜
- **Notas:** 

---

## 📦 **GRUPO 2: Visto B1**

### 6. Visto B1 - Plano Brant
- **Slug:** `b1-brant`
- **Preço:** US$ 900.00
- **Dependentes:** Sim (US$ 99/dep)
- **Status:** ⬜
- **Notas:** 

### 7. Visto B1 - Plano Revolution
- **Slug:** `b1-revolution`
- **Preço:** US$ 299.00
- **Dependentes:** Sim (US$ 49/dep)
- **Status:** ⬜
- **Notas:** 

---

## 📦 **GRUPO 3: Defesas**

### 8. Defesa por solicitante
- **Slug:** `visa-retry-defense`
- **Preço:** US$ 99.00 por solicitante
- **Tipo:** units_only (sem base, só por unidade)
- **Status:** ⬜
- **Notas:** 

### 9. RFE (defesa de híbrido/estudante)
- **Slug:** `rfe-defense`
- **Preço:** US$ 250.00 por evidência
- **Tipo:** units_only (sem base, só por unidade)
- **Status:** ⬜
- **Notas:** 

---

## 📦 **GRUPO 4: Vistos Premium**

### 10. Visto O-1
- **Slug:** `o1-visa`
- **Preço:** US$ 11,000.00
- **Dependentes:** Sim (US$ 1,000/dep)
- **Status:** ⬜
- **Notas:** 

### 11. EB-3
- **Slug:** `eb3-visa`
- **Preço:** US$ 22,750.00
- **Dependentes:** Sim (US$ 1,000/dep)
- **Status:** ⬜
- **Notas:** 

### 12. EB-2
- **Slug:** `eb2-visa`
- **Preço:** US$ 24,750.00
- **Dependentes:** Sim (US$ 1,000/dep)
- **Status:** ⬜
- **Notas:** 

### 13. E-2, L-1
- **Slug:** `e2-l1-visa`
- **Preço:** US$ 12,999.00
- **Dependentes:** Sim (US$ 1,000/dep)
- **Status:** ⬜
- **Notas:** 

---

## 📊 **Resumo do Progresso**

### Contagem por Grupo:
- **GRUPO 1 (Consultas e Serviços Base):** 5 grupos → 9 produtos únicos
  - consultation-brant ✅
  - consultation-common ✅
  - F1 Initial (3 produtos): initial-selection-process ✅, initial-scholarship ✅, initial-i20-control ✅
  - COS (3 produtos): cos-selection-process ✅, cos-scholarship ✅, cos-i20-control ✅
  - Transfer (3 produtos): transfer-selection-process ✅, transfer-scholarship ✅, transfer-i20-control ✅
  - canada-work ✅

- **GRUPO 2 (Visto B1):** 2 produtos
  - b1-brant ✅
  - b1-revolution ✅

- **GRUPO 3 (Defesas):** 2 produtos
  - visa-retry-defense ✅
  - rfe-defense ✅

- **GRUPO 4 (Vistos Premium):** 4 produtos
  - o1-visa ✅
  - eb3-visa ✅
  - eb2-visa ✅
  - e2-l1-visa ✅

### Estatísticas:
- **Total de produtos únicos no sistema:** 24 produtos ativos
- **Total de produtos testados (da lista):** 19 produtos ✅
- **Produtos da lista ainda não testados:** 0 produtos ⬜
- **Produtos no sistema que NÃO estão na lista de testes:** 4 produtos ⚠️
  - ⬜ `b1-basic` - U.S. Visa B1 - Basic Plan (US$ 800.00 + US$ 120/dep)
  - ⬜ `b1-premium` - U.S. Visa B1 - Premium Plan (US$ 1,200.00 + US$ 180/dep)
  - ⬜ `canada-tourist-brant` - Canada Tourist Visa – Brant Plan (US$ 900.00 + US$ 99/dep)
  - ⬜ `canada-tourist-revolution` - Canada Tourist Visa – Revolution ETA (US$ 299.00 + US$ 49/dep)

### Resumo Final:
- ✅ **Testados:** 19 produtos (100% da lista de 13 grupos)
- ⬜ **Pendentes da lista:** 0 produtos
- ⚠️ **Produtos ativos no sistema NÃO testados:** 4 produtos
  - Esses produtos não estavam na lista original, mas estão ativos no sistema
  - Recomendação: Testar também para garantir que o webhook funciona para todos os produtos

---

## ⚠️ **PRODUTOS ATIVOS NÃO TESTADOS**

Estes produtos estão ativos no sistema mas **NÃO** estavam na lista original de testes:

### 1. Visto B1 - Basic Plan
- **Slug:** `b1-basic`
- **Preço:** US$ 800.00
- **Dependentes:** Sim (US$ 120/dep)
- **Status:** ⬜ **NÃO TESTADO**
- **Notas:** Produto ativo no sistema, mas não estava na lista original

### 2. Visto B1 - Premium Plan
- **Slug:** `b1-premium`
- **Preço:** US$ 1,200.00
- **Dependentes:** Sim (US$ 180/dep)
- **Status:** ⬜ **NÃO TESTADO**
- **Notas:** Produto ativo no sistema, mas não estava na lista original

### 3. Canada Tourist - Brant Plan
- **Slug:** `canada-tourist-brant`
- **Preço:** US$ 900.00
- **Dependentes:** Sim (US$ 99/dep)
- **Status:** ⬜ **NÃO TESTADO**
- **Notas:** Produto ativo no sistema, mas não estava na lista original

### 4. Canada Tourist - Revolution ETA
- **Slug:** `canada-tourist-revolution`
- **Preço:** US$ 299.00
- **Dependentes:** Sim (US$ 49/dep)
- **Status:** ⬜ **NÃO TESTADO**
- **Notas:** Produto ativo no sistema, mas não estava na lista original

---

## ✅ **Checklist de Verificação do Webhook**

Para cada teste, verificar se o webhook enviou:

1. ✅ `servico` - Nome do serviço correto
2. ✅ `plano_servico` - Slug correto
3. ✅ `nome_completo` - Nome do cliente
4. ✅ `whatsapp` - WhatsApp do cliente
5. ✅ `email` - Email do cliente
6. ✅ `valor_servico` - **VALOR BASE DO SERVIÇO** (sem dependentes, sem taxas)
7. ✅ `vendedor` - ID do vendedor

---

## 🔍 **O que verificar no payload do webhook:**

```json
{
  "servico": "Nome do serviço",
  "plano_servico": "slug-do-produto",
  "nome_completo": "Nome do Cliente",
  "whatsapp": "+55 11 98765 4321",
  "email": "cliente@email.com",
  "valor_servico": "500.00",  // ⚠️ DEVE SER O VALOR BASE, SEM DEPENDENTES E SEM TAXAS
  "vendedor": "seller-id"
}
```

---

## 📝 **Log de Testes**

### Teste #1 - [Data/Hora]
- **Serviço:** 
- **Resultado:** 
- **Payload recebido:** 
- **Observações:** 

---

## ⚠️ **LEMBRETE IMPORTANTE**

O campo `valor_servico` no webhook deve conter **APENAS o valor base do serviço** (`base_price_usd`), **SEM**:
- ❌ Dependentes
- ❌ Taxas do Stripe
- ❌ Taxas de conversão

Exemplo:
- Se o serviço custa $900 + $99/dep + taxas = $1,050 total
- O webhook deve enviar: `"valor_servico": "900.00"` ✅

