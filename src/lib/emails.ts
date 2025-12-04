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
        </head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #000000;">
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
        if (envUrl) return envUrl;
        
        // If in browser, use current origin
        if (typeof window !== 'undefined' && window.location.origin) {
            return window.location.origin;
        }
        
        // Fallback (should be set via VITE_APP_URL in production)
        return 'https://migma.com';
    };
    
    const origin = getBaseUrl();
    const termsUrl = `${origin}/partner-terms?token=${token}`;

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #000000;">
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
 * Email 3: Confirmation after terms acceptance
 */
export async function sendTermsAcceptanceConfirmationEmail(
    email: string, 
    fullName: string,
    contractPdfUrl?: string
): Promise<boolean> {
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #000000;">
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
                                        ${contractPdfUrl ? `
                                        <!-- Contract Download Box -->
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td style="padding: 20px; background-color: #1a1a1a; border-left: 4px solid #CE9F48; border-radius: 4px; margin: 20px 0;">
                                                    <p style="margin: 0 0 10px 0; color: #CE9F48; font-weight: bold; font-size: 16px;">Your Contract Document</p>
                                                    <p style="margin: 0 0 20px 0; color: #e0e0e0; font-size: 14px; line-height: 1.6;">
                                                        Your signed contract has been generated and is available for download:
                                                    </p>
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                        <tr>
                                                            <td align="center">
                                                                <a href="${contractPdfUrl}" style="display: inline-block; padding: 12px 30px; background: linear-gradient(180deg, #F3E196 0%, #CE9F48 50%, #F3E196 100%); color: #000000; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; box-shadow: 0 4px 12px rgba(206, 159, 72, 0.4);">
                                                                    Download Contract PDF
                                                                </a>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                        </table>
                                        ` : `
                                        <p style="margin: 0 0 20px 0; color: #999999; font-style: italic; font-size: 14px;">Your contract document is being generated and will be sent to you shortly.</p>
                                        `}
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
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
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

