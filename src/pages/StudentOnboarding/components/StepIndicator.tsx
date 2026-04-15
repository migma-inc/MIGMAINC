import React from 'react';
import { CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { OnboardingStep } from '../types';

const STEPS: { key: OnboardingStep; labelKey: string }[] = [
  { key: 'identity_verification', labelKey: 'student_onboarding.steps.profile' },
  { key: 'selection_survey', labelKey: 'student_onboarding.steps.survey' },
  { key: 'scholarship_selection', labelKey: 'student_onboarding.steps.scholarship' },
  { key: 'documents_upload', labelKey: 'student_onboarding.steps.documents' },
  { key: 'payment', labelKey: 'student_onboarding.steps.payment' },
  { key: 'placement_fee', labelKey: 'student_onboarding.steps.placement_fee' },
  { key: 'my_applications', labelKey: 'student_onboarding.steps.my_applications' },
];

const STEP_ALIAS: Partial<Record<OnboardingStep, OnboardingStep>> = {
  process_type: 'documents_upload',
  reinstatement_fee: 'placement_fee',
  completed: 'my_applications',
};

interface StepIndicatorProps {
  currentStep: OnboardingStep;
  completedSteps: OnboardingStep[];
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep, completedSteps }) => {
  const { t } = useTranslation();
  const resolvedStep = STEP_ALIAS[currentStep] ?? currentStep;
  const currentIndex = STEPS.findIndex(s => s.key === resolvedStep);
  const totalSteps = STEPS.length;
  
  // Encontra o maior índice concluído para a barra de progresso
  const lastCompletedIndex = STEPS.reduce((max, step, idx) => 
    completedSteps.includes(step.key) ? Math.max(max, idx) : max, -1
  );
  
  // O progresso visual deve ser baseado no que é maior: o step atual ou o último concluído
  const effectivelyCurrentIndex = Math.max(currentIndex, lastCompletedIndex);
  
  const progress = ((effectivelyCurrentIndex + 1) / totalSteps) * 100;
  const progressLinePercentage = totalSteps > 1 ? (effectivelyCurrentIndex / (totalSteps - 1)) * 100 : 0;

  return (
    <div className="w-full mb-6 sm:mb-8 bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl p-5 md:p-6 shadow-2xl">
      {/* Progress bar (Mais visível no mobile) */}
      <div className="w-full bg-white/5 rounded-full h-1.5 mb-5 overflow-hidden border border-white/5">
        <div
          className="bg-gradient-to-r from-gold-medium/50 to-gold-medium h-full rounded-full transition-all duration-700 ease-out shadow-[0_0_10px_rgba(212,175,55,0.4)]"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Counter + current step label */}
      <div className="flex items-center justify-between text-xs mb-2 lg:mb-6 px-1">
        <span className="font-bold tracking-widest uppercase text-gray-400/80 text-[10px] md:text-xs">
          {t('student_onboarding.steps.counter', { current: currentIndex + 1, total: totalSteps })}
        </span>
        <span className="font-black text-gold-medium uppercase tracking-widest text-[10px] md:text-xs drop-shadow-sm">
          {STEPS[currentIndex] ? t(STEPS[currentIndex].labelKey) : ''}
        </span>
      </div>

      {/* Desktop: all steps */}
      <div className="hidden lg:flex items-start justify-between relative mt-2">
        {/* Background line */}
        <div className="absolute top-4 left-0 w-full h-[2px] bg-white/5 rounded-full z-0 transform -translate-y-1/2" />
        {/* Active Progress line */}
        <div 
          className="absolute top-4 left-0 h-[2px] bg-gradient-to-r from-gold-medium/80 to-gold-medium rounded-full z-0 transform -translate-y-1/2 transition-all duration-700 ease-out shadow-[0_0_8px_rgba(212,175,55,0.5)]" 
          style={{ width: `${progressLinePercentage}%` }} 
        />

        {STEPS.map((step, index) => {
          const isCurrent = step.key === resolvedStep;
          const isCompleted = completedSteps.includes(step.key) || index < currentIndex;

          return (
            <div
              key={step.key}
              className={`flex flex-col items-center flex-1 z-10 transition-all duration-500`}
            >
              <div className="mb-3 flex items-center justify-center h-8">
                {isCompleted ? (
                  <div className="w-8 h-8 flex items-center justify-center bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.3)] z-10">
                    <CheckCircle className="w-5 h-5 text-zinc-900" />
                  </div>
                ) : (
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300 z-10 ${isCurrent
                      ? 'bg-gold-medium border-gold-medium ring-4 ring-gold-medium/20 shadow-[0_0_20px_rgba(212,175,55,0.4)]'
                      : 'bg-[#18181b] border-white/10'
                    }`}>
                    {isCurrent
                      ? <div className="w-2.5 h-2.5 bg-black rounded-full animate-pulse" />
                      : <span className="text-[11px] font-bold text-gray-500">{index + 1}</span>
                    }
                  </div>
                )}
              </div>
              <span className={`text-center text-xs leading-snug max-w-[100px] transition-colors duration-300 ${
                  isCurrent ? 'text-white font-bold tracking-wide drop-shadow-md' :
                  isCompleted ? 'text-emerald-400/80 font-medium' : 
                  'text-gray-500 font-medium'
                }`}>
                {t(step.labelKey)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
