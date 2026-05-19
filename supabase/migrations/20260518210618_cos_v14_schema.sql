-- COS v14 local schema.
-- This migration is intentionally local-only until explicitly approved for a remote environment.

CREATE OR REPLACE FUNCTION public.cos_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.cos_set_updated_at() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cos_set_updated_at() TO authenticated;

CREATE TABLE IF NOT EXISTS public.cos_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  service_request_id uuid REFERENCES public.service_requests(id) ON DELETE SET NULL,
  institution_application_id uuid REFERENCES public.institution_applications(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'blocked',
  submission_method text NOT NULL DEFAULT 'undecided',
  current_step text NOT NULL DEFAULT 'i539',
  has_dependents boolean NOT NULL DEFAULT false,
  i94_expiry_date date,
  unlocked_at timestamptz,
  documents_generated_at timestamptz,
  submitted_to_uscis_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cos_cases_profile_id_unique UNIQUE (profile_id),
  CONSTRAINT cos_cases_status_check CHECK (status IN ('blocked', 'in_progress', 'documents_generated', 'submitted_to_uscis', 'completed', 'cancelled')),
  CONSTRAINT cos_cases_submission_method_check CHECK (submission_method IN ('undecided', 'online', 'mail')),
  CONSTRAINT cos_cases_current_step_check CHECK (current_step IN ('i539', 'i539a', 'uscis_letter', 'checklist', 'submission_method', 'generation_submission'))
);

CREATE INDEX IF NOT EXISTS idx_cos_cases_profile_id ON public.cos_cases(profile_id);
CREATE INDEX IF NOT EXISTS idx_cos_cases_service_request_id ON public.cos_cases(service_request_id) WHERE service_request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cos_cases_institution_application_id ON public.cos_cases(institution_application_id) WHERE institution_application_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cos_cases_status ON public.cos_cases(status);

DROP TRIGGER IF EXISTS trg_cos_cases_updated_at ON public.cos_cases;
CREATE TRIGGER trg_cos_cases_updated_at
  BEFORE UPDATE ON public.cos_cases
  FOR EACH ROW
  EXECUTE FUNCTION public.cos_set_updated_at();

CREATE TABLE IF NOT EXISTS public.cos_i20_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cos_case_id uuid NOT NULL REFERENCES public.cos_cases(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  institution_application_id uuid REFERENCES public.institution_applications(id) ON DELETE SET NULL,
  school_name text NOT NULL,
  sevis_id text NOT NULL,
  issued_at date NOT NULL,
  program_start_date date NOT NULL,
  total_cost_usd numeric(12,2) NOT NULL,
  file_path text,
  file_url text,
  recorded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cos_i20_records_case_unique UNIQUE (cos_case_id),
  CONSTRAINT cos_i20_records_profile_case_unique UNIQUE (profile_id, cos_case_id),
  CONSTRAINT cos_i20_records_total_cost_check CHECK (total_cost_usd >= 0)
);

CREATE INDEX IF NOT EXISTS idx_cos_i20_records_profile_id ON public.cos_i20_records(profile_id);
CREATE INDEX IF NOT EXISTS idx_cos_i20_records_institution_application_id ON public.cos_i20_records(institution_application_id) WHERE institution_application_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cos_i20_records_sevis_id ON public.cos_i20_records(sevis_id);

DROP TRIGGER IF EXISTS trg_cos_i20_records_updated_at ON public.cos_i20_records;
CREATE TRIGGER trg_cos_i20_records_updated_at
  BEFORE UPDATE ON public.cos_i20_records
  FOR EACH ROW
  EXECUTE FUNCTION public.cos_set_updated_at();

CREATE TABLE IF NOT EXISTS public.cos_dependents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cos_case_id uuid NOT NULL REFERENCES public.cos_cases(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  relationship text NOT NULL,
  date_of_birth date,
  country_of_birth text,
  country_of_citizenship text,
  current_nonimmigrant_status text,
  sevis_id text,
  i539a_required boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cos_dependents_relationship_check CHECK (relationship IN ('spouse', 'child', 'other'))
);

