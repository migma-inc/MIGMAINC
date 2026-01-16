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
                        className="bg-gold-medium text-black font-bold hover:bg-gold-light w-full"
                    >
                        {submitting ? 'Processing...' : 'Confirm Zelle Payment'}
                    </Button>
                ) : paymentMethod === 'parcelow' ? (
                    <Button
                        onClick={onParcelowPayment}
                        disabled={submitting || !isReady}
                        className="bg-gold-medium text-black font-bold hover:bg-gold-light w-full"
                    >
                        {submitting ? 'Processing...' : 'Pay with Parcelow'}
                    </Button>
                ) : (
                    <Button
                        onClick={() => onStripeCheckout(paymentMethod as 'card' | 'pix')}
                        disabled={submitting || !isReady}
                        className="bg-gold-medium text-black font-bold hover:bg-gold-light w-full"
                    >
                        {submitting ? 'Processing...' : `Pay ${paymentMethod === 'card' ? 'with Card' : 'via PIX'}`}
                    </Button>
                )}
            </div>
        </div>
    );
};
