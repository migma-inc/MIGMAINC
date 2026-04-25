-- Allow authenticated students to upload externally signed forms.
-- Files are stored in the public institution-forms bucket under:
-- signed/{auth.uid()}/{form_id}_{timestamp}.{ext}

DROP POLICY IF EXISTS "Students can upload own signed institution forms" ON storage.objects;

CREATE POLICY "Students can upload own signed institution forms"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'institution-forms'
  AND (storage.foldername(name))[1] = 'signed'
  AND (storage.foldername(name))[2] = (auth.uid())::text
);
