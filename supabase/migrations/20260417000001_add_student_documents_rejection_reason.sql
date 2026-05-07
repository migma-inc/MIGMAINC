-- Add rejection_reason to student_documents so document-level rejections can be persisted.

ALTER TABLE public.student_documents
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

COMMENT ON COLUMN public.student_documents.rejection_reason IS 'Reason provided by the admin when a student document is rejected.';
