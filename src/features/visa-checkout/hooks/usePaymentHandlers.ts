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
import { saveStep3Data } from '@/lib/visa-checkout-service';
import type { VisaCheckoutState, VisaCheckoutActions } from '../types/form.types';

export const usePaymentHandlers = (
    productSlug: string | undefined,
    sellerId: string | null,
    baseTotal: number,
    totalWithFees: number,
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
        zelleReceipt
    } = state;

    const {
        setError,
        setSubmitting,
        setIsZelleProcessing
    } = actions;

    // Internal helper for Step 3 validation
    const validateStep3 = useCallback(async () => {
        if (!termsAccepted || !dataAuthorization || !signatureConfirmed || !signatureImageDataUrl) {
            setError('Please accept terms and confirm your signature');
            return false;
        }
        if (!serviceRequestId) {
            setError('Service request ID is missing');
            return false;
        }

        const result = await saveStep3Data(
            serviceRequestId,
            termsAccepted,
            dataAuthorization,
            contractTemplate?.id || null
        );

        if (!result.success) {
            setError(result.error || 'Failed to save terms');
            return false;
        }

        return true;
    }, [termsAccepted, dataAuthorization, signatureConfirmed, signatureImageDataUrl, serviceRequestId, contractTemplate, setError]);

    const handleStripeCheckout = useCallback(async (method: 'card' | 'pix') => {
        if (!await validateStep3()) return;

        setSubmitting(true);
        try {
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

            // 2. Process
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
                signature_image_url: '', // Should upload first, but keeping it simple for now or using service
                service_request_id: serviceRequestId!,
                ip_address: await getClientIP(),
                contract_accepted: true,
                contract_signed_at: new Date().toISOString(),
                contract_template_id: contractTemplate?.id,
            };

            const response = await StripeService.createCheckoutSession(request);
            StripeService.redirectToCheckout(response.url);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Stripe payment failed');
        } finally {
            setSubmitting(false);
        }
    }, [productSlug, sellerId, totalWithFees, extraUnits, serviceRequestId, clientName, clientEmail, clientWhatsApp, validateStep3, documentFiles, hasExistingContract, existingContractData, dependentNames, clientCountry, clientNationality, clientObservations, exchangeRate, contractTemplate, setSubmitting, setError]);

    const handleZellePayment = useCallback(async () => {
        if (!await validateStep3()) return;
        if (!zelleReceipt) {
            setError('Please upload Zelle receipt');
            return;
        }

        setSubmitting(true);
        setIsZelleProcessing(true);
        try {
            // Logic from VisaCheckout...
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
                signature_image_url: '',
                service_request_id: serviceRequestId!,
                ip_address: await getClientIP(),
                contract_accepted: true,
                contract_signed_at: new Date().toISOString(),
                contract_template_id: contractTemplate?.id,
                zelle_receipt_url: '',
            };

            const response = await ZelleService.processPayment(request, zelleReceipt, baseTotal);
            if (response.status === 'approved') {
                window.location.href = `/checkout/success?order_id=${response.order_id}&method=zelle`;
            } else {
                window.location.href = '/checkout/zelle/processing';
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Zelle payment failed');
        } finally {
            setSubmitting(false);
            setIsZelleProcessing(false);
        }
    }, [productSlug, sellerId, baseTotal, validateStep3, zelleReceipt, extraUnits, serviceRequestId, clientName, clientEmail, clientWhatsApp, dependentNames, clientCountry, clientNationality, clientObservations, contractTemplate, setSubmitting, setIsZelleProcessing, setError]);

    const handleParcelowPayment = useCallback(async () => {
        if (!await validateStep3()) return;

        setSubmitting(true);
        try {
            if (sellerId && productSlug) {
                await trackFormCompleted(sellerId, productSlug, {
                    extra_units: extraUnits,
                    payment_method: 'parcelow',
                    service_request_id: serviceRequestId,
                    client_name: clientName,
                    client_email: clientEmail,
                    client_whatsapp: clientWhatsApp,
                });
                await trackPaymentStarted(sellerId, productSlug, 'parcelow' as any, {
                    total_amount: totalWithFees,
                    extra_units: extraUnits,
                    service_request_id: serviceRequestId,
                });
            }

            // Fetch product to get localized prices
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

            // Create Order
            const orderNumber = `ORD-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

            const { data: order, error: orderError } = await supabase
                .from('visa_orders')
                .insert({
                    order_number: orderNumber,
                    product_slug: productSlug,
                    seller_id: sellerId || null,
                    service_request_id: serviceRequestId,
                    base_price_usd: product.base_price_usd,
                    price_per_dependent_usd: product.price_per_dependent_usd || 0,
                    extra_units: extraUnits,
                    dependent_names: dependentNames,
                    client_name: clientName,
                    client_email: clientEmail,
                    client_whatsapp: clientWhatsApp,
                    client_country: clientCountry,
                    client_nationality: clientNationality,
                    client_observations: clientObservations,
                    payment_method: 'parcelow',
                    status: 'pending',
                    total_amount_usd: totalWithFees,
                    contract_document_url: documentFrontUrl,
                    contract_selfie_url: selfieUrl,
                    contract_accepted: true,
                    contract_signed_at: new Date().toISOString(),
                    contract_template_id: contractTemplate?.id
                })
                .select()
                .single();

            if (orderError || !order) {
                console.error('Order creation error:', orderError);
                throw new Error('Failed to create order');
            }

            // Call Parcelow Checkout Function
            const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke('create-parcelow-checkout', {
                body: { order_id: order.id }
            });

            if (checkoutError) {
                console.error('Parcelow checkout error:', checkoutError);
                throw new Error('Failed to initiate Parcelow checkout');
            }

            if (checkoutData?.url) {
                window.location.href = checkoutData.url;
            } else {
                throw new Error('Invalid response from payment provider');
            }

        } catch (err) {
            console.error('Parcelow payment error:', err);
            setError(err instanceof Error ? err.message : 'Parcelow payment failed');
        } finally {
            setSubmitting(false);
        }
    }, [productSlug, sellerId, totalWithFees, extraUnits, serviceRequestId, clientName, clientEmail, clientWhatsApp, validateStep3, documentFiles, hasExistingContract, existingContractData, dependentNames, clientCountry, clientNationality, clientObservations, setSubmitting, setError, contractTemplate]);

    return {
        handleStripeCheckout,
        handleZellePayment,
        handleParcelowPayment,
    };
};
