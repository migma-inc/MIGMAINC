/**
 * Email service integration via Supabase Edge Function using SMTP Google
 * 
 * This file contains functions to send emails for the Global Partner Program.
 * Emails are sent via Supabase Edge Function using SMTP Google directly.
 */

import { supabase } from './supabase';

export interface EmailOptions {
    to: string;
    subject: string;
    html: string;
    from?: string;
}

/**
 * Send email using Supabase Edge Function (which uses SMTP Google)
 * This avoids CORS issues by calling our backend instead of SMTP directly
 */
async function sendEmail(options: EmailOptions): Promise<boolean> {
    try {
        console.log('[EMAIL DEBUG] Attempting to send email:', {
            to: options.to,
            subject: options.subject,
            htmlLength: options.html.length,
            // from será definido pela Edge Function usando SMTP_FROM_EMAIL do Supabase Secrets
        });

        // Call Supabase Edge Function
        // Não passar 'from' - deixar a Edge Function usar SMTP_FROM_EMAIL do Supabase Secrets
        const { data, error } = await supabase.functions.invoke('send-email', {
            body: {
                to: options.to,
                subject: options.subject,
                html: options.html,
                // from será definido pela Edge Function usando SMTP_FROM_EMAIL do Supabase Secrets
            },
        });

        if (error) {
            console.error('[EMAIL DEBUG] Error calling Edge Function:', error);
            return false;
        }

        if (data?.error) {
            console.error('[EMAIL DEBUG] Error from Edge Function:', data.error);
            if (data.hint) {
                console.error('[EMAIL DEBUG] Hint:', data.hint);
            }
            return false;
        }

        console.log('[EMAIL DEBUG] Email sent successfully:', data);
        return true;
    } catch (error) {
        console.error('[EMAIL DEBUG] Exception sending email:', error);
        return false;
    }
}

/**
 * Email 1: Confirmation after form submission
 */
