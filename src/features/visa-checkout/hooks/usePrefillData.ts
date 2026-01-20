import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { VisaCheckoutActions } from '../types/form.types';

export const usePrefillData = (
    productSlug: string | undefined,
    actions: VisaCheckoutActions
) => {
    const [searchParams] = useSearchParams();
    const prefillToken = searchParams.get('prefill');

    // Track if we are currently loading prefill data
    const [isLoadingPrefill, setIsLoadingPrefill] = useState(!!prefillToken);
    const [sellerId, setSellerId] = useState<string | null>(null);

    useEffect(() => {
        const loadPrefillData = async () => {
            if (!prefillToken || !productSlug) {
                return;
            }

            try {
                // Fetch prefill data
                const { data, error } = await supabase
                    .from('checkout_prefill_tokens')
                    .select('*')
                    .eq('token', prefillToken)
                    .single();

                if (error) {
                    console.error('Error loading prefill data:', error);
                    return;
                }

                if (!data || data.product_slug !== productSlug) {
                    console.warn('Prefill token invalid or for different product');
                    return;
                }

                // Check expiration
                if (new Date(data.expires_at) < new Date()) {
                    console.warn('Prefill token expired');
                    return;
                }

                // Set seller ID if present
                if (data.seller_id) {
                    setSellerId(data.seller_id);
                }

                const clientData = data.client_data;

                // Populate form fields
                if (clientData.clientName) actions.setClientName(clientData.clientName);
                if (clientData.clientEmail) actions.setClientEmail(clientData.clientEmail);
                if (clientData.clientWhatsApp) actions.setClientWhatsApp(clientData.clientWhatsApp);
                if (clientData.clientCountry) actions.setClientCountry(clientData.clientCountry);
                if (clientData.clientNationality) actions.setClientNationality(clientData.clientNationality);
                if (clientData.dateOfBirth) actions.setDateOfBirth(clientData.dateOfBirth);
                if (clientData.documentType) actions.setDocumentType(clientData.documentType);
                if (clientData.documentNumber) actions.setDocumentNumber(clientData.documentNumber);
                if (clientData.addressLine) actions.setAddressLine(clientData.addressLine);
                if (clientData.city) actions.setCity(clientData.city);
                if (clientData.state) actions.setState(clientData.state);
                if (clientData.postalCode) actions.setPostalCode(clientData.postalCode);
                if (clientData.maritalStatus) actions.setMaritalStatus(clientData.maritalStatus);
                if (clientData.clientObservations) actions.setClientObservations(clientData.clientObservations);

                // Handle dependents
                if (typeof clientData.extraUnits === 'number') {
                    actions.setExtraUnits(clientData.extraUnits);
                }
                if (Array.isArray(clientData.dependentNames)) {
                    actions.setDependentNames(clientData.dependentNames);
                }

                console.log('Prefill data loaded successfully');

            } catch (err) {
                console.error('Unexpected error loading prefill data:', err);
            } finally {
                setIsLoadingPrefill(false);
            }
        };

        loadPrefillData();
    }, [prefillToken, productSlug, actions]);

    return { isLoadingPrefill, sellerId };
};
