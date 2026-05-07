-- Give active referral mentors admin-like access to the assigned student's
-- detail page, while keeping mentor assignment immutable for mentors.

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.mentor_can_access_profile(p_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = p_profile_id
      AND up.mentor_id = private.current_active_mentor_profile_id()
  )
$$;

CREATE OR REPLACE FUNCTION private.mentor_can_access_profile_user(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.user_id = p_user_id
      AND up.mentor_id = private.current_active_mentor_profile_id()
  )
$$;

CREATE OR REPLACE FUNCTION private.mentor_can_access_profile_email(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE lower(up.email) = lower(p_email)
      AND up.mentor_id = private.current_active_mentor_profile_id()
  )
$$;

CREATE OR REPLACE FUNCTION private.mentor_can_access_service_request(p_service_request_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.service_requests sr
    INNER JOIN public.clients c ON c.id = sr.client_id
    INNER JOIN public.user_profiles up ON lower(up.email) = lower(c.email)
    WHERE sr.id = p_service_request_id
      AND up.mentor_id = private.current_active_mentor_profile_id()
  )
$$;

CREATE OR REPLACE FUNCTION private.mentor_can_access_support_handoff(p_handoff_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.support_handoffs sh
    WHERE sh.id = p_handoff_id
      AND private.mentor_can_access_profile(sh.profile_id)
  )
$$;

