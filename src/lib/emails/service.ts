import { supabase } from '../supabase';
import type { EmailOptions } from './types';

/**
 * Send email using Supabase Edge Function (which uses SMTP Google)
 * This avoids CORS issues by calling our backend instead of SMTP directly
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
    try {
        console.log('[EMAIL DEBUG] Attempting to send email:', {
            to: options.to,
            subject: options.subject,
            htmlLength: options.html.length,
            // from will be defined by Edge Function using SMTP_FROM_EMAIL from Supabase Secrets
        });

        // Call Supabase Edge Function
        // Do not pass 'from' - let Edge Function use SMTP_FROM_EMAIL from Supabase Secrets
        const { data, error } = await supabase.functions.invoke('send-email', {
            body: {
                to: options.to,
                subject: options.subject,
                html: options.html,
                // from will be defined by Edge Function using SMTP_FROM_EMAIL from Supabase Secrets
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
