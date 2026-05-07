-- Migration: allow admin users to read CRM auxiliary tables
-- The service_request_* aux tables were created with service_role-only policies.
-- Admins (user_metadata.role = 'admin') need SELECT access to power the CRM hub UI.

-- service_request_events
CREATE POLICY "Admins can read service_request_events"
  ON public.service_request_events
  FOR SELECT
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- service_request_stage_history
CREATE POLICY "Admins can read service_request_stage_history"
  ON public.service_request_stage_history
  FOR SELECT
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- service_request_followups
CREATE POLICY "Admins can read service_request_followups"
  ON public.service_request_followups
  FOR SELECT
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- service_request_messages
CREATE POLICY "Admins can read service_request_messages"
  ON public.service_request_messages
  FOR SELECT
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- service_request_documents
CREATE POLICY "Admins can read service_request_documents"
  ON public.service_request_documents
  FOR SELECT
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- NOTE: service_requests does not have RLS enabled yet, so the policy below is
-- a placeholder for when T9 (RLS hardening) is executed. It is safe to register
-- it now; it will only be enforced once RLS is enabled on the table.
-- Admins can update service_requests for assignment and case_status changes.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'service_requests'
      AND policyname = 'Admins can update service_requests crm fields'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Admins can update service_requests crm fields"
        ON public.service_requests
        FOR UPDATE
        USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
        WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
    $policy$;
  END IF;
END;
$$;
