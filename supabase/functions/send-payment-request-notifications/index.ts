// Supabase Edge Function to send payment request notification emails
// This function runs asynchronously on the server, sending emails after a payment request is created

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const { requestId } = await req.json();

    if (!requestId) {
      return new Response(
        JSON.stringify({ error: "requestId is required" }),
        { 
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch payment request with seller info
    const { data: request, error: requestError } = await supabase
      .from("seller_payment_requests")
      .select(`
        id,
        seller_id,
        amount,
        payment_method,
        payment_details,
        status,
        requested_at
      `)
      .eq("id", requestId)
      .single();

    if (requestError || !request) {
      console.error("[PAYMENT_NOTIFICATIONS] Error fetching request:", requestError);
      return new Response(
        JSON.stringify({ error: "Payment request not found" }),
        { 
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Fetch seller info
    const { data: seller, error: sellerError } = await supabase
      .from("sellers")
      .select("full_name, email, seller_id_public")
      .eq("seller_id_public", request.seller_id)
      .single();

    if (sellerError || !seller) {
      console.error("[PAYMENT_NOTIFICATIONS] Error fetching seller:", sellerError);
      return new Response(
        JSON.stringify({ error: "Seller not found" }),
        { 
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Fetch admin emails using RPC function (same way as frontend)
    const { data: adminEmailsData, error: adminError } = await supabase.rpc('get_admin_emails');
    
    const adminEmails: string[] = [];
    if (!adminError && adminEmailsData && Array.isArray(adminEmailsData)) {
      adminEmails.push(...adminEmailsData.filter(Boolean));
    } else if (!adminError && adminEmailsData) {
      // If it's not an array, try to extract emails
      adminEmails.push(adminEmailsData);
    }

    // Call send-email function for each email
    const emailResults: { type: string; email: string; success: boolean; error?: string }[] = [];

    // 1. Email to seller
    if (seller.email) {
      try {
        const sellerEmailHtml = generateSellerEmailHtml(
          seller.full_name || seller.seller_id_public,
          request.amount,
          requestId
        );

        const { data: emailData, error: emailError } = await supabase.functions.invoke("send-email", {
          body: {
            to: seller.email,
            subject: "Solicitação de Pagamento Criada - MIGMA",
            html: sellerEmailHtml,
          },
        });

        if (emailError || emailData?.error) {
          console.error("[PAYMENT_NOTIFICATIONS] Error sending seller email:", emailError || emailData?.error);
          emailResults.push({ 
            type: "seller", 
            email: seller.email, 
            success: false, 
            error: emailError?.message || emailData?.error 
          });
        } else {
          emailResults.push({ type: "seller", email: seller.email, success: true });
        }
      } catch (err) {
        console.error("[PAYMENT_NOTIFICATIONS] Exception sending seller email:", err);
        emailResults.push({ 
          type: "seller", 
          email: seller.email, 
          success: false, 
          error: err instanceof Error ? err.message : "Unknown error" 
        });
      }
    }

    // 2. Emails to admins
    const paymentDetails = typeof request.payment_details === 'string' 
      ? JSON.parse(request.payment_details) 
      : request.payment_details;

    for (const adminEmail of adminEmails) {
      try {
        const adminEmailHtml = generateAdminEmailHtml(
          adminEmail,
          seller.full_name || seller.seller_id_public,
          seller.seller_id_public,
          request.amount,
          request.payment_method,
          requestId
        );

        const { data: emailData, error: emailError } = await supabase.functions.invoke("send-email", {
          body: {
            to: adminEmail,
            subject: "Nova Solicitação de Pagamento - MIGMA",
            html: adminEmailHtml,
          },
        });

        if (emailError || emailData?.error) {
          console.error(`[PAYMENT_NOTIFICATIONS] Error sending admin email to ${adminEmail}:`, emailError || emailData?.error);
          emailResults.push({ 
            type: "admin", 
            email: adminEmail, 
            success: false, 
            error: emailError?.message || emailData?.error 
          });
        } else {
          emailResults.push({ type: "admin", email: adminEmail, success: true });
        }
      } catch (err) {
        console.error(`[PAYMENT_NOTIFICATIONS] Exception sending admin email to ${adminEmail}:`, err);
        emailResults.push({ 
          type: "admin", 
          email: adminEmail, 
          success: false, 
          error: err instanceof Error ? err.message : "Unknown error" 
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        requestId,
        emailsSent: emailResults.filter(r => r.success).length,
        emailsTotal: emailResults.length,
        results: emailResults,
      }),
      { 
        status: 200,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    console.error("[PAYMENT_NOTIFICATIONS] Exception:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { 
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});

function generateSellerEmailHtml(sellerName: string, amount: number, requestId: string): string {
  return `
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
                                <img src="https://ekxftwrjvxtpnqbraszv.supabase.co/storage/v1/object/public/logo/logo2.png" alt="MIGMA Logo" width="200" style="display: block; max-width: 200px; height: auto;">
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 0 40px 40px; background-color: #000000;">
                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                    <tr>
                                        <td style="padding: 30px; background: linear-gradient(135deg, #1a1a1a 0%, #000000 100%); border-radius: 8px; border: 1px solid #CE9F48;">
                                            <h1 style="margin: 0 0 20px 0; font-size: 28px; font-weight: bold; color: #F3E196; text-align: center; background: linear-gradient(180deg, #8E6E2F 0%, #F3E196 25%, #CE9F48 50%, #F3E196 75%, #8E6E2F 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                                                Solicitação de Pagamento Criada
                                            </h1>
                                            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                                Olá ${sellerName},
                                            </p>
                                            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                                Sua solicitação de pagamento no valor de <strong style="color: #CE9F48;">$${amount.toFixed(2)} USD</strong> foi criada com sucesso e está aguardando aprovação.
                                            </p>
                                            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                                Você receberá uma notificação assim que sua solicitação for processada.
                                            </p>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
  `;
}

function generateAdminEmailHtml(
  adminEmail: string,
  sellerName: string,
  sellerId: string,
  amount: number,
  paymentMethod: string,
  requestId: string
): string {
  return `
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
                                <img src="https://ekxftwrjvxtpnqbraszv.supabase.co/storage/v1/object/public/logo/logo2.png" alt="MIGMA Logo" width="200" style="display: block; max-width: 200px; height: auto;">
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 0 40px 40px; background-color: #000000;">
                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                    <tr>
                                        <td style="padding: 30px; background: linear-gradient(135deg, #1a1a1a 0%, #000000 100%); border-radius: 8px; border: 1px solid #CE9F48;">
                                            <h1 style="margin: 0 0 20px 0; font-size: 28px; font-weight: bold; color: #F3E196; text-align: center; background: linear-gradient(180deg, #8E6E2F 0%, #F3E196 25%, #CE9F48 50%, #F3E196 75%, #8E6E2F 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                                                Nova Solicitação de Pagamento
                                            </h1>
                                            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                                Uma nova solicitação de pagamento foi criada:
                                            </p>
                                            <div style="padding: 20px; background-color: #1a1a1a; border-radius: 8px; margin: 20px 0;">
                                                <p style="margin: 0 0 10px 0; font-size: 14px; color: #e0e0e0;"><strong style="color: #CE9F48;">Vendedor:</strong> ${sellerName}</p>
                                                <p style="margin: 0 0 10px 0; font-size: 14px; color: #e0e0e0;"><strong style="color: #CE9F48;">Seller ID:</strong> ${sellerId}</p>
                                                <p style="margin: 0 0 10px 0; font-size: 14px; color: #e0e0e0;"><strong style="color: #CE9F48;">Valor:</strong> $${amount.toFixed(2)} USD</p>
                                                <p style="margin: 0 0 10px 0; font-size: 14px; color: #e0e0e0;"><strong style="color: #CE9F48;">Método:</strong> ${paymentMethod}</p>
                                                <p style="margin: 0; font-size: 14px; color: #e0e0e0;"><strong style="color: #CE9F48;">Request ID:</strong> ${requestId}</p>
                                            </div>
                                            <p style="margin: 20px 0 0 0; font-size: 14px; line-height: 1.6; color: #999999;">
                                                Por favor, acesse o painel administrativo para revisar e processar esta solicitação.
                                            </p>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
  `;
}
