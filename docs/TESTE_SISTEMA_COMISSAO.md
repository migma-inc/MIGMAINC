# 🧪 Guia de Testes - Sistema de Comissão

## ✅ Verificações Iniciais

### 1. Verificar se a tabela foi criada
```sql
SELECT * FROM seller_commissions LIMIT 1;
```

### 2. Verificar se as funções existem
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN (
    'get_commission_percentage',
    'calculate_net_amount',
    'calculate_seller_commission',
    'recalculate_monthly_commissions',
    'trigger_calculate_seller_commission'
  );
```

### 3. Verificar se o trigger está ativo
```sql
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trigger_calculate_seller_commission';
```

---

## 🧪 Testes Práticos

### **TESTE 1: Testar função de cálculo de percentual**

Testa se as faixas progressivas estão funcionando:

```sql
-- Testar diferentes valores
SELECT 
  1000.00 as valor,
  get_commission_percentage(1000.00) as percentual; -- Esperado: 0.50

SELECT 
  5000.00 as valor,
  get_commission_percentage(5000.00) as percentual; -- Esperado: 1.00

SELECT 
  12000.00 as valor,
  get_commission_percentage(12000.00) as percentual; -- Esperado: 2.00

SELECT 
  25000.00 as valor,
  get_commission_percentage(25000.00) as percentual; -- Esperado: 5.00
```

**Resultado esperado:**
- Até $4,999.99 → 0.50%
- $5,000 - $9,999.99 → 1.00%
- $10,000 - $14,999.99 → 2.00%
- $15,000 - $19,999.99 → 3.00%
- $20,000 - $24,999.99 → 4.00%
- A partir de $25,000 → 5.00%

---

### **TESTE 2: Testar cálculo de valor líquido**

```sql
-- Testar com fee_amount (Stripe)
SELECT calculate_net_amount(
  jsonb_build_object(
    'total_price_usd', '1000.00',
    'payment_metadata', jsonb_build_object('fee_amount', '39.00')
  )
) as net_amount; -- Esperado: 961.00

-- Testar sem fee_amount (Zelle)
SELECT calculate_net_amount(
  jsonb_build_object(
    'total_price_usd', '1000.00',
    'payment_metadata', NULL
  )
) as net_amount; -- Esperado: 1000.00
```

---

### **TESTE 3: Testar com order existente (se houver)**

Se você tiver uma order completa com seller_id:

```sql
-- Substituir 'ORDER_ID_AQUI' pelo ID real de uma order
SELECT calculate_seller_commission('ORDER_ID_AQUI'::UUID, 'monthly_accumulated');

-- Verificar se a comissão foi criada
SELECT * FROM seller_commissions 
WHERE order_id = 'ORDER_ID_AQUI'::UUID;
```

---

### **TESTE 4: Criar order de teste e verificar trigger**

**Opção A: Usar uma order existente e atualizar status**

```sql
-- 1. Buscar uma order com seller_id mas status diferente de 'completed'
SELECT id, order_number, seller_id, payment_status
FROM visa_orders
WHERE seller_id IS NOT NULL
  AND seller_id != ''
  AND payment_status != 'completed'
LIMIT 1;

-- 2. Atualizar para 'completed' (isso deve disparar o trigger)
-- SUBSTITUIR 'ORDER_ID' pelo ID real
UPDATE visa_orders
SET payment_status = 'completed'
WHERE id = 'ORDER_ID'::UUID;

-- 3. Verificar se a comissão foi criada automaticamente
SELECT * FROM seller_commissions
WHERE order_id = 'ORDER_ID'::UUID;
```

**Opção B: Criar order de teste completa**

```sql
-- 1. Criar order de teste
INSERT INTO visa_orders (
  order_number,
  product_slug,
  seller_id,
  total_price_usd,
  client_name,
  client_email,
  payment_method,
  payment_status,
  payment_metadata,
  created_at
) VALUES (
  'TEST-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0'),
  'initial-selection-process',
  'victordev', -- Usar um seller_id real
  3000.00,
  'Cliente Teste',
  'teste@example.com',
  'stripe_card',
  'completed',
  jsonb_build_object(
    'fee_amount', '117.00',
    'base_amount', '3000.00',
    'final_amount', '3117.00'
  ),
  NOW()
) RETURNING id, order_number;

-- 2. Verificar se a comissão foi criada (o trigger deve ter disparado)
SELECT 
  sc.*,
  vo.order_number,
  vo.total_price_usd
FROM seller_commissions sc
JOIN visa_orders vo ON sc.order_id = vo.id
WHERE vo.order_number LIKE 'TEST-%'
ORDER BY sc.created_at DESC;
```

---

### **TESTE 5: Testar cálculo acumulado mensal**

Simular múltiplas vendas no mesmo mês:

```sql
-- 1. Criar primeira venda (deve gerar comissão com 0.5%)
INSERT INTO visa_orders (
  order_number, product_slug, seller_id, total_price_usd,
  client_name, client_email, payment_method, payment_status,
  payment_metadata, created_at
) VALUES (
  'TEST-1-' || TO_CHAR(NOW(), 'YYYYMMDD'),
  'initial-selection-process',
  'victordev',
  3000.00,
  'Cliente 1',
  'cliente1@test.com',
  'stripe_card',
  'completed',
  jsonb_build_object('fee_amount', '117.00'),
  NOW()
) RETURNING id;

-- 2. Verificar primeira comissão (deve ser 0.5% sobre $2,883 = $14.42)
SELECT 
  order_number,
  net_amount_usd,
  commission_percentage,
  commission_amount_usd
FROM seller_commissions sc
JOIN visa_orders vo ON sc.order_id = vo.id
WHERE vo.order_number LIKE 'TEST-1-%';