export async function sendApplicationConfirmationEmail(email: string, fullName: string): Promise<boolean> {
    const html = `
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
                    <!-- Footer -->
                    <tr>
                        <td align="center" style="padding: 20px 40px; background-color: #000000;">
                            <p style="margin: 0 0 10px 0; font-size: 11px; color: #999999; line-height: 1.5; font-style: italic;">
                                This is an automated message. Please do not reply to this email.
                            </p>
                            <p style="margin: 0; font-size: 12px; color: #666666; line-height: 1.5;">
                                © 2025 MIGMA. All rights reserved.
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

    return sendEmail({
        to: email,
        subject: 'Application Received - MIGMA Global Partner Program',
        html: html,
    });
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

    const html = `
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
                    <!-- Footer -->
                    <tr>
                        <td align="center" style="padding: 20px 40px; background-color: #000000;">
                            <p style="margin: 0 0 10px 0; font-size: 11px; color: #999999; line-height: 1.5; font-style: italic;">
                                This is an automated message. Please do not reply to this email.
                            </p>
                            <p style="margin: 0; font-size: 12px; color: #666666; line-height: 1.5;">
                                © 2025 MIGMA. All rights reserved.
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

    const html = `
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
                    <!-- Footer -->
                    <tr>
                        <td align="center" style="padding: 20px 40px; background-color: #000000;">
                            <p style="margin: 0 0 10px 0; font-size: 11px; color: #999999; line-height: 1.5; font-style: italic;">
                                This is an automated message. Please do not reply to this email.
                            </p>
                            <p style="margin: 0; font-size: 12px; color: #666666; line-height: 1.5;">
                                © 2025 MIGMA. All rights reserved.
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

    return sendEmail({
        to: email,
        subject: 'Your MIGMA Global Partner Application Has Been Approved - Meeting Scheduled',
        html: html,
    });
}

/**
 * Email: Meeting details update notification
 * Sent when meeting information is updated
 */
export async function sendMeetingUpdateEmail(
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

    const html = `
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
                    <!-- Main Content -->
                    <tr>
                        <td style="padding: 0 40px 40px; background-color: #000000;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="padding: 30px; background: linear-gradient(135deg, #1a1a1a 0%, #000000 100%); border-radius: 8px; border: 1px solid #CE9F48;">
                                        <h1 style="margin: 0 0 20px 0; font-size: 28px; font-weight: bold; color: #F3E196; text-align: center; background: linear-gradient(180deg, #8E6E2F 0%, #F3E196 25%, #CE9F48 50%, #F3E196 75%, #8E6E2F 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                                            Meeting Details Updated
                                        </h1>
                                        <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                            Dear ${fullName},
                                        </p>
                                        <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                            We would like to inform you that your meeting details have been <strong style="color: #CE9F48;">updated</strong>. Please review the new meeting information below:
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
                                            <li style="margin-bottom: 10px;">Update your calendar with the new meeting details</li>
                                            <li style="margin-bottom: 10px;">Test your internet connection before the meeting</li>
                                            <li style="margin-bottom: 10px;">Have a quiet environment ready</li>
                                            <li style="margin-bottom: 10px;">Join the meeting a few minutes early</li>
                                        </ul>
                                        <p style="margin: 30px 0 0 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                            We apologize for any inconvenience and look forward to meeting with you!
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
                    <!-- Footer -->
                    <tr>
                        <td align="center" style="padding: 20px 40px; background-color: #000000;">
                            <p style="margin: 0 0 10px 0; font-size: 11px; color: #999999; line-height: 1.5; font-style: italic;">
                                This is an automated message. Please do not reply to this email.
                            </p>
                            <p style="margin: 0; font-size: 12px; color: #666666; line-height: 1.5;">
                                © 2025 MIGMA. All rights reserved.
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

    return sendEmail({
        to: email,
        subject: 'Your MIGMA Meeting Details Have Been Updated',
        html: html,
    });
}

/**
 * Email 3: Confirmation after terms acceptance
 * Note: PDF is NOT sent to the candidate - only confirmation that acceptance was received
 */
export async function sendTermsAcceptanceConfirmationEmail(
    email: string, 
    fullName: string
): Promise<boolean> {
    const html = `
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
                    <!-- Footer -->
                    <tr>
                        <td align="center" style="padding: 20px 40px; background-color: #000000;">
                            <p style="margin: 0 0 10px 0; font-size: 11px; color: #999999; line-height: 1.5; font-style: italic;">
                                This is an automated message. Please do not reply to this email.
                            </p>
                            <p style="margin: 0; font-size: 12px; color: #666666; line-height: 1.5;">
                                © 2025 MIGMA. All rights reserved.
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

    return sendEmail({
        to: email,
        subject: 'Terms Accepted - Welcome to MIGMA Global Partner Program',
        html: html,
    });
}

/**
 * TEST FUNCTION: Enviar email de teste
 * Use esta função para testar o envio de emails via SMTP
 * 
 * Exemplo de uso no console do navegador:
 * import { testEmailSending } from '@/lib/emails';
 * await testEmailSending('seu-email@gmail.com');
 */
export async function testEmailSending(testEmail: string): Promise<boolean> {
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
        </head>
        <body style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #CE9F48;">Email de Teste - SMTP Google</h1>
        <p>Este é um email de teste do sistema MIGMA Global Partner.</p>
        <p>Se você recebeu este email, significa que a configuração SMTP está funcionando corretamente!</p>
            <p><strong>Data/Hora:</strong> ${new Date().toLocaleString('pt-BR')}</p>
            <p>Best regards,<br>The MIGMA Team</p>
        </body>
        </html>
    `;

    console.log('🧪 [TEST] Enviando email de teste para:', testEmail);
    
    const result = await sendEmail({
        to: testEmail,
        subject: 'Test Email - MIGMA Global Partner SMTP',
        html: html,
    });

    if (result) {
        console.log('✅ [TEST] Email de teste enviado com sucesso!');
    } else {
        console.error('❌ [TEST] Falha ao enviar email de teste');
    }

    return result;
}

/**
 * Email: Contract rejection - request to resubmit documents
 * Sent when admin/seller rejects a visa contract and needs documents resubmitted
 */
export async function sendContractRejectionEmail(
    email: string,
    fullName: string,
    orderNumber: string,
    token: string,
    rejectionReason?: string,
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
        if (envUrl) {
            // Remove trailing slash and return
            return envUrl.trim().replace(/\/+$/, '');
        }
        
        // If in browser, use current origin
        if (typeof window !== 'undefined' && window.location.origin) {
            return window.location.origin;
        }
        
        // Fallback (should be set via VITE_APP_URL in production)
        return 'https://migmainc.com';
    };
    
    const origin = getBaseUrl();
    const resubmitUrl = `${origin}/checkout/visa/resubmit?token=${token}`;

    const html = `
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
                    <!-- Main Content -->
                    <tr>
                        <td style="padding: 0 40px 40px; background-color: #000000;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="padding: 30px; background: linear-gradient(135deg, #1a1a1a 0%, #000000 100%); border-radius: 8px; border: 1px solid #CE9F48;">
                                        <h1 style="margin: 0 0 20px 0; font-size: 28px; font-weight: bold; color: #F3E196; text-align: center; background: linear-gradient(180deg, #8E6E2F 0%, #F3E196 25%, #CE9F48 50%, #F3E196 75%, #8E6E2F 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                                            Action Required: Resubmit Documents
                                        </h1>
                                        <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                            Dear ${fullName},
                                        </p>
                                        <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                            We have reviewed your visa service contract for order <strong style="color: #CE9F48;">${orderNumber}</strong> and need you to resubmit your identity documents.
                                        </p>
                                        ${rejectionReason ? `
                                        <div style="padding: 15px; background-color: #1a1a1a; border-left: 4px solid #CE9F48; border-radius: 4px; margin: 20px 0;">
                                            <p style="margin: 0; color: #F3E196; font-size: 14px; line-height: 1.6;">
                                                <strong style="color: #CE9F48;">Reason:</strong> ${rejectionReason}
                                            </p>
                                        </div>
                                        ` : ''}
                                        <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                            Please click the button below to access a secure page where you can:
                                        </p>
                                        <ol style="margin: 0 0 30px 0; padding-left: 20px; color: #e0e0e0; font-size: 16px; line-height: 1.8;">
                                            <li style="margin-bottom: 10px;">Upload a clear photo of the front of your ID document</li>
                                            <li style="margin-bottom: 10px;">Upload a clear photo of the back of your ID document</li>
                                            <li style="margin-bottom: 10px;">Upload a selfie holding your ID document</li>
                                            <li style="margin-bottom: 10px;">Accept the terms and conditions again</li>
                                        </ol>
                                        <!-- CTA Button -->
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td align="center" style="padding: 0 0 30px;">
                                                    <a href="${resubmitUrl}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(180deg, #F3E196 0%, #CE9F48 50%, #F3E196 100%); color: #000000; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 12px rgba(206, 159, 72, 0.4);">
                                                        Resubmit Documents
                                                    </a>
                                                </td>
                                            </tr>
                                        </table>
                                        <p style="text-align: center; margin: 0 0 30px 0; font-size: 14px; color: #999999;">
                                            Or copy and paste this link into your browser:<br>
                                            <span style="word-break: break-all; color: #CE9F48; font-size: 12px;">${resubmitUrl}</span>
                                        </p>
                                               <!-- Info Box -->
                                               <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                   <tr>
                                                       <td style="padding: 20px; background-color: #1a1a1a; border-left: 4px solid #CE9F48; border-radius: 4px; margin: 20px 0;">
                                                           <p style="margin: 0; color: #F3E196; font-size: 14px; line-height: 1.6;">
                                                               <strong style="color: #CE9F48;">Note:</strong> This link can be used once to resubmit your documents. Please complete the resubmission as soon as possible.
                                                           </p>
                                                       </td>
                                                   </tr>
                                               </table>
                                        <p style="margin: 30px 0 0 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                            If you have any questions, please contact our support team.
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
                    <!-- Footer -->
                    <tr>
                        <td align="center" style="padding: 20px 40px; background-color: #000000;">
                            <p style="margin: 0 0 10px 0; font-size: 11px; color: #999999; line-height: 1.5; font-style: italic;">
                                This is an automated message. Please do not reply to this email.
                            </p>
                            <p style="margin: 0; font-size: 12px; color: #666666; line-height: 1.5;">
                                © 2025 MIGMA. All rights reserved.
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

    return sendEmail({
        to: email,
        subject: 'Action Required: Resubmit Your Visa Service Documents',
        html: html,
    });
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
        
        // Try environment variable first (for production builds)
        const envUrl = import.meta.env.VITE_APP_URL;
        if (envUrl) {
            // Remove trailing slash and return
            return envUrl.trim().replace(/\/+$/, '');
        }
        
        // If in browser, use current origin
        if (typeof window !== 'undefined' && window.location.origin) {
            return window.location.origin;
        }
        
        // Fallback
        return 'https://migma.com';
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

    const html = `
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
                                        <h1 style="margin: 0; font-size: 24px; font-weight: bold; color: #000000;">New Application Received</h1>
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
                                        <h2 style="margin: 0 0 20px 0; font-size: 20px; font-weight: bold; color: #F3E196;">Application Summary</h2>
                                        <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                            A new candidate has submitted an application for the <strong style="color: #CE9F48;">MIGMA Global Partner Program</strong>.
                                        </p>
                                        
                                        <!-- Candidate Info Card -->
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td style="padding: 20px; background-color: #1a1a1a; border: 1px solid #CE9F48; border-radius: 8px; margin: 20px 0;">
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                        <tr>
                                                            <td style="padding-bottom: 12px;">
                                                                <p style="margin: 0 0 4px 0; font-size: 12px; color: #999999; text-transform: uppercase; letter-spacing: 0.5px;">Candidate Name</p>
                                                                <p style="margin: 0; font-size: 18px; font-weight: bold; color: #F3E196;">${applicationData.fullName}</p>
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td style="padding-bottom: 12px; border-top: 1px solid #333333; padding-top: 12px;">
                                                                <p style="margin: 0 0 4px 0; font-size: 12px; color: #999999; text-transform: uppercase; letter-spacing: 0.5px;">Email</p>
                                                                <p style="margin: 0; font-size: 16px; color: #e0e0e0;">${applicationData.email}</p>
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td style="padding-bottom: 12px; border-top: 1px solid #333333; padding-top: 12px;">
                                                                <p style="margin: 0 0 4px 0; font-size: 12px; color: #999999; text-transform: uppercase; letter-spacing: 0.5px;">Country</p>
                                                                <p style="margin: 0; font-size: 16px; color: #e0e0e0;">${applicationData.country}</p>
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
                                        
                                        <!-- CTA Button -->
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
                                        
                                        <!-- Info Box -->
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
                    <!-- Footer -->
                    <tr>
                        <td align="center" style="padding: 20px 40px; background-color: #000000;">
                            <p style="margin: 0 0 10px 0; font-size: 11px; color: #999999; line-height: 1.5; font-style: italic;">
                                This is an automated admin notification. Do not reply to this email.
                            </p>
                            <p style="margin: 0; font-size: 12px; color: #666666; line-height: 1.5;">
                                © 2025 MIGMA. All rights reserved.
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

    return sendEmail({
        to: adminEmail,
        subject: `New Global Partner Application: ${applicationData.fullName}`,
        html: html,
    });
}

