# 🎯 Nova Estrutura de Produtos - MIGMA Visa Services

## ✅ ALTERAÇÕES IMPLEMENTADAS COM SUCESSO

### 1. **Banco de Dados** ✅

#### Novos Campos em `visa_products`:
- `allow_extra_units` (boolean) - Permite unidades extras
- `extra_unit_label` (text) - Label customizado (ex: "Number of dependents", "Number of RFEs")
- `extra_unit_price` (decimal) - Preço por unidade extra
- `calculation_type` (text) - Tipo de cálculo: `base_plus_units` ou `units_only`

#### Novos Campos em `visa_orders`:
- `extra_units` (integer) - Número de unidades extras
- `extra_unit_label` (text) - Label usado no pedido
- `extra_unit_price_usd` (decimal) - Preço por unidade no momento do pedido
- `calculation_type` (text) - Tipo de cálculo usado

### 2. **Produtos Disponíveis** ✅

Agora você tem **10 produtos** no total:

#### 🇺🇸 **Produtos USA (Original + Novos)**

| Slug | Nome | Base | Por Unidade | Cálculo |
|------|------|------|-------------|---------|
| `initial` | U.S. Visa - Initial Application (F1) | $999 | $150/dep | base + units |
| `b1-premium` | U.S. Visa B1 - Premium Plan | $1,200 | $180/dep | base + units |
| `b1-basic` | U.S. Visa B1 - Basic Plan | $800 | $120/dep | base + units |
| `b1-brant` | U.S. B1 Brant Plan | $900 | $99/dep | base + units |
| `b1-revolution` | U.S. B1 Revolution Plan | $299 | $49/dep | base + units |

#### 🇨🇦 **Produtos Canadá (NOVOS)**

| Slug | Nome | Base | Por Unidade | Cálculo |
|------|------|------|-------------|---------|
| `canada-work` | Canada Work Consultancy | $1,800 | $150/dep | base + units |
| `canada-tourist-brant` | Canada Tourist - Brant Plan | $900 | $99/dep | base + units |
| `canada-tourist-revolution` | Canada Tourist - Revolution ETA | $299 | $49/dep | base + units |

#### 📋 **Produtos de Defesa (NOVOS)**

| Slug | Nome | Base | Por Unidade | Label | Cálculo |
|------|------|------|-------------|-------|---------|
| `rfe-defense` | RFE Defense | $0 | $250/RFE | "How many evidence requests (RFEs) are being issued?" | **units only** |
| `visa-retry-defense` | Defense - Visa Retry | $0 | $99/applicant | "Number of applicants" | **units only** |

---

## 🧮 TIPOS DE CÁLCULO

### **base_plus_units** (Produtos normais)
```
Total = base_price + (extra_units × extra_unit_price)
```

**Exemplo - Canada Work:**
- Base: $1,800
- 2 dependentes × $150 = $300
- **Total: $2,100**

### **units_only** (Produtos de defesa)
```
Total = extra_units × extra_unit_price
```

**Exemplo - RFE Defense:**
- Base: $0
- 3 RFEs × $250 = $750
- **Total: $750**

---

## 🧪 COMO TESTAR AGORA

### 1. **Produtos USA Originais** (Já Funcionavam)

```bash
http://localhost:5173/checkout/visa/initial?seller=TEST01
http://localhost:5173/checkout/visa/b1-premium?seller=TEST02
http://localhost:5173/checkout/visa/b1-basic?seller=TEST03
```

### 2. **Novos Produtos USA**

```bash
http://localhost:5173/checkout/visa/b1-brant?seller=NATALIA-RJ
http://localhost:5173/checkout/visa/b1-revolution?seller=MIGMA-SP
```

### 3. **Produtos Canadá** (NOVOS)

```bash
http://localhost:5173/checkout/visa/canada-work?seller=JOAO01
http://localhost:5173/checkout/visa/canada-tourist-brant?seller=JOAO01
http://localhost:5173/checkout/visa/canada-tourist-revolution?seller=JOAO01
```

### 4. **Produtos de Defesa** (NOVOS - Sem preço base!)

```bash
# RFE Defense - Digite quantos RFEs você tem
http://localhost:5173/checkout/visa/rfe-defense?seller=MATHEUS

# Visa Retry Defense - Digite quantos aplicantes
http://localhost:5173/checkout/visa/visa-retry-defense?seller=MARIA
```

---

## 🎬 FLUXOS DE TESTE

### Teste 1: Produto Normal (Canada Work)

1. **Abra:** `http://localhost:5173/checkout/visa/canada-work?seller=TEST`
2. **Veja:**
   - Base Price: US$ 1,800.00
   - Per dependent: US$ 150.00
3. **Adicione 2 dependentes**
4. **Veja o cálculo automático:**
   - Base: $1,800
   - Dependents (2): $300
   - **Total: $2,100**

### Teste 2: Produto "Units Only" (RFE Defense)

