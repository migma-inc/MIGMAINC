import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
};

interface ParcelowWebhookEvent {
  event: string;
  order?: any;
  data?: any;
}

// 🆕 FUNÇÃO PARA PROCESSAR SPLIT PAYMENT WEBHOOK
async function processSplitPaymentWebhook(
  eventType: string,
  parcelowOrder: any,
  splitPayment: any,
  mainOrder: any,
  supabase: any
) {
  console.log("[Split Webhook] 🎯 Processando webhook de split payment...");
  console.log("[Split Webhook] Event:", eventType);
  console.log("[Split Webhook] Parcelow Order ID:", parcelowOrder.id);

  // Determinar qual parte foi paga
  const isPart1 = splitPayment.part1_parcelow_order_id === parcelowOrder.id.toString();
  const isPart2 = splitPayment.part2_parcelow_order_id === parcelowOrder.id.toString();
  const partNumber = isPart1 ? 1 : 2;

  console.log(`[Split Webhook] 📦 Parte detectada: Part ${partNumber}`);

  // Processar apenas eventos de pagamento confirmado
  if (eventType !== "event_order_paid") {
    console.log(`[Split Webhook] ⏭️ Evento ${eventType} ignorado (não é pagamento)`);

    // Atualizar status da Parcelow mesmo que não seja paid
    const updateField = isPart1 ? 'part1_parcelow_status' : 'part2_parcelow_status';
    await supabase
      .from("split_payments")
      .update({ [updateField]: parcelowOrder.status_text })
      .eq("id", splitPayment.id);

    return;
  }

  // Verificar se já foi processado
  const currentPartStatus = isPart1 ? splitPayment.part1_payment_status : splitPayment.part2_payment_status;
  if (currentPartStatus === 'completed') {
    console.log(`[Split Webhook] ✅ Part ${partNumber} já foi processada anteriormente`);
    return;
  }

  console.log(`[Split Webhook] 💰 Part ${partNumber} PAGA! Atualizando banco...`);

  // Preparar dados de atualização
  const paymentDetails = parcelowOrder.payments?.[0];
  const updateData: any = {
    [`part${partNumber}_payment_status`]: 'completed',
    [`part${partNumber}_completed_at`]: new Date().toISOString(),
    [`part${partNumber}_parcelow_status`]: parcelowOrder.status_text,
    [`part${partNumber}_payment_metadata`]: {
      parcelow_order_id: parcelowOrder.id,
      total_usd: (parcelowOrder.total_usd || 0) / 100,
      total_brl: paymentDetails?.total_brl || parcelowOrder.total_brl || 0,
      installments: paymentDetails?.installments || parcelowOrder.installments || 1,
      completed_at: new Date().toISOString(),
    }
  };

  // Verificar se ambas as partes foram pagas
  const part1Completed = isPart1 ? true : (splitPayment.part1_payment_status === 'completed');
  const part2Completed = isPart2 ? true : (splitPayment.part2_payment_status === 'completed');
  const bothPartsPaid = part1Completed && part2Completed;

  if (bothPartsPaid) {
    console.log("[Split Webhook] 🎉 AMBAS AS PARTES PAGAS! Finalizando pedido...");
    updateData.overall_status = 'fully_completed';
  } else {
    console.log(`[Split Webhook] ⏳ Apenas Part ${partNumber} paga. Aguardando Part ${isPart1 ? 2 : 1}...`);
    updateData.overall_status = 'part1_completed';
  }

  // Atualizar split_payment
  const { error: updateSplitError } = await supabase
    .from("split_payments")
    .update(updateData)
    .eq("id", splitPayment.id);

  if (updateSplitError) {
    console.error("[Split Webhook] ❌ Erro ao atualizar split_payment:", updateSplitError);
    return;
  }

  console.log("[Split Webhook] ✅ Split payment atualizado com sucesso");

  // Se ambas as partes foram pagas, processar como pedido completo
  if (bothPartsPaid) {
    console.log("[Split Webhook] 📄 Gerando contratos e documentos...");

    // Buscar o registro atualizado do split para calcular os totais consolidados
    const { data: latestSplit, error: fetchSplitError } = await supabase
      .from("split_payments")
      .select("*")
      .eq("id", splitPayment.id)
      .single();

    if (fetchSplitError || !latestSplit) {
      console.error("[Split Webhook] ❌ Erro ao buscar split atualizado:", fetchSplitError);
      return;
    }

    const m1 = latestSplit.part1_payment_metadata || {};
    const m2 = latestSplit.part2_payment_metadata || {};

    // Calcular totais acumulados
    const totalUsdPaid = (Number(m1.total_usd) || 0) + (Number(m2.total_usd) || 0);
    const totalBrlPaid = (Number(m1.total_brl) || 0) + (Number(m2.total_brl) || 0);
    const serviceTotalUsd = parseFloat(latestSplit.total_amount_usd);
    const totalFeeUsd = totalUsdPaid - serviceTotalUsd;

    console.log(`[Split Webhook] 📊 Consolidação: Total USD: ${totalUsdPaid}, Total BRL: ${totalBrlPaid}, Fees: ${totalFeeUsd}`);

    // Atualizar visa_orders para completed
    await supabase
      .from("visa_orders")
      .update({
        payment_status: 'completed',
        payment_method: 'parcelow',
        parcelow_status: 'Paid (Split)',
        payment_metadata: {
          ...(mainOrder.payment_metadata || {}),
          is_split_payment: true,
          split_payment_id: splitPayment.id,
          total_usd: totalUsdPaid,
          total_brl: totalBrlPaid,
          fee_amount: totalFeeUsd > 0 ? totalFeeUsd : 0,
          service_amount: serviceTotalUsd,
          completed_at: new Date().toISOString(),
          parts_details: {
            part1: m1,
            part2: m2
          }
        }
      })
      .eq("id", mainOrder.id);

    // Buscar todas as orders relacionadas (incluindo upsells)
    const { data: allOrders } = await supabase
      .from("visa_orders")
      .select("*")
      .eq("id", mainOrder.id);

    const orders = allOrders || [mainOrder];

    // Incrementar uso de cupom se existir
    if (mainOrder.coupon_code) {
      console.log(`[Split Webhook] 🎟️ Incrementando uso do cupom: ${mainOrder.coupon_code}`);
      await supabase.rpc('increment_coupon_usage', { p_code: mainOrder.coupon_code });
    }

    // Gerar PDFs
    for (const orderItem of orders) {
      console.log(`[Split Webhook] 📄 Gerando PDFs para order ${orderItem.order_number}...`);

      if (orderItem.product_slug !== 'consultation-common') {
        await supabase.functions.invoke("generate-visa-contract-pdf", {
          body: { order_id: orderItem.id }
        });
      }

      await supabase.functions.invoke("generate-annex-pdf", {
        body: { order_id: orderItem.id }
      });

      await supabase.functions.invoke("generate-invoice-pdf", {
        body: { order_id: orderItem.id }
      });

      // Gerar PDFs de upsell se existir
      if (orderItem.upsell_product_slug) {
        console.log(`[Split Webhook] 📄 Gerando PDFs de upsell: ${orderItem.upsell_product_slug}`);

        await supabase.functions.invoke("generate-visa-contract-pdf", {
          body: {
            order_id: orderItem.id,
            is_upsell: true,
            product_slug_override: orderItem.upsell_product_slug
          }
        });

        await supabase.functions.invoke("generate-annex-pdf", {
          body: {
            order_id: orderItem.id,
            is_upsell: true,
            product_slug_override: orderItem.upsell_product_slug
          }
        });
      }
    }

    // Enviar email de confirmação
    try {
      console.log("[Split Webhook] 📧 Enviando email de confirmação...");
      const totalPaid = orders.reduce((sum: number, o: any) => sum + parseFloat(o.total_price_usd || 0), 0);

      await supabase.functions.invoke("send-payment-confirmation-email", {
        body: {
          clientName: mainOrder.client_name,
          clientEmail: mainOrder.client_email,
          orderNumber: mainOrder.order_number,
          productSlug: mainOrder.product_slug,
          totalAmount: totalPaid,
          paymentMethod: "parcelow_split",
          currency: "USD",
          finalAmount: totalPaid,
          is_bundle: orders.length > 1,
          extraUnits: mainOrder.extra_units
        }
      });

      console.log("[Split Webhook] ✅ Email enviado com sucesso");
    } catch (emailError) {
      console.error("[Split Webhook] ⚠️ Erro ao enviar email:", emailError);
    }

    // Registrar evento de funil
    if (mainOrder.seller_id) {
      try {
        await supabase.from('seller_funnel_events').insert({
          seller_id: mainOrder.seller_id,
          product_slug: mainOrder.product_slug,
          event_type: 'payment_completed',
          session_id: `order_${mainOrder.id}`,
          metadata: {
            order_id: mainOrder.id,
            is_split_payment: true,
            split_payment_id: splitPayment.id
          }
        });
      } catch (e) {
        console.error("[Split Webhook] ⚠️ Erro ao registrar evento de funil:", e);
      }
    }

    console.log("[Split Webhook] 🎉 Split payment totalmente processado!");
  } else {
    console.log(`[Split Webhook] ⏳ Aguardando pagamento da Part ${isPart1 ? 2 : 1}...`);
    console.log("[Split Webhook] ℹ️ Contratos NÃO serão gerados até que ambas as partes sejam pagas");
  }
}


