-- ============================================================
-- Migration 00031 : 2 nouveaux rôles privilégiés + audit immuable
--
-- Ajoute :
--  - Enum user_role : 'dgs' (Directeur Général des Services)
--                      'directeur_cabinet' (Directeur de cabinet)
--  - Table audit_log_redactions : trace immuable des anonymisations RGPD
--  - Helper is_admin_or_gestionnaire() élargi (4 rôles privilégiés)
--  - Helper is_document_writer() élargi (6 rôles)
--  - RLS audit_log : SELECT pour les 4 privilégiés
--  - RLS convocataires : un élu ne voit que sa propre ligne
--
-- Conformément à la décision produit : DGS et Directeur de cabinet ont
-- les mêmes droits que super_admin sur le fonctionnel (lecture totale,
-- gestion ODJ/PJ/convocations/PV/configuration), mais pas la gestion
-- des super_admins ni les opérations purement techniques.
-- ============================================================

-- ─── 1. Enum user_role : ajout des 2 nouveaux rôles ──────────────────
-- Important : ALTER TYPE ADD VALUE doit être dans une transaction
-- séparée du reste — appliqué via 2 calls MCP distincts en prod.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'dgs'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')) THEN
    ALTER TYPE user_role ADD VALUE 'dgs';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'directeur_cabinet'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')) THEN
    ALTER TYPE user_role ADD VALUE 'directeur_cabinet';
  END IF;
END$$;

-- ─── 2. Helpers : élargir aux nouveaux rôles ────────────────────────
CREATE OR REPLACE FUNCTION is_admin_or_gestionnaire()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM members
    WHERE user_id = auth.uid()
    AND statut = 'ACTIF'
    AND role IN ('super_admin', 'gestionnaire', 'dgs', 'directeur_cabinet')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION is_admin_or_gestionnaire IS
  'Vrai si l''utilisateur est super_admin, gestionnaire, DGS ou directeur de cabinet.';

CREATE OR REPLACE FUNCTION is_document_writer()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM members
    WHERE user_id = auth.uid()
    AND statut = 'ACTIF'
    AND role IN ('super_admin', 'gestionnaire', 'dgs', 'directeur_cabinet', 'president', 'secretaire_seance')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─── 3. Table audit_log_redactions ───────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log_redactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_log_id UUID NOT NULL REFERENCES audit_log(id),
  redacted_by UUID NOT NULL REFERENCES auth.users(id),
  motif_legal TEXT NOT NULL CHECK (length(trim(motif_legal)) >= 10),
  redacted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_redactions_log ON audit_log_redactions(audit_log_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_redactions_at ON audit_log_redactions(redacted_at);

ALTER TABLE audit_log_redactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_redactions_select" ON audit_log_redactions;
CREATE POLICY "audit_redactions_select" ON audit_log_redactions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM members
      WHERE user_id = auth.uid() AND statut = 'ACTIF' AND role = 'super_admin'
    )
  );

-- Aucune policy INSERT/UPDATE/DELETE → immuable même pour super_admin
-- via API normale. Seules les server actions avec service_role peuvent
-- insérer (et seulement après vérification du rôle super_admin).

COMMENT ON TABLE audit_log_redactions IS
  'Trace immuable des anonymisations RGPD effectuées sur audit_log. Le motif légal est obligatoire (min 10 chars). Aucune modification/suppression possible pour personne.';

-- ─── 4. RLS audit_log : élargie aux 4 privilégiés ────────────────────
DROP POLICY IF EXISTS "audit_log_select" ON audit_log;
CREATE POLICY "audit_log_select" ON audit_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM members
      WHERE user_id = auth.uid() AND statut = 'ACTIF'
      AND role IN ('super_admin', 'gestionnaire', 'dgs', 'directeur_cabinet')
    )
  );

-- Pas d'INSERT/UPDATE/DELETE policies → immuable pour authenticated.
-- Inserts viennent UNIQUEMENT du trigger audit_trigger_func()
-- (SECURITY DEFINER, contourne RLS).

-- ─── 5. RLS convocataires : un élu ne voit que sa propre ligne ──────
DROP POLICY IF EXISTS "convocataires_select" ON convocataires;
CREATE POLICY "convocataires_select" ON convocataires
  FOR SELECT TO authenticated
  USING (
    is_admin_or_gestionnaire()
    OR EXISTS (
      SELECT 1 FROM members
      WHERE user_id = auth.uid() AND statut = 'ACTIF'
      AND role IN ('president', 'secretaire_seance')
    )
    OR member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
  );

COMMENT ON POLICY "convocataires_select" ON convocataires IS
  'Un élu ne voit que sa propre convocation. Privilégiés + bureau de séance voient tout. Empêche un élu de voir qui d''autre a/n''a pas confirmé.';
