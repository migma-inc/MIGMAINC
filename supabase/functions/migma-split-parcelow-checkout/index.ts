import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const debug_logs: string[] = [];
  try {
    const body = await req.json();

    const {
      user_id,
      order_id,
      email,
      full_name,
      phone,
      cpf,
      payer_info,
      service_type,
      service_request_id,
      total_amount,
      part1_amount,
      part1_method,
      part2_amount,
      part2_method,
      origin,
    } = body;

    debug_logs.push(`Iniciando split para: ${email}`);

    // --- Validação ---
    if (!user_id || !email || !full_name) {
      debug_logs.push(`Erro: user_id, email ou full_name ausentes`);
      return new Response(JSON.stringify({ error: "user_id, email e full_name são obrigatórios", debug_logs }), { status: 400, headers: corsHeaders });
    }
    if (!total_amount || !part1_amount || !part1_method || !part2_amount || !part2_method) {
      debug_logs.push(`Erro: Configuração de split incompleta`);
      return new Response(JSON.stringify({ error: "Configuração de split incompleta", debug_logs }), { status: 400, headers: corsHeaders });
    }

    const validMethods = ['card', 'pix', 'ted'];
    if (!validMethods.includes(part1_method) || !validMethods.includes(part2_method)) {
      debug_logs.push(`Erro: Métodos inválidos: ${part1_method}, ${part2_method}`);
      return new Response(JSON.stringify({ error: `Métodos inválidos. Usar: ${validMethods.join(', ')}`, debug_logs }), { status: 400, headers: corsHeaders });
    }

    const p1 = parseFloat(part1_amount);
    const p2 = parseFloat(part2_amount);
    const total = parseFloat(total_amount);

    if (p1 <= 0 || p2 <= 0) {
      debug_logs.push(`Erro: Valores devem ser > 0 (P1=${p1}, P2=${p2})`);
      return new Response(JSON.stringify({ error: "Valores de cada parte devem ser maiores que zero", debug_logs }), { status: 400, headers: corsHeaders });
    }
    // Tolerância de R$0.01 para ponto flutuante
    if (Math.abs(p1 + p2 - total) > 0.01) {
      debug_logs.push(`Erro: Soma das partes (${p1+p2}) != Total (${total})`);
      return new Response(JSON.stringify({ error: `Soma das partes (${p1 + p2}) deve ser igual ao total (${total})`, debug_logs }), { status: 400, headers: corsHeaders });
    }

    const originUrl = origin || req.headers.get("origin") || "https://migmainc.com";
    const serviceSlug = (service_type || 'transfer').replace('-selection-process', '');
    
    // IMPORTANTE: Garantir que order_id seja um UUID se for passado, ou gerar um válido.
    // A tabela split_payments.order_id é do tipo UUID.
    let finalOrderId = order_id;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!finalOrderId || !uuidRegex.test(finalOrderId)) {
       debug_logs.push(`Order ID ausente ou inválido (${finalOrderId}). Usando NULL como fallback para evitar violação de FK.`);
       finalOrderId = null;
    }

    debug_logs.push(`Configurando inserção split_payments...`);

    // --- 1. Criar registro split_payments ANTES de chamar Parcelow ---
    const isPlacementFee = service_type === 'placement_fee';
    const splitInsertData: any = {
      order_id: null, // Sempre null — migma e placement_fee não têm FK em visa_orders
      application_id: isPlacementFee ? finalOrderId : null,
      migma_user_id: user_id,
      source: isPlacementFee ? 'placement_fee' : 'migma',
      migma_service_type: serviceSlug,
      total_amount_usd: total,
      split_count: 2,
      part1_amount_usd: p1,
      part1_payment_method: part1_method,
      part2_amount_usd: p2,
      part2_payment_method: part2_method,
      overall_status: 'pending',
    };

    const { data: splitRecord, error: splitInsertErr } = await supabase
      .from("split_payments")
      .insert(splitInsertData)
      .select("id")
      .single();

    if (splitInsertErr || !splitRecord) {
      debug_logs.push(`Erro ao criar split_payments: ${splitInsertErr?.message} code=${splitInsertErr?.code}`);
      return new Response(JSON.stringify({
        success: false,
        error: "Erro ao inicializar split payment",
        details: splitInsertErr,
        debug_logs
      }), { status: 200, headers: corsHeaders });
    }

    const splitPaymentId = splitRecord.id;
    debug_logs.push(`✅ split_payments criado: ${splitPaymentId}`);

    // URLs de redirect para cada parte (embutem split_payment_id)
    const p1SuccessUrl = `${originUrl}/checkout/split-payment/redirect?split_payment_id=${splitPaymentId}&split_return=1&part=1`;
    const p2SuccessUrl = `${originUrl}/checkout/split-payment/redirect?split_payment_id=${splitPaymentId}&split_return=1&part=2`;
    const failedUrl   = `${originUrl}/student/checkout/${serviceSlug}?failed=true`;

    // Mapear método split → método parcelow
    const methodMap: Record<string, string> = { card: 'parcelow_card', pix: 'parcelow_pix', ted: 'parcelow_ted' };

    // partner_reference deve ser único por parte para evitar deduplicação pela Parcelow
    const sharedBody = { user_id, order_id: finalOrderId, email, full_name, phone, cpf, payer_info, service_type, service_request_id, is_split_part: true };

    // --- 2. Criar P1 PRIMEIRO, depois P2 (sequencial para evitar deduplicação Parcelow) ---
    debug_logs.push(`Criando P1 via migma-parcelow-checkout...`);
    const p1Res = await supabase.functions.invoke("migma-parcelow-checkout", {
      body: {
        ...sharedBody,
        reference_suffix: "-P1",
        partner_reference_override: `${user_id}-P1`,
        amount: p1,
        payment_method: methodMap[part1_method],
        redirect_success_override: p1SuccessUrl,
        redirect_failed_override: failedUrl,
      },
    });

    debug_logs.push(`Criando P2 via migma-parcelow-checkout...`);
    const p2Res = await supabase.functions.invoke("migma-parcelow-checkout", {
      body: {
        ...sharedBody,
        reference_suffix: "-P2",
        partner_reference_override: `${user_id}-P2`,
        amount: p2,
        payment_method: methodMap[part2_method],
        redirect_success_override: p2SuccessUrl,
        redirect_failed_override: failedUrl,
      },
    });

    const { data: p1Result, error: p1InvokeErr } = p1Res;
    const { data: p2Result, error: p2InvokeErr } = p2Res;

    if (p1InvokeErr || p1Result?.error || p2InvokeErr || p2Result?.error) {
      const errMsg = p1InvokeErr?.message || p1Result?.error || p2InvokeErr?.message || p2Result?.error;
      debug_logs.push(`Erro ao criar pedidos: ${errMsg}`);
      await supabase.from("split_payments").delete().eq("id", splitPaymentId);
      return new Response(JSON.stringify({ success: false, error: `Erro ao criar pedidos: ${errMsg}`, debug_logs }), { status: 200, headers: corsHeaders });
    }

    const p1CheckoutUrl = p1Result?.checkout_url || p1Result?.url_checkout || p1Result?.url;
    const p1ParcelowId  = p1Result?.parcelow_id?.toString() || p1Result?.id?.toString();
    const p2CheckoutUrl = p2Result?.checkout_url || p2Result?.url_checkout || p2Result?.url;
    const p2ParcelowId  = p2Result?.parcelow_id?.toString() || p2Result?.id?.toString();

    if (!p1CheckoutUrl || !p1ParcelowId) {
      debug_logs.push(`Parte 1 falhou em retornar URL/ID`);
      await supabase.from("split_payments").delete().eq("id", splitPaymentId);
      return new Response(JSON.stringify({ success: false, error: "Parte 1 não retornou URL de pagamento", debug_p1: p1Result, debug_logs }), { status: 200, headers: corsHeaders });
    }
    if (!p2CheckoutUrl || !p2ParcelowId) {
      debug_logs.push(`Parte 2 falhou em retornar URL/ID`);
      await supabase.from("split_payments").delete().eq("id", splitPaymentId);
      return new Response(JSON.stringify({ success: false, error: "Parte 2 não retornou URL de pagamento", debug_p2: p2Result, debug_logs }), { status: 200, headers: corsHeaders });
    }

    debug_logs.push(`🎉 P1 e P2 gerados com sucesso. Atualizando split_payments...`);

    // --- 4. Persistir IDs e URLs no split_payments ---
    const { error: updateErr } = await supabase
      .from("split_payments")
      .update({
        part1_parcelow_order_id: p1ParcelowId,
        part1_parcelow_checkout_url: p1CheckoutUrl,
        part2_parcelow_order_id: p2ParcelowId,
        part2_parcelow_checkout_url: p2CheckoutUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", splitPaymentId);

    if (updateErr) {
      debug_logs.push(`Aviso: Erro ao persistir URLs no banco: ${updateErr.message}`);
    }

    debug_logs.push(`Processo concluído.`);
    return new Response(
      JSON.stringify({
        success: true,
        split_payment_id: splitPaymentId,
        part1_checkout_url: p1CheckoutUrl,
        part2_checkout_url: p2CheckoutUrl,
        debug_logs
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("[migma-split] Erro Fatal:", err);
    return new Response(JSON.stringify({
      success: false,
      error: err.message,
      debug_logs,
      details: typeof err === 'object' ? JSON.parse(JSON.stringify(err, Object.getOwnPropertyNames(err))) : err
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