/**
 * Email: Contact Message Access Link
 * Sent to user after they submit a contact form message
 * Includes unique link to access their support ticket
 */
export async function sendContactMessageAccessLink(
    email: string,
    name: string,
    subject: string,
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
        
        return 'https://migma.com';
    };
    
    const origin = getBaseUrl();
    const ticketUrl = `${origin}/support/ticket?token=${token}`;

    const html = `
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
                    <!-- Main Content -->
                    <tr>
                        <td style="padding: 0 40px 40px; background-color: #000000;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="padding: 30px; background: linear-gradient(135deg, #1a1a1a 0%, #000000 100%); border-radius: 8px; border: 1px solid #CE9F48;">
                                        <h1 style="margin: 0 0 20px 0; font-size: 28px; font-weight: bold; color: #F3E196; text-align: center; background: linear-gradient(180deg, #8E6E2F 0%, #F3E196 25%, #CE9F48 50%, #F3E196 75%, #8E6E2F 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                                            Message Received!
                                        </h1>
                                        <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                            Dear ${name},
                                        </p>
                                        <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                            Thank you for contacting <strong style="color: #CE9F48;">MIGMA</strong>. We have received your message regarding: <strong style="color: #F3E196;">${subject}</strong>
                                        </p>
                                        <p style="margin: 0 0 30px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                            Our team will review your message and respond as soon as possible. You can track the status and continue the conversation using the link below:
                                        </p>
                                        <!-- CTA Button -->
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td align="center" style="padding: 0 0 30px;">
                                                    <a href="${ticketUrl}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(180deg, #F3E196 0%, #CE9F48 50%, #F3E196 100%); color: #000000; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 12px rgba(206, 159, 72, 0.4);">
                                                        View Your Ticket
                                                    </a>
                                                </td>
                                            </tr>
                                        </table>
                                        <p style="text-align: center; margin: 0 0 30px 0; font-size: 14px; color: #999999;">
                                            Or copy and paste this link into your browser:<br>
                                            <span style="word-break: break-all; color: #CE9F48; font-size: 12px;">${ticketUrl}</span>
                                        </p>
                                        <!-- Info Box -->
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td style="padding: 20px; background-color: #1a1a1a; border-left: 4px solid #CE9F48; border-radius: 4px;">
                                                    <p style="margin: 0; color: #F3E196; font-size: 14px; line-height: 1.6;">
                                                        <strong style="color: #CE9F48;">Important:</strong> Save this link to access your ticket anytime. You'll receive email notifications when we respond.
                                                    </p>
                                                </td>
                                            </tr>
                                        </table>
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
                                © 2025 MIGMA. All rights reserved.
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

    return sendEmail({
        to: email,
        subject: 'Your Message Has Been Received - MIGMA Support',
        html: html,
    });
}

/**
 * Email: Admin Reply Notification
 * Sent to user when admin responds to their support ticket
 */
/**
 * Email: Send contract view link after contract approval
 */
export async function sendContractViewLinkEmail(
    email: string,
    fullName: string,
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
        return 'https://migma.com';
    };

    const appBaseUrl = getBaseUrl();
    const viewUrl = `${appBaseUrl}/view-contract?token=${token}`;

    const html = `
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
                                                        <strong style="color: #CE9F48;">Note:</strong> This document is protected and available for viewing only. Downloading, copying, or printing is disabled for security purposes. The link will expire in 90 days.
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
                    <!-- Footer -->
                    <tr>
                        <td align="center" style="padding: 20px 40px; background-color: #000000;">
                            <p style="margin: 0 0 10px 0; font-size: 11px; color: #999999; line-height: 1.5; font-style: italic;">
                                This is an automated message. Please do not reply to this email.
                            </p>
                            <p style="margin: 0; font-size: 12px; color: #666666; line-height: 1.5;">
                                © 2025 MIGMA. All rights reserved.
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

    return sendEmail({
        to: email,
        subject: 'Your MIGMA Global Partner Contract Has Been Signed - View Your Contract',
        html: html,
    });
}

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
        
        return 'https://migma.com';
    };
    
    const origin = getBaseUrl();
    const ticketUrl = `${origin}/support/ticket?token=${token}`;

    const html = `
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
                                © 2025 MIGMA. All rights reserved.
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

    return sendEmail({
        to: userEmail,
        subject: `New Response to Your Ticket: ${ticketSubject}`,
        html: html,
    });
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

    const html = `
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
                    <!-- Main Content -->
                    <tr>
                        <td style="padding: 0 40px 40px; background-color: #000000;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="padding: 30px; background: linear-gradient(135deg, #1a1a1a 0%, #000000 100%); border-radius: 8px; border: 1px solid #CE9F48;">
                                        <h1 style="margin: 0 0 20px 0; font-size: 28px; font-weight: bold; color: #F3E196; text-align: center; background: linear-gradient(180deg, #8E6E2F 0%, #F3E196 25%, #CE9F48 50%, #F3E196 75%, #8E6E2F 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                                            Meeting Invitation
                                        </h1>
                                        <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                            Dear ${fullName},
                                        </p>
                                        <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                            We would like to invite you to a meeting with our team. Please find the details below:
                                        </p>
                                        <!-- Meeting Details -->
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 20px 0; background-color: #1a1a1a; border-radius: 8px; padding: 20px;">
                                            <tr>
                                                <td style="padding: 10px 0;">
                                                    <p style="margin: 0 0 5px 0; font-size: 14px; color: #999999;">Meeting Date</p>
                                                    <p style="margin: 0; font-size: 18px; font-weight: 600; color: #F3E196;">${formattedDate}</p>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 10px 0;">
                                                    <p style="margin: 0 0 5px 0; font-size: 14px; color: #999999;">Meeting Time</p>
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
                    <!-- Footer -->
                    <tr>
                        <td align="center" style="padding: 20px 40px; background-color: #000000;">
                            <p style="margin: 0 0 10px 0; font-size: 11px; color: #999999; line-height: 1.5; font-style: italic;">
                                This is an automated message. Please do not reply to this email.
                            </p>
                            <p style="margin: 0; font-size: 12px; color: #666666; line-height: 1.5;">
                                © 2025 MIGMA. All rights reserved.
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

    return sendEmail({
        to: email,
        subject: 'Meeting Invitation - MIGMA',
        html: html,
    });
}

