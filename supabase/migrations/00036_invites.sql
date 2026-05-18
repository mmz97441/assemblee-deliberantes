-- ============================================================
-- Migration 00036: Notion d'invités
-- ============================================================
-- Un invité est une personne EXTERNE à l'institution (DGS d'une autre
-- collectivité, expert, fonctionnaire, représentant associatif, élu d'une
-- autre instance...) invitée à assister à une séance.
--
-- Différences fondamentales avec un convocataire (CGCT) :
--   - Pas de droit de vote
--   - Pas compté dans le quorum
--   - Pas signataire du PV
--   - Pas de QR code d'émargement
--   - Reçoit un email d'INVITATION (et non de convocation)
--   - Mentionné dans le PV en tant qu'« également présent en qualité
--     d'invité »
-- ============================================================

CREATE TABLE invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seance_id UUID NOT NULL REFERENCES seances(id) ON DELETE CASCADE,
  prenom TEXT NOT NULL,
  nom TEXT NOT NULL,
  email TEXT NOT NULL,
  civilite TEXT CHECK (civilite IN ('MADAME','MONSIEUR','AUTRE')),
  qualite TEXT,
  organisation TEXT,
  statut_invitation TEXT NOT NULL DEFAULT 'NON_ENVOYE'
    CHECK (statut_invitation IN (
      'NON_ENVOYE','ENVOYE','LU','CONFIRME','DECLINE','ERREUR_EMAIL'
    )),
  token_confirmation UUID NOT NULL DEFAULT uuid_generate_v4(),
  envoye_at TIMESTAMPTZ,
  lu_at TIMESTAMPTZ,
  confirme_at TIMESTAMPTZ,
  decline_at TIMESTAMPTZ,
  erreur_detail TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(seance_id, email)
);

CREATE INDEX idx_invites_seance ON invites(seance_id);
CREATE INDEX idx_invites_token ON invites(token_confirmation);

ALTER TABLE invites ENABLE ROW LEVEL SECURITY;

-- Policies alignées sur convocataires (00002_rls_policies.sql ligne 140) :
-- lecture libre pour les authentifiés, mutation réservée aux super_admin
-- et gestionnaires via le helper is_admin_or_gestionnaire().
CREATE POLICY "invites_select" ON invites
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "invites_manage" ON invites
  FOR ALL TO authenticated USING (is_admin_or_gestionnaire());

-- Audit append-only (fonction définie dans 00001_initial_schema.sql)
CREATE TRIGGER audit_invites
  AFTER INSERT OR UPDATE OR DELETE ON invites
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- updated_at automatique
CREATE TRIGGER set_updated_at_invites
  BEFORE UPDATE ON invites
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE invites IS
  'Personnes externes invitées à une séance. Distinct des convocataires : pas de droit de vote, pas dans le quorum, pas signataires du PV, pas d''émargement officiel.';
COMMENT ON COLUMN invites.qualite IS
  'Qualité de l''invité (ex: « Directeur des services techniques », « Expert », « Représentant association X »).';
COMMENT ON COLUMN invites.organisation IS
  'Organisation de rattachement (optionnel).';
COMMENT ON COLUMN invites.token_confirmation IS
  'Token UUID pour la page publique de confirmation (/invite-seance/{token}/confirmer). Le token est la garantie : aucune auth requise pour confirmer ou décliner.';
