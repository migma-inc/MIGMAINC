import { getLayoutHtml } from '../components/Layout';
import { sendEmail } from '../service';

export function getRejectionAfterMeetingHtml(fullName: string): string {
    const content = `
        <!-- Main Content -->
        <tr>
            <td style="padding: 0 40px 40px; background-color: #000000;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                        <td style="padding: 30px; background: linear-gradient(135deg, #1a1a1a 0%, #000000 100%); border-radius: 8px; border: 1px solid #CE9F48;">
                            <h1 style="margin: 0 0 20px 0; font-size: 28px; font-weight: bold; color: #F3E196; text-align: center; background: linear-gradient(180deg, #8E6E2F 0%, #F3E196 25%, #CE9F48 50%, #F3E196 75%, #8E6E2F 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                                Update on Your Application
                            </h1>
                            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                Dear ${fullName},
                            </p>
                            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                Thank you for taking the time to meet with us regarding the <strong style="color: #CE9F48;">MIGMA Global Partner</strong> opportunity. We appreciated the chance to learn more about your background and experience.
                            </p>
                            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                After careful consideration, we regret to inform you that we will not be proceeding with your application at this time.
                            </p>
                            <p style="margin: 0 0 30px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                We wish you the best in your future endeavors.
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
 * Email 3 (Legacy): Confirmation after terms acceptance
 * Note of caution: Function name preserved from legacy for compatibility.
 */
export async function sendApplicationRejectedAfterMeetingEmail(
    email: string,
    fullName: string
): Promise<boolean> {
    const html = getRejectionAfterMeetingHtml(fullName);

    return sendEmail({
        to: email,
        subject: 'Update on Your MIGMA Global Partner Application',
        html: html,
    });
}
