import type { VisaCheckoutState, VisaCheckoutActions } from '../../types/form.types';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Step 3 Sub-components
import { ContractTermsSection } from './step3/ContractTermsSection';
import { SignatureSection } from './step3/SignatureSection';
import { PaymentMethodSelector } from './step3/PaymentMethodSelector';
import { PaymentButtons } from './step3/PaymentButtons';

interface Step3Props {
    state: VisaCheckoutState;
    actions: VisaCheckoutActions;
    handlers: {
        handleStripeCheckout: (method: 'card' | 'pix') => Promise<void>;
        handleZellePayment: () => Promise<void>;
        handleParcelowPayment: () => Promise<void>;
    };
    onPrev: () => void;
}

export const Step3Payment: React.FC<Step3Props> = ({ state, actions, handlers, onPrev }) => {
    const {
        termsAccepted, dataAuthorization, contractTemplate, chargebackAnnexTemplate, paymentMethod,
        zelleReceipt, signatureImageDataUrl, signatureConfirmed, submitting
    } = state;

    const {
        setTermsAccepted, setDataAuthorization, setPaymentMethod, setZelleReceipt
    } = actions;

    const { handleStripeCheckout, handleZellePayment, handleParcelowPayment } = handlers;

    return (
        <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
            <CardHeader>
                <CardTitle className="text-white text-lg sm:text-xl">Step 3: Terms & Payment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <ContractTermsSection
                    termsAccepted={termsAccepted}
                    dataAuthorization={dataAuthorization}
                    contractTemplate={contractTemplate}
                    chargebackAnnexTemplate={chargebackAnnexTemplate}
                    onTermsChange={setTermsAccepted}
                    onDataAuthChange={setDataAuthorization}
                />

                {termsAccepted && (
                    <SignatureSection
                        signatureImageDataUrl={signatureImageDataUrl}
                        signatureConfirmed={signatureConfirmed}
                        onSignatureConfirm={(url) => {
                            actions.setSignatureImageDataUrl(url);
                            actions.setSignatureConfirmed(true);
                        }}
                        onSignatureChange={(url) => {
                            actions.setSignatureImageDataUrl(url);
                        }}
                        onEdit={() => actions.setSignatureConfirmed(false)}
                    />
                )}

                <PaymentMethodSelector
                    paymentMethod={paymentMethod}
                    onMethodChange={setPaymentMethod}
                />

                {paymentMethod === 'zelle' && (
                    <div className="space-y-2 pt-2 animate-in fade-in slide-in-from-top-2">
                        <p className="text-white text-xs sm:text-sm font-medium">Upload Zelle Receipt *</p>
                        <Input
                            type="file"
                            accept="image/*,.pdf"
                            onChange={(e) => setZelleReceipt(e.target.files?.[0] || null)}
                            className="bg-white text-black"
                        />
                        {zelleReceipt && <p className="text-gold-light text-xs">File: {zelleReceipt.name}</p>}
                    </div>
                )}

                <div className="lg:hidden">
                    <PaymentButtons
                        paymentMethod={paymentMethod}
                        submitting={submitting}
                        signatureConfirmed={signatureConfirmed}
                        isZelleReceiptUploaded={!!zelleReceipt}
                        onPrev={onPrev}
                        onStripeCheckout={handleStripeCheckout}
                        onZellePayment={handleZellePayment}
                        onParcelowPayment={handleParcelowPayment}
                    />
                </div>
            </CardContent>
        </Card>
    );
};
