import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

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
      // Exemplo: visa-retry-defense = $99 por aplicante, mas valor_servico deve ser $99 (não $99 * número de aplicantes)
      baseServicePrice = parseFloat(order.extra_unit_price_usd || '0');
    } else {
      // Para base_plus_units: valor = apenas base_price_usd (sem dependentes)
      baseServicePrice = parseFloat(order.base_price_usd || '0');
    }
    
    // Log detalhado do cálculo do valor
    console.log('[Webhook Client] 💰 Valor calculation details:', {
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
    console.log('[Webhook Client] 📋 RESUMO DOS WEBHOOKS A SEREM ENVIADOS:');
    console.log(`[Webhook Client] - Cliente Principal: 1 webhook`);
    console.log(`[Webhook Client] - Dependentes: ${dependentCount} webhook(s)`);
    console.log(`[Webhook Client] - TOTAL: ${1 + dependentCount} webhook(s)`);
    console.log('[Webhook Client] 📦 Payload completo do CLIENTE PRINCIPAL que será enviado:');
    console.log(JSON.stringify(payload, null, 2));
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
    const durationStr = duration + "ms";
    
    // 4. Log resultado detalhado (sucesso ou erro)
    if (!response.ok) {
      const responseText = await response.text();
      console.error('[Webhook Client] ❌ Error sending CLIENTE PRINCIPAL webhook:', {
        status: response.status,
        statusText: response.statusText,
        duration: durationStr,
        response: responseText,
        order_id: order.id,
        order_number: order.order_number,
        payload_sent: payload,
      });
      console.error('[Webhook Client] ❌ PAYLOAD QUE FALHOU (Cliente Principal):');
      console.error(JSON.stringify(payload, null, 2));
    } else {
      const responseText = await response.text();
      console.log('[Webhook Client] ✅ Successfully sent CLIENTE PRINCIPAL webhook');
      console.log('[Webhook Client] 📊 Response details (Cliente Principal):', {
        status: response.status,
        statusText: response.statusText,
        duration: durationStr,
        response: responseText || '(empty response)',
        order_id: order.id,
        order_number: order.order_number,
      });
      console.log('[Webhook Client] 📤 PAYLOAD ENVIADO COM SUCESSO (Cliente Principal):');
      console.log(JSON.stringify(payload, null, 2));
      console.log('[Webhook Client] ✅ Webhook data received by n8n successfully (Cliente Principal)');
    }

    // 5. Enviar webhooks separados para cada dependente
    if (order.dependent_names && Array.isArray(order.dependent_names) && order.dependent_names.length > 0) {
      const dependentCount = order.dependent_names.length;
      const dependentUnitPrice = parseFloat(order.extra_unit_price_usd || '0');
      
      console.log('');
      console.log('[Webhook Client] ========================================');
      console.log(`[Webhook Client] 📤 INICIANDO ENVIO DE ${dependentCount} WEBHOOK(S) DE DEPENDENTE(S)`);
      console.log('[Webhook Client] ========================================');
      
      for (let i = 0; i < dependentCount; i++) {
        const dependentName = order.dependent_names[i];
        
        if (!dependentName || dependentName.trim() === '') {
          console.warn(`[Webhook Client] ⚠️ Skipping dependent ${i + 1}: empty name`);
          continue;
        }
        
        // Payload simplificado - nome do cliente principal, nome do dependente e valor
        const dependentPayload = {
          nome_completo_cliente_principal: order.client_name,
          nome_completo_dependente: dependentName,
          valor_servico: dependentUnitPrice.toFixed(2),
        };
        
        console.log('');
        console.log(`[Webhook Client] 📦 PAYLOAD DEPENDENTE ${i + 1}/${dependentCount} (ANTES DE ENVIAR):`);
        console.log(JSON.stringify(dependentPayload, null, 2));
        console.log(`[Webhook Client] 🌐 Sending POST request for Dependent ${i + 1}/${dependentCount}`);
        
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
            console.error(`[Webhook Client] ❌ ERRO ao enviar webhook do DEPENDENTE ${i + 1}/${dependentCount}:`, {
              status: dependentResponse.status,
              statusText: dependentResponse.statusText,
              duration: dependentDurationStr,
              response: dependentResponseText,
              order_id: order.id,
              order_number: order.order_number,
              dependent_name: dependentName,
              dependent_index: i + 1,
            });
            console.error(`[Webhook Client] ❌ PAYLOAD QUE FALHOU (Dependente ${i + 1}):`);
            console.error(JSON.stringify(dependentPayload, null, 2));
          } else {
            const dependentResponseText = await dependentResponse.text();
            console.log(`[Webhook Client] ✅ SUCESSO ao enviar webhook do DEPENDENTE ${i + 1}/${dependentCount}`);
            console.log(`[Webhook Client] 📊 Response details (Dependente ${i + 1}):`, {
              status: dependentResponse.status,
              statusText: dependentResponse.statusText,
              duration: dependentDurationStr,
              response: dependentResponseText || '(empty response)',
              order_id: order.id,
              order_number: order.order_number,
              dependent_name: dependentName,
              dependent_index: i + 1,
            });
            console.log(`[Webhook Client] 📤 PAYLOAD ENVIADO COM SUCESSO (Dependente ${i + 1}):`);
            console.log(JSON.stringify(dependentPayload, null, 2));
            console.log(`[Webhook Client] ✅ Webhook data received by n8n successfully (Dependente ${i + 1})`);
          }
        } catch (dependentError) {
          console.error(`[Webhook Client] ❌ EXCEÇÃO ao enviar webhook do DEPENDENTE ${i + 1}/${dependentCount}:`, {
            error: dependentError instanceof Error ? dependentError.message : String(dependentError),
            stack: dependentError instanceof Error ? dependentError.stack : undefined,
            order_id: order?.id,
            order_number: order?.order_number,
            dependent_name: dependentName,
            dependent_index: i + 1,
          });
          console.error(`[Webhook Client] ❌ PAYLOAD QUE FALHOU (Dependente ${i + 1}):`);
          console.error(JSON.stringify(dependentPayload, null, 2));
        }
      }
      
      console.log('');
      console.log('[Webhook Client] ========================================');
      console.log(`[Webhook Client] ✅ FINALIZADO: ${dependentCount} webhook(s) de dependente(s) processado(s)`);
      console.log('[Webhook Client] ========================================');
      console.log('');
    } else {
      console.log('[Webhook Client] ℹ️ No dependents to send webhooks for');
    }
    
    // Log resumo final
    console.log('');
    console.log('[Webhook Client] ========================================');
    console.log('[Webhook Client] 📋 RESUMO FINAL DOS WEBHOOKS ENVIADOS:');
    console.log(`[Webhook Client] - Cliente Principal: 1 webhook`);
    console.log(`[Webhook Client] - Dependentes: ${dependentCount} webhook(s)`);
    console.log(`[Webhook Client] - TOTAL: ${1 + dependentCount} webhook(s)`);
    console.log(`[Webhook Client] - Order ID: ${order.id}`);
    console.log(`[Webhook Client] - Order Number: ${order.order_number}`);
    console.log('[Webhook Client] ========================================');
    console.log('');
  } catch (error) {
    // Não bloquear fluxo se webhook falhar - apenas logar erro
    console.error('[Webhook Client] ❌ Exception sending webhook:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      order_id: order?.id,
      order_number: order?.order_number,
      payload_attempted: payload ? JSON.stringify(payload, null, 2) : 'Payload não foi criado devido ao erro',
    });
  }
}

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    // Get order_id from request body
    const { order_id } = await req.json();

    if (!order_id) {
      return new Response(
        JSON.stringify({ error: "order_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[Zelle Webhook] Processing manual approval for order:", order_id);

    // Get order from database
    const { data: order, error: orderError } = await supabase
      .from("visa_orders")
      .select("*")
      .eq("id", order_id)
      .single();

    if (orderError || !order) {
      console.error("[Zelle Webhook] Order not found:", order_id);
      return new Response(
        JSON.stringify({ error: "Order not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify payment method is Zelle
    if (order.payment_method !== 'zelle') {
      console.error("[Zelle Webhook] Order is not a Zelle payment:", order.payment_method);
      return new Response(
        JSON.stringify({ error: "Order is not a Zelle payment" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify payment status is completed
    if (order.payment_status !== 'completed') {
      console.error("[Zelle Webhook] Order payment status is not completed:", order.payment_status);
      return new Response(
        JSON.stringify({ error: "Order payment status must be completed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[Zelle Webhook] Order found:", {
      id: order.id,
      order_number: order.order_number,
      payment_method: order.payment_method,
      payment_status: order.payment_status,
    });

    // Check zelle_payments record for n8n validation info
    const { data: zellePayment } = await supabase
      .from("zelle_payments")
      .select("*")
      .eq("order_id", order.id)
      .maybeSingle();

    if (zellePayment) {
      console.log("[Zelle Webhook] Zelle payment record found:", {
        payment_id: zellePayment.payment_id,
        status: zellePayment.status,
        n8n_confidence: zellePayment.n8n_confidence,
        n8n_validated_at: zellePayment.n8n_validated_at,
      });

      // If zelle_payment status is not approved, log warning
      if (zellePayment.status !== 'approved') {
        console.warn("[Zelle Webhook] Warning: zelle_payment status is not 'approved':", zellePayment.status);
      }
    } else {
      console.log("[Zelle Webhook] No zelle_payment record found for this order (legacy payment)");
    }

    // Update payment record if exists
    if (order.service_request_id) {
      // Try to find payment record by service_request_id and order_id
      const { data: paymentRecord } = await supabase
        .from("payments")
        .select("id")
        .eq("service_request_id", order.service_request_id)
        .eq("external_payment_id", order.id)
        .maybeSingle();

      if (paymentRecord) {
        await supabase
          .from("payments")
          .update({
            status: "paid",
            external_payment_id: order.id,
            raw_webhook_log: {
              payment_method: "zelle",
              order_id: order.id,
              order_number: order.order_number,
              completed_at: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
          })
          .eq("id", paymentRecord.id);
        console.log("[Zelle Webhook] Payment record updated:", paymentRecord.id);
      }

      // Update service_request status to 'paid'
      await supabase
        .from("service_requests")
        .update({
          status: "paid",
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.service_request_id);
      console.log("[Zelle Webhook] Service request status updated to 'paid':", order.service_request_id);
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
              payment_method: 'zelle',
              total_amount: order.total_price_usd,
            },
          });
        console.log("[Zelle Webhook] Payment completed tracked in funnel");
      } catch (trackError) {
        console.error("[Zelle Webhook] Error tracking payment completed:", trackError);
        // Continue - tracking is not critical
      }
    }

    // Generate contract PDF after payment confirmation
    // For ALL products EXCEPT scholarship and i20-control: generate full contract PDF
    // The contract template is fetched dynamically by product_slug from contract_templates table
    // For scholarship and i20-control: only generate ANNEX I (no full contract)
    const isAnnexRequired = order.product_slug?.endsWith('-scholarship') || order.product_slug?.endsWith('-i20-control');
    
    if (!isAnnexRequired) {
      // Generate full contract PDF for any product (selection-process, consulta-brant, etc.)
      // The generate-visa-contract-pdf function will fetch the appropriate template by product_slug
      try {
        const { data: pdfData, error: pdfError } = await supabase.functions.invoke("generate-visa-contract-pdf", {
          body: { order_id: order.id },
        });
        
        if (pdfError) {
          console.error("[Zelle Webhook] Error generating contract PDF:", pdfError);
        } else {
          console.log("[Zelle Webhook] Contract PDF generated successfully:", pdfData?.pdf_url);
        }
      } catch (pdfError) {
        console.error("[Zelle Webhook] Exception generating contract PDF:", pdfError);
        // Continue - PDF generation is not critical for payment processing
      }
    }

    // Generate ANNEX I PDF for scholarship and i20-control products
    if (isAnnexRequired) {
      try {
        const { data: annexPdfData, error: annexPdfError } = await supabase.functions.invoke("generate-annex-pdf", {
          body: { order_id: order.id },
        });
        
        if (annexPdfError) {
          console.error("[Zelle Webhook] Error generating ANNEX I PDF:", annexPdfError);
        } else {
          console.log("[Zelle Webhook] ANNEX I PDF generated successfully:", annexPdfData?.pdf_url);
        }
      } catch (annexPdfError) {
        console.error("[Zelle Webhook] Exception generating ANNEX I PDF:", annexPdfError);
        // Continue - PDF generation is not critical for payment processing
      }
    }

    // Send confirmation email to client
    try {
      await supabase.functions.invoke("send-payment-confirmation-email", {
        body: {
          clientName: order.client_name,
          clientEmail: order.client_email,
          orderNumber: order.order_number,
          productSlug: order.product_slug,
          totalAmount: order.total_price_usd,
          paymentMethod: "zelle",
          currency: "USD",
          finalAmount: order.total_price_usd,
        },
      });
      console.log("[Zelle Webhook] Payment confirmation email sent to client");
    } catch (emailError) {
      console.error("[Zelle Webhook] Error sending payment confirmation email:", emailError);
    }

    // Send webhook to client (n8n) - same logic as Stripe webhook
    await sendClientWebhook(order, supabase);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Webhooks sent successfully",
        order_id: order.id,
        order_number: order.order_number,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[Zelle Webhook] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});


