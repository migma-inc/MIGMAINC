alter table public.user_profiles
  drop constraint if exists user_profiles_onboarding_current_step_check;

alter table public.user_profiles
  add constraint user_profiles_onboarding_current_step_check
  check (
    onboarding_current_step is null
    or onboarding_current_step = any (
      array[
        'selection_fee'::text,
        'identity_verification'::text,
        'selection_survey'::text,
        'scholarship_selection'::text,
        'process_type'::text,
        'documents_upload'::text,
        'payment'::text,
        'scholarship_fee'::text,
        'placement_fee'::text,
        'reinstatement_fee'::text,
        'my_applications'::text,
        'completed'::text,
        'awaiting_client_data'::text,
        'welcome_email_failed'::text
      ]
    )
  );
