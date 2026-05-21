-- ============================================================
-- Migration 00011: PV Enhanced — Colonnes enrichies + Comments + Immutabilité
-- ============================================================

-- ─── Colonnes ODJ pour le PV (Vu/Considérant/Discussion/Articles) ────────
ALTER TABLE odj_points ADD COLUMN IF NOT EXISTS vu TEXT;
ALTER TABLE odj_points ADD COLUMN IF NOT EXISTS considerant TEXT;
ALTER TABLE odj_points ADD COLUMN IF NOT EXISTS discussion TEXT;
ALTER TABLE odj_points ADD COLUMN IF NOT EXISTS articles JSONB DEFAULT '[]';

-- ─── Colonnes PV pour signatures séparées + hash ─────────────────────────
ALTER TABLE pv ADD COLUMN IF NOT EXISTS hash_integrite TEXT;
ALTER TABLE pv ADD COLUMN IF NOT EXISTS signe_president_at TIMESTAMPTZ;
ALTER TABLE pv ADD COLUMN IF NOT EXISTS signe_secretaire_at TIMESTAMPTZ;

-- ─── Table commentaires PV (circuit de relecture) ────────────────────────
CREATE TABLE IF NOT EXISTS pv_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pv_id UUID NOT NULL REFERENCES pv(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  section_key TEXT NOT NULL,
  contenu TEXT NOT NULL,
  resolu BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pv_comments_pv ON pv_comments (pv_id, created_at);

ALTER TABLE pv_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pv_comments_select" ON pv_comments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "pv_comments_insert" ON pv_comments
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "pv_comments_update" ON pv_comments
  FOR UPDATE TO authenticated
  USING (is_admin_or_gestionnaire() OR user_id = auth.uid());

-- ─── Trigger : PV immutable après signature ──────────────────────────────
-- Empêche toute modification du contenu une fois le PV signé
-- Seule exception : transition SIGNE → PUBLIE (met à jour statut + pdf_url)
CREATE OR REPLACE FUNCTION check_pv_immutable() RETURNS TRIGGER AS $$
BEGIN
  -- Si le PV est SIGNE ou PUBLIE
  IF OLD.statut IN ('SIGNE', 'PUBLIE') THEN
    -- Autoriser uniquement la transition SIGNE → PUBLIE
    IF OLD.statut = 'SIGNE' AND NEW.statut = 'PUBLIE' THEN
      -- Vérifier que seuls statut et pdf_url changent
      IF NEW.contenu_json IS DISTINCT FROM OLD.contenu_json
         OR NEW.signe_par IS DISTINCT FROM OLD.signe_par
         OR NEW.version IS DISTINCT FROM OLD.version THEN
        RAISE EXCEPTION 'Le procès-verbal signé ne peut pas être modifié (contenu, signatures ou version)';
      END IF;
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Le procès-verbal est signé et ne peut plus être modifié';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_pv_immutable ON pv;
CREATE TRIGGER trigger_pv_immutable
  BEFORE UPDATE ON pv
  FOR EACH ROW
  EXECUTE FUNCTION check_pv_immutable();
