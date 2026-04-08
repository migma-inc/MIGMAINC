-- Migration: add transfer operational CRM backbone
-- Goal: extend service_requests with operational workflow fields and add
-- audit/follow-up/message/document tables anchored on service_request_id.

ALTER TABLE public.service_requests
  ADD COLUMN IF NOT EXISTS service_type TEXT,
  ADD COLUMN IF NOT EXISTS workflow_stage TEXT,
  ADD COLUMN IF NOT EXISTS stage_entered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS owner_user_id UUID,
  ADD COLUMN IF NOT EXISTS case_status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_client_contact_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS language TEXT,
  ADD COLUMN IF NOT EXISTS school_current TEXT,
  ADD COLUMN IF NOT EXISTS school_target TEXT,
  ADD COLUMN IF NOT EXISTS school_selected TEXT,
  ADD COLUMN IF NOT EXISTS class_start_date DATE,
  ADD COLUMN IF NOT EXISTS status_i20 TEXT,
  ADD COLUMN IF NOT EXISTS i20_expires_at DATE,
  ADD COLUMN IF NOT EXISTS status_sevis TEXT,
  ADD COLUMN IF NOT EXISTS release_sevis_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS release_sevis_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS transfer_form_status TEXT,
  ADD COLUMN IF NOT EXISTS final_guidance_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS operational_metadata JSONB DEFAULT '{}'::jsonb;

UPDATE public.service_requests
SET
  service_type = CASE
    WHEN service_id LIKE 'transfer-%' THEN 'transfer'
    WHEN service_id LIKE 'cos-%' THEN 'cos'
    WHEN service_id LIKE 'initial-%' THEN 'initial'
    ELSE service_type
  END
WHERE service_type IS NULL;

UPDATE public.service_requests
SET
  workflow_stage = COALESCE(
    workflow_stage,
    CASE
      WHEN status = 'paid' THEN 'awaiting_client_data'
      WHEN status = 'pending_payment' THEN 'case_created'
      WHEN status = 'onboarding' THEN 'awaiting_client_data'
      ELSE 'case_created'
    END
  ),
  stage_entered_at = COALESCE(stage_entered_at, updated_at, created_at, now()),
  status_i20 = COALESCE(status_i20, 'not_requested'),
  status_sevis = COALESCE(status_sevis, 'current_school'),
  transfer_form_status = COALESCE(transfer_form_status, 'not_sent'),
  case_status = COALESCE(case_status, 'active'),
  priority = COALESCE(priority, 'normal')
WHERE workflow_stage IS NULL
   OR stage_entered_at IS NULL
   OR status_i20 IS NULL
   OR status_sevis IS NULL
   OR transfer_form_status IS NULL
   OR case_status IS NULL
   OR priority IS NULL;

ALTER TABLE public.service_requests
  DROP CONSTRAINT IF EXISTS service_requests_priority_check;

ALTER TABLE public.service_requests
  ADD CONSTRAINT service_requests_priority_check
  CHECK (priority IN ('low', 'normal', 'high', 'urgent'));

ALTER TABLE public.service_requests
  DROP CONSTRAINT IF EXISTS service_requests_case_status_check;

ALTER TABLE public.service_requests
  ADD CONSTRAINT service_requests_case_status_check
  CHECK (case_status IN ('active', 'completed', 'cancelled', 'blocked'));

ALTER TABLE public.service_requests
  DROP CONSTRAINT IF EXISTS service_requests_status_i20_check;

ALTER TABLE public.service_requests
  ADD CONSTRAINT service_requests_status_i20_check
  CHECK (status_i20 IN ('not_requested', 'waiting', 'received'));

ALTER TABLE public.service_requests
  DROP CONSTRAINT IF EXISTS service_requests_status_sevis_check;

ALTER TABLE public.service_requests
  ADD CONSTRAINT service_requests_status_sevis_check
  CHECK (status_sevis IN ('current_school', 'requested', 'confirmed', 'transferred'));

