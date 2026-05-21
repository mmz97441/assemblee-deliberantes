-- Migration: Add resolution/projet de deliberation field to ODJ points
-- This is the proposed text that members will vote on

ALTER TABLE odj_points
ADD COLUMN IF NOT EXISTS projet_deliberation TEXT DEFAULT NULL;

-- Add a comment explaining the field
COMMENT ON COLUMN odj_points.projet_deliberation IS
  'Texte de la resolution ou du projet de deliberation soumis au vote. Affiche aux elus avant et pendant le vote.';
