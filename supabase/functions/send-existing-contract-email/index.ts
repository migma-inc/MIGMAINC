import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getBucketAndPath(url: string | null) {
    if (!url) return null;
    const match = url.match(/\/storage\/v1\/object\/public\/([^\/]+)\/(.+)$/);
    if (!match) return null;
    return { bucket: match[1], path: match[2] };
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { contract_id, type } = await req.json();

        if (!contract_id || !type) {
            return new Response(
                JSON.stringify({ error: "Missing required fields: contract_id, type" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        let result;

        if (type === 'visa') {
            result = await processVisaContract(contract_id, supabase);
        } else if (type === 'partner') {
            result = await processPartnerContract(contract_id, supabase);
        } else {
            throw new Error("Invalid contract type");
        }

        return new Response(
            JSON.stringify(result),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("[EDGE FUNCTION] Exception:", error);
        return new Response(
            JSON.stringify({ success: false, error: error.message || "Internal server error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});

async function processVisaContract(orderId: string, supabase: any) {
    const { data: order, error } = await supabase
        .from('visa_orders')
        .select('*')
        .eq('id', orderId)
        .single();

    if (error || !order) throw new Error("Visa order not found");

    const adminEmail = "info@migmainc.com";
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

    if (attachments.length === 0) throw new Error("No PDF files found for this order");

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
                      Manual Resend: Visa Documents
                    </h2>
                    
                    <div style="background-color: #111111; border-radius: 8px; padding: 25px; border-left: 4px solid #CE9F48; margin-bottom: 30px;">
                      <p style="margin: 0 0 12px 0; font-size: 14px; color: #888; text-transform: uppercase;">Order Context</p>
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
                          <td style="padding: 8px 0; color: #CE9F48; font-weight: 600;">Status:</td>
                          <td style="padding: 8px 0; color: #e0e0e0; text-transform: uppercase; font-size: 12px;">${order.contract_approval_status}</td>
                        </tr>
                      </table>
                    </div>

                    <p style="font-size: 15px; line-height: 1.6; color: #cccccc; margin: 0 0 10px 0; text-align: center;">
                      This is a <strong>Manual Resend</strong> triggered from the administrative panel.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding: 20px; background-color: #000000; border-top: 1px solid #1a1a1a;">
                    <p style="margin: 0; font-size: 10px; color: #555; text-transform: uppercase; letter-spacing: 1px;">
                      © 2026 MIGMA GLOBAL • Administrative Action
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

    console.log(`[EDGE FUNCTION] Resending Visa Contract for ${order.client_name} (Order #${order.order_number})`);
    const { data: emailData, error: emailError } = await supabase.functions.invoke('send-email-with-attachment', {
        body: {
            to: adminEmail,
            subject: `[CONTRACT RESEND] ${order.client_name} - Order #${order.order_number}`,
            html: emailHtml,
            attachments: attachments
        },
    });

    if (emailError) {
        console.error(`[EDGE FUNCTION] Error resending Visa Contract:`, emailError);
        throw new Error(`Email invocation error: ${emailError.message}`);
    }
    console.log(`[EDGE FUNCTION] Visa Contract Email Resend Status: Success`);

    // Update flags
    await supabase.from('visa_orders').update({
        admin_email_sent: true,
        admin_email_sent_at: new Date().toISOString()
    }).eq('id', orderId);

    return { success: true, message: "Visa contract email resent successfully" };
}

async function processPartnerContract(acceptanceId: string, supabase: any) {
    const { data: acceptance, error: accError } = await supabase
        .from('partner_terms_acceptances')
        .select('*')
        .eq('id', acceptanceId)
        .single();

    if (accError || !acceptance) throw new Error("Partner acceptance not found");

    const { data: application, error: appError } = await supabase
        .from('global_partner_applications')
        .select('*')
        .eq('id', acceptance.application_id)
        .single();

    if (appError || !application) throw new Error("Partner application not found");

    const adminEmail = "adm@migmainc.com";

    if (!acceptance.contract_pdf_path) throw new Error("No PDF file found for this partner contract");

    const attachments = [{
        filename: `PartnerContract_${application.full_name.replace(/\s+/g, '_')}.pdf`,
        path: acceptance.contract_pdf_path,
        bucket: 'contracts'
    }];

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
                      Manual Resend: Partner Contract
                    </h2>
                    
                    <div style="background-color: #111111; border-radius: 8px; padding: 25px; border-left: 4px solid #CE9F48; margin-bottom: 30px;">
                      <p style="margin: 0 0 12px 0; font-size: 14px; color: #888; text-transform: uppercase;">Partner Details</p>
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                        <tr>
                          <td width="40%" style="padding: 8px 0; color: #CE9F48; font-weight: 600;">Partner:</td>
                          <td style="padding: 8px 0; color: #e0e0e0;">${application.full_name}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; color: #CE9F48; font-weight: 600;">Email:</td>
                          <td style="padding: 8px 0; color: #e0e0e0;">${application.email}</td>
                        </tr>
                      </table>
                    </div>

                    <p style="font-size: 15px; line-height: 1.6; color: #cccccc; margin: 0 0 10px 0; text-align: center;">
                      This is a <strong>Manual Resend</strong> triggered from the administrative panel for a Global Partner Contract.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding: 20px; background-color: #000000; border-top: 1px solid #1a1a1a;">
                    <p style="margin: 0; font-size: 10px; color: #555; text-transform: uppercase; letter-spacing: 1px;">
                      © 2026 MIGMA GLOBAL • Administrative Action
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

    console.log(`[EDGE FUNCTION] Resending Partner Contract for ${application.full_name}`);
    const { data: emailData, error: emailError } = await supabase.functions.invoke('send-email-with-attachment', {
        body: {
            to: adminEmail,
            subject: `[PARTNER CONTRACT RESEND] ${application.full_name}`,
            html: emailHtml,
            attachments: attachments
        },
    });

    if (emailError) {
        console.error(`[EDGE FUNCTION] Error resending Partner Contract:`, emailError);
        throw new Error(`Email invocation error: ${emailError.message}`);
    }
    console.log(`[EDGE FUNCTION] Partner Contract Email Resend Status: Success`);

    // Update flags
    await supabase.from('partner_terms_acceptances').update({
        admin_email_sent: true,
        admin_email_sent_at: new Date().toISOString()
    }).eq('id', acceptanceId);

    return { success: true, message: "Partner contract email resent successfully" };
}
