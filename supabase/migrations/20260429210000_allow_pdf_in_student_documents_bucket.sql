-- Allow PDF (and common image/doc types) in migma-student-documents bucket
-- The bucket was created without application/pdf in allowed_mime_types, causing upload errors.
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]
WHERE id = 'migma-student-documents';
