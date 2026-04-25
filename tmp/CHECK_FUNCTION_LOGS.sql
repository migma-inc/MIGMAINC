-- Ver logs recentes das edge functions (últimos 30 min)
-- Rodar no Supabase SQL Editor

-- Logs do migma-split-parcelow-checkout
SELECT
  timestamp,
  event_message
FROM supabase_functions.hooks
WHERE function_name = 'migma-split-parcelow-checkout'
  AND timestamp > now() - interval '30 minutes'
ORDER BY timestamp DESC
LIMIT 20;

-- Se a tabela acima não existir, usar esta query alternativa:
-- (Supabase não expõe logs diretos via SQL - ver no Dashboard)
-- Dashboard > Edge Functions > migma-split-parcelow-checkout > Logs
