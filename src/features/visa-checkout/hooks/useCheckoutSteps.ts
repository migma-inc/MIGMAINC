import { useCallback } from 'react';
import type { VisaCheckoutState, VisaCheckoutActions } from '../types/form.types';

export const useCheckoutSteps = (
    state: VisaCheckoutState,
    actions: VisaCheckoutActions,
    productSlug?: string
) => {
    const { currentStep } = state;
    const { setCurrentStep, setError } = actions;

    const handlePrev = useCallback(() => {
        if (currentStep > 1) {
            // Se for consulta comum e estiver no Step 3, volta direto para o 1
            if (currentStep === 3 && productSlug === 'consultation-common') {
                setCurrentStep(1);
            } else {
                setCurrentStep(currentStep - 1);
            }
            setError('');
        }
    }, [currentStep, setCurrentStep, setError, productSlug]);

    const goToStep = useCallback((step: number) => {
        setCurrentStep(step);
        setError('');
    }, [setCurrentStep, setError]);

    return {
        handlePrev,
        goToStep,
    };
};
