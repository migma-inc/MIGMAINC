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

    const authHeader = req.headers.get('authorization');
    const cronSecret = Deno.env.get('CRON_SECRET_KEY');
    const url = new URL(req.url);
    const isAuthorized = authHeader?.includes(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '') ||
        authHeader?.includes(cronSecret || '');

    if (!isAuthorized) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 401,
        });
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            { auth: { autoRefreshToken: false, persistSession: false } }
        );

        console.log('[Scholarship Cron] Starting check...');

        // 1. Mark overdue
        const { data: overdueChecked } = await supabaseClient.rpc('check_scholarship_overdue');
        console.log(`[Scholarship Cron] Marked ${overdueChecked || 0} overdue`);

        // 2. Fetch pending reminders (next 7 days)
        const sevenDaysFromNow = new Date();
        sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
        const reminderLimitDate = sevenDaysFromNow.toISOString().split('T')[0];

        // Join with visa_orders (activation_order_id) to check is_test
        const { data: remindersToSend } = await supabaseClient
            .from('scholarship_recurrence_schedules')
            .select(`
                id, installment_number, due_date, amount_usd, client_id,
                clients!inner(full_name, email),
                scholarship_recurrence_control!inner(activation_order_id, seller_id),
                visa_orders:scholarship_recurrence_control(activation_order_id(is_test))
            `)
            .eq('status', 'pending')
            .lte('due_date', reminderLimitDate)
            .is('email_sent_at', null);

        // Filter out test orders manually if needed or via inner join if possible
        // Note: scholarship_recurrence_control.activation_order_id -> visa_orders.id
        const filteredReminders = remindersToSend?.filter((s: any) => {
            // Se for manual_activation ou se a ordem original não for teste
            const isTest = s.scholarship_recurrence_control?.visa_orders?.is_test === true;
            return !isTest;
        });

        if (filteredReminders && filteredReminders.length > 0) {
            console.log(`[Scholarship Cron] Found ${filteredReminders.length} reminders to send`);
            for (const schedule of filteredReminders) {
                const token = crypto.randomUUID();
                const expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + 30);
                const sellerId = schedule.scholarship_recurrence_control?.seller_id || null;

                await supabaseClient.from('checkout_prefill_tokens').insert({
                    token,
                    product_slug: 'scholarship-maintenance-fee',
                    seller_id: sellerId,
                    client_data: {
                        clientName: schedule.clients.full_name,
                        clientEmail: schedule.clients.email,
                        scholarship_schedule_id: schedule.id,
                        installment_number: schedule.installment_number,
                        due_date: schedule.due_date,
                        amount_usd: schedule.amount_usd,
                    },
                    expires_at: expiresAt.toISOString(),
                });

                const checkoutUrl = `https://migmainc.com/checkout/visa/scholarship-maintenance-fee?prefill=${token}`;

                const subject = `Scholarship Maintenance Fee Reminder - Installment #${schedule.installment_number}`;

                console.log(`[Scholarship Cron] Sending email to ${schedule.clients.email}...`);
                await supabaseClient.functions.invoke('send-email', {
                    body: {
                        to: schedule.clients.email,
                        subject: subject,
                        html: generateReminderEmail(schedule.clients.full_name, schedule.installment_number, schedule.due_date, schedule.amount_usd, checkoutUrl)
                    }
                });

                await supabaseClient.from('scholarship_recurrence_schedules').update({
                    email_sent_at: new Date().toISOString(),
                    email_reminder_count: 1
                }).eq('id', schedule.id);

                // Log to history
                await supabaseClient.from('scholarship_email_logs').insert({
                    client_id: schedule.client_id,
                    schedule_id: schedule.id,
                    email_type: 'reminder',
                    recipient_email: schedule.clients.email,
                    status: 'sent',
                    metadata: { installment_number: schedule.installment_number }
                });
            }
        }

        // 3. Late Fee Notifications (Overdue)
        const { data: overdueToNotify } = await supabaseClient
            .from('scholarship_recurrence_schedules')
            .select(`
                *, 
                clients!inner(full_name, email),
                scholarship_recurrence_control!inner(seller_id)
            `)
            .eq('status', 'overdue')
            .eq('email_reminder_count', 1);

        if (overdueToNotify && overdueToNotify.length > 0) {
            for (const schedule of overdueToNotify) {
                const totalAmount = parseFloat(schedule.amount_usd) + parseFloat(schedule.late_fee_usd);
                const token = crypto.randomUUID();
                const expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + 30);
                const sellerId = schedule.scholarship_recurrence_control?.seller_id || null;

                await supabaseClient.from('checkout_prefill_tokens').insert({
                    token,
                    product_slug: 'scholarship-maintenance-fee',
                    seller_id: sellerId,
                    client_data: {
                        clientName: schedule.clients.full_name,
                        clientEmail: schedule.clients.email,
                        scholarship_schedule_id: schedule.id,
                        installment_number: schedule.installment_number,
                        due_date: schedule.due_date,
                        amount_usd: totalAmount,
                        is_overdue: true,
                        late_fee_usd: schedule.late_fee_usd
                    },
                    expires_at: expiresAt.toISOString(),
                });

                const checkoutUrl = `https://migmainc.com/checkout/visa/scholarship-maintenance-fee?prefill=${token}`;

                await supabaseClient.functions.invoke('send-email', {
                    body: {
                        to: schedule.clients.email,
                        subject: `⚠️ Scholarship Fee Overdue - Installment #${schedule.installment_number}`,
                        html: generateLateFeeEmail(schedule.clients.full_name, schedule.installment_number, schedule.due_date, totalAmount, checkoutUrl)
                    }
                });

                await supabaseClient.from('scholarship_recurrence_schedules').update({ email_reminder_count: 2 }).eq('id', schedule.id);

                // Log to history
                await supabaseClient.from('scholarship_email_logs').insert({
                    client_id: schedule.client_id,
                    schedule_id: schedule.id,
                    email_type: 'late_fee',
                    recipient_email: schedule.clients.email,
                    status: 'sent',
                    metadata: { installment_number: schedule.installment_number, total_amount: totalAmount }
                });
            }
        }

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error) {
        console.error('[Scholarship Cron] Global Error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        });
    }
});

