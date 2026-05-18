-- ============================================================
-- Migration 00036 : Invités externes (extérieurs à la collectivité)
--
-- PROBLÈME : les convocataires sont aujourd'hui restreints aux membres
-- enregistrés (FK convocataires.member_id NOT NULL → members). Impossible
-- d'inviter un préfet, un trésorier-payeur, un journaliste, un partenaire
-- associatif, etc. qui sont régulièrement présents en séance.
--
-- SOLUTION : nouvelle table external_invitees + convocataires.member_id
-- devient nullable + convocataires.external_invitee_id ajoutée.
--
-- RÈGLES JURIDIQUES :
--   - Un invité externe peut recevoir une convocation et émarger sa présence
--   - Il N'EST PAS COMPTÉ dans le quorum (composition_max)
--   - Il NE PEUT PAS voter (aucun vote secret/main levée/nominal)
--   - Il ne peut pas être président ni secrétaire de séance
--
-- Côté requêtes : tous les calculs de quorum / présences / votes doivent
-- filtrer sur `convocataires.member_id IS NOT NULL` (ou JOIN sur members).
-- ============================================================

-- ─── Table external_invitees ────────────────────────────────────────────
CREATE TABLE external_invitees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  civilite civilite_type NOT NULL,
  prenom TEXT NOT NULL,
  nom TEXT NOT NULL,
  email TEXT NOT NULL,
  -- Organisation d'appartenance (« Préfecture de la Réunion »,
  -- « Trésorerie », « Asso XYZ »…). Optionnel mais très utile pour
  -- afficher dans les listes.
  organisation TEXT,
  -- Qualité officielle au sein de cette organisation
  -- (« Préfet », « Trésorier-payeur général », « Journaliste »…)
  qualite_officielle TEXT,
  telephone TEXT,
  -- Contexte / motif d'invitation laissé libre
  notes TEXT,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

COMMENT ON TABLE external_invitees IS
  'Personnes extérieures à la collectivité pouvant être convoquées à une séance (préfet, trésorier-payeur, journaliste, partenaire associatif). N''entrent PAS dans le calcul du quorum et NE PEUVENT PAS voter.';

CREATE INDEX idx_external_invitees_active
  ON external_invitees (nom, prenom)
  WHERE archived_at IS NULL;

CREATE INDEX idx_external_invitees_email
  ON external_invitees (email);

-- Trigger updated_at (réutilise la fonction du schéma initial)
CREATE TRIGGER update_external_invitees_updated_at
  BEFORE UPDATE ON external_invitees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Évolution de convocataires ─────────────────────────────────────────

-- member_id devient nullable (un convocataire est soit un membre, soit un externe)
ALTER TABLE convocataires
  ALTER COLUMN member_id DROP NOT NULL,
  ADD COLUMN external_invitee_id UUID REFERENCES external_invitees(id) ON DELETE CASCADE;

-- La contrainte UNIQUE(seance_id, member_id) ne convient plus (member_id peut être NULL).
-- On la remplace par 2 index uniques partiels :
--   - 1 invitation par membre par séance
--   - 1 invitation par invité externe par séance
ALTER TABLE convocataires
  DROP CONSTRAINT convocataires_seance_id_member_id_key;

CREATE UNIQUE INDEX convocataires_seance_member_unique
  ON convocataires (seance_id, member_id)
  WHERE member_id IS NOT NULL;

CREATE UNIQUE INDEX convocataires_seance_external_unique
  ON convocataires (seance_id, external_invitee_id)
  WHERE external_invitee_id IS NOT NULL;

-- Garde-fou : exactement UN des deux destinataires doit être présent.
ALTER TABLE convocataires
  ADD CONSTRAINT convocataires_one_recipient CHECK (
    (member_id IS NOT NULL AND external_invitee_id IS NULL) OR
    (member_id IS NULL AND external_invitee_id IS NOT NULL)
  );

-- Index pour récupérer rapidement les convocataires d'un invité externe
CREATE INDEX idx_convocataires_external_invitee_id
  ON convocataires (external_invitee_id)
  WHERE external_invitee_id IS NOT NULL;

-- ─── RLS sur external_invitees ──────────────────────────────────────────
-- Modèle aligné sur members :
--   - Privilégiés (super_admin, dgs, directeur_cabinet, gestionnaire) : tous droits
--   - Bureau (president, secretaire_seance) : lecture seule (pour préparer la séance)
--   - Élus / préparateurs : lecture seule (pour voir qui est convoqué à leur séance)
ALTER TABLE external_invitees ENABLE ROW LEVEL SECURITY;

CREATE POLICY external_invitees_privileged_all ON external_invitees
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.user_id = auth.uid()
        AND m.role IN ('super_admin', 'dgs', 'directeur_cabinet', 'gestionnaire')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.user_id = auth.uid()
        AND m.role IN ('super_admin', 'dgs', 'directeur_cabinet', 'gestionnaire')
    )
  );

CREATE POLICY external_invitees_others_read ON external_invitees
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.user_id = auth.uid()
        AND m.role IN ('president', 'secretaire_seance', 'elu', 'preparateur')
    )
  );

COMMENT ON COLUMN convocataires.member_id IS
  'Membre de la collectivité destinataire de la convocation. NULL si c''est un invité externe (cf. external_invitee_id). Exactement UN des deux doit être renseigné.';

COMMENT ON COLUMN convocataires.external_invitee_id IS
  'Personne extérieure à la collectivité (préfet, journaliste…) destinataire de la convocation. NULL si c''est un membre. Exactement UN des deux doit être renseigné.';
