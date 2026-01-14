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

// Send webhook to client (n8n) after payment confirmation
async function sendClientWebhook(order: any, supabase: any) {
  let payload: any = null;
  
  try {
    const webhookUrl = Deno.env.get('CLIENT_WEBHOOK_URL');
    
    if (!webhookUrl) {
      console.error('[Parcelow Webhook Client] ❌ CLIENT_WEBHOOK_URL environment variable is not set. Skipping webhook.');
      return;
    }
    
    console.log('[Parcelow Webhook Client] 📤 Starting webhook send process');
    console.log('[Parcelow Webhook Client] Order ID:', order.id);
    console.log('[Parcelow Webhook Client] Order Number:', order.order_number);
    
    // 1. Buscar produto no banco para obter o nome do serviço
    const { data: product, error: productError } = await supabase
      .from('visa_products')
      .select('name')
      .eq('slug', order.product_slug)
      .single();
    
    if (productError) {
      console.warn('[Parcelow Webhook Client] ⚠️ Error fetching product:', productError);
      console.warn('[Parcelow Webhook Client] Using product_slug as fallback:', order.product_slug);
      // Continue mesmo se não encontrar produto - usar slug como fallback
    } else {
      console.log('[Parcelow Webhook Client] ✅ Product found:', product?.name);
    }
    
    // 2. Normalizar nome do serviço para produtos agrupados
    const normalizedServiceName = normalizeServiceName(
      order.product_slug,
      product?.name || order.product_slug
    );
    
    // 3. Montar payload conforme especificado pelo cliente
    // IMPORTANTE: valor_servico deve ser APENAS o valor unitário do serviço (sem multiplicar por unidades)
    // Para produtos units_only: apenas extra_unit_price (valor unitário, não o total)
    // Para produtos base_plus_units: apenas base_price_usd (sem dependentes, sem taxas)
    let baseServicePrice: number;
    if (order.calculation_type === 'units_only') {
      // Para units_only: valor = apenas extra_unit_price (valor unitário do serviço)
      baseServicePrice = parseFloat(order.extra_unit_price_usd || '0');
    } else {
      // Para base_plus_units: valor = apenas base_price_usd (sem dependentes)
      baseServicePrice = parseFloat(order.base_price_usd || '0');
    }
    
    // Log detalhado do cálculo do valor
    console.log('[Parcelow Webhook Client] 💰 Valor calculation details:', {
      calculation_type: order.calculation_type,
      base_price_usd: order.base_price_usd,
      extra_unit_price_usd: order.extra_unit_price_usd,
      extra_units: order.extra_units,
      total_price_usd: order.total_price_usd,
      calculated_baseServicePrice: baseServicePrice,
      product_slug: order.product_slug,
    });
    
    payload = {
      servico: normalizedServiceName,
      plano_servico: order.product_slug,
      nome_completo: order.client_name,
      whatsapp: order.client_whatsapp || '',
      email: order.client_email,
      valor_servico: baseServicePrice.toFixed(2),
      vendedor: order.seller_id || '',
      quantidade_dependentes: order.dependent_names && Array.isArray(order.dependent_names) ? order.dependent_names.length : 0,
    };
    
    // Log resumo antes de enviar
    const dependentCount = order.dependent_names && Array.isArray(order.dependent_names) ? order.dependent_names.length : 0;
    console.log('[Parcelow Webhook Client] 📋 RESUMO DOS WEBHOOKS A SEREM ENVIADOS:');
    console.log(`[Parcelow Webhook Client] - Cliente Principal: 1 webhook`);
    console.log(`[Parcelow Webhook Client] - Dependentes: ${dependentCount} webhook(s)`);
    console.log(`[Parcelow Webhook Client] - TOTAL: ${1 + dependentCount} webhook(s)`);
    console.log('[Parcelow Webhook Client] 📦 Payload completo do CLIENTE PRINCIPAL que será enviado:');
    console.log(JSON.stringify(payload, null, 2));
    console.log('[Parcelow Webhook Client] 🌐 Sending POST request to:', webhookUrl);
    
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
    const durationStr = duration + "ms";
    
    // 4. Log resultado detalhado (sucesso ou erro)
    if (!response.ok) {
      const responseText = await response.text();
      console.error('[Parcelow Webhook Client] ❌ Error sending CLIENTE PRINCIPAL webhook:', {
        status: response.status,
        statusText: response.statusText,
        duration: durationStr,
        response: responseText,
        order_id: order.id,
        order_number: order.order_number,
        payload_sent: payload,
      });
      console.error('[Parcelow Webhook Client] ❌ PAYLOAD QUE FALHOU (Cliente Principal):');
      console.error(JSON.stringify(payload, null, 2));
    } else {
      const responseText = await response.text();
      console.log('[Parcelow Webhook Client] ✅ Successfully sent CLIENTE PRINCIPAL webhook');
      console.log('[Parcelow Webhook Client] 📊 Response details (Cliente Principal):', {
        status: response.status,
        statusText: response.statusText,
        duration: durationStr,
        response: responseText || '(empty response)',
        order_id: order.id,
        order_number: order.order_number,
      });
      console.log('[Parcelow Webhook Client] 📤 PAYLOAD ENVIADO COM SUCESSO (Cliente Principal):');
      console.log(JSON.stringify(payload, null, 2));
      console.log('[Parcelow Webhook Client] ✅ Webhook data received by n8n successfully (Cliente Principal)');
    }

    // 5. Enviar webhooks separados para cada dependente
    if (order.dependent_names && Array.isArray(order.dependent_names) && order.dependent_names.length > 0) {
      const dependentCount = order.dependent_names.length;
      const dependentUnitPrice = parseFloat(order.extra_unit_price_usd || '0');
      
      console.log('');
      console.log('[Parcelow Webhook Client] ========================================');
      console.log(`[Parcelow Webhook Client] 📤 INICIANDO ENVIO DE ${dependentCount} WEBHOOK(S) DE DEPENDENTE(S)`);
      console.log('[Parcelow Webhook Client] ========================================');
      
      for (let i = 0; i < dependentCount; i++) {
        const dependentName = order.dependent_names[i];
        
        if (!dependentName || dependentName.trim() === '') {
          console.warn(`[Parcelow Webhook Client] ⚠️ Skipping dependent ${i + 1}: empty name`);
          continue;
        }
        
        // Payload simplificado - nome do cliente principal, nome do dependente e valor
        const dependentPayload = {
          nome_completo_cliente_principal: order.client_name,
          nome_completo_dependente: dependentName,
          valor_servico: dependentUnitPrice.toFixed(2),
        };
        
        console.log('');
        console.log(`[Parcelow Webhook Client] 📦 PAYLOAD DEPENDENTE ${i + 1}/${dependentCount} (ANTES DE ENVIAR):`);
        console.log(JSON.stringify(dependentPayload, null, 2));
        console.log(`[Parcelow Webhook Client] 🌐 Sending POST request for Dependent ${i + 1}/${dependentCount}`);
        
        const dependentStartTime = Date.now();
        
        try {
          const dependentResponse = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(dependentPayload),
          });
          
          const dependentEndTime = Date.now();
          const dependentDuration = dependentEndTime - dependentStartTime;
          const dependentDurationStr = dependentDuration + "ms";
          
          if (!dependentResponse.ok) {
            const dependentResponseText = await dependentResponse.text();
            console.error(`[Parcelow Webhook Client] ❌ ERRO ao enviar webhook do DEPENDENTE ${i + 1}/${dependentCount}:`, {
              status: dependentResponse.status,
              statusText: dependentResponse.statusText,
              duration: dependentDurationStr,
              response: dependentResponseText,
              order_id: order.id,
              order_number: order.order_number,
              dependent_name: dependentName,
              dependent_index: i + 1,
            });
            console.error(`[Parcelow Webhook Client] ❌ PAYLOAD QUE FALHOU (Dependente ${i + 1}):`);
            console.error(JSON.stringify(dependentPayload, null, 2));
          } else {
            const dependentResponseText = await dependentResponse.text();
            console.log(`[Parcelow Webhook Client] ✅ SUCESSO ao enviar webhook do DEPENDENTE ${i + 1}/${dependentCount}`);
            console.log(`[Parcelow Webhook Client] 📊 Response details (Dependente ${i + 1}):`, {
              status: dependentResponse.status,
              statusText: dependentResponse.statusText,
              duration: dependentDurationStr,
              response: dependentResponseText || '(empty response)',
              order_id: order.id,
              order_number: order.order_number,
              dependent_name: dependentName,
              dependent_index: i + 1,
            });
            console.log(`[Parcelow Webhook Client] 📤 PAYLOAD ENVIADO COM SUCESSO (Dependente ${i + 1}):`);
            console.log(JSON.stringify(dependentPayload, null, 2));
            console.log(`[Parcelow Webhook Client] ✅ Webhook data received by n8n successfully (Dependente ${i + 1})`);
          }
        } catch (dependentError) {
          console.error(`[Parcelow Webhook Client] ❌ EXCEÇÃO ao enviar webhook do DEPENDENTE ${i + 1}/${dependentCount}:`, {
            error: dependentError instanceof Error ? dependentError.message : String(dependentError),
            stack: dependentError instanceof Error ? dependentError.stack : undefined,
            order_id: order?.id,
            order_number: order?.order_number,
            dependent_name: dependentName,
            dependent_index: i + 1,
          });
          console.error(`[Parcelow Webhook Client] ❌ PAYLOAD QUE FALHOU (Dependente ${i + 1}):`);
          console.error(JSON.stringify(dependentPayload, null, 2));
        }
      }
      
      console.log('');
      console.log('[Parcelow Webhook Client] ========================================');
      console.log(`[Parcelow Webhook Client] ✅ FINALIZADO: ${dependentCount} webhook(s) de dependente(s) processado(s)`);
      console.log('[Parcelow Webhook Client] ========================================');
      console.log('');
    } else {
      console.log('[Parcelow Webhook Client] ℹ️ No dependents to send webhooks for');
    }
    
    // Log resumo final
    console.log('');
    console.log('[Parcelow Webhook Client] ========================================');
    console.log('[Parcelow Webhook Client] 📋 RESUMO FINAL DOS WEBHOOKS ENVIADOS:');
    console.log(`[Parcelow Webhook Client] - Cliente Principal: 1 webhook`);
    console.log(`[Parcelow Webhook Client] - Dependentes: ${dependentCount} webhook(s)`);
    console.log(`[Parcelow Webhook Client] - TOTAL: ${1 + dependentCount} webhook(s)`);
    console.log(`[Parcelow Webhook Client] - Order ID: ${order.id}`);
    console.log(`[Parcelow Webhook Client] - Order Number: ${order.order_number}`);
    console.log('[Parcelow Webhook Client] ========================================');
    console.log('');
  } catch (error) {
    // Não bloquear fluxo se webhook falhar - apenas logar erro
    console.error('[Parcelow Webhook Client] ❌ Exception sending webhook:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      order_id: order?.id,
      order_number: order?.order_number,
      payload_attempted: payload ? JSON.stringify(payload, null, 2) : 'Payload não foi criado devido ao erro',
    });
  }
}

