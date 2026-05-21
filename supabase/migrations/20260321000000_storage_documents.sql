-- Migration: Create storage bucket for session documents
-- Documents attached to ODJ points (PDF, images, etc.)

-- Create the documents bucket (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  20971520, -- 20 MB max
  ARRAY[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ]::text[]
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for the documents bucket

-- Allow authenticated users to read documents
CREATE POLICY "Authenticated users can read documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'documents');

-- Allow gestionnaires and admins to upload documents
CREATE POLICY "Managers can upload documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND (
    auth.jwt() ->> 'role' = 'super_admin'
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin'
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'gestionnaire'
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'president'
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'secretaire_seance'
  )
);

-- Allow managers to delete documents
CREATE POLICY "Managers can delete documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents'
  AND (
    auth.jwt() ->> 'role' = 'super_admin'
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin'
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'gestionnaire'
  )
);
