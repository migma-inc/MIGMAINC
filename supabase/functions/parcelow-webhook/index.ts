import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
};

interface ParcelowWebhookEvent {
  event: string;
  order?: any;
  data?: any;
}

// 🆕 FUNÇÃO PARA PROCESSAR SPLIT PAYMENT WEBHOOK
async function processSplitPaymentWebhook(
  eventType: string,
  parcelowOrder: any,
  splitPayment: any,
  mainOrder: any,
  supabase: any
) {
  console.log("[Split Webhook] 🎯 Processando webhook de split payment...");
  console.log("[Split Webhook] Event:", eventType);
  console.log("[Split Webhook] Parcelow Order ID:", parcelowOrder.id);

  // Determinar qual parte foi paga
  const isPart1 = splitPayment.part1_parcelow_order_id === parcelowOrder.id.toString();
  const isPart2 = splitPayment.part2_parcelow_order_id === parcelowOrder.id.toString();
  const partNumber = isPart1 ? 1 : 2;

  console.log(`[Split Webhook] 📦 Parte detectada: Part ${partNumber}`);

  // Processar apenas eventos de pagamento confirmado
  if (eventType !== "event_order_paid") {
    console.log(`[Split Webhook] ⏭️ Evento ${eventType} ignorado (não é pagamento)`);

    // Atualizar status da Parcelow mesmo que não seja paid
    const updateField = isPart1 ? 'part1_parcelow_status' : 'part2_parcelow_status';
    await supabase
      .from("split_payments")
      .update({ [updateField]: parcelowOrder.status_text })
      .eq("id", splitPayment.id);

    return;
  }

  // Verificar se já foi processado
  const currentPartStatus = isPart1 ? splitPayment.part1_payment_status : splitPayment.part2_payment_status;
  if (currentPartStatus === 'completed') {
    console.log(`[Split Webhook] ✅ Part ${partNumber} já foi processada anteriormente`);
    return;
  }

  console.log(`[Split Webhook] 💰 Part ${partNumber} PAGA! Atualizando banco...`);

  // Preparar dados de atualização
  const paymentDetails = parcelowOrder.payments?.[0];
  const updateData: any = {
    [`part${partNumber}_payment_status`]: 'completed',
    [`part${partNumber}_completed_at`]: new Date().toISOString(),
    [`part${partNumber}_parcelow_status`]: parcelowOrder.status_text,
    [`part${partNumber}_payment_metadata`]: {
      parcelow_order_id: parcelowOrder.id,
      total_usd: (parcelowOrder.total_usd || 0) / 100,
      total_brl: paymentDetails?.total_brl || parcelowOrder.total_brl || 0,
      installments: paymentDetails?.installments || parcelowOrder.installments || 1,
      completed_at: new Date().toISOString(),
    }
  };

  // Verificar se ambas as partes foram pagas
  const part1Completed = isPart1 ? true : (splitPayment.part1_payment_status === 'completed');
  const part2Completed = isPart2 ? true : (splitPayment.part2_payment_status === 'completed');
  const bothPartsPaid = part1Completed && part2Completed;

  if (bothPartsPaid) {
    console.log("[Split Webhook] 🎉 AMBAS AS PARTES PAGAS! Finalizando pedido...");
    updateData.overall_status = 'fully_completed';
  } else {
    console.log(`[Split Webhook] ⏳ Apenas Part ${partNumber} paga. Aguardando Part ${isPart1 ? 2 : 1}...`);
    updateData.overall_status = 'part1_completed';
  }

  // Atualizar split_payment
  const { error: updateSplitError } = await supabase
    .from("split_payments")
    .update(updateData)
    .eq("id", splitPayment.id);

  if (updateSplitError) {
    console.error("[Split Webhook] ❌ Erro ao atualizar split_payment:", updateSplitError);
    return;
  }

  console.log("[Split Webhook] ✅ Split payment atualizado com sucesso");

  // Se ambas as partes foram pagas, processar como pedido completo
  if (bothPartsPaid) {
    console.log("[Split Webhook] 📄 Gerando contratos e documentos...");

    // Buscar o registro atualizado do split para calcular os totais consolidados
    const { data: latestSplit, error: fetchSplitError } = await supabase
      .from("split_payments")
      .select("*")
      .eq("id", splitPayment.id)
      .single();

    if (fetchSplitError || !latestSplit) {
      console.error("[Split Webhook] ❌ Erro ao buscar split atualizado:", fetchSplitError);
      return;
    }

    const m1 = latestSplit.part1_payment_metadata || {};
    const m2 = latestSplit.part2_payment_metadata || {};

    // Calcular totais acumulados
    const totalUsdPaid = (Number(m1.total_usd) || 0) + (Number(m2.total_usd) || 0);
    const totalBrlPaid = (Number(m1.total_brl) || 0) + (Number(m2.total_brl) || 0);
    const serviceTotalUsd = parseFloat(latestSplit.total_amount_usd);
    const totalFeeUsd = totalUsdPaid - serviceTotalUsd;

    console.log(`[Split Webhook] 📊 Consolidação: Total USD: ${totalUsdPaid}, Total BRL: ${totalBrlPaid}, Fees: ${totalFeeUsd}`);

    // Atualizar visa_orders para completed
    await supabase
      .from("visa_orders")
      .update({
        payment_status: 'completed',
        paid_at: new Date().toISOString(),
        payment_method: 'parcelow',
        parcelow_status: 'Paid (Split)',
        payment_metadata: {
          ...(mainOrder.payment_metadata || {}),
          is_split_payment: true,
          split_payment_id: splitPayment.id,
          total_usd: totalUsdPaid,
          total_brl: totalBrlPaid,
          fee_amount: totalFeeUsd > 0 ? totalFeeUsd : 0,
          service_amount: serviceTotalUsd,
          completed_at: new Date().toISOString(),
          parts_details: {
            part1: m1,
            part2: m2
          }
        }
      })
      .eq("id", mainOrder.id);

    // 🔍 Test User Detection
    const isTestUser = mainOrder.client_email?.toLowerCase() === 'victuribdev@gmail.com' ||
      mainOrder.client_email?.toLowerCase() === 'victtinho.ribeiro@gmail.com' ||
      mainOrder.client_name?.toLowerCase().includes('paulo victor') ||
      mainOrder.client_name?.toLowerCase().includes('paulo víctor');

    if (isTestUser) {
      console.log(`[parcelow-webhook] 🧪 Usuário de teste detectado: ${mainOrder.client_email}. Marcando como teste.`);
      await supabase.from('visa_orders').update({ is_test: true }).eq('id', mainOrder.id);
    }

    // Buscar todas as orders relacionadas (incluindo upsells)
    const { data: allOrders } = await supabase
      .from("visa_orders")
      .select("*")
      .eq("id", mainOrder.id);

    const orders = allOrders || [mainOrder];

    // Incrementar uso de cupom se existir - REMOVIDO (agora é no checkout)
    /*
    if (mainOrder.coupon_code) {
      console.log(`[Split Webhook] 🎟️ Incrementando uso do cupom: ${mainOrder.coupon_code}`);
      await supabase.rpc('increment_coupon_usage', { p_code: mainOrder.coupon_code });
    }
    */

    // Gerar PDFs
    for (const orderItem of orders) {
      console.log(`[Split Webhook] 📄 Gerando PDFs para order ${orderItem.order_number}...`);

      if (orderItem.product_slug !== 'consultation-common') {
        await supabase.functions.invoke("generate-visa-contract-pdf", {
          body: { order_id: orderItem.id }
        });
      }

      await supabase.functions.invoke("generate-annex-pdf", {
        body: { order_id: orderItem.id }
      });

      await supabase.functions.invoke("generate-invoice-pdf", {
        body: { order_id: orderItem.id }
      });

      // Gerar PDFs de upsell se existir
      if (orderItem.upsell_product_slug) {
        console.log(`[Split Webhook] 📄 Gerando PDFs de upsell: ${orderItem.upsell_product_slug}`);

        await supabase.functions.invoke("generate-visa-contract-pdf", {
          body: {
            order_id: orderItem.id,
            is_upsell: true,
            product_slug_override: orderItem.upsell_product_slug
          }
        });

        await supabase.functions.invoke("generate-annex-pdf", {
          body: {
            order_id: orderItem.id,
            is_upsell: true,
            product_slug_override: orderItem.upsell_product_slug
          }
        });
      }
    }

    // Enviar email de confirmação e notificações (Client, Admin, Seller, HoS)
    try {
      console.log("[Split Webhook] 📧 Iniciando fluxo de notificações...");

      const commonData = {
        clientName: mainOrder.client_name,
        clientEmail: mainOrder.client_email,
        orderNumber: mainOrder.order_number,
        productSlug: mainOrder.product_slug,
        totalAmount: totalBrlPaid,
        paymentMethod: "parcelow_split",
        currency: "BRL",
        finalAmount: totalBrlPaid,
        is_bundle: orders.length > 1,
        extraUnits: mainOrder.extra_units
      };

      // Calculate Net BRL Value for Seller/HoS (Base Service Value only)
      // Proportion: ServiceTotalUsd / TotalUsdPaid
      const netProportion = serviceTotalUsd / totalUsdPaid;
      const netBrlValue = totalBrlPaid * netProportion;
      const netNotificationData = {
        ...commonData,
        totalAmount: netBrlValue,
        finalAmount: netBrlValue
      };

      // Client Notification
      await supabase.functions.invoke("send-payment-confirmation-email", { body: commonData });

      // Admin Notification
      await supabase.functions.invoke("send-admin-payment-notification", {
        body: { ...commonData, is_test: isTestUser }
      });

      // Seller & HoS Notification
      if (mainOrder.seller_id) {
        const { data: seller } = await supabase
          .from('sellers')
          .select('*')
          .eq('seller_id_public', mainOrder.seller_id)
          .maybeSingle();

        if (seller) {
          // Seller Notification
          await supabase.functions.invoke("send-seller-payment-notification", {
            body: { ...netNotificationData, sellerEmail: seller.email, sellerName: seller.full_name }
          });

          // HoS Notification
          if (seller.role === 'head_of_sales') {
            await supabase.functions.invoke("send-hos-payment-notification", {
              body: { ...netNotificationData, hosEmail: seller.email, hosName: seller.full_name, type: 'own_sale' }
            });
          } else if (seller.head_of_sales_id) {
            const { data: hos } = await supabase
              .from('sellers')
              .select('*')
              .eq('id', seller.head_of_sales_id)
              .maybeSingle();

            if (hos) {
              await supabase.functions.invoke("send-hos-payment-notification", {
                body: { ...netNotificationData, hosEmail: hos.email, hosName: hos.full_name, sellerName: seller.full_name, type: 'team_sale' }
              });
            }
          }
        }
      }
      console.log("[Split Webhook] ✅ Notificações enviadas com sucesso");
    } catch (notificationError) {
      console.error("[Split Webhook] ⚠️ Erro ao enviar notificações:", notificationError);
    }

    // ====== EB-3 RECURRENCE: Activate if Job Catalog (Split Payment) ======
    if (mainOrder.product_slug === 'eb3-installment-catalog') {
      try {
        console.log('[EB-3 Split] 🔍 Job Catalog detected. Checking for existing recurrence...');

        // Fetch Client ID by email
        const { data: clientData } = await supabase
          .from('clients')
          .select('id')
          .eq('email', mainOrder.client_email)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const clientId = clientData?.id;

        if (!clientId) {
          console.error("[EB-3 Split] ❌ Error: Client not found in 'clients' table. Cannot activate recurrence.");
        } else {
          const { data: existingRecurrence } = await supabase
            .from('eb3_recurrence_control')
            .select('id')
            .eq('client_id', clientId)
            .maybeSingle();

          if (!existingRecurrence) {
            console.log('[EB-3 Split] 🎯 No existing recurrence found. Activating EB-3 recurrence...');

            const { error: eb3Error } = await supabase.rpc('activate_eb3_recurrence', {
              p_client_id: clientId,
              p_activation_order_id: mainOrder.id,
              p_seller_id: mainOrder.seller_id || null,
              p_seller_commission_percent: mainOrder.seller_commission_percent || null
            });

            if (eb3Error) {
              console.error('[EB-3 Split] ❌ Error activating recurrence:', eb3Error);
            } else {
              console.log('[EB-3 Split] ✅ EB-3 recurrence activated! 8 monthly installments scheduled.');
            }
          } else {
            console.log('[EB-3 Split] ⚠️ Recurrence already exists for this client. Skipping activation.');
          }
        }
      } catch (eb3Error) {
        console.error('[EB-3 Split] ❌ Exception checking/activating recurrence:', eb3Error);
      }
    }

    // ====== SCHOLARSHIP RECURRENCE: Activate if Scholarship Fee (Split Payment) ======
    if (mainOrder.product_slug === 'scholarship-maintenance-fee') {
      try {
        console.log('[Scholarship Split] 🔍 Scholarship Fee detected. Checking for existing recurrence...');

        // Fetch Client ID by email
        const { data: clientData } = await supabase
          .from('clients')
          .select('id')
          .eq('email', mainOrder.client_email)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const clientId = clientData?.id;

        if (!clientId) {
          console.error("[Scholarship Split] ❌ Error: Client not found in 'clients' table. Cannot activate recurrence.");
        } else {
          const { data: existingRecurrence } = await supabase
            .from('scholarship_recurrence_control')
            .select('id')
            .eq('client_id', clientId)
            .maybeSingle();

          if (!existingRecurrence) {
            console.log('[Scholarship Split] 🎯 No existing recurrence found. Activating Scholarship recurrence...');

            const { error: schError } = await supabase.rpc('activate_scholarship_recurrence', {
              p_client_id: clientId,
              p_activation_order_id: mainOrder.id,
              p_seller_id: mainOrder.seller_id || null,
              p_seller_commission_percent: mainOrder.seller_commission_percent || null
            });

            if (schError) {
              console.error('[Scholarship Split] ❌ Error activating recurrence:', schError);
            } else {
              console.log('[Scholarship Split] ✅ Scholarship recurrence activated! Infinite installments scheduled.');
            }
          } else {
            console.log('[Scholarship Split] ⚠️ Recurrence already exists for this client. Skipping activation.');
          }
        }
      } catch (schError) {
        console.error('[Scholarship Split] ❌ Exception checking/activating recurrence:', schError);
      }
    }

    // ====== EB-3 INSTALLMENT: Mark as paid if installment payment (Split Payment) ======
    if (mainOrder.payment_metadata?.eb3_schedule_id) {
      try {
        console.log('[EB-3 Split] 💳 EB-3 installment payment detected:', mainOrder.payment_metadata.eb3_schedule_id);

        const { error: eb3Error } = await supabase.rpc('mark_eb3_installment_paid', {
          p_schedule_id: mainOrder.payment_metadata.eb3_schedule_id,
          p_payment_id: mainOrder.id
        });

        if (eb3Error) {
          console.error('[EB-3 Split] ❌ Error marking installment as paid:', eb3Error);
        } else {
          console.log('[EB-3 Split] ✅ Installment marked as paid successfully');
        }
      } catch (eb3Exception) {
        console.error('[EB-3 Split] ❌ Exception marking installment as paid:', eb3Exception);
      }
    }

    // ====== SCHOLARSHIP INSTALLMENT: Mark as paid if installment payment (Split Payment) ======
    if (mainOrder.payment_metadata?.scholarship_schedule_id) {
      try {
        console.log('[Scholarship Split] 💳 Scholarship installment payment detected:', mainOrder.payment_metadata.scholarship_schedule_id);

        const { error: schError } = await supabase.rpc('mark_scholarship_installment_paid', {
          p_schedule_id: mainOrder.payment_metadata.scholarship_schedule_id,
          p_payment_id: mainOrder.id
        });

        if (schError) {
          console.error('[Scholarship Split] ❌ Error marking installment as paid:', schError);
        } else {
          console.log('[Scholarship Split] ✅ Installment marked as paid successfully');
        }
      } catch (schException) {
        console.error('[Scholarship Split] ❌ Exception marking installment as paid:', schException);
      }
    }

    console.log("[Split Webhook] ✅ Fluxo de split payment totalmente concluído!");
  } else {
    if (isPart1) {
      try {
        console.log("[Split Webhook] Sending part 2 checkout email after part 1 confirmation...");
        const { data: emailResult, error: emailError } = await supabase.functions.invoke(
          "send-split-part2-payment-email",
          {
            body: {
              split_payment_id: splitPayment.id,
              email_type: "initial",
            },
          }
        );

        if (emailError) {
          console.error("[Split Webhook] Error invoking split part 2 email:", emailError);
        } else {
          console.log("[Split Webhook] Part 2 checkout email result:", emailResult);
        }
      } catch (emailInvokeError) {
        console.error("[Split Webhook] Unexpected error sending split part 2 email:", emailInvokeError);
      }
    }

    console.log(`[Split Webhook] ⏳ Aguardando pagamento da Part ${isPart1 ? 2 : 1}...`);
    console.log("[Split Webhook] ℹ️ Contratos NÃO serão gerados até que ambas as partes sejam pagas");
  }
}

