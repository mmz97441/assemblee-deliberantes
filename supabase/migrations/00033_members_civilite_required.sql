-- ============================================================
-- Migration 00033 : Civilité obligatoire pour les membres
--
-- La civilité est devenue OBLIGATOIRE pour produire des appellations
-- protocolaires correctes dans les communications officielles
-- (« Monsieur le Maire », « Madame la Conseillère Municipale »…).
--
-- Étapes :
--   1. Backfill : tout enregistrement NULL → 'AUTRE' (formule neutre
--      « Madame, Monsieur » utilisée par défaut côté formatProtocolaire)
--   2. NOT NULL sur la colonne
-- ============================================================

UPDATE members SET civilite = 'AUTRE' WHERE civilite IS NULL;

ALTER TABLE members
  ALTER COLUMN civilite SET NOT NULL;

COMMENT ON COLUMN members.civilite IS
  'Civilité protocolaire OBLIGATOIRE (MADAME / MONSIEUR / AUTRE). Combinée avec qualite_officielle pour produire les appellations dans les communications officielles. Si AUTRE, on utilise « Madame, Monsieur » dans la salutation.';
