import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useVisaCheckoutForm } from './hooks/useVisaCheckoutForm';
import { useCheckoutSteps } from './hooks/useCheckoutSteps';
import { useDraftRecovery } from './hooks/useDraftRecovery';
import { useDocumentUpload } from './hooks/useDocumentUpload';
import { usePaymentHandlers } from './hooks/usePaymentHandlers';
import { useTemplateLoader } from './hooks/useTemplateLoader';

import { StepIndicator } from './components/shared/StepIndicator';
import { OrderSummary } from './components/shared/OrderSummary';
import { Step1PersonalInfo } from './components/steps/Step1PersonalInfo';
import { Step2Documents } from './components/steps/Step2Documents';
import { Step3Payment } from './components/steps/Step3Payment';

import { ArrowLeft } from 'lucide-react';
import { calculateBaseTotal, calculateTotalWithFees } from '@/lib/visa-checkout-utils';
import { trackLinkClick } from '@/lib/funnel-tracking';
import type { VisaProduct } from '@/types/visa-product';
import { Loader2, AlertCircle } from 'lucide-react';

export const VisaCheckoutPage: React.FC = () => {
    const { productSlug } = useParams<{ productSlug: string }>();
    const [searchParams] = useSearchParams();
    const sellerId = searchParams.get('seller') || '';

    const [product, setProduct] = useState<VisaProduct | null>(null);
    const [loading, setLoading] = useState(true);

    // 1. Inicializar estado central
    const { state, actions } = useVisaCheckoutForm();

    // 2. Inicializar lógica de navegação
    const { handlePrev } = useCheckoutSteps(state, actions);

    // 3. Inicializar recuperação de rascunho
    useDraftRecovery(productSlug, sellerId, loading, state, actions);

    // 4. Inicializar handlers especializados
    const { handleNextStep2 } = useDocumentUpload(state, actions);
    useTemplateLoader(productSlug, actions);

    const baseTotal = product ? calculateBaseTotal(product, state.extraUnits) : 0;
    const totalWithFees = product ? calculateTotalWithFees(baseTotal, state.paymentMethod, state.exchangeRate || undefined) : 0;

    const paymentHandlers = usePaymentHandlers(
        productSlug,
        sellerId,
        baseTotal,
        totalWithFees,
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
                    actions.setError('Produto não encontrado ou inativo.');
                    return;
                }
                setProduct(data);
                if (sellerId) await trackLinkClick(sellerId, productSlug);
            } catch (err) {
                actions.setError('Erro ao carregar os detalhes do produto.');
            } finally {
                setLoading(false);
            }
        };
        loadProduct();
    }, [productSlug, sellerId]);

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white p-4">
                <Loader2 className="w-12 h-12 text-gold-medium animate-spin mb-4" />
                <p className="text-gold-light font-medium animate-pulse">Carregando sua aplicação...</p>
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
                    <h1 className="text-2xl sm:text-3xl font-bold migma-gold-text">Visa Application Checkout</h1>
                    {sellerId && (
                        <p className="text-gray-400 text-sm">Seller ID: <span className="text-gold-light">{sellerId}</span></p>
                    )}
                </header>

                <StepIndicator currentStep={state.currentStep} totalSteps={3} />

                {state.error && (
                    <div className="mb-6 bg-red-500/10 border border-red-500/50 text-red-300 p-4 rounded-lg flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <p className="text-sm">{state.error}</p>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                    <main className="lg:col-span-2 space-y-6">
                        {(state.currentStep === 1 || state.currentStep === 2) && (
                            <div className="bg-zinc-900/50 border border-gold-medium/20 rounded-xl p-6 space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                                <h2 className="text-gold-light font-bold text-lg">Product Details</h2>
                                <div>
                                    <h3 className="text-white font-bold text-xl mb-1">{product.name}</h3>
                                    <p className="text-gray-400 text-sm leading-relaxed">{product.description}</p>
                                </div>
                                <div className="pt-2 space-y-2 border-t border-white/5">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-400">Base Price:</span>
                                        <span className="text-white font-bold text-lg">US$ {parseFloat(product.base_price_usd).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-400">Per dependents:</span>
                                        <span className="text-gray-300">US$ {parseFloat(product.extra_unit_price).toFixed(2)}</span>
                                    </div>
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
                                <Step3Payment state={state} actions={actions} handlers={paymentHandlers} onPrev={handlePrev} />
                            </div>
                        )}
                    </main>

                    {state.currentStep === 3 && (
                        <aside className="lg:col-span-1 sticky top-8">
                            <OrderSummary
                                product={product}
                                extraUnits={state.extraUnits}
                                totalWithFees={totalWithFees}
                                paymentMethod={state.paymentMethod}
                                exchangeRate={state.exchangeRate}
                                showPaymentButton={true}
                                isSubmitting={state.submitting}
                                isPaymentReady={state.signatureConfirmed && state.termsAccepted && (state.paymentMethod !== 'zelle' || !!state.zelleReceipt)}
                                onPay={() => {
                                    if (state.paymentMethod === 'zelle') paymentHandlers.handleZellePayment();
                                    else if (state.paymentMethod === 'parcelow') paymentHandlers.handleParcelowPayment?.();
                                    else paymentHandlers.handleStripeCheckout(state.paymentMethod as 'card' | 'pix');
                                }}
                            />
                        </aside>
                    )}
                </div>
            </div>
        </div>
    );
};
