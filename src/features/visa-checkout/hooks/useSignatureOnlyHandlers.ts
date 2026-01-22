import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { uploadSignature } from '@/lib/visa-checkout-service';
import { getClientIP } from '@/lib/visa-checkout-utils';
import type { VisaCheckoutState, VisaCheckoutActions } from '../types/form.types';

export const useSignatureOnlyHandlers = (
    productSlug: string | undefined,
    sellerId: string | null,
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
        contractTemplate
    } = state;

    const {
        setError,
        setSubmitting,
    } = actions;

    const handleManualSubmission = useCallback(async () => {
        if (!termsAccepted || !dataAuthorization || !signatureConfirmed || !signatureImageDataUrl) {
            setError('Please accept terms and confirm your signature');
            return;
        }

        if (!serviceRequestId || !productSlug) {
            setError('Missing required information');
            return;
        }

        setSubmitting(true);
        try {
            // 1. Get document URLs
            const documentFrontUrl = (hasExistingContract && existingContractData)
                ? existingContractData.contract_document_url
                : documentFiles?.documentFront?.url || '';
            const selfieUrl = (hasExistingContract && existingContractData)
                ? existingContractData.contract_selfie_url
                : documentFiles?.selfie?.url || '';

            // 2. Upload signature
            let signatureUrl = '';
            if (signatureImageDataUrl) {
                const uploadedUrl = await uploadSignature(signatureImageDataUrl);
                if (uploadedUrl) {
                    signatureUrl = uploadedUrl;
                }
            }

            // 3. Create Order with 'manual' status
            const orderNumber = `ORD-MAN-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

            const { data: order, error: orderError } = await supabase
                .from('visa_orders')
                .insert({
                    order_number: orderNumber,
                    product_slug: productSlug,
                    seller_id: sellerId || null,
                    service_request_id: serviceRequestId,
                    base_price_usd: totalWithFees, // Using the total as base for manual
                    price_per_dependent_usd: 0,
                    extra_units: extraUnits,
                    dependent_names: dependentNames,
                    client_name: clientName,
                    client_email: clientEmail,
                    client_whatsapp: clientWhatsApp,
                    client_country: clientCountry,
                    client_nationality: clientNationality,
                    client_observations: clientObservations,
                    payment_method: 'manual',
                    payment_status: 'manual_pending',
                    total_price_usd: totalWithFees,
                    contract_document_url: documentFrontUrl,
                    contract_selfie_url: selfieUrl,
                    signature_image_url: signatureUrl,
                    contract_accepted: true,
                    contract_signed_at: new Date().toISOString(),
                    contract_template_id: contractTemplate?.id,
                    payment_metadata: {
                        is_manual_checkout: true,
                        submitted_at: new Date().toISOString(),
                        ip_address: await getClientIP()
                    }
                })
                .select()
                .single();

            if (orderError) throw orderError;

            // 4. Trigger PDF generation (Contract, Annex, Invoice) and wait for them
            console.log('Generating documents...');
            try {
                const results = await Promise.allSettled([
                    supabase.functions.invoke("generate-visa-contract-pdf", { body: { order_id: order.id } }),
                    supabase.functions.invoke("generate-annex-pdf", { body: { order_id: order.id } })
                ]);
                console.log('Document generation results:', results);
            } catch (e) {
                console.error('Document generation error:', e);
                // We still proceed to success page as the order was created
            }

            // 5. Short delay just to be sure UI caught up
            await new Promise(resolve => setTimeout(resolve, 300));

            // 6. Redirect to success
            window.location.href = `/checkout/success?order_id=${order.id}&method=manual`;

        } catch (err) {
            console.error('Manual submission error:', err);
            setError(err instanceof Error ? err.message : 'Failed to process signature');
        } finally {
            setSubmitting(false);
        }
    }, [
        termsAccepted, dataAuthorization, signatureConfirmed, signatureImageDataUrl,
        serviceRequestId, productSlug, hasExistingContract, existingContractData,
        documentFiles, sellerId, extraUnits, dependentNames, clientName, clientEmail,
        clientWhatsApp, clientCountry, clientNationality, clientObservations,
        contractTemplate, totalWithFees, setSubmitting, setError
    ]);

    return {
        handleManualSubmission
    };
};
