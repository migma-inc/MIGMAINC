import React from 'react';
import { CheckCircle } from 'lucide-react';
import type { OnboardingStep } from '../types';

const STEPS: { key: OnboardingStep; label: string }[] = [
  { key: 'selection_fee',       label: 'Selection Fee' },
  { key: 'selection_survey',    label: 'Survey' },
  { key: 'scholarship_selection', label: 'Scholarship' },
  { key: 'documents_upload',    label: 'Documents' },
  { key: 'payment',             label: 'Application Fee' },
  { key: 'placement_fee',       label: 'Placement Fee' },
  { key: 'my_applications',     label: 'My Applications' },
];

// Steps que são mapeados para um step visual
const STEP_ALIAS: Partial<Record<OnboardingStep, OnboardingStep>> = {
  process_type:           'scholarship_selection',
  identity_verification:  'selection_survey',
  reinstatement_fee:      'placement_fee',
  completed:              'my_applications',
};

interface StepIndicatorProps {
  currentStep: OnboardingStep;
  completedSteps: OnboardingStep[];
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep, completedSteps }) => {
  const resolvedStep = STEP_ALIAS[currentStep] ?? currentStep;
  const currentIndex = STEPS.findIndex(s => s.key === resolvedStep);
  const totalSteps = STEPS.length;

  return (
    <div className="w-full mb-6 sm:mb-8 bg-white border border-gray-100 rounded-3xl p-4 md:p-6 shadow-xl">
      {/* Progress bar */}
      <div className="w-full bg-gray-100 rounded-full h-2 mb-4 overflow-hidden">
        <div
          className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${((currentIndex + 1) / totalSteps) * 100}%` }}
        />
      </div>

      {/* Mobile: step counter */}
      <div className="flex items-center justify-between text-xs sm:text-sm text-gray-500 mb-4 px-1">
        <span className="font-bold tracking-widest uppercase">
          Step {currentIndex + 1} of {totalSteps}
        </span>
        <span className="font-black text-gray-900 uppercase tracking-tight">
          {STEPS[currentIndex]?.label || 'Loading...'}
        </span>
      </div>

      {/* Desktop: all steps */}
      <div className="hidden lg:flex items-start justify-between mt-4 relative">
        <div className="absolute top-4 left-0 w-full h-[1px] bg-gray-200 z-0" />
        {STEPS.map((step, index) => {
          const isCompleted = completedSteps.includes(step.key) || index < currentIndex;
          const isCurrent = step.key === resolvedStep;

          return (
            <div
              key={step.key}
              className={`flex flex-col items-center flex-1 z-10 transition-all duration-500 ${isCurrent ? 'scale-110' : ''}`}
            >
              <div className="mb-3 relative flex items-center justify-center h-8">
                {isCompleted ? (
                  <div className="w-8 h-8 flex items-center justify-center bg-emerald-500/10 rounded-full border border-emerald-500/20">
                    <CheckCircle className="w-6 h-6 text-emerald-600" />
                  </div>
                ) : (
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                    isCurrent ? 'bg-blue-600 border-white shadow-lg shadow-blue-500/30' : 'bg-gray-50 border-gray-200'
                  }`}>
                    {isCurrent
                      ? <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                      : <span className="text-xs font-bold text-gray-400">{index + 1}</span>
                    }
                  </div>
                )}
              </div>
              <span className={`text-center text-xs leading-tight max-w-[80px] font-medium ${
                isCurrent ? 'text-blue-600 font-bold' : isCompleted ? 'text-emerald-600' : 'text-gray-400'
              }`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
