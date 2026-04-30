-- Migration 00023: durcissement des RLS Storage pour le bucket "documents"
--
-- Les policies de 00004_storage_documents.sql lisaient le rôle depuis
-- `auth.jwt() -> 'user_metadata' ->> 'role'`, qui est modifiable côté
-- client par l'utilisateur via supabase.auth.updateUser({ data: ... }).
-- → Un élu pouvait s'autoproclamer gestionnaire/super_admin et
-- uploader/supprimer les documents officiels (PV, délibérations…).
--
-- On refactorise en utilisant les fonctions SQL `is_super_admin()` et
-- `is_admin_or_gestionnaire()` qui vérifient le rôle dans la table
-- members (protégée par RLS). On ajoute également un helper
-- `is_member_of_institution_with_role()` pour gérer l'INSERT (qui
-- accepte aussi president et secretaire_seance, pas seulement
-- gestionnaire).

-- Fonction helper pour les rôles "rédacteurs" autorisés à uploader
CREATE OR REPLACE FUNCTION is_document_writer()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM members
    WHERE user_id = auth.uid()
    AND statut = 'ACTIF'
    AND role IN ('super_admin', 'gestionnaire', 'president', 'secretaire_seance')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─── DROP des policies existantes ──────────────────────────────────────────
DROP POLICY IF EXISTS "Managers can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Managers can delete documents" ON storage.objects;

-- ─── INSERT (upload) — gestionnaire/admin/président/secrétaire ────────────
CREATE POLICY "Managers can upload documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND is_document_writer()
);

-- ─── DELETE — super_admin et gestionnaire uniquement ──────────────────────
CREATE POLICY "Managers can delete documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents'
  AND is_admin_or_gestionnaire()
);

COMMENT ON FUNCTION is_document_writer IS
  'Vrai si l''utilisateur authentifié est admin/gestionnaire/président/secrétaire selon la table members. Utilisé par les RLS Storage pour éviter le bypass via user_metadata.role modifiable côté client.';
