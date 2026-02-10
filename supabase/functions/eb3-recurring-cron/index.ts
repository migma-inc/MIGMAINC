import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    // 🔒 SECURITY: Verify authorization
    const authHeader = req.headers.get('authorization');
    const cronSecret = Deno.env.get('CRON_SECRET_KEY');

    // Allow either service role key OR cron secret
    const isAuthorized = authHeader?.includes(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '') ||
        authHeader?.includes(cronSecret || '');

    if (!isAuthorized) {
        console.error('[EB-3 Cron] ❌ Unauthorized request');
        return new Response(
            JSON.stringify({ error: 'Unauthorized' }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 401,
            }
        );
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        );

        console.log('[EB-3 Cron] Starting EB-3 recurring check...');

        // ========================================
        // 📅 MODO PRODUÇÃO: Enviar e-mails 7 dias antes
        // ========================================
        // Para TESTE: mudar TEST_MODE para true
        const TEST_MODE = false;  // ✅ Modo produção ativado

        // Step 1: Check and mark overdue installments
        const { data: overdueChecked, error: overdueError } = await supabaseClient
            .rpc('check_eb3_overdue');

        if (overdueError) {
            console.error('[EB-3 Cron] Error checking overdue:', overdueError);
        } else {
            console.log(`[EB-3 Cron] Marked ${overdueChecked} installments as overdue`);
        }

        // Step 2: Send reminder emails
        let remindersToSend;

        if (TEST_MODE) {
            // 🧪 TESTE: Enviar para TODAS as parcelas pendentes (independente da data)
            console.log('[EB-3 Cron] 🧪 TEST MODE: Sending reminders for ALL pending installments');

            const { data, error: remindersError } = await supabaseClient
                .from('eb3_recurrence_schedules')
                .select(`
          id,
          installment_number,
          due_date,
          amount_usd,
          client_id,
          email_sent_at,
          clients!inner(full_name, email),
          visa_orders!eb3_recurrence_schedules_order_id_fkey(seller_id)
        `)
                .eq('status', 'pending')
                .is('email_sent_at', null)
                .limit(10);  // Limitar a 10 para não spammar

            remindersToSend = data;
            if (remindersError) {
                console.error('[EB-3 Cron] Error fetching test reminders:', remindersError);
            }
        } else {
            // 📅 PRODUÇÃO: Enviar para qualquer parcela pendente que vença nos próximos 7 dias
            // e que ainda não tenha recebido e-mail.
            const sevenDaysFromNow = new Date();
            sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
            const reminderLimitDate = sevenDaysFromNow.toISOString().split('T')[0];

            const { data, error: remindersError } = await supabaseClient
                .from('eb3_recurrence_schedules')
                .select(`
                  id,
                  installment_number,
                  due_date,
                  amount_usd,
                  client_id,
                  email_sent_at,
                  clients!inner(full_name, email),
                  visa_orders!eb3_recurrence_schedules_order_id_fkey(is_test, seller_id)
                `)
                .eq('status', 'pending')
                .lte('due_date', reminderLimitDate)
                .is('email_sent_at', null)
                .eq('visa_orders.is_test', false); // 🛡️ Filtrar ordens de teste

            remindersToSend = data;
            if (remindersError) {
                console.error('[EB-3 Cron] Error fetching reminders:', remindersError);
            }
        }

        if (remindersToSend && remindersToSend.length > 0) {
            console.log(`[EB-3 Cron] Found ${remindersToSend.length} reminders to send`);

            for (const schedule of remindersToSend) {
                try {
                    // Create prefill token for standard checkout flow
                    const token = crypto.randomUUID();
                    const expiresAt = new Date();
                    expiresAt.setDate(expiresAt.getDate() + 30);
                    const sellerId = (schedule as any).visa_orders?.seller_id || null;

                    await supabaseClient.from('checkout_prefill_tokens').insert({
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

                    const siteUrl = 'http://localhost:5173';
                    const sellerParam = sellerId ? `&seller=${sellerId}` : '';
                    const checkoutUrl = `${siteUrl}/checkout/visa/eb3-installment-monthly?prefill=${token}${sellerParam}`;

                    // English subjects for the client
                    const subject = schedule.installment_number === 1
                        ? '🔗 Your 1st EB-3 Installment is available'
                        : `EB-3 Payment Reminder - Installment #${schedule.installment_number}`;

                    // Call email service
                    const { error: emailError } = await supabaseClient.functions.invoke('send-email', {
                        body: {
                            to: schedule.clients.email,
                            subject: subject,
                            html: generateReminderEmail(
                                schedule.clients.full_name,
                                schedule.installment_number,
                                schedule.due_date,
                                schedule.amount_usd,
                                checkoutUrl
                            )
                        }
                    });

                    if (emailError) {
                        console.error(`[EB-3 Cron] Failed to send reminder to ${schedule.clients.email}:`, emailError);
                    } else {
                        // Mark as sent
                        await supabaseClient
                            .from('eb3_recurrence_schedules')
                            .update({
                                email_sent_at: new Date().toISOString(),
                                email_reminder_count: 1
                            })
                            .eq('id', schedule.id);

                        console.log(`[EB-3 Cron] ✅ Sent reminder to ${schedule.clients.email}`);
                    }
                } catch (err) {
                    console.error(`[EB-3 Cron] Exception sending reminder:`, err);
                }
            }
        }

        // Step 3: Send late fee notifications (for newly overdue)
        const { data: overdueToNotify, error: overdueNotifyError } = await supabaseClient
            .from('eb3_recurrence_schedules')
            .select(`
        id,
        installment_number,
        due_date,
        amount_usd,
        late_fee_usd,
        client_id,
        email_reminder_count,
        clients!inner(full_name, email)
      `)
            .eq('status', 'overdue')
            .eq('email_reminder_count', 1); // Only send late fee email once

        if (overdueNotifyError) {
            console.error('[EB-3 Cron] Error fetching overdue notifications:', overdueNotifyError);
        } else if (overdueToNotify && overdueToNotify.length > 0) {
            console.log(`[EB-3 Cron] Found ${overdueToNotify.length} late fee notifications to send`);

            for (const schedule of overdueToNotify) {
                try {
                    const totalAmount = parseFloat(schedule.amount_usd) + parseFloat(schedule.late_fee_usd);

                    // Fetch seller_id for late fee
                    const { data: orderData } = await supabaseClient
                        .from('eb3_recurrence_schedules')
                        .select('visa_orders!eb3_recurrence_schedules_order_id_fkey(seller_id)')
                        .eq('id', schedule.id)
                        .single();
                    const sellerId = (orderData as any)?.visa_orders?.seller_id || null;

                    // Create prefill token for standard checkout flow
                    const token = crypto.randomUUID();
                    const expiresAt = new Date();
                    expiresAt.setDate(expiresAt.getDate() + 30);

                    await supabaseClient.from('checkout_prefill_tokens').insert({
                        token,
                        product_slug: 'eb3-installment-monthly',
                        seller_id: sellerId,
                        client_data: {
                            clientName: schedule.clients.full_name,
                            clientEmail: schedule.clients.email,
                            eb3_schedule_id: schedule.id,
                            installment_number: schedule.installment_number,
                            due_date: schedule.due_date,
                            amount_usd: totalAmount,
                            is_overdue: true,
                            late_fee_usd: schedule.late_fee_usd,
                        },
                        expires_at: expiresAt.toISOString(),
                    });

                    const siteUrl = 'http://localhost:5173';
                    const sellerParam = sellerId ? `&seller=${sellerId}` : '';
                    const checkoutUrl = `${siteUrl}/checkout/visa/eb3-installment-monthly?prefill=${token}${sellerParam}`;

                    const { error: emailError } = await supabaseClient.functions.invoke('send-email', {
                        body: {
                            to: schedule.clients.email,
                            subject: `⚠️ EB-3 Payment Overdue - Installment #${schedule.installment_number}`,
                            html: generateLateFeeEmail(
                                schedule.clients.full_name,
                                schedule.installment_number,
                                schedule.due_date,
                                totalAmount,
                                checkoutUrl
                            )
                        }
                    });

                    if (emailError) {
                        console.error(`[EB-3 Cron] Failed to send late fee notice to ${schedule.clients.email}:`, emailError);
                    } else {
                        // Mark late fee email as sent
                        await supabaseClient
                            .from('eb3_recurrence_schedules')
                            .update({ email_reminder_count: 2 })
                            .eq('id', schedule.id);

                        console.log(`[EB-3 Cron] ✅ Sent late fee notice to ${schedule.clients.email}`);
                    }
                } catch (err) {
                    console.error(`[EB-3 Cron] Exception sending late fee notice:`, err);
                }
            }
        }

        return new Response(
            JSON.stringify({
                success: true,
                overdue_marked: overdueChecked || 0,
                reminders_sent: remindersToSend?.length || 0,
                late_fee_notices_sent: overdueToNotify?.length || 0
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        );

    } catch (error) {
        console.error('[EB-3 Cron] Fatal error:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 500,
            }
        );
    }
});

