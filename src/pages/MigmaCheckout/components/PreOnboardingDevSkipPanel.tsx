import React from 'react';
import { Bug, ChevronDown, ChevronUp, FastForward, RefreshCw, Route } from 'lucide-react';
import type { CheckoutStep } from '../types';
import type { OnboardingStep } from '../../StudentOnboarding/types';

type PreOnboardingDevSkipPanelProps = {
  currentStep: CheckoutStep;
  onJump: (step: CheckoutStep, mockPayment: boolean) => void;
  onGoToOnboarding: (step: OnboardingStep) => void;
  onReset: () => void;
};

const CHECKOUT_STEP_LABELS: Record<CheckoutStep, string> = {
  1: 'Info + Pagamento',
  2: 'Documentacao',
  3: 'Resumo final',
};

const ONBOARDING_TARGETS: Array<{ step: OnboardingStep; label: string }> = [
  { step: 'selection_survey', label: 'Onboarding: questionario' },
  { step: 'scholarship_selection', label: 'Onboarding: faculdades' },
  { step: 'documents_upload', label: 'Onboarding: documentos' },
  { step: 'payment', label: 'Onboarding: application fee' },
];

export const PreOnboardingDevSkipPanel: React.FC<PreOnboardingDevSkipPanelProps> = ({
  currentStep,
  onJump,
  onGoToOnboarding,
  onReset,
}) => {
  const [open, setOpen] = React.useState(false);
  const [targetStep, setTargetStep] = React.useState<CheckoutStep>(currentStep);
  const [onboardingStep, setOnboardingStep] = React.useState<OnboardingStep>('selection_survey');
  const [mockPayment, setMockPayment] = React.useState(true);

  React.useEffect(() => {
    setTargetStep(currentStep);
  }, [currentStep]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 left-4 z-[70] flex items-center gap-2 rounded-lg border border-amber-400/40 bg-zinc-950 px-3 py-2 text-xs font-bold uppercase tracking-wide text-amber-200 shadow-2xl shadow-black/30 transition hover:bg-zinc-900"
        title="Abrir skip dev do pre-onboarding"
        aria-label="Abrir skip dev do pre-onboarding"
      >
        <Bug className="h-4 w-4" />
        Pre Dev
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-[70] w-[min(380px,calc(100vw-2rem))] rounded-lg border border-amber-400/30 bg-zinc-950 text-zinc-100 shadow-2xl shadow-black/40">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <Bug className="h-4 w-4 text-amber-300" />
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-amber-200">Pre-onboarding Dev</p>
            <p className="text-[11px] text-zinc-400">Somente local/dev. Nao cria usuario nem abre checkout.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md p-1 text-zinc-400 transition hover:bg-white/10 hover:text-white"
          title="Minimizar"
          aria-label="Minimizar"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-3 p-4">
        <div className="rounded-md bg-white/5 px-2 py-1 text-[11px] text-zinc-400">
          Atual: <span className="text-zinc-100">{CHECKOUT_STEP_LABELS[currentStep]}</span>
        </div>

        <label className="block text-xs font-semibold text-zinc-300" htmlFor="pre-onboarding-dev-step">
          Ir para etapa do pre-onboarding
        </label>
        <select
          id="pre-onboarding-dev-step"
          value={targetStep}
          onChange={(event) => setTargetStep(Number(event.target.value) as CheckoutStep)}
          className="w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white outline-none transition focus:border-amber-300"
        >
          {[1, 2, 3].map(step => (
            <option key={step} value={step}>
              {CHECKOUT_STEP_LABELS[step as CheckoutStep]}
            </option>
          ))}
        </select>

        <label className="flex items-start gap-3 rounded-md border border-white/10 bg-white/[0.03] p-3 text-sm">
          <input
            type="checkbox"
            checked={mockPayment}
            onChange={(event) => setMockPayment(event.target.checked)}
            className="mt-1"
          />
          <span>
            <span className="block font-semibold text-zinc-100">Mockar pagamento e dados basicos</span>
            <span className="block text-xs text-zinc-400">Libera steps localmente sem criar usuario e sem chamar checkout.</span>
          </span>
        </label>

        <button
          type="button"
          onClick={() => onJump(targetStep, mockPayment)}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-amber-400 px-3 py-2 text-sm font-bold text-zinc-950 transition hover:bg-amber-300"
        >
          <FastForward className="h-4 w-4" />
          Aplicar no pre-onboarding
        </button>

        <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
          <label className="mb-2 block text-xs font-semibold text-zinc-300" htmlFor="pre-onboarding-dev-onboarding-step">
            Entrar no onboarding sem usuario
          </label>
          <select
            id="pre-onboarding-dev-onboarding-step"
            value={onboardingStep}
            onChange={(event) => setOnboardingStep(event.target.value as OnboardingStep)}
            className="mb-2 w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white outline-none transition focus:border-amber-300"
          >
            {ONBOARDING_TARGETS.map(target => (
              <option key={target.step} value={target.step}>
                {target.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => onGoToOnboarding(onboardingStep)}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm font-bold text-emerald-200 transition hover:bg-emerald-400/20"
          >
            <Route className="h-4 w-4" />
            Ir para onboarding local
          </button>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onReset}
            className="flex items-center justify-center gap-2 rounded-md border border-white/10 px-3 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-white/10"
            title="Limpar mock local"
            aria-label="Limpar mock local"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex items-center justify-center rounded-md border border-white/10 px-3 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-white/10"
            title="Minimizar"
            aria-label="Minimizar"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
