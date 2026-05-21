-- M10: Fix instance_config INSERT policy to require gestionnaire role
-- The previous policy allowed any authenticated user to insert instance_config rows.
-- Only admin or gestionnaire should be able to create instances.

DROP POLICY IF EXISTS "instance_config_insert" ON instance_config;

CREATE POLICY "instance_config_insert" ON instance_config
  FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_gestionnaire());
