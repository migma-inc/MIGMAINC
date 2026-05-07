-- Link institution_forms to its application (for grouping forms per approval)
ALTER TABLE institution_forms
  ADD COLUMN IF NOT EXISTS application_id uuid REFERENCES institution_applications(id) ON DELETE CASCADE;

-- Track §11.4 supplemental data (sponsor, recommenders, emergency contact) per application
ALTER TABLE institution_applications
  ADD COLUMN IF NOT EXISTS supplemental_data       jsonb,
  ADD COLUMN IF NOT EXISTS forms_generated_at      timestamptz,
  ADD COLUMN IF NOT EXISTS forms_status            text DEFAULT 'pending'
    CHECK (forms_status IN ('pending', 'generating', 'generated', 'signed', 'sent'));

-- Index for fast lookup of forms by application
CREATE INDEX IF NOT EXISTS idx_institution_forms_application_id
  ON institution_forms (application_id);

-- Unique constraint needed for upsert onConflict in generate-institution-forms
ALTER TABLE institution_forms
  DROP CONSTRAINT IF EXISTS uq_institution_forms_app_type;

ALTER TABLE institution_forms
  ADD CONSTRAINT uq_institution_forms_app_type
  UNIQUE (application_id, form_type);

-- Storage bucket for generated institution PDFs (private — accessed via service role)
INSERT INTO storage.buckets (id, name, public)
VALUES ('institution-forms', 'institution-forms', false)
ON CONFLICT (id) DO NOTHING;
