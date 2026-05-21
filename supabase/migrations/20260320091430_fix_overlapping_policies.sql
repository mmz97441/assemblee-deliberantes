-- ============================================================
-- Migration 00003: Correction policies qui se chevauchent
-- Remplace FOR ALL par INSERT + UPDATE + DELETE explicites
-- pour eviter la confusion avec les SELECT separees
-- ============================================================

-- rappels_config: remplacer FOR ALL par INSERT + UPDATE + DELETE
DROP POLICY IF EXISTS "rappels_config_manage" ON rappels_config;

CREATE POLICY "rappels_config_insert" ON rappels_config
  FOR INSERT TO authenticated WITH CHECK (is_admin_or_gestionnaire());

CREATE POLICY "rappels_config_update" ON rappels_config
  FOR UPDATE TO authenticated USING (is_admin_or_gestionnaire());

CREATE POLICY "rappels_config_delete" ON rappels_config
  FOR DELETE TO authenticated USING (is_admin_or_gestionnaire());

-- instance_members: remplacer FOR ALL par INSERT + UPDATE + DELETE
DROP POLICY IF EXISTS "instance_members_manage" ON instance_members;

CREATE POLICY "instance_members_insert" ON instance_members
  FOR INSERT TO authenticated WITH CHECK (is_admin_or_gestionnaire());

CREATE POLICY "instance_members_update" ON instance_members
  FOR UPDATE TO authenticated USING (is_admin_or_gestionnaire());

CREATE POLICY "instance_members_delete" ON instance_members
  FOR DELETE TO authenticated USING (is_admin_or_gestionnaire());

-- convocataires: remplacer FOR ALL par INSERT + UPDATE + DELETE
DROP POLICY IF EXISTS "convocataires_manage" ON convocataires;

CREATE POLICY "convocataires_insert" ON convocataires
  FOR INSERT TO authenticated WITH CHECK (is_admin_or_gestionnaire());

CREATE POLICY "convocataires_update" ON convocataires
  FOR UPDATE TO authenticated USING (is_admin_or_gestionnaire());

CREATE POLICY "convocataires_delete" ON convocataires
  FOR DELETE TO authenticated USING (is_admin_or_gestionnaire());

-- odj_points: remplacer FOR ALL par INSERT + UPDATE + DELETE
DROP POLICY IF EXISTS "odj_points_manage" ON odj_points;

CREATE POLICY "odj_points_insert" ON odj_points
  FOR INSERT TO authenticated WITH CHECK (is_admin_or_gestionnaire());

CREATE POLICY "odj_points_update" ON odj_points
  FOR UPDATE TO authenticated USING (is_admin_or_gestionnaire());

CREATE POLICY "odj_points_delete" ON odj_points
  FOR DELETE TO authenticated USING (is_admin_or_gestionnaire());

-- pin_secours: remplacer FOR ALL par INSERT + UPDATE + DELETE
DROP POLICY IF EXISTS "pin_secours_manage" ON pin_secours;

CREATE POLICY "pin_secours_insert" ON pin_secours
  FOR INSERT TO authenticated WITH CHECK (is_admin_or_gestionnaire());

CREATE POLICY "pin_secours_update" ON pin_secours
  FOR UPDATE TO authenticated USING (is_admin_or_gestionnaire());

CREATE POLICY "pin_secours_delete" ON pin_secours
  FOR DELETE TO authenticated USING (is_admin_or_gestionnaire());

-- procurations: remplacer FOR ALL par INSERT + UPDATE + DELETE
DROP POLICY IF EXISTS "procurations_manage" ON procurations;

CREATE POLICY "procurations_insert" ON procurations
  FOR INSERT TO authenticated WITH CHECK (is_admin_or_gestionnaire());

CREATE POLICY "procurations_update" ON procurations
  FOR UPDATE TO authenticated USING (is_admin_or_gestionnaire());

CREATE POLICY "procurations_delete" ON procurations
  FOR DELETE TO authenticated USING (is_admin_or_gestionnaire());
