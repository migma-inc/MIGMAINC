import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
    StripeService,
    ZelleService
} from '../index';
import type {
    StripeCheckoutRequest,
    ZellePaymentRequest,
} from '../index';
import {
    trackFormCompleted,
    trackPaymentStarted
} from '@/lib/funnel-tracking';
import { getClientIP } from '@/lib/visa-checkout-utils';
import { saveStep3Data, uploadSignature } from '@/lib/visa-checkout-service';
import type { VisaCheckoutState, VisaCheckoutActions } from '../types/form.types';

export const usePaymentHandlers = (
    productSlug: string | undefined,
    sellerId: string | null,
    baseTotal: number,
    totalWithFees: number,
    discountAmountExplicit: number,
    state: VisaCheckoutState,
    actions: VisaCheckoutActions
) => {
    const {
        serviceRequestId,
        clientName,
        clientEmail,
        clientWhatsApp,
        clientCountry,
        clientNationality,
        clientObservations,
        extraUnits,
        dependentNames,
        termsAccepted,
        dataAuthorization,
        signatureImageDataUrl,
        signatureConfirmed,
        documentFiles,
        hasExistingContract,
        existingContractData,
        contractTemplate,
        exchangeRate,
        zelleReceipt,
        creditCardName,
        cpf,
        couponCode,
        billingInstallmentId,
        eb3ScheduleId,
        scholarshipScheduleId,
        // discountAmount removed from state destructuring to avoid conflict
    } = state;

    // Use the explicit value passed from parent which is calculated in render
    const discountAmount = discountAmountExplicit;

    const {
        setError,
        setSubmitting,
        setIsZelleProcessing
    } = actions;

    // Internal helper for Step 3 validation
    const validateStep3 = useCallback(async (paymentMethod?: string) => {
        if (!termsAccepted || !dataAuthorization || !signatureConfirmed || !signatureImageDataUrl) {
            setError('Please accept terms and confirm your signature');
            return false;
        }
        if (paymentMethod === 'parcelow_card') {
            // Cartão: exige CPF + dados de cartão (ou payerInfo completo se for cartão de terceiro)
            if (state.payerInfo) {
                if (!state.payerInfo.name) {
                    setError('Please enter the payer name');
                    return false;
                }
                if (!state.payerInfo.cpf || !validateCPF(state.payerInfo.cpf)) {
                    setError('The payer CPF provided is invalid');
                    return false;
                }
                if (!state.payerInfo.email) {
                    setError('Please enter the payer email');
                    return false;
                }
            } else {
                if (!validateCPF(cpf)) {
                    setError('The CPF provided is invalid. Please check the digits.');
                    return false;
                }
                if (!creditCardName) {
                    setError('Please enter the name exactly as it appears on your card');
                    return false;
                }
            }
        } else if (paymentMethod === 'card') {
            if (!creditCardName) {
                setError('Please enter the name exactly as it appears on your card');
                return false;
            }
        } else if (paymentMethod === 'parcelow_pix' || paymentMethod === 'parcelow_ted') {
            // PIX / TED: só exige CPF
            if (!validateCPF(cpf)) {
                setError('The CPF provided is invalid. Please check the digits.');
                return false;
            }
        }

        if (!serviceRequestId) {
            setError('Service request ID is missing');
            return false;
        }

        const result = await saveStep3Data(
            serviceRequestId,
            termsAccepted,
            dataAuthorization,
            contractTemplate?.id || null,
            paymentMethod
        );

        if (!result.success) {
            setError(result.error || 'Failed to save terms');
            return false;
        }

        return true;
    }, [termsAccepted, dataAuthorization, signatureConfirmed, signatureImageDataUrl, serviceRequestId, contractTemplate, setError, creditCardName, cpf, state.payerInfo, state.splitPaymentConfig]);

    // Helper to validate CPF checksum
    const validateCPF = (val: string) => {
        const cleaned = val.replace(/\D/g, '');
        if (cleaned.length !== 11 || /^(\d)\1{10}$/.test(cleaned)) return false;

        let sum = 0;
        let rest;
        for (let i = 1; i <= 9; i++) sum = sum + parseInt(cleaned.substring(i - 1, i)) * (11 - i);
        rest = (sum * 10) % 11;
        if ((rest === 10) || (rest === 11)) rest = 0;
        if (rest !== parseInt(cleaned.substring(9, 10))) return false;

        sum = 0;
        for (let i = 1; i <= 10; i++) sum = sum + parseInt(cleaned.substring(i - 1, i)) * (12 - i);
        rest = (sum * 10) % 11;
        if ((rest === 10) || (rest === 11)) rest = 0;
        if (rest !== parseInt(cleaned.substring(10, 11))) return false;

        return true;
    };

    const handleStripeCheckout = useCallback(async (method: 'card' | 'pix') => {
        if (state.submitting) return;

        setSubmitting(true);
        try {
            if (!await validateStep3(method)) {
                setSubmitting(false);
                return;
            }

            if (sellerId && productSlug) {
                await trackFormCompleted(sellerId, productSlug, {
                    extra_units: extraUnits,
                    payment_method: method,
                    service_request_id: serviceRequestId,
                    client_name: clientName,
                    client_email: clientEmail,
                    client_whatsapp: clientWhatsApp,
                });
                await trackPaymentStarted(sellerId, productSlug, method, {
                    total_amount: totalWithFees,
                    extra_units: extraUnits,
                    service_request_id: serviceRequestId,
                });
            }

            // 1. Get document URLs
            const documentFrontUrl = (hasExistingContract && existingContractData)
                ? existingContractData.contract_document_url
                : documentFiles?.documentFront?.url || '';
            const selfieUrl = (hasExistingContract && existingContractData)
                ? existingContractData.contract_selfie_url
                : documentFiles?.selfie?.url || '';

            // 3. Upload signature if needed
            let signatureUrl = '';
            if (signatureImageDataUrl) {
                const uploadedUrl = await uploadSignature(signatureImageDataUrl, state.clientId);
                if (uploadedUrl) {
                    signatureUrl = uploadedUrl;
                }
            }

            // 4. Process
            const request: StripeCheckoutRequest = {
                product_slug: productSlug!,
                seller_id: sellerId || null,
                extra_units: extraUnits,
                dependent_names: dependentNames,
                client_name: clientName,
                client_email: clientEmail,
                client_whatsapp: clientWhatsApp || null,
                client_country: clientCountry || null,
                client_nationality: clientNationality || null,
                client_observations: clientObservations || null,
                payment_method: method,
                exchange_rate: exchangeRate,
                contract_document_url: documentFrontUrl,
                contract_selfie_url: selfieUrl,
                signature_image_url: signatureUrl,
                service_request_id: serviceRequestId!,
                ip_address: await getClientIP(),
                contract_accepted: true,
                contract_signed_at: new Date().toISOString(),
                contract_template_id: contractTemplate?.id,
                upsell_product_slug: state.selectedUpsell === 'none' ? null : (state.selectedUpsell === 'canada-premium' ? 'canada-tourist-premium' : 'canada-tourist-revolution') as any,
                upsell_contract_template_id: state.upsellContractTemplate?.id,
                billing_installment_id: billingInstallmentId,
                payer_info: state.payerInfo,
                coupon_code: couponCode,
                discount_amount: discountAmount,
            };

            const response = await StripeService.createCheckoutSession(request);
            StripeService.redirectToCheckout(response.url);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Stripe payment failed');
            setSubmitting(false);
        }
    }, [productSlug, sellerId, totalWithFees, extraUnits, serviceRequestId, clientName, clientEmail, clientWhatsApp, validateStep3, documentFiles, hasExistingContract, existingContractData, dependentNames, clientCountry, clientNationality, clientObservations, exchangeRate, contractTemplate, setSubmitting, setError, state.submitting, state.selectedUpsell, state.upsellContractTemplate, couponCode, discountAmount, billingInstallmentId]);

    const handleZellePayment = useCallback(async () => {
        if (state.submitting) return;

        setSubmitting(true);
        try {
            if (!await validateStep3('zelle')) {
                setSubmitting(false);
                return;
            }

            if (!zelleReceipt) {
                setError('Please upload Zelle receipt');
                setSubmitting(false);
                return;
            }

            setIsZelleProcessing(true);
            // Logic from VisaCheckout...
            // Upload signature if needed
            let signatureUrl = '';
            if (signatureImageDataUrl) {
                const uploadedUrl = await uploadSignature(signatureImageDataUrl, state.clientId);
                if (uploadedUrl) {
                    signatureUrl = uploadedUrl;
                }
            }

            const request: ZellePaymentRequest = {
                product_slug: productSlug!,
                seller_id: sellerId || null,
                extra_units: extraUnits,
                dependent_names: dependentNames,
                client_name: clientName,
                client_email: clientEmail,
                client_whatsapp: clientWhatsApp || null,
                client_country: clientCountry || null,
                client_nationality: clientNationality || null,
                client_observations: clientObservations || null,
                payment_method: 'zelle',
                contract_document_url: '', // same logic as stripe
                contract_selfie_url: '',
                signature_image_url: signatureUrl,
                service_request_id: serviceRequestId!,
                ip_address: await getClientIP(),
                contract_accepted: true,
                contract_signed_at: new Date().toISOString(),
                contract_template_id: contractTemplate?.id,
                zelle_receipt_url: '',
                upsell_product_slug: state.selectedUpsell === 'none' ? null : (state.selectedUpsell === 'canada-premium' ? 'canada-tourist-premium' : 'canada-tourist-revolution') as any,
                upsell_contract_template_id: state.upsellContractTemplate?.id,
                billing_installment_id: billingInstallmentId,
                eb3_schedule_id: eb3ScheduleId,
                scholarship_schedule_id: scholarshipScheduleId,
                coupon_code: couponCode,
                discount_amount: discountAmount,
            };

            const response = await ZelleService.processPayment(request, zelleReceipt, baseTotal);
            if (response.status === 'approved') {
                window.location.href = `/checkout/success?order_id=${response.order_id}&method=zelle`;
            } else {
                window.location.href = '/checkout/zelle/processing';
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Zelle payment failed');
            setSubmitting(false);
            setIsZelleProcessing(false);
        }
    }, [productSlug, sellerId, baseTotal, validateStep3, zelleReceipt, extraUnits, serviceRequestId, clientName, clientEmail, clientWhatsApp, dependentNames, clientCountry, clientNationality, clientObservations, contractTemplate, setSubmitting, setIsZelleProcessing, setError, state.submitting, couponCode, discountAmount, state.selectedUpsell, state.upsellContractTemplate]);

    const handleParcelowPayment = useCallback(async () => {
        console.log('🔥🔥🔥🔥🔥 VERSÃO NOVA CARREGADA - handleParcelowPayment 🔥🔥🔥🔥🔥');
        if (state.submitting) return;

        setSubmitting(true);
        try {
            if (!await validateStep3(state.paymentMethod)) {
                setSubmitting(false);
                return;
            }

            if (sellerId && productSlug) {
                await trackFormCompleted(sellerId, productSlug, {
                    extra_units: extraUnits,
                    payment_method: state.paymentMethod,
                    service_request_id: serviceRequestId,
                    client_name: clientName,
                    client_email: clientEmail,
                    client_whatsapp: clientWhatsApp,
                });
                await trackPaymentStarted(sellerId, productSlug, state.paymentMethod as any, {
                    total_amount: totalWithFees,
                    extra_units: extraUnits,
                    service_request_id: serviceRequestId,
                });
            }

            // 🆕 DETECTAR SPLIT PAYMENT
            console.log('[Parcelow] 🔍 Verificando se é split payment...');
            console.log('[Parcelow] Split Config:', state.splitPaymentConfig);

            if (state.splitPaymentConfig && state.splitPaymentConfig.enabled) {
                console.log('[Parcelow] 🎯 SPLIT PAYMENT DETECTADO!');
                console.log('[Parcelow] Configuração:', {
                    part1: `${state.splitPaymentConfig.part1_method} - $${state.splitPaymentConfig.part1_amount}`,
                    part2: `${state.splitPaymentConfig.part2_method} - $${state.splitPaymentConfig.part2_amount}`,
                });

                // Upload signature
                let signatureUrl = '';
                if (signatureImageDataUrl) {
                    const uploadedUrl = await uploadSignature(signatureImageDataUrl, state.clientId);
                    if (uploadedUrl) {
                        signatureUrl = uploadedUrl;
                    }
                }

                const documentFrontUrl = (hasExistingContract && existingContractData)
                    ? existingContractData.contract_document_url
                    : documentFiles?.documentFront?.url || '';
                const selfieUrl = (hasExistingContract && existingContractData)
                    ? existingContractData.contract_selfie_url
                    : documentFiles?.selfie?.url || '';

                // Fetch product
                const { data: product, error: productError } = await supabase
                    .from('visa_products')
                    .select('*')
                    .eq('slug', productSlug)
                    .single();

                if (productError || !product) {
                    throw new Error('Product not found');
                }

                const upsellProductSlug = state.selectedUpsell === 'canada-premium'
                    ? 'canada-tourist-premium'
                    : state.selectedUpsell === 'canada-revolution'
                        ? 'canada-tourist-revolution'
                        : null;

                const baseUpsellPrice = state.selectedUpsell === 'canada-premium' ? 399 : (state.selectedUpsell === 'canada-revolution' ? 199 : 0);
                const upsellAmount = baseUpsellPrice > 0 ? baseUpsellPrice + ((extraUnits || 0) * 50) : 0;

                // Check if an order already exists for this service request
                const { data: existingOrder } = await supabase
                    .from('visa_orders')
                    .select('id, order_number')
                    .eq('service_request_id', serviceRequestId)
                    .eq('payment_status', 'pending')
                    .maybeSingle();

                const finalOrderNumber = existingOrder?.order_number || `ORD-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

                const { data: order, error: orderError } = await supabase
                    .from('visa_orders')
                    .upsert({
                        id: existingOrder?.id, // If ID is present, it will UPDATE
                        order_number: finalOrderNumber,
                        product_slug: productSlug,
                        seller_id: sellerId || null,
                        service_request_id: serviceRequestId,
                        base_price_usd: product.base_price_usd,
                        price_per_dependent_usd: product.price_per_dependent_usd || 0,
                        extra_unit_price_usd: product.price_per_dependent_usd || product.extra_unit_price || 0,
                        extra_units: extraUnits || 0,
                        extra_unit_label: product.extra_unit_label || 'Additional Dependent',
                        dependent_names: dependentNames,
                        client_name: clientName,
                        client_email: clientEmail,
                        client_whatsapp: clientWhatsApp,
                        client_country: clientCountry,
                        client_nationality: clientNationality,
                        client_observations: clientObservations,
                        payment_method: state.paymentMethod,
                        payment_status: 'pending',
                        total_price_usd: totalWithFees,
                        upsell_product_slug: upsellProductSlug,
                        upsell_price_usd: upsellAmount > 0 ? upsellAmount : null,
                        contract_document_url: documentFrontUrl,
                        contract_selfie_url: selfieUrl,
                        signature_image_url: signatureUrl,
                        contract_accepted: true,
                        contract_signed_at: new Date().toISOString(),
                        is_split_payment: true,
                        payment_metadata: {
                            credit_card_name: creditCardName,
                            cpf: cpf,
                            has_upsell: !!upsellAmount,
                            is_split_payment: true,
                            billing_installment_id: billingInstallmentId,
                            eb3_schedule_id: eb3ScheduleId,
                            scholarship_schedule_id: scholarshipScheduleId,
                            upsell_details: upsellAmount > 0 ? {
                                slug: upsellProductSlug,
                                base_price: baseUpsellPrice,
                                dependents: extraUnits || 0,
                                total: upsellAmount
                            } : null,
                            payer_info: state.payerInfo
                        },
                        coupon_code: couponCode || null,
                        discount_amount: discountAmount || 0
                    })
                    .select()
                    .single();

                if (orderError || !order) {
                    console.error('[Parcelow Split] Erro ao criar order:', orderError);
                    throw new Error('Failed to create order for split payment');
                }

                console.log('[Parcelow Split] ✅ Order criada:', order.id);

                // Chamar create-split-parcelow-checkout
                console.log('[Parcelow Split] 🔄 Chamando create-split-parcelow-checkout...');
                const { data: splitCheckoutData, error: splitCheckoutError } = await supabase.functions.invoke('create-split-parcelow-checkout', {
                    body: {
                        order_id: order.id,
                        part1_amount: state.splitPaymentConfig.part1_amount,
                        part1_method: state.splitPaymentConfig.part1_method,
                        part2_amount: state.splitPaymentConfig.part2_amount,
                        part2_method: state.splitPaymentConfig.part2_method,
                    }
                });

                if (splitCheckoutError) {
                    console.error('[Parcelow Split] ❌ Erro ao criar split checkout:', splitCheckoutError);
                    let errMsg = 'Failed to create split payment checkout';
                    try {
                        const errorBody = await splitCheckoutError.context.json();
                        errMsg = errorBody.error || errorBody.message || errMsg;
                    } catch (e) {
                        errMsg = splitCheckoutError.message || errMsg;
                    }
                    throw new Error(errMsg);
                }

                console.log('[Parcelow Split] ✅ Split checkout criado:', splitCheckoutData);

                // Redirecionar para Part 1
                const part1CheckoutUrl = splitCheckoutData?.part1_checkout_url;
                if (part1CheckoutUrl) {
                    console.log('[Parcelow Split] 🚀 Redirecionando para Part 1...');
                    window.location.href = part1CheckoutUrl;
                } else {
                    throw new Error('Missing Part 1 checkout URL');
                }

                return; // Sai da função, não executa fluxo normal
            }

            console.log('[Parcelow] ℹ️ Pagamento normal (não é split)');

            // Fetch product
            const { data: product, error: productError } = await supabase
                .from('visa_products')
                .select('*')
                .eq('slug', productSlug)
                .single();

            if (productError || !product) {
                throw new Error('Product not found');
            }

            const documentFrontUrl = (hasExistingContract && existingContractData)
                ? existingContractData.contract_document_url
                : documentFiles?.documentFront?.url || '';
            const selfieUrl = (hasExistingContract && existingContractData)
                ? existingContractData.contract_selfie_url
                : documentFiles?.selfie?.url || '';

            // Upload signature if needed
            let signatureUrl = '';
            if (signatureImageDataUrl) {
                const uploadedUrl = await uploadSignature(signatureImageDataUrl, state.clientId);
                if (uploadedUrl) {
                    signatureUrl = uploadedUrl;
                }
            }

            // Determine upsell product slug
            const upsellProductSlug = state.selectedUpsell === 'canada-premium'
                ? 'canada-tourist-premium'
                : state.selectedUpsell === 'canada-revolution'
                    ? 'canada-tourist-revolution'
                    : null;

            const baseUpsellPrice = state.selectedUpsell === 'canada-premium' ? 399 : (state.selectedUpsell === 'canada-revolution' ? 199 : 0);
            const upsellAmount = baseUpsellPrice > 0 ? baseUpsellPrice + ((extraUnits || 0) * 50) : 0;

            // Check if an order already exists for this service request
            const { data: existingOrder } = await supabase
                .from('visa_orders')
                .select('id, order_number')
                .eq('service_request_id', serviceRequestId)
                .eq('payment_status', 'pending')
                .maybeSingle();

            const finalOrderNumber = existingOrder?.order_number || `ORD-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

            const { data: order, error: orderError } = await supabase
                .from('visa_orders')
                .upsert({
                    id: existingOrder?.id, // If ID is present, it will UPDATE
                    order_number: finalOrderNumber,
                    product_slug: productSlug,
                    seller_id: sellerId || null,
                    service_request_id: serviceRequestId,
                    base_price_usd: product.base_price_usd || "0",
                    price_per_dependent_usd: product.price_per_dependent_usd || product.extra_unit_price || "0",
                    extra_unit_price_usd: product.price_per_dependent_usd || product.extra_unit_price || "0",
                    extra_units: extraUnits,
                    extra_unit_label: product.extra_unit_label || 'Additional Dependent',
                    dependent_names: dependentNames,
                    client_name: clientName,
                    client_email: clientEmail,
                    client_whatsapp: clientWhatsApp,
                    client_country: clientCountry,
                    client_nationality: clientNationality,
                    client_observations: clientObservations,
                    payment_method: state.paymentMethod,
                    payment_status: 'pending',
                    total_price_usd: totalWithFees, // Total completo (main + upsell)
                    upsell_product_slug: upsellProductSlug,
                    upsell_price_usd: upsellAmount > 0 ? upsellAmount : null,
                    contract_document_url: documentFrontUrl,
                    contract_selfie_url: selfieUrl,
                    signature_image_url: signatureUrl,
                    contract_accepted: true,
                    contract_signed_at: new Date().toISOString(),
                    payment_metadata: {
                        credit_card_name: creditCardName,
                        cpf: cpf,
                        has_upsell: !!upsellAmount,
                        billing_installment_id: billingInstallmentId,
                        eb3_schedule_id: eb3ScheduleId,
                        scholarship_schedule_id: scholarshipScheduleId,
                        upsell_details: upsellAmount > 0 ? {
                            slug: upsellProductSlug,
                            base_price: baseUpsellPrice,
                            dependents: extraUnits,
                            total: upsellAmount
                        } : null,
                        payer_info: state.payerInfo
                    },
                    coupon_code: couponCode || null,
                    discount_amount: discountAmount || 0
                })
                .select()
                .single();

            console.log('🔍 [STEP 3] Pedido principal criado. Resultado:', {
                success: !!order,
                hasError: !!orderError,
                orderId: order?.id,
                errorCode: orderError?.code
            });

            let upsellOrderId = null;

            // Handle Order Creation Error (e.g., Duplicates)
            if (orderError || !order) {
                console.warn('[Debug] Error verifying order creation:', orderError);
                if (orderError?.code === '409' || orderError?.message?.includes('duplicate key') || orderError?.details?.includes('already exists')) {
                    console.log('Order already exists, fetching existing pending order...');
                    const { data: existingOrder, error: fetchError } = await supabase
                        .from('visa_orders')
                        .select('*')
                        .eq('service_request_id', serviceRequestId)
                        .eq('payment_status', 'pending')
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .single();


                    if (!fetchError && existingOrder) {
                        console.log('Using existing pending order:', existingOrder.id);

                        // Ensure Upsell is handled even for existing orders
                        let existingUpsellOrderId = upsellOrderId;
                        console.log('[Debug] Initial existingUpsellOrderId:', existingUpsellOrderId);
                        console.log('[Debug] Selected Upsell State:', state.selectedUpsell);

                        // If we didn't just create one (upsellOrderId is null) but user wants one
                        if (!existingUpsellOrderId && state.selectedUpsell !== 'none') {
                            console.log('[Debug] Tentando recuperar/criar upsell para pedido existente...');
                            const upsellSlug = state.selectedUpsell === 'canada-premium' ? 'canada-tourist-premium' : 'canada-tourist-revolution';
                            const baseUpsellPrice = state.selectedUpsell === 'canada-premium' ? 399 : 199;
                            const upsellAmount = baseUpsellPrice + ((extraUnits || 0) * 50);

                            // Check if upsell order already exists too
                            const { data: previousUpsell } = await supabase
                                .from('visa_orders')
                                .select('id')
                                .eq('service_request_id', serviceRequestId)
                                .eq('payment_metadata->>is_upsell', 'true')
                                .eq('payment_status', 'pending')
                                .single();

                            if (previousUpsell) {
                                existingUpsellOrderId = previousUpsell.id;
                            } else {
                                // Create new upsell order linked to existing parent
                                const upsellOrderNumber = `ORD-UPS-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
                                const { data: newUpsell } = await supabase
                                    .from('visa_orders')
                                    .insert({
                                        order_number: upsellOrderNumber,
                                        product_slug: upsellSlug,
                                        seller_id: sellerId || null,
                                        service_request_id: serviceRequestId,
                                        base_price_usd: upsellAmount,
                                        price_per_dependent_usd: 0,
                                        extra_units: 0,
                                        dependent_names: null,
                                        client_name: clientName,
                                        client_email: clientEmail,
                                        client_whatsapp: clientWhatsApp,
                                        client_country: clientCountry,
                                        client_nationality: clientNationality,
                                        client_observations: clientObservations,
                                        payment_method: state.paymentMethod,
                                        payment_status: 'pending',
                                        total_price_usd: upsellAmount,
                                        contract_document_url: documentFrontUrl,
                                        contract_selfie_url: selfieUrl,
                                        signature_image_url: signatureUrl,
                                        contract_accepted: true,
                                        contract_signed_at: new Date().toISOString(),
                                        contract_template_id: state.upsellContractTemplate?.id,
                                        payment_metadata: {
                                            is_upsell: true,
                                            parent_order_id: existingOrder.id
                                        }
                                    })
                                    .select()
                                    .single();

                                if (newUpsell) {
                                    console.log('[Debug] Novo upsell criado:', newUpsell.id);
                                    existingUpsellOrderId = newUpsell.id;
                                } else {
                                    console.error('[Debug] Falha ao criar upsell');
                                }
                            }
                        }

                        console.log('[Debug] Chamando create-parcelow-checkout com:', {
                            order_id: existingOrder.id,
                            upsell_order_id: existingUpsellOrderId
                        });

                        // Update existing order with current details (especially coupon)
                        const { error: updateError } = await supabase
                            .from('visa_orders')
                            .update({
                                coupon_code: couponCode || null,
                                discount_amount: discountAmount || 0,
                                total_price_usd: totalWithFees,
                                upsell_product_slug: upsellProductSlug,
                                upsell_price_usd: upsellAmount > 0 ? upsellAmount : null,
                                payment_metadata: {
                                    ...existingOrder.payment_metadata,
                                    has_upsell: !!upsellAmount,
                                    upsell_details: upsellAmount > 0 ? {
                                        slug: upsellProductSlug,
                                        base_price: baseUpsellPrice,
                                        dependents: extraUnits,
                                        total: upsellAmount
                                    } : null,
                                    payer_info: state.payerInfo
                                }
                            })
                            .eq('id', existingOrder.id);

                        if (updateError) {
                            console.error('Failed to update existing order:', updateError);
                            // We proceed anyway, but warn
                        }

                        // Use existing order for checkout WITH upsell
                        const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke('create-parcelow-checkout', {
                            body: {
                                order_id: existingOrder.id,
                                upsell_order_id: existingUpsellOrderId
                            }
                        });

                        if (checkoutError) {
                            console.error('Parcelow checkout error:', checkoutError);
                            let errMsg = 'Failed to initiate Parcelow checkout';
                            try {
                                const errorBody = await checkoutError.context.json();
                                errMsg = errorBody.error || errorBody.message || errMsg;
                            } catch (e) {
                                errMsg = checkoutError.message || errMsg;
                            }
                            throw new Error(errMsg);
                        }

                        const redirectUrl = checkoutData?.checkout_url || checkoutData?.url || checkoutData?.url_checkout;
                        if (redirectUrl) {
                            window.location.href = redirectUrl;
                        } else {
                            throw new Error('Invalid response from payment provider');
                        }
                        return;
                    }
                }

                console.error('Order creation error:', orderError);
                throw new Error('Failed to create order. If you already have an order, please check your dashboard.');
            }

            // Upsell is now part of the main order (no separate record needed)
            console.log('🔍 [STEP 4] Upsell incluído no pedido principal:', {
                has_upsell: !!upsellAmount,
                upsell_product_slug: order.upsell_product_slug,
                upsell_price_usd: order.upsell_price_usd
            });

            // Call Parcelow Checkout Function (direct redirect, no modal)
            console.log('🔍 [STEP 5] Preparando chamada para Parcelow...');
            console.log('🔍 [STEP 5] Order ID:', order.id);

            const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke('create-parcelow-checkout', {
                body: {
                    order_id: order.id
                }
            });

            console.log('🔍 [STEP 8] Resposta da Parcelow recebida:', {
                success: !!checkoutData,
                hasError: !!checkoutError,
                checkoutUrl: checkoutData?.checkout_url
            });

            if (checkoutError) {
                console.error('Parcelow checkout error:', checkoutError);
                let errMsg = 'Failed to initiate Parcelow checkout';
                try {
                    const errorBody = await checkoutError.context.json();
                    errMsg = errorBody.error || errorBody.message || errMsg;
                } catch (e) {
                    errMsg = checkoutError.message || errMsg;
                }
                throw new Error(errMsg);
            }

            const redirectUrl = checkoutData?.checkout_url || checkoutData?.url || checkoutData?.url_checkout;
            if (redirectUrl) {
                window.location.href = redirectUrl;
            } else {
                console.error('Missing checkout URL in data:', checkoutData);
                throw new Error('Invalid response from payment provider');
            }

        } catch (err) {
            console.error('Parcelow payment error:', err);
            setError(err instanceof Error ? err.message : 'Parcelow payment failed');
            setSubmitting(false);
        }
    }, [productSlug, sellerId, totalWithFees, extraUnits, serviceRequestId, clientName, clientEmail, clientWhatsApp, validateStep3, documentFiles, hasExistingContract, existingContractData, dependentNames, clientCountry, clientNationality, clientObservations, setSubmitting, setError, contractTemplate, creditCardName, cpf, state.submitting, couponCode, discountAmount, state.selectedUpsell, state.splitPaymentConfig, state.upsellContractTemplate]);

    return {
        handleStripeCheckout,
        handleZellePayment,
        handleParcelowPayment
    };
};
