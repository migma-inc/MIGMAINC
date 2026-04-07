ALTER TABLE public.service_request_events
  ADD COLUMN IF NOT EXISTS event_key TEXT;

UPDATE public.service_request_events
SET event_key = CONCAT(
  'order:',
  payload_json->>'order_id',
  ':',
  event_type
)
WHERE event_key IS NULL
  AND payload_json ? 'order_id'
  AND payload_json->>'order_id' <> '';

CREATE INDEX IF NOT EXISTS idx_service_request_events_case_type_created_at
  ON public.service_request_events(service_request_id, event_type, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_service_request_events_case_type_event_key
  ON public.service_request_events(service_request_id, event_type, event_key)
  WHERE event_key IS NOT NULL;

COMMENT ON COLUMN public.service_request_events.event_key IS
  'Optional idempotency key for operational events. When present, should uniquely identify the event within a service_request_id + event_type scope.';
