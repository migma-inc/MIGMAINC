import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ParcelowWebhookEvent {
  event: string; // "event_order_paid", "event_order_declined", etc.
  data: {
    id: number;
    reference: string;
    status: number;
    status_text: string;
    order_amount: number;
    total_usd: number;
    total_brl: number;
    installments: number;
    order_date: string;
    [key: string]: any;
  };
}

/**
 * Process Parcelow webhook event
 */
async function processParcelowWebhookEvent(
  event: ParcelowWebhookEvent,
  supabase: any
) {
  const { event: eventType, data } = event;

  console.log(`[Parcelow Webhook] Processing event: ${eventType}`);
  console.log(`[Parcelow Webhook] Order ID: ${data.id}`);
  console.log(`[Parcelow Webhook] Reference: ${data.reference}`);
  console.log(`[Parcelow Webhook] Status: ${data.status_text}`);

  // Find the visa order by parcelow_order_id or reference
  const { data: order, error: orderError } = await supabase
    .from("visa_orders")
    .select("id, order_number, payment_status, parcelow_status")
    .or(`parcelow_order_id.eq.${data.id},reference.eq.${data.reference}`)
    .single();

  if (orderError || !order) {
    console.error(
      `[Parcelow Webhook] Order not found for Parcelow order ${data.id} or reference ${data.reference}:`,
      orderError
    );
    return;
  }

  console.log(
    `[Parcelow Webhook] Found order ${order.order_number} (${order.id})`
  );

  // Update visa_orders based on event type
  let paymentStatus = order.payment_status;
  let shouldGenerateContract = false;
  let shouldSendEmail = false;

  switch (eventType) {
    case "event_order_paid":
      // Payment completed
      paymentStatus = "completed";
      shouldGenerateContract = true;
      shouldSendEmail = true;
      break;

    case "event_order_confirmed":
      // Order confirmed (payment might be pending)
      if (paymentStatus === "pending") {
        // Keep as pending, but update status
      }
      break;

    case "event_order_declined":
      // Payment declined
      paymentStatus = "failed";
      break;

    case "event_order_canceled":
      paymentStatus = "cancelled";
      break;

    case "event_order_expired":
      paymentStatus = "cancelled";
      break;

    case "event_order_waiting":
    case "event_order_waiting_payment":
    case "event_order_waiting_docs":
      // Waiting states - keep as pending
      break;

    default:
      // Other events - just update status
      break;
  }

  // Update visa_orders
  const updateData: any = {
    parcelow_status: data.status_text,
    parcelow_status_code: data.status,
  };

  if (paymentStatus !== order.payment_status) {
    updateData.payment_status = paymentStatus;
  }

  const { error: updateError } = await supabase
    .from("visa_orders")
    .update(updateData)
    .eq("id", order.id);

  if (updateError) {
    console.error(`[Parcelow Webhook] Error updating visa_orders:`, updateError);
    return;
  }

  console.log(
    `[Parcelow Webhook] ✅ Updated order ${order.order_number} to status: ${paymentStatus}`
  );

  // Generate contract PDF if payment completed
  if (shouldGenerateContract) {
    try {
      const { error: contractError } = await supabase.functions.invoke(
        "generate-visa-contract-pdf",
        {
          body: { order_id: order.id },
        }
      );

      if (contractError) {
        console.error(
          `[Parcelow Webhook] Error generating contract PDF:`,
          contractError
        );
      } else {
        console.log(
          `[Parcelow Webhook] ✅ Contract PDF generated for order ${order.order_number}`
        );
      }
    } catch (error) {
      console.error(
        `[Parcelow Webhook] Error invoking contract PDF generation:`,
        error
      );
    }
  }

  // Send confirmation email if payment completed
  if (shouldSendEmail) {
    try {
      const { error: emailError } = await supabase.functions.invoke(
        "send-visa-order-confirmation",
        {
          body: { order_id: order.id },
        }
      );

      if (emailError) {
        console.error(
          `[Parcelow Webhook] Error sending confirmation email:`,
          emailError
        );
      } else {
        console.log(
          `[Parcelow Webhook] ✅ Confirmation email sent for order ${order.order_number}`
        );
      }
    } catch (error) {
      console.error(
        `[Parcelow Webhook] Error invoking email sending:`,
        error
      );
    }
  }
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[Parcelow Webhook] ========== REQUEST RECEIVED ==========");
    console.log("[Parcelow Webhook] Method:", req.method);
    console.log("[Parcelow Webhook] URL:", req.url);

    // Read request body
    const bodyText = await req.text();
    console.log("[Parcelow Webhook] Request body:", bodyText);

    // Parse webhook event
    let event: ParcelowWebhookEvent;
    try {
      event = JSON.parse(bodyText);
    } catch (error) {
      console.error("[Parcelow Webhook] ❌ Invalid JSON in request body");
      return new Response(
        JSON.stringify({ error: "Invalid JSON" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Parcelow Webhook] ✅ Valid webhook received: ${event.event}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Process webhook event
    await processParcelowWebhookEvent(event, supabase);

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[Parcelow Webhook] ❌ Error processing webhook:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
