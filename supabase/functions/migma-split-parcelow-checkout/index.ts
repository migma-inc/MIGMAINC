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

    // --- Validação ---
    if (!user_id || !email || !full_name) {
      return new Response(JSON.stringify({ error: "user_id, email e full_name são obrigatórios" }), { status: 400, headers: corsHeaders });
    }
    if (!total_amount || !part1_amount || !part1_method || !part2_amount || !part2_method) {
      return new Response(JSON.stringify({ error: "Configuração de split incompleta" }), { status: 400, headers: corsHeaders });
    }

    const validMethods = ['card', 'pix', 'ted'];
    if (!validMethods.includes(part1_method) || !validMethods.includes(part2_method)) {
      return new Response(JSON.stringify({ error: `Métodos inválidos. Usar: ${validMethods.join(', ')}` }), { status: 400, headers: corsHeaders });
    }

    const p1 = parseFloat(part1_amount);
    const p2 = parseFloat(part2_amount);
    const total = parseFloat(total_amount);

    if (p1 <= 0 || p2 <= 0) {
      return new Response(JSON.stringify({ error: "Valores de cada parte devem ser maiores que zero" }), { status: 400, headers: corsHeaders });
    }
    // Tolerância de R$0.01 para ponto flutuante
    if (Math.abs(p1 + p2 - total) > 0.01) {
      return new Response(JSON.stringify({ error: `Soma das partes (${p1 + p2}) deve ser igual ao total (${total})` }), { status: 400, headers: corsHeaders });
    }

    const originUrl = origin || req.headers.get("origin") || "https://migmainc.com";
    const serviceSlug = (service_type || 'transfer').replace('-selection-process', '');
    const finalOrderId = order_id || `MIG-SPLIT-${Date.now()}`;

    console.log(`[migma-split] Iniciando split para ${email} — Total: $${total} | P1: $${p1} (${part1_method}) | P2: $${p2} (${part2_method})`);

    // --- 1. Criar registro split_payments ANTES de chamar Parcelow ---
    const { data: splitRecord, error: splitInsertErr } = await supabase
      .from("split_payments")
      .insert({
        order_id: null,
        migma_user_id: user_id,
        source: 'migma',
        migma_service_type: serviceSlug,
        total_amount_usd: total,
        split_count: 2,
        part1_amount_usd: p1,
        part1_payment_method: part1_method,
        part2_amount_usd: p2,
        part2_payment_method: part2_method,
        overall_status: 'pending',
      })
      .select("id")
      .single();

    if (splitInsertErr || !splitRecord) {
      console.error("[migma-split] ❌ Erro ao criar split_payments:", splitInsertErr);
      return new Response(JSON.stringify({ error: "Erro ao inicializar split payment" }), { status: 500, headers: corsHeaders });
    }

    const splitPaymentId = splitRecord.id;
    console.log(`[migma-split] ✅ split_payments criado: ${splitPaymentId}`);

    // URLs de redirect para cada parte (embutem split_payment_id)
    const p1SuccessUrl = `${originUrl}/checkout/split-payment/redirect?split_payment_id=${splitPaymentId}&split_return=1&part=1`;
    const p2SuccessUrl = `${originUrl}/checkout/split-payment/redirect?split_payment_id=${splitPaymentId}&split_return=1&part=2`;
    const failedUrl   = `${originUrl}/student/checkout/${serviceSlug}?failed=true`;

    // Mapear método split → método parcelow
    const methodMap: Record<string, string> = { card: 'parcelow_card', pix: 'parcelow_pix', ted: 'parcelow_ted' };

    // --- 2. Criar Parte 1 no Parcelow (sequencial: se falhar, não cria P2) ---
    console.log(`[migma-split] Criando P1 via migma-parcelow-checkout...`);
    const { data: p1Result, error: p1InvokeErr } = await supabase.functions.invoke(
      "migma-parcelow-checkout",
      {
        body: {
          user_id,
          order_id: finalOrderId,
          reference_suffix: "-P1",
          email,
          full_name,
          phone,
          cpf,
          payer_info,
          amount: p1,
          payment_method: methodMap[part1_method],
          service_type,
          service_request_id,
          redirect_success_override: p1SuccessUrl,
          redirect_failed_override: failedUrl,
          is_split_part: true,
        },
      }
    );

    if (p1InvokeErr || p1Result?.error) {
      console.error("[migma-split] ❌ Erro ao criar P1:", p1InvokeErr || p1Result?.error);
      // Limpar split_payments criado
      await supabase.from("split_payments").delete().eq("id", splitPaymentId);
      return new Response(JSON.stringify({ error: `Erro ao criar Parte 1: ${p1InvokeErr?.message || p1Result?.error}` }), { status: 500, headers: corsHeaders });
    }

    const p1CheckoutUrl = p1Result?.checkout_url || p1Result?.url_checkout || p1Result?.url;
    const p1ParcelowId  = p1Result?.parcelow_id?.toString() || p1Result?.id?.toString();

    if (!p1CheckoutUrl || !p1ParcelowId) {
      console.error("[migma-split] ❌ P1 sem URL ou ID:", JSON.stringify(p1Result));
      await supabase.from("split_payments").delete().eq("id", splitPaymentId);
      return new Response(JSON.stringify({ error: "Parte 1 não retornou URL de pagamento" }), { status: 500, headers: corsHeaders });
    }

    console.log(`[migma-split] ✅ P1 criado: ID=${p1ParcelowId}`);

    // --- 3. Criar Parte 2 no Parcelow ---
    console.log(`[migma-split] Criando P2 via migma-parcelow-checkout...`);
    const { data: p2Result, error: p2InvokeErr } = await supabase.functions.invoke(
      "migma-parcelow-checkout",
      {
        body: {
          user_id,
          order_id: finalOrderId,
          reference_suffix: "-P2",
          email,
          full_name,
          phone,
          cpf,
          payer_info,
          amount: p2,
          payment_method: methodMap[part2_method],
          service_type,
          service_request_id,
          redirect_success_override: p2SuccessUrl,
          redirect_failed_override: failedUrl,
          is_split_part: true,
        },
      }
    );

    if (p2InvokeErr || p2Result?.error) {
      console.error("[migma-split] ❌ Erro ao criar P2:", p2InvokeErr || p2Result?.error);
      await supabase.from("split_payments").delete().eq("id", splitPaymentId);
      return new Response(JSON.stringify({ error: `Erro ao criar Parte 2: ${p2InvokeErr?.message || p2Result?.error}` }), { status: 500, headers: corsHeaders });
    }

    const p2CheckoutUrl = p2Result?.checkout_url || p2Result?.url_checkout || p2Result?.url;
    const p2ParcelowId  = p2Result?.parcelow_id?.toString() || p2Result?.id?.toString();

    if (!p2CheckoutUrl || !p2ParcelowId) {
      console.error("[migma-split] ❌ P2 sem URL ou ID:", JSON.stringify(p2Result));
      await supabase.from("split_payments").delete().eq("id", splitPaymentId);
      return new Response(JSON.stringify({ error: "Parte 2 não retornou URL de pagamento" }), { status: 500, headers: corsHeaders });
    }

    console.log(`[migma-split] ✅ P2 criado: ID=${p2ParcelowId}`);

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
      console.error("[migma-split] ⚠️ Erro ao atualizar split_payments com URLs:", updateErr);
      // Não é fatal — IDs e URLs já foram criados no Parcelow
    }

    console.log(`[migma-split] 🎉 Split criado com sucesso! Redirecionando para P1: ${p1CheckoutUrl}`);

    return new Response(
      JSON.stringify({
        success: true,
        split_payment_id: splitPaymentId,
        part1_checkout_url: p1CheckoutUrl,
        part2_checkout_url: p2CheckoutUrl,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("[migma-split] Erro Fatal:", err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