/**
 * Email: Send scheduled meeting update notification
 * Sent when admin updates meeting details
 */
export async function sendScheduledMeetingUpdateEmail(
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

    const html = `
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
                    <!-- Main Content -->
                    <tr>
                        <td style="padding: 0 40px 40px; background-color: #000000;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="padding: 30px; background: linear-gradient(135deg, #1a1a1a 0%, #000000 100%); border-radius: 8px; border: 1px solid #CE9F48;">
                                        <h1 style="margin: 0 0 20px 0; font-size: 28px; font-weight: bold; color: #F3E196; text-align: center; background: linear-gradient(180deg, #8E6E2F 0%, #F3E196 25%, #CE9F48 50%, #F3E196 75%, #8E6E2F 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                                            Meeting Details Updated
                                        </h1>
                                        <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                            Dear ${fullName},
                                        </p>
                                        <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                            We wanted to inform you that the details of your scheduled meeting have been updated. Please find the updated information below:
                                        </p>
                                        <!-- Meeting Details -->
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 20px 0; background-color: #1a1a1a; border-radius: 8px; padding: 20px;">
                                            <tr>
                                                <td style="padding: 10px 0;">
                                                    <p style="margin: 0 0 5px 0; font-size: 14px; color: #999999;">Meeting Date</p>
                                                    <p style="margin: 0; font-size: 18px; font-weight: 600; color: #F3E196;">${formattedDate}</p>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 10px 0;">
                                                    <p style="margin: 0 0 5px 0; font-size: 14px; color: #999999;">Meeting Time</p>
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
                                        <p style="margin: 30px 0 0 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                            Please update your calendar with the new meeting details.
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
                    <!-- Footer -->
                    <tr>
                        <td align="center" style="padding: 20px 40px; background-color: #000000;">
                            <p style="margin: 0 0 10px 0; font-size: 11px; color: #999999; line-height: 1.5; font-style: italic;">
                                This is an automated message. Please do not reply to this email.
                            </p>
                            <p style="margin: 0; font-size: 12px; color: #666666; line-height: 1.5;">
                                © 2025 MIGMA. All rights reserved.
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

    return sendEmail({
        to: email,
        subject: 'Meeting Details Updated - MIGMA',
        html: html,
    });
}

/**
 * Email: Payment request created notification (to seller)
 */
export async function sendPaymentRequestCreatedEmail(
    email: string,
    sellerName: string,
    amount: number,
    _requestId: string
): Promise<boolean> {
    const html = `
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
                    <tr>
                        <td align="center" style="padding: 40px 20px 30px; background-color: #000000;">
                            <img src="https://ekxftwrjvxtpnqbraszv.supabase.co/storage/v1/object/public/logo/logo2.png" alt="MIGMA Logo" width="200" style="display: block; max-width: 200px; height: auto;">
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 0 40px 40px; background-color: #000000;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="padding: 30px; background: linear-gradient(135deg, #1a1a1a 0%, #000000 100%); border-radius: 8px; border: 1px solid #CE9F48;">
                                        <h1 style="margin: 0 0 20px 0; font-size: 28px; font-weight: bold; color: #F3E196; text-align: center; background: linear-gradient(180deg, #8E6E2F 0%, #F3E196 25%, #CE9F48 50%, #F3E196 75%, #8E6E2F 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                                            Solicitação de Pagamento Criada
                                        </h1>
                                        <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                            Olá ${sellerName},
                                        </p>
                                        <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                            Sua solicitação de pagamento no valor de <strong style="color: #CE9F48;">$${amount.toFixed(2)} USD</strong> foi criada com sucesso e está aguardando aprovação.
                                        </p>
                                        <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                            Você receberá uma notificação assim que sua solicitação for processada.
                                        </p>
                                        <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                            Atenciosamente,<br>
                                            <strong style="color: #CE9F48;">Equipe MIGMA</strong>
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td align="center" style="padding: 20px 40px; background-color: #000000;">
                            <p style="margin: 0 0 10px 0; font-size: 11px; color: #999999; line-height: 1.5; font-style: italic;">
                                Esta é uma mensagem automática. Por favor, não responda a este email.
                            </p>
                            <p style="margin: 0; font-size: 12px; color: #666666; line-height: 1.5;">
                                © 2025 MIGMA. All rights reserved.
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

    return sendEmail({
        to: email,
        subject: 'Solicitação de Pagamento Criada - MIGMA',
        html: html,
    });
}

