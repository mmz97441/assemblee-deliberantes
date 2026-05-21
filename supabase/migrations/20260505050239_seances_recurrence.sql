-- ============================================================
-- Migration 00034 : Séances récurrentes
--
-- Permet de générer plusieurs séances liées (ex : Conseil municipal
-- mensuel pendant 1 an = 12 séances créées en un clic).
--
-- Mécanique :
--   - recurrence_group_id : UUID partagé par toutes les séances de la
--     série. NULL pour les séances ponctuelles.
--   - recurrence_pattern  : motif lisible (« HEBDOMADAIRE », « MENSUELLE »
--     ou JSON personnalisé), conservé pour l'affichage et un éventuel
--     « ajouter une occurrence supplémentaire » plus tard.
--
-- Choix : pas de table seance_series dédiée — on garde la simplicité,
-- chaque séance reste autonome (suppression d'une seule séance possible
-- sans casser la série, ODJ et convocataires propres à chaque occurrence).
-- ============================================================

ALTER TABLE seances
  ADD COLUMN IF NOT EXISTS recurrence_group_id UUID,
  ADD COLUMN IF NOT EXISTS recurrence_pattern TEXT;

COMMENT ON COLUMN seances.recurrence_group_id IS
  'UUID partagé par toutes les séances générées comme une série récurrente. NULL = séance ponctuelle.';

COMMENT ON COLUMN seances.recurrence_pattern IS
  'Description lisible de la récurrence (« HEBDOMADAIRE », « BIHEBDOMADAIRE », « MENSUELLE_DATE », « MENSUELLE_JOUR_SEMAINE », « PERSONNALISEE »). Toutes les séances de la série partagent la même valeur.';

-- Index pour récupérer rapidement toutes les séances d'une série
CREATE INDEX IF NOT EXISTS idx_seances_recurrence_group_id
  ON seances (recurrence_group_id)
  WHERE recurrence_group_id IS NOT NULL;
