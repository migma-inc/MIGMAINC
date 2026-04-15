/**
 * EB-3 Installment Checkout Page
 * Multi-step checkout following the Migma Standard (Step 1, 2, 3)
 */

import { useRef, useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { AlertCircle, ArrowLeft, Clock, ShieldCheck, FileText, CreditCard, Loader2, Ticket, CheckCircle, XCircle, Tag } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LanguageSelector } from '@/components/LanguageSelector';
import { StepIndicator } from '@/features/visa-checkout/components/shared/StepIndicator';
import { SignaturePadComponent } from '@/components/ui/signature-pad';
import { ZelleUpload } from '@/features/visa-checkout/components/steps/step3/ZelleUpload';
import { PayerAlternativeForm } from '@/features/visa-checkout/components/payment/PayerAlternativeForm';
import type { PayerInfo } from '@/features/visa-checkout/types/form.types';

interface InstallmentData {
    id: string;
    installment_number: number;
    due_date: string;
    amount_usd: number;
    late_fee_usd: number;
    status: string;
    client_id: string;
    client_name: string;
    client_email: string;
    order_id: string;
}

export const EB3InstallmentCheckout = () => {
    const { t } = useTranslation();
    const { installmentId: pathInstallmentId } = useParams<{ installmentId: string }>();
    const [searchParams] = useSearchParams();
    const prefillId = searchParams.get('prefill');
    const urlSellerId = searchParams.get('seller');
    const navigate = useNavigate();
    const installmentId = pathInstallmentId || prefillId;

    // Core States
    const [currentStep, setCurrentStep] = useState(1);
    const [installment, setInstallment] = useState<InstallmentData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [sellerPublicId, setSellerPublicId] = useState<string | null>(urlSellerId);

    // Form States
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [dataAuthorization, setDataAuthorization] = useState(false);
    const [signatureImageDataUrl, setSignatureImageDataUrl] = useState<string | null>(null);
    const [signatureConfirmed, setSignatureConfirmed] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<'zelle' | 'parcelow'>('zelle');
    const [zelleReceipt, setZelleReceipt] = useState<File | null>(null);
    const [cpf, setCpf] = useState('');
    const [creditCardName, setCreditCardName] = useState('');
    const [payerInfo, setPayerInfo] = useState<PayerInfo | null>(null);

    // Coupon States
    const [couponCode, setCouponCode] = useState('');
    const [appliedCoupon, setAppliedCoupon] = useState<{
        code: string;
        discountType: 'fixed' | 'percentage';
        discountValue: number;
    } | null>(null);
    const [couponLoading, setCouponLoading] = useState(false);
    const [couponMessage, setCouponMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    const hasLoaded = useRef(false);

    useEffect(() => {
        // Garantir que só carrega uma vez por montagem ou mudança real de ID
        if (installmentId && !hasLoaded.current) {
            console.log('[EB-3 DEBUG] First load attempt for ID:', installmentId);
            loadInstallment();
            hasLoaded.current = true;
        }
    }, [installmentId]);

    const loadInstallment = async () => {
        try {
            setLoading(true);
            let targetInstallmentId = installmentId;

            // If we have a prefill token, we need to resolve it to the real installment ID
            if (prefillId) {
                console.log('[EB-3] Resolving prefill token:', prefillId);
                const { data: prefillData, error: prefillError } = await supabase
                    .from('checkout_prefill_tokens')
                    .select('client_data')
                    .eq('token', prefillId)
                    .maybeSingle();

                if (prefillError) {
                    console.error('[EB-3] Error fetching prefill token:', prefillError);
                } else if (prefillData?.client_data?.eb3_schedule_id) {
                    console.log('[EB-3] Token resolved to schedule_id:', prefillData.client_data.eb3_schedule_id);
                    targetInstallmentId = prefillData.client_data.eb3_schedule_id;
                }
            }

            if (!targetInstallmentId || targetInstallmentId.length < 30) {
                // If it's not a UUID (like the 'monthly' placeholder), and token resolution failed
                setError('Invalid payment link. Please use the link provided in your email.');
                setLoading(false);
                return;
            }

            const { data: scheduleData, error: scheduleError } = await supabase
                .from('eb3_recurrence_schedules')
                .select(`
                    id,
                    installment_number,
                    due_date,
                    amount_usd,
                    late_fee_usd,
                    status,
                    client_id,
                    order_id,
                    seller_id,
                    clients (
                        full_name,
                        email
                    )
                `)
                .eq('id', targetInstallmentId)
                .single();

            if (scheduleError || !scheduleData) {
                console.error('[EB-3] Schedule error:', scheduleError);
                setError('Installment not found or already paid.');
                return;
            }

            if (scheduleData.status === 'paid') {
                setError(t('checkout.error_installment_already_paid', 'This installment has already been paid. Thank you!'));
                return;
            }

            if (scheduleData.seller_id && !sellerPublicId) {
                const { data: sellerData } = await supabase
                    .from('sellers')
                    .select('seller_id_public')
                    .eq('id', scheduleData.seller_id)
                    .single();
                if (sellerData) setSellerPublicId(sellerData.seller_id_public);
            }

            console.log('[EB-3 DEBUG] Schedule data loaded:', scheduleData);
            setInstallment({
                id: scheduleData.id,
                installment_number: scheduleData.installment_number,
                due_date: scheduleData.due_date,
                amount_usd: scheduleData.amount_usd,
                late_fee_usd: scheduleData.late_fee_usd,
                status: scheduleData.status,
                client_id: scheduleData.client_id,
                client_name: (scheduleData.clients as any)?.full_name || 'N/A',
                client_email: (scheduleData.clients as any)?.email || 'N/A',
                order_id: scheduleData.order_id
            });
        } catch (e: any) {
            console.error('[EB-3 DEBUG] Exception in loadInstallment:', e);
            setError(e.message || 'Ocorreu um erro ao carregar os dados.');
        } finally {
            setLoading(false);
            console.log('[EB-3 DEBUG] Loading finished');
        }
    };

    const handleApplyCoupon = async () => {
        if (!couponCode.trim()) return;
        setCouponLoading(true);
        setCouponMessage(null);
        try {
            const { data, error } = await supabase.rpc('validate_promotional_coupon', {
                p_code: couponCode.trim()
            });
            if (error) throw error;
            if (data && data.valid) {
                setAppliedCoupon({
                    code: data.code,
                    discountType: data.type,
                    discountValue: data.value
                });
                setCouponMessage({ text: 'Coupon applied successfully!', type: 'success' });
            } else {
                setAppliedCoupon(null);
                setCouponMessage({ text: data?.message || 'Invalid or inactive coupon.', type: 'error' });
            }
        } catch (err) {
            console.error('Coupon validation error:', err);
            setAppliedCoupon(null);
            setCouponMessage({ text: 'Error validating coupon. Please try again.', type: 'error' });
        } finally {
            setCouponLoading(false);
        }
    };

    const handleRemoveCoupon = () => {
        setAppliedCoupon(null);
        setCouponCode('');
        setCouponMessage(null);
    };

    const handleNext = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setCurrentStep(prev => prev + 1);
    };

    const handlePrev = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setCurrentStep(prev => prev - 1);
    };

    const handlePayment = async () => {
        if (!installment) return;

        setIsProcessing(true);
        setError(null);

        try {
            // 🆕 Verificar se está vencido comparando a data atual com due_date
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Reset hora para comparar apenas a data

            const dueDate = new Date(installment.due_date);
            dueDate.setHours(0, 0, 0, 0);

            const isOverdue = today > dueDate && installment.status === 'pending';
            const totalAmount = Number(installment.amount_usd) + (isOverdue ? Number(installment.late_fee_usd) : 0);

            // Create visa order for this installment
            const { data: orderData, error: orderError } = await supabase
                .from('visa_orders')
                .insert({
                    client_id: installment.client_id,
                    client_name: installment.client_name,
                    client_email: installment.client_email,
                    product_slug: 'eb3-maintenance-installment',
                    payment_method: paymentMethod,
                    total_price_usd: totalAmount,
                    payment_status: 'pending',
                    signature_url: signatureImageDataUrl,
                    cpf: paymentMethod === 'parcelow' ? cpf : null,
                    card_name: paymentMethod === 'parcelow' ? creditCardName : null,
                    coupon_code: appliedCoupon?.code ?? null,
                    discount_amount: discountAmount > 0 ? discountAmount : null,
                    payment_metadata: {
                        eb3_schedule_id: installment.id,
                        installment_number: installment.installment_number,
                        is_late_payment: isOverdue,
                        base_amount: String(installment.amount_usd),
                        late_fee: isOverdue ? String(installment.late_fee_usd) : '0',
                        terms_accepted: termsAccepted,
                        data_authorization: dataAuthorization,
                        seller_context: sellerPublicId,
                        payer_info: payerInfo
                    }
                })
                .select()
                .single();

            if (orderError || !orderData) {
                throw new Error('Failed to create payment order');
            }

            // Upload Zelle Receipt if applicable
            if (paymentMethod === 'zelle' && zelleReceipt) {
                const fileExt = zelleReceipt.name.split('.').pop();
                const fileName = `${orderData.id}_receipt.${fileExt}`;
                const filePath = `receipts/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('zelle-receipts')
                    .upload(filePath, zelleReceipt);

                if (!uploadError) {
                    await supabase
                        .from('zelle_payments')
                        .insert({
                            order_id: orderData.id,
                            client_id: installment.client_id,
                            amount: totalAmount,
                            receipt_url: filePath,
                            status: 'pending'
                        });
                }
            }

            // Redirect based on payment method
            if (paymentMethod === 'zelle') {
                navigate(`/checkout/zelle/processing?order=${orderData.id}&type=eb3-installment`);
            } else {
                // Create Parcelow checkout
                const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke(
                    'create-parcelow-checkout',
                    {
                        body: {
                            order_id: orderData.id,
                            amount: totalAmount,
                            currency: 'USD',
                            customer_email: installment.client_email,
                            customer_name: installment.client_name,
                            description: `EB-3 Maintenance - Installment #${installment.installment_number}`,
                            metadata: {
                                type: 'eb3-installment',
                                schedule_id: installment.id,
                                cpf: payerInfo?.cpf || cpf,
                                payer_info: payerInfo
                            }
                        }
                    }
                );

                if (checkoutError || !checkoutData?.checkoutUrl) {
                    throw new Error('Failed to create Parcelow checkout');
                }

                window.location.href = checkoutData.checkoutUrl;
            }

        } catch (err) {
            console.error('Payment error:', err);
            setError(err instanceof Error ? err.message : 'Failed to process payment');
            setIsProcessing(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
                <Loader2 className="w-12 h-12 text-gold-medium animate-spin mb-4" />
                <p className="text-gold-light animate-pulse font-medium tracking-widest uppercase text-xs">Loading Security Environment...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-4">
                <Card className="max-w-md w-full bg-zinc-900/50 border border-gold-medium/30">
                    <CardHeader>
                        <CardTitle className="text-red-400 flex items-center gap-2">
                            <AlertCircle className="w-5 h-5" />
                            {t('checkout.payment_unavailable', 'Payment Unavailable')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-gray-300 mb-6">{error}</p>
                        <Link to="/">
                            <Button className="w-full bg-gold-medium text-black font-bold hover:bg-gold-light">
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                {t('checkout.back_to_home', 'Back to Home')}
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!installment) return null;

    // 🆕 Verificar se está vencido comparando a data atual com due_date
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dueDate = new Date(installment.due_date);
    dueDate.setHours(0, 0, 0, 0);

    const isOverdue = today > dueDate && installment.status === 'pending';
    const baseAmount = Number(installment.amount_usd) + (isOverdue ? Number(installment.late_fee_usd) : 0);
    let discountAmount = 0;
    if (appliedCoupon) {
        if (appliedCoupon.discountType === 'fixed') {
            discountAmount = appliedCoupon.discountValue;
        } else {
            discountAmount = baseAmount * (appliedCoupon.discountValue / 100);
        }
        discountAmount = Math.min(discountAmount, baseAmount);
    }
    const totalAmount = Math.max(0, baseAmount - discountAmount);
    const formattedDueDate = new Date(installment.due_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    return (
        <div className="min-h-screen bg-black py-8 sm:py-12 px-4 sm:px-6 lg:px-8 notranslate" translate="no">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <header className="flex flex-col mb-8 gap-2">
                    <div className="flex justify-between items-start">
                        <Link to="/" className="inline-flex items-center text-gold-light hover:text-gold-medium transition-colors mb-2">
                            <ArrowLeft className="w-4 h-4 mr-2" /> {t('checkout.back_to_home', 'Back to Home')}
                        </Link>
                        <LanguageSelector />
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-bold migma-gold-text uppercase tracking-wider">{t('checkout.eb3_title', 'EB-3 Maintenance Checkout')}</h1>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                        <p className="text-gray-400 text-sm">Installment #{installment.installment_number} of 8</p>
                        {sellerPublicId && (
                            <p className="text-gray-400 text-sm">Seller: <span className="text-gold-light">{sellerPublicId}</span></p>
                        )}
                    </div>
                </header>

                <StepIndicator currentStep={currentStep} totalSteps={3} />

                {error && (
                    <div className="mb-6 bg-red-500/10 border border-red-500/50 text-red-300 p-4 rounded-lg flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <p className="text-sm">{error}</p>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                    <main className="lg:col-span-2 space-y-6">

                        {/* STEP 1: Personal Info Review */}
                        {currentStep === 1 && (
                            <Card className="bg-zinc-900/50 border border-gold-medium/20 animate-in fade-in slide-in-from-left-4 duration-300">
                                <CardHeader>
                                    <CardTitle className="text-gold-light text-lg flex items-center gap-2">
                                        <ShieldCheck className="w-5 h-5" />
                                        Step 1: Personal Information
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="grid grid-cols-1 gap-4">
                                        <div className="space-y-1">
                                            <Label className="text-gray-400 text-xs uppercase">Full Name</Label>
                                            <p className="text-white font-medium border-b border-white/5 pb-2">{installment.client_name}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-gray-400 text-xs uppercase">Email Address</Label>
                                            <p className="text-white font-medium border-b border-white/5 pb-2">{installment.client_email}</p>
                                        </div>
                                    </div>

                                    {/* Coupon Section */}
                                    <div className="space-y-2 pt-2 border-t border-white/5">
                                        <h3 className="text-sm font-medium text-white flex items-center gap-2">
                                            <Ticket className="w-4 h-4 text-gold-medium" />
                                            Have a coupon?
                                        </h3>
                                        <div className="flex gap-2">
                                            <Input
                                                value={couponCode}
                                                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                                                placeholder="Enter coupon code"
                                                className="bg-black/50 border-gold-medium/30 text-white uppercase placeholder:normal-case placeholder:text-gray-500"
                                                disabled={!!appliedCoupon || couponLoading}
                                                onKeyDown={(e) => e.key === 'Enter' && handleApplyCoupon()}
                                            />
                                            {appliedCoupon ? (
                                                <Button
                                                    variant="outline"
                                                    onClick={handleRemoveCoupon}
                                                    className="border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300 shrink-0"
                                                >
                                                    Remove
                                                </Button>
                                            ) : (
                                                <Button
                                                    onClick={handleApplyCoupon}
                                                    disabled={!couponCode.trim() || couponLoading}
                                                    className="bg-gold-medium text-black hover:bg-gold-light font-medium shrink-0"
                                                >
                                                    {couponLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
                                                </Button>
                                            )}
                                        </div>
                                        {couponMessage && (
                                            <div className={`text-xs flex items-center gap-1.5 ${couponMessage.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                                                {couponMessage.type === 'success' ? (
                                                    <CheckCircle className="w-3.5 h-3.5" />
                                                ) : (
                                                    <XCircle className="w-3.5 h-3.5" />
                                                )}
                                                {couponMessage.text}
                                            </div>
                                        )}
                                    </div>

                                    <Button
                                        onClick={handleNext}
                                        className="w-full bg-gold-medium text-black font-bold hover:bg-gold-light h-12"
                                    >
                                        Continue to Confirmation
                                    </Button>
                                </CardContent>
                            </Card>
                        )}

                        {/* STEP 2: Confirmation & Signature */}
                        {currentStep === 2 && (
                            <Card className="bg-zinc-900/50 border border-gold-medium/20 animate-in fade-in slide-in-from-left-4 duration-300">
                                <CardHeader>
                                    <CardTitle className="text-gold-light text-lg flex items-center gap-2">
                                        <FileText className="w-5 h-5" />
                                        Step 2: Terms & Signature
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="space-y-4 bg-black/40 p-4 rounded-lg border border-white/5">
                                        <div className="flex items-start gap-3">
                                            <Checkbox
                                                id="terms"
                                                checked={termsAccepted}
                                                onCheckedChange={(checked) => setTermsAccepted(!!checked)}
                                                className="mt-1 border-gold-medium data-[state=checked]:bg-gold-medium data-[state=checked]:text-black"
                                            />
                                            <Label htmlFor="terms" className="text-sm text-gray-300 leading-relaxed cursor-pointer">
                                                I confirm that I am paying the EB-3 maintenance installment #{installment.installment_number} and I agree to the terms of the recurrence program.
                                            </Label>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <Checkbox
                                                id="auth"
                                                checked={dataAuthorization}
                                                onCheckedChange={(checked) => setDataAuthorization(!!checked)}
                                                className="mt-1 border-gold-medium data-[state=checked]:bg-gold-medium data-[state=checked]:text-black"
                                            />
                                            <Label htmlFor="auth" className="text-sm text-gray-300 leading-relaxed cursor-pointer">
                                                I authorize MIGMA Inc. to process my payment information for this maintenance plan.
                                            </Label>
                                        </div>
                                    </div>

                                    {termsAccepted && dataAuthorization && (
                                        <div className="space-y-4 pt-4 border-t border-white/5">
                                            <Label className="text-white font-medium mb-2 block">Digital Signature *</Label>
                                            <SignaturePadComponent
                                                onSignatureChange={setSignatureImageDataUrl}
                                                onSignatureConfirm={(url) => {
                                                    setSignatureImageDataUrl(url);
                                                    setSignatureConfirmed(true);
                                                }}
                                                savedSignature={signatureImageDataUrl}
                                                isConfirmed={signatureConfirmed}
                                                onEdit={() => setSignatureConfirmed(false)}
                                            />
                                        </div>
                                    )}

                                    <div className="flex gap-4 pt-4">
                                        <Button variant="outline" onClick={handlePrev} className="flex-1 border-gold-medium text-gold-light hover:bg-gold-medium/10">
                                            Back
                                        </Button>
                                        <Button
                                            disabled={!termsAccepted || !dataAuthorization || !signatureConfirmed}
                                            onClick={handleNext}
                                            className="flex-[2] bg-gold-medium text-black font-bold hover:bg-gold-light h-12"
                                        >
                                            Continue to Payment
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* STEP 3: Payment Method */}
                        {currentStep === 3 && (
                            <Card className="bg-zinc-900/50 border border-gold-medium/20 animate-in fade-in slide-in-from-left-4 duration-300">
                                <CardHeader>
                                    <CardTitle className="text-gold-light text-lg flex items-center gap-2">
                                        <CreditCard className="w-5 h-5" />
                                        Step 3: Payment Method
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="grid grid-cols-1 gap-3">
                                        <button
                                            onClick={() => setPaymentMethod('zelle')}
                                            className={`p-4 rounded-xl border-2 transition-all flex items-center justify-between ${paymentMethod === 'zelle' ? 'border-gold-medium bg-gold-medium/10 ring-1 ring-gold-medium' : 'border-white/5 bg-black/40 hover:border-white/20'}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'zelle' ? 'border-gold-medium' : 'border-gray-600'}`}>
                                                    {paymentMethod === 'zelle' && <div className="w-2.5 h-2.5 rounded-full bg-gold-medium" />}
                                                </div>
                                                <div className="text-left">
                                                    <p className="text-white font-bold">Zelle</p>
                                                    <p className="text-xs text-gray-500">Fast processing, no extra fees</p>
                                                </div>
                                            </div>
                                            <span className="text-xs font-bold text-green-500">FREE</span>
                                        </button>

                                        <button
                                            onClick={() => setPaymentMethod('parcelow')}
                                            className={`p-4 rounded-xl border-2 transition-all flex items-center justify-between ${paymentMethod === 'parcelow' ? 'border-gold-medium bg-gold-medium/10 ring-1 ring-gold-medium' : 'border-white/5 bg-black/40 hover:border-white/20'}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'parcelow' ? 'border-gold-medium' : 'border-gray-600'}`}>
                                                    {paymentMethod === 'parcelow' && <div className="w-2.5 h-2.5 rounded-full bg-gold-medium" />}
                                                </div>
                                                <div className="text-left">
                                                    <p className="text-white font-bold">Credit Card (Parcelow)</p>
                                                    <p className="text-xs text-gray-500">Payment in BRL up to 12x</p>
                                                </div>
                                            </div>
                                            <span className="text-xs text-gray-500">+ fees</span>
                                        </button>
                                    </div>

                                    {paymentMethod === 'zelle' && (
                                        <div className="animate-in fade-in slide-in-from-top-2 pt-2">
                                            <ZelleUpload
                                                onFileSelect={setZelleReceipt}
                                                currentFile={zelleReceipt}
                                                onClear={() => setZelleReceipt(null)}
                                            />
                                        </div>
                                    )}

                                    {paymentMethod === 'parcelow' && (
                                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 pt-2">
                                            <PayerAlternativeForm
                                                payerInfo={payerInfo}
                                                onPayerInfoChange={setPayerInfo}
                                                baseCpf={cpf}
                                                baseCardName={creditCardName}
                                            />

                                            {!payerInfo && (
                                                <div className="space-y-4">
                                                    <div className="space-y-2">
                                                        <Label className="text-white text-sm">Brazilian CPF *</Label>
                                                        <Input
                                                            value={cpf}
                                                            onChange={(e) => setCpf(e.target.value.replace(/\D/g, '').slice(0, 11))}
                                                            placeholder="000.000.000-00"
                                                            className="bg-black border-white/10 text-white h-11"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-white text-sm">Name on Card *</Label>
                                                        <Input
                                                            value={creditCardName}
                                                            onChange={(e) => setCreditCardName(e.target.value.toUpperCase())}
                                                            placeholder="AS PRINTED ON CARD"
                                                            className="bg-black border-white/10 text-white h-11 uppercase"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="flex gap-4 pt-4">
                                        <Button variant="outline" onClick={handlePrev} className="flex-1 border-gold-medium text-gold-light hover:bg-gold-medium/10">
                                            Back
                                        </Button>
                                        <Button
                                            disabled={isProcessing || (paymentMethod === 'zelle' && !zelleReceipt) || (paymentMethod === 'parcelow' && (!cpf || cpf.length < 11 || !creditCardName))}
                                            onClick={handlePayment}
                                            className="flex-[2] bg-gold-medium text-black font-bold hover:bg-gold-light h-12"
                                        >
                                            {isProcessing ? 'Processing...' : `Pay $${totalAmount.toFixed(2)} Now`}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </main>

                    {/* Sidebar Summary */}
                    <aside className="space-y-6">
                        <Card className="bg-zinc-900/80 border border-gold-medium/30 sticky top-8">
                            <CardHeader className="border-b border-white/5">
                                <CardTitle className="text-white text-base flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-gold-light" />
                                    Order Summary
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-4">
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-400">Installment:</span>
                                        <span className="text-white font-medium">#{installment.installment_number} of 8</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-400">Due Date:</span>
                                        <span className={`font-medium ${isOverdue ? 'text-red-400' : 'text-white'}`}>{formattedDueDate}</span>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-white/5 space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-400">Base Amount:</span>
                                        <span className="text-white font-medium">${Number(installment.amount_usd).toFixed(2)}</span>
                                    </div>
                                    {isOverdue && (
                                        <div className="flex justify-between text-sm text-red-400">
                                            <span>Late Fee:</span>
                                            <span className="font-medium">+ ${Number(installment.late_fee_usd).toFixed(2)}</span>
                                        </div>
                                    )}
                                    {appliedCoupon && discountAmount > 0 && (
                                        <div className="flex justify-between text-sm text-green-400">
                                            <span className="flex items-center gap-1">
                                                <Tag className="w-3 h-3" />
                                                Discount ({appliedCoupon.code}):
                                            </span>
                                            <span className="font-medium">- ${discountAmount.toFixed(2)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center pt-2 border-t border-white/5 mt-2">
                                        <span className="text-gold-light font-bold">Total Due:</span>
                                        <span className="text-white text-xl font-bold">${totalAmount.toFixed(2)}</span>
                                    </div>
                                </div>

                                <p className="text-[10px] text-gray-500 text-center uppercase tracking-tighter">Secure Payment Powered by Migma Inc.</p>
                            </CardContent>
                        </Card>
                    </aside>
                </div>
            </div>
        </div>
    );
};
