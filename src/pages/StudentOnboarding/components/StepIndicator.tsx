import React from 'react';
import { CheckCircle } from 'lucide-react';
import type { OnboardingStep } from '../types';

const STEPS: { key: OnboardingStep; label: string }[] = [
  { key: 'selection_fee',         label: 'Selection Fee' },
  { key: 'identity_verification', label: 'Profile' },
  { key: 'selection_survey',      label: 'Survey' },
  { key: 'scholarship_selection', label: 'Scholarship' },
  { key: 'documents_upload',      label: 'Documents' },
  { key: 'payment',               label: 'Application Fee' },
  { key: 'placement_fee',         label: 'Placement Fee' },
  { key: 'my_applications',       label: 'My Applications' },
];

const STEP_ALIAS: Partial<Record<OnboardingStep, OnboardingStep>> = {
  process_type:      'scholarship_selection',
  reinstatement_fee: 'placement_fee',
  completed:         'my_applications',
};

interface StepIndicatorProps {
  currentStep: OnboardingStep;
  completedSteps: OnboardingStep[];
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep, completedSteps }) => {
  const resolvedStep = STEP_ALIAS[currentStep] ?? currentStep;
  const currentIndex = STEPS.findIndex(s => s.key === resolvedStep);
  const totalSteps = STEPS.length;
  const progress = ((currentIndex + 1) / totalSteps) * 100;

  return (
    <div className="w-full mb-6 sm:mb-8 bg-white/5 border border-white/10 rounded-2xl p-4 md:p-5">
      {/* Progress bar */}
      <div className="w-full bg-white/10 rounded-full h-1 mb-4 overflow-hidden">
        <div
          className="bg-gold-medium h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Counter + current step label */}
      <div className="flex items-center justify-between text-xs mb-4 px-1">
        <span className="font-bold tracking-widest uppercase text-gray-500">
          Step {currentIndex + 1} of {totalSteps}
        </span>
        <span className="font-black text-gold-medium uppercase tracking-tight">
          {STEPS[currentIndex]?.label ?? ''}
        </span>
      </div>

      {/* Desktop: all steps */}
      <div className="hidden lg:flex items-start justify-between relative">
        <div className="absolute top-4 left-0 w-full h-px bg-white/10 z-0" />
        {STEPS.map((step, index) => {
          const isCompleted = completedSteps.includes(step.key) || index < currentIndex;
          const isCurrent = step.key === resolvedStep;

          return (
            <div
              key={step.key}
              className={`flex flex-col items-center flex-1 z-10 transition-all duration-500 ${isCurrent ? 'scale-110' : ''}`}
            >
              <div className="mb-2 flex items-center justify-center h-8">
                {isCompleted ? (
                  <div className="w-8 h-8 flex items-center justify-center bg-gold-medium/10 rounded-full border border-gold-medium/30">
                    <CheckCircle className="w-5 h-5 text-gold-medium" />
                  </div>
                ) : (
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                    isCurrent
                      ? 'bg-gold-medium border-gold-medium shadow-lg shadow-gold-medium/20'
                      : 'bg-transparent border-white/20'
                  }`}>
                    {isCurrent
                      ? <div className="w-2 h-2 bg-black rounded-full animate-pulse" />
                      : <span className="text-xs font-bold text-gray-600">{index + 1}</span>
                    }
                  </div>
                )}
              </div>
              <span className={`text-center text-xs leading-tight max-w-[80px] font-medium ${
                isCurrent   ? 'text-gold-medium font-bold' :
                isCompleted ? 'text-gold-medium/60'        : 'text-gray-600'
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
