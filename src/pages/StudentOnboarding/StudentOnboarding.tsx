import React, { useEffect, useCallback, Suspense } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useStudentAuth } from '../../contexts/StudentAuthContext';
import { useOnboardingProgress } from './hooks/useOnboardingProgress';
import { StepIndicator } from './components/StepIndicator';
import type { OnboardingStep } from './types';

const SelectionFeeStep = React.lazy(() =>
  import('./components/SelectionFeeStep').then(m => ({ default: m.SelectionFeeStep }))
);
const IdentityVerificationStep = React.lazy(() =>
  import('./components/IdentityVerificationStep').then(m => ({ default: m.IdentityVerificationStep }))
);
const MigmaSurveyStep = React.lazy(() =>
  import('./components/MigmaSurveyStep').then(m => ({ default: m.MigmaSurveyStep }))
);
const ScholarshipSelectionStep = React.lazy(() =>
  import('./components/ScholarshipSelectionStep').then(m => ({ default: m.ScholarshipSelectionStep }))
);
const ProcessTypeStep = React.lazy(() =>
  import('./components/ProcessTypeStep').then(m => ({ default: m.ProcessTypeStep }))
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

const StepLoader = () => (
  <div className="flex justify-center items-center py-20">
    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
  </div>
);

const CompletedScreen = () => (
  <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
    <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
      <span className="text-4xl">🎓</span>
    </div>
    <h1 className="text-4xl font-black text-slate-900 mb-3 uppercase tracking-tighter">
      Process Completed!
    </h1>
    <p className="text-lg text-slate-600 max-w-md">
      Congratulations! Your application process is complete.
      The team will be in touch with next steps.
    </p>
  </div>
);

const StudentOnboarding: React.FC = () => {
  const { user, loading: authLoading, signOut } = useStudentAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const { state, loading, goToStep, checkProgress } = useOnboardingProgress();
  const isInitialMount = React.useRef(true);

  // Redirecionar se não autenticado
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/student/register');
    }
  }, [authLoading, user, navigate]);

  const VALID_STEPS: OnboardingStep[] = [
    'selection_fee', 'identity_verification', 'selection_survey',
    'scholarship_selection', 'process_type', 'documents_upload',
    'payment', 'placement_fee', 'my_applications',
  ];

  // Sincronizar URL -> State na carga inicial
  useEffect(() => {
    if (loading || !isInitialMount.current) return;
    const stepParam = searchParams.get('step') as OnboardingStep | null;
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
    'identity_verification',
    'selection_survey',
    'scholarship_selection',
    'process_type',
    'documents_upload',
    'payment',
    'placement_fee', // Migma: sempre placement_fee_flow = true
    'my_applications',
  ], []);

  const handleNext = useCallback(async () => {
    await checkProgress();
    const steps = getOrderedSteps();
    const currentIndex = steps.indexOf(state.currentStep);
    if (currentIndex < steps.length - 1) {
      goToStep(steps[currentIndex + 1]);
    }
  }, [state.currentStep, goToStep, getOrderedSteps, checkProgress]);

  const handleBack = useCallback(() => {
    const steps = getOrderedSteps();
    const currentIndex = steps.indexOf(state.currentStep);
    if (currentIndex > 0) {
      goToStep(steps[currentIndex - 1]);
    }
  }, [state.currentStep, goToStep, getOrderedSteps]);

  const completedSteps: OnboardingStep[] = [];
  if (state.selectionFeePaid) completedSteps.push('selection_fee');
  if (state.identityVerified) completedSteps.push('identity_verification');
  if (state.selectionSurveyPassed) completedSteps.push('selection_survey');
  if (state.scholarshipsSelected) completedSteps.push('scholarship_selection');
  if (state.processTypeSelected) completedSteps.push('process_type');
  if (state.documentsUploaded) completedSteps.push('documents_upload');
  if (state.applicationFeePaid) completedSteps.push('payment');
  if (state.placementFeePaid) completedSteps.push('placement_fee');

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
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Logo / header */}
        <div className="mb-8 flex items-center justify-between">
          <img 
            src="/logo.png" 
            alt="Migma" 
            className="h-8 object-contain cursor-pointer" 
            onClick={() => navigate('/')}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} 
          />
          
          <button
            onClick={() => {
              signOut();
              navigate('/student/register');
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
          {state.currentStep === 'identity_verification' && <IdentityVerificationStep {...stepProps} />}
          {state.currentStep === 'selection_survey' && <MigmaSurveyStep {...stepProps} />}
          {state.currentStep === 'scholarship_selection' && <ScholarshipSelectionStep {...stepProps} />}
          {state.currentStep === 'process_type' && <ProcessTypeStep {...stepProps} />}
          {state.currentStep === 'documents_upload' && <DocumentsUploadStep {...stepProps} />}
          {state.currentStep === 'payment' && <PaymentStep {...stepProps} />}
          {state.currentStep === 'placement_fee' && <PlacementFeeStep {...stepProps} />}
          {(state.currentStep === 'my_applications' || state.currentStep === 'reinstatement_fee') && (
            <WaitingApprovalStep {...stepProps} />
          )}
          {state.currentStep === 'scholarship_fee' && <WaitingApprovalStep {...stepProps} />}
        </Suspense>
      </div>
    </div>
  );
};

export default StudentOnboarding;
