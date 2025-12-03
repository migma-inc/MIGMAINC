/**
 * Email service integration with Resend via Supabase Edge Function
 * 
 * This file contains functions to send emails for the Global Partner Program.
 * Emails are sent via Supabase Edge Function to avoid CORS issues.
 */

import { supabase } from './supabase';

const FROM_EMAIL = import.meta.env.VITE_FROM_EMAIL || 'onboarding@resend.dev';

export interface EmailOptions {
    to: string;
    subject: string;
    html: string;
    from?: string;
}

/**
 * Send email using Supabase Edge Function (which calls Resend)
 * This avoids CORS issues by calling our backend instead of Resend directly
 */
async function sendEmail(options: EmailOptions): Promise<boolean> {
    try {
        console.log('[EMAIL DEBUG] Attempting to send email:', {
            to: options.to,
            subject: options.subject,
            from: options.from || FROM_EMAIL,
            htmlLength: options.html.length,
        });

        // Call Supabase Edge Function
        const { data, error } = await supabase.functions.invoke('send-email', {
            body: {
                to: options.to,
                subject: options.subject,
                html: options.html,
                from: options.from || FROM_EMAIL,
            },
        });

        if (error) {
            console.error('[EMAIL DEBUG] Error calling Edge Function:', error);
            return false;
        }

        if (data?.error) {
            console.error('[EMAIL DEBUG] Error from Edge Function:', data.error);
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
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #183EC2;">Thank you for applying to the MIGMA Global Partner Program</h1>
            <p>Dear ${fullName},</p>
            <p>We have received your application to become a MIGMA Global Partner.</p>
            <p>Our team will review your profile and, if there is a fit, you will receive an email with a link to schedule an online interview.</p>
            <p>We appreciate your interest in working with MIGMA.</p>
            <p>Best regards,<br>The MIGMA Team</p>
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
 */
export async function sendTermsLinkEmail(
    email: string,
    fullName: string,
    token: string,
    baseUrl?: string
): Promise<boolean> {
    const origin = baseUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://migma.com');
    const termsUrl = `${origin}/partner-terms?token=${token}`;

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #183EC2;">Congratulations! Your application has been approved</h1>
            <p>Dear ${fullName},</p>
            <p>We are pleased to inform you that your application to become a MIGMA Global Partner has been approved!</p>
            <p>To proceed, please review and accept our Global Independent Contractor Terms & Conditions by clicking the link below:</p>
            <p style="text-align: center; margin: 30px 0;">
                <a href="${termsUrl}" style="background-color: #183EC2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                    Review and Accept Terms
                </a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #666;">${termsUrl}</p>
            <p><strong>Important:</strong> This link will expire in 30 days. Please accept the terms as soon as possible to begin your partnership with MIGMA.</p>
            <p>Best regards,<br>The MIGMA Team</p>
        </body>
        </html>
    `;

    return sendEmail({
        to: email,
        subject: 'Action Required: Accept MIGMA Global Partner Terms',
        html: html,
    });
}

/**
 * Email 3: Confirmation after terms acceptance
 */
export async function sendTermsAcceptanceConfirmationEmail(email: string, fullName: string): Promise<boolean> {
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #183EC2;">Your agreement has been accepted</h1>
            <p>Dear ${fullName},</p>
            <p>Thank you. Your acceptance of the MIGMA Global Independent Contractor Terms & Conditions has been recorded.</p>
            <p>Our team will contact you with your onboarding details and next steps shortly.</p>
            <p>We look forward to working with you as a MIGMA Global Partner!</p>
            <p>Best regards,<br>The MIGMA Team</p>
        </body>
        </html>
    `;

    return sendEmail({
        to: email,
        subject: 'Terms Accepted - Welcome to MIGMA Global Partner Program',
        html: html,
    });
}

