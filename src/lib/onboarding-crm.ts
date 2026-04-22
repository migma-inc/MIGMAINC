export interface CaseDetailPage {
  profile: {
    id: string;
    email: string | null;
    full_name: string | null;
    user_id: string | null;
    service_type: string | null;
    student_process_type: string | null;
    transfer_deadline_date: string | null;
    cos_i94_expiry_date: string | null;
    field_of_interest: string | null;
    academic_level: string | null;
    num_dependents: number | null;
    onboarding_current_step: string | null;
    selection_survey_passed: boolean | null;
    has_paid_selection_process_fee: boolean | null;
  };
}
