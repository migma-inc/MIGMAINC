import React from 'react';
import { CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { OnboardingStep } from '../types';

const STEPS: { key: OnboardingStep; labelKey: string }[] = [
  { key: 'selection_fee', labelKey: 'student_onboarding.steps.selection_fee' },
  { key: 'selection_survey', labelKey: 'student_onboarding.steps.survey' },
  { key: 'scholarship_selection', labelKey: 'student_onboarding.steps.scholarship' },
  { key: 'placement_fee', labelKey: 'student_onboarding.steps.placement_fee' },
  { key: 'payment', labelKey: 'student_onboarding.steps.payment' },
  { key: 'documents_upload', labelKey: 'student_onboarding.steps.documents' },
];

const STEP_ALIAS: Partial<Record<OnboardingStep, OnboardingStep>> = {
  process_type: 'documents_upload',
  reinstatement_fee: 'placement_fee',
  completed: 'my_applications',
  wait_room: 'selection_survey',
  payment: 'my_applications'
};

interface StepIndicatorProps {
  currentStep: OnboardingStep;
  completedSteps: OnboardingStep[];
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep, completedSteps }) => {
  const { t } = useTranslation();
  
  // Resolve alias steps to the main steps we display
  const resolvedStep = STEP_ALIAS[currentStep] ?? currentStep;
  const currentIndex = STEPS.findIndex(s => s.key === resolvedStep);
  const totalSteps = STEPS.length;
  
  // Find the highest completed index for visual progress
  const lastCompletedIndex = STEPS.reduce((max, step, idx) => 
    completedSteps.includes(step.key) || completedSteps.some(cs => STEP_ALIAS[cs] === step.key)
      ? Math.max(max, idx) 
      : max, 
    -1
  );
  
  // Use the highest of current or last completed
  const effectivelyCurrentIndex = Math.max(currentIndex, lastCompletedIndex);
  
  // Progress bar percentage (overall completion)
  const progress = ((effectivelyCurrentIndex + 1) / totalSteps) * 100;
  
  // Active line percentage (line between dots)
  const progressLinePercentage = totalSteps > 1 ? (effectivelyCurrentIndex / (totalSteps - 1)) * 100 : 0;

  return (
    <div className="w-full mb-8 bg-zinc-900 border border-white/10 rounded-[2rem] p-5 md:p-8 shadow-2xl relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-gold-medium/5 blur-[80px] rounded-full pointer-events-none" />
      
      {/* Progress bar */}
      <div className="w-full bg-white/5 rounded-full h-1.5 mb-6 overflow-hidden border border-white/5">
        <div
          className="bg-gradient-to-r from-gold-medium/60 to-gold-medium h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(212,175,55,0.3)]"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Counter + current step label */}
      <div className="flex items-center justify-between gap-4 mb-6 px-1">
        <div className="flex flex-col">
          <span className="font-bold tracking-widest uppercase text-gray-500 text-[10px]">
            {t('student_onboarding.steps.counter', { current: currentIndex + 1, total: totalSteps })}
          </span>
          <span className="font-black text-white uppercase tracking-tight text-sm md:text-lg mt-0.5">
            {STEPS[currentIndex] ? t(STEPS[currentIndex].labelKey) : ''}
          </span>
        </div>
        
        {/* Mobile quick progress icon */}
        <div className="lg:hidden w-10 h-10 rounded-xl bg-gold-medium/10 border border-gold-medium/20 flex items-center justify-center">
            <span className="text-gold-medium font-black text-sm">{currentIndex + 1}</span>
        </div>
      </div>

      {/* Steps visualization */}
      <div className="flex items-start justify-between relative mt-2 gap-2">
        {/* Background line */}
        <div className="absolute top-4 left-0 w-full h-[1px] bg-white/10 rounded-full z-0 transform -translate-y-1/2" />
        {/* Active Progress line */}
        <div 
          className="absolute top-4 left-0 h-[1px] bg-gold-medium/50 rounded-full z-0 transform -translate-y-1/2 transition-all duration-1000 ease-out" 
          style={{ width: `${progressLinePercentage}%` }} 
        />

        {STEPS.map((step, index) => {
          const isCurrent = step.key === resolvedStep;
          const isCompleted = completedSteps.includes(step.key) || 
                             completedSteps.some(cs => STEP_ALIAS[cs] === step.key) ||
                             index < currentIndex;

          return (
            <div
              key={step.key}
              className={`flex flex-col items-center flex-1 z-10 transition-all duration-500 ${isCurrent || isCompleted ? 'opacity-100' : 'opacity-40'}`}
            >
              <div className="mb-2 flex items-center justify-center h-8">
                {isCompleted ? (
                  <div className="w-6 h-6 md:w-8 md:h-8 flex items-center justify-center bg-emerald-500/90 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.2)] z-10">
                    <CheckCircle className="w-3.5 h-3.5 md:w-4 md:h-4 text-zinc-950" />
                  </div>
                ) : (
                  <div className={`w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center border transition-all duration-300 z-10 ${isCurrent
                      ? 'bg-gold-medium border-gold-medium ring-4 ring-gold-medium/15 shadow-[0_0_15px_rgba(212,175,55,0.3)]'
                      : 'bg-zinc-950 border-white/10'
                    }`}>
                    {isCurrent
                      ? <div className="w-1.5 h-1.5 md:w-2.5 md:h-2.5 bg-zinc-950 rounded-full" />
                      : <span className="text-[10px] md:text-[11px] font-bold text-gray-400">{index + 1}</span>
                    }
                  </div>
                )}
              </div>
              <span className={`text-center text-[9px] md:text-xs leading-tight max-w-[60px] md:max-w-[100px] transition-colors duration-300 hidden sm:block ${
                  isCurrent ? 'text-white font-bold' :
                  isCompleted ? 'text-emerald-400/70 font-medium' : 
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
