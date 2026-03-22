-- Migration: Ajout token émargement QR code unique à usage unique
-- Le token_confirmation existant sert pour la confirmation email
-- Le token_emargement sert pour le scan QR à l'entrée de la salle

ALTER TABLE convocataires
  ADD COLUMN token_emargement UUID DEFAULT uuid_generate_v4() UNIQUE,
  ADD COLUMN emargement_scanne_at TIMESTAMPTZ;

-- Index pour lookup rapide par token (scan QR)
CREATE INDEX idx_convocataires_token_emargement ON convocataires(token_emargement);

-- Mettre à jour les lignes existantes qui n'ont pas de token
UPDATE convocataires SET token_emargement = uuid_generate_v4() WHERE token_emargement IS NULL;
