// Supabase Edge Function to approve a visa contract
// Updates contract_approval_status to 'approved' and records who approved it
// Also generates a view token and sends an email to the client

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { appendServiceRequestEvent, transitionServiceRequestStage } from "../shared/service-request-operational.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CONTRACT_IDENTITY_DOC_TYPES = [
  "passport",
  "passport_back",
  "selfie_with_doc",
  "document_front",
  "document_back",
  "selfie_doc",
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper functions for n8n webhook
function normalizeServiceName(productSlug: string, productName: string): string {
  if (productSlug.startsWith('initial-')) return 'F1 Initial';
  if (productSlug.startsWith('cos-') || productSlug.startsWith('transfer-')) return 'COS & Transfer';
  return productName;
}

function getBucketAndPath(url: string | null) {
  if (!url) return null;
  const match = url.match(/\/storage\/v1\/object\/public\/([^\/]+)\/(.+)$/);
  if (!match) return null;
  return { bucket: match[1], path: match[2] };
}

async function sendVisaAdminNotification(order: any, supabase: any) {
  const adminEmail = "info@migmainc.com";
  console.log(`[Admin Notification] Preparing admin notification for order ${order.order_number}`);

  try {
    const attachments = [];

    // 1. Add Main Contract if it exists
    const contract = getBucketAndPath(order.contract_pdf_url);
    if (contract) {
      attachments.push({
        filename: `${order.client_name} - Contract - #${order.order_number}.pdf`,
        path: contract.path,
        bucket: contract.bucket
      });
    }

    // 2. Add ANNEX I if it exists
    const annex = getBucketAndPath(order.annex_pdf_url);
    if (annex) {
      attachments.push({
        filename: `${order.client_name} - ANNEX I - #${order.order_number}.pdf`,
        path: annex.path,
        bucket: annex.bucket
      });
    }

    // 3. Add Upsell Contract if it exists
    const upsellContract = getBucketAndPath(order.upsell_contract_pdf_url);
    if (upsellContract) {
      attachments.push({
        filename: `${order.client_name} - Upsell Contract - #${order.order_number}.pdf`,
        path: upsellContract.path,
        bucket: upsellContract.bucket
      });
    }

    // 4. Add Upsell ANNEX I if it exists
    const upsellAnnex = getBucketAndPath(order.upsell_annex_pdf_url);
    if (upsellAnnex) {
      attachments.push({
        filename: `${order.client_name} - Upsell ANNEX I - #${order.order_number}.pdf`,
        path: upsellAnnex.path,
        bucket: upsellAnnex.bucket
      });
    }

    // 3. Add Invoice if it exists in payment_metadata
    const invoiceUrl = order.payment_metadata?.invoice_pdf_url;
    const invoice = getBucketAndPath(invoiceUrl);
    if (invoice) {
      // Fetch product name for the filename
      let serviceNameForFile = "Service";
      try {
        const { data: productData } = await supabase
          .from('visa_products')
          .select('name')
          .eq('slug', order.product_slug)
          .single();
        if (productData?.name) serviceNameForFile = productData.name;
      } catch (e) {
        serviceNameForFile = order.product_slug;
      }

      attachments.push({
        filename: `INVOICE - ${order.client_name} - ${serviceNameForFile} - V2.pdf`,
        path: invoice.path,
        bucket: invoice.bucket
      });
    }

    if (attachments.length === 0) {
      console.log("[Admin Notification] No PDFs found to attach. Skipping admin email.");
      return;
    }

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', sans-serif; background-color: #000000; color: #ffffff;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #000000;">
          <tr>
            <td align="center" style="padding: 30px 20px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; background-color: #0a0a0a; border: 1px solid #CE9F48; border-radius: 12px; overflow: hidden;">
                <tr>
                  <td align="center" style="padding: 30px; background-color: #000000; border-bottom: 1px solid #1a1a1a;">
                    <img src="https://ekxftwrjvxtpnqbraszv.supabase.co/storage/v1/object/public/logo/logo2.png" alt="MIGMA Logo" width="150" style="display: block;">
                  </td>
                </tr>
                <tr>
                  <td style="padding: 40px;">
                    <h2 style="margin: 0 0 25px 0; font-size: 22px; color: #F3E196; text-align: center; text-transform: uppercase; letter-spacing: 2px;">
                      New Documentation Approved
                    </h2>
                    
                    <div style="background-color: #111111; border-radius: 8px; padding: 25px; border-left: 4px solid #CE9F48; margin-bottom: 30px;">
                      <p style="margin: 0 0 12px 0; font-size: 14px; color: #888; text-transform: uppercase;">Order Details</p>
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                        <tr>
                          <td width="40%" style="padding: 8px 0; color: #CE9F48; font-weight: 600;">Client:</td>
                          <td style="padding: 8px 0; color: #e0e0e0;">${order.client_name}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #CE9F48; font-weight: 600;">Order:</td>
                          <td style="padding: 8px 0; color: #e0e0e0;">#${order.order_number}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #CE9F48; font-weight: 600;">Email:</td>
                          <td style="padding: 8px 0; color: #e0e0e0;">${order.client_email}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #CE9F48; font-weight: 600;">Payment:</td>
                          <td style="padding: 8px 0; color: #e0e0e0; text-transform: uppercase; font-size: 12px;">${order.payment_method}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #CE9F48; font-weight: 600;">Date:</td>
                          <td style="padding: 8px 0; color: #e0e0e0;">${new Date().toUTCString()}</td>
                        </tr>
                      </table>
                    </div>

                    <p style="font-size: 15px; line-height: 1.6; color: #cccccc; margin: 0 0 20px 0; text-align: center;">
                      The signed documents (Contract, Annex, and Invoice) are attached to this notification for administrative recording.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding: 20px; background-color: #000000; border-top: 1px solid #1a1a1a;">
                    <p style="margin: 0; font-size: 10px; color: #555; text-transform: uppercase; letter-spacing: 1px;">
                      © 2026 MIGMA GLOBAL • Internal Notification
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const { data: emailData, error: emailError } = await supabase.functions.invoke('send-email-with-attachment', {
      body: {
        to: adminEmail,
        subject: `[CONTRACT APPROVED] ${order.client_name} - Order #${order.order_number}`,
        html: emailHtml,
        attachments: attachments
      },
    });

    if (emailError || (emailData && emailData.error)) {
      console.error("[Admin Notification] Error invoking send-email-with-attachment:", emailError || emailData.error);
    } else {
      console.log("[Admin Notification] Admin email sent successfully with attachments:", attachments.length);

      // Update the flag in the database
      const { error: updateFlagError } = await supabase
        .from('visa_orders')
        .update({
          admin_email_sent: true,
          admin_email_sent_at: new Date().toISOString()
        })
        .eq('id', order.id);

      if (updateFlagError) {
        console.warn("[Admin Notification] Error updating admin_email_sent flag:", updateFlagError);
      }
    }
  } catch (error) {
    console.error("[Admin Notification] Unexpected error:", error);
  }
}

