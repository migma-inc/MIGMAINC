import { getLayoutHtml } from '../components/Layout';
import { sendEmail } from '../service';

export function getEB3LateFeeHtml(
    clientName: string,
    installmentNumber: number,
    formattedDueDate: string,
    amount: number,
    checkoutUrl: string
): string {
    const baseAmount = 650.00;
    const lateFee = 50.00;

    const content = `
        <!-- Main Content -->
        <tr>
            <td style="padding: 0 40px 40px; background-color: #000000;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                        <td style="padding: 30px; background: linear-gradient(135deg, #1a1a1a 0%, #000000 100%); border-radius: 8px; border: 1px solid #CE9F48;">
                            <h1 style="margin: 0 0 20px 0; font-size: 28px; font-weight: bold; color: #ff6b6b; text-align: center;">
                                Overdue Payment - Late Fee Applied
                            </h1>
                            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                Dear ${clientName},
                            </p>
                            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                We noticed that Monthly Installment #${installmentNumber} was not received by ${formattedDueDate}. A late fee of <strong>$${lateFee.toFixed(2)}</strong> has been added.
                            </p>

                            <div style="background: linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%); border: 1px solid #ff6b6b; border-radius: 8px; padding: 20px; margin: 20px 0;">
                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                    <tr>
                                        <td style="padding: 10px 0; font-size: 16px; color: #CE9F48; font-weight: 600;">Installment:</td>
                                        <td align="right" style="padding: 10px 0; font-size: 16px; color: #ffffff; font-weight: 600;">#${installmentNumber} of 8</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 10px 0; font-size: 16px; color: #CE9F48; font-weight: 600;">Base Amount:</td>
                                        <td align="right" style="padding: 10px 0; font-size: 16px; color: #ffffff; font-weight: 600;">$${baseAmount.toFixed(2)}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 10px 0; font-size: 16px; color: #ff6b6b; font-weight: 600;">Late Fee:</td>
                                        <td align="right" style="padding: 10px 0; font-size: 16px; color: #ff6b6b; font-weight: 600;">+ $${lateFee.toFixed(2)}</td>
                                    </tr>
                                    <tr style="border-top: 1px solid #333;">
                                        <td style="padding: 10px 0; font-size: 18px; color: #CE9F48; font-weight: 700;">Total Due:</td>
                                        <td align="right" style="padding: 10px 0; font-size: 22px; color: #ffffff; font-weight: 700;">$${amount.toFixed(2)}</td>
                                    </tr>
                                </table>
                            </div>

                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 30px 0;">
                                <tr>
                                    <td align="center">
                                        <a href="${checkoutUrl}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(180deg, #8E6E2F 0%, #CE9F48 50%, #8E6E2F 100%); color: #000000; text-decoration: none; font-weight: 700; font-size: 16px; border-radius: 6px; text-align: center;">
                                            Pay Now
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    `;
    return getLayoutHtml(content);
}

export async function sendEB3LateFeeEmail(
    email: string,
    clientName: string,
    installmentNumber: number,
    originalDueDate: string,
    totalAmount: number,
    checkoutUrl: string
): Promise<boolean> {
    const formattedDueDate = new Date(originalDueDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const html = getEB3LateFeeHtml(
        clientName,
        installmentNumber,
        formattedDueDate,
        totalAmount,
        checkoutUrl
    );

    const subject = `EB-3 Payment Overdue - Installment #${installmentNumber} + Late Fee`;
    return sendEmail({ to: email, subject, html });
}
