-- Migration: Setup RLS policies for zelle_comprovantes storage bucket
-- This migration creates the necessary storage policies for the zelle_comprovantes bucket

-- Note: The bucket itself must be created manually in Supabase Dashboard
-- This migration only sets up the RLS policies

-- Drop existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "Allow public uploads to zelle_comprovantes" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads to zelle_comprovantes" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access to zelle_comprovantes" ON storage.objects;
DROP POLICY IF EXISTS "Service role can manage zelle_comprovantes" ON storage.objects;

-- Policy 1: Allow anonymous uploads for checkout flow
-- Only allows uploads to zelle-payments/ folder
CREATE POLICY "Allow public uploads to zelle_comprovantes"
ON storage.objects
FOR INSERT
TO anon
WITH CHECK (
  bucket_id = 'zelle_comprovantes' AND
  (storage.foldername(name))[1] = 'zelle-payments'
);

-- Policy 2: Allow authenticated users to upload
CREATE POLICY "Allow authenticated uploads to zelle_comprovantes"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'zelle_comprovantes' AND
  (storage.foldername(name))[1] = 'zelle-payments'
);

-- Policy 3: Allow public read access (for n8n to access images)
CREATE POLICY "Allow public read access to zelle_comprovantes"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'zelle_comprovantes');

-- Policy 4: Allow service role full access
CREATE POLICY "Service role can manage zelle_comprovantes"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'zelle_comprovantes')
WITH CHECK (bucket_id = 'zelle_comprovantes');

-- Comments
COMMENT ON POLICY "Allow public uploads to zelle_comprovantes" ON storage.objects IS 'Allows anonymous users to upload Zelle receipts to zelle-payments/ folder';
COMMENT ON POLICY "Allow authenticated uploads to zelle_comprovantes" ON storage.objects IS 'Allows authenticated users to upload Zelle receipts to zelle-payments/ folder';
COMMENT ON POLICY "Allow public read access to zelle_comprovantes" ON storage.objects IS 'Allows public read access to Zelle receipts (for n8n validation)';
COMMENT ON POLICY "Service role can manage zelle_comprovantes" ON storage.objects IS 'Allows service role full access to zelle_comprovantes bucket';
