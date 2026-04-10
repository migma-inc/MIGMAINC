import React from 'react';
import { Check } from 'lucide-react';
import type { CheckoutStep } from '../types';

interface Props {
  currentStep: CheckoutStep;
  step1Completed: boolean;
  step2Completed: boolean;
}

const STEPS = [
  { num: 1 as CheckoutStep, label: 'Info & Payment' },
  { num: 2 as CheckoutStep, label: 'Documents & Identity' },
];

export const CheckoutProgressBar: React.FC<Props> = ({ currentStep, step1Completed, step2Completed }) => {
  const isCompleted = (step: CheckoutStep) => {
    if (step === 1) return step1Completed;
    if (step === 2) return step2Completed;
    return false;
  };

  const isActive = (step: CheckoutStep) => step === currentStep;

  return (
    <div className="bg-black/80 backdrop-blur-sm border-b border-white/5 sticky top-14 z-40">
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between relative">
          {/* Connecting line */}
          <div className="absolute left-0 right-0 top-4 h-px bg-white/10 z-0" />

          {STEPS.map((step, idx) => {
            const completed = isCompleted(step.num);
            const active = isActive(step.num);

            return (
              <React.Fragment key={step.num}>
                <div className="flex flex-col items-center gap-2 z-10 flex-1">
                  <div className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all
                    ${completed
                      ? 'bg-emerald-500 border-emerald-500 text-white'
                      : active
                      ? 'bg-gold-medium border-gold-medium text-black'
                      : 'bg-[#111] border-white/20 text-gray-500'
                    }
                  `}>
                    {completed ? <Check className="w-4 h-4" /> : step.num}
                  </div>
                  <span className={`text-xs font-medium text-center hidden sm:block transition-colors ${
                    active ? 'text-gold-medium' : completed ? 'text-emerald-400' : 'text-gray-500'
                  }`}>
                    {step.label}
                  </span>
                </div>
                {idx < STEPS.length - 1 && <div className="flex-1 hidden" />}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};
