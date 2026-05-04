import React from 'react';
import type { VisaCheckoutState, VisaCheckoutActions } from '../../types/form.types';
import { isParcelowMethod } from '../../types/form.types';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowUpRight } from 'lucide-react';

// Step 3 Sub-components
import { ContractTermsSection } from './step3/ContractTermsSection';
import { SignatureSection } from './step3/SignatureSection';
import { PaymentMethodSelector } from './step3/PaymentMethodSelector';
// Re-importing ZelleUpload to fix potential reference issues in HMR
import { ZelleUpload } from './step3/ZelleUpload';

import { CouponSection } from './step3/CouponSection';
import { SplitPaymentSelector } from './step3/SplitPaymentSelector';
import { UpsellSelection } from './step3/UpsellSelection';
import { PayerAlternativeForm } from '../payment/PayerAlternativeForm';

interface Step3Props {
    state: VisaCheckoutState;
    actions: VisaCheckoutActions;
    handlers: {
        handleStripeCheckout: (method: 'card' | 'pix') => Promise<void>;
        // handleSquareCheckout: () => Promise<void>;
        handleZellePayment: () => Promise<void>;
        handleParcelowPayment: () => Promise<void>;
    };
    onPrev: () => void;
    productSlug?: string;
    totalAmount: number;
    onScrollToCheckout?: () => void;
    showSquare?: boolean;
}

