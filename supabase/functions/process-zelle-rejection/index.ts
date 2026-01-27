// Supabase Edge Function to handle Zelle payment rejection
// Updates status, generates a prefill token, and sends a Premium email to the client

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
    // Handle CORS
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { id, type, rejection_reason, processed_by_user_id } = await req.json();
        console.log(`[PROCESS-ZELLE-REJECTION] REJECTION START - Type: ${type}, ID: ${id}`);
        console.log(`[PROCESS-ZELLE-REJECTION] Reason: ${rejection_reason}`);

        if (!id || !type) {
            return new Response(
                JSON.stringify({ success: false, error: "id and type are required" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        let clientData: any = {};
        let productSlug = "";
        let sellerId = "";
        let orderNumberDisplay = "Visa Service Application";
        let clientEmail = "";
        let clientName = "";

        // 1. Fetch data and update status
        if (type === 'visa_order') {
            const { data: order, error: fetchError } = await supabase
                .from('visa_orders')
                .select('*')
                .eq('id', id)
                .single();

            if (fetchError || !order) {
                console.error(`[PROCESS-ZELLE-REJECTION] Error: Visa order not found`);
                throw new Error("Order not found");
            }

            await supabase.from('visa_orders').update({
                payment_status: 'failed',
                updated_at: new Date().toISOString()
            }).eq('id', id);

            await supabase.from('zelle_payments').update({
                status: 'rejected',
                admin_notes: rejection_reason || 'Rejected manually by admin',
                processed_by_user_id: processed_by_user_id,
                updated_at: new Date().toISOString()
            }).eq('order_id', id);

            clientEmail = order.client_email;
            clientName = order.client_name;
            productSlug = order.product_slug;
            sellerId = order.seller_id || "";
            orderNumberDisplay = `Order #${order.order_number}`;

            clientData = {
                clientName: order.client_name,
                clientEmail: order.client_email,
                clientWhatsApp: order.client_whatsapp,
                clientCountry: order.client_country,
                clientNationality: order.client_nationality,
                clientObservations: order.client_observations,
                extraUnits: order.extra_units || 0,
                dependentNames: order.dependent_names || []
            };
        } else {
            // migma_payment
            const { data: payment, error: pError } = await supabase
                .from('migma_payments')
                .select('*')
                .eq('id', id)
                .single();

            if (pError || !payment) {
                console.error(`[PROCESS-ZELLE-REJECTION] Error: Migma payment not found`);
                throw new Error("Payment not found");
            }

            await supabase.from('migma_payments').update({
                status: 'rejected',
                admin_notes: rejection_reason || 'Rejected manually by admin',
                processed_by_user_id: processed_by_user_id,
                updated_at: new Date().toISOString()
            }).eq('id', id);

            const { data: client, error: cError } = await supabase
                .from('clients')
                .select('*')
                .eq('id', payment.user_id)
                .single();

            if (cError || !client) {
                console.error(`[PROCESS-ZELLE-REJECTION] Error: Client not found for payment`);
                throw new Error("Client data not found");
            }

            clientEmail = client.email;
            clientName = client.full_name;
            productSlug = payment.fee_type_global;
            orderNumberDisplay = "Visa Service - Zelle Payment Verification";

            clientData = {
                clientName: client.full_name,
                clientEmail: client.email,
                clientWhatsApp: client.phone,
                clientCountry: client.country,
                clientNationality: client.nationality,
                dateOfBirth: client.date_of_birth,
                documentType: client.document_type,
                documentNumber: client.document_number,
                addressLine: client.address_line,
                city: client.city,
                state: client.state,
                postalCode: client.postal_code,
                maritalStatus: client.marital_status
            };

            const { data: event } = await supabase
                .from('seller_funnel_events')
                .select('seller_id')
                .eq('client_email', client.email)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (event) sellerId = event.seller_id;
        }

        // 2. Generate Prefill Token
        console.log(`[PROCESS-ZELLE-REJECTION] Generating prefill token...`);
        const token = `reject_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

        await supabase.from('checkout_prefill_tokens').insert({
            token: token,
            product_slug: productSlug,
            seller_id: sellerId,
            client_data: clientData,
            expires_at: expiresAt.toISOString()
        });

        // 3. Send Premium Email
        console.log(`[PROCESS-ZELLE-REJECTION] Building email HTML...`);
        const appUrl = "https://migmainc.com";
        const checkoutUrl = `${appUrl}/checkout/visa/${productSlug}?prefill=${token}`;

        const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #000000; color: #ffffff;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #000000;">
            <tr>
                <td align="center" style="padding: 40px 20px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; background-color: #000000; border-radius: 12px; border: 1px solid #CE9F48;">
                        <tr>
                            <td align="center" style="padding: 40px 20px 30px;">
                                <img src="https://ekxftwrjvxtpnqbraszv.supabase.co/storage/v1/object/public/logo/logo2.png" alt="MIGMA Logo" width="160">
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 0 40px 40px;">
                                <h1 style="margin: 0 0 20px 0; font-size: 24px; font-weight: bold; color: #F3E196; text-align: center;">
                                    Payment Verification Update
                                </h1>
                                <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                    Dear ${clientName},
                                </p>
                                <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                    Thank you for your application. We encountered an issue while verifying your Zelle payment for <strong style="color: #CE9F48;">${orderNumberDisplay}</strong>.
                                </p>
                                
                                <div style="padding: 20px; background-color: #111111; border-left: 4px solid #f87171; border-radius: 4px; margin: 25px 0;">
                                    <p style="margin: 0 0 8px 0; color: #f87171; font-size: 14px; font-weight: bold; letter-spacing: 0.05em; text-transform: uppercase;">Reason for Rejection:</p>
                                    <p style="margin: 0; color: #ffffff; font-size: 15px; line-height: 1.5;">${rejection_reason || 'We could not verify the transaction data provided. Please ensure the receipt matches the application details.'}</p>
                                </div>

                                <p style="margin: 30px 0 25px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0; text-align: center;">
                                    To finalize your process, please click the button below to resubmit your payment. Your data has been saved to save you time.
                                </p>
                                
                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                    <tr>
                                        <td align="center" style="padding: 10px 0 30px;">
                                            <a href="${checkoutUrl}" style="display: inline-block; padding: 18px 45px; background: linear-gradient(180deg, #F3E196 0%, #CE9F48 50%, #F3E196 100%); color: #000000; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; text-transform: uppercase; letter-spacing: 0.05em; box-shadow: 0 10px 20px rgba(206, 159, 72, 0.2);">
                                                Complete My Application
                                            </a>
                                        </td>
                                    </tr>
                                </table>

                                <p style="text-align: center; font-size: 13px; color: #888888; margin-bottom: 30px;">
                                    You can re-upload your proof of payment or choose another payment method like Credit Card or PIX.
                                </p>
                                
                                <div style="text-align: center; border-top: 1px solid #333; padding-top: 25px;">
                                    <p style="margin: 0; font-size: 14px; color: #CE9F48; font-weight: 500;">
                                        MIGMA Support Team
                                    </p>
                                    <p style="margin: 5px 0 0 0; font-size: 12px; color: #666666;">
                                        This is a secure automated message.
                                    </p>
                                </div>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
      </body>
      </html>
    `;

        console.log(`[PROCESS-ZELLE-REJECTION] Calling send-email...`);
        try {
            await supabase.functions.invoke('send-email', {
                body: {
                    to: clientEmail,
                    subject: `Payment Issue: ${orderNumberDisplay}`,
                    html: emailHtml,
                },
            });
            console.log(`[PROCESS-ZELLE-REJECTION] Email sent successfully`);
        } catch (emailErr) {
            console.error(`[PROCESS-ZELLE-REJECTION] Error calling send-email:`, emailErr);
        }

        return new Response(
            JSON.stringify({ success: true, message: "Rejection processed" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("[PROCESS-ZELLE-REJECTION] Global Error:", error);
        return new Response(
            JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Internal Server Error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