async function approveContractIdentityDocuments(supabase: any, userId: string | null | undefined) {
  if (!userId) return;

  const { error } = await supabase
    .from('student_documents')
    .update({
      status: 'approved',
      rejection_reason: null,
    })
    .eq('user_id', userId)
    .in('type', CONTRACT_IDENTITY_DOC_TYPES);

  if (error) {
    console.error('[EDGE FUNCTION] Failed to approve contract identity documents:', error.message);
  }
}

function isWebhookApprovalSatisfied(order: any, approvalType: string, isAnnexOnlyProduct: boolean): boolean {
  if (approvalType === 'contract') {
    return order.contract_approval_status === 'approved';
  }

  if (approvalType === 'upsell_contract') {
    return order.upsell_contract_approval_status === 'approved';
  }

  if (approvalType === 'annex' && isAnnexOnlyProduct) {
    return order.annex_approval_status === 'approved';
  }

  return false;
}

type ClientWebhookPayload = Record<string, string | number | boolean>;

type WebhookPayloadEnvelope = {
  kind: 'main' | 'dependent';
  dependentName?: string;
  body: ClientWebhookPayload;
};

type WebhookDispatchResult = {
  sent: boolean;
  webhookUrls: string[];
  payloadCount: number;
  reason: string | null;
  payloadPreview: WebhookPayloadEnvelope[];
  responses: Array<{
    webhookUrl: string;
    kind: 'main' | 'dependent';
    dependentName?: string;
    status: number;
    ok: boolean;
    bodyPreview: string | null;
  }>;
};