/**
 * Process Parcelow webhook event
 */
async function processParcelowWebhookEvent(
  event: ParcelowWebhookEvent,
  supabase: any
) {
  const { event: eventType, data } = event;

  console.log(`[Parcelow Webhook] ========== PROCESSING EVENT ==========`);
  console.log(`[Parcelow Webhook] Event type: ${eventType}`);
  console.log(`[Parcelow Webhook] Parcelow Order ID: ${data.id}`);
  console.log(`[Parcelow Webhook] Reference: ${data.reference}`);
  console.log(`[Parcelow Webhook] Status: ${data.status_text} (code: ${data.status})`);
  console.log(`[Parcelow Webhook] Total USD: ${data.total_usd}, Total BRL: ${data.total_brl}`);
  console.log(`[Parcelow Webhook] Installments: ${data.installments}`);

  // Find the visa order by parcelow_order_id or reference
  // Select all fields needed for complete processing
  const { data: order, error: orderError } = await supabase
    .from("visa_orders")
    .select("*")
    .or(`parcelow_order_id.eq.${data.id},reference.eq.${data.reference}`)
    .single();

  if (orderError || !order) {
    console.error(
      `[Parcelow Webhook] ❌ Order not found for Parcelow order ${data.id} or reference ${data.reference}:`,
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

  // Update visa_orders based on event type
  let paymentStatus = order.payment_status;
  let shouldProcessPayment = false; // Flag for full payment processing

  switch (eventType) {
    case "event_order_paid":
      // Payment completed - process full flow
      paymentStatus = "completed";
      shouldProcessPayment = true;
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
      console.log(`[Parcelow Webhook] ⚠️ Unknown event type: ${eventType}`);
      break;
  }

  // Update visa_orders with payment_method and complete payment_metadata
  const updateData: any = {
    parcelow_status: data.status_text,
    parcelow_status_code: data.status,
  };

  if (paymentStatus !== order.payment_status) {
    updateData.payment_status = paymentStatus;
  }

  // If payment completed, update payment_method and payment_metadata
  if (shouldProcessPayment) {
    updateData.payment_method = "parcelow";
    updateData.payment_metadata = {
      ...(order.payment_metadata || {}),
      payment_method: "parcelow",
      completed_at: new Date().toISOString(),
      parcelow_order_id: data.id,
      installments: data.installments,
      total_usd: data.total_usd,
      total_brl: data.total_brl,
      order_date: data.order_date,
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

  // Only process full payment flow if payment is completed
  if (!shouldProcessPayment) {
    console.log(`[Parcelow Webhook] ℹ️ Payment not completed, skipping post-payment processing`);
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
      .or(`external_payment_id.eq.${data.id},external_payment_id.eq.${data.reference}`)
      .single();

    if (paymentRecord) {
      const { error: paymentUpdateError } = await supabase
        .from("payments")
        .update({
          status: "paid",
          external_payment_id: data.id.toString(),
          raw_webhook_log: {
            event_type: eventType,
            parcelow_order_id: data.id,
            reference: data.reference,
            status: data.status,
            status_text: data.status_text,
            total_usd: data.total_usd,
            total_brl: data.total_brl,
            installments: data.installments,
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
            parcelow_order_id: data.id,
            installments: data.installments,
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

  // 6. Send confirmation email to client
  console.log(`[Parcelow Webhook] 📧 Sending payment confirmation email...`);
  try {
    // Get currency and final amount from payment_metadata or use defaults
    const metadata = updateData.payment_metadata || order.payment_metadata || {};
    const currency = metadata.currency || (data.total_brl ? "BRL" : "USD");
    const finalAmount = metadata.final_amount || data.total_usd || order.total_price_usd;
    
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

  // 7. Send webhook to client (n8n) after payment confirmation
  console.log(`[Parcelow Webhook] 📤 Sending client webhook (n8n)...`);
  await sendClientWebhook(order, supabase);

  // 8. Send notification to seller if seller_id exists
  if (order.seller_id) {
    console.log(`[Parcelow Webhook] 📢 Seller notification (TODO): ${order.seller_id}`);
    // TODO: Implement seller notification when seller dashboard is ready
  }

  console.log(`[Parcelow Webhook] ========== PROCESSING COMPLETE ==========`);
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
