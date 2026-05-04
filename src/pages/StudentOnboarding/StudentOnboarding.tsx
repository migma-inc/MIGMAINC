import React, { useEffect, useCallback, Suspense } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, LogOut, Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useStudentAuth } from '../../contexts/StudentAuthContext';
import { useOnboardingProgress } from './hooks/useOnboardingProgress';
import { StepIndicator } from './components/StepIndicator';
import { LanguageSelector } from '../../components/LanguageSelector';
import type { OnboardingStep } from './types';

const SelectionFeeStep = React.lazy(() =>
  import('./components/SelectionFeeStep').then(m => ({ default: m.SelectionFeeStep }))
);
const MigmaSurveyStep = React.lazy(() =>
  import('./components/MigmaSurveyStep').then(m => ({ default: m.MigmaSurveyStep }))
);
const WaitRoomStep = React.lazy(() =>
  import('./components/WaitRoomStep').then(m => ({ default: m.WaitRoomStep }))
);
const UniversitySelectionStep = React.lazy(() =>
  import('./components/UniversitySelectionStep').then(m => ({ default: m.UniversitySelectionStep }))
);
const DocumentsUploadStep = React.lazy(() =>
  import('./components/DocumentsUploadStep').then(m => ({ default: m.DocumentsUploadStep }))
);
const PaymentStep = React.lazy(() =>
  import('./components/PaymentStep').then(m => ({ default: m.PaymentStep }))
);
const PlacementFeeStep = React.lazy(() =>
  import('./components/PlacementFeeStep').then(m => ({ default: m.PlacementFeeStep }))
);
const WaitingApprovalStep = React.lazy(() =>
  import('./components/WaitingApprovalStep').then(m => ({ default: m.WaitingApprovalStep }))
);
const AcceptanceLetterStep = React.lazy(() =>
  import('./components/AcceptanceLetterStep').then(m => ({ default: m.AcceptanceLetterStep }))
);
const DadosComplementaresStep = React.lazy(() =>
  import('./components/DadosComplementaresStep').then(m => ({ default: m.DadosComplementaresStep }))
);

const normalizeLegacyStep = (step: OnboardingStep | string | null | undefined): OnboardingStep | null => {
  if (!step) return null;
  if (step === 'process_type') return 'documents_upload';
  if (step === 'identity_verification') return 'selection_survey';
  return step as OnboardingStep;
};

const StepLoader = () => (
  <div className="flex justify-center items-center py-32 min-h-[400px]">
    <Loader2 className="w-10 h-10 animate-spin text-gold-medium" />
  </div>
);

const DISABLE_REVIEW_WAIT_ROOM_FOR_TESTS = true;

const CompletedScreen = () => {
  const { t } = useTranslation();
  return (
    <div className="student-onboarding min-h-screen flex flex-col items-center justify-center px-4 text-center bg-[#f7f4ee] text-[#1f1a14] dark:bg-[#0a0a0a] dark:text-white">
      <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-500/10 rounded-full flex items-center justify-center mb-6">
        <span className="text-4xl">🎓</span>
      </div>
      <h1 className="text-4xl font-black text-[#1f1a14] dark:text-white mb-3 uppercase tracking-tighter">
        {t('student_onboarding.completed.title')}
      </h1>
      <p className="text-lg text-[#6f6251] dark:text-gray-400 max-w-md">
        {t('student_onboarding.completed.subtitle')}
      </p>
    </div>
  );
};

