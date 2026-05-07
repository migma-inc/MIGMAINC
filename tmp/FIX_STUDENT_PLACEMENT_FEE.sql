-- Corrigir manualmente o status do placement fee para o aluno pepa9245@uorak.com
-- Rodar no Supabase Dashboard → SQL Editor

-- 1. Verificar o estado atual do aluno
SELECT
  u.id AS user_id,
  u.email,
  up.is_placement_fee_paid,
  ia.id AS application_id,
  ia.status AS application_status,
  ia.placement_fee_paid_at,
  sp.id AS split_payment_id,
  sp.overall_status AS split_status,
  sp.part1_payment_status,
  sp.part2_payment_status
FROM auth.users u
LEFT JOIN user_profiles up ON up.user_id = u.id
LEFT JOIN institution_applications ia ON ia.profile_id = u.id
LEFT JOIN split_payments sp ON sp.migma_user_id = u.id AND sp.source = 'placement_fee'
WHERE u.email = 'pepa9245@uorak.com';

-- 2. Aplicar a correção (descomente e rode após conferir o resultado acima)
-- Substitua <USER_ID> e <APPLICATION_ID> pelos valores retornados acima

/*
-- Marcar placement fee como pago no user_profiles
UPDATE user_profiles
SET is_placement_fee_paid = true
WHERE user_id = '<USER_ID>';

-- Marcar application como payment_confirmed
UPDATE institution_applications
SET
  status = 'payment_confirmed',
  placement_fee_paid_at = NOW()
WHERE id = '<APPLICATION_ID>';

-- Marcar split_payment como fully_completed (se ainda pending)
UPDATE split_payments
SET
  overall_status = 'fully_completed',
  part1_payment_status = 'completed',
  part2_payment_status = 'completed',
  updated_at = NOW()
WHERE migma_user_id = '<USER_ID>'
  AND source = 'placement_fee'
  AND overall_status != 'fully_completed';
*/
