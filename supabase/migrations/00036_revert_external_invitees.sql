-- ============================================================
-- Migration 00036 (cleanup): suppression de la table fossile
-- « external_invitees » et restauration de convocataires
-- ============================================================
-- Une migration nommée « external_invitees » a été appliquée
-- directement en base distante (depuis une autre session) sans que
-- le fichier SQL soit committé dans le repo. La table résultante
-- était orpheline : aucun code applicatif ne la référençait, 0 ligne.
--
-- On la nettoie pour laisser place à l'approche définitive de la
-- migration 00037_invites (table par-séance, avec confirmation et
-- token public — cf. fichier 00037_invites.sql).
--
-- Aucune donnée perdue : external_invitees était vide et aucun
-- convocataire n'utilisait external_invitee_id (vérifié avant
-- application).
-- ============================================================

-- 1. Supprimer les index et contraintes ajoutés sur convocataires
DROP INDEX IF EXISTS idx_convocataires_external_invitee_id;

ALTER TABLE convocataires
  DROP CONSTRAINT IF EXISTS convocataires_one_recipient;

DROP INDEX IF EXISTS convocataires_seance_external_unique;
DROP INDEX IF EXISTS convocataires_seance_member_unique;

-- 2. Retirer la colonne external_invitee_id (la FK part avec)
ALTER TABLE convocataires
  DROP COLUMN IF EXISTS external_invitee_id;

-- 3. Restaurer le NOT NULL sur member_id (sûr car aucune ligne NULL)
ALTER TABLE convocataires
  ALTER COLUMN member_id SET NOT NULL;

-- 4. Restaurer la contrainte UNIQUE d'origine sur (seance_id, member_id)
ALTER TABLE convocataires
  ADD CONSTRAINT convocataires_seance_id_member_id_key
  UNIQUE (seance_id, member_id);

-- 5. Supprimer la table orpheline (les policies tombent avec)
DROP TABLE IF EXISTS external_invitees;
