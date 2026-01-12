import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { crypto } from "jsr:@std/crypto@1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-signature-sha256",
};

interface WiseWebhookEvent {
  subscription_id: string;
  event_type: string;
  data: {
    resource: string;
    current_state: string;
    previous_state?: string;
    occurred_at: string;
    transfer_id?: string;
    profile_id?: string;
    [key: string]: any;
  };
}

/**
 * Verify Wise webhook signature
 */
async function verifyWiseWebhookSignature(
  body: string,
  signature: string | null,
  secret: string
): Promise<boolean> {
  if (!signature) {
    return false;
  }

  try {
    // Wise uses SHA-256 HMAC for webhook signatures
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(body);

    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signatureBuffer = await crypto.subtle.sign("HMAC", key, messageData);
    const calculatedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Compare signatures (constant-time comparison)
    if (calculatedSignature.length !== signature.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < calculatedSignature.length; i++) {
      result |= calculatedSignature.charCodeAt(i) ^ signature.charCodeAt(i);
    }

    return result === 0;
  } catch (error) {
    console.error("[Wise Webhook] Signature verification error:", error);
    return false;
  }
}

/**
 * Process Wise webhook event
 */
async function processWiseWebhookEvent(
  event: WiseWebhookEvent,
  supabase: any
) {
  const { event_type, data } = event;

  console.log(`[Wise Webhook] Processing event: ${event_type}`);
  console.log(`[Wise Webhook] Transfer ID: ${data.transfer_id}`);
  console.log(`[Wise Webhook] Current state: ${data.current_state}`);

  // Only process transfer state change events
  if (event_type !== "transfers#state-change" || !data.transfer_id) {
    console.log(`[Wise Webhook] Ignoring event type: ${event_type}`);
    return;
  }

  const transferId = data.transfer_id;
  const currentState = data.current_state;

  // Find the visa order by wise_transfer_id
  const { data: order, error: orderError } = await supabase
    .from("visa_orders")
    .select("id, order_number, payment_status, wise_payment_status")
    .eq("wise_transfer_id", transferId)
    .single();

  if (orderError || !order) {
    console.error(
      `[Wise Webhook] Order not found for transfer ${transferId}:`,
      orderError
    );
    return;
  }

  console.log(
    `[Wise Webhook] Found order ${order.order_number} (${order.id})`
  );

  // Update wise_transfers table
  const { error: transferUpdateError } = await supabase
    .from("wise_transfers")
    .update({
      status: currentState,
      status_details: data,
      updated_at: new Date().toISOString(),
    })
    .eq("wise_transfer_id", transferId);

  if (transferUpdateError) {
    console.error(
      `[Wise Webhook] Error updating wise_transfers:`,
      transferUpdateError
    );
  }

  // Update visa_orders based on transfer status
  let paymentStatus = order.payment_status;
  let shouldGenerateContract = false;
  let shouldSendEmail = false;

  switch (currentState) {
    case "outgoing_payment_sent":
      // Payment completed - money sent to recipient
      paymentStatus = "completed";
      shouldGenerateContract = true;
      shouldSendEmail = true;
      break;

    case "funds_converted":
      // Funds converted, waiting for payment to be sent
      // Keep as pending but update wise_payment_status
      break;

    case "bounced_back":
    case "funds_refunded":
      // Payment failed or refunded
      paymentStatus = "failed";
      break;

    case "cancelled":
      paymentStatus = "cancelled";
      break;

    case "charged_back":
      // Chargeback - similar to failed
      paymentStatus = "failed";
      break;

    default:
      // Other states (incoming_payment_waiting, processing, etc.)
      // Keep current status, just update wise_payment_status
      break;
  }

  // Update visa_orders
  const updateData: any = {
    wise_payment_status: currentState,
  };

  if (paymentStatus !== order.payment_status) {
    updateData.payment_status = paymentStatus;
  }

  const { error: updateError } = await supabase
    .from("visa_orders")
    .update(updateData)
    .eq("id", order.id);

  if (updateError) {
    console.error(`[Wise Webhook] Error updating visa_orders:`, updateError);
    return;
  }

  console.log(
    `[Wise Webhook] ✅ Updated order ${order.order_number} to status: ${paymentStatus}`
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
          `[Wise Webhook] Error generating contract PDF:`,
          contractError
        );
      } else {
        console.log(
          `[Wise Webhook] ✅ Contract PDF generated for order ${order.order_number}`
        );
      }
    } catch (error) {
      console.error(
        `[Wise Webhook] Error invoking contract PDF generation:`,
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
          `[Wise Webhook] Error sending confirmation email:`,
          emailError
        );
      } else {
        console.log(
          `[Wise Webhook] ✅ Confirmation email sent for order ${order.order_number}`
        );
      }
    } catch (error) {
      console.error(
        `[Wise Webhook] Error invoking email sending:`,
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
    // Get signature from headers
    const signature = req.headers.get("X-Signature-SHA256");
    
    // Get webhook secret from environment
    const webhookSecret = Deno.env.get("WISE_WEBHOOK_SECRET");

    // If no signature, this might be a test request from Wise UI
    // Return 200 OK to allow webhook creation, but don't process
    if (!signature) {
      console.log("[Wise Webhook] ℹ️ Request without signature - likely a test from Wise UI");
      return new Response(
        JSON.stringify({ received: true, message: "Webhook endpoint is ready" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If signature exists but secret is not configured, this might be a test POST from Wise
    // Return 200 OK to allow webhook creation, but don't process
    if (!webhookSecret) {
      console.log("[Wise Webhook] ℹ️ Request with signature but WISE_WEBHOOK_SECRET not configured - likely a test from Wise");
      return new Response(
        JSON.stringify({ received: true, message: "Webhook endpoint is ready (secret not configured yet)" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Read request body as text for signature verification
    const bodyText = await req.text();

    // Verify signature for real webhook requests
    const isValid = await verifyWiseWebhookSignature(
      bodyText,
      signature,
      webhookSecret
    );

    if (!isValid) {
      console.error("[Wise Webhook] ❌ Invalid webhook signature");
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse webhook event
    const event: WiseWebhookEvent = JSON.parse(bodyText);

    console.log(`[Wise Webhook] ✅ Valid webhook received: ${event.event_type}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Process webhook event
    await processWiseWebhookEvent(event, supabase);

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[Wise Webhook] ❌ Error processing webhook:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