function generateReminderEmail(clientName: string, installmentNumber: number, dueDate: string, amount: number, checkoutUrl: string): string {
    const formattedDate = new Date(dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const logoUrl = `https://migmainc.com/logo2.png`;

    return `
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
                    <tr>
                        <td align="center" style="padding: 0 20px 30px;">
                            <img src="${logoUrl}" alt="MIGMA Logo" width="180" style="display: block;">
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 30px; background: #1a1a1a; border-radius: 8px; border: 1px solid #CE9F48;">
                            <h1 style="margin: 0 0 20px 0; font-size: 24px; color: #CE9F48; text-align: center; font-weight: bold;">
                                Scholarship Maintenance Fee
                            </h1>
                            <p style="color: #e0e0e0; font-size: 16px;">Hello <strong>${clientName}</strong>,</p>
                            <p style="color: #e0e0e0; font-size: 15px; line-height: 1.6;">
                                This is a friendly reminder for your scholarship maintenance fee installment <strong>#${installmentNumber}</strong>.
                            </p>
                            <div style="background: #0a0a0a; border: 1px solid #CE9F48; padding: 20px; margin: 25px 0; border-radius: 8px;">
                                <p style="margin: 0 0 10px 0; color: #888;">Amount Due:</p>
                                <p style="margin: 0 0 20px 0; color: #F3E196; font-size: 24px; font-weight: bold;">US$ ${Number(amount).toFixed(2)}</p>
                                <p style="margin: 0 0 10px 0; color: #888;">Due Date:</p>
                                <p style="margin: 0; color: #e0e0e0; font-size: 16px;">${formattedDate}</p>
                            </div>
                            <p style="background: rgba(206, 159, 72, 0.1); padding: 15px; border-left: 3px solid #CE9F48; color: #e0e0e0; font-size: 14px;">
                                <strong>Important:</strong> Please complete your payment by the due date to avoid a $50 late fee.
                            </p>
                            <div style="text-align: center; margin-top: 35px;">
                                <a href="${checkoutUrl}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(180deg, #F3E196 0%, #CE9F48 100%); color: #000; text-decoration: none; font-weight: bold; border-radius: 6px; font-size: 16px;">
                                    Pay Scholarship Fee Now →
                                </a>
                            </div>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
}

function generateLateFeeEmail(clientName: string, installmentNumber: number, dueDate: string, totalAmount: number, checkoutUrl: string): string {
    const formattedDate = new Date(dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const logoUrl = `https://migmainc.com/logo2.png`;

    return `
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
                    <tr>
                        <td align="center" style="padding: 0 20px 30px;">
                            <img src="${logoUrl}" alt="MIGMA Logo" width="180" style="display: block;">
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 30px; background: #1a1a1a; border-radius: 8px; border: 1px solid #ff4d4d;">
                            <h1 style="margin: 0 0 20px 0; font-size: 24px; color: #ff4d4d; text-align: center; font-weight: bold;">
                                ⚠️ Late Payment Notice
                            </h1>
                            <p style="color: #e0e0e0; font-size: 16px;">Hello <strong>${clientName}</strong>,</p>
                            <p style="color: #e0e0e0; font-size: 15px; line-height: 1.6;">
                                We inform you that the payment for the scholarship maintenance fee installment <strong>#${installmentNumber}</strong>, due on ${formattedDate}, has not been received.
                            </p>
                            <div style="background: #0a0a0a; border: 1px solid #ff4d4d; padding: 20px; margin: 25px 0; border-radius: 8px;">
                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                    <tr>
                                        <td style="color: #888; padding-bottom: 5px;">Base Amount:</td>
                                        <td align="right" style="color: #e0e0e0;">$105.00</td>
                                    </tr>
                                    <tr>
                                        <td style="color: #ff4d4d; padding-bottom: 10px;">Late Fee:</td>
                                        <td align="right" style="color: #ff4d4d;">+ $50.00</td>
                                    </tr>
                                    <tr>
                                        <td style="color: #F3E196; font-weight: bold; padding-top: 10px; font-size: 18px;">Total Due:</td>
                                        <td align="right" style="color: #F3E196; font-weight: bold; padding-top: 10px; font-size: 20px;">US$ ${Number(totalAmount).toFixed(2)}</td>
                                    </tr>
                                </table>
                            </div>
                            <div style="text-align: center; margin-top: 35px;">
                                <a href="${checkoutUrl}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(180deg, #F3E196 0%, #CE9F48 100%); color: #000; text-decoration: none; font-weight: bold; border-radius: 6px; font-size: 16px;">
                                    Regularize Scholarship Fee Now →
                                </a>
                            </div>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
}
