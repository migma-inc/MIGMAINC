import { useEffect, useRef, useCallback } from 'react';
import { DRAFT_STORAGE_KEY } from '@/lib/visa-checkout-constants';
import type { VisaCheckoutState, VisaCheckoutActions } from '../types/form.types';

export const useDraftRecovery = (
    productSlug: string | undefined,
    sellerId: string | null,
    loading: boolean,
    state: VisaCheckoutState,
    actions: VisaCheckoutActions
) => {
    // Destructuring state if needed, but currently all recovered via actions
    const {
        setClientName,
        setClientEmail,
        setClientWhatsApp,
        setClientCountry,
        setClientNationality,
        setDateOfBirth,
        setDocumentType,
        setDocumentNumber,
        setAddressLine,
        setCity,
        setState,
        setPostalCode,
        setMaritalStatus,
        setClientObservations,
        setExtraUnits,
        setDependentNames,
        setTermsAccepted,
        setDataAuthorization,
        setPaymentMethod,
        setSignatureImageDataUrl,
        setSignatureConfirmed,
        setServiceRequestId,
        setClientId,
    } = actions;

    const isRestoringRef = useRef(false);
    const restoreAttemptedRef = useRef(false);
    const hasRestoredStepRef = useRef(false);
    const returningFromStripeRef = useRef(false);

    const restoreDraft = useCallback(() => {
        if (isRestoringRef.current) return;

        try {
            const draft = localStorage.getItem(DRAFT_STORAGE_KEY);
            if (!draft) {
                restoreAttemptedRef.current = true;
                return;
            }

            const parsed = JSON.parse(draft);
            if (parsed.productSlug === productSlug && (!parsed.sellerId || parsed.sellerId === sellerId || !sellerId)) {
                isRestoringRef.current = true;

                // Restore Step 1
                setClientName(parsed.clientName || '');
                setClientEmail(parsed.clientEmail || '');
                setClientWhatsApp(parsed.clientWhatsApp || '');
                setClientCountry(parsed.clientCountry || '');
                setClientNationality(parsed.clientNationality || '');
                setDateOfBirth(parsed.dateOfBirth || '');
                setDocumentType(parsed.documentType || '');
                setDocumentNumber(parsed.documentNumber || '');
                setAddressLine(parsed.addressLine || '');
                setCity(parsed.city || '');
                setState(parsed.state || '');
                setPostalCode(parsed.postalCode || '');
                setMaritalStatus(parsed.maritalStatus || '');
                setClientObservations(parsed.clientObservations || '');
                setExtraUnits(parsed.extraUnits || 0);
                setDependentNames(parsed.dependentNames || []);

                // Restore Step 3
                setTermsAccepted(parsed.termsAccepted || false);
                setDataAuthorization(parsed.dataAuthorization || false);
                setPaymentMethod(parsed.paymentMethod || 'card');
                setSignatureImageDataUrl(parsed.signatureImageDataUrl || null);
                setSignatureConfirmed(parsed.signatureConfirmed || false);

                // Identifiers
                if (parsed.serviceRequestId) setServiceRequestId(parsed.serviceRequestId);
                if (parsed.clientId) setClientId(parsed.clientId);

                // Step handling - Always start at Step 1 on reload for safety (avoids photo loss)
                restoreAttemptedRef.current = true;
                setTimeout(() => { isRestoringRef.current = false; }, 300);
            } else {
                isRestoringRef.current = false;
                restoreAttemptedRef.current = true;
            }
        } catch (err) {
            console.warn('Failed to load draft:', err);
            isRestoringRef.current = false;
            restoreAttemptedRef.current = true;
        }
    }, [productSlug, sellerId, actions]);

    // Restoration Effect
    useEffect(() => {
        if (returningFromStripeRef.current) return;

        restoreAttemptedRef.current = false;
        isRestoringRef.current = false;
        hasRestoredStepRef.current = false;

        const timeoutId = setTimeout(() => {
            if (!returningFromStripeRef.current) {
                restoreDraft();
            }
        }, 100);

        return () => clearTimeout(timeoutId);
    }, [productSlug, sellerId, loading, restoreDraft]);

    // Browser navigation restoration
    useEffect(() => {
        const handlePageShow = (event: PageTransitionEvent) => {
            if (event.persisted) {
                restoreAttemptedRef.current = false;
                isRestoringRef.current = false;
                hasRestoredStepRef.current = false;
                setTimeout(() => restoreDraft(), 100);
            }
        };
        window.addEventListener('pageshow', handlePageShow);
        return () => window.removeEventListener('pageshow', handlePageShow);
    }, [restoreDraft]);

    // Auto-save Effect
    useEffect(() => {
        if (isRestoringRef.current || !restoreAttemptedRef.current) return;

        try {
            const draft = {
                productSlug,
                sellerId,
                ...state,
                savedAt: new Date().toISOString(),
            };
            localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
        } catch (err) {
            console.warn('Failed to save draft:', err);
        }
    }, [state, productSlug, sellerId]);

    return {
        isRestoring: isRestoringRef.current,
        returningFromStripe: returningFromStripeRef.current,
    };
};
