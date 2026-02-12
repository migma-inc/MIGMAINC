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
          .catch((trackError: any) => {
            console.error("[Zelle Webhook] Erro ao rastrear pagamento:", trackError);
            // Continue - tracking is not critical
          })
      );
    }

    // Wait for all critical operations to complete
    await Promise.allSettled(criticalOperations);
    console.log("[Zelle Webhook] Operações críticas concluídas");

    // ============================================
    // NON-CRITICAL OPERATIONS: SEQUENTIAL PIPELINE
    // ============================================

    (async () => {
      try {
        console.log("[Zelle Webhook] 🚀 Iniciando pipeline sequencial...");

        // 1. Refresh Order Data (to ensure we have latest data)
        const { data: currentOrder } = await supabase
          .from("visa_orders")
          .select("*")
          .eq("id", order.id)
          .single();

        const orderToProcess = currentOrder || order;

        // 1.1 Test User Detection
        const isTestUser = orderToProcess.client_email?.toLowerCase() === 'victuribdev@gmail.com' ||
          orderToProcess.client_name?.toLowerCase().includes('paulo victor');

        if (isTestUser) {
          console.log(`[Zelle Webhook] 🧪 Usuário de teste detectado: ${orderToProcess.client_email}. Marcando ordem como teste.`);
          await supabase.from('visa_orders').update({ is_test: true }).eq('id', orderToProcess.id);
        }

        // 1.2 Fetch Client ID by email (since it's not in visa_orders)
        const { data: clientData } = await supabase
          .from('clients')
          .select('id')
          .eq('email', orderToProcess.client_email)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const clientId = clientData?.id;

        // 2. Increment Coupon Usage if applicable
        if (orderToProcess.coupon_code) {
          console.log(`[Zelle Webhook] 🎟️ Incrementando uso do cupom: ${orderToProcess.coupon_code}`);
          await supabase.rpc('increment_coupon_usage', { p_code: orderToProcess.coupon_code });
        }

        // 3. EB-3 RECURRENCE: Activate if Job Catalog
        if (orderToProcess.product_slug === 'eb3-installment-catalog') {
          try {
            console.log('[EB-3 Zelle] 🔍 Job Catalog detectado. Verificando recorrência existente...');

            if (!clientId) {
              console.error("[EB-3 Zelle] ❌ Erro: Cliente não encontrado na tabela 'clients'. Impossível ativar recorrência.");
            } else {
              // Check for existing recurrence
              const { data: existingRecurrence } = await supabase
                .from('eb3_recurrence_control')
                .select('id')
                .eq('client_id', clientId)
                .maybeSingle();

              if (!existingRecurrence) {
                console.log('[EB-3 Zelle] 🎯 Nenhuma recorrência encontrada. Ativando EB-3...');
                const { error: eb3Error } = await supabase.rpc('activate_eb3_recurrence', {
                  p_client_id: clientId,
                  p_activation_order_id: orderToProcess.id,
                  p_seller_id: orderToProcess.seller_id || null,
                  p_seller_commission_percent: orderToProcess.seller_commission_percent || null
                });

                if (eb3Error) {
                  console.error('[EB-3 Zelle] ❌ Erro ao ativar recorrência:', eb3Error);
                } else {
                  console.log('[EB-3 Zelle] ✅ Recorrência ativada com sucesso!');
                  // REMOVED: Immediate 1st installment email trigger as per user request
                }
              } else {
                console.log('[EB-3 Zelle] ⚠️ Recorrência já existe para este cliente. Ignorando ativação.');
              }
            }
          } catch (eb3Err) {
            console.error('[EB-3 Zelle] ❌ Exceção na ativação de recorrência:', eb3Err);
          }
        }

        // 3.1 Scholarship RECURRENCE: Activate if Scholarship Fee
        if (orderToProcess.product_slug === 'scholarship-maintenance-fee') {
          try {
            console.log('[Scholarship Zelle] 🔍 Scholarship Fee detectado. Verificando recorrência existente...');

            if (!clientId) {
              console.error("[Scholarship Zelle] ❌ Erro: Cliente não encontrado na tabela 'clients'. Impossível ativar recorrência.");
            } else {
              // Check for existing recurrence
              const { data: existingRecurrence } = await supabase
                .from('scholarship_recurrence_control')
                .select('id')
                .eq('client_id', clientId)
                .maybeSingle();

              if (!existingRecurrence) {
                console.log('[Scholarship Zelle] 🎯 Nenhuma recorrência encontrada. Ativando Scholarship...');
                const { error: schError } = await supabase.rpc('activate_scholarship_recurrence', {
                  p_client_id: clientId,
                  p_activation_order_id: orderToProcess.id,
                  p_seller_id: orderToProcess.seller_id || null,
                  p_seller_commission_percent: orderToProcess.seller_commission_percent || null
                });

                if (schError) {
                  console.error('[Scholarship Zelle] ❌ Erro ao ativar recorrência:', schError);
                } else {
                  console.log('[Scholarship Zelle] ✅ Recorrência ativada com sucesso!');
                }
              } else {
                console.log('[Scholarship Zelle] ⚠️ Recurrence already exists for this client. Skipping activation.');
              }
            }
          } catch (schErr) {
            console.error('[Scholarship Zelle] ❌ Exception checking/activating recurrence:', schErr);
          }
        }

        // 4. EB-3 INSTALLMENT: Mark as paid if it's an individual installment payment
        if (orderToProcess.product_slug === 'eb3-maintenance-installment' || orderToProcess.payment_metadata?.eb3_schedule_id) {
          try {
            const scheduleId = orderToProcess.payment_metadata?.eb3_schedule_id;
            if (scheduleId) {
              console.log('[EB-3 Zelle] 💳 Pagamento de parcela EB3 detectado:', scheduleId);
              await supabase.rpc('mark_eb3_installment_paid', {
                p_schedule_id: scheduleId,
                p_payment_id: orderToProcess.id
              });
              console.log('[EB-3 Zelle] ✅ Parcela marcada como paga');
            }
          } catch (e) {
            console.error('[EB-3 Zelle] Erro ao processar parcela:', e);
          }
        }

        // 4.1 SCHOLARSHIP INSTALLMENT: Mark as paid if it's an individual installment payment
        if (orderToProcess.payment_metadata?.scholarship_schedule_id) {
          try {
            const scheduleId = orderToProcess.payment_metadata.scholarship_schedule_id;
            console.log('[Scholarship Zelle] 💳 Pagamento de parcela Scholarship detectado:', scheduleId);
            await supabase.rpc('mark_scholarship_installment_paid', {
              p_schedule_id: scheduleId,
              p_payment_id: orderToProcess.id
            });
            console.log('[Scholarship Zelle] ✅ Parcela marcada como paga');
          } catch (schErr) {
            console.error('[Scholarship Zelle] Error processing scholarship installment:', schErr);
          }
        }

        // 5. Generate Main Contract
        if (orderToProcess.product_slug !== 'consultation-common') {
          console.log("[Zelle Webhook] [1/5] Gerando contrato principal...");
          await invokeEdgeFunction(supabase, "generate-visa-contract-pdf", { order_id: orderToProcess.id }, "gerar PDF do contrato");
        }

        // 6. Generate Main Annex I
        console.log("[Zelle Webhook] [2/5] Gerando anexo I principal...");
        await invokeEdgeFunction(supabase, "generate-annex-pdf", { order_id: orderToProcess.id }, "gerar PDF do ANEXO I");

        // 7. Generate Upsell Documents sequentially
        if (orderToProcess.upsell_product_slug) {
          console.log(`[Zelle Webhook] [3/5] Gerando contrato upsell: ${orderToProcess.upsell_product_slug}`);
          await invokeEdgeFunction(supabase, "generate-visa-contract-pdf", {
            order_id: orderToProcess.id,
            is_upsell: true,
            product_slug_override: orderToProcess.upsell_product_slug
          }, "gerar PDF do contrato upsell");

          console.log("[Zelle Webhook] [4/5] Gerando anexo I upsell...");
          await invokeEdgeFunction(supabase, "generate-annex-pdf", {
            order_id: orderToProcess.id,
            is_upsell: true,
            product_slug_override: orderToProcess.upsell_product_slug
          }, "gerar PDF do ANEXO I upsell");
        }

        // 8. Generate Invoice
        console.log("[Zelle Webhook] [5/5] Gerando invoice final...");
        await invokeEdgeFunction(supabase, "generate-invoice-pdf", { order_id: orderToProcess.id }, "gerar PDF da Invoice");

        // 9. Send Confirmation Email to Client
        console.log("[Zelle Webhook] 📧 Enviando email de confirmação ao cliente...");
        await invokeEdgeFunction(supabase, "send-payment-confirmation-email", {
          clientName: orderToProcess.client_name,
          clientEmail: orderToProcess.client_email,
          orderNumber: orderToProcess.order_number,
          productSlug: orderToProcess.product_slug,
          totalAmount: orderToProcess.total_price_usd,
          paymentMethod: "zelle",
          currency: "USD",
          finalAmount: orderToProcess.total_price_usd,
          is_bundle: !!orderToProcess.upsell_product_slug,
          extraUnits: orderToProcess.extra_units,
          eb3_schedule_id: orderToProcess.payment_metadata?.eb3_schedule_id,
          scholarship_schedule_id: orderToProcess.payment_metadata?.scholarship_schedule_id
        }, "enviar email de confirmação");

        // 10. Send Admin Notification
        console.log("[Zelle Webhook] 🔔 Enviando notificação administrativa...");
        await invokeEdgeFunction(supabase, "send-admin-payment-notification", {
          orderNumber: orderToProcess.order_number,
          clientName: orderToProcess.client_name,
          clientEmail: orderToProcess.client_email,
          productSlug: orderToProcess.product_slug,
          totalAmount: orderToProcess.total_price_usd,
          paymentMethod: "zelle",
          currency: "USD",
          finalAmount: orderToProcess.total_price_usd,
          is_bundle: !!orderToProcess.upsell_product_slug
        }, "enviar notificação administrativa");

        console.log("[Zelle Webhook] ✅ Pipeline sequencial concluído!");
      } catch (pipelineError) {
        console.error("[Zelle Webhook] ❌ Erro no pipeline sequencial:", pipelineError);
      }
    })();

    // Return success immediately after critical operations complete
    return new Response(
      JSON.stringify({
        success: true,
        message: "Payment processed and document pipeline started",
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
