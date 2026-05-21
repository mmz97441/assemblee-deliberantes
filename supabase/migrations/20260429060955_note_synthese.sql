-- Migration 00022: Note de synthèse (CGCT L2121-12)
-- Pour les communes ≥ 3500 hab, une note explicative de synthèse sur les
-- affaires soumises à délibération doit être adressée avec la convocation.
-- Le seuil et le caractère obligatoire sont configurables côté institution
-- pour permettre un déploiement adapté à chaque collectivité.

-- ─── institution_config : population + paramètres de la règle ──────
ALTER TABLE institution_config ADD COLUMN IF NOT EXISTS population_habitants INTEGER;
ALTER TABLE institution_config ADD COLUMN IF NOT EXISTS note_synthese_obligatoire BOOLEAN DEFAULT FALSE;
ALTER TABLE institution_config ADD COLUMN IF NOT EXISTS note_synthese_seuil_population INTEGER DEFAULT 3500;

-- ─── odj_points : champ texte de la note ────────────────────────────
ALTER TABLE odj_points ADD COLUMN IF NOT EXISTS note_synthese TEXT;

COMMENT ON COLUMN institution_config.population_habitants IS
  'Nombre d''habitants de la collectivité — utilisé pour l''application de la règle CGCT L2121-12 (note de synthèse obligatoire au-delà du seuil).';
COMMENT ON COLUMN institution_config.note_synthese_obligatoire IS
  'Active la règle : si vrai et population >= seuil, un avertissement s''affiche à l''envoi des convocations pour les points DELIBERATION sans note de synthèse.';
COMMENT ON COLUMN institution_config.note_synthese_seuil_population IS
  'Seuil de population au-delà duquel la règle s''applique (3500 par défaut, conformément à CGCT L2121-12).';
COMMENT ON COLUMN odj_points.note_synthese IS
  'Note explicative de synthèse — résumé de l''affaire soumise à délibération (CGCT L2121-12).';
