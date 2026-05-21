-- Migration 00017: Bureau et ordre de succession
-- Ajoute les colonnes bureau_role et ordre_succession sur instance_members

ALTER TABLE instance_members ADD COLUMN IF NOT EXISTS bureau_role TEXT;
ALTER TABLE instance_members ADD COLUMN IF NOT EXISTS ordre_succession INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_instance_members_bureau ON instance_members (instance_config_id, bureau_role, ordre_succession);
