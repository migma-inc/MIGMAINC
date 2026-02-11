import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const { schedule_id } = await req.json();

        if (!schedule_id) {
            throw new Error('schedule_id is required');
        }

        console.log(`[EB-3 Installment] Sending link for schedule: ${schedule_id}`);

        // Fetch schedule detail
        const { data: schedule, error: scheduleError } = await supabaseClient
            .from('eb3_recurrence_schedules')
            .select(`
                id,
                installment_number,
                due_date,
                amount_usd,
                client_id,
                order_id,
                clients!inner(full_name, email),
                visa_orders!eb3_recurrence_schedules_order_id_fkey(seller_id)
            `)
            .eq('id', schedule_id)
            .single();

        if (scheduleError || !schedule) {
            throw new Error('Schedule not found');
        }

        // Generate a prefill token with client data (same format as SellerLinks)
        const token = crypto.randomUUID();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

        const sellerId = (schedule as any).visa_orders?.seller_id || null;

        const { error: tokenError } = await supabaseClient
            .from('checkout_prefill_tokens')
            .insert({
                token,
                product_slug: 'eb3-installment-monthly',
                seller_id: sellerId,
                client_data: {
                    clientName: schedule.clients.full_name,
                    clientEmail: schedule.clients.email,
                    eb3_schedule_id: schedule.id,
                    installment_number: schedule.installment_number,
                    due_date: schedule.due_date,
                    amount_usd: schedule.amount_usd,
                },
                expires_at: expiresAt.toISOString(),
            });

        if (tokenError) {
            console.error('[EB-3 Installment] Error creating prefill token:', tokenError);
            throw new Error('Failed to create checkout link');
        }

        const PUBLIC_SITE_URL = 'http://localhost:5173';
        const sellerParam = sellerId ? `&seller=${sellerId}` : '';
        const checkoutUrl = `${PUBLIC_SITE_URL}/checkout/visa/eb3-installment-monthly?prefill=${token}${sellerParam}`;
        const formattedDate = new Date(schedule.due_date).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });

        // Email HTML - Migma Standard Black/Gold
        const emailHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', Arial, sans-serif; background-color: #000000;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #000000;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; background-color: #000000; border-radius: 8px;">
                    <!-- Logo Header -->
                    <tr>
                        <td align="center" style="padding: 0 20px 30px;">
                            <img src="${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/logo/logo2.png" alt="MIGMA Logo" width="200" style="display: block;">
                        </td>
                    </tr>
                    <!-- Main Content -->
                    <tr>
                        <td style="padding: 30px; background: #1a1a1a; border-radius: 8px; border: 1px solid #CE9F48;">
                            <h1 style="margin: 0 0 20px 0; font-size: 26px; color: #CE9F48; text-align: center; font-weight: bold;">
                                Your 1st EB-3 Installment is available
                            </h1>
                            <p style="color: #e0e0e0; font-size: 16px;">Hello <strong>${schedule.clients.full_name}</strong>,</p>
                            <p style="color: #e0e0e0; font-size: 15px; line-height: 1.6;">
                                As agreed, your payment plan has been initiated. The payment link for your **first installment** is now available below:
                            </p>

                            <div style="background: #0a0a0a; border: 1px solid #CE9F48; padding: 25px; margin: 30px 0; border-radius: 12px; text-align: center;">
                                <p style="margin: 0 0 10px 0; color: #888; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Installment Amount</p>
                                <p style="margin: 0 0 10px 0; color: #F3E196; font-size: 32px; font-weight: bold;">US$ ${schedule.amount_usd}</p>
                                <p style="margin: 0; color: #e0e0e0; font-size: 14px;">Due Date: ${formattedDate}</p>
                            </div>

                            <div style="text-align: center; margin-bottom: 30px;">
                                <a href="${checkoutUrl}" style="display: inline-block; padding: 18px 45px; background: linear-gradient(180deg, #F3E196 0%, #CE9F48 100%); color: #000; text-decoration: none; font-weight: bold; border-radius: 8px; font-size: 16px; box-shadow: 0 4px 15px rgba(206, 159, 72, 0.3);">
                                    Pay 1st Installment Now →
                                </a>
                            </div>

                            <p style="background: rgba(206, 159, 72, 0.1); padding: 15px; border-left: 3px solid #CE9F48; color: #e0e0e0; font-size: 13px;">
                                <strong>Reminder:</strong> The next 7 installments will be due monthly starting from today. You will receive an automated reminder 7 days before each due date.
                            </p>
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td align="center" style="padding: 25px;">
                            <p style="margin: 0; font-size: 12px; color: #666;">© 2026 MIGMA INC. | EB-3 Payment System</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `;

        const { error: emailError } = await supabaseClient.functions.invoke('send-email', {
            body: {
                to: schedule.clients.email,
                subject: '🔗 Payment Link: 1st EB-3 Installment Available',
                html: emailHtml
            }
        });

        if (emailError) throw emailError;

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });

    } catch (error) {
        console.error('[EB-3 Link] Error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
        });
    }
});
