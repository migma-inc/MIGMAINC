import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-square-hmacsha256-signature",
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

function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);

  if (aBytes.length !== bBytes.length) {
    return false;
  }

  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) {
    diff |= aBytes[i] ^ bBytes[i];
  }
  return diff === 0;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

async function computeSignature(signatureKey: string, notificationUrl: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(signatureKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${notificationUrl}${body}`),
  );

  return bytesToBase64(new Uint8Array(signature));
}

async function resolveWebhookEnvironment(body: string, receivedSignature: string | null): Promise<null | { environment: "production" | "test"; notificationUrl: string }> {
  if (!receivedSignature) {
    return null;
  }

  const supabaseUrl =
    Deno.env.get("MIGMA_REMOTE_URL") ||
    Deno.env.get("REMOTE_SUPABASE_URL") ||
    Deno.env.get("SUPABASE_URL") ||
    "";
  const defaultNotificationUrl = `${supabaseUrl}/functions/v1/square-webhook`;
  const candidates = [
    {
      environment: "production" as const,
      signatureKey: Deno.env.get("SQUARE_WEBHOOK_SIGNATURE_KEY_PROD") || "",
      notificationUrl: Deno.env.get("SQUARE_WEBHOOK_NOTIFICATION_URL_PROD") || defaultNotificationUrl,
    },
    {
      environment: "test" as const,
      signatureKey: Deno.env.get("SQUARE_WEBHOOK_SIGNATURE_KEY_TEST") || "",
      notificationUrl: Deno.env.get("SQUARE_WEBHOOK_NOTIFICATION_URL_TEST") || defaultNotificationUrl,
    },
  ].filter((candidate) => candidate.signatureKey);

  for (const candidate of candidates) {
    const expected = await computeSignature(candidate.signatureKey, candidate.notificationUrl, body);
    if (timingSafeEqual(expected, receivedSignature)) {
      return { environment: candidate.environment, notificationUrl: candidate.notificationUrl };
    }
  }

  return null;
}

function extractPayment(event: any) {
  const possibleObjects = [
    event?.data?.object?.payment,
    event?.data?.object,
    event?.data?.payment,
    event?.payment,
  ];

  return possibleObjects.find((candidate) => candidate && candidate.id && candidate.status && candidate.order_id) || null;
}

async function processCompletedPayment(payment: any, supabase: any, environment: "production" | "test") {
  const { data: orders, error: orderError } = await supabase
    .from("visa_orders")
    .select("*")
    .eq("payment_metadata->>square_order_id", payment.order_id);

  if (orderError || !orders || orders.length === 0) {
    console.error("[Square Webhook] No orders found for Square order:", payment.order_id, orderError);
    return;
  }

  const mainOrder = orders.find((order: any) => !order.payment_metadata?.is_upsell) || orders[0];
  if (mainOrder.payment_status === "completed") {
    console.log("[Square Webhook] Payment already processed:", payment.id);
    return;
  }

  const feeAmount = parseFloat(mainOrder.payment_metadata?.fee_amount || "0");

  for (const orderItem of orders) {
    const nextMetadata = {
      ...orderItem.payment_metadata,
      provider: "square",
      square_payment_id: payment.id,
      square_order_id: payment.order_id,
      square_status: payment.status,
      square_receipt_url: payment.receipt_url || null,
      completed_at: new Date().toISOString(),
      fee_amount: orderItem.id === mainOrder.id ? feeAmount : 0,
    };

    await supabase
      .from("visa_orders")
      .update({
        payment_status: "completed",
        paid_at: new Date().toISOString(),
        payment_method: "square_card",
        payment_metadata: nextMetadata,
      })
      .eq("id", orderItem.id);
  }

  if (mainOrder.service_request_id) {
    const { data: paymentRecord } = await supabase
      .from("payments")
      .select("id, raw_webhook_log")
      .eq("service_request_id", mainOrder.service_request_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (paymentRecord?.id) {
      await supabase
        .from("payments")
        .update({
          status: "paid",
          external_payment_id: payment.id,
          updated_at: new Date().toISOString(),
          raw_webhook_log: {
            ...(paymentRecord.raw_webhook_log || {}),
            provider: "square",
            payment_id: payment.id,
            payment_status: payment.status,
            square_order_id: payment.order_id,
            environment,
            received_at: new Date().toISOString(),
          },
        })
        .eq("id", paymentRecord.id);
    }

    await supabase
      .from("service_requests")
      .update({ status: "paid", updated_at: new Date().toISOString() })
      .eq("id", mainOrder.service_request_id);
  }

  if (mainOrder.seller_id) {
    try {
      await supabase.from("seller_funnel_events").insert({
        seller_id: mainOrder.seller_id,
        product_slug: mainOrder.product_slug,
        event_type: "payment_completed",
        session_id: `order_${mainOrder.id}`,
        metadata: { order_id: mainOrder.id, provider: "square", has_bundle: orders.length > 1 },
      });
    } catch (_error) {
      // best effort
    }
  }

  const isTestUser = mainOrder.client_email?.toLowerCase() === "victuribdev@gmail.com" ||
    mainOrder.client_email?.toLowerCase() === "victtinho.ribeiro@gmail.com" ||
    mainOrder.client_name?.toLowerCase().includes("paulo victor") ||
    mainOrder.client_name?.toLowerCase().includes("paulo víctor") ||
    mainOrder.client_email?.toLowerCase().includes("@uorak");

  if (isTestUser) {
    await supabase.from("visa_orders").update({ is_test: true }).in("id", orders.map((order: any) => order.id));
  }

  for (const orderForPdf of orders) {
    if (orderForPdf.product_slug !== "consultation-common") {
      try {
        await supabase.functions.invoke("generate-visa-contract-pdf", { body: { order_id: orderForPdf.id } });
      } catch (_error) {
        // best effort
      }
    }

    try {
      await supabase.functions.invoke("generate-annex-pdf", { body: { order_id: orderForPdf.id } });
    } catch (_error) {
      // best effort
    }

    try {
      await supabase.functions.invoke("generate-invoice-pdf", { body: { order_id: orderForPdf.id } });
    } catch (_error) {
      // best effort
    }
  }

  try {
    const totalPaid = orders.reduce((sum: number, order: any) => sum + parseFloat(order.total_price_usd || 0), 0);
    const netAmount = totalPaid - feeAmount;

    const commonNotificationData = {
      clientName: mainOrder.client_name,
      clientEmail: mainOrder.client_email,
      orderNumber: mainOrder.order_number,
      productSlug: mainOrder.product_slug,
      totalAmount: totalPaid,
      paymentMethod: "square_card",
      currency: "USD",
      finalAmount: totalPaid,
      is_bundle: orders.length > 1,
      extraUnits: mainOrder.extra_units,
    };

    await supabase.functions.invoke("send-payment-confirmation-email", { body: commonNotificationData });
    await supabase.functions.invoke("send-admin-payment-notification", {
      body: { ...commonNotificationData, is_test: isTestUser },
    });

    if (mainOrder.seller_id) {
      const { data: seller } = await supabase
        .from("sellers")
        .select("*")
        .eq("seller_id_public", mainOrder.seller_id)
        .maybeSingle();

      if (seller) {
        const netNotificationData = {
          ...commonNotificationData,
          totalAmount: netAmount,
          finalAmount: netAmount,
        };

        await supabase.functions.invoke("send-seller-payment-notification", {
          body: { ...netNotificationData, sellerEmail: seller.email, sellerName: seller.full_name },
        });

        if (seller.role === "head_of_sales") {
          await supabase.functions.invoke("send-hos-payment-notification", {
            body: { ...netNotificationData, hosEmail: seller.email, hosName: seller.full_name, type: "own_sale" },
          });
        } else if (seller.head_of_sales_id) {
          const { data: hos } = await supabase
            .from("sellers")
            .select("*")
            .eq("id", seller.head_of_sales_id)
            .maybeSingle();

          if (hos) {
            await supabase.functions.invoke("send-hos-payment-notification", {
              body: {
                ...netNotificationData,
                hosEmail: hos.email,
                hosName: hos.full_name,
                sellerName: seller.full_name,
                type: "team_sale",
              },
            });
          }
        }
      }
    }
  } catch (notificationError) {
    console.error("[Square Webhook] Notification error:", notificationError);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();
    const receivedSignature = req.headers.get("x-square-hmacsha256-signature");
    const webhookEnv = await resolveWebhookEnvironment(rawBody, receivedSignature);

    if (!webhookEnv) {
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const event = JSON.parse(rawBody);
    if (event?.type !== "payment.updated") {
      return new Response(JSON.stringify({ received: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payment = extractPayment(event);
    if (!payment) {
      return new Response(JSON.stringify({ received: true, skipped: true, reason: "No payment payload" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { supabaseUrl, supabaseServiceKey } = getSupabaseConfig();
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (payment.status === "COMPLETED") {
      await processCompletedPayment(payment, supabase, webhookEnv.environment);
    } else if (payment.status === "FAILED" || payment.status === "CANCELED") {
      const { data: orders } = await supabase
        .from("visa_orders")
        .select("id, payment_metadata")
        .eq("payment_metadata->>square_order_id", payment.order_id);

      if (orders?.length) {
        for (const order of orders) {
          await supabase
            .from("visa_orders")
            .update({
              payment_status: payment.status === "CANCELED" ? "cancelled" : "failed",
              payment_metadata: {
                ...order.payment_metadata,
                provider: "square",
                square_payment_id: payment.id,
                square_order_id: payment.order_id,
                square_status: payment.status,
                failed_at: new Date().toISOString(),
              },
            })
            .eq("id", order.id);
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[Square Webhook] Error:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
