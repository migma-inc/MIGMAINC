// Supabase Edge Function to reject a partner contract
// Updates verification_status to 'rejected' and sets application status to 'verification_failed'

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
    const { acceptance_id, rejection_reason, reviewed_by, contract_template_id } = await req.json();

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

    console.log("[EDGE FUNCTION] Rejecting partner contract for acceptance:", acceptance_id);

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Fetch acceptance to get application_id and email
    const { data: acceptance, error: acceptanceError } = await supabase
      .from('partner_terms_acceptances')
      .select('id, application_id, email')
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

    // Fetch application to get full_name
    const { data: application, error: appError } = await supabase
      .from('global_partner_applications')
      .select('id, full_name, email')
      .eq('id', acceptance.application_id)
      .single();

    if (appError || !application) {
      console.error("[EDGE FUNCTION] Error fetching application:", appError);
      // Continue anyway - we can still update the acceptance
    }

    // Update acceptance with rejection status
    const updateData: any = {
      verification_status: 'rejected',
      verification_reviewed_by: reviewed_by,
      verification_reviewed_at: new Date().toISOString(),
    };

    if (rejection_reason) {
      updateData.verification_rejection_reason = rejection_reason;
    }

    const { error: updateAcceptanceError } = await supabase
      .from('partner_terms_acceptances')
      .update(updateData)
      .eq('id', acceptance_id);

    if (updateAcceptanceError) {
      console.error("[EDGE FUNCTION] Error updating acceptance:", updateAcceptanceError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to reject contract" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update application status to 'verification_failed'
    const { error: updateApplicationError } = await supabase
      .from('global_partner_applications')
      .update({
        status: 'verification_failed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', acceptance.application_id);

    if (updateApplicationError) {
      console.error("[EDGE FUNCTION] Error updating application status:", updateApplicationError);
      // Still return success since acceptance was updated
      console.warn("[EDGE FUNCTION] Acceptance rejected but application status update failed");
    }

    // If contract_template_id is provided, generate new token and resend contract link
    let newToken: string | null = null;
    if (contract_template_id !== undefined && contract_template_id !== null) {
      console.log("[EDGE FUNCTION] Generating new token with contract template:", contract_template_id);

      // Generate new token
      const token = `migma_${Date.now()}_${Math.random().toString(36).substring(2, 15)}_${Math.random().toString(36).substring(2, 15)}`;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // 30 days expiration

      // Insert new token with contract template
      const insertData: any = {
        application_id: acceptance.application_id,
        token: token,
        expires_at: expiresAt.toISOString(),
        contract_template_id: contract_template_id,
      };

      const { error: tokenError } = await supabase
        .from('partner_terms_acceptances')
        .insert(insertData);

      if (tokenError) {
        console.error("[EDGE FUNCTION] Error generating new token:", tokenError);
        // Continue with rejection email even if token generation fails
      } else {
        newToken = token;
        console.log("[EDGE FUNCTION] New token generated successfully:", token);
      }
    }

    // Send rejection email if we have email address
    const emailToSend = acceptance.email || application?.email;
    if (emailToSend) {
      // If we have a new token, send approval email with new contract link
      if (newToken) {
        // Get base URL - sempre usa migmainc.com
        const appUrl = "https://migmainc.com";
        const termsUrl = `${appUrl}/partner-terms?token=${newToken}`;

        const { error: emailError } = await supabase.functions.invoke('send-email', {
          body: {
            to: emailToSend,
            subject: 'Action Required: Contract Resubmission Required',
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
                                  Contract Resubmission Required
                                </h1>
                                <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                  Dear ${application?.full_name || 'Partner'},
                                </p>
                                <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                  We have reviewed your Global Partner contract and need you to review and accept the updated contract terms.
                                </p>
                                ${rejection_reason ? `
                                <div style="padding: 15px; background-color: #1a1a1a; border-left: 4px solid #CE9F48; border-radius: 4px; margin: 20px 0;">
                                  <p style="margin: 0; color: #F3E196; font-size: 14px; line-height: 1.6;">
                                    <strong style="color: #CE9F48;">Reason:</strong> ${rejection_reason}
                                  </p>
                                </div>
                                ` : ''}
                                <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                  Please review the updated contract terms and complete the acceptance process:
                                </p>
                                <!-- CTA Button -->
                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                  <tr>
                                    <td align="center" style="padding: 0 0 30px;">
                                      <a href="${termsUrl}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(180deg, #F3E196 0%, #CE9F48 50%, #F3E196 100%); color: #000000; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 12px rgba(206, 159, 72, 0.4);">
                                        Review and Accept Updated Terms
                                      </a>
                                    </td>
                                  </tr>
                                </table>
                                <p style="text-align: center; margin: 0 0 30px 0; font-size: 14px; color: #999999;">
                                  Or copy and paste this link into your browser:<br>
                                  <span style="word-break: break-all; color: #CE9F48; font-size: 12px;">${termsUrl}</span>
                                </p>
                                <!-- Warning Box -->
                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                  <tr>
                                    <td style="padding: 20px; background-color: #1a1a1a; border-left: 4px solid #CE9F48; border-radius: 4px; margin: 20px 0;">
                                      <p style="margin: 0; color: #F3E196; font-size: 14px; line-height: 1.6;">
                                        <strong style="color: #CE9F48;">Important:</strong> This link will expire in 30 days. Please complete the process as soon as possible.
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
                            © MIGMA. All rights reserved.
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
          console.error("[EDGE FUNCTION] Error sending resubmission email:", emailError);
        } else {
          console.log("[EDGE FUNCTION] Resubmission email sent with new contract link");
        }
      } else {
        // Send regular rejection email (no new contract)
        const { error: emailError } = await supabase.functions.invoke('send-email', {
          body: {
            to: emailToSend,
            subject: 'Action Required: Contract Verification Failed',
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
                                  Contract Verification Failed
                                </h1>
                                <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                  Dear ${application?.full_name || 'Partner'},
                                </p>
                                <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                  We have reviewed your Global Partner contract and unfortunately, we need additional verification or clarification regarding your submitted documents.
                                </p>
                                ${rejection_reason ? `
                                <div style="padding: 15px; background-color: #1a1a1a; border-left: 4px solid #CE9F48; border-radius: 4px; margin: 20px 0;">
                                  <p style="margin: 0; color: #F3E196; font-size: 14px; line-height: 1.6;">
                                    <strong style="color: #CE9F48;">Reason:</strong> ${rejection_reason}
                                  </p>
                                </div>
                                ` : ''}
                                <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                  Please contact our team to discuss next steps and resolve any issues with your contract verification.
                                </p>
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
                            © MIGMA. All rights reserved.
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
          console.error("[EDGE FUNCTION] Error sending rejection email:", emailError);
          // Email failure is not critical
        }
      }
    }

    console.log("[EDGE FUNCTION] Partner contract rejected successfully");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Contract rejected successfully",
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

