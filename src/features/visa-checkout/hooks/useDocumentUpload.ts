import { useCallback } from 'react';
import { saveStep2Data } from '@/lib/visa-checkout-service';
import type { VisaCheckoutState, VisaCheckoutActions } from '../types/form.types';

export const useDocumentUpload = (
    state: VisaCheckoutState,
    actions: VisaCheckoutActions
) => {
    const {
        serviceRequestId,
        documentFiles,
        documentsUploaded,
        hasExistingContract,
        existingContractData
    } = state;
    const {
        setCurrentStep,
        setError,
        setStep2Errors
    } = actions;

    const handleNextStep2 = useCallback(async () => {
        // If we have an existing contract, skip document upload
        if (hasExistingContract && existingContractData) {
            setCurrentStep(3);
            return true;
        }

        setStep2Errors({});
        setError('');

        const errors: Record<string, string> = {};

        if (!documentsUploaded || !documentFiles) {
            errors.documents = 'Please upload all required documents (front, back, and selfie)';
            setStep2Errors(errors);
            // UI scrolling logic should ideally be here too
            return false;
        }

        // Ensure all required documents are present
        if (!documentFiles.documentFront) errors.documentFront = 'Document front is required';
        if (!documentFiles.documentBack) errors.documentBack = 'Document back is required';
        if (!documentFiles.selfie) errors.selfie = 'Selfie is required';

        if (Object.keys(errors).length > 0) {
            setStep2Errors(errors);
            return false;
        }

        if (!serviceRequestId) {
            setError('Please complete Step 1 first');
            setCurrentStep(1);
            return false;
        }

        const existingContractDataForSave = hasExistingContract && existingContractData ? {
            contract_document_url: existingContractData.contract_document_url,
            contract_selfie_url: existingContractData.contract_selfie_url,
        } : undefined;

        const result = await saveStep2Data(serviceRequestId, documentFiles, existingContractDataForSave);
        if (!result.success) {
            setError(result.error || 'Failed to save documents');
            return false;
        }

        setCurrentStep(3);
        return true;
    }, [
        serviceRequestId,
        documentFiles,
        documentsUploaded,
        hasExistingContract,
        existingContractData,
        setCurrentStep,
        setError,
        setStep2Errors
    ]);

    return {
        handleNextStep2,
    };
};
