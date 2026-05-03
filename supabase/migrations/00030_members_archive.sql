-- ============================================================
-- Migration 00030 : Archivage des membres
--
-- Permet au gestionnaire de retirer un membre de la liste active sans
-- effacer ses données (historique séances, votes, présences conservés).
-- Indépendant du `statut` (qui décrit le mandat : ACTIF / SUSPENDU /
-- FIN_DE_MANDAT / DECEDE).
--
-- Un membre archivé :
--  - n'apparaît plus dans la liste « Actifs » par défaut
--  - n'est plus proposé pour les convocations
--  - reste consultable dans l'onglet « Archives »
--  - peut être désarchivé à tout moment
-- ============================================================

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_members_archived_at ON members(archived_at) WHERE archived_at IS NOT NULL;

COMMENT ON COLUMN members.archived_at IS
  'Si non NULL, le membre est archivé. Date d''archivage. Indépendant du statut du mandat.';
