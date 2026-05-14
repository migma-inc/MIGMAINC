import React from 'react';
import { Bug, ChevronDown, ChevronUp, CreditCard, FastForward, RefreshCw } from 'lucide-react';
import type { OnboardingStep } from '../types';

type DevSkipOptions = {
  completePreviousSteps: boolean;
  mockPaymentSteps: boolean;
};

type OnboardingDevSkipPanelProps = {
  steps: OnboardingStep[];
  currentStep: OnboardingStep;
  maxAllowedStep: OnboardingStep;
  devOverrideActive: boolean;
  onJump: (step: OnboardingStep, options: DevSkipOptions) => void;
  onReset: () => void;
};

const STEP_LABELS: Record<OnboardingStep, string> = {
  selection_fee: 'Selection Fee',
  selection_survey: 'Questionario',
  wait_room: 'Wait Room',
  scholarship_selection: 'Selecao de Bolsas',
  process_type: 'Process Type',
  placement_fee: 'Placement Fee',
  documents_upload: 'Envio de Docs',
  payment: 'Application Payment',
  dados_complementares: 'Dados Complementares',
  scholarship_fee: 'Scholarship Fee',
  reinstatement_fee: 'Reinstatement Fee',
  my_applications: 'My Applications',
  acceptance_letter: 'Acceptance Letter',
  completed: 'Completed',
};

export const OnboardingDevSkipPanel: React.FC<OnboardingDevSkipPanelProps> = ({
  steps,
  currentStep,
  maxAllowedStep,
  devOverrideActive,
  onJump,
  onReset,
}) => {
  const [open, setOpen] = React.useState(false);
  const [targetStep, setTargetStep] = React.useState<OnboardingStep>(currentStep);
  const [completePreviousSteps, setCompletePreviousSteps] = React.useState(true);
  const [mockPaymentSteps, setMockPaymentSteps] = React.useState(true);

  React.useEffect(() => {
    setTargetStep(currentStep);
  }, [currentStep]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 left-4 z-[70] flex items-center gap-2 rounded-lg border border-amber-400/40 bg-zinc-950 px-3 py-2 text-xs font-bold uppercase tracking-wide text-amber-200 shadow-2xl shadow-black/30 transition hover:bg-zinc-900"
        title="Abrir skip dev do onboarding"
        aria-label="Abrir skip dev do onboarding"
      >
        <Bug className="h-4 w-4" />
        Dev Skip
        {devOverrideActive && <span className="h-2 w-2 rounded-full bg-emerald-400" />}
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-[70] w-[min(360px,calc(100vw-2rem))] rounded-lg border border-amber-400/30 bg-zinc-950 text-zinc-100 shadow-2xl shadow-black/40">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <Bug className="h-4 w-4 text-amber-300" />
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-amber-200">Onboarding Dev Skip</p>
            <p className="text-[11px] text-zinc-400">Somente local/dev. Nao grava etapa no banco.</p>
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
        <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-400">
          <div className="rounded-md bg-white/5 px-2 py-1">
            Atual: <span className="text-zinc-100">{STEP_LABELS[currentStep]}</span>
          </div>
          <div className="rounded-md bg-white/5 px-2 py-1">
            Max: <span className="text-zinc-100">{STEP_LABELS[maxAllowedStep]}</span>
          </div>
        </div>

        <label className="block text-xs font-semibold text-zinc-300" htmlFor="onboarding-dev-skip-step">
          Ir para etapa
        </label>
        <select
          id="onboarding-dev-skip-step"
          value={targetStep}
          onChange={(event) => setTargetStep(event.target.value as OnboardingStep)}
          className="w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white outline-none transition focus:border-amber-300"
        >
          {steps.map(step => (
            <option key={step} value={step}>
              {STEP_LABELS[step]}
            </option>
          ))}
        </select>

        <label className="flex items-start gap-3 rounded-md border border-white/10 bg-white/[0.03] p-3 text-sm">
          <input
            type="checkbox"
            checked={completePreviousSteps}
            onChange={(event) => setCompletePreviousSteps(event.target.checked)}
            className="mt-1"
          />
          <span>
            <span className="block font-semibold text-zinc-100">Simular etapas anteriores</span>
            <span className="block text-xs text-zinc-400">Marca progresso local para liberar o fluxo de teste.</span>
          </span>
        </label>

        <label className="flex items-start gap-3 rounded-md border border-white/10 bg-white/[0.03] p-3 text-sm">
          <input
            type="checkbox"
            checked={mockPaymentSteps}
            onChange={(event) => setMockPaymentSteps(event.target.checked)}
            className="mt-1"
          />
          <span>
            <span className="flex items-center gap-2 font-semibold text-zinc-100">
              <CreditCard className="h-4 w-4 text-amber-300" />
              Pular metodos de pagamento
            </span>
            <span className="block text-xs text-zinc-400">
              Ligado: pagamentos ficam pagos no dev. Desligado: mantem o estado real para testar checkout.
            </span>
          </span>
        </label>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onJump(targetStep, { completePreviousSteps, mockPaymentSteps })}
            className="flex flex-1 items-center justify-center gap-2 rounded-md bg-amber-400 px-3 py-2 text-sm font-bold text-zinc-950 transition hover:bg-amber-300"
          >
            <FastForward className="h-4 w-4" />
            Aplicar
          </button>
          <button
            type="button"
            onClick={onReset}
            className="flex items-center justify-center gap-2 rounded-md border border-white/10 px-3 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-white/10"
            title="Voltar ao progresso real"
            aria-label="Voltar ao progresso real"
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

        {devOverrideActive && (
          <p className="rounded-md border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-200">
            Override dev ativo. Use reset para voltar ao progresso real do aluno.
          </p>
        )}
      </div>
    </div>
  );
};
