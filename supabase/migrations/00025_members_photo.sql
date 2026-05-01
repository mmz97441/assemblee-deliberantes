-- Migration 00025 — Photo de profil des membres
--
-- Ajoute une colonne photo_url sur la table members et crée un bucket
-- Storage 'avatars' public en lecture (pour affichage trombinoscope sans
-- token), avec upload/delete restreint aux gestionnaires via les fonctions
-- SQL members (jamais user_metadata).

ALTER TABLE members ADD COLUMN IF NOT EXISTS photo_url TEXT;

COMMENT ON COLUMN members.photo_url IS
  'URL publique de la photo de profil du membre (bucket Supabase Storage avatars).';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp']::text[]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated users can read avatars" ON storage.objects;
CREATE POLICY "Authenticated users can read avatars"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Managers can upload avatars" ON storage.objects;
CREATE POLICY "Managers can upload avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars' AND is_admin_or_gestionnaire());

DROP POLICY IF EXISTS "Managers can update avatars" ON storage.objects;
CREATE POLICY "Managers can update avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars' AND is_admin_or_gestionnaire());

DROP POLICY IF EXISTS "Managers can delete avatars" ON storage.objects;
CREATE POLICY "Managers can delete avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatars' AND is_admin_or_gestionnaire());
