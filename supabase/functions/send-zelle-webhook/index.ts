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

    // Generate Invoice PDF for ALL products
    nonCriticalOperations.push(
      invokeEdgeFunction(supabase, "generate-invoice-pdf", { order_id: order.id }, "gerar PDF da Invoice")
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

    // Send webhook to client (n8n removed)

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
