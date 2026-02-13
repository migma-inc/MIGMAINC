import { sendEmail } from '../service';

/**
 * Get the HTML content for the Admin Reply Notification email
 */
export const getAdminReplyNotificationHtml = (
    userName: string,
    ticketSubject: string,
    ticketUrl: string
): string => {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #000000;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #000000;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; background-color: #000000; border-radius: 8px;">
                    <!-- Logo Header -->
                    <tr>
                        <td align="center" style="padding: 40px 20px 30px; background-color: #000000;">
                            <img src="https://ekxftwrjvxtpnqbraszv.supabase.co/storage/v1/object/public/logo/logo2.png" alt="MIGMA Logo" width="200" style="display: block; max-width: 200px; height: auto;">
                        </td>
                    </tr>
                    <!-- Alert Banner -->
                    <tr>
                        <td style="padding: 0 40px 20px;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="padding: 20px; background: linear-gradient(135deg, #CE9F48 0%, #F3E196 50%, #CE9F48 100%); border-radius: 8px; text-align: center;">
                                        <h1 style="margin: 0; font-size: 24px; font-weight: bold; color: #000000;">New Response to Your Ticket</h1>
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
                                            Dear ${userName},
                                        </p>
                                        <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                            Our team has responded to your support ticket: <strong style="color: #F3E196;">${ticketSubject}</strong>
                                        </p>
                                        <p style="margin: 0 0 30px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                            Click the button below to view the response and continue the conversation:
                                        </p>
                                        <!-- CTA Button -->
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td align="center" style="padding: 0 0 30px;">
                                                    <a href="${ticketUrl}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(180deg, #F3E196 0%, #CE9F48 50%, #F3E196 100%); color: #000000; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 12px rgba(206, 159, 72, 0.4);">
                                                        View Response
                                                    </a>
                                                </td>
                                            </tr>
                                        </table>
                                        <p style="text-align: center; margin: 0 0 20px 0; font-size: 14px; color: #999999;">
                                            Or copy and paste this link into your browser:<br>
                                            <span style="word-break: break-all; color: #CE9F48; font-size: 12px;">${ticketUrl}</span>
                                        </p>
                                        <p style="margin: 30px 0 0 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                            Best regards,<br>
                                            <strong style="color: #CE9F48;">The MIGMA Team</strong>
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td align="center" style="padding: 20px 40px; background-color: #000000;">
                            <p style="margin: 0 0 10px 0; font-size: 11px; color: #999999; line-height: 1.5; font-style: italic;">
                                This is an automated message. Please do not reply to this email.
                            </p>
                            <p style="margin: 0; font-size: 12px; color: #666666; line-height: 1.5;">
                                © MIGMA. All rights reserved.
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
};

/**
 * Email: Admin Reply Notification
 * Sent to user when admin responds to their support ticket
 */
export async function sendAdminReplyNotification(
    userEmail: string,
    userName: string,
    ticketSubject: string,
    token: string,
    baseUrl?: string
): Promise<boolean> {
    // Get base URL
    const getBaseUrl = (): string => {
        if (baseUrl) return baseUrl;

        const envUrl = import.meta.env.VITE_APP_URL;
        if (envUrl) return envUrl;

        if (typeof window !== 'undefined' && window.location.origin) {
            return window.location.origin;
        }

        return 'https://migmainc.com';
    };

    const origin = getBaseUrl();
    const ticketUrl = `${origin}/support/ticket?token=${token}`;

    const html = getAdminReplyNotificationHtml(userName, ticketSubject, ticketUrl);

    return sendEmail({
        to: userEmail,
        subject: `New Response to Your Ticket: ${ticketSubject}`,
        html: html,
    });
}
