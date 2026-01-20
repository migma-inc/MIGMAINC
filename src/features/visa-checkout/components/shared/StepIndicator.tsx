import React from 'react';
import { Progress } from '@/components/ui/progress';

interface StepIndicatorProps {
    currentStep: number;
    totalSteps: number;
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep, totalSteps }) => {
    const progressPercentage = (currentStep / totalSteps) * 100;

    const stepLabels = totalSteps === 2
        ? ['Personal Information', 'Terms & Payment']
        : ['Personal Information', 'Documents & Selfie', 'Terms & Payment'];

    const currentLabel = stepLabels[currentStep - 1];

    return (
        <div className="mb-6 sm:mb-8">
            <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
                <span className="text-xs sm:text-sm text-gray-400">
                    Step {currentStep} of {totalSteps}
                </span>
                <span className="text-xs sm:text-sm text-gold-light text-right">
                    {currentLabel}
                </span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
            <div className="flex justify-between mt-2 text-[10px] sm:text-xs text-gray-500 flex-wrap gap-1">
                {stepLabels.map((label, idx) => (
                    <React.Fragment key={idx}>
                        <span className="hidden sm:inline">{idx + 1}/{totalSteps} {label}</span>
                        <span className="sm:hidden">{idx + 1}/{totalSteps} {label.split(' ')[0]}</span>
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
};
