import { useCallback } from 'react';
import type { VisaCheckoutState, VisaCheckoutActions } from '../types/form.types';

export const useCheckoutSteps = (
    state: VisaCheckoutState,
    actions: VisaCheckoutActions
) => {
    const { currentStep } = state;
    const { setCurrentStep, setError } = actions;

    const handlePrev = useCallback(() => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
            setError('');
        }
    }, [currentStep, setCurrentStep, setError]);

    const goToStep = useCallback((step: number) => {
        setCurrentStep(step);
        setError('');
    }, [setCurrentStep, setError]);

    return {
        handlePrev,
        goToStep,
    };
};
