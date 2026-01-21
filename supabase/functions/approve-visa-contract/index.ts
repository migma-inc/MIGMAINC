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

    // 1. Update order with approval status based on contract type
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

    const { data: order, error: fetchError } = await supabase
      .from('visa_orders')
      .select('id, order_number, client_name, client_email, product_slug')
      .eq('id', order_id)
      .single();

    if (fetchError || !order) {
      console.error("[EDGE FUNCTION] Error fetching order:", fetchError);
      return new Response(
        JSON.stringify({ success: false, error: "Order not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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

    // 2. Manage View Token and Send Email (similar to partner flow)
    try {
      // Check if view token already exists
      const { data: existingToken } = await supabase
        .from('visa_contract_view_tokens')
        .select('id, token, expires_at')
        .eq('order_id', order_id)
        .single();

      let viewToken: string | null = null;

      if (existingToken) {
        // If expires_at is NULL, token is infinite
        if (existingToken.expires_at === null) {
          viewToken = existingToken.token;
          console.log("[EDGE FUNCTION] Using existing infinite view token");
        } else {
          // Check validity
          const expiresAt = new Date(existingToken.expires_at);
          const now = new Date();
          if (now < expiresAt) {
            viewToken = existingToken.token;
          } else {
            // Expired, generate new infinite one
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
            expires_at: null, // Infinite
          });

        if (!tokenError) {
          viewToken = token;
          console.log("[EDGE FUNCTION] Generated new infinite view token");
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
