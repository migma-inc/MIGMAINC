export type OnboardingStep =
  | 'selection_fee'
  | 'selection_survey'
  | 'wait_room'
  | 'scholarship_selection'
  | 'process_type'
  | 'documents_upload'
  | 'payment'
  | 'scholarship_fee'
  | 'placement_fee'
  | 'reinstatement_fee'
  | 'my_applications'
  | 'acceptance_letter'
  | 'completed';

export interface OnboardingState {
  currentStep: OnboardingStep;
  selectionFeePaid: boolean;
  selectionSurveyPassed: boolean;
  contractApproved: boolean;
  scholarshipsSelected: boolean;
  processTypeSelected: boolean;
  documentsUploaded: boolean;
  documentsApproved: boolean;
  applicationFeePaid: boolean;
  scholarshipFeePaid: boolean;
  placementFeePaid: boolean;
  reinstatementFeePaid: boolean;
  universityDocumentsUploaded: boolean;
  onboardingCompleted: boolean;
  migmaCheckoutCompleted: boolean;
  isNewFlowUser: boolean; // sempre true para Migma
  surveyCompletedAt: string | null;
}

export interface OnboardingProgress {
  step: OnboardingStep;
  completed: boolean;
  canProceed: boolean;
  message?: string;
}

export type ProcessType = 'initial' | 'transfer' | 'change_of_status' | 'resident';

export interface StepProps {
  onNext: () => void;
  onBack: () => void;
  onComplete?: () => void;
  currentStep?: OnboardingStep;
}
