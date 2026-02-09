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

        const { client_id } = await req.json();

        if (!client_id) {
            throw new Error('client_id is required');
        }

        console.log(`[EB-3 Welcome] Sending welcome email for client: ${client_id}`);

        // Buscar todas as parcelas do cliente
        const { data: schedules, error: schedulesError } = await supabaseClient
            .from('eb3_recurrence_schedules')
            .select(`
                id,
                installment_number,
                due_date,
                amount_usd,
                late_fee_usd,
                client_id,
                clients!inner(full_name, email)
            `)
            .eq('client_id', client_id)
            .eq('status', 'pending')
            .order('installment_number');

        if (schedulesError) {
            console.error('[EB-3 Welcome] Error fetching schedules:', schedulesError);
            throw schedulesError;
        }

        if (!schedules || schedules.length === 0) {
            console.log('[EB-3 Welcome] No schedules found for client');
            return new Response(
                JSON.stringify({ success: false, message: 'No schedules found' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const client = schedules[0].clients;
        const PUBLIC_SITE_URL = Deno.env.get('PUBLIC_SITE_URL') || 'https://migmainc.com';

        // Send welcome email with information about all installments
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
                        <td align="center" style="padding: 40px 20px 30px; background-color: #000000;">
                            <img src="${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/logo/logo2.png" alt="MIGMA Logo" width="200" style="display: block;">
                        </td>
                    </tr>
                    <!-- Main Content -->
                    <tr>
                        <td style="padding: 0 40px 40px; background-color: #000000;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="padding: 30px; background: linear-gradient(135deg, #1a1a1a 0%, #000000 100%); border-radius: 8px; border: 1px solid #CE9F48;">
                                        <h1 style="margin: 0 0 20px 0; font-size: 28px; font-weight: bold; color: #F3E196; text-align: center; background: linear-gradient(180deg, #8E6E2F 0%, #F3E196 25%, #CE9F48 50%, #F3E196 75%, #8E6E2F 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
                                            🎉 EB-3 Payment Plan Activated!
                                        </h1>
                                        <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0; text-align: center;">
                                            Welcome to your installment payment journey.
                                        </p>
                                        <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0; text-align: left;">
                                            Hello <strong style="color: #CE9F48;">${client.full_name}</strong>,
                                        </p>
                                        <p style="margin: 0 0 30px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0; text-align: left;">
                                            Congratulations! Your EB-3 installment payment plan has been successfully activated. You now have <strong>8 monthly installments</strong> of <strong>$650 USD each</strong>.
                                        </p>

                                        <!-- Payment Schedule -->
                                        <div style="background-color: #1a1a1a; border: 1px solid #333; border-radius: 12px; padding: 20px; margin-bottom: 30px;">
                                            <h2 style="margin: 0 0 20px 0; color: #F3E196; font-size: 20px; font-weight: 600; text-align: center;">📅 Your Payment Schedule</h2>
                                            ${schedules.map(schedule => `
                                                <div style="background: #000000; border-radius: 8px; padding: 15px; margin-bottom: 12px; border: 1px solid ${schedule.installment_number === 1 ? '#CE9F48' : '#333'};">
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                        <tr>
                                                            <td style="color: #e0e0e0; font-weight: 600; font-size: 15px;">Installment #${schedule.installment_number}</td>
                                                            <td align="right" style="color: #CE9F48; font-weight: 700; font-size: 16px;">US$ ${schedule.amount_usd}</td>
                                                        </tr>
                                                        <tr>
                                                            <td colspan="2" style="padding-top: 5px; color: #888; font-size: 13px;">
                                                                Due Date: <strong>${new Date(schedule.due_date).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
                                                            </td>
                                                        </tr>
                                                        ${schedule.installment_number === 1 ? `
                                                            <tr>
                                                                <td colspan="2" align="left" style="padding-top: 15px;">
                                                                    <a href="${PUBLIC_SITE_URL}/checkout/eb3-installment/${schedule.id}" 
                                                                       style="display: inline-block; background: linear-gradient(180deg, #F3E196 0%, #CE9F48 100%); color: #000; text-decoration: none; padding: 10px 25px; border-radius: 6px; font-weight: bold; font-size: 14px;">
                                                                        Pay Now →
                                                                    </a>
                                                                </td>
                                                            </tr>
                                                        ` : ''}
                                                    </table>
                                                </div>
                                            `).join('')}
                                        </div>

                                        <!-- Important Info -->
                                        <div style="background: rgba(197, 48, 48, 0.1); border-left: 4px solid #fc8181; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
                                            <h3 style="margin: 0 0 12px 0; color: #fc8181; font-size: 16px; font-weight: 600;">⚠️ Important Information</h3>
                                            <ul style="margin: 0; padding-left: 20px; color: #e0e0e0; font-size: 14px; line-height: 1.8; text-align: left;">
                                                <li>You will receive an email reminder <strong>7 days before</strong> each due date.</li>
                                                <li>Late payments will incur a <strong>$50 USD</strong> administrative fee.</li>
                                                <li>Payments can be made via <strong>Zelle or Parcelow</strong>.</li>
                                            </ul>
                                        </div>

                                        <p style="margin: 0; color: #e0e0e0; font-size: 14px; line-height: 1.6; text-align: center;">
                                            If you have any questions, please contact our support team.
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
                                © 2026 Migma Inc. | EB-3 Installment Payment System
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

        const { error: emailError } = await supabaseClient.functions.invoke('send-email', {
            body: {
                to: client.email,
                subject: '🎉 EB-3 Payment Plan Activated - Your 8 Monthly Installments',
                html: emailHtml
            }
        });

        if (emailError) {
            console.error('[EB-3 Welcome] Error sending email:', emailError);
            throw emailError;
        }

        console.log(`[EB-3 Welcome] ✅ Welcome email sent successfully to ${client.email}`);

        return new Response(
            JSON.stringify({
                success: true,
                message: 'Welcome email sent',
                schedules_count: schedules.length
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            }
        );

    } catch (error) {
        console.error('[EB-3 Welcome] Error:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 500
            }
        );
    }
});
