import { getLayoutHtml } from '../components/Layout';
import { sendEmail } from '../service';

export function getContractViewLinkHtml(
    fullName: string,
    viewUrl: string
): string {
    const content = `
        <!-- Main Content -->
        <tr>
            <td style="padding: 0 40px 40px; background-color: #000000;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                        <td style="padding: 30px; background: linear-gradient(135deg, #1a1a1a 0%, #000000 100%); border-radius: 8px; border: 1px solid #CE9F48;">
                            <h1 style="margin: 0 0 20px 0; font-size: 28px; font-weight: bold; color: #F3E196; text-align: center; background: linear-gradient(180deg, #8E6E2F 0%, #F3E196 25%, #CE9F48 50%, #F3E196 75%, #8E6E2F 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                                Your Contract Has Been Signed!
                            </h1>
                            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                Dear ${fullName},
                            </p>
                            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                Thank you for signing your <strong style="color: #CE9F48;">MIGMA Global Partner Contract</strong>! Your contract has been successfully submitted and is now under review.
                            </p>
                            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                You can now view your signed contract, including your digital signature and identity documents, through our secure portal.
                            </p>
                            <!-- CTA Button -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td align="center" style="padding: 0 0 30px;">
                                        <a href="${viewUrl}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(180deg, #F3E196 0%, #CE9F48 50%, #F3E196 100%); color: #000000; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 12px rgba(206, 159, 72, 0.4);">
                                            View Your Signed Contract
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            <p style="text-align: center; margin: 0 0 30px 0; font-size: 14px; color: #999999;">
                                Or copy and paste this link into your browser:<br>
                                <span style="word-break: break-all; color: #CE9F48; font-size: 12px;">${viewUrl}</span>
                            </p>
                            <!-- Info Box -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="padding: 20px; background-color: #1a1a1a; border-left: 4px solid #CE9F48; border-radius: 4px; margin: 20px 0;">
                                        <p style="margin: 0; color: #F3E196; font-size: 14px; line-height: 1.6;">
                                            <strong style="color: #CE9F48;">Note:</strong> This document is protected and available for viewing only. Downloading, copying, or printing is disabled for security purposes. The link never expires and can be accessed at any time.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                            <p style="margin: 30px 0 0 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                Welcome to the MIGMA team! We look forward to working with you.
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
 * Email: Send secure link to view signed contract
 */
export async function sendContractViewLinkEmail(
    email: string,
    fullName: string,
    token: string,
    baseUrl?: string
): Promise<boolean> {
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
    const viewUrl = `${origin}/view-contract?token=${token}`;

    const html = getContractViewLinkHtml(fullName, viewUrl);

    return sendEmail({
        to: email,
        subject: 'Your MIGMA Global Partner Contract Has Been Signed - View Your Contract',
        html: html,
    });
}
