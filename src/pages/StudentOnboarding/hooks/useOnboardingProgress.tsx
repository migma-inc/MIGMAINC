import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useStudentAuth } from '../../../contexts/StudentAuthContext';
import { matriculaSupabase } from '../../../lib/matriculaSupabase';
import { applicationStore, useCartStore } from '../../../stores/applicationStore';
import type { OnboardingStep, OnboardingState } from '../types';

const VALID_STEPS: OnboardingStep[] = [
  'selection_fee', 'identity_verification', 'selection_survey',
  'scholarship_selection', 'process_type', 'documents_upload',
  'payment', 'scholarship_fee', 'placement_fee', 'reinstatement_fee', 'my_applications', 'completed'
];

export const useOnboardingProgress = () => {
  const { user, userProfile } = useStudentAuth();

  // Campos primitivos estabilizados para evitar re-renders desnecessários
  const stableProfile = useMemo(() => ({
    has_paid_selection_process_fee: userProfile?.has_paid_selection_process_fee,
    selection_survey_passed: userProfile?.selection_survey_passed,
    identity_verified: userProfile?.identity_verified,
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
    userProfile?.identity_verified,
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
    const savedStep = userProfile?.onboarding_current_step;
    const initial = (savedStep as OnboardingStep) || 'selection_fee';
    currentStepRef.current = initial;
    return {
      currentStep: initial,
      selectionFeePaid: userProfile?.has_paid_selection_process_fee || false,
      identityVerified: userProfile?.identity_verified || false,
      selectionSurveyPassed: userProfile?.selection_survey_passed || false,
      scholarshipsSelected: false,
      processTypeSelected: false,
      documentsUploaded: userProfile?.documents_uploaded || false,
      documentsApproved: userProfile?.documents_status === 'approved',
      applicationFeePaid: userProfile?.is_application_fee_paid || false,
      scholarshipFeePaid: userProfile?.is_scholarship_fee_paid || false,
      placementFeePaid: userProfile?.is_placement_fee_paid || false,
      reinstatementFeePaid: userProfile?.has_paid_reinstatement_package || false,
      universityDocumentsUploaded: false,
      onboardingCompleted: userProfile?.onboarding_completed || false,
      isNewFlowUser: true, // Migma: sempre placement_fee_flow = true
    };
  });

  const [loading, setLoading] = useState(true);

  // Persiste o step no banco do Matricula USA
  const saveStep = useCallback(async (step: OnboardingStep) => {
    if (!user?.id) return;
    isSavingStepRef.current = true;
    try {
      const { error } = await matriculaSupabase
        .from('user_profiles')
        .update({ onboarding_current_step: step })
        .eq('user_id', user.id);
      if (error) throw error;
    } catch (err: any) {
      console.error('[OnboardingHook] ❌ Erro ao salvar step:', err?.message);
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
      let { data: freshData, error: profileError } = await matriculaSupabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError || !freshData) {
        console.warn('[OnboardingHook] Perfil inacessível:', profileError);
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

      // Verificação de identidade
      let identityVerified = !!freshProfile.identity_verified;
      if (!identityVerified) {
        const { data: photoAcceptance } = await matriculaSupabase
          .from('comprehensive_term_acceptance')
          .select('identity_photo_path')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        identityVerified = !!photoAcceptance?.identity_photo_path;
      }

      // Candidaturas
      const { data: appsData } = await matriculaSupabase
        .from('scholarship_applications')
        .select('id, scholarship_id, student_process_type, is_application_fee_paid')
        .eq('student_id', studentId);

      // Cart de bolsas
      let scholarshipsSelected = false;
      if (selectionFeePaid) {
        await applicationStore.fetchCart(user.id);
        const currentCart = useCartStore.getState().cart;
        scholarshipsSelected = !!(
          currentCart.length > 0 ||
          (appsData && appsData.length > 0) ||
          !!freshProfile.selected_scholarship_id
        );
      }

      // Tipo de processo
      const processTypeSelected =
        (appsData && appsData.length > 0 && !!appsData[0].student_process_type) ||
        (freshProfile.student_process_type && ['initial', 'transfer', 'change_of_status', 'resident'].includes(freshProfile.student_process_type)) ||
        (freshProfile.documents_uploaded || false);

      const documentsUploaded = freshProfile.documents_uploaded || false;
      const documentsApproved = freshProfile.documents_status === 'approved';
      const applicationFeePaid = (appsData?.some((a: any) => a.is_application_fee_paid)) || freshProfile.is_application_fee_paid || false;

      // Migma: placement_fee_flow sempre true
      const isNewFlowUser = true;
      const scholarshipFeePaid = !!freshProfile.is_scholarship_fee_paid;
      const placementFeePaid = !!freshProfile.is_placement_fee_paid;
      const reinstatementFeePaid = !!freshProfile.has_paid_reinstatement_package;
      const onboardingCompleted = !!freshProfile.onboarding_completed;
      const isTransferInactive = freshProfile.student_process_type === 'transfer' && freshProfile.visa_transfer_active === false;

      // Calcula o step máximo permitido
      let maxAllowedStep: OnboardingStep = 'selection_fee';
      if (!selectionFeePaid) maxAllowedStep = 'selection_fee';
      else if (!identityVerified) maxAllowedStep = 'identity_verification';
      else if (!selectionSurveyPassed) maxAllowedStep = 'selection_survey';
      else if (!scholarshipsSelected) maxAllowedStep = 'scholarship_selection';
      else if (!processTypeSelected) maxAllowedStep = 'process_type';
      else if (!documentsUploaded) maxAllowedStep = 'documents_upload';
      else if (!applicationFeePaid) maxAllowedStep = 'payment';
      else if (!placementFeePaid) maxAllowedStep = 'placement_fee'; // Migma: sempre placement
      else if (isTransferInactive && !reinstatementFeePaid) maxAllowedStep = 'reinstatement_fee';
      else maxAllowedStep = 'my_applications';

      // Decisão final do step
      const uiStep = currentStepRef.current;
      const savedStep = (freshProfile.onboarding_current_step as OnboardingStep) || 'selection_fee';
      const uiIdx = VALID_STEPS.indexOf(uiStep);
      const maxIdx = VALID_STEPS.indexOf(maxAllowedStep);
      const savedIdx = VALID_STEPS.indexOf(savedStep);

      let chosenStep: OnboardingStep;
      if (onboardingCompleted) {
        chosenStep = 'completed';
      } else if (uiIdx !== -1 && uiIdx <= maxIdx && uiIdx >= savedIdx) {
        chosenStep = uiStep;
      } else if (uiIdx > maxIdx) {
        chosenStep = maxAllowedStep;
      } else {
        chosenStep = (savedIdx <= maxIdx) ? savedStep : maxAllowedStep;
      }

      if (currentCheckId !== lastCheckId.current) return;

      currentStepRef.current = chosenStep;
      setState({
        currentStep: chosenStep,
        selectionFeePaid,
        identityVerified,
        selectionSurveyPassed,
        scholarshipsSelected,
        processTypeSelected,
        documentsUploaded,
        documentsApproved,
        applicationFeePaid,
        scholarshipFeePaid,
        placementFeePaid,
        reinstatementFeePaid,
        universityDocumentsUploaded: false,
        onboardingCompleted,
        isNewFlowUser,
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
