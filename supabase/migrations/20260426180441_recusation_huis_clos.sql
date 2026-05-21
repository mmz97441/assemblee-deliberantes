-- ============================================================
-- Migration 00015: Récusation (conflit d'intérêt) + Huis clos
-- CGCT L2131-11 — Un élu ayant un intérêt personnel doit se récuser
-- ============================================================

-- ============================================================
-- TABLE: recusations — déjà créée dans 00001, vérifier/corriger
-- ============================================================

-- Ajouter la colonne declare_par si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recusations' AND column_name = 'declare_par'
  ) THEN
    ALTER TABLE recusations ADD COLUMN declare_par TEXT NOT NULL DEFAULT 'ELU'
      CHECK (declare_par IN ('ELU', 'GESTIONNAIRE'));
  END IF;
END $$;

-- ============================================================
-- Ajouter huis_clos_active sur odj_points (distinct de huis_clos qui est la config)
-- huis_clos = planifié lors de la préparation
-- huis_clos_active = activé en temps réel pendant la séance
-- ============================================================

ALTER TABLE odj_points ADD COLUMN IF NOT EXISTS huis_clos_active BOOLEAN DEFAULT FALSE;

-- ============================================================
-- INDEX sur recusations
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_recusations_seance ON recusations(seance_id);
CREATE INDEX IF NOT EXISTS idx_recusations_point ON recusations(odj_point_id);
CREATE INDEX IF NOT EXISTS idx_recusations_member ON recusations(member_id);

-- ============================================================
-- RLS sur recusations
-- ============================================================

ALTER TABLE recusations ENABLE ROW LEVEL SECURITY;

-- Lecture : tout authentifié
DROP POLICY IF EXISTS "recusations_select_all" ON recusations;
CREATE POLICY "recusations_select_all" ON recusations
  FOR SELECT TO authenticated USING (true);

-- Insertion par l'élu lui-même (auto-récusation)
DROP POLICY IF EXISTS "recusations_insert_self" ON recusations;
CREATE POLICY "recusations_insert_self" ON recusations
  FOR INSERT TO authenticated
  WITH CHECK (
    member_id IN (SELECT m.id FROM members m WHERE m.user_id = auth.uid())
  );

-- Gestion complète par admin/gestionnaire
DROP POLICY IF EXISTS "recusations_manage_admin" ON recusations;
CREATE POLICY "recusations_manage_admin" ON recusations
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM members m
      WHERE m.user_id = auth.uid()
      AND m.role IN ('super_admin', 'gestionnaire', 'president')
    )
  );

-- ============================================================
-- Audit trigger sur recusations
-- ============================================================

DROP TRIGGER IF EXISTS audit_recusations ON recusations;
CREATE TRIGGER audit_recusations
  AFTER INSERT OR UPDATE OR DELETE ON recusations
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
