import { getLayoutHtml } from '../components/Layout';
import { sendEmail } from '../service';

export function getMeetingInvitationHtml(
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
                                Your Application Has Been Approved!
                            </h1>
                            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                Dear ${fullName},
                            </p>
                            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                We are excited to inform you that your application to become a <strong style="color: #CE9F48;">MIGMA Global Partner</strong> has been <strong style="color: #F3E196;">approved</strong>!
                            </p>
                            <p style="margin: 0 0 30px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                The next step is to schedule a meeting with our team. We have scheduled a meeting for you:
                            </p>
                            <!-- Meeting Details Card -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="padding: 25px; background-color: #1a1a1a; border: 2px solid #CE9F48; border-radius: 8px; margin: 20px 0;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td style="padding-bottom: 15px;">
                                                    <p style="margin: 0 0 8px 0; font-size: 14px; color: #999999; text-transform: uppercase; letter-spacing: 0.5px;">Meeting Date</p>
                                                    <p style="margin: 0; font-size: 20px; font-weight: bold; color: #F3E196;">${formattedDate}</p>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding-bottom: 15px;">
                                                    <p style="margin: 0 0 8px 0; font-size: 14px; color: #999999; text-transform: uppercase; letter-spacing: 0.5px;">Meeting Time</p>
                                                    <p style="margin: 0; font-size: 20px; font-weight: bold; color: #F3E196;">${meetingTime}</p>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding-top: 15px; border-top: 1px solid #333333;">
                                                    <p style="margin: 0 0 15px 0; font-size: 14px; color: #999999; text-transform: uppercase; letter-spacing: 0.5px;">Meeting Link</p>
                                                    <a href="${meetingLink}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(180deg, #F3E196 0%, #CE9F48 50%, #F3E196 100%); color: #000000; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 12px rgba(206, 159, 72, 0.4); margin-bottom: 10px;">
                                                        Join Meeting
                                                    </a>
                                                    <p style="margin: 10px 0 0 0; font-size: 12px; color: #999999; word-break: break-all;">
                                                        ${meetingLink}
                                                    </p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            <p style="margin: 30px 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                Please make sure to:
                            </p>
                            <ul style="margin: 0 0 30px 0; padding-left: 20px; color: #e0e0e0; font-size: 16px; line-height: 1.8;">
                                <li style="margin-bottom: 10px;">Test your internet connection before the meeting</li>
                                <li style="margin-bottom: 10px;">Have a quiet environment ready</li>
                                <li style="margin-bottom: 10px;">Join the meeting a few minutes early</li>
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
 * Email: Meeting invitation after initial approval
 */
export async function sendMeetingInvitationEmail(
    email: string,
    fullName: string,
    meetingDate: string,
    meetingTime: string,
    meetingLink: string
): Promise<boolean> {
    // Format date for display - parse in local timezone to avoid timezone conversion issues
    const [year, month, day] = meetingDate.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    const formattedDate = dateObj.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    const html = getMeetingInvitationHtml(fullName, formattedDate, meetingTime, meetingLink);

    return sendEmail({
        to: email,
        subject: 'Meeting Invitation - MIGMA',
        html: html,
    });
}