ALTER TABLE public.service_requests
  DROP CONSTRAINT IF EXISTS service_requests_transfer_form_status_check;

ALTER TABLE public.service_requests
  ADD CONSTRAINT service_requests_transfer_form_status_check
  CHECK (transfer_form_status IN ('not_sent', 'sent_to_client', 'sent_to_current_school', 'sent_to_target_school', 'confirmed'));

ALTER TABLE public.service_requests
  DROP CONSTRAINT IF EXISTS service_requests_workflow_stage_check;

ALTER TABLE public.service_requests
  ADD CONSTRAINT service_requests_workflow_stage_check
  CHECK (workflow_stage IN (
    'case_created',
    'awaiting_client_data',
    'document_review',
    'options_sent',
    'school_selected',
    'awaiting_scholarship_payment',
    'application_in_progress',
    'awaiting_sevis_release',
    'awaiting_i20',
    'awaiting_final_payment',
    'final_guidance',
    'completed',
    'blocked',
    'cancelled'
  ));

CREATE INDEX IF NOT EXISTS idx_service_requests_service_type
  ON public.service_requests(service_type);

CREATE INDEX IF NOT EXISTS idx_service_requests_workflow_stage
  ON public.service_requests(workflow_stage);

CREATE INDEX IF NOT EXISTS idx_service_requests_case_status
  ON public.service_requests(case_status);

CREATE INDEX IF NOT EXISTS idx_service_requests_owner_user_id
  ON public.service_requests(owner_user_id)
  WHERE owner_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_service_requests_last_client_contact_at
  ON public.service_requests(last_client_contact_at)
  WHERE last_client_contact_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.service_request_stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id UUID NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
  from_stage TEXT,
  to_stage TEXT NOT NULL,
  reason TEXT,
  trigger_source TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_request_stage_history_service_request_id
  ON public.service_request_stage_history(service_request_id);

CREATE INDEX IF NOT EXISTS idx_service_request_stage_history_created_at
  ON public.service_request_stage_history(created_at DESC);

CREATE TABLE IF NOT EXISTS public.service_request_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id UUID NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_source TEXT NOT NULL DEFAULT 'system',
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_request_events_service_request_id
  ON public.service_request_events(service_request_id);

CREATE INDEX IF NOT EXISTS idx_service_request_events_event_type
  ON public.service_request_events(event_type);

CREATE INDEX IF NOT EXISTS idx_service_request_events_created_at
  ON public.service_request_events(created_at DESC);

CREATE TABLE IF NOT EXISTS public.service_request_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id UUID NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
  followup_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  due_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  owner_user_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.service_request_followups
  DROP CONSTRAINT IF EXISTS service_request_followups_status_check;

ALTER TABLE public.service_request_followups
  ADD CONSTRAINT service_request_followups_status_check
  CHECK (status IN ('open', 'snoozed', 'resolved', 'cancelled'));

CREATE INDEX IF NOT EXISTS idx_service_request_followups_service_request_id
  ON public.service_request_followups(service_request_id);

CREATE INDEX IF NOT EXISTS idx_service_request_followups_status_due_at
  ON public.service_request_followups(status, due_at);

CREATE TABLE IF NOT EXISTS public.service_request_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id UUID NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
  direction TEXT NOT NULL,
  counterparty_type TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'email',
  provider TEXT NOT NULL DEFAULT 'zoho',
  from_address TEXT,
  to_address TEXT,
  subject TEXT,
  body_text TEXT,
  thread_id TEXT,
  provider_message_id TEXT,
  classification TEXT,
  sent_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  message_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.service_request_messages
  DROP CONSTRAINT IF EXISTS service_request_messages_direction_check;

ALTER TABLE public.service_request_messages
  ADD CONSTRAINT service_request_messages_direction_check
  CHECK (direction IN ('inbound', 'outbound'));