REVOKE ALL ON FUNCTION private.mentor_can_access_profile(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.mentor_can_access_profile_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.mentor_can_access_profile_email(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.mentor_can_access_service_request(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.mentor_can_access_support_handoff(uuid) FROM PUBLIC;

GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.mentor_can_access_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.mentor_can_access_profile_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.mentor_can_access_profile_email(text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.mentor_can_access_service_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.mentor_can_access_support_handoff(uuid) TO authenticated;

-- user_profiles: mentors may update assigned student fields, but cannot move
-- the student to another mentor because WITH CHECK requires mentor_id to remain
-- the current mentor's profile id.
DROP POLICY IF EXISTS "Mentors can update assigned user_profiles" ON public.user_profiles;
CREATE POLICY "Mentors can update assigned user_profiles"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (mentor_id = private.current_active_mentor_profile_id())
  WITH CHECK (mentor_id = private.current_active_mentor_profile_id());

-- Profile id based tables.
DROP POLICY IF EXISTS "Mentors can read assigned survey responses" ON public.selection_survey_responses;
CREATE POLICY "Mentors can read assigned survey responses"
  ON public.selection_survey_responses
  FOR SELECT
  TO authenticated
  USING (private.mentor_can_access_profile(profile_id));

DROP POLICY IF EXISTS "Mentors can manage assigned global document requests" ON public.global_document_requests;
CREATE POLICY "Mentors can manage assigned global document requests"
  ON public.global_document_requests
  FOR ALL
  TO authenticated
  USING (private.mentor_can_access_profile(profile_id))
  WITH CHECK (private.mentor_can_access_profile(profile_id));

DROP POLICY IF EXISTS "Mentors can manage assigned institution applications" ON public.institution_applications;
CREATE POLICY "Mentors can manage assigned institution applications"
  ON public.institution_applications
  FOR ALL
  TO authenticated
  USING (private.mentor_can_access_profile(profile_id))
  WITH CHECK (private.mentor_can_access_profile(profile_id));

DROP POLICY IF EXISTS "Mentors can manage assigned institution forms" ON public.institution_forms;
CREATE POLICY "Mentors can manage assigned institution forms"
  ON public.institution_forms
  FOR ALL
  TO authenticated
  USING (private.mentor_can_access_profile(profile_id))
  WITH CHECK (private.mentor_can_access_profile(profile_id));

DROP POLICY IF EXISTS "Mentors can read assigned recurring charges" ON public.recurring_charges;
CREATE POLICY "Mentors can read assigned recurring charges"
  ON public.recurring_charges
  FOR SELECT
  TO authenticated
  USING (private.mentor_can_access_profile(profile_id));

DROP POLICY IF EXISTS "Mentors can manage assigned support handoffs" ON public.support_handoffs;
CREATE POLICY "Mentors can manage assigned support handoffs"
  ON public.support_handoffs
  FOR ALL
  TO authenticated
  USING (private.mentor_can_access_profile(profile_id))
  WITH CHECK (private.mentor_can_access_profile(profile_id));

DROP POLICY IF EXISTS "Mentors can manage assigned support chat" ON public.support_chat_messages;
CREATE POLICY "Mentors can manage assigned support chat"
  ON public.support_chat_messages
  FOR ALL
  TO authenticated
  USING (private.mentor_can_access_profile(profile_id))
  WITH CHECK (private.mentor_can_access_profile(profile_id));

-- Auth user id based tables.
DROP POLICY IF EXISTS "Mentors can manage assigned student documents" ON public.student_documents;
CREATE POLICY "Mentors can manage assigned student documents"
  ON public.student_documents
  FOR ALL
  TO authenticated
  USING (private.mentor_can_access_profile_user(user_id))
  WITH CHECK (private.mentor_can_access_profile_user(user_id));

DROP POLICY IF EXISTS "Mentors can manage assigned identity files" ON public.identity_files;
CREATE POLICY "Mentors can manage assigned identity files"
  ON public.identity_files
  FOR ALL
  TO authenticated
  USING (private.mentor_can_access_service_request(service_request_id))
  WITH CHECK (private.mentor_can_access_service_request(service_request_id));

DROP POLICY IF EXISTS "Mentors can read assigned identity" ON public.user_identity;
CREATE POLICY "Mentors can read assigned identity"
  ON public.user_identity
  FOR SELECT
  TO authenticated
  USING (private.mentor_can_access_profile_user(user_id));

-- Service request graph.
DROP POLICY IF EXISTS "Mentors can manage assigned service requests" ON public.service_requests;
CREATE POLICY "Mentors can manage assigned service requests"
  ON public.service_requests
  FOR ALL
  TO authenticated
  USING (private.mentor_can_access_service_request(id))
  WITH CHECK (private.mentor_can_access_service_request(id));

DROP POLICY IF EXISTS "Mentors can read assigned service request events" ON public.service_request_events;
CREATE POLICY "Mentors can read assigned service request events"
  ON public.service_request_events
  FOR SELECT
  TO authenticated
  USING (private.mentor_can_access_service_request(service_request_id));

DROP POLICY IF EXISTS "Mentors can read assigned service request stage history" ON public.service_request_stage_history;
CREATE POLICY "Mentors can read assigned service request stage history"
  ON public.service_request_stage_history
  FOR SELECT
  TO authenticated
  USING (private.mentor_can_access_service_request(service_request_id));

DROP POLICY IF EXISTS "Mentors can manage assigned service request followups" ON public.service_request_followups;
CREATE POLICY "Mentors can manage assigned service request followups"
  ON public.service_request_followups
  FOR ALL
  TO authenticated
  USING (private.mentor_can_access_service_request(service_request_id))
  WITH CHECK (private.mentor_can_access_service_request(service_request_id));

DROP POLICY IF EXISTS "Mentors can read assigned service request messages" ON public.service_request_messages;
CREATE POLICY "Mentors can read assigned service request messages"
  ON public.service_request_messages
  FOR SELECT
  TO authenticated
  USING (private.mentor_can_access_service_request(service_request_id));

DROP POLICY IF EXISTS "Mentors can read assigned service request documents" ON public.service_request_documents;
CREATE POLICY "Mentors can read assigned service request documents"
  ON public.service_request_documents
  FOR SELECT
  TO authenticated
  USING (private.mentor_can_access_service_request(service_request_id));

-- Order history in the student detail page is email based.
DROP POLICY IF EXISTS "Mentors can read assigned visa orders" ON public.visa_orders;
CREATE POLICY "Mentors can read assigned visa orders"
  ON public.visa_orders
  FOR SELECT
  TO authenticated
  USING (private.mentor_can_access_profile_email(client_email));
