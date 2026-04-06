import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { isParcelowMethod } from './types/form.types';
import { useVisaCheckoutForm } from './hooks/useVisaCheckoutForm';
import { useCheckoutSteps } from './hooks/useCheckoutSteps';
import { useDraftRecovery } from './hooks/useDraftRecovery';
import { useDocumentUpload } from './hooks/useDocumentUpload';
import { usePaymentHandlers } from './hooks/usePaymentHandlers';
import { useTemplateLoader } from './hooks/useTemplateLoader';
import { usePrefillData } from './hooks/usePrefillData';
import { useUserLocation } from '@/hooks/useUserLocation';

import { StepIndicator } from './components/shared/StepIndicator';
import { OrderSummary } from './components/shared/OrderSummary';
import { Step1PersonalInfo } from './components/steps/Step1PersonalInfo';
import { Step2Documents } from './components/steps/Step2Documents';
import { Step3Payment } from './components/steps/Step3Payment';
import { ZelleProcessingView } from './components/shared/ZelleProcessingView';
import { CheckoutLoadingOverlay } from './components/shared/CheckoutLoadingOverlay';


import { useTranslation } from 'react-i18next';
import { LanguageSelector } from '@/components/LanguageSelector';
import { calculateBaseTotal, calculateTotalWithFees } from '@/lib/visa-checkout-utils';
import { trackLinkClick } from '@/lib/funnel-tracking';
import type { VisaProduct } from '@/types/visa-product';
import { AlertCircle, ArrowLeft, Bug } from 'lucide-react';
import { saveStep1Data, saveStep2Data } from '@/lib/visa-checkout-service';
import { DRAFT_STORAGE_KEY } from '@/lib/visa-checkout-constants';

