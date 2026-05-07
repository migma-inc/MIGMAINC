-- Fix RLS for global_document_requests
-- profile_id stores user_profiles.id, while auth.uid() is auth.users.id.

DROP POLICY IF EXISTS "Users can view their own documents" ON public.global_document_requests;
DROP POLICY IF EXISTS "Users can update their own documents" ON public.global_document_requests;
DROP POLICY IF EXISTS "Users can insert their own documents" ON public.global_document_requests;

CREATE POLICY "Users can view their own documents"
ON public.global_document_requests
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = global_document_requests.profile_id
      AND up.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert their own documents"
ON public.global_document_requests
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = global_document_requests.profile_id
      AND up.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own documents"
ON public.global_document_requests
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = global_document_requests.profile_id
      AND up.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = global_document_requests.profile_id
      AND up.user_id = auth.uid()
  )
);