const StudentOnboarding: React.FC = () => {
  const { user, loading: authLoading, signOut } = useStudentAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const { state, loading, goToStep, checkProgress, maxAllowedStep } = useOnboardingProgress();
  const isInitialMount = React.useRef(true);
  const [isDarkMode, setIsDarkMode] = React.useState(() =>
    document.documentElement.classList.contains('dark')
  );

  // Redirecionar se não autenticado
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/student/login');
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark';
    setIsDarkMode(isDark);
    document.documentElement.classList.toggle('dark', isDark);
  }, []);

  const toggleDarkMode = () => {
    setIsDarkMode(prev => {
      const next = !prev;
      document.documentElement.classList.toggle('dark', next);
      localStorage.setItem('theme', next ? 'dark' : 'light');
      return next;
    });
  };

  const VALID_STEPS: OnboardingStep[] = [
    'selection_fee', 'selection_survey', 'wait_room',
    'scholarship_selection', 'placement_fee',
    'documents_upload', 'payment', 'dados_complementares',
    'my_applications', 'acceptance_letter',
  ];

  // Sincronizar URL -> State na carga inicial
  useEffect(() => {
    if (loading || !isInitialMount.current) return;
    const stepParam = normalizeLegacyStep(searchParams.get('step') as OnboardingStep | null);
    if (stepParam && VALID_STEPS.includes(stepParam) && stepParam !== state.currentStep) {
      goToStep(stepParam);
    }
    isInitialMount.current = false;
  }, [loading]);

  // Sincronizar State -> URL durante navegação
  useEffect(() => {
    if (loading || isInitialMount.current) return;
    const currentStepUrl = searchParams.get('step');
    if (state.currentStep && state.currentStep !== currentStepUrl) {
      const newParams = new URLSearchParams(searchParams);
      newParams.set('step', state.currentStep);
      navigate(`?${newParams.toString()}`, { replace: true });
    }
  }, [state.currentStep, loading]);

  // Scroll to top ao mudar de step
  useEffect(() => {
    const timer = setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);
    return () => clearTimeout(timer);
  }, [state.currentStep]);

  const getOrderedSteps = useCallback((): OnboardingStep[] => [
    'selection_fee',
    'selection_survey',
    'wait_room',
    'scholarship_selection',
    'placement_fee',
    'documents_upload',
    'payment',
    'dados_complementares',
    'my_applications',
    'acceptance_letter',
  ], []);

  const handleNext = useCallback(async () => {
    // Refresh progress from backend
    const res = await checkProgress();
    const currentMax = (res as { maxAllowedStep?: OnboardingStep } | void)?.maxAllowedStep || maxAllowedStep;
    
    const steps = getOrderedSteps();
    const currentIndex = steps.indexOf(state.currentStep);
    let nextStep = steps[currentIndex + 1];
    if (DISABLE_REVIEW_WAIT_ROOM_FOR_TESTS && state.currentStep === 'selection_survey') {
      nextStep = 'scholarship_selection';
    }
    
    // We don't need to manually check maxAllowedStep here because goToStep 
    // will be called, but the next checkProgress cycle would pull them back anyway.
    // However, to be explicit and avoid the "jump and back" effect:
    if (currentIndex < steps.length - 1) {
      const maxIdx = steps.indexOf(currentMax);
      const nextIdx = steps.indexOf(nextStep);

      if (nextIdx <= maxIdx) {
        goToStep(nextStep);
      } else {
        console.warn('[Onboarding] Bloqueando avanço: necessário aprovação ou ação pendente.', { nextStep, maxAllowedStep: currentMax });
      }
    }
  }, [state.currentStep, goToStep, getOrderedSteps, checkProgress, maxAllowedStep]);

  const handleBack = useCallback(() => {
    const steps = getOrderedSteps();
    const currentIndex = steps.indexOf(state.currentStep);
    if (currentIndex > 0) {
      goToStep(steps[currentIndex - 1]);
    }
  }, [state.currentStep, goToStep, getOrderedSteps]);

  const completedSteps: OnboardingStep[] = [];
  if (state.selectionFeePaid) completedSteps.push('selection_fee');
  if (state.selectionSurveyPassed) completedSteps.push('selection_survey');
  if (state.contractApproved) completedSteps.push('wait_room');
  if (state.scholarshipsSelected) completedSteps.push('scholarship_selection');
  if (state.placementFeePaid) completedSteps.push('placement_fee');
  if (state.documentsUploaded) completedSteps.push('documents_upload');
  if (state.applicationFeePaid) completedSteps.push('payment');
  if (state.complementaryDataSubmitted) completedSteps.push('dados_complementares');

  if (authLoading || loading) {
    return (
      <div className="student-onboarding min-h-screen flex items-center justify-center bg-[#f7f4ee] dark:bg-[#0a0a0a]">
        <Loader2 className="w-10 h-10 animate-spin text-gold-medium" />
      </div>
    );
  }

  if (state.currentStep === 'completed' || state.onboardingCompleted) {
    return <CompletedScreen />;
  }

  const stepProps = { onNext: handleNext, onBack: handleBack, currentStep: state.currentStep };

  return (
    <div className="student-onboarding min-h-screen bg-[#f7f4ee] text-[#1f1a14] dark:bg-[#0a0a0a] dark:text-white relative">
      <div className="max-w-5xl mx-auto px-4 py-8 relative">
        {/* Logo / header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <img 
              src="/logo.png" 
              alt="Migma" 
              className="h-8 object-contain cursor-pointer" 
              onClick={() => navigate('/')}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} 
            />
            <div className="h-4 w-[1px] bg-[#eadbbf] dark:bg-white/10 hidden sm:block" />
            <LanguageSelector />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleDarkMode}
              className="p-2 rounded-lg text-[#6f6251] dark:text-gray-400 hover:bg-[#f3ead9] dark:hover:bg-white/5 transition-colors"
              title={isDarkMode ? t('theme.light', { defaultValue: 'Light Mode' }) : t('theme.dark', { defaultValue: 'Dark Mode' })}
              aria-label={isDarkMode ? t('theme.light', { defaultValue: 'Light Mode' }) : t('theme.dark', { defaultValue: 'Dark Mode' })}
            >
              {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            <button
              onClick={() => {
                signOut();
                navigate('/student/login');
              }}
              className="px-4 py-2 flex items-center gap-2 bg-white border border-[#e3d5bd] text-[#6f6251] hover:bg-[#f3ead9] hover:text-[#1f1a14] dark:bg-white/5 dark:border-white/10 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white rounded-xl transition-all text-sm font-semibold"
            >
              <LogOut className="w-4 h-4" />
              <span>{t('admin_header.logout', 'Sair')}</span>
            </button>
          </div>
        </div>

        {/* Step indicator */}
        <StepIndicator currentStep={state.currentStep} completedSteps={completedSteps} />

        {/* Step content */}
        <Suspense fallback={<StepLoader />}>
          {state.currentStep === 'selection_fee' && <SelectionFeeStep {...stepProps} />}
          {state.currentStep === 'selection_survey' && <MigmaSurveyStep {...stepProps} contractApproved={state.contractApproved} />}
          {state.currentStep === 'wait_room' && (
            <WaitRoomStep
              surveyCompletedAt={state.surveyCompletedAt}
              checkProgress={async () => {
                await checkProgress();
              }}
            />
          )}
          {state.currentStep === 'scholarship_selection' && <UniversitySelectionStep {...stepProps} />}
          {state.currentStep === 'documents_upload' && <DocumentsUploadStep {...stepProps} />}
          {state.currentStep === 'payment' && <PaymentStep {...stepProps} />}
          {state.currentStep === 'dados_complementares' && <DadosComplementaresStep {...stepProps} />}
          {state.currentStep === 'placement_fee' && <PlacementFeeStep {...stepProps} />}
          {(state.currentStep === 'my_applications' || state.currentStep === 'reinstatement_fee') && (
            <WaitingApprovalStep {...stepProps} />
          )}
          {state.currentStep === 'scholarship_fee' && <WaitingApprovalStep {...stepProps} />}
          {state.currentStep === 'acceptance_letter' && <AcceptanceLetterStep {...stepProps} />}
        </Suspense>
      </div>
    </div>
  );
};

export default StudentOnboarding;
