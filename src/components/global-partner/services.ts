import { supabase } from '@/lib/supabase';
import type { ApplicationData } from './types';

/**
 * Checks if an email already exists in the global_partner_applications table.
 */
export const checkEmailExists = async (email: string): Promise<boolean> => {
    try {
        const { data, error } = await supabase
            .from('global_partner_applications')
            .select('id')
            .eq('email', email.toLowerCase().trim())
            .maybeSingle();

        if (error && error.code !== 'PGRST116') {
            console.error('Error checking email:', error);
            return false;
        }

        return !!data;
    } catch (error) {
        console.error('Error checking email:', error);
        return false;
    }
};

/**
 * Gets the client's public IP address.
 */
export const getClientIP = async (): Promise<string | null> => {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip || null;
    } catch (error) {
        console.warn('Could not fetch IP address:', error);
        return null;
    }
};

/**
 * Inserts a new application into the database.
 */
export const insertApplication = async (applicationData: ApplicationData) => {
    return await supabase
        .from('global_partner_applications')
        .insert([applicationData])
        .select();
};
