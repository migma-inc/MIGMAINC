import { getLayoutHtml } from '../components/Layout';

import { sendEmail } from '../service';

export function getApplicationConfirmationHtml(fullName: string): string {
    const content = `
        <!-- Main Content -->
        <tr>
            <td style="padding: 0 40px 40px; background-color: #000000;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                        <td style="padding: 30px; background: linear-gradient(135deg, #1a1a1a 0%, #000000 100%); border-radius: 8px; border: 1px solid #CE9F48;">
                            <h1 style="margin: 0 0 20px 0; font-size: 28px; font-weight: bold; color: #F3E196; text-align: center; background: linear-gradient(180deg, #8E6E2F 0%, #F3E196 25%, #CE9F48 50%, #F3E196 75%, #8E6E2F 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                                Thank You for Applying!
                            </h1>
                            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                Dear ${fullName},
                            </p>
                            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                We have received your application to become a <strong style="color: #CE9F48;">MIGMA Global Partner</strong>.
                            </p>
                            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                Our team will review your profile and, if there is a fit, you will receive an email with a link to schedule an online interview.
                            </p>
                            <p style="margin: 0 0 30px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                We appreciate your interest in working with MIGMA.
                            </p>
                            <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                Best regards,<br>
                                <strong style="color: #CE9F48;">The MIGMA Team</strong>
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    `;
    return getLayoutHtml(content);
}


/**
 * Email 1: Confirmation after form submission
 */
export async function sendApplicationConfirmationEmail(email: string, fullName: string): Promise<boolean> {
    const html = getApplicationConfirmationHtml(fullName);

    return sendEmail({
        to: email,
        subject: 'Application Received - MIGMA Global Partner Program',
        html: html,
    });
}
