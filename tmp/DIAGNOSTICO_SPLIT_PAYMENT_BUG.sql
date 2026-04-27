-- ============================================================
-- DIAGNÓSTICO: Loop de split payment placement_fee
-- Rodar no Supabase SQL Editor
-- ============================================================

-- 1. Ver todos os split_payments de placement_fee recentes
SELECT
  id,
  source,
  overall_status,
  part1_payment_status,
  part2_payment_status,
  part1_parcelow_order_id,
  part2_parcelow_order_id,
  -- Verificar se as URLs são as mesmas (ROOT CAUSE do bug)
  CASE
    WHEN part1_parcelow_checkout_url = part2_parcelow_checkout_url
    THEN '🔴 SAME URL - BUG CONFIRMADO'
    ELSE '✅ URLs diferentes'
  END AS url_check,
  -- Mostrar os últimos chars pra comparar
  RIGHT(part1_parcelow_checkout_url, 30) AS p1_url_tail,
  RIGHT(part2_parcelow_checkout_url, 30) AS p2_url_tail,
  application_id,
  migma_user_id,
  total_amount_usd,
  part1_amount_usd,
  part2_amount_usd,
  created_at
FROM split_payments
WHERE source = 'placement_fee'
ORDER BY created_at DESC
LIMIT 10;

-- ============================================================
-- 2. Ver o split_payment mais recente de placement_fee com URLs completas
-- ============================================================
SELECT
  id,
  overall_status,
  part1_payment_status,
  part2_payment_status,
  part1_parcelow_order_id,
  part2_parcelow_order_id,
  part1_parcelow_checkout_url,
  part2_parcelow_checkout_url
FROM split_payments
WHERE source = 'placement_fee'
ORDER BY created_at DESC
LIMIT 3;

-- ============================================================
-- 3. Se o bug for confirmado (same URL), fix manual:
--    Deletar o registro corrompido para forçar novo checkout
--    (descomente e rode apenas se necessário)
-- ============================================================
-- DELETE FROM split_payments
-- WHERE source = 'placement_fee'
--   AND part1_parcelow_checkout_url = part2_parcelow_checkout_url
--   AND overall_status != 'fully_completed';
