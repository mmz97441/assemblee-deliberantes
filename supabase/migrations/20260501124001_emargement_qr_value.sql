-- Migration 00024 — Émargement : mode QR distinct + toggle "QR strict"
--
-- 1. Ajoute la valeur 'QR' à l'enum mode_authentification.
--    Avant cette migration, le scan QR enregistrait 'MANUEL' ce qui ne
--    permettait pas de distinguer une preuve forte (QR personnel à usage
--    unique) d'un pointage assisté par le gestionnaire (preuve plus
--    faible). Important pour le contrôle préfectoral.
--
-- 2. Ajoute un toggle global au niveau institution_config pour exiger
--    le scan QR à l'entrée de toutes les séances.
--
-- 3. Ajoute une colonne mode_assiste_motif sur la table presences pour
--    enregistrer la justification du gestionnaire quand il marque un
--    membre manuellement en mode dégradé (QR perdu, etc.).

-- Nouveau mode 'QR' — preuve forte (token unique à usage unique)
ALTER TYPE mode_authentification ADD VALUE IF NOT EXISTS 'QR' AFTER 'WEBAUTHN';

-- Toggle "Émargement QR obligatoire" au niveau institution
ALTER TABLE institution_config
  ADD COLUMN IF NOT EXISTS emargement_qr_strict BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN institution_config.emargement_qr_strict IS
  'Si vrai, l''émargement par scan QR est obligatoire à l''entrée de toutes les séances. Le pointage manuel devient une exception nécessitant un motif obligatoire (mode assisté).';

-- Motif obligatoire pour le mode ASSISTE quand qr_strict est actif
ALTER TABLE presences
  ADD COLUMN IF NOT EXISTS mode_assiste_motif TEXT;

COMMENT ON COLUMN presences.mode_assiste_motif IS
  'Justification du gestionnaire pour un émargement en mode ASSISTE quand l''institution a activé emargement_qr_strict. Exemple : "QR perdu", "Caméra défaillante", "Membre sans email".';
