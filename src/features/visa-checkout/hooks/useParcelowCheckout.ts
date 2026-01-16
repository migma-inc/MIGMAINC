import { useState } from 'react';
import type { ParcelowCheckoutData } from '../types/parcelow.types';
import { ParcelowService } from '../services/payment/parcelowService';

interface UseParcelowCheckoutReturn {
    // State
    checkoutData: ParcelowCheckoutData | null;
    showConfirmationModal: boolean;
    isCreatingCheckout: boolean;
    error: string | null;

    // Actions
    createCheckout: (orderId: string) => Promise<void>;
    confirmAndRedirect: () => void;
    cancelCheckout: () => void;
    clearError: () => void;
}

/**
 * Custom hook to manage Parcelow checkout flow
 * Handles: checkout creation, modal state, and redirection
 */
export function useParcelowCheckout(): UseParcelowCheckoutReturn {
    const [checkoutData, setCheckoutData] = useState<ParcelowCheckoutData | null>(null);
    const [showConfirmationModal, setShowConfirmationModal] = useState(false);
    const [isCreatingCheckout, setIsCreatingCheckout] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /**
     * Create a Parcelow checkout and show confirmation modal
     */
    const createCheckout = async (orderId: string): Promise<void> => {
        try {
            setIsCreatingCheckout(true);
            setError(null);

            console.log('[useParcelowCheckout] Creating checkout for order:', orderId);

            const response = await ParcelowService.createCheckout(orderId, 'USD');

            console.log('[useParcelowCheckout] Checkout created successfully:', {
                total_usd: ParcelowService.formatAmount(response.total_usd),
                total_brl: ParcelowService.formatAmount(response.total_brl),
            });

            // Store checkout data
            setCheckoutData({
                checkout_url: response.checkout_url,
                total_usd: response.total_usd,
                total_brl: response.total_brl,
                order_amount: response.order_amount,
                order_id: response.order_id,
            });

            // Show confirmation modal
            setShowConfirmationModal(true);
        } catch (err) {
            console.error('[useParcelowCheckout] Error:', err);
            setError(err instanceof Error ? err.message : 'Failed to create Parcelow checkout');
            throw err;
        } finally {
            setIsCreatingCheckout(false);
        }
    };

    /**
     * User confirmed payment - redirect to Parcelow
     */
    const confirmAndRedirect = (): void => {
        if (!checkoutData?.checkout_url) {
            console.error('[useParcelowCheckout] No checkout URL available');
            return;
        }

        console.log('[useParcelowCheckout] Redirecting to Parcelow:', checkoutData.checkout_url);
        window.location.href = checkoutData.checkout_url;
    };

    /**
     * User cancelled - close modal and clear data
     */
    const cancelCheckout = (): void => {
        console.log('[useParcelowCheckout] Checkout cancelled by user');
        setShowConfirmationModal(false);
        setCheckoutData(null);
    };

    /**
     * Clear error message
     */
    const clearError = (): void => {
        setError(null);
    };

    return {
        // State
        checkoutData,
        showConfirmationModal,
        isCreatingCheckout,
        error,

        // Actions
        createCheckout,
        confirmAndRedirect,
        cancelCheckout,
        clearError,
    };
}
