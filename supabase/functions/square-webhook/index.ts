import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  appendServiceRequestEvent,
  ensureOperationalCaseInitialized,
} from "../shared/service-request-operational.ts";

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

function getEnvValue(keys: string[]): string {
  for (const key of keys) {
    const value = Deno.env.get(key);
    if (value) return value;
  }
  return "";
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
      signatureKey: getEnvValue(["SQUARE_WEBHOOK_SIGNATURE_KEY_PROD", "SQUARE_WEBHOOK_SIGNATURE_KEY"]),
      notificationUrl: getEnvValue(["SQUARE_WEBHOOK_NOTIFICATION_URL_PROD", "SQUARE_WEBHOOK_NOTIFICATION_URL"]) || defaultNotificationUrl,
    },
    {
      environment: "test" as const,
      signatureKey: getEnvValue(["SQUARE_WEBHOOK_SIGNATURE_KEY_TEST"]),
      notificationUrl: getEnvValue(["SQUARE_WEBHOOK_NOTIFICATION_URL_TEST"]) || defaultNotificationUrl,
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

async function runRecurringPostPayment(mainOrder: any, supabase: any) {
  if (mainOrder.product_slug === "eb3-installment-catalog") {
    try {
      const { data: clientData } = await supabase
        .from("clients")
        .select("id")
        .eq("email", mainOrder.client_email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const clientId = clientData?.id;
      if (clientId) {
        const { data: existingRecurrence } = await supabase
          .from("eb3_recurrence_control")
          .select("id")
          .eq("client_id", clientId)
          .maybeSingle();

        if (!existingRecurrence) {
          const { error } = await supabase.rpc("activate_eb3_recurrence", {
            p_client_id: clientId,
            p_activation_order_id: mainOrder.id,
            p_seller_id: mainOrder.seller_id || null,
            p_seller_commission_percent: mainOrder.seller_commission_percent || null,
          });

          if (error) {
            console.error("[Square Webhook] Error activating EB-3 recurrence:", error);
          }
        }
      }
    } catch (error) {
      console.error("[Square Webhook] Exception activating EB-3 recurrence:", error);
    }
  }

  if (mainOrder.product_slug === "scholarship-maintenance-fee") {
    try {
      const { data: clientData } = await supabase
        .from("clients")
        .select("id")
        .eq("email", mainOrder.client_email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const clientId = clientData?.id;
      if (clientId) {
        const { data: existingRecurrence } = await supabase
          .from("scholarship_recurrence_control")
          .select("id")
          .eq("client_id", clientId)
          .maybeSingle();

        if (!existingRecurrence) {
          const { error } = await supabase.rpc("activate_scholarship_recurrence", {
            p_client_id: clientId,
            p_activation_order_id: mainOrder.id,
            p_seller_id: mainOrder.seller_id || null,
            p_seller_commission_percent: mainOrder.seller_commission_percent || null,
          });

          if (error) {
            console.error("[Square Webhook] Error activating scholarship recurrence:", error);
          }
        }
      }
    } catch (error) {
      console.error("[Square Webhook] Exception activating scholarship recurrence:", error);
    }
  }

  if (mainOrder.payment_metadata?.eb3_schedule_id) {
    try {
      const { error } = await supabase.rpc("mark_eb3_installment_paid", {
        p_schedule_id: mainOrder.payment_metadata.eb3_schedule_id,
        p_payment_id: mainOrder.id,
      });

      if (error) {
        console.error("[Square Webhook] Error marking EB-3 installment as paid:", error);
      }
    } catch (error) {
      console.error("[Square Webhook] Exception marking EB-3 installment as paid:", error);
    }
  }

  if (mainOrder.payment_metadata?.scholarship_schedule_id) {
    try {
      const { error } = await supabase.rpc("mark_scholarship_installment_paid", {
        p_schedule_id: mainOrder.payment_metadata.scholarship_schedule_id,
        p_payment_id: mainOrder.id,
      });

      if (error) {
        console.error("[Square Webhook] Error marking scholarship installment as paid:", error);
      }
    } catch (error) {
      console.error("[Square Webhook] Exception marking scholarship installment as paid:", error);
    }
  }
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
  const paidAt = new Date().toISOString();
  const amountPaidUsd = typeof payment?.amount_money?.amount === "number"
    ? payment.amount_money.amount / 100
    : orders.reduce((sum: number, order: any) => sum + parseFloat(order.total_price_usd || 0), 0);

  for (const orderItem of orders) {
    const nextMetadata = {
      ...orderItem.payment_metadata,
      provider: "square",
      square_payment_id: payment.id,
      square_order_id: payment.order_id,
      square_status: payment.status,
      square_receipt_url: payment.receipt_url || null,
      square_location_id: payment.location_id || null,
      square_source_type: payment.source_type || null,
      total_usd: amountPaidUsd,
      completed_at: paidAt,
      fee_amount: orderItem.id === mainOrder.id ? feeAmount : 0,
    };

    await supabase
      .from("visa_orders")
      .update({
        payment_status: "completed",
        paid_at: paidAt,
        payment_method: "square_card",
        payment_metadata: nextMetadata,
      })
      .eq("id", orderItem.id);
  }

  if (mainOrder.service_request_id) {
    const paymentRecordId = mainOrder.payment_metadata?.payment_id || null;
    let paymentRecord = null;

    if (paymentRecordId) {
      const { data } = await supabase
        .from("payments")
        .select("id, raw_webhook_log")
        .eq("id", paymentRecordId)
        .maybeSingle();
      paymentRecord = data;
    }

    if (!paymentRecord) {
      const { data } = await supabase
      .from("payments")
      .select("id, raw_webhook_log")
      .eq("service_request_id", mainOrder.service_request_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
      paymentRecord = data;
    }

    if (paymentRecord?.id) {
      await supabase
        .from("payments")
        .update({
          status: "paid",
          external_payment_id: payment.id,
          updated_at: paidAt,
          raw_webhook_log: {
            ...(paymentRecord.raw_webhook_log || {}),
            provider: "square",
            payment_id: payment.id,
            payment_status: payment.status,
            square_order_id: payment.order_id,
            square_receipt_url: payment.receipt_url || null,
            amount_money: payment.amount_money || null,
            environment,
            received_at: paidAt,
          },
        })
        .eq("id", paymentRecord.id);
    }

    await supabase
      .from("service_requests")
      .update({ status: "paid", updated_at: paidAt })
      .eq("id", mainOrder.service_request_id);

    await ensureOperationalCaseInitialized(
      supabase,
      mainOrder.service_request_id,
      "gateway",
      {
        provider: "square",
        payment_id: payment.id,
        square_order_id: payment.order_id,
        order_id: mainOrder.id,
      },
    );

    await appendServiceRequestEvent(
      supabase,
      mainOrder.service_request_id,
      "payment_confirmed",
      "gateway",
      {
        provider: "square",
        order_id: mainOrder.id,
        order_number: mainOrder.order_number,
        square_payment_id: payment.id,
        square_order_id: payment.order_id,
        amount_money: payment.amount_money || null,
      },
    );
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

  await runRecurringPostPayment(mainOrder, supabase);

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
    const totalPaid = parseFloat(String(mainOrder.payment_metadata?.total_usd || 0)) ||
      orders.reduce((sum: number, order: any) => sum + parseFloat(order.total_price_usd || 0), 0);
    const netAmount = Math.max(totalPaid - feeAmount, 0);

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
        const failedAt = new Date().toISOString();
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
                failed_at: failedAt,
              },
            })
            .eq("id", order.id);
        }

        const mainOrder = orders.find((order: any) => !order.payment_metadata?.is_upsell) || orders[0];
        const paymentRecordId = mainOrder?.payment_metadata?.payment_id || null;
        const nextStatus = payment.status === "CANCELED" ? "cancelled" : "failed";

        if (paymentRecordId) {
          await supabase
            .from("payments")
            .update({
              status: nextStatus,
              updated_at: failedAt,
              raw_webhook_log: {
                provider: "square",
                payment_id: payment.id,
                payment_status: payment.status,
                square_order_id: payment.order_id,
                environment: webhookEnv.environment,
                received_at: failedAt,
              },
            })
            .eq("id", paymentRecordId);
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
