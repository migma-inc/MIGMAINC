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

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get raw body for signature verification
    const bodyArrayBuffer = await req.arrayBuffer();
    const body = new TextDecoder().decode(bodyArrayBuffer);
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      console.error("[Webhook] No signature found");
      return new Response(
        JSON.stringify({ error: "No signature" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Try all available webhook secrets (fail-safe approach)
    const allSecrets = getAllWebhookSecrets();
    let validConfig: { env: 'production' | 'staging' | 'test'; secret: string } | null = null;
    let event: Stripe.Event | null = null;

    console.log(`[Webhook] Attempting signature verification with ${allSecrets.length} secrets...`);

    for (const secretConfig of allSecrets) {
      try {
        // Initialize Stripe with temporary key to verify signature
        const tempKey = Deno.env.get(secretConfig.env === 'production' ? 'STRIPE_SECRET_KEY_PROD' : 'STRIPE_SECRET_KEY_TEST') || '';
        const tempStripe = new Stripe(tempKey, {
          apiVersion: "2024-12-18.acacia",
        });

        event = await tempStripe.webhooks.constructEventAsync(
          body,
          signature,
          secretConfig.secret
        );

        // If we get here, signature verification succeeded
        validConfig = secretConfig;
        console.log(`✅ [Webhook] Signature verified with ${secretConfig.env} secret`);
        break;
      } catch (err) {
        console.log(`❌ [Webhook] Signature verification failed with ${secretConfig.env} secret`);
        continue;
      }
    }

    if (!validConfig || !event) {
      console.error("[Webhook] Signature verification failed with all available secrets");
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the complete Stripe config for the verified environment
    const stripeConfig = getStripeConfigForWebhook(validConfig.env);
    const stripe = new Stripe(stripeConfig.secretKey, {
      apiVersion: stripeConfig.apiVersion as any,
      appInfo: stripeConfig.appInfo,
    });

    console.log("[Webhook] Event received:", {
      type: event.type,
      id: event.id,
      environment: validConfig.env,
    });

    // Process the event
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log("[Webhook] Checkout completed:", session.id);

        // Get order from database
        const { data: order, error: orderError } = await supabase
          .from("visa_orders")
          .select("*")
          .eq("stripe_session_id", session.id)
          .single();

        if (orderError || !order) {
          console.error("[Webhook] Order not found:", session.id);
          break;
        }

        // Get payment intent to determine payment method
        let paymentMethod = "card";
        if (session.payment_intent) {
          try {
            const paymentIntent = await stripe.paymentIntents.retrieve(
              session.payment_intent as string
            );
            
            if (paymentIntent.charges.data.length > 0) {
              const charge = paymentIntent.charges.data[0];
              if (charge.payment_method_details?.type === "pix") {
                paymentMethod = "pix";
              }
            }
          } catch (error) {
            console.error("[Webhook] Error retrieving payment intent:", error);
          }
        }

        // Update order status
        const { error: updateError } = await supabase
          .from("visa_orders")
          .update({
            payment_status: "completed",
            stripe_payment_intent_id: session.payment_intent as string || null,
            payment_method: paymentMethod === "pix" ? "stripe_pix" : "stripe_card",
            payment_metadata: {
              ...order.payment_metadata,
              payment_method: paymentMethod,
              completed_at: new Date().toISOString(),
              session_id: session.id,
            },
          })
          .eq("id", order.id);

        if (updateError) {
          console.error("[Webhook] Error updating order:", updateError);
          break;
        }

        console.log("[Webhook] Order updated successfully:", order.id);

        // Update payment record if exists
        if (order.service_request_id) {
          const { data: paymentRecord } = await supabase
            .from("payments")
            .select("id")
            .eq("service_request_id", order.service_request_id)
            .eq("external_payment_id", session.id)
            .single();

          if (paymentRecord) {
            await supabase
              .from("payments")
              .update({
                status: "paid",
                external_payment_id: session.payment_intent as string || session.id,
                raw_webhook_log: {
                  event_type: event.type,
                  event_id: event.id,
                  session_id: session.id,
                  payment_intent: session.payment_intent,
                  completed_at: new Date().toISOString(),
                },
                updated_at: new Date().toISOString(),
              })
              .eq("id", paymentRecord.id);
            console.log("[Webhook] Payment record updated:", paymentRecord.id);
          }

          // Update service_request status to 'paid'
          await supabase
            .from("service_requests")
            .update({
              status: "paid",
              updated_at: new Date().toISOString(),
            })
            .eq("id", order.service_request_id);
          console.log("[Webhook] Service request status updated to 'paid':", order.service_request_id);
        }

        // Track payment completed in funnel
        if (order.seller_id) {
          try {
            await supabase
              .from('seller_funnel_events')
              .insert({
                seller_id: order.seller_id,
                product_slug: order.product_slug,
                event_type: 'payment_completed',
                session_id: `order_${order.id}`,
                metadata: {
                  order_id: order.id,
                  order_number: order.order_number,
                  payment_method: paymentMethod,
                  total_amount: order.total_price_usd,
                },
              });
            console.log("[Webhook] Payment completed tracked in funnel");
          } catch (trackError) {
            console.error("[Webhook] Error tracking payment completed:", trackError);
            // Continue - tracking is not critical
          }
        }

        // Generate contract PDF after payment confirmation
        try {
          const { data: pdfData, error: pdfError } = await supabase.functions.invoke("generate-visa-contract-pdf", {
            body: { order_id: order.id },
          });
          
          if (pdfError) {
            console.error("[Webhook] Error generating contract PDF:", pdfError);
          } else {
            console.log("[Webhook] Contract PDF generated successfully:", pdfData?.pdf_url);
          }
        } catch (pdfError) {
          console.error("[Webhook] Exception generating PDF:", pdfError);
          // Continue - PDF generation is not critical for payment processing
        }

        // Send confirmation email to client
        try {
          await supabase.functions.invoke("send-email", {
            body: {
              to: order.client_email,
              subject: `Visa Application Payment Confirmed - Order ${order.order_number}`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h1 style="color: #D4AF37;">Payment Confirmed</h1>
                  <p>Dear ${order.client_name},</p>
                  <p>We have received your payment for your visa application.</p>
                  <h2 style="color: #333;">Order Details:</h2>
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Order Number:</strong></td>
                      <td style="padding: 10px; border-bottom: 1px solid #ddd;">${order.order_number}</td>
                    </tr>
                    <tr>
                      <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Product:</strong></td>
                      <td style="padding: 10px; border-bottom: 1px solid #ddd;">${order.product_slug}</td>
                    </tr>
                    <tr>
                      <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Dependents:</strong></td>
                      <td style="padding: 10px; border-bottom: 1px solid #ddd;">${order.number_of_dependents || 0}</td>
                    </tr>
                    <tr>
                      <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Total:</strong></td>
                      <td style="padding: 10px; border-bottom: 1px solid #ddd;">US$ ${order.total_price_usd.toFixed(2)}</td>
                    </tr>
                  </table>
                  <p style="margin-top: 20px;">Our team will contact you shortly to begin the visa application process.</p>
                  <p>Best regards,<br>MIGMA Team</p>
                </div>
              `,
            },
          });
          console.log("[Webhook] Confirmation email sent to client");
        } catch (emailError) {
          console.error("[Webhook] Error sending email:", emailError);
        }

        // Send notification to seller if seller_id exists
        if (order.seller_id) {
          console.log("[Webhook] Seller notification:", order.seller_id);
          // TODO: Implement seller notification when seller dashboard is ready
        }

        break;
      }

      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log("[Webhook] Async payment succeeded (PIX):", session.id);

        // Get order from database
        const { data: order, error: orderError } = await supabase
          .from("visa_orders")
          .select("*")
          .eq("stripe_session_id", session.id)
          .single();

        if (orderError || !order) {
          console.error("[Webhook] Order not found:", session.id);
          break;
        }

        // Update order status
        const { error: updateError } = await supabase
          .from("visa_orders")
          .update({
            payment_status: "completed",
            stripe_payment_intent_id: session.payment_intent as string || null,
            payment_method: "stripe_pix",
            payment_metadata: {
              ...order.payment_metadata,
              completed_at: new Date().toISOString(),
              session_id: session.id,
            },
          })
          .eq("id", order.id);

        if (updateError) {
          console.error("[Webhook] Error updating order:", updateError);
          break;
        }

        // Update payment record if exists
        if (order.service_request_id) {
          const { data: paymentRecord } = await supabase
            .from("payments")
            .select("id")
            .eq("service_request_id", order.service_request_id)
            .eq("external_payment_id", session.id)
            .single();

          if (paymentRecord) {
            await supabase
              .from("payments")
              .update({
                status: "paid",
                external_payment_id: session.payment_intent as string || session.id,
                raw_webhook_log: {
                  event_type: event.type,
                  event_id: event.id,
                  session_id: session.id,
                  payment_intent: session.payment_intent,
                  completed_at: new Date().toISOString(),
                },
                updated_at: new Date().toISOString(),
              })
              .eq("id", paymentRecord.id);
            console.log("[Webhook] Payment record updated (PIX):", paymentRecord.id);
          }

          // Update service_request status to 'paid'
          await supabase
            .from("service_requests")
            .update({
              status: "paid",
              updated_at: new Date().toISOString(),
            })
            .eq("id", order.service_request_id);
          console.log("[Webhook] Service request status updated to 'paid' (PIX):", order.service_request_id);
        }

        // Track payment completed in funnel (PIX)
        if (order.seller_id) {
          try {
            await supabase
              .from('seller_funnel_events')
              .insert({
                seller_id: order.seller_id,
                product_slug: order.product_slug,
                event_type: 'payment_completed',
                session_id: `order_${order.id}`,
                metadata: {
                  order_id: order.id,
                  order_number: order.order_number,
                  payment_method: 'stripe_pix',
                  total_amount: order.total_price_usd,
                },
              });
            console.log("[Webhook] Payment completed tracked in funnel (PIX)");
          } catch (trackError) {
            console.error("[Webhook] Error tracking payment completed:", trackError);
          }
        }

        // Generate contract PDF after payment confirmation
        try {
          const { data: pdfData, error: pdfError } = await supabase.functions.invoke("generate-visa-contract-pdf", {
            body: { order_id: order.id },
          });
          
          if (pdfError) {
            console.error("[Webhook] Error generating contract PDF:", pdfError);
          } else {
            console.log("[Webhook] Contract PDF generated successfully:", pdfData?.pdf_url);
          }
        } catch (pdfError) {
          console.error("[Webhook] Exception generating PDF:", pdfError);
        }

        break;
      }

      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log("[Webhook] Async payment failed:", session.id);

        // Get order to find service_request_id
        const { data: order } = await supabase
          .from("visa_orders")
          .select("id, service_request_id")
          .eq("stripe_session_id", session.id)
          .single();

        // Update order status
        const { error: updateError } = await supabase
          .from("visa_orders")
          .update({
            payment_status: "failed",
            stripe_payment_intent_id: session.payment_intent as string || null,
          })
          .eq("stripe_session_id", session.id);

        if (updateError) {
          console.error("[Webhook] Error updating order:", updateError);
        }

        // Update payment record if exists
        if (order?.service_request_id) {
          const { data: paymentRecord } = await supabase
            .from("payments")
            .select("id")
            .eq("service_request_id", order.service_request_id)
            .eq("external_payment_id", session.id)
            .single();

          if (paymentRecord) {
            await supabase
              .from("payments")
              .update({
                status: "failed",
                raw_webhook_log: {
                  event_type: event.type,
                  event_id: event.id,
                  session_id: session.id,
                  failed_at: new Date().toISOString(),
                },
                updated_at: new Date().toISOString(),
              })
              .eq("id", paymentRecord.id);
            console.log("[Webhook] Payment record updated to 'failed':", paymentRecord.id);
          }
        }

        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log("[Webhook] Session expired:", session.id);

        // Get order to find service_request_id
        const { data: order } = await supabase
          .from("visa_orders")
          .select("id, service_request_id")
          .eq("stripe_session_id", session.id)
          .single();

        // Update order status
        const { error: updateError } = await supabase
          .from("visa_orders")
          .update({
            payment_status: "cancelled",
          })
          .eq("stripe_session_id", session.id);

        if (updateError) {
          console.error("[Webhook] Error updating order:", updateError);
        }

        // Update payment record if exists
        if (order?.service_request_id) {
          const { data: paymentRecord } = await supabase
            .from("payments")
            .select("id")
            .eq("service_request_id", order.service_request_id)
            .eq("external_payment_id", session.id)
            .single();

          if (paymentRecord) {
            await supabase
              .from("payments")
              .update({
                status: "failed", // Expired is treated as failed
                raw_webhook_log: {
                  event_type: event.type,
                  event_id: event.id,
                  session_id: session.id,
                  expired_at: new Date().toISOString(),
                },
                updated_at: new Date().toISOString(),
              })
              .eq("id", paymentRecord.id);
            console.log("[Webhook] Payment record updated to 'failed' (expired):", paymentRecord.id);
          }
        }

        break;
      }

      default:
        console.log("[Webhook] Unhandled event type:", event.type);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[Webhook] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

