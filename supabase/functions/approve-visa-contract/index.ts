// Supabase Edge Function to approve a visa contract
// Updates contract_approval_status to 'approved' and records who approved it
// Also generates a view token and sends an email to the client

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
        filename: `Contract_${order.order_number}_${order.client_name.replace(/\s+/g, '_')}.pdf`,
        path: contract.path,
        bucket: contract.bucket
      });
    }

    // 2. Add ANNEX I if it exists
    const annex = getBucketAndPath(order.annex_pdf_url);
    if (annex) {
      attachments.push({
        filename: `Annex_${order.order_number}_${order.client_name.replace(/\s+/g, '_')}.pdf`,
        path: annex.path,
        bucket: annex.bucket
      });
    }

    // 3. Add Invoice if it exists in payment_metadata
    const invoiceUrl = order.payment_metadata?.invoice_pdf_url;
    const invoice = getBucketAndPath(invoiceUrl);
    if (invoice) {
      attachments.push({
        filename: `Invoice_${order.order_number}_${order.client_name.replace(/\s+/g, '_')}.pdf`,
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

async function sendClientWebhook(order: any, supabase: any) {
  const webhookUrl = Deno.env.get('CLIENT_WEBHOOK_URL');
  if (!webhookUrl) {
    console.error('[Webhook Client] CLIENT_WEBHOOK_URL not set');
    return;
  }

  try {
    const { data: product } = await supabase
      .from('visa_products')
      .select('name')
      .eq('slug', order.product_slug)
      .single();

    const serviceName = normalizeServiceName(order.product_slug, product?.name || order.product_slug);

    let basePrice = 0;
    if (order.calculation_type === 'units_only') {
      basePrice = parseFloat(order.extra_unit_price_usd || '0');
    } else {
      basePrice = parseFloat(order.base_price_usd || '0');
    }

    const payload = {
      servico: serviceName,
      plano_servico: order.product_slug,
      nome_completo: order.client_name,
      whatsapp: order.client_whatsapp || '',
      email: order.client_email,
      valor_servico: basePrice.toFixed(2),
      vendedor: order.seller_id || '',
      quantidade_dependentes: Array.isArray(order.dependent_names) ? order.dependent_names.length : 0,
    };

    console.log('[Webhook Client] Sending payload to n8n:', JSON.stringify(payload));

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    // Send dependents separately if any
    if (Array.isArray(order.dependent_names) && order.dependent_names.length > 0) {
      const unitPrice = parseFloat(order.extra_unit_price_usd || '0');
      for (const depName of order.dependent_names) {
        if (!depName) continue;
        const depPayload = {
          nome_completo_cliente_principal: order.client_name,
          nome_completo_dependente: depName,
          valor_servico: unitPrice.toFixed(2),
        };
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(depPayload),
        });
      }
    }
    console.log('[Webhook Client] All webhooks sent successfully');
  } catch (error) {
    console.error('[Webhook Client] Error sending webhook:', error);
  }
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { order_id, reviewed_by, contract_type } = await req.json();

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

    // contract_type: 'annex' or 'contract' (defaults to 'contract' for backward compatibility)
    const approvalType = contract_type === 'annex' ? 'annex' : 'contract';

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
    } else {
      updateData.contract_approval_status = 'approved';
      updateData.contract_approval_reviewed_by = reviewed_by;
      updateData.contract_approval_reviewed_at = new Date().toISOString();
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

    console.log(`[EDGE FUNCTION] ${approvalType === 'annex' ? 'ANNEX I' : 'Contract'} approved successfully in DB`);

    // 3. Send Admin Notification Email with PDF Attachments
    // Run this in background to avoid blocking the response
    (async () => {
      try {
        // Fetch fresh order data to ensure we have the latest PDF paths
        const { data: freshOrder } = await supabase
          .from('visa_orders')
          .select('*')
          .eq('id', order_id)
          .single();

        if (freshOrder) {
          await sendVisaAdminNotification(freshOrder, supabase);
        }
      } catch (err) {
        console.error("[Admin Notification] Background execution error:", err);
      }
    })();

    // 4. Trigger n8n Webhook IF it's the main contract approval (Universal standard for all payment methods)
    if (approvalType === 'contract') {
      console.log(`[EDGE FUNCTION] Triggering n8n webhook for order: ${order.order_number} (Method: ${order.payment_method})`);
      const orderWithApproval = { ...order, ...updateData };
      // Fire and forget (don't block the response)
      sendClientWebhook(orderWithApproval, supabase).catch(err =>
        console.error("[EDGE FUNCTION] Non-critical webhook error:", err)
      );
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
        const documentName = approvalType === 'annex' ? 'ANNEX I (Statement of Responsibility)' : 'Main Service Contract';

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

        await supabase.functions.invoke('send-email', {
          body: {
            to: order.client_email,
            subject: `Document Approved: ${documentName} - Order #${order.order_number}`,
            html: emailHtml,
          },
        });
      }
    } catch (tokenEmailError) {
      console.error("[EDGE FUNCTION] Error with token/email (non-critical):", tokenEmailError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Contract approved and notification sent",
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
