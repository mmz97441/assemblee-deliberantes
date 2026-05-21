-- Migration 00012: device_sessions table + vote secret columns
-- Supports secret ballot voting with encrypted session keys

-- ============================================================
-- TABLE: device_sessions — tablettes non-nominatives
-- ============================================================

CREATE TABLE IF NOT EXISTS device_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seance_id UUID NOT NULL REFERENCES seances(id),
  member_id UUID NOT NULL REFERENCES members(id),
  device_fingerprint TEXT NOT NULL,
  auth_method TEXT NOT NULL DEFAULT 'QR_ONLY',
  authenticated_at TIMESTAMPTZ DEFAULT NOW(),
  webauthn_credential_id TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(seance_id, member_id)
);

ALTER TABLE device_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "device_sessions_select" ON device_sessions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "device_sessions_manage" ON device_sessions
  FOR ALL TO authenticated USING (is_admin_or_gestionnaire());
CREATE POLICY "device_sessions_self_insert" ON device_sessions
  FOR INSERT TO authenticated
  WITH CHECK (member_id IN (SELECT m.id FROM members m WHERE m.user_id = auth.uid()));

-- ============================================================
-- Vote secret: encrypted session key stored on vote row
-- ============================================================

ALTER TABLE votes ADD COLUMN IF NOT EXISTS encrypted_session_key TEXT;
ALTER TABLE votes ADD COLUMN IF NOT EXISTS vote_secret_demand_count INTEGER DEFAULT 0;

-- Audit trigger for device_sessions
CREATE TRIGGER audit_device_sessions
  AFTER INSERT OR UPDATE OR DELETE ON device_sessions
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_device_sessions_seance ON device_sessions(seance_id);
CREATE INDEX IF NOT EXISTS idx_device_sessions_member ON device_sessions(member_id);
