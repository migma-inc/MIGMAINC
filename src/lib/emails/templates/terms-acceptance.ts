import { getLayoutHtml } from '../components/Layout';
import { sendEmail } from '../service';

export function getTermsAcceptanceConfirmationHtml(fullName: string): string {
    const content = `
        <!-- Success Banner -->
        <tr>
            <td style="padding: 0 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                        <td style="padding: 25px; background: linear-gradient(135deg, #8E6E2F 0%, #CE9F48 50%, #8E6E2F 100%); border-radius: 8px; text-align: center;">
                            <h1 style="margin: 0 0 10px 0; font-size: 32px; font-weight: bold; color: #000000;">Agreement Accepted</h1>
                            <p style="margin: 0; font-size: 18px; color: #000000; font-weight: 600;">Welcome to the MIGMA Team!</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
        <!-- Main Content -->
        <tr>
            <td style="padding: 0 40px 40px; background-color: #000000;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                        <td style="padding: 30px; background: linear-gradient(135deg, #1a1a1a 0%, #000000 100%); border-radius: 8px; border: 1px solid #CE9F48;">
                            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                Dear ${fullName},
                            </p>
                            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                Thank you! Your acceptance of the <strong style="color: #CE9F48;">MIGMA Global Independent Contractor Terms &amp; Conditions</strong> has been successfully recorded.
                            </p>
                            
                            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                Your agreement has been received and is currently being verified by our team. We will complete the verification process and contact you shortly with your onboarding details and next steps.
                            </p>
                            
                            <p style="margin: 30px 0 0 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                Our team will contact you with your onboarding details and next steps shortly.
                            </p>
                            <p style="margin: 20px 0 0 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                We look forward to working with you as a <strong style="color: #CE9F48;">MIGMA Global Partner</strong>!
                            </p>
                            <p style="margin: 20px 0 0 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
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
 * Email: Send confirmation of terms acceptance
 */
export async function sendTermsAcceptanceConfirmationEmail(
    email: string,
    fullName: string
): Promise<boolean> {
    const html = getTermsAcceptanceConfirmationHtml(fullName);

    return sendEmail({
        to: email,
        subject: 'Agreement Accepted - MIGMA Global Partner Program',
        html: html,
    });
}
