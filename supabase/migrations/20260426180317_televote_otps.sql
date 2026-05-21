-- ============================================================
-- 00014 — Télévote OTP (vote à distance via SMS)
-- ============================================================

-- Table pour stocker les OTP (one-time password) de télévote
CREATE TABLE IF NOT EXISTS televote_otps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vote_id UUID NOT NULL REFERENCES votes(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  otp_hash TEXT NOT NULL,             -- SHA-256 hash (jamais le code en clair)
  expires_at TIMESTAMPTZ NOT NULL,    -- Expiration (8 minutes après création)
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMPTZ,
  resend_count INT DEFAULT 0,         -- Nombre de renvois (max 3)
  choix TEXT,                          -- POUR, CONTRE, ABSTENTION (stocké après vote — télévote est nominal)
  sms_sid TEXT,                       -- Twilio message SID pour traçabilité
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vote_id, member_id)          -- Un seul OTP actif par membre par vote
);

-- Index pour recherche rapide par vote_id
CREATE INDEX idx_televote_otps_vote_id ON televote_otps(vote_id);
CREATE INDEX idx_televote_otps_member_id ON televote_otps(member_id);

-- RLS
ALTER TABLE televote_otps ENABLE ROW LEVEL SECURITY;

-- Les gestionnaires/admins peuvent tout gérer
CREATE POLICY "televote_otps_manage" ON televote_otps
  FOR ALL TO authenticated
  USING (is_admin_or_gestionnaire())
  WITH CHECK (is_admin_or_gestionnaire());

-- Les membres peuvent lire leur propre OTP (pour vérifier le statut)
CREATE POLICY "televote_otps_self_read" ON televote_otps
  FOR SELECT TO authenticated
  USING (member_id IN (SELECT m.id FROM members m WHERE m.user_id = auth.uid()));

-- Politique pour accès anonyme (la page de vote publique utilise le service role)
-- L'accès se fait via les Server Actions qui utilisent le service role key

-- Audit log trigger (la table televote_otps est sensible)
CREATE TRIGGER audit_televote_otps
  AFTER INSERT OR UPDATE OR DELETE ON televote_otps
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
