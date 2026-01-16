import { supabase } from '@/lib/supabase';
import type { WisePaymentRequest, WisePaymentResponse } from '../../types/wise.types';

/**
 * Wise Payment Service
 * Handles Wise payment processing
 */
export class WiseService {
    /**
     * Create a Wise payment
     */
    static async createPayment(
        request: WisePaymentRequest
    ): Promise<WisePaymentResponse> {
        const { data, error } = await supabase.functions.invoke<WisePaymentResponse>(
            'create-wise-payment',
            { body: request }
        );

        if (error || !data?.url) {
            console.error('[WiseService] Error creating payment:', error || data);
            throw new Error(error?.message || 'Failed to create Wise payment');
        }

        return data;
    }

    /**
     * Redirect to Wise payment page
     */
    static redirectToPayment(url: string): void {
        window.location.href = url;
    }
}