-- 3. Criar segunda venda (deve recalcular todas para 1% porque total passa de $5k)
INSERT INTO visa_orders (
  order_number, product_slug, seller_id, total_price_usd,
  client_name, client_email, payment_method, payment_status,
  payment_metadata, created_at
) VALUES (
  'TEST-2-' || TO_CHAR(NOW(), 'YYYYMMDD'),
  'initial-selection-process',
  'victordev',
  2500.00,
  'Cliente 2',
  'cliente2@test.com',
  'zelle', -- Zelle não tem taxa
  'completed',
  NULL,
  NOW()
) RETURNING id;

-- 4. Verificar se ambas as comissões foram recalculadas para 1%
SELECT 
  vo.order_number,
  sc.net_amount_usd,
  sc.commission_percentage,
  sc.commission_amount_usd,
  sc.calculation_method
FROM seller_commissions sc
JOIN visa_orders vo ON sc.order_id = vo.id
WHERE vo.order_number LIKE 'TEST-%'
  AND vo.seller_id = 'victordev'
ORDER BY vo.created_at;
```

**Resultado esperado:**
- Primeira venda: $2,883 líquido → inicialmente 0.5% = $14.42
- Após segunda venda: Total do mês = $5,383 → 1% aplicado a ambas
  - Primeira: $2,883 × 1% = $28.83
  - Segunda: $2,500 × 1% = $25.00
  - Total: $53.83

---

### **TESTE 6: Verificar no Dashboard**

1. Acesse o dashboard do seller: `/seller/dashboard`
2. Faça login com um seller que tenha vendas
3. Verifique se o card de **Commission** aparece
4. Verifique se mostra:
   - Comissão do mês atual
   - Comissão total pendente
5. Teste o filtro "Este Mês" vs "Acumulado"

---

### **TESTE 7: Testar função de recálculo manual**

```sql
-- Recalcular comissões de um seller para o mês atual
SELECT recalculate_monthly_commissions('victordev', CURRENT_DATE);

-- Verificar resultado
SELECT 
  COUNT(*) as total_commissions,
  SUM(commission_amount_usd) as total_commission,
  AVG(commission_percentage) as avg_percentage
FROM seller_commissions
WHERE seller_id = 'victordev'
  AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE);
```

---

## 🔍 Queries Úteis para Debug

### Ver todas as comissões de um seller
```sql
SELECT 
  sc.*,
  vo.order_number,
  vo.total_price_usd,
  vo.payment_method,
  vo.created_at as order_date
FROM seller_commissions sc
JOIN visa_orders vo ON sc.order_id = vo.id
WHERE sc.seller_id = 'victordev'
ORDER BY sc.created_at DESC;
```

### Ver total acumulado do mês
```sql
SELECT 
  seller_id,
  DATE_TRUNC('month', created_at) as month,
  SUM(net_amount_usd) as total_net_month,
  MAX(commission_percentage) as applied_percentage,
  SUM(commission_amount_usd) as total_commission
FROM seller_commissions
WHERE seller_id = 'victordev'
  AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
GROUP BY seller_id, DATE_TRUNC('month', created_at);
```

### Verificar se há orders sem comissão
```sql
SELECT 
  vo.id,
  vo.order_number,
  vo.seller_id,
  vo.payment_status,
  vo.total_price_usd,
  vo.created_at
FROM visa_orders vo
LEFT JOIN seller_commissions sc ON vo.id = sc.order_id
WHERE vo.payment_status = 'completed'
  AND vo.seller_id IS NOT NULL
  AND vo.seller_id != ''
  AND sc.id IS NULL
ORDER BY vo.created_at DESC;
```

---

## ✅ Checklist de Validação

- [ ] Tabela `seller_commissions` existe
- [ ] Funções PostgreSQL foram criadas
- [ ] Trigger está ativo
- [ ] Faixas progressivas funcionam corretamente
- [ ] Cálculo de valor líquido funciona (com e sem taxa)
- [ ] Trigger dispara automaticamente quando payment_status = 'completed'
- [ ] Cálculo acumulado mensal funciona (recalcula todas as vendas do mês)
- [ ] Card de comissão aparece no dashboard
- [ ] Dados são atualizados em tempo real

---

## 🐛 Troubleshooting

### Problema: Comissão não é criada automaticamente

**Verificar:**
1. Order tem `seller_id` preenchido?
2. `payment_status` está como `'completed'`?
3. Trigger está ativo? (ver TESTE 1)
4. Verificar logs do PostgreSQL para erros

**Solução manual:**
```sql
-- Forçar cálculo manual
SELECT calculate_seller_commission('ORDER_ID'::UUID, 'monthly_accumulated');
```

### Problema: Percentual incorreto

**Verificar:**
1. Total acumulado do mês está correto?
2. Faixas estão aplicadas corretamente?

**Testar:**
```sql
-- Ver total do mês
SELECT 
  SUM(
    CASE 
      WHEN payment_metadata ? 'fee_amount' THEN
        total_price_usd - (payment_metadata->>'fee_amount')::DECIMAL
      ELSE total_price_usd
    END
  ) as total_net
FROM visa_orders
WHERE seller_id = 'victordev'
  AND payment_status = 'completed'
  AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE);

-- Ver qual percentual deveria ser aplicado
SELECT get_commission_percentage(
  -- Colar o resultado do query acima aqui
  5383.00
);
```

---

## 📝 Notas

- O sistema recalcula **todas** as comissões do mês quando uma nova venda é completada
- Comissões antigas são **atualizadas** (não recriadas)
- O método usado é sempre `'monthly_accumulated'` para novas comissões
- Orders antigas podem não ter comissão - você pode recalcular manualmente se necessário
