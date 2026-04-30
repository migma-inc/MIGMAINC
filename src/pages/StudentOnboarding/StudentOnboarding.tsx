import React, { useEffect, useCallback, Suspense } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, LogOut } from 'lucide-react';
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
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
        <span className="text-4xl">🎓</span>
      </div>
      <h1 className="text-4xl font-black text-slate-900 mb-3 uppercase tracking-tighter">
        {t('student_onboarding.completed.title')}
      </h1>
      <p className="text-lg text-slate-600 max-w-md">
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

  // Redirecionar se não autenticado
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/student/login');
    }
  }, [authLoading, user, navigate]);

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
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <Loader2 className="w-10 h-10 animate-spin text-gold-medium" />
      </div>
    );
  }

  if (state.currentStep === 'completed' || state.onboardingCompleted) {
    return <CompletedScreen />;
  }

  const stepProps = { onNext: handleNext, onBack: handleBack, currentStep: state.currentStep };

  return (
    <div className="min-h-screen bg-[#0a0a0a] relative">
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
            <div className="h-4 w-[1px] bg-white/10 hidden sm:block" />
            <LanguageSelector />
          </div>
          
          <button
            onClick={() => {
              signOut();
              navigate('/student/login');
            }}
            className="px-4 py-2 flex items-center gap-2 bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-white rounded-xl transition-all text-sm font-semibold"
          >
            <LogOut className="w-4 h-4" />
            <span>{t('admin_header.logout', 'Sair')}</span>
          </button>
        </div>

        {/* Step indicator */}
        <StepIndicator currentStep={state.currentStep} completedSteps={completedSteps} />

        {/* Step content */}
        <Suspense fallback={<StepLoader />}>
          {state.currentStep === 'selection_fee' && <SelectionFeeStep {...stepProps} />}
          {state.currentStep === 'selection_survey' && <MigmaSurveyStep {...stepProps} contractApproved={state.contractApproved} />}
          {state.currentStep === 'wait_room' && (
            <WaitRoomStep surveyCompletedAt={state.surveyCompletedAt} checkProgress={checkProgress} />
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