async function processParcelowWebhookEvent(event: ParcelowWebhookEvent, supabase: any) {
  const { event: eventType } = event;
  const parcelowOrder = event.order || event.data;
  if (!parcelowOrder) return;

  console.log(`[Parcelow Webhook] Processing ${eventType} for Parcelow ID ${parcelowOrder.id}`);

  // 1. PRIMEIRO: Verificar se é um Split Payment
  console.log("[Parcelow Webhook] 🔍 Verificando se é split payment...");
  const { data: splitPayment } = await supabase
    .from("split_payments")
    .select("*")
    .or(`part1_parcelow_order_id.eq.${parcelowOrder.id},part2_parcelow_order_id.eq.${parcelowOrder.id}`)
    .maybeSingle();

  if (splitPayment) {
    console.log("[Parcelow Webhook] 🎯 Split payment detectado! ID:", splitPayment.id);

    // Buscar a order principal ligada ao split
    const { data: mainOrder } = await supabase
      .from("visa_orders")
      .select("*")
      .eq("id", splitPayment.order_id)
      .single();

    if (!mainOrder) {
      console.error("[Parcelow Webhook] Split payment found but main order is missing");
      return;
    }

    // Processar split payment (lógica especial)
    await processSplitPaymentWebhook(eventType, parcelowOrder, splitPayment, mainOrder, supabase);
    return;
  }

  // 2. SEGUNDO: Se não for split, buscar como pagamento normal
  console.log("[Parcelow Webhook] ℹ️ Verificando pagamento normal...");
  const { data: orders, error: orderError } = await supabase
    .from("visa_orders")
    .select("*")
    .eq("parcelow_order_id", parcelowOrder.id.toString());

  if (orderError || !orders || orders.length === 0) {
    console.warn("[Parcelow Webhook] Order não encontrada em nenhuma das tabelas");
    return;
  }

  console.log("[Parcelow Webhook] ℹ️ Pagamento normal encontrado");
  const mainOrder = orders.find((o: any) => !o.payment_metadata?.is_upsell) || orders[0];

  if (mainOrder.payment_status === 'completed' && eventType === 'event_order_paid') {
    console.log("[Parcelow Webhook] Already completed");
    return;
  }

  let paymentStatus = mainOrder.payment_status;
  let shouldProcessPayment = false;

  switch (eventType) {
    case "event_order_paid":
      paymentStatus = "completed";
      shouldProcessPayment = true;
      break;
    case "event_order_declined":
      paymentStatus = "failed";
      break;
    case "event_order_canceled":
    case "event_order_expired":
      paymentStatus = "cancelled";
      break;
  }

  const updateData: any = {
    parcelow_status: parcelowOrder.status_text,
    parcelow_status_code: parcelowOrder.status,
    payment_status: paymentStatus
  };

  if (shouldProcessPayment) {
    const paymentDetails = parcelowOrder.payments?.[0];
    const actualTotalBrl = paymentDetails?.total_brl;
    const actualInstallments = paymentDetails?.installments || parcelowOrder.installments || 1;

    for (const orderItem of orders) {
      await supabase.from("visa_orders").update({
        payment_status: "completed",
        payment_method: "parcelow",
        payment_metadata: {
          ...(orderItem.payment_metadata || {}),
          payment_method: "parcelow",
          completed_at: new Date().toISOString(),
          parcelow_order_id: parcelowOrder.id,
          installments: actualInstallments,
          total_usd: (parcelowOrder.total_usd || 0) / 100,
          total_brl: actualTotalBrl || parcelowOrder.total_brl || 0,
          fee_amount: orderItem.id === mainOrder.id ? (((parcelowOrder.total_usd || 0) - (parcelowOrder.order_amount || 0)) / 100) : 0,
        }
      }).eq("id", orderItem.id);
    }

    if (mainOrder.service_request_id) {
      await supabase.from("payments").update({ status: "paid", updated_at: new Date().toISOString() })
        .eq("service_request_id", mainOrder.service_request_id)
        .eq("external_payment_id", parcelowOrder.id.toString());

      await supabase.from("service_requests").update({ status: "paid", updated_at: new Date().toISOString() })
        .eq("id", mainOrder.service_request_id);
    }

    if (mainOrder.seller_id) {
      try {
        await supabase.from('seller_funnel_events').insert({
          seller_id: mainOrder.seller_id,
          product_slug: mainOrder.product_slug,
          event_type: 'payment_completed',
          session_id: `order_${mainOrder.id}`,
          metadata: { order_id: mainOrder.id, has_bundle: orders.length > 1 }
        });
      } catch (e) { }
    }


    // Increment coupon usage if authorized
    if (mainOrder.coupon_code) {
      console.log(`[parcelow-webhook] 🎟️ Incrementing usage for coupon: ${mainOrder.coupon_code}`);
      const { error: rpcError } = await supabase.rpc('increment_coupon_usage', {
        p_code: mainOrder.coupon_code
      });

      if (rpcError) {
        console.error(`[parcelow-webhook] ❌ Failed to increment coupon usage: ${rpcError.message}`);
      } else {
        console.log(`[parcelow-webhook] ✅ Coupon usage incremented successfully.`);
      }
    }

    for (const orderItem of orders) {
      // Generate main product PDFs
      if (orderItem.product_slug !== 'consultation-common') {
        await supabase.functions.invoke("generate-visa-contract-pdf", { body: { order_id: orderItem.id } });
      }
      await supabase.functions.invoke("generate-annex-pdf", { body: { order_id: orderItem.id } });
      await supabase.functions.invoke("generate-invoice-pdf", { body: { order_id: orderItem.id } });

      // Generate upsell PDFs if upsell exists
      if (orderItem.upsell_product_slug) {
        console.log(`[Parcelow Webhook] Generating upsell PDFs for ${orderItem.upsell_product_slug}`);

        // Generate upsell contract
        await supabase.functions.invoke("generate-visa-contract-pdf", {
          body: {
            order_id: orderItem.id,
            is_upsell: true,
            product_slug_override: orderItem.upsell_product_slug
          }
        });

        // Generate upsell annex
        await supabase.functions.invoke("generate-annex-pdf", {
          body: {
            order_id: orderItem.id,
            is_upsell: true,
            product_slug_override: orderItem.upsell_product_slug
          }
        });
      }
    }

    try {
      const totalPaid = orders.reduce((sum: number, o: any) => sum + parseFloat(o.total_price_usd || 0), 0);
      await supabase.functions.invoke("send-payment-confirmation-email", {
        body: {
          clientName: mainOrder.client_name,
          clientEmail: mainOrder.client_email,
          orderNumber: mainOrder.order_number,
          productSlug: mainOrder.product_slug,
          totalAmount: totalPaid,
          paymentMethod: "parcelow",
          currency: mainOrder.payment_metadata?.currency || "BRL",
          finalAmount: totalPaid,
          is_bundle: orders.length > 1,
          extraUnits: mainOrder.extra_units
        }
      });
    } catch (e) { }
  } else {
    await supabase.from("visa_orders").update(updateData).eq("parcelow_order_id", parcelowOrder.id.toString());
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const bodyText = await req.text();
    const event = JSON.parse(bodyText);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    await processParcelowWebhookEvent(event, supabase);
    return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