export const VisaCheckoutPage: React.FC = () => {
    const { t } = useTranslation();
    const { productSlug } = useParams<{ productSlug: string }>();
    const [searchParams] = useSearchParams();
    const urlSellerId = searchParams.get('seller') || '';

    const [product, setProduct] = useState<VisaProduct | null>(null);
    const [loading, setLoading] = useState(true);
    const checkoutButtonRef = useRef<HTMLDivElement | null>(null);

    // 1. Inicializar estado central
    const { state, actions } = useVisaCheckoutForm();

    // 1.1 Localização do usuário (apenas para restrição do Stripe)
    const userLocation = useUserLocation();

    useEffect(() => {
        actions.setIsBrazil(userLocation.isBrazil);
        actions.setLoadingLocation(userLocation.loading);
    }, [userLocation.isBrazil, userLocation.loading]);

    // 1.2 Carregar dados de preenchimento automático (Prefill) e determinar Seller ID
    const { isLoadingPrefill, sellerId: prefillSellerId } = usePrefillData(productSlug, actions);
    const effectiveSellerId = prefillSellerId || urlSellerId;

    // 2. Inicializar lógica de navegação
    const { handlePrev } = useCheckoutSteps(state, actions, productSlug);

    // 3. Inicializar recuperação de rascunho
    useDraftRecovery(productSlug, effectiveSellerId, loading, state, actions);

    // 4. Inicializar handlers especializados
    const { handleNextStep2 } = useDocumentUpload(state, actions);
    useTemplateLoader(productSlug, state.selectedUpsell, actions);

    const baseUpsellPrice = state.selectedUpsell === 'canada-premium' ? 399 : (state.selectedUpsell === 'canada-revolution' ? 199 : 0);
    const upsellPrice = baseUpsellPrice > 0 ? baseUpsellPrice + ((state.extraUnits || 0) * 50) : 0;
    const initialBaseTotal = product ? calculateBaseTotal(product, state.extraUnits, upsellPrice) : 0;

    // Calculate Discount (Only if features are enabled)
    let discountAmount = 0;
    if (state.appliedCoupon) {
        if (state.appliedCoupon.discountType === 'fixed') {
            discountAmount = state.appliedCoupon.discountValue;
        } else {
            discountAmount = initialBaseTotal * (state.appliedCoupon.discountValue / 100);
        }
    }
    if (discountAmount > initialBaseTotal) discountAmount = initialBaseTotal;

    const baseTotal = state.customAmount !== null ? state.customAmount : Math.max(0, initialBaseTotal - discountAmount);
    const totalWithFees = product ? calculateTotalWithFees(baseTotal, state.paymentMethod, state.exchangeRate || undefined) : 0;

    // Sync discount amount to state
    useEffect(() => {
        actions.setDiscountAmount(discountAmount);
    }, [discountAmount]);

    const paymentHandlers = usePaymentHandlers(
        productSlug,
        effectiveSellerId,
        baseTotal,
        totalWithFees,
        discountAmount, // Passing calculated discount directly
        state,
        actions
    );

    // 5. Carregar produto
    useEffect(() => {
        const loadProduct = async () => {
            if (!productSlug) return;
            try {
                const { data, error } = await supabase
                    .from('visa_products')
                    .select('*')
                    .eq('slug', productSlug)
                    .eq('is_active', true)
                    .single();

                if (error || !data) {
                    actions.setError(t('checkout.error_product_not_found', 'Produto não encontrado ou inativo.'));
                    return;
                }
                setProduct(data);
                if (effectiveSellerId) await trackLinkClick(effectiveSellerId, productSlug);
            } catch (err) {
                actions.setError(t('checkout.error_loading_product', 'Erro ao carregar os detalhes do produto.'));
            } finally {
                setLoading(false);
            }
        };
        loadProduct();
    }, [productSlug, effectiveSellerId]);

    // Calcular passo exibido para o StepIndicator
    // Pulamos o Passo 2 (Documentos) para consultas comuns e para TODAS as parcelas recorrentes (EB-3, EB-2, Scholarship, Billing Tokens)
    const isInstallment = !!state.eb3ScheduleId || !!state.eb2ScheduleId || !!state.scholarshipScheduleId || !!state.billingInstallmentId;
    const isSpecialFlow = productSlug === 'consultation-common' || isInstallment;
    
    const displayStep = (isSpecialFlow && state.currentStep === 3) ? 2 : state.currentStep;
    const totalStepsCount = isSpecialFlow ? 2 : 3;

    // Auto-scroll on step change
    useEffect(() => {
        if (state.currentStep) {
            window.scrollTo({ top: 0, behavior: 'auto' });
        }
    }, [state.currentStep]);

    // Auto-scroll to top when an error occurs (smooth behavior is better for UX)
    useEffect(() => {
        if (state.error) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [state.error]);

    const scrollToCheckout = () => {
        checkoutButtonRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
        });
    };

    if (loading || isLoadingPrefill) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white p-4">
                <div className="loader-gold mx-auto mb-8"></div>
                <p className="text-gray-400">{t('checkout.processing', 'Carregando sua aplicação...')}</p>
            </div>
        );
    }

    if (!product) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white p-4 text-center">
                <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
                <h2 className="text-2xl font-bold mb-2">{t('checkout.error_product_not_found_title', 'Ops! Produto não encontrado')}</h2>
                <p className="text-gray-400 mb-6">{t('checkout.error_product_not_found_message', 'Não conseguimos localizar as informações deste visto.')}</p>
                <Link to="/" className="bg-gold-medium text-black px-6 py-2 rounded-full font-bold hover:bg-gold-light transition-colors">
                    {t('checkout.back_to_home', 'Voltar para Home')}
                </Link>
            </div>
        );
    }



    if (state.isZelleProcessing) {
        return (
            <div className="min-h-screen bg-black py-8 sm:py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
                <ZelleProcessingView />
            </div>
        );
    }



    return (
        <div className="min-h-screen bg-black py-8 sm:py-12 px-4 sm:px-6 lg:px-8 notranslate" translate="no">
            {state.submitting && <CheckoutLoadingOverlay />}
            <div className="max-w-6xl mx-auto">
                <header className="flex flex-col mb-8 gap-2">
                    <div className="flex justify-between items-center mb-4">
                        <Link to="/" className="inline-flex items-center text-gold-light hover:text-gold-medium transition-colors">
                            <ArrowLeft className="w-4 h-4 mr-2" /> {t('checkout.back_to_home', 'Back to Home')}
                        </Link>
                        <LanguageSelector />
                    </div>
                    <div className="flex items-center gap-4">
                        <img src="/logo2.png" alt="MIGMA INC" className="h-10 md:h-12 w-auto" />
                        <h1 className="text-2xl sm:text-3xl font-bold migma-gold-text">
                            {t('checkout.visa_title', 'Visa Application Checkout')}
                        </h1>
                    </div>
                    {effectiveSellerId && (
                        <p className="text-gray-400 text-sm">Seller ID: <span className="text-gold-light">{effectiveSellerId}</span></p>
                    )}
                </header>

                <StepIndicator currentStep={displayStep} totalSteps={totalStepsCount} />

                {state.error && (
                    <div className="mb-6 bg-red-500/10 border border-red-500/50 text-red-300 p-4 rounded-lg flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <p className="text-sm">{state.error}</p>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
                    <main className="lg:col-span-3 space-y-6">
                        {((state.currentStep === 1 || state.currentStep === 2) && (state.eb3ScheduleId || state.eb2ScheduleId || state.scholarshipScheduleId)) && (
                            <div className="bg-zinc-900/50 border border-gold-medium/20 rounded-xl p-6 space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h2 className="text-gold-light font-bold text-lg">
                                            {state.eb2ScheduleId ? 'EB-2 Installment Details' : 
                                             state.scholarshipScheduleId ? 'Scholarship Maintenance Details' : 
                                             'EB-3 Installment Details'}
                                        </h2>
                                        <p className="text-gray-400 text-sm">Maintenance Plan - Installment Payment</p>
                                    </div>
                                    {(state.eb3LateFee > 0 || state.eb2LateFee > 0 || state.scholarshipLateFee > 0) && (
                                        <span className="bg-red-500/20 text-red-400 text-xs font-bold px-2 py-1 rounded border border-red-500/30">
                                            OVERDUE
                                        </span>
                                    )}
                                </div>
                                <div className="pt-2 space-y-3 border-t border-white/5">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-400">Installment Amount:</span>
                                        <span className="text-white">US$ {(state.customAmount! - (state.eb3LateFee + state.eb2LateFee + state.scholarshipLateFee)).toFixed(2)}</span>
                                    </div>
                                    {(state.eb3LateFee > 0 || state.eb2LateFee > 0 || state.scholarshipLateFee > 0) && (
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-red-400">Late Fee:</span>
                                            <span className="text-red-400 font-bold">+ US$ {(state.eb3LateFee + state.eb2LateFee + state.scholarshipLateFee).toFixed(2)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center pt-2 border-t border-white/5 text-lg font-bold">
                                        <span className="text-gold-light">Total to Pay:</span>
                                        <span className="text-gold-light">US$ {state.customAmount?.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {((state.currentStep === 1 || state.currentStep === 2) && !state.eb3ScheduleId && !state.eb2ScheduleId && !state.scholarshipScheduleId) && (
                            <div className="bg-zinc-900/50 border border-gold-medium/20 rounded-xl p-6 space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                                <h2 className="text-gold-light font-bold text-lg">{t('checkout.product_details', 'Product Details')}</h2>
                                <div>
                                    <h3 className="text-white font-bold text-xl mb-1">{product.name}</h3>
                                    <p className="text-gray-400 text-sm leading-relaxed">{product.description}</p>
                                </div>
                                <div className="pt-2 space-y-2 border-t border-white/5">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-400">{t('checkout.base_price', 'Base Price')}:</span>
                                        <span className="text-white font-bold text-lg">US$ {parseFloat(product.base_price_usd).toFixed(2)}</span>
                                    </div>
                                    {productSlug !== 'consultation-common' && (
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-gray-400">{t('checkout.per_dependents', 'Per dependents')}:</span>
                                            <span className="text-gray-300">US$ {parseFloat(product.extra_unit_price).toFixed(2)}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {state.currentStep === 1 && (
                            <div className="animate-in fade-in slide-in-from-left-4 duration-300">
                                <Step1PersonalInfo product={product} state={state} actions={actions} />
                            </div>
                        )}
                        {state.currentStep === 2 && (
                            <div className="animate-in fade-in slide-in-from-left-4 duration-300">
                                <Step2Documents state={state} actions={actions} onNext={handleNextStep2} onPrev={handlePrev} />
                            </div>
                        )}
                        {state.currentStep === 3 && (
                            <div className="animate-in fade-in slide-in-from-left-4 duration-300">
                                <Step3Payment
                                    state={state}
                                    actions={actions}
                                    handlers={paymentHandlers}
                                    onPrev={handlePrev}
                                    productSlug={productSlug}
                                    totalAmount={totalWithFees}
                                    onScrollToCheckout={scrollToCheckout}
                                />
                            </div>
                        )}
                    </main>

                    {state.currentStep === 3 && (
                        <aside className="lg:col-span-2 sticky top-8">
                            <OrderSummary
                                product={product}
                                extraUnits={state.extraUnits}
                                totalWithFees={totalWithFees}
                                paymentMethod={state.paymentMethod}
                                splitPaymentConfig={state.splitPaymentConfig}
                                showPaymentButton={true}
                                isSubmitting={state.submitting}
                                isPaymentReady={
                                    state.signatureConfirmed &&
                                    state.termsAccepted &&
                                    state.dataAuthorization &&
                                    (state.paymentMethod !== 'zelle' || !!state.zelleReceipt) &&
                                    (state.paymentMethod === 'card' ? (
                                        !!state.creditCardName // Stripe Card exige pelo menos o nome para a assinatura/contrato
                                    ) : (
                                        (state.paymentMethod !== 'parcelow_card' || (
                                            (state.payerInfo ? (
                                                !!state.payerInfo.name &&
                                                !!state.payerInfo.cpf &&
                                                state.payerInfo.cpf.replace(/\D/g, '').length >= 11 &&
                                                !!state.payerInfo.email &&
                                                !!state.payerInfo.phone
                                            ) : (
                                                !!state.cpf &&
                                                state.cpf.replace(/\D/g, '').length >= 11 &&
                                                !!state.creditCardName
                                            ))
                                        )) &&
                                        ((state.paymentMethod !== 'parcelow_pix' && state.paymentMethod !== 'parcelow_ted') || (
                                            !!state.cpf && state.cpf.replace(/\D/g, '').length >= 11
                                        ))
                                    ))
                                }
                                onPay={() => {
                                    if (state.submitting) return;
                                    actions.setError('');
                                    actions.setSubmitting(true);

                                    if (state.paymentMethod === 'zelle') {
                                        paymentHandlers.handleZellePayment();
                                    } else if (isParcelowMethod(state.paymentMethod)) {
                                        paymentHandlers.handleParcelowPayment?.();
                                    } else {
                                        paymentHandlers.handleStripeCheckout(state.paymentMethod as 'card' | 'pix');
                                    }
                                }}
                                selectedUpsell={state.selectedUpsell}
                                upsellPrice={upsellPrice}
                                discountAmount={discountAmount}
                                appliedCouponCode={state.appliedCoupon?.code}
                                checkoutButtonRef={checkoutButtonRef}
                            />
                        </aside>
                    )}
                </div>
            </div>

            {/* Dev Tools Button */}
            {import.meta.env.DEV && (
                <div className="fixed bottom-4 right-4 z-50">
                    <button
                        onClick={async () => {
                            actions.setSubmitting(true);
                            try {
                                // 1. Preencher dados no estado
                                actions.fillDevData();

                                // 2. Preparar dados para o Step 1
                                const devFormData = {
                                    clientName: 'John Doe Dev',
                                    clientEmail: 'victuribdev@gmail.com',
                                    clientWhatsApp: '+1 555 0123 4567',
                                    clientCountry: 'US',
                                    clientNationality: 'American',
                                    dateOfBirth: '1990-01-01',
                                    documentType: 'passport' as const,
                                    documentNumber: 'A12345678',
                                    addressLine: '123 Dev Street',
                                    city: 'San Francisco',
                                    state: 'CA',
                                    postalCode: '94105',
                                    maritalStatus: 'single' as const,
                                    extraUnits: 0,
                                    dependentNames: [],
                                };

                                // 3. Salvar Step 1
                                const step1Result = await saveStep1Data(
                                    devFormData,
                                    0,
                                    productSlug!,
                                    urlSellerId,
                                    state.clientId || undefined,
                                    state.serviceRequestId || undefined,
                                    actions.setClientId,
                                    actions.setServiceRequestId,
                                    state.formStartedTracked,
                                    actions.setFormStartedTracked,
                                    DRAFT_STORAGE_KEY
                                );

                                if (!step1Result.success) throw new Error(step1Result.error);

                                // Se for consulta comum, já vai pro 3
                                if (productSlug === 'consultation-common') {
                                    actions.setCurrentStep(3);
                                    return;
                                }

                                // 4. Salvar Step 2 (Simulado com contract existente para ir rápido)
                                // Usamos a lógica de "hasExistingContract" para pular upload de arquivos se o usuário preferir,
                                // mas para o dev tool, vamos apenas forçar o status para pending_payment
                                const step2Result = await saveStep2Data(
                                    step1Result.serviceRequestId!,
                                    null,
                                    {
                                        contract_document_url: 'https://dev-tool-mock-doc.pdf',
                                        contract_selfie_url: 'https://dev-tool-mock-selfie.png',
                                    }
                                );

                                if (!step2Result.success) throw new Error(step2Result.error);

                                // 5. Ir para o último passo
                                actions.setCurrentStep(3);
                            } catch (err: any) {
                                actions.setError('Dev Tool Error: ' + err.message);
                            } finally {
                                actions.setSubmitting(false);
                            }
                        }}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-full shadow-lg flex items-center gap-2 border-2 border-white/20 transition-all hover:scale-105 active:scale-95"
                    >
                        <Bug className="w-5 h-5" />
                        DEV: Auto-Fill
                    </button>
                </div>
            )}
        </div>
    );
};
