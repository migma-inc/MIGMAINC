import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import type { PaymentMethod } from '../../../types/form.types';

interface PaymentButtonsProps {
    paymentMethod: PaymentMethod;
    submitting: boolean;
    signatureConfirmed: boolean;
    isZelleReceiptUploaded: boolean;
    onPrev: () => void;
    onStripeCheckout: (method: 'card' | 'pix') => void;
    onZellePayment: () => void;
    onParcelowPayment?: () => void; // Optional for now to avoid breaking parent immediately, but better to be required if I update parent in same turn.  Let's make it optional to be safe, but I will update parent next.
}

export const PaymentButtons: React.FC<PaymentButtonsProps> = ({
    paymentMethod,
    submitting,
    signatureConfirmed,
    isZelleReceiptUploaded,
    onPrev,
    onStripeCheckout,
    onZellePayment,
    onParcelowPayment,
}) => {
    const isReady = signatureConfirmed && (paymentMethod !== 'zelle' || isZelleReceiptUploaded);

    return (
        <div className="flex flex-col sm:flex-row justify-between pt-6 gap-3 sm:gap-0">
            <Button
                variant="outline"
                onClick={onPrev}
                className="border-gold-medium/50 bg-black/50 text-gold-light hover:bg-gold-medium/30 hover:text-gold-light w-full sm:w-auto order-2 sm:order-1"
            >
                <ChevronLeft className="mr-2 h-4 w-4" /> Back
            </Button>

            <div className="order-1 sm:order-2">
                {paymentMethod === 'zelle' ? (
                    <Button
                        onClick={onZellePayment}
                        disabled={submitting || !isReady}
                        className="bg-gold-medium text-black font-bold hover:bg-gold-light w-full h-12"
                    >
                        {submitting ? (
                            'Processing...'
                        ) : (
                            <div className="flex items-center justify-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="12" y1="1" x2="12" y2="23"></line>
                                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                                </svg>
                                Confirm Zelle Payment
                            </div>
                        )}
                    </Button>
                ) : paymentMethod === 'parcelow' ? (
                    <Button
                        onClick={onParcelowPayment}
                        disabled={submitting || !isReady}
                        className="bg-[#22c55e] hover:bg-[#16a34a] text-white font-bold w-full h-12"
                    >
                        {submitting ? (
                            'Processing...'
                        ) : (
                            <div className="flex items-center justify-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect width="20" height="14" x="2" y="5" rx="2"></rect>
                                    <line x1="2" x2="22" y1="10" y2="10"></line>
                                </svg>
                                Pay with Parcelow
                            </div>
                        )}
                    </Button>
                ) : (
                    <Button
                        onClick={() => onStripeCheckout(paymentMethod as 'card' | 'pix')}
                        disabled={submitting || !isReady}
                        className="bg-gold-medium text-black font-bold hover:bg-gold-light w-full h-12"
                    >
                        {submitting ? (
                            'Processing...'
                        ) : (
                            <div className="flex items-center justify-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect width="20" height="14" x="2" y="5" rx="2"></rect>
                                    <line x1="2" x2="22" y1="10" y2="10"></line>
                                </svg>
                                Pay Now
                            </div>
                        )}
                    </Button>
                )}
            </div>
        </div>
    );
};
