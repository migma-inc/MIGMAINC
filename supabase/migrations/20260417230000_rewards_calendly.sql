-- Fase 10: Rewards + Calendly tracking

-- 1. calendly_events — log de cada booking recebido via webhook
CREATE TABLE IF NOT EXISTS public.calendly_events (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unique_code       TEXT REFERENCES public.referral_links(unique_code) ON DELETE SET NULL,
  owner_profile_id  UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  calendly_event_id TEXT UNIQUE,
  invitee_name      TEXT,
  invitee_email     TEXT,
  event_type        TEXT,
  scheduled_at      TIMESTAMPTZ,
  raw_payload       JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.calendly_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read all calendly events"
  ON public.calendly_events FOR SELECT
  USING (true);

-- 2. Índices úteis para o CRM admin
CREATE INDEX IF NOT EXISTS idx_calendly_events_owner    ON public.calendly_events(owner_profile_id);
CREATE INDEX IF NOT EXISTS idx_calendly_events_code     ON public.calendly_events(unique_code);
CREATE INDEX IF NOT EXISTS idx_referral_links_profile   ON public.referral_links(profile_id);
