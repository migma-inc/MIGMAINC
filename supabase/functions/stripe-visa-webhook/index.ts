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

// Send webhook to client (n8n) after payment confirmation
async function sendClientWebhook(order: any, supabase: any) {
  try {
    const webhookUrl = Deno.env.get('CLIENT_WEBHOOK_URL');
    
    if (!webhookUrl) {
      console.error('[Webhook Client] ❌ CLIENT_WEBHOOK_URL environment variable is not set. Skipping webhook.');
      return;
    }
    
    console.log('[Webhook Client] 📤 Starting webhook send process');
    console.log('[Webhook Client] Order ID:', order.id);
    console.log('[Webhook Client] Order Number:', order.order_number);
    
    // 1. Buscar produto no banco para obter o nome do serviço
    const { data: product, error: productError } = await supabase
      .from('visa_products')
      .select('name')
      .eq('slug', order.product_slug)
      .single();
    
    if (productError) {
      console.warn('[Webhook Client] ⚠️ Error fetching product:', productError);
      console.warn('[Webhook Client] Using product_slug as fallback:', order.product_slug);
      // Continue mesmo se não encontrar produto - usar slug como fallback
    } else {
      console.log('[Webhook Client] ✅ Product found:', product?.name);
    }
    
    // 2. Montar payload conforme especificado pelo cliente
    const metadata = order.payment_metadata as any;
    const finalAmount = metadata?.final_amount || order.total_price_usd;
    
    const payload = {
      servico: product?.name || order.product_slug,
      plano_servico: order.product_slug,
      nome_completo: order.client_name,
      whatsapp: order.client_whatsapp || '',
      email: order.client_email,
      valor_servico: typeof finalAmount === 'string' ? finalAmount : finalAmount.toString(),
      vendedor: order.seller_id || '',
    };
    
    console.log('[Webhook Client] 📦 Payload prepared:', JSON.stringify(payload, null, 2));
    console.log('[Webhook Client] 🌐 Sending POST request to:', webhookUrl);
    
    const startTime = Date.now();
    
    // 3. Fazer POST para o webhook do cliente
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // 4. Log resultado detalhado (sucesso ou erro)
    if (!response.ok) {
      const responseText = await response.text();
      console.error('[Webhook Client] ❌ Error sending webhook:', {
        status: response.status,
        statusText: response.statusText,
        duration: `${duration}ms`,
        response: responseText,
        order_id: order.id,
        order_number: order.order_number,
      });
    } else {
      const responseText = await response.text();
      console.log('[Webhook Client] ✅ Successfully sent to client webhook');
      console.log('[Webhook Client] 📊 Response details:', {
        status: response.status,
        statusText: response.statusText,
        duration: `${duration}ms`,
        response: responseText || '(empty response)',
        order_id: order.id,
        order_number: order.order_number,
      });
      console.log('[Webhook Client] ✅ Webhook data received by n8n successfully');
    }
  } catch (error) {
    // Não bloquear fluxo se webhook falhar - apenas logar erro
    console.error('[Webhook Client] ❌ Exception sending webhook:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      order_id: order?.id,
      order_number: order?.order_number,
    });
  }
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
        // First, try to use the payment_method already saved in the order (most reliable)
        let paymentMethod = "card";
        if (order.payment_method === "stripe_pix") {
          paymentMethod = "pix";
        } else if (order.payment_method === "stripe_card") {
          paymentMethod = "card";
        } else {
          // Fallback: detect from payment intent
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
          // Also check currency in metadata as fallback
          const metadata = order.payment_metadata as any;
          if (metadata?.currency === "BRL" || metadata?.currency === "brl") {
            paymentMethod = "pix";
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
          // Get currency and final amount from payment_metadata
          const metadata = order.payment_metadata as any;
          const currency = metadata?.currency || (paymentMethod === "pix" ? "BRL" : "USD");
          const finalAmount = metadata?.final_amount || order.total_price_usd;
          
          await supabase.functions.invoke("send-payment-confirmation-email", {
            body: {
              clientName: order.client_name,
              clientEmail: order.client_email,
              orderNumber: order.order_number,
              productSlug: order.product_slug,
              totalAmount: order.total_price_usd, // Fallback
              paymentMethod: paymentMethod === "pix" ? "stripe_pix" : "stripe_card",
              currency: currency,
              finalAmount: finalAmount,
            },
          });
          console.log("[Webhook] Payment confirmation email sent to client");
        } catch (emailError) {
          console.error("[Webhook] Error sending payment confirmation email:", emailError);
        }

        // Send webhook to client (n8n) after payment confirmation
        await sendClientWebhook(order, supabase);

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

        // Send confirmation email to client (PIX)
        try {
          // Get currency and final amount from payment_metadata
          const metadata = order.payment_metadata as any;
          const currency = metadata?.currency || "BRL";
          const finalAmount = metadata?.final_amount || order.total_price_usd;
          
          await supabase.functions.invoke("send-payment-confirmation-email", {
            body: {
              clientName: order.client_name,
              clientEmail: order.client_email,
              orderNumber: order.order_number,
              productSlug: order.product_slug,
              totalAmount: order.total_price_usd, // Fallback
              paymentMethod: "stripe_pix",
              currency: currency,
              finalAmount: finalAmount,
            },
          });
          console.log("[Webhook] Payment confirmation email sent to client (PIX)");
        } catch (emailError) {
          console.error("[Webhook] Error sending payment confirmation email (PIX):", emailError);
        }

        // Send webhook to client (n8n) after PIX payment confirmation
        await sendClientWebhook(order, supabase);

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




