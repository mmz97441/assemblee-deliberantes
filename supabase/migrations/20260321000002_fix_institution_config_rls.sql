-- ============================================================
-- FIX: Ajouter la politique INSERT sur institution_config
-- Le super_admin doit pouvoir créer la config initiale
-- ============================================================

-- INSERT: seul le super_admin peut créer (première config)
CREATE POLICY "institution_config_insert" ON institution_config
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin());

-- DELETE: seul le super_admin peut supprimer (en cas de reset)
CREATE POLICY "institution_config_delete" ON institution_config
  FOR DELETE TO authenticated
  USING (is_super_admin());