async function processParcelowWebhookEvent(event: ParcelowWebhookEvent, supabase: any) {
  const { event: eventType } = event;
  const parcelowOrder = event.order || event.data;
  if (!parcelowOrder) return;

  console.log(`[Parcelow Webhook] Processing ${eventType} for Parcelow ID ${parcelowOrder.id}`);

  // 1. PRIMEIRO: Verificar se é um Split Payment
  console.log("[Parcelow Webhook] 🔍 Verificando se é split payment...");
  const { data: splitPayment } = await supabase
    .from("split_payments")
    .select("*")
    .or(`part1_parcelow_order_id.eq.${parcelowOrder.id},part2_parcelow_order_id.eq.${parcelowOrder.id}`)
    .maybeSingle();

  if (splitPayment) {
    console.log("[Parcelow Webhook] 🎯 Split payment detectado! ID:", splitPayment.id);

    // Buscar a order principal ligada ao split
    const { data: mainOrder } = await supabase
      .from("visa_orders")
      .select("*")
      .eq("id", splitPayment.order_id)
      .single();

    if (!mainOrder) {
      console.error("[Parcelow Webhook] Split payment found but main order is missing");
      return;
    }

    // Processar split payment (lógica especial)
    await processSplitPaymentWebhook(eventType, parcelowOrder, splitPayment, mainOrder, supabase);
    return;
  }

  // 2. SEGUNDO: Se não for split, buscar como pagamento normal
  console.log("[Parcelow Webhook] ℹ️ Verificando pagamento normal...");
  const { data: orders, error: orderError } = await supabase
    .from("visa_orders")
    .select("*")
    .eq("parcelow_order_id", parcelowOrder.id.toString());

  if (orderError || !orders || orders.length === 0) {
    // ── MIGMA CHECKOUT: verificar migma_parcelow_pending ──────────────────────
    console.log(`[Parcelow Webhook] 🔍 Buscando na migma_parcelow_pending por ID: ${parcelowOrder.id}`);
    const { data: migmaPending, error: migmaErr } = await supabase
      .from("migma_parcelow_pending")
      .select("*")
      .eq("parcelow_order_id", parcelowOrder.id.toString())
      .maybeSingle();

    if (migmaErr) {
      console.error("[Parcelow Webhook] ❌ Erro ao buscar na migma_parcelow_pending:", migmaErr);
    }

    if (migmaPending) {
      console.log(`[Parcelow Webhook] ✅ Registro Migma encontrado! ID=${migmaPending.id} Usuário=${migmaPending.migma_user_id}`);

      if ((eventType === "event_order_paid" || eventType === "event_order_confirmed") && !migmaPending.migma_payment_completed) {
        // 1. Chama migma-payment-completed primeiro para registrar no Matricula USA
        console.log(`[Parcelow Webhook] 🚀 Invocando migma-payment-completed para usuário ${migmaPending.migma_user_id} (Evento: ${eventType})`);
        const { error: payErr } = await supabase.functions.invoke("migma-payment-completed", {
          body: {
            user_id: migmaPending.migma_user_id,
            fee_type: "selection_process",
            amount: migmaPending.amount,
            payment_method: "parcelow",
            service_type: migmaPending.service_type,
            parcelow_order_id: parcelowOrder.id.toString(),
          },
        });

        if (payErr) {
          console.error("[Parcelow Webhook] ❌ migma-payment-completed falhou:", payErr);
        } else {
          console.log("[Parcelow Webhook] ✅ Migma selection_process fee processado com sucesso!");
          
          // 2. SÓ AGORA marca o pagamento como concluído na tabela de controle
          await supabase
            .from("migma_parcelow_pending")
            .update({ 
              status: "paid", 
              migma_payment_completed: true, 
              updated_at: new Date().toISOString() 
            })
            .eq("id", migmaPending.id);
        }
      }
 else if (eventType === "event_order_declined" || eventType === "event_order_canceled" || eventType === "event_order_expired") {
        await supabase
          .from("migma_parcelow_pending")
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("id", migmaPending.id);
        console.log(`[Parcelow Webhook] Migma pending marcado como failed (${eventType})`);
      }
      return;
    }
    // ─────────────────────────────────────────────────────────────────────────

    console.warn("[Parcelow Webhook] Order não encontrada em nenhuma das tabelas");
    return;
  }

  console.log("[Parcelow Webhook] ℹ️ Pagamento normal encontrado");
  const mainOrder = orders.find((o: any) => !o.payment_metadata?.is_upsell) || orders[0];

  if (mainOrder.payment_status === 'completed' && eventType === 'event_order_paid') {
    console.log("[Parcelow Webhook] Already completed");
    return;
  }

  let paymentStatus = mainOrder.payment_status;
  let shouldProcessPayment = false;

  switch (eventType) {
    case "event_order_paid":
      paymentStatus = "completed";
      shouldProcessPayment = true;
      break;
    case "event_order_declined":
      paymentStatus = "failed";
      break;
    case "event_order_canceled":
    case "event_order_expired":
      paymentStatus = "cancelled";
      break;
  }

  const updateData: any = {
    parcelow_status: parcelowOrder.status_text,
    parcelow_status_code: parcelowOrder.status,
    payment_status: paymentStatus
  };

  if (shouldProcessPayment) {
    const paymentDetails = parcelowOrder.payments?.[0];
    const actualTotalBrl = paymentDetails?.total_brl;
    const actualInstallments = paymentDetails?.installments || parcelowOrder.installments || 1;

    for (const orderItem of orders) {
      await supabase.from("visa_orders").update({
        payment_status: "completed",
        paid_at: new Date().toISOString(),
        payment_method: "parcelow",
        payment_metadata: {
          ...(orderItem.payment_metadata || {}),
          payment_method: "parcelow",
          completed_at: new Date().toISOString(),
          parcelow_order_id: parcelowOrder.id,
          installments: actualInstallments,
          total_usd: (parcelowOrder.total_usd || 0) / 100,
          total_brl: actualTotalBrl || parcelowOrder.total_brl || 0,
          fee_amount: orderItem.id === mainOrder.id ? (((parcelowOrder.total_usd || 0) - (parcelowOrder.order_amount || 0)) / 100) : 0,
        }
      }).eq("id", orderItem.id);
    }

    // 🔍 Test User Detection
    const isTestUser = mainOrder.client_email?.toLowerCase() === 'victuribdev@gmail.com' ||
      mainOrder.client_email?.toLowerCase() === 'victtinho.ribeiro@gmail.com' ||
      mainOrder.client_name?.toLowerCase().includes('paulo victor') ||
      mainOrder.client_name?.toLowerCase().includes('paulo víctor');

    if (isTestUser) {
      console.log(`[parcelow-webhook] 🧪 Usuário de teste detectado: ${mainOrder.client_email}. Marcando como teste.`);
      await supabase.from('visa_orders').update({ is_test: true }).eq('id', mainOrder.id);
    }

    if (mainOrder.service_request_id) {
      await supabase.from("payments").update({ status: "paid", updated_at: new Date().toISOString() })
        .eq("service_request_id", mainOrder.service_request_id)
        .eq("external_payment_id", parcelowOrder.id.toString());

      await supabase.from("service_requests").update({ status: "paid", updated_at: new Date().toISOString() })
        .eq("id", mainOrder.service_request_id);
    }

    if (mainOrder.seller_id) {
      try {
        await supabase.from('seller_funnel_events').insert({
          seller_id: mainOrder.seller_id,
          product_slug: mainOrder.product_slug,
          event_type: 'payment_completed',
          session_id: `order_${mainOrder.id}`,
          metadata: { order_id: mainOrder.id, has_bundle: orders.length > 1 }
        });
      } catch (e) { }
    }

    // Increment coupon usage if authorized - REMOVED (now handled at checkout)
    /*
    if (mainOrder.coupon_code) {
      console.log(`[parcelow-webhook] 🎟️ Incrementing usage for coupon: ${mainOrder.coupon_code}`);
      const { error: rpcError } = await supabase.rpc('increment_coupon_usage', {
        p_code: mainOrder.coupon_code
      });

      if (rpcError) {
        console.error(`[parcelow-webhook] ❌ Failed to increment coupon usage: ${rpcError.message}`);
      } else {
        console.log(`[parcelow-webhook] ✅ Coupon usage incremented successfully.`);
      }
    }
    */

    // ====== EB-3 RECURRENCE: Activate if Job Catalog ======
    if (mainOrder.product_slug === 'eb3-installment-catalog') {
      try {
        console.log(`[EB-3 Parcelow] 🚀 JOB CATALOG DETECTED for client: ${mainOrder.client_email}`);
        console.log(`[EB-3 Parcelow] 🔍 Order ID: ${mainOrder.id} | Parcelow ID: ${parcelowOrder.id}`);

        const { data: clientData } = await supabase
          .from('clients')
          .select('id')
          .eq('email', mainOrder.client_email)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const clientId = clientData?.id;

        if (clientId) {
          const { data: existingRecurrence } = await supabase
            .from('eb3_recurrence_control')
            .select('id')
            .eq('client_id', clientId)
            .maybeSingle();

          if (!existingRecurrence) {
            console.log('[EB-3 Parcelow] 🎯 No existing recurrence found. Activating EB-3 recurrence...');
            const { error: eb3Error } = await supabase.rpc('activate_eb3_recurrence', {
              p_client_id: clientId,
              p_activation_order_id: mainOrder.id,
              p_seller_id: mainOrder.seller_id || null,
              p_seller_commission_percent: mainOrder.seller_commission_percent || null
            });

            if (eb3Error) {
              console.error('[EB-3 Parcelow] ❌ Error activating recurrence:', eb3Error);
            } else {
              console.log('[EB-3 Parcelow] ✅ Recurrence activated successfully!');
            }
          } else {
            console.log('[EB-3 Parcelow] ⚠️ Recurrence already exists for this client. Skipping activation.');
          }
        }
      } catch (eb3Error) {
        console.error('[EB-3 Parcelow] ❌ Exception checking/activating recurrence:', eb3Error);
      }
    }

    // ====== SCHOLARSHIP RECURRENCE: Activate if Scholarship Fee ======
    if (mainOrder.product_slug === 'scholarship-maintenance-fee') {
      try {
        console.log(`[Scholarship Parcelow] 🚀 SCHOLARSHIP FEE DETECTED for client: ${mainOrder.client_email}`);
        console.log(`[Scholarship Parcelow] 🔍 Order ID: ${mainOrder.id} | Parcelow ID: ${parcelowOrder.id}`);

        const { data: clientData } = await supabase
          .from('clients')
          .select('id')
          .eq('email', mainOrder.client_email)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const clientId = clientData?.id;

        if (clientId) {
          const { data: existingRecurrence } = await supabase
            .from('scholarship_recurrence_control')
            .select('id')
            .eq('client_id', clientId)
            .maybeSingle();

          if (!existingRecurrence) {
            console.log('[Scholarship Parcelow] 🎯 No existing recurrence found. Activating Scholarship recurrence...');
            const { error: schError } = await supabase.rpc('activate_scholarship_recurrence', {
              p_client_id: clientId,
              p_activation_order_id: mainOrder.id,
              p_seller_id: mainOrder.seller_id || null,
              p_seller_commission_percent: mainOrder.seller_commission_percent || null
            });

            if (schError) {
              console.error('[Scholarship Parcelow] ❌ Error activating recurrence:', schError);
            } else {
              console.log('[Scholarship Parcelow] ✅ Recurrence activated successfully!');
            }
          } else {
            console.log('[Scholarship Parcelow] ⚠️ Recurrence already exists for this client. Skipping activation.');
          }
        }
      } catch (schError) {
        console.error('[Scholarship Parcelow] ❌ Exception checking/activating recurrence:', schError);
      }
    }

    // ====== EB-3 INSTALLMENT: Mark as paid if installment payment ======
    if (mainOrder.payment_metadata?.eb3_schedule_id) {
      try {
        await supabase.rpc('mark_eb3_installment_paid', {
          p_schedule_id: mainOrder.payment_metadata.eb3_schedule_id,
          p_payment_id: mainOrder.id
        });
      } catch (eb3Exception) { }
    }

    // ====== SCHOLARSHIP INSTALLMENT: Mark as paid if installment payment ======
    if (mainOrder.payment_metadata?.scholarship_schedule_id) {
      try {
        await supabase.rpc('mark_scholarship_installment_paid', {
          p_schedule_id: mainOrder.payment_metadata.scholarship_schedule_id,
          p_payment_id: mainOrder.id
        });
      } catch (schException) { }
    }

    for (const orderItem of orders) {
      if (orderItem.product_slug !== 'consultation-common') {
        await supabase.functions.invoke("generate-visa-contract-pdf", { body: { order_id: orderItem.id } });
      }
      await supabase.functions.invoke("generate-annex-pdf", { body: { order_id: orderItem.id } });
      await supabase.functions.invoke("generate-invoice-pdf", { body: { order_id: orderItem.id } });
    }

    try {
      console.log(`[Parcelow Webhook] 📧 Iniciando fluxo de notificações para order ${mainOrder.order_number}...`);
      const totalBrlValue = actualTotalBrl || parcelowOrder.total_brl || 0;

      const commonData = {
        clientName: mainOrder.client_name,
        clientEmail: mainOrder.client_email,
        orderNumber: mainOrder.order_number,
        productSlug: mainOrder.product_slug,
        totalAmount: totalBrlValue,
        paymentMethod: "parcelow",
        currency: "BRL",
        finalAmount: totalBrlValue,
        is_bundle: orders.length > 1,
        extraUnits: mainOrder.extra_units
      };

      // Calculate Net BRL Value for Seller/HoS (Base Service Value only)
      // Proportion: order_amount / total_usd
      const totalUsdPaid = (parcelowOrder.total_usd || 0) / 100;
      const serviceUsdValue = (parcelowOrder.order_amount || 0) / 100;
      const netProportion = totalUsdPaid > 0 ? (serviceUsdValue / totalUsdPaid) : 1;
      const netBrlValue = totalBrlValue * netProportion;
      const netNotificationData = {
        ...commonData,
        totalAmount: netBrlValue,
        finalAmount: netBrlValue
      };

      // Client Notification
      await supabase.functions.invoke("send-payment-confirmation-email", { body: commonData });

      // Admin Notification
      await supabase.functions.invoke("send-admin-payment-notification", {
        body: { ...commonData, is_test: (mainOrder as any).is_test } // mainOrder might have been updated with is_test
      });

      // Seller & HoS Notification
      if (mainOrder.seller_id) {
        const { data: seller } = await supabase
          .from('sellers')
          .select('*')
          .eq('seller_id_public', mainOrder.seller_id)
          .maybeSingle();

        if (seller) {
          // Seller Notification
          await supabase.functions.invoke("send-seller-payment-notification", {
            body: { ...netNotificationData, sellerEmail: seller.email, sellerName: seller.full_name }
          });

          // HoS Notification
          if (seller.role === 'head_of_sales') {
            await supabase.functions.invoke("send-hos-payment-notification", {
              body: { ...netNotificationData, hosEmail: seller.email, hosName: seller.full_name, type: 'own_sale' }
            });
          } else if (seller.head_of_sales_id) {
            const { data: hos } = await supabase
              .from('sellers')
              .select('*')
              .eq('id', seller.head_of_sales_id)
              .maybeSingle();

            if (hos) {
              await supabase.functions.invoke("send-hos-payment-notification", {
                body: { ...netNotificationData, hosEmail: hos.email, hosName: hos.full_name, sellerName: seller.full_name, type: 'team_sale' }
              });
            }
          }
        }
      }
    } catch (e) {
      console.error("[Parcelow Webhook] ⚠️ Error sending notifications:", e);
    }
  } else {
    await supabase.from("visa_orders").update(updateData).eq("parcelow_order_id", parcelowOrder.id.toString());
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const event = await req.json();
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await processParcelowWebhookEvent(event, supabase);
    return new Response(JSON.stringify({ received: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
