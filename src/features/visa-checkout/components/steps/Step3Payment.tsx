import type { VisaCheckoutState, VisaCheckoutActions } from '../../types/form.types';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Step 3 Sub-components
import { ContractTermsSection } from './step3/ContractTermsSection';
import { SignatureSection } from './step3/SignatureSection';
import { PaymentMethodSelector } from './step3/PaymentMethodSelector';
// Re-importing ZelleUpload to fix potential reference issues in HMR
import { ZelleUpload } from './step3/ZelleUpload';

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
        zelleReceipt, signatureImageDataUrl, signatureConfirmed
    } = state;

    const {
        setTermsAccepted, setDataAuthorization, setPaymentMethod, setZelleReceipt
    } = actions;

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

                {paymentMethod === 'parcelow' && (
                    <div className="space-y-2 pt-2 animate-in fade-in slide-in-from-top-2">
                        <div className="bg-blue-50 border border-blue-200 rounded-md p-4 space-y-3">
                            <div className="flex flex-col space-y-1">
                                <label htmlFor="cardName" className="text-sm font-medium text-blue-900">
                                    Name on Card *
                                </label>
                                <p className="text-xs text-blue-700">
                                    Please enter exactly the name as it appears on your card.
                                </p>
                            </div>
                            <Input
                                id="cardName"
                                value={state.creditCardName || ''}
                                onChange={(e) => actions.setCreditCardName(e.target.value.toUpperCase())}
                                placeholder=""
                                className="bg-white text-black uppercase"
                            />
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-md p-4 space-y-3">
                            <div className="flex flex-col space-y-1">
                                <label htmlFor="cpfInput" className="text-sm font-medium text-blue-900">
                                    CPF (Brazilian Tax ID) *
                                </label>
                                <p className="text-xs text-blue-700">
                                    Required for payment processing in Brazil.
                                </p>
                            </div>
                            <Input
                                id="cpfInput"
                                value={state.cpf || ''}
                                onChange={(e) => {
                                    // Allow only numbers and limit to 11 chars
                                    const val = e.target.value.replace(/\D/g, '').slice(0, 11);
                                    actions.setCpf(val);
                                }}
                                placeholder="000.000.000-00"
                                className="bg-white text-black"
                            />
                        </div>

                    </div>
                )}

                {paymentMethod === 'zelle' && (
                    <div className="space-y-2 pt-2 animate-in fade-in slide-in-from-top-2 flex justify-center">
                        <ZelleUpload
                            onFileSelect={(file) => setZelleReceipt(file)}
                            currentFile={zelleReceipt}
                            onClear={() => setZelleReceipt(null)}
                        />
                    </div>
                )}

                {/* Mobile - Back and Pay buttons */}
                <div className="lg:hidden space-y-3 pt-4">
                    <button
                        onClick={onPrev}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gold-light border border-gold-medium/50 bg-black/50 rounded-md hover:bg-gold-medium/30 hover:text-gold-light transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m15 18-6-6 6-6" />
                        </svg>
                        Back
                    </button>

                    {paymentMethod && signatureConfirmed && (
                        <button
                            onClick={() => {
                                if (state.submitting) return;
                                if (paymentMethod === 'parcelow') {
                                    handlers.handleParcelowPayment();
                                } else if (paymentMethod === 'zelle' && zelleReceipt) {
                                    handlers.handleZellePayment();
                                }
                            }}
                            disabled={state.submitting || !signatureConfirmed || (paymentMethod === 'zelle' && !zelleReceipt) || (paymentMethod === 'parcelow' && (!state.creditCardName || !state.cpf || state.cpf.length < 11))}
                            className={`w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-base font-bold rounded-md transition-colors ${state.submitting ? 'opacity-70 cursor-not-allowed' : ''} ${paymentMethod === 'parcelow'
                                ? 'bg-[#22c55e] hover:bg-[#16a34a] text-white'
                                : 'bg-gold-medium hover:bg-gold-light text-black'
                                }`}
                        >
                            {state.submitting ? (
                                <>
                                    <svg className="animate-spin h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        {paymentMethod === 'zelle' ? (
                                            <>
                                                <line x1="12" y1="1" x2="12" y2="23"></line>
                                                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                                            </>
                                        ) : (
                                            <>
                                                <rect width="20" height="14" x="2" y="5" rx="2"></rect>
                                                <line x1="2" x2="22" y1="10" y2="10"></line>
                                            </>
                                        )}
                                    </svg>
                                    {paymentMethod === 'parcelow' ? 'Pay with Parcelow' : 'Confirm Zelle Payment'}
                                </>
                            )}
                        </button>
                    )}
                </div>

                {/* Desktop - Back button only */}
                <div className="hidden lg:flex pt-4">
                    <button
                        onClick={onPrev}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gold-light border border-gold-medium/50 bg-black/50 rounded-md hover:bg-gold-medium/30 hover:text-gold-light transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m15 18-6-6 6-6" />
                        </svg>
                        Back
                    </button>
                </div>
            </CardContent>
        </Card >
    );
};
