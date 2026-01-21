import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Types
interface Order {
  id: string;
  order_number: string;
  payment_method: string;
  payment_status: string;
  product_slug: string;
  calculation_type?: string;
  base_price_usd?: string;
  extra_unit_price_usd?: string;
  total_price_usd?: string;
  client_name: string;
  client_whatsapp?: string;
  client_email: string;
  seller_id?: string;
  dependent_names?: string[];
  service_request_id?: string;
}

interface WebhookContext {
  type: 'main' | 'dependent';
  index?: number;
  total?: number;
  orderId: string;
  orderNumber: string;
  dependentName?: string;
}

interface WebhookResult {
  success: boolean;
  duration: number;
  attempts?: number;
}

interface FetchOptions {
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
}

// Normalize service name for grouped products (initial, cos, transfer)
function normalizeServiceName(productSlug: string, productName: string): string {
  if (productSlug.startsWith('initial-')) {
    return 'F1 Initial';
  }

  if (productSlug.startsWith('cos-') || productSlug.startsWith('transfer-')) {
    return 'COS & Transfer';
  }

  return productName;
}

// Calculate base service price based on calculation type
function calculateBaseServicePrice(order: Order): number {
  if (order.calculation_type === 'units_only') {
    return parseFloat(order.extra_unit_price_usd || '0');
  }
  return parseFloat(order.base_price_usd || '0');
}

// Get product name from database or fallback to slug
async function getProductName(supabase: any, productSlug: string): Promise<string> {
  const { data: product, error } = await supabase
    .from('visa_products')
    .select('name')
    .eq('slug', productSlug)
    .single();

  if (error) {
    console.warn('[Webhook Client] ⚠️ Error fetching product, using slug as fallback:', productSlug);
    return productSlug;
  }

  return product?.name || productSlug;
}

// Build main client payload
function buildMainClientPayload(order: Order, serviceName: string, basePrice: number): any {
  const dependentCount = Array.isArray(order.dependent_names) ? order.dependent_names.length : 0;

  return {
    servico: serviceName,
    plano_servico: order.product_slug,
    nome_completo: order.client_name,
    whatsapp: order.client_whatsapp || '',
    email: order.client_email,
    valor_servico: basePrice.toFixed(2),
    vendedor: order.seller_id || '',
    quantidade_dependentes: dependentCount,
  };
}

// Build dependent payload
function buildDependentPayload(order: Order, dependentName: string, unitPrice: number): any {
  return {
    nome_completo_cliente_principal: order.client_name,
    nome_completo_dependente: dependentName,
    valor_servico: unitPrice.toFixed(2),
  };
}

// Fetch with timeout using AbortController
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  }
}

// Calculate exponential backoff delay
function calculateBackoffDelay(attempt: number, baseDelay: number): number {
  return Math.min(baseDelay * Math.pow(2, attempt), 10000); // Max 10s
}

