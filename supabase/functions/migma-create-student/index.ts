import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * migma-create-student (V34 - Local Only)
 * Cria usuário local na Migma e gera order_id para Parcelow.
 * Sync para MatriculaUSA removido daqui — agora ocorre via sync-to-matriculausa
 * apenas quando admin aprova bolsa em Caroline ou Oikos.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const migmaUrl = Deno.env.get("SUPABASE_URL")!;
  const migmaKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const migma = createClient(migmaUrl, migmaKey);

  try {
    const body = await req.json();
    const {
      email,
      full_name,
      phone,
      migma_user_id,
      service_type,
      country,
      nationality,
      service_request_id,
      payment_metadata,
      num_dependents
    } = body;

    // 🕊️ REGISTRA INTENÇÃO DE PEDIDO (PARA GERAR ORDER_ID)
    // Fallback: se a tabela service_requests não tiver o service_request_id (fluxo Migma checkout),
    // gera um UUID local para não bloquear o fluxo.
    let orderId: string | null = null;
    if (service_request_id) {
      console.log(`[migma-create-student] Gerando intenção de pedido para SR: ${service_request_id}`);
      const { data: rpcData, error: rpcErr } = await migma.rpc('register_visa_order_intent', {
        p_service_request_id: service_request_id,
        p_coupon_code: payment_metadata?.coupon_code || null,
        p_discount_amount: payment_metadata?.discount_amount || 0,
        p_client_name: full_name,
        p_client_email: email,
        p_product_slug: service_type || 'transfer'
      });

      if (rpcErr) {
        // FK violation (service_request_id não existe em service_requests) é esperado no fluxo
        // Migma checkout — gera UUID de fallback para uso no Parcelow
        console.warn(`[migma-create-student] register_visa_order_intent falhou (usando fallback UUID):`, rpcErr.code, rpcErr.message);
        orderId = crypto.randomUUID();
      } else {
        orderId = rpcData;
        console.log(`[migma-create-student] Order ID gerado: ${orderId}`);
      }
    } else {
      // Sem service_request_id (ex: Migma checkout Step 1 inicial) — gera UUID direto
      orderId = crypto.randomUUID();
    }

    console.log(`[migma-create-student] Registrando ${email} (${service_type}).`);

    // 1. Salva Local na Migma
    await migma.from("user_profiles").upsert({
      user_id: migma_user_id,
      email, full_name, phone, service_type,
      country, nationality,
      num_dependents: num_dependents || 0,
      student_process_type: service_type,
      source: 'migma',
      migma_seller_id: body.migma_seller_id || null,
      migma_agent_id: body.migma_agent_id || null
    });

    return new Response(JSON.stringify({ 
      success: true, 
      order_id: orderId 
    }), { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("[migma-create-student] Erro Fatal:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
