-- ============================================================
-- Migration 00028 : Convocations enrichies + signalement d'absence
--
-- Permet à l'élu de signaler son absence directement depuis l'email
-- de convocation (en plus du bouton « Confirmer ma présence » existant).
--
-- Conformément CGCT L2121-12 / L2121-20 :
--  - L'élu doit pouvoir s'excuser en amont
--  - La déclaration anticipée d'absence permet au gestionnaire
--    d'organiser les procurations à l'avance
--
-- Ajouts :
--  - Valeur d'enum ABSENT_EXCUSE pour convocation_statut
--  - Colonne motif_absence pour stocker la raison déclarée par l'élu
-- ============================================================

-- ALTER TYPE ne supporte pas IF NOT EXISTS pour ADD VALUE avant PG 14.
-- On utilise un DO block pour idempotence.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'ABSENT_EXCUSE'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'convocation_statut')
  ) THEN
    ALTER TYPE convocation_statut ADD VALUE 'ABSENT_EXCUSE';
  END IF;
END$$;

ALTER TABLE convocataires
  ADD COLUMN IF NOT EXISTS motif_absence TEXT;

COMMENT ON COLUMN convocataires.motif_absence IS
  'Motif déclaré par l''élu lors de la signalisation d''une absence depuis l''email de convocation. Optionnel.';
