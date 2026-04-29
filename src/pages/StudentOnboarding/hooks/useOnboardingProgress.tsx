import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useStudentAuth } from '../../../contexts/StudentAuthContext';
import { supabase } from '../../../lib/supabase';
import { applicationStore, useCartStore } from '../../../stores/applicationStore';
import type { OnboardingStep, OnboardingState } from '../types';

const VALID_STEPS: OnboardingStep[] = [
  'selection_fee', 'selection_survey',
  'wait_room', 'scholarship_selection', 'placement_fee',
  'documents_upload', 'payment', 'dados_complementares',
  'my_applications', 'acceptance_letter', 'completed'
];

const normalizeLegacyStep = (step: OnboardingStep | string | null | undefined): OnboardingStep | null => {
  if (!step) return null;
  if (step === 'process_type') return 'documents_upload';
  if (step === 'identity_verification') return 'selection_survey';
  return step as OnboardingStep;
};

export const useOnboardingProgress = () => {
  const { user, userProfile } = useStudentAuth();

  // Campos primitivos estabilizados para evitar re-renders desnecessários
  const stableProfile = useMemo(() => ({
    has_paid_selection_process_fee: userProfile?.has_paid_selection_process_fee,
    selection_survey_passed: userProfile?.selection_survey_passed,
    documents_uploaded: userProfile?.documents_uploaded,
    documents_status: userProfile?.documents_status,
    is_application_fee_paid: userProfile?.is_application_fee_paid,
    is_scholarship_fee_paid: userProfile?.is_scholarship_fee_paid,
    is_placement_fee_paid: userProfile?.is_placement_fee_paid,
    has_paid_reinstatement_package: userProfile?.has_paid_reinstatement_package,
    onboarding_completed: userProfile?.onboarding_completed,
    placement_fee_flow: userProfile?.placement_fee_flow,
    student_process_type: userProfile?.student_process_type,
    visa_transfer_active: userProfile?.visa_transfer_active,
    selected_scholarship_id: userProfile?.selected_scholarship_id,
    onboarding_current_step: userProfile?.onboarding_current_step,
    id: userProfile?.id,
  }), [
    userProfile?.has_paid_selection_process_fee,
    userProfile?.selection_survey_passed,
    userProfile?.documents_uploaded,
    userProfile?.documents_status,
    userProfile?.is_application_fee_paid,
    userProfile?.is_scholarship_fee_paid,
    userProfile?.is_placement_fee_paid,
    userProfile?.has_paid_reinstatement_package,
    userProfile?.onboarding_completed,
    userProfile?.placement_fee_flow,
    userProfile?.student_process_type,
    userProfile?.visa_transfer_active,
    userProfile?.selected_scholarship_id,
    userProfile?.onboarding_current_step,
    userProfile?.id,
  ]);

  const lastCheckId = useRef<number>(0);
  const isSavingStepRef = useRef<boolean>(false);
  const lastManualNavRef = useRef<number>(0);
  const currentStepRef = useRef<OnboardingStep>('selection_fee');

  const [state, setState] = useState<OnboardingState>(() => {
    const savedStep = normalizeLegacyStep(userProfile?.onboarding_current_step as OnboardingStep | null);
    const initial = savedStep || 'selection_fee';
    currentStepRef.current = initial;
    return {
      currentStep: initial,
      selectionFeePaid: userProfile?.has_paid_selection_process_fee || false,
      selectionSurveyPassed: userProfile?.selection_survey_passed || false,
      contractApproved: false,
      scholarshipsSelected: false,
      processTypeSelected: false,
      documentsUploaded: userProfile?.documents_uploaded || false,
      documentsApproved: userProfile?.documents_status === 'approved',
      applicationFeePaid: userProfile?.is_application_fee_paid || false,
      complementaryDataSubmitted: false,
      scholarshipFeePaid: userProfile?.is_scholarship_fee_paid || false,
      placementFeePaid: userProfile?.is_placement_fee_paid || false,
      reinstatementFeePaid: userProfile?.has_paid_reinstatement_package || false,
      universityDocumentsUploaded: false,
      onboardingCompleted: userProfile?.onboarding_completed || false,
      migmaCheckoutCompleted: !!userProfile?.migma_checkout_completed_at,
      isNewFlowUser: true, // Migma: sempre placement_fee_flow = true
      surveyCompletedAt: null,
    };
  });

  const [loading, setLoading] = useState(true);

  // Persiste o step no banco do Matricula USA
  const saveStep = useCallback(async (step: OnboardingStep) => {
    if (!user?.id) return;
    isSavingStepRef.current = true;
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ onboarding_current_step: step })
        .eq('user_id', user.id);
      if (error) throw error;
    } catch (err: unknown) {
      console.error('[OnboardingHook] ❌ Erro ao salvar step:', err instanceof Error ? err.message : err);
    } finally {
      setTimeout(() => { isSavingStepRef.current = false; }, 1200);
    }
  }, [user?.id]);

  const goToStep = useCallback((step: OnboardingStep) => {
    lastManualNavRef.current = Date.now();
    currentStepRef.current = step;
    setState(prev => ({ ...prev, currentStep: step }));
    saveStep(step);
  }, [saveStep]);

  // Função mestre de verificação — lê direto do banco do Matricula USA
  const checkProgress = useCallback(async () => {
    if (!user?.id) {
      if (loading) setLoading(false);
      return;
    }

    const now = Date.now();
    if (isSavingStepRef.current || (now - lastManualNavRef.current < 1500)) {
      if (loading) setLoading(false);
      return;
    }

    const currentCheckId = ++lastCheckId.current;

    try {
      // Leitura fresca do banco do Matricula USA
      const { data: freshData, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError || !freshData) {
        console.warn('[OnboardingHook] Perfil inacessível:', profileError);
        // Profile doesn't exist in Matricula USA yet (new Migma student) —
        // force step 1 so the student always starts at selection_fee
        currentStepRef.current = 'selection_fee';
        setState(prev => ({ ...prev, currentStep: 'selection_fee', selectionFeePaid: false }));
        if (loading) setLoading(false);
        return;
      }

      const freshProfile = freshData;
      const studentId = freshProfile.id; // profile_id (PK)

      if (!studentId) {
        if (loading) setLoading(false);
        return;
      }

      // Flags do perfil
      const selectionFeePaid = !!freshProfile.has_paid_selection_process_fee;
      const selectionSurveyPassed = !!freshProfile.selection_survey_passed;
      const surveyCompletedAt: string | null = freshProfile.selection_survey_completed_at ?? null;

      // Verifica aprovação do contrato ou anexo na tabela visa_orders (Migma DB)
      let contractApproved = false;
      if (selectionSurveyPassed && freshProfile.email) {
        const { data: orderData } = await supabase
          .from('visa_orders')
          .select('contract_approval_status, annex_approval_status')
          .eq('client_email', freshProfile.email)
          .or('contract_approval_status.eq.approved,annex_approval_status.eq.approved')
          .limit(1)
          .maybeSingle();
        contractApproved = !!orderData;
      }

      const { data: v11AppsData } = await supabase
        .from('institution_applications')
        .select('id, status, institution_id, scholarship_level_id, package_status')
        .eq('profile_id', studentId);

      // Cart de bolsas / Seleção realizada
      let scholarshipsSelected = false;
      let scholarshipsApproved = false;
      if (selectionFeePaid) {
        await applicationStore.fetchCart(user.id);
        const currentCart = useCartStore.getState().cart;
        
        const hasV11Apps = v11AppsData && v11AppsData.length > 0;
        
        scholarshipsSelected = !!(
          currentCart.length > 0 ||
          hasV11Apps ||
          !!freshProfile.selected_scholarship_id
        );

        scholarshipsApproved = hasV11Apps && v11AppsData!.some(a => 
          ['approved', 'payment_pending', 'payment_confirmed', 'accepted'].includes(a.status)
        );
      }

      // Tipo de processo
      const processTypeSelected = !!freshProfile.service_type || scholarshipsSelected || (freshProfile.documents_uploaded || false);

      const documentsUploaded = freshProfile.documents_uploaded || false;
      const documentsApproved = freshProfile.documents_status === 'approved';
      const applicationFeePaid = freshProfile.is_application_fee_paid || false;

      // Check if complementary data has been submitted
      let complementaryDataSubmitted = false;
      if (applicationFeePaid && studentId) {
        const { data: compData } = await supabase
          .from('student_complementary_data')
          .select('id')
          .eq('profile_id', studentId)
          .maybeSingle();
        complementaryDataSubmitted = !!compData;
      }

      // Migma: placement_fee_flow sempre true
      const isNewFlowUser = true;
      const scholarshipFeePaid = !!freshProfile.is_scholarship_fee_paid;
      const placementFeePaid = !!freshProfile.is_placement_fee_paid ||
        !!(v11AppsData?.some((a) => a.status === 'payment_confirmed'));
      const reinstatementFeePaid = !!freshProfile.has_paid_reinstatement_package;
      const onboardingCompleted = !!freshProfile.onboarding_completed;

      // Migma Logic: Se for Migma, precisa ter concluído o Step 3 para sair do selection_fee
      const isMigma = freshProfile.source === 'migma';
      const migmaCheckoutCompleted = !!freshProfile.migma_checkout_completed_at;

      // Calcula o step máximo permitido
      let maxAllowedStep: OnboardingStep = 'selection_fee';

      if (isMigma && !migmaCheckoutCompleted) {
        maxAllowedStep = 'selection_fee';
      } else if (!selectionFeePaid) {
        maxAllowedStep = 'selection_fee';
      } else if (!selectionSurveyPassed) {
        maxAllowedStep = 'selection_survey';
      } else if (!contractApproved) {
        maxAllowedStep = 'wait_room';
      } else if (!scholarshipsSelected || !scholarshipsApproved) {
        // Must have selected AND at least one must be approved to advance
        maxAllowedStep = 'scholarship_selection';
      } else if (!placementFeePaid) {
        maxAllowedStep = 'placement_fee';
      } else if (!documentsUploaded) {
        maxAllowedStep = 'documents_upload';
      } else if (!applicationFeePaid) {
        maxAllowedStep = 'payment';
      } else if (!complementaryDataSubmitted) {
        maxAllowedStep = 'dados_complementares';
      } else {
        // Avança para acceptance_letter quando pacote foi enviado ao MatriculaUSA
        const packageReady = v11AppsData?.some((a) => a.package_status === 'ready');
        maxAllowedStep = packageReady ? 'acceptance_letter' : 'my_applications';
      }

      // Decisão final do step
      const uiStep = normalizeLegacyStep(currentStepRef.current) ?? 'selection_fee';
      const savedStep = normalizeLegacyStep(freshProfile.onboarding_current_step as OnboardingStep | null) ?? 'selection_fee';
      const uiIdx = VALID_STEPS.indexOf(uiStep);
      const maxIdx = VALID_STEPS.indexOf(maxAllowedStep);

      // Always advance to maxAllowedStep — ensures student is pushed forward
      // when a step is completed externally (e.g. admin approves scholarship).
      let chosenStep: OnboardingStep;
      if (onboardingCompleted) {
        chosenStep = 'completed';
      } else if (uiIdx > maxIdx) {
        // Student somehow got ahead of what's allowed — push back
        chosenStep = maxAllowedStep;
      } else {
        // Always move to the furthest allowed step
        chosenStep = maxAllowedStep;
      }

      if (currentCheckId !== lastCheckId.current) return;

      currentStepRef.current = chosenStep;
      setState({
        currentStep: chosenStep,
        selectionFeePaid,
        selectionSurveyPassed,
        contractApproved,
        scholarshipsSelected,
        processTypeSelected,
        documentsUploaded,
        documentsApproved,
        applicationFeePaid,
        complementaryDataSubmitted,
        scholarshipFeePaid,
        placementFeePaid,
        reinstatementFeePaid,
        universityDocumentsUploaded: false,
        onboardingCompleted,
        migmaCheckoutCompleted,
        isNewFlowUser,
        surveyCompletedAt,
      });

      if (chosenStep !== savedStep) {
        saveStep(chosenStep);
      }

    } catch (error) {
      console.error('[OnboardingHook] Erro ao verificar progresso:', error);
    } finally {
      if (currentCheckId === lastCheckId.current) {
        setLoading(false);
      }
    }
  }, [user?.id, stableProfile, loading, saveStep]);

  useEffect(() => {
    checkProgress();
  }, [checkProgress]);

  const markStepComplete = useCallback(async () => {
    await checkProgress();
  }, [checkProgress]);

  return { state, loading, checkProgress, goToStep, markStepComplete };
};
