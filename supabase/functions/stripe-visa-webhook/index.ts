import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@^17.3.1";

// Get all available webhook secrets (inline)
function getAllWebhookSecrets(): Array<{ env: 'production' | 'staging' | 'test'; secret: string }> {
  const secrets: Array<{ env: 'production' | 'staging' | 'test'; secret: string }> = [];

  const prodSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET_PROD');
  const stagingSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET_STAGING');
  const testSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET_TEST');

  if (prodSecret) secrets.push({ env: 'production', secret: prodSecret });
  if (stagingSecret) secrets.push({ env: 'staging', secret: stagingSecret });
  if (testSecret) secrets.push({ env: 'test', secret: testSecret });

  return secrets;
}

// Get Stripe config for webhook (inline)
function getStripeConfigForWebhook(verifiedEnvironment: 'production' | 'staging' | 'test'): { secretKey: string; apiVersion: string; appInfo: any } {
  const suffix = verifiedEnvironment === 'production' ? 'PROD' : 'TEST';
  const secretKey = Deno.env.get(`STRIPE_SECRET_KEY_${suffix}`) || '';

  if (!secretKey) {
    throw new Error(`Missing STRIPE_SECRET_KEY_${suffix}`);
  }

  return {
    secretKey,
    apiVersion: '2024-12-18.acacia',
    appInfo: {
      name: 'MIGMA Visa Services',
      version: '1.0.0',
    },
  };
}

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

/**
 * Unified processing for successful checkout sessions
 */
async function processSuccessfulSession(session: Stripe.Checkout.Session, supabase: any) {
  console.log(`[Webhook] Processing successful session: ${session.id}`);

  // Fetch ALL orders associated with this session
  const { data: orders, error: orderError } = await supabase
    .from("visa_orders")
    .select("*")
    .eq("stripe_session_id", session.id);

  if (orderError || !orders || orders.length === 0) {
    console.error(`[Webhook] No orders found for session ${session.id}:`, orderError);
    return;
  }

  const mainOrder = orders.find((o: any) => !o.payment_metadata?.is_upsell) || orders[0];

  // Idempotency check: if main order is already completed, skip
  if (mainOrder.payment_status === 'completed') {
    console.log(`[Webhook] Session ${session.id} already processed (idempotency).`);
    return;
  }

  const paymentMethod = session.payment_method_types?.[0] || "card";
  const feeAmount = parseFloat(mainOrder.payment_metadata?.fee_amount || "0");

  // 1. Update all orders
  for (const orderItem of orders) {
    await supabase
      .from("visa_orders")
      .update({
        payment_status: "completed",
        stripe_payment_intent_id: session.payment_intent as string || null,
        payment_method: paymentMethod === "pix" ? "stripe_pix" : "stripe_card",
        payment_metadata: {
          ...orderItem.payment_metadata,
          payment_method: paymentMethod,
          completed_at: new Date().toISOString(),
          session_id: session.id,
          fee_amount: orderItem.id === mainOrder.id ? feeAmount : 0,
        },
      })
      .eq("id", orderItem.id);
  }

  // 2. Update payment and service request
  if (mainOrder.service_request_id) {
    const { data: paymentRecord } = await supabase
      .from("payments")
      .select("id")
      .eq("service_request_id", mainOrder.service_request_id)
      .eq("external_payment_id", session.id)
      .single();

    if (paymentRecord) {
      await supabase
        .from("payments")
        .update({
          status: "paid",
          external_payment_id: session.payment_intent as string || session.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", paymentRecord.id);
    }

    await supabase
      .from("service_requests")
      .update({ status: "paid", updated_at: new Date().toISOString() })
      .eq("id", mainOrder.service_request_id);
  }

  // 3. Track funnel event
  if (mainOrder.seller_id) {
    try {
      await supabase.from('seller_funnel_events').insert({
        seller_id: mainOrder.seller_id,
        product_slug: mainOrder.product_slug,
        event_type: 'payment_completed',
        session_id: `order_${mainOrder.id}`,
        metadata: { order_id: mainOrder.id, has_bundle: orders.length > 1 },
      });
    } catch (e) { }
  }

  // 4. Generate PDFs for each order
  for (const orderForPdf of orders) {
    if (orderForPdf.product_slug !== 'consultation-common') {
      try { await supabase.functions.invoke("generate-visa-contract-pdf", { body: { order_id: orderForPdf.id } }); } catch (e) { }
    }
    try { await supabase.functions.invoke("generate-annex-pdf", { body: { order_id: orderForPdf.id } }); } catch (e) { }
    try { await supabase.functions.invoke("generate-invoice-pdf", { body: { order_id: orderForPdf.id } }); } catch (e) { }
  }

  // 5. Send confirmation email
  try {
    const totalPaid = orders.reduce((sum: number, o: any) => sum + parseFloat(o.total_price_usd || 0), 0);
    await supabase.functions.invoke("send-payment-confirmation-email", {
      body: {
        clientName: mainOrder.client_name,
        clientEmail: mainOrder.client_email,
        orderNumber: mainOrder.order_number,
        productSlug: mainOrder.product_slug,
        totalAmount: totalPaid,
        paymentMethod: paymentMethod === "pix" ? "stripe_pix" : "stripe_card",
        currency: (mainOrder.payment_metadata as any)?.currency || (paymentMethod === "pix" ? "BRL" : "USD"),
        finalAmount: totalPaid,
        is_bundle: orders.length > 1,
        extraUnits: mainOrder.extra_units
      },
    });
  } catch (e) { }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const bodyArrayBuffer = await req.arrayBuffer();
    const body = new TextDecoder().decode(bodyArrayBuffer);
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return new Response(JSON.stringify({ error: "No signature" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const allSecrets = getAllWebhookSecrets();
    let validConfig: { env: 'production' | 'staging' | 'test'; secret: string } | null = null;
    let event: Stripe.Event | null = null;

    for (const secretConfig of allSecrets) {
      try {
        const tempKey = Deno.env.get(secretConfig.env === 'production' ? 'STRIPE_SECRET_KEY_PROD' : 'STRIPE_SECRET_KEY_TEST') || '';
        const tempStripe = new Stripe(tempKey, { apiVersion: "2024-12-18.acacia" });
        event = await tempStripe.webhooks.constructEventAsync(body, signature, secretConfig.secret);
        validConfig = secretConfig;
        break;
      } catch (err) { continue; }
    }

    if (!validConfig || !event) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const stripeConfig = getStripeConfigForWebhook(validConfig.env);
    const stripe = new Stripe(stripeConfig.secretKey, {
      apiVersion: stripeConfig.apiVersion as any,
      appInfo: stripeConfig.appInfo,
    });

    console.log(`[Webhook] Event received: ${event.type} (${event.id}) in ${validConfig.env} mode`);

    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        await processSuccessfulSession(session, supabase);
        break;
      }

      case "checkout.session.async_payment_failed":
      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        await supabase.from("visa_orders")
          .update({ payment_status: event.type === "checkout.session.expired" ? "cancelled" : "failed" })
          .eq("stripe_session_id", session.id);
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: any) {
    console.error("[Webhook] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
