import { supabase } from '@/lib/supabase';
import type { ParcelowCheckoutRequest, ParcelowCheckoutResponse } from '../../types/parcelow.types';

/**
 * Parcelow Payment Service
 * Handles all Parcelow API interactions
 */
export class ParcelowService {
    /**
     * Create a Parcelow checkout session
     * @param orderId - The visa order ID
     * @param currency - USD or BRL
     * @returns Checkout data including URL and amounts
     */
    static async createCheckout(
        orderId: string,
        currency: 'USD' | 'BRL' = 'USD'
    ): Promise<ParcelowCheckoutResponse> {
        const request: ParcelowCheckoutRequest = {
            order_id: orderId,
            currency,
        };

        const { data, error } = await supabase.functions.invoke<ParcelowCheckoutResponse>(
            'create-parcelow-checkout',
            {
                body: request,
            }
        );

        if (error || !data?.success) {
            console.error('[ParcelowService] Error creating checkout:', error || data);
            throw new Error(error?.message || 'Failed to create Parcelow checkout');
        }

        return data;
    }

    /**
     * Format amount for display (converts from cents to dollars)
     */
    static formatAmount(amountInCents: number): string {
        return (amountInCents / 100).toFixed(2);
    }

    /**
     * Calculate Parcelow fees based on total and order amount
     */
    static calculateFees(totalUsd: number, orderAmount: number): number {
        return totalUsd - orderAmount;
    }
}
