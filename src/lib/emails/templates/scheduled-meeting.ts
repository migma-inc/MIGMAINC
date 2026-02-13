import { getLayoutHtml } from '../components/Layout';
import { sendEmail } from '../service';

export function getScheduledMeetingHtml(
    fullName: string,
    formattedDate: string,
    meetingTime: string,
    meetingLink: string
): string {
    const content = `
        <!-- Main Content -->
        <tr>
            <td style="padding: 0 40px 40px; background-color: #000000;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                        <td style="padding: 30px; background: linear-gradient(135deg, #1a1a1a 0%, #000000 100%); border-radius: 8px; border: 1px solid #CE9F48;">
                            <h1 style="margin: 0 0 20px 0; font-size: 28px; font-weight: bold; color: #F3E196; text-align: center; background: linear-gradient(180deg, #8E6E2F 0%, #F3E196 25%, #CE9F48 50%, #F3E196 75%, #8E6E2F 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                                Meeting Confirmation
                            </h1>
                            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                Dear ${fullName},
                            </p>
                            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                Your meeting with <strong style="color: #CE9F48;">MIGMA</strong> has been successfully scheduled.
                            </p>
                            <!-- Meeting Details -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 20px 0; background-color: #1a1a1a; border-radius: 8px; padding: 20px;">
                                <tr>
                                    <td style="padding: 10px 0;">
                                        <p style="margin: 0 0 5px 0; font-size: 14px; color: #999999;">Date</p>
                                        <p style="margin: 0; font-size: 18px; font-weight: 600; color: #F3E196;">${formattedDate}</p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px 0;">
                                        <p style="margin: 0 0 5px 0; font-size: 14px; color: #999999;">Time</p>
                                        <p style="margin: 0; font-size: 18px; font-weight: 600; color: #F3E196;">${meetingTime}</p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px 0;">
                                        <p style="margin: 0 0 5px 0; font-size: 14px; color: #999999;">Meeting Link</p>
                                        <p style="margin: 0; font-size: 14px; color: #CE9F48; word-break: break-all;">${meetingLink}</p>
                                    </td>
                                </tr>
                            </table>
                            <!-- CTA Button -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td align="center" style="padding: 0 0 30px;">
                                        <a href="${meetingLink}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(180deg, #F3E196 0%, #CE9F48 50%, #F3E196 100%); color: #000000; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 12px rgba(206, 159, 72, 0.4);">
                                            Join Meeting
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                Please make sure to:
                            </p>
                            <ul style="margin: 0 0 20px 0; padding-left: 20px; color: #e0e0e0; font-size: 16px; line-height: 1.8;">
                                <li>Test your internet connection before the meeting</li>
                                <li>Have a quiet environment ready</li>
                                <li>Join the meeting a few minutes early</li>
                            </ul>
                            <p style="margin: 30px 0 0 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                We look forward to meeting with you!
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
 * Email: Send scheduled meeting invitation
 * Sent when admin schedules a meeting directly (not through Global Partner application)
 */
export async function sendScheduledMeetingEmail(
    email: string,
    fullName: string,
    meetingDate: string,
    meetingTime: string,
    meetingLink: string
): Promise<boolean> {
    // Format date
    const [year, month, day] = meetingDate.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const formattedDate = date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    const html = getScheduledMeetingHtml(fullName, formattedDate, meetingTime, meetingLink);

    return sendEmail({
        to: email,
        subject: 'Meeting Invitation - MIGMA',
        html: html,
    });
}