// Send single webhook with optimized fetch, timeout, retry logic and error handling
async function sendWebhook(
  webhookUrl: string,
  payload: any,
  context: WebhookContext,
  options: FetchOptions = {}
): Promise<WebhookResult> {
  const {
    timeout = 30000, // 30 seconds default timeout
    maxRetries = 3, // 3 retry attempts
    retryDelay = 500, // 500ms base delay
  } = options;

  const startTime = Date.now();
  const contextLabel = context.type === 'main'
    ? 'Cliente Principal'
    : `Dependente ${context.index}/${context.total}`;

  // Serialize payload once (reused for retries)
  const payloadJson = JSON.stringify(payload);
  const payloadSize = new TextEncoder().encode(payloadJson).length;

  // Optimized headers
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Connection': 'close', // Don't keep connection alive
    'User-Agent': 'MIGMA-Webhook-Client/1.0',
  };

  let lastError: Error | null = null;
  let lastResponse: Response | null = null;
  let attempts = 0;

  for (attempts = 0; attempts <= maxRetries; attempts++) {
    const attemptStartTime = Date.now();

    try {
      if (attempts > 0) {
        const backoffDelay = calculateBackoffDelay(attempts - 1, retryDelay);
        console.log(`[Webhook Client] 🔄 Retentativa ${attempts}/${maxRetries} para ${contextLabel} após ${backoffDelay}ms`);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      } else {
        console.log(`[Webhook Client] 📤 Enviando webhook: ${contextLabel} (${payloadSize} bytes)`);
      }

      // Fetch with timeout
      const response = await fetchWithTimeout(
        webhookUrl,
        {
          method: 'POST',
          headers,
          body: payloadJson,
        },
        timeout
      );

      const attemptDuration = Date.now() - attemptStartTime;
      lastResponse = response;

      // Limit response body size (max 10KB) to avoid memory issues
      let responseText = '';
      const contentLength = response.headers.get('content-length');
      const maxResponseSize = 10240; // 10KB

      if (contentLength && parseInt(contentLength) > maxResponseSize) {
        // Read only first 10KB
        const reader = response.body?.getReader();
        if (reader) {
          const decoder = new TextDecoder();
          let totalSize = 0;
          let done = false;

          while (!done && totalSize < maxResponseSize) {
            const { value, done: streamDone } = await reader.read();
            done = streamDone;
            if (value) {
              const chunk = decoder.decode(value, { stream: !done });
              responseText += chunk;
              totalSize += value.length;
            }
          }
          reader.releaseLock();
          if (!done) {
            responseText += '... (truncated)';
          }
        }
      } else {
        responseText = await response.text();
      }

      if (!response.ok) {
        // Retry on 5xx errors, don't retry on 4xx (client errors)
        const isRetryable = response.status >= 500 || response.status === 429;

        if (isRetryable && attempts < maxRetries) {
          console.warn(`[Webhook Client] ⚠️ Erro ${response.status} (tentativa ${attempts + 1}/${maxRetries + 1}):`, {
            status: response.status,
            statusText: response.statusText,
            duration: `${attemptDuration}ms`,
            will_retry: true,
          });
          lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
          continue; // Retry
        }

        // Don't retry on 4xx errors or if max retries reached
        const duration = Date.now() - startTime;
        console.error(`[Webhook Client] ❌ Erro ao enviar webhook ${contextLabel}:`, {
          status: response.status,
          statusText: response.statusText,
          duration: `${duration}ms`,
          attempts: attempts + 1,
          response_preview: responseText.substring(0, 200),
          order_id: context.orderId,
          order_number: context.orderNumber,
          ...(context.dependentName && { dependent_name: context.dependentName }),
        });
        return { success: false, duration, attempts: attempts + 1 };
      }

      // Success!
      const duration = Date.now() - startTime;
      console.log(`[Webhook Client] ✅ Webhook ${contextLabel} enviado com sucesso:`, {
        status: response.status,
        duration: `${duration}ms`,
        attempts: attempts + 1,
        payload_size: `${payloadSize} bytes`,
        order_id: context.orderId,
        order_number: context.orderNumber,
      });

      return { success: true, duration, attempts: attempts + 1 };

    } catch (error) {
      const attemptDuration = Date.now() - attemptStartTime;
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if error is retryable
      const isRetryable =
        lastError.message.includes('timeout') ||
        lastError.message.includes('network') ||
        lastError.message.includes('ECONNREFUSED') ||
        lastError.message.includes('ENOTFOUND');

      if (isRetryable && attempts < maxRetries) {
        console.warn(`[Webhook Client] ⚠️ Erro de rede (tentativa ${attempts + 1}/${maxRetries + 1}):`, {
          error: lastError.message,
          duration: `${attemptDuration}ms`,
          will_retry: true,
        });
        continue; // Retry
      }

      // Don't retry or max retries reached
      const duration = Date.now() - startTime;
      console.error(`[Webhook Client] ❌ Exceção ao enviar webhook ${contextLabel}:`, {
        error: lastError.message,
        duration: `${duration}ms`,
        attempts: attempts + 1,
        order_id: context.orderId,
        order_number: context.orderNumber,
        ...(context.dependentName && { dependent_name: context.dependentName }),
      });
      return { success: false, duration, attempts: attempts + 1 };
    }
  }

  // Should never reach here, but TypeScript needs it
  const duration = Date.now() - startTime;
  return { success: false, duration, attempts };
}