/**
 * Email: Payment request approved notification (to seller)
 */
export async function sendPaymentRequestApprovedEmail(
    email: string,
    sellerName: string,
    amount: number,
    _requestId: string
): Promise<boolean> {
    const html = `
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
                    <tr>
                        <td align="center" style="padding: 40px 20px 30px; background-color: #000000;">
                            <img src="https://ekxftwrjvxtpnqbraszv.supabase.co/storage/v1/object/public/logo/logo2.png" alt="MIGMA Logo" width="200" style="display: block; max-width: 200px; height: auto;">
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 0 40px 20px;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="padding: 25px; background: linear-gradient(135deg, #8E6E2F 0%, #CE9F48 50%, #8E6E2F 100%); border-radius: 8px; text-align: center;">
                                        <h1 style="margin: 0 0 10px 0; font-size: 32px; font-weight: bold; color: #000000;">Aprovado!</h1>
                                        <p style="margin: 0; font-size: 18px; color: #000000; font-weight: 600;">Sua solicitação foi aprovada</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 0 40px 40px; background-color: #000000;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="padding: 30px; background: linear-gradient(135deg, #1a1a1a 0%, #000000 100%); border-radius: 8px; border: 1px solid #CE9F48;">
                                        <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                            Olá ${sellerName},
                                        </p>
                                        <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                            Sua solicitação de pagamento no valor de <strong style="color: #CE9F48;">$${amount.toFixed(2)} USD</strong> foi <strong style="color: #F3E196;">aprovada</strong>!
                                        </p>
                                        <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                            O pagamento será processado em breve. Você receberá uma notificação quando o pagamento for concluído.
                                        </p>
                                        <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                            Atenciosamente,<br>
                                            <strong style="color: #CE9F48;">Equipe MIGMA</strong>
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td align="center" style="padding: 20px 40px; background-color: #000000;">
                            <p style="margin: 0 0 10px 0; font-size: 11px; color: #999999; line-height: 1.5; font-style: italic;">
                                Esta é uma mensagem automática. Por favor, não responda a este email.
                            </p>
                            <p style="margin: 0; font-size: 12px; color: #666666; line-height: 1.5;">
                                © 2025 MIGMA. All rights reserved.
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

    return sendEmail({
        to: email,
        subject: 'Solicitação de Pagamento Aprovada - MIGMA',
        html: html,
    });
}

/**
 * Email: Payment request rejected notification (to seller)
 */
export async function sendPaymentRequestRejectedEmail(
    email: string,
    sellerName: string,
    amount: number,
    reason: string,
    _requestId: string
): Promise<boolean> {
    const html = `
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
                    <tr>
                        <td align="center" style="padding: 40px 20px 30px; background-color: #000000;">
                            <img src="https://ekxftwrjvxtpnqbraszv.supabase.co/storage/v1/object/public/logo/logo2.png" alt="MIGMA Logo" width="200" style="display: block; max-width: 200px; height: auto;">
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 0 40px 40px; background-color: #000000;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="padding: 30px; background: linear-gradient(135deg, #1a1a1a 0%, #000000 100%); border-radius: 8px; border: 1px solid #CE9F48;">
                                        <h1 style="margin: 0 0 20px 0; font-size: 28px; font-weight: bold; color: #F3E196; text-align: center; background: linear-gradient(180deg, #8E6E2F 0%, #F3E196 25%, #CE9F48 50%, #F3E196 75%, #8E6E2F 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                                            Solicitação de Pagamento Rejeitada
                                        </h1>
                                        <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                            Olá ${sellerName},
                                        </p>
                                        <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                            Infelizmente, sua solicitação de pagamento no valor de <strong style="color: #CE9F48;">$${amount.toFixed(2)} USD</strong> foi rejeitada.
                                        </p>
                                        <div style="padding: 15px; background-color: #1a1a1a; border-left: 3px solid #CE9F48; margin: 20px 0; border-radius: 4px;">
                                            <p style="margin: 0 0 8px 0; font-size: 14px; color: #999999; text-transform: uppercase; letter-spacing: 0.5px;">Motivo da Rejeição</p>
                                            <p style="margin: 0; font-size: 16px; color: #e0e0e0;">${reason}</p>
                                        </div>
                                        <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                            O valor foi devolvido ao seu saldo disponível. Se você tiver dúvidas, entre em contato conosco.
                                        </p>
                                        <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                            Atenciosamente,<br>
                                            <strong style="color: #CE9F48;">Equipe MIGMA</strong>
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td align="center" style="padding: 20px 40px; background-color: #000000;">
                            <p style="margin: 0 0 10px 0; font-size: 11px; color: #999999; line-height: 1.5; font-style: italic;">
                                Esta é uma mensagem automática. Por favor, não responda a este email.
                            </p>
                            <p style="margin: 0; font-size: 12px; color: #666666; line-height: 1.5;">
                                © 2025 MIGMA. All rights reserved.
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

    return sendEmail({
        to: email,
        subject: 'Solicitação de Pagamento Rejeitada - MIGMA',
        html: html,
    });
}

