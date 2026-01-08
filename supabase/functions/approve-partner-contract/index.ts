// Supabase Edge Function to approve a partner contract
// Updates verification_status to 'approved' and sets application status to 'active_partner'

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
    const { acceptance_id, reviewed_by } = await req.json();

    if (!acceptance_id) {
      return new Response(
        JSON.stringify({ success: false, error: "acceptance_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!reviewed_by) {
      return new Response(
        JSON.stringify({ success: false, error: "reviewed_by is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[EDGE FUNCTION] Approving partner contract for acceptance:", acceptance_id);

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Fetch acceptance to get application_id
    const { data: acceptance, error: acceptanceError } = await supabase
      .from('partner_terms_acceptances')
      .select('id, application_id, verification_status')
      .eq('id', acceptance_id)
      .single();

    if (acceptanceError || !acceptance) {
      console.error("[EDGE FUNCTION] Error fetching acceptance:", acceptanceError);
      return new Response(
        JSON.stringify({ success: false, error: "Contract acceptance not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!acceptance.application_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Application ID not found in acceptance" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update acceptance with approval status
    const { error: updateAcceptanceError } = await supabase
      .from('partner_terms_acceptances')
      .update({
        verification_status: 'approved',
        verification_reviewed_by: reviewed_by,
        verification_reviewed_at: new Date().toISOString(),
      })
      .eq('id', acceptance_id);

    if (updateAcceptanceError) {
      console.error("[EDGE FUNCTION] Error updating acceptance:", updateAcceptanceError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to approve contract" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update application status to 'active_partner'
    const { error: updateApplicationError } = await supabase
      .from('global_partner_applications')
      .update({
        status: 'active_partner',
        updated_at: new Date().toISOString(),
      })
      .eq('id', acceptance.application_id);

    if (updateApplicationError) {
      console.error("[EDGE FUNCTION] Error updating application status:", updateApplicationError);
      // Still return success since acceptance was updated
      console.warn("[EDGE FUNCTION] Acceptance approved but application status update failed");
    }

    // Gerar token de visualização e enviar email com link apenas após aprovação do admin
    try {
      // Buscar dados da aplicação para obter email e nome
      const { data: application, error: appError } = await supabase
        .from('global_partner_applications')
        .select('email, full_name')
        .eq('id', acceptance.application_id)
        .single();

      if (!appError && application?.email && application?.full_name) {
        // Verificar se já existe token de visualização
        const { data: existingToken } = await supabase
          .from('partner_contract_view_tokens')
          .select('id, token, expires_at')
          .eq('acceptance_id', acceptance_id)
          .single();

        let viewToken: string | null = null;

        if (existingToken) {
          // Verificar se o token ainda é válido
          const expiresAt = new Date(existingToken.expires_at);
          const now = new Date();
          if (now < expiresAt) {
            viewToken = existingToken.token;
            console.log("[EDGE FUNCTION] Using existing valid view token");
          } else {
            // Token expirado, deletar e gerar novo
            await supabase
              .from('partner_contract_view_tokens')
              .delete()
              .eq('id', existingToken.id);
            console.log("[EDGE FUNCTION] Existing token expired, generating new one");
          }
        }

        // Gerar novo token se não existe ou expirou
        if (!viewToken) {
          const token = `view_${Date.now()}_${Math.random().toString(36).substring(2, 15)}_${Math.random().toString(36).substring(2, 15)}`;
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 90); // 90 dias

          const { error: tokenError } = await supabase
            .from('partner_contract_view_tokens')
            .insert({
              acceptance_id: acceptance_id,
              token: token,
              expires_at: expiresAt.toISOString(),
            });

          if (tokenError) {
            console.error("[EDGE FUNCTION] Error generating view token:", tokenError);
          } else {
            viewToken = token;
            console.log("[EDGE FUNCTION] Generated new view token");
          }
        }

        // Enviar email com link de visualização se temos token
        if (viewToken) {
          // Get base URL - sempre usa migmainc.com
          const appUrl = "https://migmainc.com";
          const viewUrl = `${appUrl}/view-contract?token=${viewToken}`;

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
                                                Your Contract Has Been Approved!
                                            </h1>
                                            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                                Dear ${application.full_name},
                                            </p>
                                            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                                Congratulations! Your <strong style="color: #CE9F48;">MIGMA Global Partner Contract</strong> has been reviewed and <strong style="color: #F3E196;">approved</strong>!
                                            </p>
                                            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                                You can now view your signed contract, including your digital signature and identity documents, through our secure portal.
                                            </p>
                                            <!-- CTA Button -->
                                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                <tr>
                                                    <td align="center" style="padding: 0 0 30px;">
                                                        <a href="${viewUrl}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(180deg, #F3E196 0%, #CE9F48 50%, #F3E196 100%); color: #000000; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 12px rgba(206, 159, 72, 0.4);">
                                                            View Your Signed Contract
                                                        </a>
                                                    </td>
                                                </tr>
                                            </table>
                                            <p style="text-align: center; margin: 0 0 30px 0; font-size: 14px; color: #999999;">
                                                Or copy and paste this link into your browser:<br>
                                                <span style="word-break: break-all; color: #CE9F48; font-size: 12px;">${viewUrl}</span>
                                            </p>
                                            <!-- Info Box -->
                                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                <tr>
                                                    <td style="padding: 20px; background-color: #1a1a1a; border-left: 4px solid #CE9F48; border-radius: 4px; margin: 20px 0;">
                                                        <p style="margin: 0; color: #F3E196; font-size: 14px; line-height: 1.6;">
                                                            <strong style="color: #CE9F48;">Note:</strong> This document is protected and available for viewing only. Downloading, copying, or printing is disabled for security purposes. The link will expire in 90 days.
                                                        </p>
                                                    </td>
                                                </tr>
                                            </table>
                                            <p style="margin: 30px 0 0 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                                Welcome to the MIGMA team! We look forward to working with you.
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
          `;

          // Enviar email via Edge Function send-email
          const { error: emailError } = await supabase.functions.invoke('send-email', {
            body: {
              to: application.email,
              subject: 'Your MIGMA Global Partner Contract Has Been Approved - View Your Contract',
              html: emailHtml,
            },
          });

          if (emailError) {
            console.error("[EDGE FUNCTION] Error sending contract view email:", emailError);
            // Não falhar a aprovação se o email falhar
          } else {
            console.log("[EDGE FUNCTION] Contract view email sent successfully to:", application.email);
          }
        }
      } else {
        console.warn("[EDGE FUNCTION] Could not fetch application data for email:", appError);
      }
    } catch (emailError) {
      console.error("[EDGE FUNCTION] Error processing email (non-critical):", emailError);
      // Não falhar a aprovação se o email falhar
    }

    console.log("[EDGE FUNCTION] Partner contract approved successfully");

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

