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
            // Se for consulta comum ou parcelas recorrentes e estiver no Step 3, volta direto para o 1 (pois pulou o 2)
            const isInstallment = !!state.eb3ScheduleId || !!state.eb2ScheduleId || !!state.scholarshipScheduleId || !!state.billingInstallmentId;
            if (currentStep === 3 && (productSlug === 'consultation-common' || isInstallment)) {
                setCurrentStep(1);
            } else {
                setCurrentStep(currentStep - 1);
            }
            setError('');
        }
    }, [currentStep, setCurrentStep, setError, productSlug, state.eb3ScheduleId, state.eb2ScheduleId, state.scholarshipScheduleId, state.billingInstallmentId]);

    const goToStep = useCallback((step: number) => {
        setCurrentStep(step);
        setError('');
    }, [setCurrentStep, setError]);

    return {
        handlePrev,
        goToStep,
    };
};
