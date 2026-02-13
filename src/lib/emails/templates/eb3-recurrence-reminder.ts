import { getLayoutHtml } from '../components/Layout';
import { sendEmail } from '../service';

export function getEB3RecurrenceReminderHtml(
    clientName: string,
    installmentNumber: number,
    formattedDueDate: string,
    amount: number,
    checkoutUrl: string
): string {
    const content = `
        <!-- Main Content -->
        <tr>
            <td style="padding: 0 40px 40px; background-color: #000000;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                        <td style="padding: 30px; background: linear-gradient(135deg, #1a1a1a 0%, #000000 100%); border-radius: 8px; border: 1px solid #CE9F48;">
                            <h1 style="margin: 0 0 20px 0; font-size: 28px; font-weight: bold; color: #F3E196; text-align: center;">
                                EB-3 Visa Maintenance Payment Due Soon
                            </h1>
                            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                Dear ${clientName},
                            </p>
                            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                This is a friendly reminder that your <strong style="color: #CE9F48;">Monthly Installment #${installmentNumber}</strong> for the EB-3 visa maintenance program is due on <strong style="color: #CE9F48;">${formattedDueDate}</strong>.
                            </p>
                            
                            <div style="background: linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%); border: 1px solid #CE9F48; border-radius: 8px; padding: 20px; margin: 20px 0;">
                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                    <tr>
                                        <td style="padding: 10px 0; font-size: 16px; color: #CE9F48; font-weight: 600;">Installment:</td>
                                        <td align="right" style="padding: 10px 0; font-size: 16px; color: #ffffff; font-weight: 600;">#${installmentNumber} of 8</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 10px 0; font-size: 16px; color: #CE9F48; font-weight: 600;">Amount Due:</td>
                                        <td align="right" style="padding: 10px 0; font-size: 20px; color: #ffffff; font-weight: 700;">$${amount.toFixed(2)}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 10px 0; font-size: 16px; color: #CE9F48; font-weight: 600;">Due Date:</td>
                                        <td align="right" style="padding: 10px 0; font-size: 16px; color: #ffffff; font-weight: 600;">${formattedDueDate}</td>
                                    </tr>
                                </table>
                            </div>

                            <p style="margin: 20px 0; font-size: 14px; line-height: 1.6; color: #e0e0e0; background: linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%); padding: 15px; border-radius: 6px; border-left: 3px solid #CE9F48;">
                                <strong style="color: #CE9F48;">Important:</strong> Please make your payment by the due date to avoid a late fee of <strong>$50.00</strong>.
                            </p>

                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 30px 0;">
                                <tr>
                                    <td align="center">
                                        <a href="${checkoutUrl}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(180deg, #8E6E2F 0%, #F3E196 25%, #CE9F48 50%, #F3E196 75%, #8E6E2F 100%); color: #000000; text-decoration: none; font-weight: 700; font-size: 16px; border-radius: 6px; text-align: center;">
                                            Pay Now
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #a0a0a0; text-align: center;">
                                Thank you for your continued trust in MIGMA Inc.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
        <tr>
            <td style="padding: 20px 40px; background-color: #000000; border-top: 1px solid #222;">
                <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #666; text-align: center;">
                    This is an automated reminder for your EB-3 visa maintenance program.
                </p>
            </td>
        </tr>
    `;
    return getLayoutHtml(content);
}

export async function sendEB3RecurrenceReminderEmail(
    email: string,
    clientName: string,
    installmentNumber: number,
    dueDate: string,
    amount: number,
    checkoutUrl: string
): Promise<boolean> {
    const formattedDueDate = new Date(dueDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const html = getEB3RecurrenceReminderHtml(
        clientName,
        installmentNumber,
        formattedDueDate,
        amount,
        checkoutUrl
    );

    const subject = `EB-3 Payment Reminder - Installment #${installmentNumber} Due ${formattedDueDate}`;
    return sendEmail({ to: email, subject, html });
}
