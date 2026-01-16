import React from 'react';
import { Progress } from '@/components/ui/progress';

interface StepIndicatorProps {
    currentStep: number;
    totalSteps: number;
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep, totalSteps }) => {
    const progressPercentage = (currentStep / totalSteps) * 100;

    return (
        <div className="mb-6 sm:mb-8">
            <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
                <span className="text-xs sm:text-sm text-gray-400">
                    Step {currentStep} of {totalSteps}
                </span>
                <span className="text-xs sm:text-sm text-gold-light text-right">
                    {currentStep === 1 && 'Personal Information'}
                    {currentStep === 2 && 'Documents & Selfie'}
                    {currentStep === 3 && 'Terms & Payment'}
                </span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
            <div className="flex justify-between mt-2 text-[10px] sm:text-xs text-gray-500 flex-wrap gap-1">
                <span className="hidden sm:inline">1/3 Personal Information</span>
                <span className="sm:hidden">1/3 Info</span>
                <span className="hidden sm:inline">2/3 Documents</span>
                <span className="sm:hidden">2/3 Docs</span>
                <span className="hidden sm:inline">3/3 Terms & Payment</span>
                <span className="sm:hidden">3/3 Payment</span>
            </div>
        </div>
    );
};
