import { supabase } from '@/lib/supabase';
import type { SquareCheckoutRequest, SquareCheckoutResponse } from '../../types/square.types';

export class SquareService {
    static async createCheckout(
        request: SquareCheckoutRequest
    ): Promise<SquareCheckoutResponse> {
        const { data, error } = await supabase.functions.invoke<SquareCheckoutResponse>(
            'create-square-checkout',
            { body: request }
        );

        if (error || !data?.url) {
            console.error('[SquareService] Error creating checkout:', error || data);
            throw new Error(error?.message || 'Failed to create Square checkout');
        }

        return data;
    }

    static redirectToCheckout(url: string): void {
        window.location.href = url;
    }
}
