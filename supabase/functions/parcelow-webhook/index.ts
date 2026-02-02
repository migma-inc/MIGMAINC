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

async function processParcelowWebhookEvent(event: ParcelowWebhookEvent, supabase: any) {
  const { event: eventType } = event;
  const parcelowOrder = event.order || event.data;
  if (!parcelowOrder) return;

  console.log(`[Parcelow Webhook] Processing ${eventType} for Parcelow ID ${parcelowOrder.id}`);

  const { data: orders, error: orderError } = await supabase
    .from("visa_orders")
    .select("*")
    .eq("parcelow_order_id", parcelowOrder.id.toString());

  if (orderError || !orders || orders.length === 0) {
    console.error("[Parcelow Webhook] Orders not found");
    return;
  }

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