function previewResponseBody(responseText: string): string | null {
  if (!responseText) return null;
  return responseText.length > 500 ? `${responseText.slice(0, 500)}...` : responseText;
}

async function sendClientWebhook(order: any, supabase: any, isUpsell: boolean = false) {
  const approveUrl = Deno.env.get('CLIENT_WEBHOOK_URL_APPROVE');
  const legacyUrl = Deno.env.get('CLIENT_WEBHOOK_URL');
  const testUrl = "https://nwh.suaiden.com/webhook/45665dbc-8751-41ff-afb8-6d17dd61d204";

  const isTestUser =
    (order.client_name && (
      order.client_name.toLowerCase().includes("paulo victor") ||
      order.client_name.toLowerCase().includes("paulo víctor") ||
      order.client_name.toLowerCase().includes("john doe dev")
    )) ||
    (order.client_email && (
      order.client_email.includes("@uorak") ||
      order.client_email.toLowerCase() === "victtinho.ribeiro@gmail.com" ||
      order.client_email.toLowerCase() === "victuribdev@gmail.com" ||
      order.client_email.toLowerCase() === "nemerfrancisco@gmail.com"
    ));

  const webhookUrls = isTestUser
    ? Array.from(new Set([testUrl, approveUrl, legacyUrl].filter((value): value is string => Boolean(value))))
    : Array.from(new Set([legacyUrl].filter((value): value is string => Boolean(value))));

  if (isTestUser) {
    console.log(`[Webhook Client] 🧪 TEST USER DETECTED: Routing to test n8n...`);
  }

  if (webhookUrls.length === 0) {
    console.error('[Webhook Client] Webhook URL not set');
    return {
      sent: false,
      webhookUrls: [],
      payloadCount: 0,
      reason: 'webhook_url_not_set',
      payloadPreview: [],
      responses: [],
    };
  }

  const invalidWebhookUrl = webhookUrls.find((url) => {
    try {
      new URL(url);
      return false;
    } catch (_error) {
      return true;
    }
  });
  if (invalidWebhookUrl) {
    console.error('[Webhook Client] Invalid webhook URL');
    return {
      sent: false,
      webhookUrls,
      payloadCount: 0,
      reason: 'invalid_webhook_url',
      payloadPreview: [],
      responses: [],
    };
  }

  try {
    const productSlug = isUpsell && order.upsell_product_slug ? order.upsell_product_slug : order.product_slug;

    // Fetch product pricing details
    const { data: product } = await supabase
      .from('visa_products')
      .select('id, name, base_price_usd, price_per_dependent_usd')
      .eq('slug', productSlug)
      .single();

    const serviceName = normalizeServiceName(productSlug, product?.name || productSlug);

    // Calculate Correct Base Price for Main Applicant
    let basePrice = 0;
    if (isUpsell) {
      // For Upsell, we use the product's base price if available, otherwise fallback
      basePrice = product?.base_price_usd ? parseFloat(String(product.base_price_usd)) : 0;
    } else if (order.calculation_type === 'units_only') {
      basePrice = parseFloat(order.extra_unit_price_usd || '0');
    } else {
      basePrice = parseFloat(order.base_price_usd || '0');
    }

    // Calculate Correct Unit Price for Dependents
    let unitPrice = 0;
    if (isUpsell) {
      unitPrice = product?.price_per_dependent_usd ? parseFloat(String(product.price_per_dependent_usd)) : 0;
    } else {
      try {
        const rawPrice = order.extra_unit_price_usd;
        if (typeof rawPrice === 'number') unitPrice = rawPrice;
        else if (typeof rawPrice === 'string') unitPrice = parseFloat(rawPrice);

        if (unitPrice === 0 && order.extra_units > 0 && !isUpsell) {
          const base = parseFloat(String(order.base_price_usd || '0'));
          const total = parseFloat(String(order.total_price_usd || '0'));
          if (total > base) unitPrice = (total - base) / order.extra_units;
        }
      } catch (e) {
        console.error('[Webhook Client] Error parsing main unit price:', e);
      }
    }

    const mainPayload: ClientWebhookPayload = {
      order_id: order.id,
      service_request_id: order.service_request_id || '',
      visa_produt_id: product?.id || '',
      servico: serviceName,
      plano_servico: productSlug,
      nome_completo_cliente_principal: order.client_name,
      whatsapp: order.client_whatsapp || '',
      email: order.client_email,
      valor_servico: basePrice.toFixed(2),
      vendedor: order.seller_id || '',
      quantidade_dependentes: Array.isArray(order.dependent_names) ? order.dependent_names.length : 0,
    };

    // Only include is_upsell if it's true
    if (isUpsell) mainPayload.is_upsell = true;

    const payloads: WebhookPayloadEnvelope[] = [
      {
        kind: 'main',
        body: mainPayload,
      },
    ];

    if (Array.isArray(order.dependent_names) && order.dependent_names.length > 0) {
      for (const depName of order.dependent_names) {
        if (!depName) continue;
        const depPayload: ClientWebhookPayload = {
          order_id: order.id,
          service_request_id: order.service_request_id || '',
          visa_produt_id: product?.id || '',
          tipo: "dependente",
          nome_completo_cliente_principal: order.client_name,
          nome_completo_dependente: depName,
          valor_servico: unitPrice.toFixed(2),
          servico: serviceName,
          plano_servico: productSlug,
          email: order.client_email,
          whatsapp: order.client_whatsapp || '',
          vendedor: order.seller_id || '',
        };

        if (isUpsell) depPayload.is_upsell = true;

        payloads.push({
          kind: 'dependent',
          dependentName: depName,
          body: depPayload,
        });
      }
    }

    const responses: WebhookDispatchResult["responses"] = [];

    for (const webhookUrl of webhookUrls) {
      for (const payload of payloads) {
        console.log(`[Webhook Client] Sending ${payload.kind.toUpperCase()} payload to n8n (${webhookUrl}):`, JSON.stringify(payload.body));

        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload.body),
        });

        const responseText = await response.text();
        responses.push({
          webhookUrl,
          kind: payload.kind,
          dependentName: payload.dependentName,
          status: response.status,
          ok: response.ok,
          bodyPreview: previewResponseBody(responseText),
        });

        if (!response.ok) {
          throw new Error(`n8n webhook failed for ${payload.kind} at ${webhookUrl}: ${response.status} ${response.statusText} - ${previewResponseBody(responseText) || 'empty response'}`);
        }
      }
    }

    console.log('[Webhook Client] All webhooks sent successfully');
    return {
      sent: true,
      webhookUrls,
      payloadCount: payloads.length,
      reason: null,
      payloadPreview: payloads,
      responses,
    };
  } catch (error) {
    console.error('[Webhook Client] Error sending webhook:', error);
    throw error;
  }
}