// Send webhook to client (n8n) after payment confirmation
async function sendClientWebhook(order: Order, supabase: any): Promise<void> {
  const webhookUrl = Deno.env.get('CLIENT_WEBHOOK_URL');

  if (!webhookUrl) {
    console.error('[Webhook Client] ❌ CLIENT_WEBHOOK_URL não configurado. Pulando webhook.');
    return;
  }

  try {
    console.log('[Webhook Client] 📤 Iniciando processo de envio de webhooks');
    console.log('[Webhook Client] Order ID:', order.id, '| Order Number:', order.order_number);

    // Get product name and normalize service name
    const productName = await getProductName(supabase, order.product_slug);
    const normalizedServiceName = normalizeServiceName(order.product_slug, productName);

    // Calculate base service price
    const baseServicePrice = calculateBaseServicePrice(order);
    console.log('[Webhook Client] 💰 Cálculo do valor:', {
      calculation_type: order.calculation_type,
      base_price_usd: order.base_price_usd,
      extra_unit_price_usd: order.extra_unit_price_usd,
      calculated_baseServicePrice: baseServicePrice,
    });

    // Build and send main client webhook
    const mainPayload = buildMainClientPayload(order, normalizedServiceName, baseServicePrice);
    const dependentCount = Array.isArray(order.dependent_names) ? order.dependent_names.length : 0;

    console.log('[Webhook Client] 📋 Resumo: 1 webhook principal +', dependentCount, 'webhook(s) de dependente(s)');

    const mainResult = await sendWebhook(webhookUrl, mainPayload, {
      type: 'main',
      orderId: order.id,
      orderNumber: order.order_number,
    });

    // Send webhooks for dependents in parallel
    const dependentResults: Promise<WebhookResult>[] = [];
    if (dependentCount > 0) {
      console.log('[Webhook Client] 📤 Iniciando envio paralelo de', dependentCount, 'webhook(s) de dependente(s)');

      const dependentUnitPrice = parseFloat(order.extra_unit_price_usd || '0');

      for (let i = 0; i < dependentCount; i++) {
        const dependentName = order.dependent_names![i];

        if (!dependentName?.trim()) {
          console.warn(`[Webhook Client] ⚠️ Pulando dependente ${i + 1}: nome vazio`);
          continue;
        }

        const dependentPayload = buildDependentPayload(order, dependentName, dependentUnitPrice);
        dependentResults.push(
          sendWebhook(webhookUrl, dependentPayload, {
            type: 'dependent',
            index: i + 1,
            total: dependentCount,
            orderId: order.id,
            orderNumber: order.order_number,
            dependentName,
          })
        );
      }
    }

    // Wait for all dependent webhooks to complete
    const dependentResultsArray = await Promise.allSettled(dependentResults);
    const successDependentCount = dependentResultsArray.filter(
      (result) => result.status === 'fulfilled' && result.value.success
    ).length;

    // Summary
    const successCount = (mainResult.success ? 1 : 0) + successDependentCount;
    const totalCount = 1 + dependentCount;

    console.log('[Webhook Client] 📋 Resumo final:', {
      total: totalCount,
      sucesso: successCount,
      falhas: totalCount - successCount,
      order_id: order.id,
      order_number: order.order_number,
    });
  } catch (error) {
    console.error('[Webhook Client] ❌ Exceção ao processar webhooks:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      order_id: order?.id,
      order_number: order?.order_number,
    });
  }
}

