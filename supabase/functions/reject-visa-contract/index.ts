// Supabase Edge Function to reject a visa contract
// Generates a resubmission token, sends email, and updates contract status

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { order_id, rejection_reason, reviewed_by, app_url, contract_type } = await req.json();

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

    console.log("[EDGE FUNCTION] Rejecting visa contract for order:", order_id);

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Fetch order to get client email
    const { data: order, error: orderError } = await supabase
      .from('visa_orders')
      .select('id, client_email, client_name, order_number')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      console.error("[EDGE FUNCTION] Error fetching order:", orderError);
      return new Response(
        JSON.stringify({ success: false, error: "Order not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate unique token
    const timestamp = Date.now();
    const random1 = Math.random().toString(36).substring(2, 15);
    const random2 = Math.random().toString(36).substring(2, 15);
    const token = `visa_reject_${timestamp}_${random1}_${random2}`;

    // Calculate expiration (30 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Create resubmission token
    const { error: tokenError } = await supabase
      .from('visa_contract_resubmission_tokens')
      .insert({
        order_id: order_id,
        token: token,
        expires_at: expiresAt.toISOString(),
        created_by: reviewed_by,
      });

    if (tokenError) {
      console.error("[EDGE FUNCTION] Error creating token:", tokenError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to create resubmission token" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // contract_type: 'annex' or 'contract' (defaults to 'contract' for backward compatibility)
    const approvalType = contract_type === 'annex' ? 'annex' : 'contract';
    
    // Update order with rejection status based on contract type
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (approvalType === 'annex') {
      updateData.annex_approval_status = 'rejected';
      updateData.annex_approval_reviewed_by = reviewed_by;
      updateData.annex_approval_reviewed_at = new Date().toISOString();
      if (rejection_reason) {
        updateData.annex_rejection_reason = rejection_reason;
      }
    } else {
      updateData.contract_approval_status = 'rejected';
      updateData.contract_approval_reviewed_by = reviewed_by;
      updateData.contract_approval_reviewed_at = new Date().toISOString();
      if (rejection_reason) {
        updateData.contract_rejection_reason = rejection_reason;
      }
    }

    const { error: updateError } = await supabase
      .from('visa_orders')
      .update(updateData)
      .eq('id', order_id);

    if (updateError) {
      console.error("[EDGE FUNCTION] Error updating order:", updateError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to update order status" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get base URL for email link
    // Priority: 1. app_url from request (frontend sends current origin), 2. APP_URL env var, 3. fallback
    // Sempre usa migmainc.com
    const baseUrl = "https://migmainc.com";
    const resubmitUrl = `${baseUrl}/checkout/visa/resubmit?token=${token}`;
    
    console.log("[EDGE FUNCTION] Using base URL:", baseUrl);

    // Send rejection email via send-email function
    const { error: emailError } = await supabase.functions.invoke('send-email', {
      body: {
        to: order.client_email,
        subject: 'Action Required: Resubmit Your Visa Service Documents',
        html: `
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
                    <!-- Logo Header -->
                    <tr>
                      <td align="center" style="padding: 40px 20px 30px; background-color: #000000;">
                        <img src="https://ekxftwrjvxtpnqbraszv.supabase.co/storage/v1/object/public/logo/logo2.png" alt="MIGMA Logo" width="200" style="display: block; max-width: 200px; height: auto;">
                      </td>
                    </tr>
                    <!-- Main Content -->
                    <tr>
                      <td style="padding: 0 40px 40px; background-color: #000000;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                          <tr>
                            <td style="padding: 30px; background: linear-gradient(135deg, #1a1a1a 0%, #000000 100%); border-radius: 8px; border: 1px solid #CE9F48;">
                              <h1 style="margin: 0 0 20px 0; font-size: 28px; font-weight: bold; color: #F3E196; text-align: center; background: linear-gradient(180deg, #8E6E2F 0%, #F3E196 25%, #CE9F48 50%, #F3E196 75%, #8E6E2F 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                                Action Required: Resubmit Documents
                              </h1>
                              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                Dear ${order.client_name},
                              </p>
                              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                We have reviewed your visa service contract for order <strong style="color: #CE9F48;">${order.order_number}</strong> and need you to resubmit your identity documents.
                              </p>
                              ${rejection_reason ? `
                              <div style="padding: 15px; background-color: #1a1a1a; border-left: 4px solid #CE9F48; border-radius: 4px; margin: 20px 0;">
                                <p style="margin: 0; color: #F3E196; font-size: 14px; line-height: 1.6;">
                                  <strong style="color: #CE9F48;">Reason:</strong> ${rejection_reason}
                                </p>
                              </div>
                              ` : ''}
                              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                Please click the button below to access a secure page where you can:
                              </p>
                              <ol style="margin: 0 0 30px 0; padding-left: 20px; color: #e0e0e0; font-size: 16px; line-height: 1.8;">
                                <li style="margin-bottom: 10px;">Upload a clear photo of the front of your ID document</li>
                                <li style="margin-bottom: 10px;">Upload a clear photo of the back of your ID document</li>
                                <li style="margin-bottom: 10px;">Upload a selfie holding your ID document</li>
                                <li style="margin-bottom: 10px;">Accept the terms and conditions again</li>
                              </ol>
                              <!-- CTA Button -->
                              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                  <td align="center" style="padding: 0 0 30px;">
                                    <a href="${resubmitUrl}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(180deg, #F3E196 0%, #CE9F48 50%, #F3E196 100%); color: #000000; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 12px rgba(206, 159, 72, 0.4);">
                                      Resubmit Documents
                                    </a>
                                  </td>
                                </tr>
                              </table>
                              <p style="text-align: center; margin: 0 0 30px 0; font-size: 14px; color: #999999;">
                                Or copy and paste this link into your browser:<br>
                                <span style="word-break: break-all; color: #CE9F48; font-size: 12px;">${resubmitUrl}</span>
                              </p>
                              <!-- Info Box -->
                              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                  <td style="padding: 20px; background-color: #1a1a1a; border-left: 4px solid #CE9F48; border-radius: 4px; margin: 20px 0;">
                                    <p style="margin: 0; color: #F3E196; font-size: 14px; line-height: 1.6;">
                                      <strong style="color: #CE9F48;">Note:</strong> This link can be used once to resubmit your documents. Please complete the resubmission as soon as possible.
                                    </p>
                                  </td>
                                </tr>
                              </table>
                              <p style="margin: 30px 0 0 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                If you have any questions, please contact our support team.
                              </p>
                              <p style="margin: 20px 0 0 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                Best regards,<br>
                                <strong style="color: #CE9F48;">The MIGMA Team</strong>
                              </p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                      <td align="center" style="padding: 20px 40px; background-color: #000000;">
                        <p style="margin: 0 0 10px 0; font-size: 11px; color: #999999; line-height: 1.5; font-style: italic;">
                          This is an automated message. Please do not reply to this email.
                        </p>
                        <p style="margin: 0; font-size: 12px; color: #666666; line-height: 1.5;">
                          © 2025 MIGMA. All rights reserved.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `,
      },
    });

    if (emailError) {
      console.error("[EDGE FUNCTION] Error sending email:", emailError);
      // Still return success since token was created and order was updated
      // Email failure is not critical
    }

    console.log("[EDGE FUNCTION] Contract rejected successfully, token created and email sent");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Contract rejected successfully",
        token: token,
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