1. **Abra:** `http://localhost:5173/checkout/visa/rfe-defense?seller=TEST`
2. **Veja:**
   - NO base price exibido (é $0)
   - Label customizado: "How many evidence requests (RFEs) are being issued?"
   - Price per unit: US$ 250.00
3. **Digite 3 RFEs**
4. **Veja o cálculo:**
   - RFEs (3): $750
   - **Total: $750** (sem base!)

### Teste 3: Produto Revolution (Preço baixo)

1. **Abra:** `http://localhost:5173/checkout/visa/b1-revolution?seller=TEST`
2. **Veja:**
   - Base Price: US$ 299.00
   - Per dependent: US$ 49.00
3. **Adicione 1 dependente**
4. **Veja:**
   - Base: $299
   - Dependents (1): $49
   - **Total: $348**

---

## 📊 DIFERENÇAS ENTRE PRODUTOS

### **Brant vs Revolution** (Mesma categoria)

#### B1 Brant:
- Base: $900
- Por dependente: $99
- **Para 2 dependentes:** $900 + $198 = **$1,098**

#### B1 Revolution:
- Base: $299
- Por dependente: $49
- **Para 2 dependentes:** $299 + $98 = **$397**

**Diferença:** Revolution é mais barato, Brant tem mais suporte.

---

## 🔍 VERIFICAR NO BANCO DE DADOS

```sql
-- Ver todos os produtos
SELECT 
  slug,
  name,
  base_price_usd,
  extra_unit_price,
  extra_unit_label,
  calculation_type
FROM visa_products
ORDER BY slug;

-- Ver pedidos com a nova estrutura
SELECT 
  order_number,
  product_slug,
  seller_id,
  extra_units,
  extra_unit_label,
  calculation_type,
  total_price_usd,
  created_at
FROM visa_orders
ORDER BY created_at DESC
LIMIT 10;
```

---

## ✨ O QUE MUDOU NO SISTEMA

### **Antes:**
- ❌ Campo fixo "Number of dependents"
- ❌ Sempre tinha preço base
- ❌ Cálculo único: base + (deps × preço)

### **Agora:**
- ✅ Label dinâmico por produto
- ✅ Pode ter base $0 (units_only)
- ✅ Dois tipos de cálculo
- ✅ Mais flexível para novos produtos

---

## 🎯 EXEMPLOS DE LINKS PARA VENDEDORES

### Vendedor: João (vende Canadá)

```
https://migma.com/checkout/visa/canada-work?seller=JOAO01
https://migma.com/checkout/visa/canada-tourist-brant?seller=JOAO01
https://migma.com/checkout/visa/canada-tourist-revolution?seller=JOAO01
```

### Vendedor: Natália (vende B1)

```
https://migma.com/checkout/visa/b1-brant?seller=NATALIA-RJ
https://migma.com/checkout/visa/b1-revolution?seller=NATALIA-RJ
```

### Vendedor: Matheus (especialista em defesas)

```
https://migma.com/checkout/visa/rfe-defense?seller=MATHEUS
https://migma.com/checkout/visa/visa-retry-defense?seller=MATHEUS
```

---

## 🚀 PRÓXIMOS PASSOS

1. ✅ **Banco de dados** - Atualizado
2. ✅ **Frontend** - Atualizado (labels dinâmicos, cálculo por tipo)
3. ✅ **Backend** - Edge Function deployada (v3)
4. ⏳ **Configurar Stripe** - Adicionar as chaves de teste
5. ⏳ **Testar pagamentos** - Usar cartão de teste
6. ⏳ **Adicionar mais produtos** - Conforme necessário

---

## 📝 COMO ADICIONAR NOVOS PRODUTOS

### Via SQL:

```sql
INSERT INTO visa_products (
  slug,
  name,
  description,
  base_price_usd,
  extra_unit_price,
  extra_unit_label,
  calculation_type,
  is_active
) VALUES (
  'novo-produto',
  'Nome do Produto',
  'Descrição completa',
  500.00,                    -- Base (ou 0 para units_only)
  75.00,                     -- Por unidade extra
  'Number of dependents',    -- Label customizado
  'base_plus_units',         -- ou 'units_only'
  true
);
```

### Tipos de Produtos que Você Pode Criar:

1. **Com base + dependentes:** `calculation_type = 'base_plus_units'`
   - Vistos normais
   - Consultoria com aplicante principal + dependentes

2. **Só unidades:** `calculation_type = 'units_only'`
   - Defesas
   - Serviços por quantidade (RFEs, appeals, etc)
   - Documentos por unidade

---

## 🎉 TUDO PRONTO!

O sistema agora suporta:
- ✅ 10 produtos diferentes
- ✅ Labels customizados
- ✅ Dois tipos de cálculo
- ✅ Produtos com e sem base
- ✅ Sistema de vendedores (seller tracking)
- ✅ Zelle funciona sem Stripe
- ✅ Pronto para receber as chaves do Stripe

**Pode começar a testar todos os produtos agora! 🚀**
