// Invoke edge function with error handling
async function invokeEdgeFunction(
  supabase: any,
  functionName: string,
  body: any,
  operationName: string
): Promise<void> {
  try {
    const { data, error } = await supabase.functions.invoke(functionName, { body });

    if (error) {
      console.error(`[Zelle Webhook] Erro ao ${operationName}:`, error);
    } else {
      console.log(`[Zelle Webhook] ${operationName} executado com sucesso`, data?.pdf_url ? `: ${data.pdf_url}` : '');
    }
  } catch (error) {
    console.error(`[Zelle Webhook] Exceção ao ${operationName}:`, error);
    // Continue - these operations are not critical for payment processing
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

    console.log("[Zelle Webhook] Processando aprovação manual para order:", order_id);

    // Get order from database
    const { data: order, error: orderError } = await supabase
      .from("visa_orders")
      .select("*")
      .eq("id", order_id)
      .single();

    if (orderError || !order) {
      console.error("[Zelle Webhook] Order não encontrada:", order_id);
      return new Response(
        JSON.stringify({ error: "Order not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate payment method and status together
    if (order.payment_method !== 'zelle' || order.payment_status !== 'completed') {
      console.error("[Zelle Webhook] Validação falhou:", {
        payment_method: order.payment_method,
        payment_status: order.payment_status,
      });
      return new Response(
        JSON.stringify({
          error: order.payment_method !== 'zelle'
            ? "Order is not a Zelle payment"
            : "Order payment status must be completed"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[Zelle Webhook] Order encontrada:", {
      id: order.id,
      order_number: order.order_number,
      payment_method: order.payment_method,
      payment_status: order.payment_status,
    });

    // Execute parallel queries for non-dependent data
    const [zellePaymentResult, paymentRecordResult] = await Promise.all([
      supabase
        .from("zelle_payments")
        .select("payment_id, status, n8n_confidence, n8n_validated_at")
        .eq("order_id", order.id)
        .maybeSingle(),
      order.service_request_id
        ? supabase
          .from("payments")
          .select("id")
          .eq("service_request_id", order.service_request_id)
          .eq("external_payment_id", order.id)
          .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    const zellePayment = zellePaymentResult.data;
    const paymentRecord = paymentRecordResult.data;

    if (zellePayment) {
      console.log("[Zelle Webhook] Registro de pagamento Zelle encontrado:", {
        payment_id: zellePayment.payment_id,
        status: zellePayment.status,
        n8n_confidence: zellePayment.n8n_confidence,
        n8n_validated_at: zellePayment.n8n_validated_at,
      });

      if (zellePayment.status !== 'approved') {
        console.warn("[Zelle Webhook] Aviso: status do zelle_payment não é 'approved':", zellePayment.status);
      }
    } else {
      console.log("[Zelle Webhook] Nenhum registro zelle_payment encontrado (pagamento legado)");
    }

    // CRITICAL OPERATIONS: Update database records (must complete before non-critical operations)
    const criticalOperations: Promise<any>[] = [];

    // Update payment record if exists
    if (paymentRecord) {
      criticalOperations.push(
        supabase
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
          .eq("id", paymentRecord.id)
      );
    }

    // Update service_request status to 'paid'
    if (order.service_request_id) {
      criticalOperations.push(
        supabase
          .from("service_requests")
          .update({
            status: "paid",
            updated_at: new Date().toISOString(),
          })
          .eq("id", order.service_request_id)
      );
    }

    // Track payment completed in funnel (non-critical but should complete)
    if (order.seller_id) {
      criticalOperations.push(
        supabase
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
          })
          .then(() => {
            console.log("[Zelle Webhook] Evento de pagamento rastreado no funnel");
          })
          .catch((trackError) => {
            console.error("[Zelle Webhook] Erro ao rastrear pagamento:", trackError);
            // Continue - tracking is not critical
          })
      );
    }

    // Wait for all critical operations to complete
    await Promise.allSettled(criticalOperations);
    console.log("[Zelle Webhook] Operações críticas concluídas");

    // NON-CRITICAL OPERATIONS: Execute in parallel (PDF generation, email, webhook)
    // ANNEX I is now required for ALL products (universal payment authorization)
    const nonCriticalOperations: Promise<void>[] = [];

    // Generate full contract PDF (optional - if template exists)
    if (order.product_slug !== 'consultation-common') {
      nonCriticalOperations.push(
        invokeEdgeFunction(supabase, "generate-visa-contract-pdf", { order_id: order.id }, "gerar PDF do contrato")
      );
    }

    // Generate ANNEX I PDF for ALL products (universal requirement)
    nonCriticalOperations.push(
      invokeEdgeFunction(supabase, "generate-annex-pdf", { order_id: order.id }, "gerar PDF do ANEXO I")
    );

    // Send confirmation email
    nonCriticalOperations.push(
      invokeEdgeFunction(supabase, "send-payment-confirmation-email", {
        clientName: order.client_name,
        clientEmail: order.client_email,
        orderNumber: order.order_number,
        productSlug: order.product_slug,
        totalAmount: order.total_price_usd,
        paymentMethod: "zelle",
        currency: "USD",
        finalAmount: order.total_price_usd,
      }, "enviar email de confirmação")
    );

    // Send webhook to client (n8n)
    nonCriticalOperations.push(sendClientWebhook(order, supabase));

    // Execute all non-critical operations in parallel (don't wait for completion)
    Promise.allSettled(nonCriticalOperations).then(() => {
      console.log("[Zelle Webhook] Operações não-críticas concluídas");
    }).catch((error) => {
      console.error("[Zelle Webhook] Erro em operações não-críticas:", error);
    });

    // Return success immediately after critical operations complete
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
    console.error("[Zelle Webhook] Erro:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