export const Step3Payment: React.FC<Step3Props> = ({ state, actions, handlers, onPrev, productSlug, totalAmount, onScrollToCheckout, showSquare = false }) => {
    const {
        termsAccepted, dataAuthorization, contractTemplate, chargebackAnnexTemplate, upsellContractTemplate, paymentMethod,
        zelleReceipt, signatureImageDataUrl, signatureConfirmed /*, selectedUpsell */
    } = state;

    const {
        setTermsAccepted, setDataAuthorization, setPaymentMethod, setZelleReceipt /*, setSelectedUpsell */
    } = actions;

    const { t } = useTranslation();

    React.useEffect(() => {
        if (paymentMethod === 'square_card' && !showSquare) {
            setPaymentMethod('');
        }
    }, [paymentMethod, setPaymentMethod, showSquare]);

    return (
        <Card className="bg-gradient-to-br from-gold-light/10 via-gold-medium/5 to-gold-dark/10 border border-gold-medium/30">
            <CardHeader>
                <CardTitle className="text-white text-lg sm:text-xl">{t('checkout.step_3_title', 'Step 3: Terms & Payment')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Temporarily disabled: World Cup Bundle (Combo Copa) */}
                {(productSlug === 'b1-premium' || productSlug?.includes('premium')) && (
                    <div className="mb-6 border-b border-white/5 pb-6">
                        <UpsellSelection
                            selectedUpsell={state.selectedUpsell}
                            onSelect={actions.setSelectedUpsell}
                            extraUnits={state.extraUnits || 0}
                        />
                    </div>
                )}

                <ContractTermsSection
                    termsAccepted={termsAccepted}
                    dataAuthorization={dataAuthorization}
                    contractTemplate={contractTemplate}
                    chargebackAnnexTemplate={chargebackAnnexTemplate}
                    upsellContractTemplate={upsellContractTemplate}
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

                <CouponSection
                    actions={actions}
                    couponCode={state.couponCode}
                    appliedCoupon={state.appliedCoupon}
                    serviceRequestId={state.serviceRequestId || ''}
                    clientName={state.clientName || ''}
                    clientEmail={state.clientEmail || ''}
                    productSlug={productSlug || ''}
                />

                <PaymentMethodSelector
                    paymentMethod={paymentMethod}
                    onMethodChange={setPaymentMethod}
                    showStripe={false}
                    showSquare={showSquare}
                />

                {isParcelowMethod(paymentMethod) && (
                    <div className="pt-2 animate-in fade-in slide-in-from-top-2">
                        <SplitPaymentSelector
                            totalAmount={totalAmount}
                            onSplitChange={actions.setSplitPaymentConfig}
                            disabled={state.submitting}
                        />
                    </div>
                )}

                {/* Caso Stripe: Apenas Nome no Cartão (Square ocultado) */}
                {(paymentMethod === 'card' /* || paymentMethod === 'square_card' */) && (
                    <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-2">
                        <div className="bg-zinc-900/40 border border-white/10 rounded-xl p-5 space-y-4 shadow-lg">
                            <div className="flex flex-col space-y-1">
                                <label htmlFor="cardNameInputProcessor" className="text-sm font-bold text-gold-light uppercase tracking-wide">
                                    {t('checkout.name_on_card', 'Name on Card')} *
                                </label>
                                <Input
                                    id="cardNameInputProcessor"
                                    value={state.creditCardName || ''}
                                    onChange={(e) => actions.setCreditCardName(e.target.value.toUpperCase())}
                                    placeholder=""
                                    className="bg-black/40 border-gold-medium/20 text-white h-11 focus:border-gold-medium transition-all uppercase"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Caso Parcelow: Opção de Terceiro + CPF/Nome */}
                {paymentMethod === 'parcelow_card' && (
                    <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-2">
                        <PayerAlternativeForm
                            payerInfo={state.payerInfo}
                            onPayerInfoChange={actions.setPayerInfo}
                            baseCpf={state.cpf || ''}
                            baseCardName={state.creditCardName || ''}
                        />

                        {!state.payerInfo && (
                            <div className="bg-zinc-900/40 border border-white/10 rounded-xl p-5 space-y-4 shadow-lg">
                                <div className="flex flex-col space-y-1">
                                    <label htmlFor="cpfInputParcelow" className="text-sm font-bold text-gold-light uppercase tracking-wide">
                                        {t('checkout.cpf_label', 'CPF')} *
                                    </label>
                                    <Input
                                        id="cpfInputParcelow"
                                        value={state.cpf || ''}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/\D/g, '').slice(0, 11);
                                            actions.setCpf(val);
                                        }}
                                        placeholder=""
                                        className="bg-black/40 border-gold-medium/20 text-white h-11 focus:border-gold-medium transition-all"
                                    />
                                </div>
                                <div className="flex flex-col space-y-1">
                                    <label htmlFor="cardNameInputParcelow" className="text-sm font-bold text-gold-light uppercase tracking-wide">
                                        {t('checkout.name_on_card', 'Name on Card')} *
                                    </label>
                                    <Input
                                        id="cardNameInputParcelow"
                                        value={state.creditCardName || ''}
                                        onChange={(e) => actions.setCreditCardName(e.target.value.toUpperCase())}
                                        placeholder=""
                                        className="bg-black/40 border-gold-medium/20 text-white h-11 focus:border-gold-medium transition-all uppercase"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}


                {/* Parcelow – PIX / TED: apenas CPF */}
                {(paymentMethod === 'parcelow_pix' || paymentMethod === 'parcelow_ted') && (
                    <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-2">
                        <div className="bg-zinc-900/40 border border-white/10 rounded-xl p-5 space-y-3 shadow-lg">
                            <div className="flex flex-col space-y-1">
                                <label htmlFor="cpfInput" className="text-sm font-bold text-gold-light uppercase tracking-wide">
                                    {t('checkout.cpf_label', 'CPF')} *
                                </label>

                            </div>
                            <Input
                                id="cpfInput"
                                value={state.cpf || ''}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, '').slice(0, 11);
                                    actions.setCpf(val);
                                }}
                                placeholder=""
                                className="bg-black/40 border-gold-medium/20 text-white h-11 focus:border-gold-medium transition-all"
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
                        {t('checkout.back_simple', 'Back')}
                    </button>

                    {paymentMethod && signatureConfirmed && (
                        <button
                            onClick={() => {
                                if (state.submitting) return;
                                actions.setSubmitting(true);
                                if (isParcelowMethod(paymentMethod)) {
                                    handlers.handleParcelowPayment();
                                } else if (paymentMethod === 'card') {
                                    handlers.handleStripeCheckout('card');
                                // } else if (paymentMethod === 'square_card') {
                                //    handlers.handleSquareCheckout();
                                } else if (paymentMethod === 'zelle' && zelleReceipt) {
                                    handlers.handleZellePayment();
                                }
                            }}
                            disabled={
                                state.submitting ||
                                !signatureConfirmed ||
                                !termsAccepted ||
                                !dataAuthorization ||
                                (paymentMethod === 'zelle' && !zelleReceipt) ||
                                (paymentMethod === 'parcelow_card' && (
                                    state.payerInfo ? (
                                        !state.payerInfo.name ||
                                        !state.payerInfo.cpf ||
                                        state.payerInfo.cpf.replace(/\D/g, '').length < 11 ||
                                        !state.payerInfo.email ||
                                        !state.payerInfo.phone
                                    ) : (
                                        !state.cpf ||
                                        state.cpf.replace(/\D/g, '').length < 11 ||
                                        !state.creditCardName
                                    )
                                )) ||
                                ((paymentMethod === 'card' || paymentMethod === 'square_card') && !state.creditCardName) ||
                                ((paymentMethod === 'parcelow_pix' || paymentMethod === 'parcelow_ted') && (
                                    !state.cpf || state.cpf.replace(/\D/g, '').length < 11
                                ))
                            }
                            className={`w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm sm:text-base font-bold rounded-md transition-colors h-auto whitespace-normal leading-tight ${state.submitting ? 'opacity-70 cursor-not-allowed' : ''} ${isParcelowMethod(paymentMethod)
                                ? 'bg-[#22c55e] hover:bg-[#16a34a] text-white'
                                : 'bg-gold-medium hover:bg-gold-light text-black'
                                }`}
                        >
                            {state.submitting ? (
                                <>
                                    <svg className="animate-spin h-5 w-5 text-current flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <span>{t('checkout.processing', 'Processing...')}</span>
                                </>
                            ) : (
                                <div className="flex items-center justify-center gap-2 w-full">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
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
                                    <span>
                                        {isParcelowMethod(paymentMethod)
                                            ? t('checkout.pay_with_parcelow', 'Pay with Parcelow')
                                            : paymentMethod === 'card'
                                                ? t('checkout.pay_with_stripe', 'Pagar com Cartão (Stripe)')
                                                /* : paymentMethod === 'square_card' ? t('checkout.pay_with_square', 'Pay with Square') */ : t('checkout.confirm_zelle_payment', 'Confirm Zelle Payment')}
                                    </span>
                                </div>
                            )}
                        </button>
                    )}
                </div>

                {/* Desktop - Back button + scroll anchor */}
                <div className="hidden lg:flex pt-4 items-center justify-between gap-4">
                    <button
                        onClick={onPrev}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gold-light border border-gold-medium/50 bg-black/50 rounded-md hover:bg-gold-medium/30 hover:text-gold-light transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m15 18-6-6 6-6" />
                        </svg>
                        {t('checkout.back', 'Back')}
                    </button>

                    {paymentMethod && onScrollToCheckout && (
                        <button
                            type="button"
                            onClick={onScrollToCheckout}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-gold-light border border-gold-medium/40 bg-gold-medium/10 rounded-md hover:bg-gold-medium/20 hover:border-gold-medium transition-colors"
                        >
                            <span>{t('checkout.go_to_payment_anchor', 'Go to payment')}</span>
                            <ArrowUpRight className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </CardContent>
        </Card >
    );
};
