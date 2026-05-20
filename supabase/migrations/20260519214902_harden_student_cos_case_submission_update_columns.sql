CREATE OR REPLACE FUNCTION public.prevent_student_cos_case_unsafe_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  jwt_role text := COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '');
BEGIN
  IF jwt_role IN ('admin', 'superadmin', 'super_admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.profile_id IS DISTINCT FROM OLD.profile_id
    OR NEW.service_request_id IS DISTINCT FROM OLD.service_request_id
    OR NEW.institution_application_id IS DISTINCT FROM OLD.institution_application_id
    OR NEW.status IS DISTINCT FROM OLD.status
    OR NEW.has_dependents IS DISTINCT FROM OLD.has_dependents
    OR NEW.i94_expiry_date IS DISTINCT FROM OLD.i94_expiry_date
    OR NEW.unlocked_at IS DISTINCT FROM OLD.unlocked_at
    OR NEW.documents_generated_at IS DISTINCT FROM OLD.documents_generated_at
    OR NEW.submitted_to_uscis_at IS DISTINCT FROM OLD.submitted_to_uscis_at
    OR NEW.metadata IS DISTINCT FROM OLD.metadata
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Students can only update COS submission path fields';
  END IF;

  IF OLD.has_dependents IS TRUE AND NEW.submission_method <> 'mail' THEN
    RAISE EXCEPTION 'COS cases with dependents must use mail submission';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_student_cos_case_unsafe_update ON public.cos_cases;
CREATE TRIGGER trg_prevent_student_cos_case_unsafe_update
  BEFORE UPDATE ON public.cos_cases
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_student_cos_case_unsafe_update();
