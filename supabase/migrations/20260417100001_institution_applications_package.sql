-- Track MatriculaUSA package generation per application
ALTER TABLE institution_applications
  ADD COLUMN IF NOT EXISTS package_storage_url  text,
  ADD COLUMN IF NOT EXISTS package_sent_at      timestamptz,
  ADD COLUMN IF NOT EXISTS package_status       text DEFAULT 'pending'
    CHECK (package_status IN ('pending', 'building', 'ready', 'sent'));

-- Storage bucket for ZIP packages (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('matriculausa-packages', 'matriculausa-packages', false)
ON CONFLICT (id) DO NOTHING;

-- NOTE (future): when MatriculaUSA API becomes available,
-- migrate package delivery from manual ZIP (Option A) to
-- automatic API upload (Option B) — no schema changes needed,
-- only the edge function logic changes.
