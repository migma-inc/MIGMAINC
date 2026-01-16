import { supabase } from '@/lib/supabase';
import type { StripeCheckoutRequest, StripeCheckoutResponse } from '../../types/stripe.types';

/**
 * Stripe Payment Service
 * Handles Stripe checkout session creation
 */
export class StripeService {
    /**
     * Create a Stripe checkout session
     */
    static async createCheckoutSession(
        request: StripeCheckoutRequest
    ): Promise<StripeCheckoutResponse> {
        const { data, error } = await supabase.functions.invoke<StripeCheckoutResponse>(
            'create-visa-checkout-session',
            { body: request }
        );

        if (error || !data?.url) {
            console.error('[StripeService] Error creating checkout session:', error || data);
            throw new Error(error?.message || 'Failed to create Stripe checkout session');
        }

        return data;
    }

    /**
     * Redirect to Stripe checkout
     */
    static redirectToCheckout(url: string): void {
        window.location.href = url;
    }
}
