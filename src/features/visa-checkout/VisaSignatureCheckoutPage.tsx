import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useVisaCheckoutForm } from './hooks/useVisaCheckoutForm';
import { useCheckoutSteps } from './hooks/useCheckoutSteps';
import { useDraftRecovery } from './hooks/useDraftRecovery';
import { useDocumentUpload } from './hooks/useDocumentUpload';
import { useSignatureOnlyHandlers } from './hooks/useSignatureOnlyHandlers';
import { useTemplateLoader } from './hooks/useTemplateLoader';
import { usePrefillData } from './hooks/usePrefillData';

import { StepIndicator } from './components/shared/StepIndicator';
import { OrderSummary } from './components/shared/OrderSummary';
import { Step1PersonalInfo } from './components/steps/Step1PersonalInfo';
import { Step2Documents } from './components/steps/Step2Documents';
import { Step3SignatureOnly } from './components/steps/Step3SignatureOnly';

import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { calculateBaseTotal } from '@/lib/visa-checkout-utils';
import type { VisaProduct } from '@/types/visa-product';

export const VisaSignatureCheckoutPage: React.FC = () => {
    const { productSlug } = useParams<{ productSlug: string }>();
    const [searchParams] = useSearchParams();
    const urlSellerId = searchParams.get('seller') || '';
    const customPrice = searchParams.get('price');

    const [product, setProduct] = useState<VisaProduct | null>(null);
    const [loading, setLoading] = useState(true);

    const { state, actions } = useVisaCheckoutForm();
    const { isLoadingPrefill, sellerId: prefillSellerId } = usePrefillData(productSlug, actions);
    const effectiveSellerId = prefillSellerId || urlSellerId;

    const { handlePrev } = useCheckoutSteps(state, actions, productSlug);
    useDraftRecovery(productSlug, effectiveSellerId, loading, state, actions);
    const { handleNextStep2 } = useDocumentUpload(state, actions);
    useTemplateLoader(productSlug, actions);

    const baseTotal = customPrice ? parseFloat(customPrice) : (product ? calculateBaseTotal(product, state.extraUnits) : 0);
    // No Signature Only flow, we don't apply payment gateway fees
    const totalWithFees = baseTotal;

    const { handleManualSubmission } = useSignatureOnlyHandlers(
        productSlug,
        effectiveSellerId,
        totalWithFees,
        state,
        actions
    );

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
                    actions.setError('Produto não encontrado ou inativo.');
                    return;
                }
                setProduct(data);
            } catch (err) {
                actions.setError('Erro ao carregar os detalhes do produto.');
            } finally {
                setLoading(false);
            }
        };
        loadProduct();
    }, [productSlug]);

    if (loading || isLoadingPrefill) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white p-4">
                <Loader2 className="w-12 h-12 text-gold-medium animate-spin mb-4" />
                <p className="text-gold-light font-medium animate-pulse">Carregando formulário de assinatura...</p>
            </div>
        );
    }

    if (!product) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white p-4 text-center">
                <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
                <h2 className="text-2xl font-bold mb-2">Ops! Produto não encontrado</h2>
                <p className="text-gray-400 mb-6">Não conseguimos localizar as informações deste visto.</p>
                <Link to="/" className="bg-gold-medium text-black px-6 py-2 rounded-full font-bold hover:bg-gold-light transition-colors">
                    Voltar para Home
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                <header className="flex flex-col mb-8 gap-2">
                    <Link to="/" className="inline-flex items-center text-gold-light hover:text-gold-medium transition-colors mb-2">
                        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
                    </Link>
                    <h1 className="text-2xl sm:text-3xl font-bold migma-gold-text">Visa Contract Signature</h1>
                    <p className="text-gray-400 text-sm">Este link é exclusivo para assinatura de contrato.</p>
                </header>

                <StepIndicator currentStep={state.currentStep} totalSteps={3} />

                {state.error && (
                    <div className="mb-6 bg-red-500/10 border border-red-500/50 text-red-300 p-4 rounded-lg flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <p className="text-sm">{state.error}</p>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                    <main className="lg:col-span-2 space-y-6">
                        <div className="bg-zinc-900/50 border border-gold-medium/20 rounded-xl p-6 space-y-4">
                            <h2 className="text-gold-light font-bold text-lg">Contract Details</h2>
                            <div>
                                <h3 className="text-white font-bold text-xl mb-1">{product.name}</h3>
                                <p className="text-gray-400 text-sm leading-relaxed">{product.description}</p>
                            </div>
                            <div className="pt-2 space-y-2 border-t border-white/5">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-400">Total Contract Value:</span>
                                    <span className="text-white font-bold text-lg">US$ {totalWithFees.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        {state.currentStep === 1 && (
                            <Step1PersonalInfo product={product} state={state} actions={actions} />
                        )}
                        {state.currentStep === 2 && (
                            <Step2Documents state={state} actions={actions} onNext={handleNextStep2} onPrev={handlePrev} />
                        )}
                        {state.currentStep === 3 && (
                            <Step3SignatureOnly state={state} actions={actions} onPrev={handlePrev} onFinalize={handleManualSubmission} />
                        )}
                    </main>

                    <aside className="lg:col-span-1 sticky top-8">
                        <OrderSummary
                            product={product}
                            extraUnits={state.extraUnits}
                            totalWithFees={totalWithFees}
                            paymentMethod="manual"
                            showPaymentButton={state.currentStep === 3}
                            isSubmitting={state.submitting}
                            isPaymentReady={state.signatureConfirmed && state.termsAccepted}
                            onPay={handleManualSubmission}
                        />
                    </aside>
                </div>
            </div>
        </div>
    );
};
