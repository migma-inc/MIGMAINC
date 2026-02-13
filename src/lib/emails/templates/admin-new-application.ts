import { sendEmail } from '../service';
import { getLayoutHtml } from '../components/Layout';

export interface AdminNewApplicationData {
    fullName: string;
    email: string;
    country: string;
    applicationId: string;
}

export function getAdminNewApplicationHtml(
    data: AdminNewApplicationData,
    dashboardUrl: string,
    submissionDateTime: string
): string {
    const content = `
    <!--Alert Banner-->
        <tr>
        <td style="padding: 0 40px 20px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                <td style="padding: 20px; background: linear-gradient(135deg, #CE9F48 0%, #F3E196 50%, #CE9F48 100%); border-radius: 8px; text-align: center;">
                    <h1 style="margin: 0; font-size: 24px; font-weight: bold; color: #000000;">New Application Received</h1>
                        </td>
                        </tr>
                        </table>
                        </td>
                        </tr>
                        <!--Main Content-->
                            <tr>
                            <td style="padding: 0 40px 40px; background-color: #000000;">
                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                    <tr>
                                    <td style="padding: 30px; background: linear-gradient(135deg, #1a1a1a 0%, #000000 100%); border-radius: 8px; border: 1px solid #CE9F48;">
                                        <h2 style="margin: 0 0 20px 0; font-size: 20px; font-weight: bold; color: #F3E196;">Application Summary</h2>
                                            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                                A new candidate has submitted an application for the <strong style="color: #CE9F48;">MIGMA Global Partner Program</strong>.
                                                    </p>

                                                    <!--Candidate Info Card-->
                                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                            <tr>
                                                            <td style="padding: 20px; background-color: #1a1a1a; border: 1px solid #CE9F48; border-radius: 8px; margin: 20px 0;">
                                                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                                    <tr>
                                                                    <td style="padding-bottom: 12px;">
                                                                        <p style="margin: 0 0 4px 0; font-size: 12px; color: #999999; text-transform: uppercase; letter-spacing: 0.5px;">Candidate Name</p>
                                                                            <p style="margin: 0; font-size: 18px; font-weight: bold; color: #F3E196;">${data.fullName}</p>
                                                                                </td>
                                                                                </tr>
                                                                                <tr>
                                                                                <td style="padding-bottom: 12px; border-top: 1px solid #333333; padding-top: 12px;">
                                                                                    <p style="margin: 0 0 4px 0; font-size: 12px; color: #999999; text-transform: uppercase; letter-spacing: 0.5px;">Email</p>
                                                                                        <p style="margin: 0; font-size: 16px; color: #e0e0e0;">${data.email}</p>
                                                                                            </td>
                                                                                            </tr>
                                                                                            <tr>
                                                                                            <td style="padding-bottom: 12px; border-top: 1px solid #333333; padding-top: 12px;">
                                                                                                <p style="margin: 0 0 4px 0; font-size: 12px; color: #999999; text-transform: uppercase; letter-spacing: 0.5px;">Country</p>
                                                                                                    <p style="margin: 0; font-size: 16px; color: #e0e0e0;">${data.country}</p>
                                                                                                        </td>
                                                                                                        </tr>
                                                                                                        <tr>
                                                                                                        <td style="padding-top: 12px; border-top: 1px solid #333333;">
                                                                                                            <p style="margin: 0 0 4px 0; font-size: 12px; color: #999999; text-transform: uppercase; letter-spacing: 0.5px;">Submission Date</p>
                                                                                                                <p style="margin: 0; font-size: 14px; color: #e0e0e0;">${submissionDateTime}</p>
                                                                                                                    </td>
                                                                                                                    </tr>
                                                                                                                    </table>
                                                                                                                    </td>
                                                                                                                    </tr>
                                                                                                                    </table>

                                                                                                                    <!--CTA Button-->
                                                                                                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                                                                                            <tr>
                                                                                                                            <td align="center" style="padding: 30px 0 20px;">
                                                                                                                                <a href="${dashboardUrl}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(180deg, #F3E196 0%, #CE9F48 50%, #F3E196 100%); color: #000000; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 12px rgba(206, 159, 72, 0.4);">
                                                                                                                                    View in Dashboard
                                                                                                                                    </a>
                                                                                                                                    </td>
                                                                                                                                    </tr>
                                                                                                                                    </table>

                                                                                                                                    <p style="text-align: center; margin: 0 0 20px 0; font-size: 14px; color: #999999;">
                                                                                                                                        Or copy and paste this link into your browser:<br>
                                                                                                                                            <span style="word-break: break-all; color: #CE9F48; font-size: 12px;">${dashboardUrl}</span>
                                                                                                                                                </p>

                                                                                                                                                <!--Info Box-->
                                                                                                                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                                                                                                                        <tr>
                                                                                                                                                        <td style="padding: 15px; background-color: #1a1a1a; border-left: 4px solid #CE9F48; border-radius: 4px;">
                                                                                                                                                            <p style="margin: 0; color: #F3E196; font-size: 14px; line-height: 1.6;">
                                                                                                                                                                <strong style="color: #CE9F48;">Next Steps:</strong> Review the complete application in the admin dashboard and decide whether to approve, schedule an interview, or reject the candidate.
                                                                                                                                                                    </p>
                                                                                                                                                                    </td>
                                                                                                                                                                    </tr>
                                                                                                                                                                    </table>

                                                                                                                                                                    <p style="margin: 30px 0 0 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                                                                                                                                                        Best regards,<br>
                                                                                                                                                                            <strong style="color: #CE9F48;">MIGMA Automated System</strong>
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
 * Email: New Global Partner Application Notification for Admins
 * Sent to all admins when a new candidate submits the Global Partner application form
 */
export async function sendAdminNewApplicationNotification(
    adminEmail: string,
    applicationData: {
        fullName: string;
        email: string;
        country: string;
        applicationId: string;
    },
    baseUrl?: string
): Promise<boolean> {
    // Get base URL
    const getBaseUrl = (): string => {
        if (baseUrl) return baseUrl;
        const envUrl = import.meta.env.VITE_APP_URL;
        if (envUrl) {
            return envUrl.trim().replace(/\/+$/, '');
        }
        if (typeof window !== 'undefined' && window.location.origin) {
            return window.location.origin;
        }
        return 'https://migmainc.com';
    };

    const origin = getBaseUrl();
    // Link directly to the admin dashboard application detail page
    // Routes: admin dashboard is served at /dashboard and application detail at /dashboard/applications/:id
    const dashboardUrl = `${origin}/dashboard/applications/${applicationData.applicationId}`;

    // Format current date/time
    const submissionDateTime = new Date().toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
    });

    const html = getAdminNewApplicationHtml(applicationData, dashboardUrl, submissionDateTime);

    return sendEmail({
        to: adminEmail,
        subject: `New Global Partner Application: ${applicationData.fullName}`,
        html: html,
    });
}
