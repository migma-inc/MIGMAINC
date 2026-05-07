-- Let active mentors preview/download storage files for students assigned to
-- them, while keeping onboarding document rows read-only for mentors.

CREATE OR REPLACE FUNCTION private.mentor_can_access_profile_user_text(p_user_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.user_id::text = p_user_id
      AND up.mentor_id = private.current_active_mentor_profile_id()
  )
$$;

CREATE OR REPLACE FUNCTION private.mentor_can_access_contract_storage_object(p_object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.visa_orders vo
    INNER JOIN public.user_profiles up
      ON lower(up.email) = lower(vo.client_email)
    WHERE up.mentor_id = private.current_active_mentor_profile_id()
      AND (
        split_part(split_part(coalesce(vo.contract_pdf_url, ''), '/contracts/', 2), '?', 1) = p_object_name
        OR split_part(split_part(coalesce(vo.annex_pdf_url, ''), '/contracts/', 2), '?', 1) = p_object_name
      )
  )
$$;

REVOKE ALL ON FUNCTION private.mentor_can_access_profile_user_text(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.mentor_can_access_contract_storage_object(text) FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.mentor_can_access_profile_user_text(text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.mentor_can_access_contract_storage_object(text) TO authenticated;

DROP POLICY IF EXISTS "Mentors can manage assigned student documents" ON public.student_documents;
DROP POLICY IF EXISTS "Mentors can read assigned student documents" ON public.student_documents;
CREATE POLICY "Mentors can read assigned student documents"
  ON public.student_documents
  FOR SELECT
  TO authenticated
  USING (private.mentor_can_access_profile_user(user_id));

DROP POLICY IF EXISTS "Mentors can read assigned migma student document objects" ON storage.objects;
CREATE POLICY "Mentors can read assigned migma student document objects"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'migma-student-documents'
    AND private.mentor_can_access_profile_user_text((storage.foldername(name))[1])
  );

DROP POLICY IF EXISTS "Mentors can read assigned visa signature objects" ON storage.objects;
CREATE POLICY "Mentors can read assigned visa signature objects"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'visa-signatures'
    AND private.mentor_can_access_profile_user_text((storage.foldername(name))[1])
  );

DROP POLICY IF EXISTS "Mentors can read assigned contract objects" ON storage.objects;
CREATE POLICY "Mentors can read assigned contract objects"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'contracts'
    AND private.mentor_can_access_contract_storage_object(name)
  );