/**
 * Email: Payment request completed notification (to seller)
 */
export async function sendPaymentRequestCompletedEmail(
    email: string,
    sellerName: string,
    amount: number,
    _requestId: string,
    proofUrl?: string
): Promise<boolean> {
    const proofSection = proofUrl ? `
        <p style="margin: 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
            <a href="${proofUrl}" style="color: #CE9F48; text-decoration: underline;">Ver comprovante de pagamento</a>
        </p>
    ` : '';

    const html = `
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
                    <tr>
                        <td align="center" style="padding: 40px 20px 30px; background-color: #000000;">
                            <img src="https://ekxftwrjvxtpnqbraszv.supabase.co/storage/v1/object/public/logo/logo2.png" alt="MIGMA Logo" width="200" style="display: block; max-width: 200px; height: auto;">
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 0 40px 20px;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="padding: 25px; background: linear-gradient(135deg, #8E6E2F 0%, #CE9F48 50%, #8E6E2F 100%); border-radius: 8px; text-align: center;">
                                        <h1 style="margin: 0 0 10px 0; font-size: 32px; font-weight: bold; color: #000000;">Pagamento Concluído!</h1>
                                        <p style="margin: 0; font-size: 18px; color: #000000; font-weight: 600;">Seu pagamento foi processado</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 0 40px 40px; background-color: #000000;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="padding: 30px; background: linear-gradient(135deg, #1a1a1a 0%, #000000 100%); border-radius: 8px; border: 1px solid #CE9F48;">
                                        <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                            Olá ${sellerName},
                                        </p>
                                        <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                            Sua solicitação de pagamento no valor de <strong style="color: #CE9F48;">$${amount.toFixed(2)} USD</strong> foi <strong style="color: #F3E196;">paga com sucesso</strong>!
                                        </p>
                                        ${proofSection}
                                        <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                            O valor deve estar disponível em sua conta em breve, dependendo do método de pagamento utilizado.
                                        </p>
                                        <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                            Atenciosamente,<br>
                                            <strong style="color: #CE9F48;">Equipe MIGMA</strong>
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td align="center" style="padding: 20px 40px; background-color: #000000;">
                            <p style="margin: 0 0 10px 0; font-size: 11px; color: #999999; line-height: 1.5; font-style: italic;">
                                Esta é uma mensagem automática. Por favor, não responda a este email.
                            </p>
                            <p style="margin: 0; font-size: 12px; color: #666666; line-height: 1.5;">
                                © 2025 MIGMA. All rights reserved.
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

    return sendEmail({
        to: email,
        subject: 'Pagamento Concluído - MIGMA',
        html: html,
    });
}

/**
 * Email: New payment request notification (to admin)
 */
export async function sendNewPaymentRequestNotification(
    adminEmail: string,
    sellerName: string,
    sellerId: string,
    amount: number,
    paymentMethod: string,
    _requestId: string
): Promise<boolean> {
    const html = `
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
                    <tr>
                        <td align="center" style="padding: 40px 20px 30px; background-color: #000000;">
                            <img src="https://ekxftwrjvxtpnqbraszv.supabase.co/storage/v1/object/public/logo/logo2.png" alt="MIGMA Logo" width="200" style="display: block; max-width: 200px; height: auto;">
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 0 40px 40px; background-color: #000000;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="padding: 30px; background: linear-gradient(135deg, #1a1a1a 0%, #000000 100%); border-radius: 8px; border: 1px solid #CE9F48;">
                                        <h1 style="margin: 0 0 20px 0; font-size: 28px; font-weight: bold; color: #F3E196; text-align: center; background: linear-gradient(180deg, #8E6E2F 0%, #F3E196 25%, #CE9F48 50%, #F3E196 75%, #8E6E2F 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                                            Nova Solicitação de Pagamento
                                        </h1>
                                        <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                            Uma nova solicitação de pagamento foi criada e requer sua atenção.
                                        </p>
                                        <div style="padding: 20px; background-color: #1a1a1a; border-radius: 8px; margin: 20px 0;">
                                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                <tr>
                                                    <td style="padding-bottom: 10px;">
                                                        <p style="margin: 0 0 5px 0; font-size: 14px; color: #999999;">Seller</p>
                                                        <p style="margin: 0; font-size: 18px; font-weight: bold; color: #F3E196;">${sellerName}</p>
                                                        <p style="margin: 5px 0 0 0; font-size: 14px; color: #999999;">ID: ${sellerId}</p>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td style="padding: 15px 0 10px; border-top: 1px solid #333;">
                                                        <p style="margin: 0 0 5px 0; font-size: 14px; color: #999999;">Valor</p>
                                                        <p style="margin: 0; font-size: 24px; font-weight: bold; color: #CE9F48;">$${amount.toFixed(2)} USD</p>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td style="padding: 15px 0 0; border-top: 1px solid #333;">
                                                        <p style="margin: 0 0 5px 0; font-size: 14px; color: #999999;">Método de Pagamento</p>
                                                        <p style="margin: 0; font-size: 16px; color: #e0e0e0; text-transform: capitalize;">${paymentMethod}</p>
                                                    </td>
                                                </tr>
                                            </table>
                                        </div>
                                        <p style="margin: 20px 0 0 0; font-size: 16px; line-height: 1.6; color: #e0e0e0;">
                                            Por favor, acesse o painel administrativo para revisar e processar esta solicitação.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td align="center" style="padding: 20px 40px; background-color: #000000;">
                            <p style="margin: 0 0 10px 0; font-size: 11px; color: #999999; line-height: 1.5; font-style: italic;">
                                Esta é uma mensagem automática. Por favor, não responda a este email.
                            </p>
                            <p style="margin: 0; font-size: 12px; color: #666666; line-height: 1.5;">
                                © 2025 MIGMA. All rights reserved.
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

    return sendEmail({
        to: adminEmail,
        subject: `Nova Solicitação de Pagamento - ${sellerName} - $${amount.toFixed(2)}`,
        html: html,
    });
}
