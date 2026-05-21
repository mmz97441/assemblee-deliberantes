-- ============================================================
-- Migration 00032 : Civilité protocolaire des membres
--
-- Ajoute la civilité de chaque membre pour permettre des appellations
-- protocolaires correctes dans les communications officielles
-- (convocations, courriers, PV, etc.).
-- ============================================================

CREATE TYPE civilite_type AS ENUM ('MADAME', 'MONSIEUR', 'AUTRE');

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS civilite civilite_type;

COMMENT ON COLUMN members.civilite IS
  'Civilité protocolaire (MADAME / MONSIEUR / AUTRE). Combinée avec qualite_officielle pour produire les appellations dans les communications officielles. Optionnel : si NULL, on utilise « Madame, Monsieur » par défaut.';
