import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
};

interface ParcelowWebhookEvent {
  event: string; // "event_order_paid", "event_order_declined", etc.
  order?: {
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
  data?: {
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
  timestamp?: string;
}

// Normalize service name for grouped products (initial, cos, transfer)
function normalizeServiceName(productSlug: string, productName: string): string {
  // F1 Initial - agrupa os 3 produtos (selection-process, scholarship, i20-control)
  if (productSlug.startsWith('initial-')) {
    return 'F1 Initial';
  }

  // COS - agrupa os 3 produtos
  if (productSlug.startsWith('cos-')) {
    return 'COS & Transfer';
  }

  // Transfer - agrupa os 3 produtos
  if (productSlug.startsWith('transfer-')) {
    return 'COS & Transfer';
  }

  // Para outros produtos, retorna o nome original
  return productName;
}


/**
 * Process Parcelow webhook event
 */
async function processParcelowWebhookEvent(
  event: ParcelowWebhookEvent,
  supabase: any
) {
  const { event: eventType } = event;

  // Normalize payload: Parcelow can send either 'order' or 'data'
  const parcelowOrder = event.order || event.data;

  if (!parcelowOrder) {
    console.error(`[Parcelow Webhook] ❌ Invalid payload: missing 'order' or 'data' field`);
    return;
  }

  console.log(`[Parcelow Webhook] ========== PROCESSING EVENT ==========`);
  console.log(`[Parcelow Webhook] Event type: ${eventType}`);
  console.log(`[Parcelow Webhook] Parcelow Order ID: ${parcelowOrder.id}`);
  console.log(`[Parcelow Webhook] Reference: ${parcelowOrder.reference || 'N/A'}`);
  console.log(`[Parcelow Webhook] Status: ${parcelowOrder.status_text || 'N/A'} (code: ${parcelowOrder.status})`);
  console.log(`[Parcelow Webhook] Total USD: ${parcelowOrder.total_usd || 0}, Total BRL: ${parcelowOrder.total_brl || 0}`);
  console.log(`[Parcelow Webhook] Installments: ${parcelowOrder.installments || 1}`);

  // Find the visa order by parcelow_order_id
  // Select all fields needed for complete processing
  const { data: order, error: orderError } = await supabase
    .from("visa_orders")
    .select("*")
    .eq("parcelow_order_id", parcelowOrder.id.toString())
    .single();

  if (orderError || !order) {
    console.error(
      `[Parcelow Webhook] ❌ Order not found for Parcelow order ${parcelowOrder.id}:`,
      orderError
    );
    return;
  }

  console.log(
    `[Parcelow Webhook] ✅ Found order ${order.order_number} (${order.id})`
  );
  console.log(`[Parcelow Webhook] Order details:`, {
    service_request_id: order.service_request_id,
    seller_id: order.seller_id,
    product_slug: order.product_slug,
    current_payment_status: order.payment_status,
  });

  // PROTEÇÃO DE IDEMPOTÊNCIA: Se a ordem já está completa no banco, retorne imediatamente
  // Isso evita que retentativas do webhook disparem e-mails e gerações de PDF repetidas
  if (order.payment_status === 'completed' && eventType === 'event_order_paid') {
    console.log(`[Parcelow Webhook] 🛡️ Order ${order.order_number} is ALREADY marked as completed. Skipping and returning 200 OK to prevent duplicate notifications.`);
    return;
  }

  // Update visa_orders based on event type
  let paymentStatus = order.payment_status;
  let shouldProcessPayment = false; // Flag for full payment processing

  console.log(`[Parcelow Webhook] 🔍 PAYMENT STATUS ANALYSIS:`);
  console.log(`[Parcelow Webhook] - Current DB payment_status: ${paymentStatus}`);
  console.log(`[Parcelow Webhook] - Parcelow status: ${parcelowOrder.status} (${parcelowOrder.status_text})`);
  console.log(`[Parcelow Webhook] - Event type: ${eventType}`);
  console.log(`[Parcelow Webhook] - Payments array: ${JSON.stringify(parcelowOrder.payments || [])}`);
  console.log(`[Parcelow Webhook] - Order amount: ${parcelowOrder.order_amount}`);
  console.log(`[Parcelow Webhook] - Total USD: ${parcelowOrder.total_usd}`);

  switch (eventType) {
    case "event_order_paid":
      // Payment completed - process full flow
      console.log(`[Parcelow Webhook] ✅ PAYMENT COMPLETED - Will process full flow`);
      paymentStatus = "completed";
      shouldProcessPayment = true;
      break;

    case "event_order_confirmed":
      // Order confirmed (payment might be pending)
      console.log(`[Parcelow Webhook] ℹ️ ORDER CONFIRMED - Payment may still be pending`);
      if (paymentStatus === "pending") {
        // Keep as pending, but update status
        console.log(`[Parcelow Webhook] - Keeping status as 'pending'`);
      }
      break;

    case "event_order_declined":
      // Payment declined
      console.log(`[Parcelow Webhook] ❌ PAYMENT DECLINED`);
      paymentStatus = "failed";
      break;

    case "event_order_canceled":
      console.log(`[Parcelow Webhook] ❌ ORDER CANCELED`);
      paymentStatus = "cancelled";
      break;

    case "event_order_expired":
      console.log(`[Parcelow Webhook] ⏰ ORDER EXPIRED`);
      paymentStatus = "cancelled";
      break;

    case "event_order_waiting":
    case "event_order_waiting_payment":
    case "event_order_waiting_docs":
      // Waiting states - keep as pending
      console.log(`[Parcelow Webhook] ⏳ WAITING STATE - ${eventType}`);
      break;

    default:
      // Other events - just update status
      console.log(`[Parcelow Webhook] ⚠️ Unknown event type: ${eventType}`);
      break;
  }

  // Update visa_orders with payment_method and complete payment_metadata
  const updateData: any = {
    parcelow_status: parcelowOrder.status_text,
    parcelow_status_code: parcelowOrder.status,
  };

  if (paymentStatus !== order.payment_status) {
    updateData.payment_status = paymentStatus;
  }

  // If payment completed, update payment_method and payment_metadata
  if (shouldProcessPayment) {
    // Extract payment details - the correct BRL value is in payments[0].total_brl
    const paymentDetails = parcelowOrder.payments?.[0];
    const actualTotalBrl = paymentDetails?.total_brl; // This includes installment fees!
    const actualInstallments = paymentDetails?.installments || parcelowOrder.installments || 1;

    // Log ALL fields from Parcelow to identify correct BRL value
    console.log(`[Parcelow Webhook] 🔍 COMPLETE PARCELOW ORDER DATA:`, JSON.stringify(parcelowOrder, null, 2));
    console.log(`[Parcelow Webhook] 📊 PAYMENT VALUES:`, {
      order_amount: parcelowOrder.order_amount,
      total_usd: parcelowOrder.total_usd,
      total_brl_root: parcelowOrder.total_brl, // This is base amount WITHOUT installment fees
      payments_total_brl: actualTotalBrl, // ✅ This is the CORRECT value WITH installment fees
      installments: actualInstallments,
      payment_details: paymentDetails,
    });

    updateData.payment_method = "parcelow";
    updateData.payment_metadata = {
      ...(order.payment_metadata || {}),
      payment_method: "parcelow",
      completed_at: new Date().toISOString(),
      parcelow_order_id: parcelowOrder.id,
      installments: actualInstallments,
      // Save USD values as decimal (USD) - Parcelow returns cents
      total_usd: (parcelowOrder.total_usd || parcelowOrder.order_amount || 0) / 100,
      // Save CORRECT BRL value (already formatted as decimal string, includes installment fees)
      total_brl: actualTotalBrl || parcelowOrder.total_brl || 0,
      // Calculate fee amount (Gross - Net) in decimal (USD)
      fee_amount: ((parcelowOrder.total_usd || 0) - (parcelowOrder.order_amount || 0)) / 100,
      // Also save base BRL for reference
      base_brl: parcelowOrder.total_brl || 0,
      order_date: parcelowOrder.order_date || new Date().toISOString(),
    };
  }

  const { error: updateError } = await supabase
    .from("visa_orders")
    .update(updateData)
    .eq("id", order.id);

  if (updateError) {
    console.error(`[Parcelow Webhook] ❌ Error updating visa_orders:`, updateError);
    return;
  }

  console.log(
    `[Parcelow Webhook] ✅ Updated order ${order.order_number} to status: ${paymentStatus}`
  );

  console.log(`[Parcelow Webhook] 🔍 POST-PAYMENT PROCESSING DECISION:`);
  console.log(`[Parcelow Webhook] - shouldProcessPayment: ${shouldProcessPayment}`);
  console.log(`[Parcelow Webhook] - Reason: ${shouldProcessPayment ? 'Payment completed (event_order_paid received)' : `Event type is '${eventType}', not 'event_order_paid'`}`);

  // Only process full payment flow if payment is completed
  if (!shouldProcessPayment) {
    console.log(`[Parcelow Webhook] ℹ️ Payment not completed, skipping post-payment processing`);
    console.log(`[Parcelow Webhook] ℹ️ Waiting for 'event_order_paid' webhook to process payment`);
    return;
  }

  // ========== POST-PAYMENT PROCESSING (Critical Operations) ==========

  // 1. Update payment record if service_request_id exists
  if (order.service_request_id) {
    console.log(`[Parcelow Webhook] 📋 Updating payment record for service_request_id: ${order.service_request_id}`);

    const { data: paymentRecord } = await supabase
      .from("payments")
      .select("id")
      .eq("service_request_id", order.service_request_id)
      .eq("external_payment_id", parcelowOrder.id.toString())
      .single();

    if (paymentRecord) {
      const { error: paymentUpdateError } = await supabase
        .from("payments")
        .update({
          status: "paid",
          external_payment_id: parcelowOrder.id.toString(),
          raw_webhook_log: {
            event_type: eventType,
            parcelow_order_id: parcelowOrder.id,
            reference: parcelowOrder.reference || 'N/A',
            status: parcelowOrder.status,
            status_text: parcelowOrder.status_text || 'N/A',
            total_usd: (parcelowOrder.total_usd || parcelowOrder.order_amount || 0) / 100,
            total_brl: parcelowOrder.total_brl || 0,
            installments: parcelowOrder.installments || 1,
            completed_at: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", paymentRecord.id);

      if (paymentUpdateError) {
        console.error(`[Parcelow Webhook] ❌ Error updating payment record:`, paymentUpdateError);
      } else {
        console.log(`[Parcelow Webhook] ✅ Payment record updated: ${paymentRecord.id}`);
      }
    } else {
      console.log(`[Parcelow Webhook] ℹ️ No payment record found for service_request_id: ${order.service_request_id}`);
    }

    // 2. Update service_request status to 'paid'
    console.log(`[Parcelow Webhook] 📋 Updating service_request status to 'paid'`);
    const { error: serviceRequestError } = await supabase
      .from("service_requests")
      .update({
        status: "paid",
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.service_request_id);

    if (serviceRequestError) {
      console.error(`[Parcelow Webhook] ❌ Error updating service_request:`, serviceRequestError);
    } else {
      console.log(`[Parcelow Webhook] ✅ Service request status updated to 'paid': ${order.service_request_id}`);
    }
  } else {
    console.log(`[Parcelow Webhook] ℹ️ No service_request_id, skipping payment and service_request updates`);
  }

  // 3. Track payment completed in seller_funnel_events
  if (order.seller_id) {
    console.log(`[Parcelow Webhook] 📊 Tracking payment completed in seller_funnel_events`);
    try {
      const { error: trackError } = await supabase
        .from('seller_funnel_events')
        .insert({
          seller_id: order.seller_id,
          product_slug: order.product_slug,
          event_type: 'payment_completed',
          session_id: `order_${order.id}`,
          metadata: {
            order_id: order.id,
            order_number: order.order_number,
            payment_method: 'parcelow',
            total_amount: order.total_price_usd,
            parcelow_order_id: parcelowOrder.id,
            installments: parcelowOrder.installments,
          },
        });

      if (trackError) {
        console.error(`[Parcelow Webhook] ❌ Error tracking payment completed:`, trackError);
      } else {
        console.log(`[Parcelow Webhook] ✅ Payment completed tracked in funnel`);
      }
    } catch (trackError) {
      console.error(`[Parcelow Webhook] ❌ Exception tracking payment completed:`, trackError);
      // Continue - tracking is not critical
    }
  } else {
    console.log(`[Parcelow Webhook] ℹ️ No seller_id, skipping funnel tracking`);
  }

  // ========== POST-PAYMENT PROCESSING (Non-Critical Operations) ==========

  // 4. Generate full contract PDF (optional - if template exists)
  if (order.product_slug !== 'consultation-common') {
    console.log(`[Parcelow Webhook] 📄 Generating contract PDF...`);
    try {
      const { data: pdfData, error: pdfError } = await supabase.functions.invoke("generate-visa-contract-pdf", {
        body: { order_id: order.id },
      });

      if (pdfError) {
        console.error(`[Parcelow Webhook] ❌ Error generating contract PDF:`, pdfError);
      } else {
        console.log(`[Parcelow Webhook] ✅ Contract PDF generated successfully:`, pdfData?.pdf_url);
      }
    } catch (pdfError) {
      console.error(`[Parcelow Webhook] ❌ Exception generating contract PDF:`, pdfError);
      // Continue - PDF generation is not critical for payment processing
    }
  }

  // 5. Generate ANNEX I PDF for ALL products (universal requirement)
  console.log(`[Parcelow Webhook] 📄 Generating ANNEX I PDF (required for all products)...`);
  try {
    const { data: annexPdfData, error: annexPdfError } = await supabase.functions.invoke("generate-annex-pdf", {
      body: { order_id: order.id },
    });

    if (annexPdfError) {
      console.error(`[Parcelow Webhook] ❌ Error generating ANNEX I PDF:`, annexPdfError);
    } else {
      console.log(`[Parcelow Webhook] ✅ ANNEX I PDF generated successfully:`, annexPdfData?.pdf_url);
    }
  } catch (annexPdfError) {
    console.error(`[Parcelow Webhook] ❌ Exception generating ANNEX I PDF:`, annexPdfError);
    // Continue - PDF generation is not critical for payment processing
  }

  // 6. Generate Invoice PDF for ALL products
  console.log(`[Parcelow Webhook] 📄 Generating Invoice PDF...`);
  try {
    const { data: invoiceData, error: invoiceError } = await supabase.functions.invoke("generate-invoice-pdf", {
      body: { order_id: order.id },
    });

    if (invoiceError) {
      console.error(`[Parcelow Webhook] ❌ Error generating Invoice PDF:`, invoiceError);
    } else {
      console.log(`[Parcelow Webhook] ✅ Invoice PDF generated successfully:`, invoiceData?.pdf_url);
    }
  } catch (invoiceError) {
    console.error(`[Parcelow Webhook] ❌ Exception generating Invoice PDF:`, invoiceError);
  }

  // Get currency and final amount from payment_metadata or use defaults
  // Parcelow returns amounts in cents, so we need to divide by 100 for the email
  const metadata = updateData.payment_metadata || order.payment_metadata || {};
  const currency = metadata.currency || (parcelowOrder.total_brl ? "BRL" : "USD");

  let finalAmountValue = metadata.final_amount;
  if (!finalAmountValue) {
    if (currency === "BRL") {
      finalAmountValue = parcelowOrder.total_brl ? (parcelowOrder.total_brl / 100) : null;
    } else {
      // metadata.total_usd is now already divided by 100 in our updateData logic if we just set it
      // but let's use the raw parcelowOrder and divide by 100 here to be safe for email
      finalAmountValue = parcelowOrder.total_usd ? (parcelowOrder.total_usd / 100) : null;
    }
  }

  const finalAmount = finalAmountValue || order.total_price_usd;

  // 6. Send confirmation email to client
  console.log(`[Parcelow Webhook] 📧 Sending payment confirmation email...`);
  try {

    const { error: emailError } = await supabase.functions.invoke("send-payment-confirmation-email", {
      body: {
        clientName: order.client_name,
        clientEmail: order.client_email,
        orderNumber: order.order_number,
        productSlug: order.product_slug,
        totalAmount: order.total_price_usd,
        paymentMethod: "parcelow",
        currency: currency,
        finalAmount: finalAmount,
      },
    });

    if (emailError) {
      console.error(`[Parcelow Webhook] ❌ Error sending payment confirmation email:`, emailError);
    } else {
      console.log(`[Parcelow Webhook] ✅ Payment confirmation email sent to client`);
    }
  } catch (emailError) {
    console.error(`[Parcelow Webhook] ❌ Exception sending payment confirmation email:`, emailError);
    // Continue - email sending is not critical for payment processing
  }

  // 7. Send notification to seller if seller_id exists (n8n webhook removed)

  // 8. Send notification to seller if seller_id exists
  if (order.seller_id) {
    console.log(`[Parcelow Webhook] 📧 Sending seller notification: ${order.seller_id}`);
    try {
      // Fetch seller details from 'sellers' table (not 'users')
      const { data: seller, error: sellerError } = await supabase
        .from('sellers')
        .select('email, full_name')
        .eq('seller_id_public', order.seller_id)
        .single();

      if (sellerError || !seller) {
        console.error(`[Parcelow Webhook] ❌ Error fetching seller:`, sellerError);
      } else {
        // Send notification email to seller
        const { error: sellerEmailError } = await supabase.functions.invoke("send-seller-payment-notification", {
          body: {
            sellerId: order.seller_id,
            sellerEmail: seller.email,
            sellerName: seller.full_name || 'Seller',
            orderNumber: order.order_number,
            clientName: order.client_name,
            productSlug: order.product_slug,
            totalAmount: order.total_price_usd,
            paymentMethod: "parcelow",
            currency: currency,
            finalAmount: finalAmount,
          },
        });

        if (sellerEmailError) {
          console.error(`[Parcelow Webhook] ❌ Error sending seller notification:`, sellerEmailError);
        } else {
          console.log(`[Parcelow Webhook] ✅ Seller notification sent to ${seller.email}`);
        }
      }
    } catch (sellerNotifError) {
      console.error(`[Parcelow Webhook] ❌ Exception sending seller notification:`, sellerNotifError);
      // Continue - notification is not critical for payment processing
    }
  } else {
    console.log(`[Parcelow Webhook] ℹ️ No seller_id, skipping seller notification`);
  }

  // 9. Send notification to all platform admins
  console.log(`[Parcelow Webhook] 📧 Sending admin notifications...`);
  try {
    // Fetch seller name if exists
    let sellerName = null;
    if (order.seller_id) {
      const { data: seller } = await supabase
        .from('users')
        .select('name')
        .eq('id', order.seller_id)
        .single();
      sellerName = seller?.name || null;
    }

    // Send notification email to all admins
    const { error: adminEmailError } = await supabase.functions.invoke("send-admin-payment-notification", {
      body: {
        orderNumber: order.order_number,
        clientName: order.client_name,
        clientEmail: order.client_email,
        sellerName: sellerName,
        productSlug: order.product_slug,
        totalAmount: order.total_price_usd,
        paymentMethod: "parcelow",
        currency: currency,
        finalAmount: finalAmount,
      },
    });

    if (adminEmailError) {
      console.error(`[Parcelow Webhook] ❌ Error sending admin notifications:`, adminEmailError);
    } else {
      console.log(`[Parcelow Webhook] ✅ Admin notifications sent`);
    }
  } catch (adminNotifError) {
    console.error(`[Parcelow Webhook] ❌ Exception sending admin notifications:`, adminNotifError);
    // Continue - notification is not critical for payment processing
  }

  console.log(`[Parce low Webhook] ========== PROCESSING COMPLETE ==========`);
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    console.log("[Parcelow Webhook] 🛡️ OPTIONS request received - returning CORS headers");
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  // Handle GET requests (health checks or verification)
  if (req.method === "GET") {
    console.log("[Parcelow Webhook] GET request received - treating as health check");
    return new Response(
      JSON.stringify({ status: "ok", message: "Webhook endpoint is active" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
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