CREATE INDEX IF NOT EXISTS idx_cos_dependents_case_id ON public.cos_dependents(cos_case_id);
CREATE INDEX IF NOT EXISTS idx_cos_dependents_profile_id ON public.cos_dependents(profile_id);

DROP TRIGGER IF EXISTS trg_cos_dependents_updated_at ON public.cos_dependents;
CREATE TRIGGER trg_cos_dependents_updated_at
  BEFORE UPDATE ON public.cos_dependents
  FOR EACH ROW
  EXECUTE FUNCTION public.cos_set_updated_at();

CREATE TABLE IF NOT EXISTS public.cos_form_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_type text NOT NULL,
  uscis_form_id text NOT NULL,
  edition_date date NOT NULL,
  expires_at date,
  source_url text,
  template_storage_path text,
  is_current boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cos_form_versions_form_type_check CHECK (form_type IN ('i539', 'i539a'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cos_form_versions_current_unique
  ON public.cos_form_versions(form_type)
  WHERE is_current;

DROP TRIGGER IF EXISTS trg_cos_form_versions_updated_at ON public.cos_form_versions;
CREATE TRIGGER trg_cos_form_versions_updated_at
  BEFORE UPDATE ON public.cos_form_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.cos_set_updated_at();

CREATE TABLE IF NOT EXISTS public.cos_form_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cos_case_id uuid NOT NULL REFERENCES public.cos_cases(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  dependent_id uuid REFERENCES public.cos_dependents(id) ON DELETE CASCADE,
  form_type text NOT NULL,
  section_key text NOT NULL,
  responses_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  completion_status text NOT NULL DEFAULT 'not_started',
  autosaved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cos_form_responses_form_type_check CHECK (form_type IN ('i539', 'i539a', 'uscis_letter', 'checklist', 'submission')),
  CONSTRAINT cos_form_responses_completion_status_check CHECK (completion_status IN ('not_started', 'in_progress', 'completed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cos_form_responses_unique_section
  ON public.cos_form_responses(cos_case_id, form_type, section_key, COALESCE(dependent_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX IF NOT EXISTS idx_cos_form_responses_profile_id ON public.cos_form_responses(profile_id);
CREATE INDEX IF NOT EXISTS idx_cos_form_responses_dependent_id ON public.cos_form_responses(dependent_id) WHERE dependent_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_cos_form_responses_updated_at ON public.cos_form_responses;
CREATE TRIGGER trg_cos_form_responses_updated_at
  BEFORE UPDATE ON public.cos_form_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.cos_set_updated_at();

CREATE TABLE IF NOT EXISTS public.cos_document_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cos_case_id uuid NOT NULL REFERENCES public.cos_cases(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  dependent_id uuid REFERENCES public.cos_dependents(id) ON DELETE CASCADE,
  item_key text NOT NULL,
  label text NOT NULL,
  category text NOT NULL,
  required boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'pending',
  storage_path text,
  file_url text,
  file_name text,
  mime_type text,
  file_size_bytes bigint,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  rejection_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cos_document_checklist_category_check CHECK (category IN ('applicant', 'dependent', 'evidence', 'uscis', 'internal')),
  CONSTRAINT cos_document_checklist_status_check CHECK (status IN ('pending', 'uploaded', 'approved', 'rejected', 'not_applicable'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cos_document_checklist_unique_item
  ON public.cos_document_checklist(cos_case_id, item_key, COALESCE(dependent_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX IF NOT EXISTS idx_cos_document_checklist_profile_id ON public.cos_document_checklist(profile_id);
CREATE INDEX IF NOT EXISTS idx_cos_document_checklist_status ON public.cos_document_checklist(status);

DROP TRIGGER IF EXISTS trg_cos_document_checklist_updated_at ON public.cos_document_checklist;
CREATE TRIGGER trg_cos_document_checklist_updated_at
  BEFORE UPDATE ON public.cos_document_checklist
  FOR EACH ROW
  EXECUTE FUNCTION public.cos_set_updated_at();

CREATE TABLE IF NOT EXISTS public.cos_generated_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cos_case_id uuid NOT NULL REFERENCES public.cos_cases(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  form_version_id uuid REFERENCES public.cos_form_versions(id) ON DELETE SET NULL,
  document_type text NOT NULL,
  submission_method text NOT NULL,
  storage_path text NOT NULL,
  file_url text,
  file_name text NOT NULL,
  mime_type text NOT NULL DEFAULT 'application/pdf',
  has_migma_branding boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'generated',
  generated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cos_generated_documents_type_check CHECK (document_type IN ('i539', 'i539a', 'uscis_letter', 'internal_summary', 'myuscis_guide', 'checklist', 'package')),
  CONSTRAINT cos_generated_documents_submission_method_check CHECK (submission_method IN ('online', 'mail', 'internal')),
  CONSTRAINT cos_generated_documents_status_check CHECK (status IN ('generated', 'superseded', 'submitted', 'void'))
);

CREATE INDEX IF NOT EXISTS idx_cos_generated_documents_case_id ON public.cos_generated_documents(cos_case_id);
CREATE INDEX IF NOT EXISTS idx_cos_generated_documents_profile_id ON public.cos_generated_documents(profile_id);
CREATE INDEX IF NOT EXISTS idx_cos_generated_documents_type ON public.cos_generated_documents(document_type);

DROP TRIGGER IF EXISTS trg_cos_generated_documents_updated_at ON public.cos_generated_documents;
CREATE TRIGGER trg_cos_generated_documents_updated_at
  BEFORE UPDATE ON public.cos_generated_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.cos_set_updated_at();

ALTER TABLE public.cos_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cos_i20_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cos_dependents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cos_form_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cos_form_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cos_document_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cos_generated_documents ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.cos_form_versions TO authenticated;
GRANT SELECT ON public.cos_cases, public.cos_i20_records, public.cos_generated_documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cos_dependents TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.cos_form_responses, public.cos_document_checklist TO authenticated;

CREATE POLICY "Students can view their own COS cases"
  ON public.cos_cases
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = cos_cases.profile_id
        AND up.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage COS cases"
  ON public.cos_cases
  FOR ALL
  TO authenticated
  USING (COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('admin', 'superadmin', 'super_admin'))
  WITH CHECK (COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('admin', 'superadmin', 'super_admin'));

CREATE POLICY "Students can view their own COS I-20 records"
  ON public.cos_i20_records
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = cos_i20_records.profile_id
        AND up.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage COS I-20 records"
  ON public.cos_i20_records
  FOR ALL
  TO authenticated
  USING (COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('admin', 'superadmin', 'super_admin'))
  WITH CHECK (COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('admin', 'superadmin', 'super_admin'));

CREATE POLICY "Students can manage their own COS dependents"
  ON public.cos_dependents
  FOR ALL
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = cos_dependents.profile_id
        AND up.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = cos_dependents.profile_id
        AND up.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage COS dependents"
  ON public.cos_dependents
  FOR ALL
  TO authenticated
  USING (COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('admin', 'superadmin', 'super_admin'))
  WITH CHECK (COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('admin', 'superadmin', 'super_admin'));

CREATE POLICY "Authenticated users can view COS form versions"
  ON public.cos_form_versions
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage COS form versions"
  ON public.cos_form_versions
  FOR ALL
  TO authenticated
  USING (COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('admin', 'superadmin', 'super_admin'))
  WITH CHECK (COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('admin', 'superadmin', 'super_admin'));

CREATE POLICY "Students can manage their own COS form responses"
  ON public.cos_form_responses
  FOR ALL
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = cos_form_responses.profile_id
        AND up.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = cos_form_responses.profile_id
        AND up.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage COS form responses"
  ON public.cos_form_responses
  FOR ALL
  TO authenticated
  USING (COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('admin', 'superadmin', 'super_admin'))
  WITH CHECK (COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('admin', 'superadmin', 'super_admin'));

CREATE POLICY "Students can view their own COS checklist"
  ON public.cos_document_checklist
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = cos_document_checklist.profile_id
        AND up.user_id = auth.uid()
    )
  );

CREATE POLICY "Students can upload their own COS checklist documents"
  ON public.cos_document_checklist
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = cos_document_checklist.profile_id
        AND up.user_id = auth.uid()
    )
  )
  WITH CHECK (
    status IN ('pending', 'uploaded')
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = cos_document_checklist.profile_id
        AND up.user_id = auth.uid()
    )
  );

CREATE POLICY "Students can insert their own COS checklist placeholders"
  ON public.cos_document_checklist
  FOR INSERT
  TO authenticated
  WITH CHECK (
    status IN ('pending', 'uploaded')
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = cos_document_checklist.profile_id
        AND up.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage COS checklist"
  ON public.cos_document_checklist
  FOR ALL
  TO authenticated
  USING (COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('admin', 'superadmin', 'super_admin'))
  WITH CHECK (COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('admin', 'superadmin', 'super_admin'));

CREATE POLICY "Students can view their own generated COS documents"
  ON public.cos_generated_documents
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = cos_generated_documents.profile_id
        AND up.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage generated COS documents"
  ON public.cos_generated_documents
  FOR ALL
  TO authenticated
  USING (COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('admin', 'superadmin', 'super_admin'))
  WITH CHECK (COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('admin', 'superadmin', 'super_admin'));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cos-documents',
  'cos-documents',
  false,
  20971520,
  ARRAY['application/pdf', 'image/jpeg', 'image/png']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Students can read own COS storage objects" ON storage.objects;
CREATE POLICY "Students can read own COS storage objects"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'cos-documents'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id::text = (storage.foldername(name))[1]
        AND up.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Students can upload own COS storage objects" ON storage.objects;
CREATE POLICY "Students can upload own COS storage objects"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'cos-documents'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id::text = (storage.foldername(name))[1]
        AND up.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Students can update own COS storage objects" ON storage.objects;
CREATE POLICY "Students can update own COS storage objects"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'cos-documents'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id::text = (storage.foldername(name))[1]
        AND up.user_id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'cos-documents'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id::text = (storage.foldername(name))[1]
        AND up.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can manage COS storage objects" ON storage.objects;
CREATE POLICY "Admins can manage COS storage objects"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id = 'cos-documents'
    AND COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('admin', 'superadmin', 'super_admin')
  )
  WITH CHECK (
    bucket_id = 'cos-documents'
    AND COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('admin', 'superadmin', 'super_admin')
  );

COMMENT ON TABLE public.cos_cases IS 'COS v14 case state for the student dashboard Change of Status module.';
COMMENT ON TABLE public.cos_i20_records IS 'Admin-registered I-20 records that unlock COS workflow for a student.';
COMMENT ON TABLE public.cos_dependents IS 'Dependents tied to a COS case; each dependent generally requires I-539A for mail submission.';
COMMENT ON TABLE public.cos_form_versions IS 'Official USCIS form version registry used when generating COS PDFs.';
COMMENT ON TABLE public.cos_form_responses IS 'Autosaved neutral responses used to fill I-539, I-539A and COS supporting documents.';
COMMENT ON TABLE public.cos_document_checklist IS 'COS checklist items, uploads and admin review status.';
COMMENT ON TABLE public.cos_generated_documents IS 'Generated COS PDF outputs and package artifacts.';
COMMENT ON COLUMN public.cos_generated_documents.has_migma_branding IS 'Must remain false for PDFs submitted to USCIS; internal guides/summaries may opt in later.';
