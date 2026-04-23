import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@^17.3.1";
import {
  appendServiceRequestEvent,
  ensureOperationalCaseInitialized,
  syncMigmaUserProfile,
} from "../shared/service-request-operational.ts";

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

function getSupabaseConfig() {
  const supabaseUrl =
    Deno.env.get("MIGMA_REMOTE_URL") ||
    Deno.env.get("REMOTE_SUPABASE_URL") ||
    Deno.env.get("SUPABASE_URL") ||
    "";
  const supabaseServiceKey =
    Deno.env.get("MIGMA_REMOTE_SERVICE_ROLE_KEY") ||
    Deno.env.get("REMOTE_SUPABASE_SERVICE_ROLE_KEY") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    "";

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase runtime configuration");
  }

  return { supabaseUrl, supabaseServiceKey };
}

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
    // ── V11 PLACEMENT FEE: verificar placement_fee_stripe_sessions ───────────
    const { data: pfSession } = await supabase
      .from("placement_fee_stripe_sessions")
      .select("application_id, profile_id, amount_usd, status")
      .eq("stripe_session_id", session.id)
      .maybeSingle();

    if (pfSession) {
      if (pfSession.status === "completed") {
        console.log(`[Webhook] Placement fee session ${session.id} already processed (idempotency).`);
        return;
      }

      console.log(`[Webhook] 🎓 Placement fee Stripe session detectada: app=${pfSession.application_id}`);

      await supabase
        .from("placement_fee_stripe_sessions")
        .update({ status: "completed" })
        .eq("stripe_session_id", session.id);

      const { error: payErr } = await supabase.functions.invoke("migma-payment-completed", {
        body: {
          user_id: pfSession.profile_id,
          fee_type: "placement_fee",
          amount: pfSession.amount_usd,
          payment_method: "stripe",
          service_type: "v11-onboarding",
          application_id: pfSession.application_id,
        },
      });

      if (payErr) {
        console.error("[Webhook] ❌ migma-payment-completed falhou para placement fee:", payErr);
      } else {
        console.log(`[Webhook] ✅ Placement fee Stripe processada: app=${pfSession.application_id}`);
      }
      return;
    }

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

  // Usar o valor real cobrado pelo Stripe (gross) — session.amount_total está em centavos
  // Isso corrige o bug onde total_price_usd ficava com o net amount ($550) em vez do bruto ($571.75)
  const grossAmountUsd = session.amount_total ? session.amount_total / 100 : null;
  const netAmountUsd = session.metadata?.net_amount_usd
    ? parseFloat(session.metadata.net_amount_usd)
    : null;
  const feeAmount = (grossAmountUsd !== null && netAmountUsd !== null)
    ? parseFloat((grossAmountUsd - netAmountUsd).toFixed(2))
    : parseFloat(mainOrder.payment_metadata?.fee_amount || "0");

  console.log(`[Webhook] 💰 Stripe amounts — gross=$${grossAmountUsd} | net=$${netAmountUsd} | fee=$${feeAmount}`);

  // 1. Update all orders — salva o gross amount (bruto real cobrado pelo Stripe)
  for (const orderItem of orders) {
    const updatePayload: Record<string, unknown> = {
      payment_status: "completed",
      paid_at: new Date().toISOString(),
      stripe_payment_intent_id: session.payment_intent as string || null,
      payment_method: paymentMethod === "pix" ? "stripe_pix" : "stripe_card",
      payment_metadata: {
        ...orderItem.payment_metadata,
        payment_method: paymentMethod,
        completed_at: new Date().toISOString(),
        session_id: session.id,
        fee_amount: orderItem.id === mainOrder.id ? feeAmount : 0,
        net_amount_usd: netAmountUsd,
        gross_amount_usd: grossAmountUsd,
      },
    };

    // Atualizar total_price_usd com o valor bruto real (o que o cliente pagou de fato)
    // Apenas para a ordem principal e apenas se temos o valor do Stripe
    if (orderItem.id === mainOrder.id && grossAmountUsd !== null) {
      updatePayload.total_price_usd = grossAmountUsd;
    }

    const { error: updateError } = await supabase
      .from("visa_orders")
      .update(updatePayload)
      .eq("id", orderItem.id);

    if (updateError) {
      console.error(`[Webhook] Error updating order ${orderItem.id}:`, updateError);
      throw new Error(`Database update failed: ${updateError.message}`);
    }
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

    await ensureOperationalCaseInitialized(
      supabase,
      mainOrder.service_request_id,
      "gateway",
      {
        provider: "stripe",
        session_id: session.id,
        order_id: mainOrder.id,
      },
    );

    await appendServiceRequestEvent(
      supabase,
      mainOrder.service_request_id,
      "payment_confirmed",
      "gateway",
      {
        provider: "stripe",
        order_id: mainOrder.id,
        order_number: mainOrder.order_number,
        stripe_session_id: session.id,
        stripe_payment_intent_id: session.payment_intent as string || null,
      },
    );

    // Sync MIGMA CRM profile — usa gross amount (o que o cliente pagou de fato)
    await syncMigmaUserProfile(supabase, {
      email: mainOrder.client_email,
      fullName: mainOrder.client_name || null,
      phone: mainOrder.client_whatsapp || null,
      productSlug: mainOrder.product_slug || null,
      paymentMethod: mainOrder.payment_method || null,
      totalPriceUsd: grossAmountUsd ?? mainOrder.total_price_usd ?? null,
    });

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

  // 4. 🔍 Test User Detection
  const isTestUser = mainOrder.client_email?.toLowerCase() === 'victuribdev@gmail.com' ||
    mainOrder.client_email?.toLowerCase() === 'victtinho.ribeiro@gmail.com' ||
    mainOrder.client_email?.toLowerCase() === 'nemerfrancisco@gmail.com' ||
    mainOrder.client_name?.toLowerCase().includes('paulo victor') ||
    mainOrder.client_name?.toLowerCase().includes('paulo víctor') ||
    mainOrder.client_email?.toLowerCase().includes('@uorak');

  if (isTestUser) {
    console.log(`[Webhook] 🧪 Usuário de teste detectado: ${mainOrder.client_email}. Marcando como teste.`);
    await supabase.from('visa_orders').update({ is_test: true }).eq('id', mainOrder.id);
  }

  // 5. 📄 Generate PDFs for each order
  for (const orderForPdf of orders) {
    console.log(`[Webhook] 📄 Generating PDFs for order ${orderForPdf.order_number}...`);

    if (orderForPdf.product_slug !== 'consultation-common') {
      try { await supabase.functions.invoke("generate-visa-contract-pdf", { body: { order_id: orderForPdf.id } }); } catch (e) { }
    }

    try { await supabase.functions.invoke("generate-annex-pdf", { body: { order_id: orderForPdf.id } }); } catch (e) { }
    try { await supabase.functions.invoke("generate-invoice-pdf", { body: { order_id: orderForPdf.id } }); } catch (e) { }

    // Generate PDFs for upsells if recorded within the same order (legacy check)
    if (orderForPdf.payment_metadata?.is_upsell) {
      console.log(`[Webhook] 📄 Processing upsell order: ${orderForPdf.order_number}`);
    }
  }

  // 6. 📧 Send notifications (Client, Admin, Seller, HoS)
  try {
    const totalPaid = orders.reduce((sum: number, o: any) => sum + parseFloat(o.total_price_usd || 0), 0);
    const currency = (mainOrder.payment_metadata as any)?.currency || (paymentMethod === "pix" ? "BRL" : "USD");

    const commonNotificationData = {
      clientName: mainOrder.client_name,
      clientEmail: mainOrder.client_email,
      orderNumber: mainOrder.order_number,
      productSlug: mainOrder.product_slug,
      totalAmount: totalPaid,
      paymentMethod: paymentMethod === "pix" ? "stripe_pix" : "stripe_card",
      currency: currency,
      finalAmount: totalPaid,
      is_bundle: orders.length > 1,
      extraUnits: mainOrder.extra_units
    };

    const netAmount = totalPaid - feeAmount;

    // Client Notification
    console.log("[Webhook] 📧 Sending confirmation email to client...");
    await supabase.functions.invoke("send-payment-confirmation-email", {
      body: commonNotificationData,
    });

    // Admin Notification
    console.log("[Webhook] 🔔 Sending admin notification...");
    await supabase.functions.invoke("send-admin-payment-notification", {
      body: { ...commonNotificationData, is_test: isTestUser }
    });

    // Seller & HoS Notification
    if (mainOrder.seller_id) {
      console.log(`[Webhook] 👤 Fetching seller details for ${mainOrder.seller_id}...`);
      const { data: seller } = await supabase
        .from('sellers')
        .select('*')
        .eq('seller_id_public', mainOrder.seller_id)
        .maybeSingle();

      if (seller) {
        const netNotificationData = {
          ...commonNotificationData,
          totalAmount: netAmount,
          finalAmount: netAmount
        };

        // Seller Notification
        console.log(`[Webhook] 📧 Notifying seller: ${seller.email} with Net Amount: ${netAmount}`);
        await supabase.functions.invoke("send-seller-payment-notification", {
          body: { ...netNotificationData, sellerEmail: seller.email, sellerName: seller.full_name }
        });

        // HoS Notification
        if (seller.role === 'head_of_sales') {
          console.log(`[Webhook] 👑 Notifying HoS (Own Sale): ${seller.email}`);
          await supabase.functions.invoke("send-hos-payment-notification", {
            body: { ...netNotificationData, hosEmail: seller.email, hosName: seller.full_name, type: 'own_sale' }
          });
        } else if (seller.head_of_sales_id) {
          const { data: hos } = await supabase
            .from('sellers')
            .select('*')
            .eq('id', seller.head_of_sales_id)
            .maybeSingle();

          if (hos) {
            console.log(`[Webhook] 🚀 Notifying HoS (Team Sale): ${hos.email}`);
            await supabase.functions.invoke("send-hos-payment-notification", {
              body: { 
                ...netNotificationData, 
                hosEmail: hos.email, 
                hosName: hos.full_name, 
                sellerName: seller.full_name, 
                type: 'team_sale' 
              }
            });
          }
        }
      }
    }
  } catch (e) {
    console.error("[Webhook] ⚠️ Error sending notifications:", e);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { supabaseUrl, supabaseServiceKey } = getSupabaseConfig();
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
