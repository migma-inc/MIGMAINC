import { getLayoutHtml } from '../components/Layout';

import { sendEmail } from '../service';

export function getApprovalHtml(fullName: string, termsUrl: string): string {
    const content = `
        <!-- Success Banner -->
        <tr>
            <td style="padding: 0 40px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                        <td style="padding: 25px; background: linear-gradient(135deg, #8E6E2F 0%, #CE9F48 50%, #8E6E2F 100%); border-radius: 8px; text-align: center;">
                            <h1 style="margin: 0 0 10px 0; font-size: 32px; font-weight: bold; color: #000000;">Congratulations!</h1>
                            <p style="margin: 0; font-size: 18px; color: #000000; font-weight: 600;">Your application has been approved</p>
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
                                We are thrilled to inform you that your application to become a <strong style="color: #CE9F48;">MIGMA Global Partner</strong> has been <strong style="color: #F3E196;">approved</strong>!
                            </p>
                            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                You are one step away from joining our team. To complete your onboarding, please:
                            </p>
                            <ol style="margin: 0 0 30px 0; padding-left: 20px; color: #e0e0e0; font-size: 16px; line-height: 1.8;">
                                <li style="margin-bottom: 10px;">Review our Global Independent Contractor Terms &amp; Conditions</li>
                                <li style="margin-bottom: 10px;">Upload a photo of yourself with your identity document</li>
                                <li style="margin-bottom: 10px;">Accept the terms to finalize your partnership</li>
                            </ol>
                            <!-- CTA Button -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td align="center" style="padding: 0 0 30px;">
                                        <a href="${termsUrl}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(180deg, #F3E196 0%, #CE9F48 50%, #F3E196 100%); color: #000000; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 12px rgba(206, 159, 72, 0.4);">
        Review and Accept Terms
    </a>
                                    </td>
                                </tr>
                            </table>
                            <p style="text-align: center; margin: 0 0 30px 0; font-size: 14px; color: #999999;">
                                Or copy and paste this link into your browser:<br>
                                <span style="word-break: break-all; color: #CE9F48; font-size: 12px;">${termsUrl}</span>
                            </p>
                            <!-- Warning Box -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="padding: 20px; background-color: #1a1a1a; border-left: 4px solid #CE9F48; border-radius: 4px; margin: 20px 0;">
                                        <p style="margin: 0; color: #F3E196; font-size: 14px; line-height: 1.6;">
                                            <strong style="color: #CE9F48;">Important:</strong> This link will expire in 30 days. Please complete the process as soon as possible to begin your partnership with MIGMA.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            <p style="margin: 30px 0 0 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                We look forward to working with you!
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
 * Email 2: Send terms acceptance link after manual approval
 * This is the approval email sent when admin approves an application
 */
export async function sendApprovalEmail(
    email: string,
    fullName: string,
    token: string,
    baseUrl?: string
): Promise<boolean> {
    // Get base URL from:
    // 1. Explicit baseUrl parameter (if provided)
    // 2. Environment variable VITE_APP_URL (for production)
    // 3. window.location.origin (if in browser)
    // 4. Fallback to production URL
    const getBaseUrl = (): string => {
        if (baseUrl) return baseUrl;

        // Try environment variable first (for production builds)
        const envUrl = import.meta.env.VITE_APP_URL;
        console.log('[EMAIL DEBUG] Environment variable check:', {
            VITE_APP_URL: envUrl,
            exists: !!envUrl,
            type: typeof envUrl
        });

        if (envUrl) {
            // Remove trailing slash and return
            const normalizedUrl = envUrl.trim().replace(/\/+$/, '');
            console.log('[EMAIL DEBUG] Using environment variable:', normalizedUrl);
            return normalizedUrl;
        }

        // If in browser, use current origin
        if (typeof window !== 'undefined' && window.location.origin) {
            console.log('[EMAIL DEBUG] Using browser origin:', window.location.origin);
            return window.location.origin;
        }

        // Fallback (should be set via VITE_APP_URL in production)
        console.log('[EMAIL DEBUG] Using fallback URL: https://migmainc.com');
        return 'https://migmainc.com';
    };

    const origin = getBaseUrl();
    const termsUrl = `${origin}/partner-terms?token=${token}`;

    // Log the URL being used for debugging
    console.log('[EMAIL DEBUG] Approval email link URL:', {
        email,
        baseUrl: origin,
        fullUrl: termsUrl,
        isLocalhost: origin.includes('localhost') || origin.includes('127.0.0.1'),
        source: baseUrl ? 'parameter' : (import.meta.env.VITE_APP_URL ? 'env' : (typeof window !== 'undefined' ? 'browser' : 'fallback')),
        envVarValue: import.meta.env.VITE_APP_URL
    });

    const html = getApprovalHtml(fullName, termsUrl);

    return sendEmail({
        to: email,
        subject: 'Congratulations! Your MIGMA Global Partner Application Has Been Approved',
        html: html,
    });
}

/**
 * Email 2 (Legacy): Send terms acceptance link after manual approval
 * @deprecated Use sendApprovalEmail instead
 */
export async function sendTermsLinkEmail(
    email: string,
    fullName: string,
    token: string,
    baseUrl?: string
): Promise<boolean> {
    return sendApprovalEmail(email, fullName, token, baseUrl);
}
