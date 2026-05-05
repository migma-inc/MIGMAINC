-- Automatically assign paid MIGMA students to the active referral mentor with
-- the lowest current student load. Ties are broken randomly.

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.pick_least_loaded_referral_mentor()
RETURNS uuid
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT rm.profile_id
  FROM public.referral_mentors rm
  LEFT JOIN public.user_profiles assigned_student
    ON assigned_student.mentor_id = rm.profile_id
   AND assigned_student.source = 'migma'
   AND NOT EXISTS (
     SELECT 1
     FROM public.referral_mentors assigned_mentor
     WHERE assigned_mentor.profile_id = assigned_student.id
   )
  WHERE rm.active = true
  GROUP BY rm.profile_id
  ORDER BY COUNT(assigned_student.id) ASC, random()
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION private.auto_assign_referral_mentor_to_paid_student()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  selected_mentor_id uuid;
BEGIN
  IF NEW.mentor_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.source IS DISTINCT FROM 'migma' THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.has_paid_selection_process_fee, false) IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND COALESCE(OLD.has_paid_selection_process_fee, false) = COALESCE(NEW.has_paid_selection_process_fee, false) THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.referral_mentors rm
    WHERE rm.profile_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  -- Serialize concurrent payment confirmations so the "least loaded" count is
  -- evaluated after prior assignments in the same burst.
  PERFORM pg_advisory_xact_lock(hashtext('auto_assign_referral_mentor_to_paid_student'));

  selected_mentor_id := private.pick_least_loaded_referral_mentor();

  IF selected_mentor_id IS NOT NULL THEN
    NEW.mentor_id := selected_mentor_id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.pick_least_loaded_referral_mentor() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.auto_assign_referral_mentor_to_paid_student() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_auto_assign_referral_mentor_to_paid_student ON public.user_profiles;
CREATE TRIGGER trg_auto_assign_referral_mentor_to_paid_student
  BEFORE INSERT OR UPDATE OF has_paid_selection_process_fee
  ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION private.auto_assign_referral_mentor_to_paid_student();
