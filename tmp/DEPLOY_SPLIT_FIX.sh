#!/bin/bash
# Deploy das funções corrigidas para o bug de 500 no split payment
# ROOT CAUSE: split_payments.order_id tem FK REFERENCES visa_orders(id)
#             migma-split-parcelow-checkout passava um UUID falso como order_id
#             → FK violation → INSERT falha → 500
# FIX: order_id = null para todos os flows migma/placement_fee
#      + todos os erros internos agora retornam status 200 (erro visível no frontend)

echo "🚀 Deploy: migma-split-parcelow-checkout (fix FK order_id + status 200 em erros)"
supabase functions deploy migma-split-parcelow-checkout --no-verify-jwt

echo "🚀 Deploy: parcelow-webhook (fix loop placement_fee)"
supabase functions deploy parcelow-webhook --no-verify-jwt

echo "🚀 Deploy: migma-parcelow-checkout (partner_reference_override)"
supabase functions deploy migma-parcelow-checkout --no-verify-jwt

echo "✅ Deploy concluído"
echo ""
echo "⚠️  PRÓXIMOS PASSOS:"
echo "  1. Rodar SETUP_MIGMA_PARCELOW_DEPENDENCIES.sql no SQL Editor (cria migma_parcelow_pending + get_user_id_by_email)"
echo "  2. Limpar split_payments pending de teste: rodar DIAGNOSTICO_SPLIT_PAYMENT_BUG.sql"
echo "  3. Testar checkout COS com split payment"
