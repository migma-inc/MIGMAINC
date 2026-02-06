import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req) => {
    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        console.log("[Daily Billing] Starting processing...");

        // 1. Find installments due in 3 days
        // We notify 3 days before
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + 3);
        const dateStr = targetDate.toISOString().split('T')[0];

        console.log(`[Daily Billing] Looking for installments due on: ${dateStr}`);

        const { data: installments, error } = await supabase
            .from('billing_installments')
            .select(`
        *,
        schedule:recurring_billing_schedules(
          order_id
        )
      `)
            .eq('due_date', dateStr)
            .eq('status', 'pending')
            .is('notified_at', null);

        if (error) {
            console.error("[Daily Billing] Fetch error", error);
            return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }

        console.log(`[Daily Billing] Found ${installments?.length || 0} installments to notify`);

        for (const inst of (installments || [])) {
            // Get order details for e-mail
            const { data: order } = await supabase
                .from('visa_orders')
                .select('client_name, client_email, client_whatsapp, order_number')
                .eq('id', inst.schedule.order_id)
                .single();

            if (!order) continue;

            const checkoutUrl = `https://migma-inc.com/checkout?billing_token=${inst.checkout_token}`;

            console.log(`[Daily Billing] Notifying ${order.client_email} for installment ${inst.installment_number}`);

            // Get logo URL
            const logoUrl = `${supabaseUrl}/storage/v1/object/public/logo/logo2.png`;

            // Send Email
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
                            <img src="${logoUrl}" alt="MIGMA Logo" width="200" style="display: block; max-width: 200px; height: auto;">
                        </td>
                    </tr>
                    <!-- Main Content -->
                    <tr>
                        <td style="padding: 0 40px 40px; background-color: #000000;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="padding: 30px; background: linear-gradient(135deg, #1a1a1a 0%, #000000 100%); border-radius: 8px; border: 1px solid #CE9F48;">
                                        <h1 style="margin: 0 0 20px 0; font-size: 28px; font-weight: bold; color: #F3E196; text-align: center; background: linear-gradient(180deg, #8E6E2F 0%, #F3E196 25%, #CE9F48 50%, #F3E196 75%, #8E6E2F 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                                            Payment Reminder
                                        </h1>
                                        <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                            Hello <strong style="color: #CE9F48;">${order.client_name}</strong>,
                                        </p>
                                        <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                            This is a friendly reminder that your monthly installment for the **EB-3 Plan** (Order ${order.order_number}) is due in 3 days.
                                        </p>
                                        
                                        <!-- Payment Details Box -->
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 20px 0;">
                                            <tr>
                                                <td style="padding: 20px; background-color: #1a1a1a; border-left: 4px solid #CE9F48; border-radius: 4px;">
                                                    <p style="margin: 0 0 10px 0; color: #CE9F48; font-weight: bold; font-size: 16px;">Amount Due:</p>
                                                    <p style="margin: 0 0 20px 0; color: #e0e0e0; font-size: 24px; font-weight: bold;">
                                                        US$ ${inst.amount}
                                                    </p>
                                                    <p style="margin: 0 0 10px 0; color: #CE9F48; font-weight: bold; font-size: 16px;">Due Date:</p>
                                                    <p style="margin: 0; color: #e0e0e0; font-size: 16px;">
                                                        ${inst.due_date}
                                                    </p>
                                                </td>
                                            </tr>
                                        </table>

                                        <div style="text-align: center; margin: 30px 0;">
                                            <a href="${checkoutUrl}" style="display: inline-block; background: linear-gradient(180deg, #F3E196 0%, #CE9F48 100%); color: #000000; padding: 14px 32px; text-decoration: none; font-weight: bold; border-radius: 6px; font-size: 16px; transition: all 0.3s ease;">
                                                Pay Installment
                                            </a>
                                        </div>

                                        <p style="margin: 20px 0 0 0; font-size: 14px; line-height: 1.6; color: #888888; text-align: center;">
                                            If you have already made this payment, please disregard this email.
                                        </p>
                                        <p style="margin: 20px 0 0 0; font-size: 16px; line-height: 1.6; color: #e0e0e0; text-align: center;">
                                            Thank you for choosing MIGMA INC.!
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td align="center" style="padding: 20px 40px; background-color: #000000;">
                            <p style="margin: 0; font-size: 12px; color: #666666; line-height: 1.5;">
                                © MIGMA INC. All rights reserved.
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

            try {
                const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${supabaseServiceKey}`,
                        "apikey": supabaseServiceKey,
                    },
                    body: JSON.stringify({
                        to: order.client_email,
                        subject: `EB-3 Payment Reminder - Due ${inst.due_date}`,
                        html: emailHtml,
                    }),
                });

                if (emailResponse.ok) {
                    // Update notified_at
                    await supabase
                        .from('billing_installments')
                        .update({ notified_at: new Date().toISOString() })
                        .eq('id', inst.id);
                    console.log(`[Daily Billing] Successfully notified and updated installment ${inst.id}`);
                } else {
                    console.error("[Daily Billing] Failed to send email", await emailResponse.text());
                }
            } catch (e) {
                console.error("[Daily Billing] Exception sending email", e);
            }
        }

        return new Response(JSON.stringify({ success: true, processed: installments?.length || 0 }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
        });

    } catch (error) {
        console.error("[Daily Billing] Global exception:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
});
