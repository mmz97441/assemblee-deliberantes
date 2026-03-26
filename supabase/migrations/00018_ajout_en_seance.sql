-- ============================================================
-- MIGRATION 00018: Ajout de points à l'ODJ en cours de séance
-- Permet de marquer les points ajoutés pendant la séance
-- (vote de l'assemblée requis — CGCT)
-- ============================================================

-- Ajouter la colonne ajout_en_seance sur odj_points
ALTER TABLE odj_points
ADD COLUMN IF NOT EXISTS ajout_en_seance BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN odj_points.ajout_en_seance IS
  'Indique que ce point a été ajouté à l''ordre du jour en cours de séance, '
  'sur proposition du président et avec l''accord de l''assemblée. '
  'Mentionné dans le PV : "Le point suivant a été ajouté à l''ordre du jour en cours de séance, '
  'sur proposition du président et avec l''accord de l''assemblée."';