// Email template functions (simplified - full HTML in actual implementation)
// Email template functions
function generateReminderEmail(clientName: string, installmentNumber: number, dueDate: string, amount: number, checkoutUrl: string): string {
    const formattedDate = new Date(dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const logoUrl = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/logo/logo2.png`;

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
                                EB-3 Payment Reminder
                            </h1>
                            <p style="color: #e0e0e0; font-size: 16px;">Hello <strong>${clientName}</strong>,</p>
                            <p style="color: #e0e0e0; font-size: 15px; line-height: 1.6;">
                                This is a friendly reminder that your monthly installment <strong>#${installmentNumber}</strong> is due soon.
                            </p>
                            <div style="background: #0a0a0a; border: 1px solid #CE9F48; padding: 20px; margin: 25px 0; border-radius: 8px;">
                                <p style="margin: 0 0 10px 0; color: #888;">Amount Due:</p>
                                <p style="margin: 0 0 20px 0; color: #F3E196; font-size: 24px; font-weight: bold;">US$ ${amount.toFixed(2)}</p>
                                <p style="margin: 0 0 10px 0; color: #888;">Due Date:</p>
                                <p style="margin: 0; color: #e0e0e0; font-size: 16px;">${formattedDate}</p>
                            </div>
                            <p style="background: rgba(206, 159, 72, 0.1); padding: 15px; border-left: 3px solid #CE9F48; color: #e0e0e0; font-size: 14px;">
                                <strong>Important:</strong> Please complete your payment by the due date to avoid a $50 late fee.
                            </p>
                            <div style="text-align: center; margin-top: 35px;">
                                <a href="${checkoutUrl}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(180deg, #F3E196 0%, #CE9F48 100%); color: #000; text-decoration: none; font-weight: bold; border-radius: 6px; font-size: 16px;">
                                    Pay Installment Now →
                                </a>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td align="center" style="padding: 25px;">
                            <p style="margin: 0; font-size: 12px; color: #666;">© 2026 MIGMA INC. All rights reserved.</p>
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

function generateLateFeeEmail(clientName: string, installmentNumber: number, dueDate: string, totalAmount: number, checkoutUrl: string): string {
    const formattedDate = new Date(dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const logoUrl = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/logo/logo2.png`;

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
                                ⚠️ Payment Overdue Notice
                            </h1>
                            <p style="color: #e0e0e0; font-size: 16px;">Hello <strong>${clientName}</strong>,</p>
                            <p style="color: #e0e0e0; font-size: 15px; line-height: 1.6;">
                                We inform you that the payment for installment <strong>#${installmentNumber}</strong>, due on ${formattedDate}, has not been received.
                            </p>
                            <div style="background: #0a0a0a; border: 1px solid #ff4d4d; padding: 20px; margin: 25px 0; border-radius: 8px;">
                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                    <tr>
                                        <td style="color: #888; padding-bottom: 5px;">Base Amount:</td>
                                        <td align="right" style="color: #e0e0e0;">$650.00</td>
                                    </tr>
                                    <tr>
                                        <td style="color: #ff4d4d; padding-bottom: 10px;">Late Fee:</td>
                                        <td align="right" style="color: #ff4d4d;">+ $50.00</td>
                                    </tr>
                                    <tr style="border-top: 1px solid #333;">
                                        <td style="color: #F3E196; font-weight: bold; padding-top: 10px; font-size: 18px;">Total Due:</td>
                                        <td align="right" style="color: #F3E196; font-weight: bold; padding-top: 10px; font-size: 20px;">US$ ${totalAmount.toFixed(2)}</td>
                                    </tr>
                                </table>
                            </div>
                            <div style="text-align: center; margin-top: 35px;">
                                <a href="${checkoutUrl}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(180deg, #F3E196 0%, #CE9F48 100%); color: #000; text-decoration: none; font-weight: bold; border-radius: 6px; font-size: 16px;">
                                    Regularize Payment Now →
                                </a>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td align="center" style="padding: 25px;">
                            <p style="margin: 0; font-size: 12px; color: #666;">© 2026 MIGMA INC. All rights reserved.</p>
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