ALTER TABLE public.service_request_messages
  DROP CONSTRAINT IF EXISTS service_request_messages_counterparty_type_check;

ALTER TABLE public.service_request_messages
  ADD CONSTRAINT service_request_messages_counterparty_type_check
  CHECK (counterparty_type IN ('client', 'school', 'internal'));

CREATE INDEX IF NOT EXISTS idx_service_request_messages_service_request_id
  ON public.service_request_messages(service_request_id);

CREATE INDEX IF NOT EXISTS idx_service_request_messages_thread_id
  ON public.service_request_messages(thread_id)
  WHERE thread_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_service_request_messages_provider_message_id
  ON public.service_request_messages(provider_message_id)
  WHERE provider_message_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.service_request_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id UUID NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
  source_message_id UUID REFERENCES public.service_request_messages(id) ON DELETE SET NULL,
  document_type TEXT NOT NULL,
  source TEXT NOT NULL,
  storage_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  document_status TEXT NOT NULL DEFAULT 'received',
  extracted_data_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  received_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.service_request_documents
  DROP CONSTRAINT IF EXISTS service_request_documents_source_check;

ALTER TABLE public.service_request_documents
  ADD CONSTRAINT service_request_documents_source_check
  CHECK (source IN ('client_email', 'school_email', 'manual_upload', 'internal_generated', 'ai_generated'));

ALTER TABLE public.service_request_documents
  DROP CONSTRAINT IF EXISTS service_request_documents_status_check;

ALTER TABLE public.service_request_documents
  ADD CONSTRAINT service_request_documents_status_check
  CHECK (document_status IN ('received', 'valid', 'invalid', 'incomplete', 'generated', 'sent'));

CREATE INDEX IF NOT EXISTS idx_service_request_documents_service_request_id
  ON public.service_request_documents(service_request_id);

CREATE INDEX IF NOT EXISTS idx_service_request_documents_source_message_id
  ON public.service_request_documents(source_message_id)
  WHERE source_message_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.update_service_request_followups_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_service_request_followups_updated_at
  ON public.service_request_followups;

CREATE TRIGGER trigger_update_service_request_followups_updated_at
  BEFORE UPDATE ON public.service_request_followups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_service_request_followups_updated_at();

ALTER TABLE public.service_request_stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_request_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_request_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_request_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_request_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage service_request_stage_history"
  ON public.service_request_stage_history
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can manage service_request_events"
  ON public.service_request_events
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can manage service_request_followups"
  ON public.service_request_followups
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can manage service_request_messages"
  ON public.service_request_messages
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can manage service_request_documents"
  ON public.service_request_documents
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON COLUMN public.service_requests.service_type IS 'Canonical service family for the operational case, e.g. transfer or cos.';
COMMENT ON COLUMN public.service_requests.workflow_stage IS 'Main operational workflow stage for the case.';
COMMENT ON COLUMN public.service_requests.stage_entered_at IS 'Timestamp of when the current workflow stage started.';
COMMENT ON COLUMN public.service_requests.status_i20 IS 'Substate for I-20 lifecycle; dates must live outside this enum.';
COMMENT ON COLUMN public.service_requests.status_sevis IS 'Substate for SEVIS release lifecycle.';
COMMENT ON COLUMN public.service_requests.transfer_form_status IS 'Substate for transfer form circulation between client and schools.';
COMMENT ON TABLE public.service_request_stage_history IS 'Formal history of main workflow stage transitions for operational cases.';
COMMENT ON TABLE public.service_request_events IS 'Operational audit trail for service request lifecycle events.';
COMMENT ON TABLE public.service_request_followups IS 'Open and resolved operational follow-ups attached to a service request.';
COMMENT ON TABLE public.service_request_messages IS 'Inbound and outbound communication log anchored on service_request_id.';
COMMENT ON TABLE public.service_request_documents IS 'Operational documents for the case beyond checkout identity files.';
