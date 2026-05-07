import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getMigmaEnv() {
  const url =
    Deno.env.get("MIGMA_REMOTE_URL") ||
    Deno.env.get("REMOTE_SUPABASE_URL") ||
    Deno.env.get("SUPABASE_URL");
  const key =
    Deno.env.get("MIGMA_REMOTE_SERVICE_ROLE_KEY") ||
    Deno.env.get("REMOTE_SUPABASE_SERVICE_ROLE_KEY") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !key) {
    throw new Error("Supabase URL/service role não configurados para a função.");
  }

  return { url, key };
}

/**
 * migma-create-student (V34 - Local Only)
 * Cria usuário local na Migma e gera order_id para Parcelow.
 * Sync para MatriculaUSA removido daqui — agora ocorre via sync-to-matriculausa
 * apenas quando admin aprova bolsa em Caroline ou Oikos.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const { url: migmaUrl, key: migmaKey } = getMigmaEnv();
  const migma = createClient(migmaUrl, migmaKey);

  const debug_logs: string[] = [];
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
    const sellerId = typeof body.migma_seller_id === "string" && body.migma_seller_id.trim()
      ? body.migma_seller_id.trim()
      : null;
    const agentId = typeof body.migma_agent_id === "string" && body.migma_agent_id.trim()
      ? body.migma_agent_id.trim()
      : null;

    debug_logs.push(`Body recebido para: ${email}`);

    // 🕊️ REGISTRA INTENÇÃO DE PEDIDO
    let orderId: string | null = null;
    if (service_request_id) {
      debug_logs.push(`Gerando intenção de pedido para SR: ${service_request_id}`);
      const { data: rpcData, error: rpcErr } = await migma.rpc('register_visa_order_intent', {
        p_service_request_id: service_request_id,
        p_coupon_code: payment_metadata?.coupon_code || null,
        p_discount_amount: payment_metadata?.discount_amount || 0,
        p_client_name: full_name,
        p_client_email: email,
        p_product_slug: service_type || 'transfer'
      });

      if (rpcErr) {
        debug_logs.push(`RPC register_visa_order_intent falhou: ${rpcErr.message}`);
        orderId = null;
      } else {
        orderId = rpcData;
        debug_logs.push(`Order ID gerado via RPC: ${orderId}`);

        if (sellerId && orderId) {
          const { error: sellerOrderErr } = await migma
            .from("visa_orders")
            .update({ seller_id: sellerId })
            .eq("id", orderId);

          if (sellerOrderErr) {
            debug_logs.push(`Aviso: não foi possível vincular seller_id ao pedido ${orderId}: ${sellerOrderErr.message}`);
          } else {
            debug_logs.push(`Seller vinculado ao pedido ${orderId}: ${sellerId}`);
          }
        }
      }
    } else {
      orderId = null;
      debug_logs.push(`Order ID nulo (sem service_request_id)`);
    }

    // 0. 🔐 GARANTE USER_ID (GET OR CREATE)
    let userId = migma_user_id;
    
    if (!userId) {
      debug_logs.push(`Buscando perfil para: ${email}`);
      const { data: existingProfile, error: profileErr } = await migma
        .from("user_profiles")
        .select("user_id")
        .eq("email", email)
        .maybeSingle();
      
      if (profileErr) debug_logs.push(`Erro ao buscar perfil: ${profileErr.message}`);

      if (existingProfile?.user_id) {
        userId = existingProfile.user_id;
        debug_logs.push(`Usuário encontrado via perfil: ${userId}`);
      } else {
        debug_logs.push(`Tentando criar usuário no Auth...`);
        const { data: newUser, error: createErr } = await migma.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: { full_name, phone, source: 'migma' }
        });
        
        if (createErr) {
          debug_logs.push(`Erro ao criar usuário: ${createErr.message}`);
          if (createErr.message.toLowerCase().includes("already registered") || createErr.message.toLowerCase().includes("already exists")) {
             debug_logs.push(`Usuário já existe. Buscando ID via RPC...`);
             const { data: existingId, error: rpcGetErr } = await migma.rpc('get_user_id_by_email', { p_email: email });
             
             if (rpcGetErr) throw new Error(`Erro RPC get_user_id: ${rpcGetErr.message}`);

             if (existingId) {
               userId = existingId;
               debug_logs.push(`ID recuperado via RPC: ${userId}`);
             } else {
               throw new Error("Usuário consta como registrado mas o ID não foi encontrado.");
             }
          } else {
            throw createErr;
          }
        } else {
          userId = newUser.user.id;
          debug_logs.push(`Novo usuário criado no Auth: ${userId}`);
        }
      }
    }

    if (!userId) throw new Error("User ID não definido.");

    // 1. Salva Local na Migma
    debug_logs.push(`Upserting user_profile para ${userId}`);
    
    // Limpeza para satisfazer a constraint user_profiles_student_process_type_check
    let mappedProcessType = null;
    if (service_type) {
      const s = service_type.toLowerCase();
      if (s.includes('cos')) mappedProcessType = 'change_of_status';
      else if (s.includes('transfer')) mappedProcessType = 'transfer';
      else if (s.includes('initial')) mappedProcessType = 'initial';
    }

    const { error: upsertErr } = await migma.from("user_profiles").upsert({
      user_id: userId,
      email, full_name, phone, 
      service_type, // Mantém o original para referência
      country, nationality,
      num_dependents: num_dependents || 0,
      student_process_type: mappedProcessType, // Usa o valor mapeado/limpo
      source: 'migma',
      migma_seller_id: sellerId,
      migma_agent_id: agentId
    }, { onConflict: 'user_id' });

    if (upsertErr) {
      debug_logs.push(`Erro upsert perfil: ${upsertErr.message}`);
      throw upsertErr;
    }

    // Gerar magic link token para login silencioso no checkout (sem precisar checar email)
    let sessionToken: string | null = null;
    try {
      const { data: linkData, error: linkErr } = await migma.auth.admin.generateLink({
        type: 'magiclink',
        email,
      });
      if (linkErr) {
        debug_logs.push(`Aviso: generateLink falhou (${linkErr.message}) — login manual necessário`);
      } else {
        sessionToken = linkData?.properties?.hashed_token || null;
        debug_logs.push(`Magic link token gerado para login silencioso`);
      }
    } catch (linkEx: any) {
      debug_logs.push(`Aviso: generateLink exception (${linkEx.message})`);
    }

    debug_logs.push(`Finalizado com sucesso.`);
    return new Response(JSON.stringify({
      success: true,
      user_id: userId,
      order_id: orderId,
      session_token: sessionToken,
      debug_logs
    }), { headers: { ...CORS, "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error("[migma-create-student] Erro Fatal:", err);
    const errorResponse = {
      success: false,
      error: err.message || "Erro desconhecido",
      debug_logs,
      details: typeof err === 'object' ? JSON.parse(JSON.stringify(err, Object.getOwnPropertyNames(err))) : err
    };
    
    return new Response(JSON.stringify(errorResponse), { 
      status: 400, 
      headers: { ...CORS, "Content-Type": "application/json" } 
    });
  }
});