function scheduleBackgroundTask(task: Promise<unknown>) {
  const edgeRuntime = (globalThis as typeof globalThis & {
    EdgeRuntime?: { waitUntil?: (promise: Promise<unknown>) => void };
  }).EdgeRuntime;

  if (edgeRuntime?.waitUntil) {
    edgeRuntime.waitUntil(task);
    return;
  }

  void task.catch((error) => {
    console.error("[EDGE FUNCTION] Background task failed:", error);
  });
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { order_id, reviewed_by, contract_type, admin_ip } = await req.json();

    if (!order_id) {
      return new Response(
        JSON.stringify({ success: false, error: "order_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!reviewed_by) {
      return new Response(
        JSON.stringify({ success: false, error: "reviewed_by is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // contract_type: 'annex', 'contract', 'upsell_contract', or 'upsell_annex'
    const approvalType = contract_type || 'contract';
    const adminIp = admin_ip
      ?? req.headers.get("cf-connecting-ip")
      ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? req.headers.get("x-real-ip")
      ?? null;

    console.log(`[EDGE FUNCTION] Approving ${approvalType} for order:`, order_id);

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Fetch order data with all fields needed for webhook
    const { data: order, error: fetchError } = await supabase
      .from('visa_orders')
      .select('*')
      .eq('id', order_id)
      .single();

    if (fetchError || !order) {
      console.error("[EDGE FUNCTION] Error fetching order:", fetchError);
      return new Response(
        JSON.stringify({ success: false, error: "Order not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Update order with approval status based on contract type
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (approvalType === 'annex') {
      updateData.annex_approval_status = 'approved';
      updateData.annex_approval_reviewed_by = reviewed_by;
      updateData.annex_approval_reviewed_at = new Date().toISOString();
      if (adminIp) updateData.annex_approval_admin_ip = adminIp;
    } else if (approvalType === 'upsell_contract') {
      updateData.upsell_contract_approval_status = 'approved';
      updateData.upsell_contract_approval_reviewed_by = reviewed_by;
      updateData.upsell_contract_approval_reviewed_at = new Date().toISOString();
      if (adminIp) updateData.upsell_contract_approval_admin_ip = adminIp;
    } else if (approvalType === 'upsell_annex') {
      updateData.upsell_annex_approval_status = 'approved';
      updateData.upsell_annex_approval_reviewed_by = reviewed_by;
      updateData.upsell_annex_approval_reviewed_at = new Date().toISOString();
      if (adminIp) updateData.upsell_annex_approval_admin_ip = adminIp;
    } else {
      // Default to main contract
      updateData.contract_approval_status = 'approved';
      updateData.contract_approval_reviewed_by = reviewed_by;
      updateData.contract_approval_reviewed_at = new Date().toISOString();
      if (adminIp) updateData.contract_approval_admin_ip = adminIp;
    }

    const { error: updateError } = await supabase
      .from('visa_orders')
      .update(updateData)
      .eq('id', order_id);

    if (updateError) {
      console.error("[EDGE FUNCTION] Error approving contract:", updateError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to approve contract" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[EDGE FUNCTION] ${approvalType} approved successfully in DB`);

    if (approvalType === 'contract') {
      try {
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('id, user_id')
          .eq('email', order.client_email)
          .maybeSingle();

        if (profileError || !profile?.id) {
          console.warn(`[EDGE FUNCTION] migma-notify contract_approved skipped: profile not found for ${order.client_email}`);
        } else {
          await supabase
            .from('user_profiles')
            .update({
              onboarding_current_step: 'scholarship_selection',
              updated_at: new Date().toISOString(),
            })
            .eq('id', profile.id);

          await approveContractIdentityDocuments(supabase, profile.user_id);

          const notifyRes = await fetch(`${supabaseUrl}/functions/v1/migma-notify`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'apikey': supabaseServiceKey,
            },
            body: JSON.stringify({
              trigger: 'contract_approved',
              user_id: profile.id,
              channels: {
                email: false,
                whatsapp: true,
              },
              data: {
                app_url: 'https://migmainc.com/student/onboarding?step=scholarship_selection',
                order_id: order.id,
                order_number: order.order_number,
                reviewed_by,
                admin_ip: adminIp,
              },
            }),
          });

          if (!notifyRes.ok) {
            console.error('[EDGE FUNCTION] migma-notify contract_approved failed:', notifyRes.status);
          } else {
            console.log('[EDGE FUNCTION] ✅ migma-notify contract_approved dispatched for profile', profile.id);
          }
        }
      } catch (notifyErr) {
        console.error('[EDGE FUNCTION] migma-notify contract_approved error:', notifyErr);
      }
    }

    // --- Operational stage: persist contract_approved event + transition stage ---
    if (order.service_request_id) {
      try {
        const { data: sr, error: srFetchError } = await supabase
          .from('service_requests')
          .select('id, service_id, service_type, workflow_stage, stage_entered_at, case_status, status_i20, status_sevis, transfer_form_status, updated_at, created_at')
          .eq('id', order.service_request_id)
          .single();

        if (!srFetchError && sr) {
          await appendServiceRequestEvent(
            supabase,
            sr.id,
            'contract_approved',
            'user',
            {
              approval_type: approvalType,
              order_id: order.id,
              order_number: order.order_number,
              reviewed_by,
            },
          );

          // Transition to document_review for main contract approvals when
          // the case is still in its initial stage. Annex-only products
          // (scholarship / i20-control) also count as a main approval gate.
          const isAnnexOnly = order.product_slug?.endsWith('-scholarship') || order.product_slug?.endsWith('-i20-control');
          const isMainApproval = approvalType === 'contract' || (approvalType === 'annex' && isAnnexOnly);
          const currentStage = sr.workflow_stage;
          const eligibleForTransition = !currentStage || currentStage === 'case_created' || currentStage === 'awaiting_client_data';

          if (isMainApproval && eligibleForTransition) {
            await transitionServiceRequestStage(
              supabase,
              sr,
              'document_review',
              'user',
              'contract_approved',
              { approval_type: approvalType, order_id: order.id },
            );
          } else {
            // For non-transitioning approvals, still bump updated_at so the
            // CRM hub reflects the latest activity.
            await supabase
              .from('service_requests')
              .update({ updated_at: new Date().toISOString() })
              .eq('id', sr.id);
          }
        }
      } catch (opErr) {
        // Non-critical: operational audit must not block the contract approval flow.
        console.error('[EDGE FUNCTION] Non-critical: operational stage update failed after contract approval', opErr);
      }
    }
    // --- End operational stage block ---

    scheduleBackgroundTask((async () => {
      let freshOrder: any = null;

      try {
        const { data } = await supabase
          .from('visa_orders')
          .select('*')
          .eq('id', order_id)
          .single();

        freshOrder = data;
      } catch (err) {
        console.error("[EDGE FUNCTION] Error refetching order after approval:", err);
      }

      // 3. Send Admin Notification Email with PDF Attachments
      try {
        if (freshOrder) {
          await sendVisaAdminNotification(freshOrder, supabase);
        }
      } catch (err) {
        console.error("[Admin Notification] Execution error:", err);
      }

      // 4. Trigger n8n Webhook
      // Trigger IF:
      // a) It's a main contract or upsell contract approval (normal flow)
      // b) It's an annex approval AND the product is scholarship/i20-control (annex-only products)
      const isAnnexOnlyProduct = order.product_slug?.endsWith('-scholarship') || order.product_slug?.endsWith('-i20-control');
      const shouldTriggerWebhook = 
          approvalType === 'contract' || 
          approvalType === 'upsell_contract' ||
          (approvalType === 'annex' && isAnnexOnlyProduct);

      if (shouldTriggerWebhook) {
        const isUpsell = approvalType === 'upsell_contract';
        const orderForWebhook = freshOrder || { ...order, ...updateData };
        const approvalSatisfied = isWebhookApprovalSatisfied(orderForWebhook, approvalType, isAnnexOnlyProduct);
        const approvalEventKey = `order:${orderForWebhook.id}:approval:${approvalType}`;

        if (!approvalSatisfied) {
          console.warn(`[EDGE FUNCTION] Skipping n8n webhook because approval is not fully persisted for order ${order.order_number} (${approvalType})`);
          if (orderForWebhook.service_request_id) {
            await appendServiceRequestEvent(
              supabase,
              orderForWebhook.service_request_id,
              'n8n_webhook_skipped',
              'system',
              {
                reason: 'approval_not_persisted',
                approval_type: approvalType,
                order_id: orderForWebhook.id,
                order_number: orderForWebhook.order_number,
              },
              { eventKey: approvalEventKey },
            );
          }
        } else {
          console.log(`[EDGE FUNCTION] Triggering n8n webhook for order: ${orderForWebhook.order_number} (Type: ${approvalType}, Product: ${orderForWebhook.product_slug})`);

          if (orderForWebhook.service_request_id) {
            await appendServiceRequestEvent(
              supabase,
              orderForWebhook.service_request_id,
              'n8n_webhook_dispatch_requested',
              'system',
              {
                approval_type: approvalType,
                order_id: orderForWebhook.id,
                order_number: orderForWebhook.order_number,
                is_upsell: isUpsell,
              },
              { eventKey: approvalEventKey },
            );
          }
        
          try {
            const dispatchResult = await sendClientWebhook(orderForWebhook, supabase, isUpsell);

            if (!dispatchResult.sent) {
              if (orderForWebhook.service_request_id) {
                await appendServiceRequestEvent(
                  supabase,
                  orderForWebhook.service_request_id,
                  'n8n_webhook_skipped',
                  'system',
                  {
                    reason: dispatchResult.reason || 'dispatch_not_sent',
                    approval_type: approvalType,
                    order_id: orderForWebhook.id,
                    order_number: orderForWebhook.order_number,
                    webhook_urls: dispatchResult.webhookUrls,
                  },
                  { eventKey: approvalEventKey },
                );
              }

              return;
            }

            if (orderForWebhook.service_request_id) {
              await appendServiceRequestEvent(
                supabase,
                orderForWebhook.service_request_id,
                'n8n_webhook_dispatched',
                'system',
                {
                  approval_type: approvalType,
                  order_id: orderForWebhook.id,
                  order_number: orderForWebhook.order_number,
                  is_upsell: isUpsell,
                  webhook_urls: dispatchResult.webhookUrls,
                  payload_count: dispatchResult.payloadCount,
                  payload_preview: dispatchResult.payloadPreview,
                  delivery_responses: dispatchResult.responses,
                },
                { eventKey: approvalEventKey },
              );
            }
          } catch (err) {
            console.error("[EDGE FUNCTION] Non-critical webhook error:", err);

            if (orderForWebhook.service_request_id) {
              await appendServiceRequestEvent(
                supabase,
                orderForWebhook.service_request_id,
                'n8n_webhook_failed',
                'system',
                {
                  approval_type: approvalType,
                  order_id: orderForWebhook.id,
                  order_number: orderForWebhook.order_number,
                  error: err instanceof Error ? err.message : String(err),
                },
                { eventKey: approvalEventKey },
              );
            }
          }
        }
      }

      // 5. Manage View Token and Send Email
      try {
        // Check if view token already exists
        const { data: existingToken } = await supabase
          .from('visa_contract_view_tokens')
          .select('id, token, expires_at')
          .eq('order_id', order_id)
          .single();

        let viewToken: string | null = null;

        if (existingToken) {
          if (existingToken.expires_at === null) {
            viewToken = existingToken.token;
          } else {
            const expiresAt = new Date(existingToken.expires_at);
            const now = new Date();
            if (now < expiresAt) {
              viewToken = existingToken.token;
            } else {
              await supabase.from('visa_contract_view_tokens').delete().eq('id', existingToken.id);
            }
          }
        }

        if (!viewToken) {
          const token = `visa_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
          const { error: tokenError } = await supabase
            .from('visa_contract_view_tokens')
            .insert({
              order_id: order_id,
              token: token,
              expires_at: null,
            });

          if (!tokenError) {
            viewToken = token;
          }
        }

        if (viewToken && order.client_email) {
          const appUrl = "https://migmainc.com";
          const viewUrl = `${appUrl}/view-visa-contract?token=${viewToken}`;

          let documentName = 'Document';
          if (approvalType === 'annex') {
            documentName = 'ANNEX I (Statement of Responsibility)';
          } else if (approvalType === 'contract') {
            documentName = 'Main Service Contract';
          } else if (approvalType === 'upsell_contract') {
            documentName = `Premium Service Contract (${order.upsell_product_slug || 'Upsell'})`;
          } else if (approvalType === 'upsell_annex') {
            documentName = `Premium ANNEX I (${order.upsell_product_slug || 'Upsell'})`;
          }

          const emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
          </head>
          <body style="margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #000000;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #000000;">
                <tr>
                    <td align="center" style="padding: 40px 20px;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; background-color: #000000; border-radius: 8px;">
                            <tr>
                                <td align="center" style="padding: 40px 20px 30px; background-color: #000000;">
                                    <img src="https://ekxftwrjvxtpnqbraszv.supabase.co/storage/v1/object/public/logo/logo2.png" alt="MIGMA Logo" width="180" style="display: block; max-width: 180px; height: auto;">
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 0 40px 40px; background-color: #000000;">
                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                        <tr>
                                            <td style="padding: 35px; background: linear-gradient(135deg, #1a1a1a 0%, #000000 100%); border-radius: 12px; border: 1px solid #CE9F48;">
                                                <h1 style="margin: 0 0 20px 0; font-size: 24px; font-weight: bold; color: #F3E196; text-align: center;">
                                                    ${documentName} Approved
                                                </h1>
                                                <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                                    Dear ${order.client_name},
                                                </p>
                                                <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                                    Your <strong style="color: #CE9F48;">${documentName}</strong> for order <strong style="white-space: nowrap;">#${order.order_number}</strong> has been reviewed and <strong style="color: #F3E196;">approved</strong> by our team.
                                                </p>
                                                <p style="margin: 0 0 30px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                                    You can now access your signed documentation through our secure portal at any time.
                                                </p>
                                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                    <tr>
                                                        <td align="center" style="padding: 0 0 30px;">
                                                            <a href="${viewUrl}" style="display: inline-block; padding: 16px 45px; background: linear-gradient(180deg, #F3E196 0%, #CE9F48 50%, #F3E196 100%); color: #000000; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 15px rgba(206, 159, 72, 0.3);">
                                                                Access Your Documents
                                                            </a>
                                                        </td>
                                                    </tr>
                                                </table>
                                                <p style="text-align: center; margin: 0 0 30px 0; font-size: 13px; color: #888888;">
                                                    This link is permanent and does not expire.<br>
                                                    <span style="word-break: break-all; color: #CE9F48; font-size: 11px; opacity: 0.8;">${viewUrl}</span>
                                                </p>
                                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                    <tr>
                                                        <td style="padding: 15px; background-color: #0a0a0a; border-left: 3px solid #CE9F48; border-radius: 4px;">
                                                            <p style="margin: 0; color: #F3E196; font-size: 13px; line-height: 1.5;">
                                                                <strong style="color: #CE9F48;">Security Note:</strong> These documents are encrypted and protected. Access is exclusive to you.
                                                            </p>
                                                        </td>
                                                    </tr>
                                                </table>
                                                <p style="margin: 35px 0 0 0; font-size: 15px; line-height: 1.6; color: #e0e0e0; text-align: center;">
                                                    Thank you for choosing MIGMA.<br>
                                                    <strong style="color: #CE9F48;">MIGMA Global Team</strong>
                                                </p>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                            <tr>
                                <td align="center" style="padding: 20px 40px; background-color: #000000;">
                                    <p style="margin: 0; font-size: 11px; color: #555555; text-transform: uppercase; letter-spacing: 1px;">
                                        © 2026 MIGMA. All rights reserved.
                                    </p>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
          </body>
          </html>
        `;

          const emailRes = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'apikey': supabaseServiceKey,
            },
            body: JSON.stringify({
              to: order.client_email,
              subject: `Document Approved: ${documentName} - Order #${order.order_number}`,
              html: emailHtml,
            }),
          });

          const emailBody = await emailRes.text();
          if (!emailRes.ok) {
            console.error("[EDGE FUNCTION] Contract approval client email failed:", emailRes.status, emailBody);
          } else {
            console.log("[EDGE FUNCTION] Contract approval client email sent:", order.client_email);
          }
        }
      } catch (tokenEmailError) {
        console.error("[EDGE FUNCTION] Error with token/email (non-critical):", tokenEmailError);
      }
    })());

    return new Response(
      JSON.stringify({
        success: true,
        message: "Contract approved successfully",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[EDGE FUNCTION] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
