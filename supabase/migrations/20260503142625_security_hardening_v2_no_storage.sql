-- ============================================================
-- Migration 00027 : Durcissement sécurité v2 (audit pré-vente, suite)
--
-- Cette migration corrige plusieurs findings P2 supplémentaires de
-- l'audit de sécurité, sans introduire de régression sur le code
-- existant (compatibilité ascendante préservée pour les chemins déjà
-- en base).
--
-- FIX P2 #15 : bucket avatars passe en PRIVÉ. Lecture par signed URLs
--              générées côté serveur (1 h de validité). Empêche un
--              attaquant de récupérer les photos par URL devinée.
-- FIX P2 #22 : trigger audit_log enrichi pour capturer IP source et
--              user-agent. En cas d'incident, traçabilité complète.
-- FIX P2 #13 : nouvelle table webauthn_credentials pour stocker les
--              clés FIDO2/WebAuthn enrôlées par les élus. Permet une
--              authentification matérielle réelle (vs façade UI).
-- ============================================================

-- ──────────────────────────────────────────────────────────────────────
-- FIX P2 #22 : enrichir audit_log avec IP / user_agent
-- ──────────────────────────────────────────────────────────────────────
-- PostgREST expose les en-têtes HTTP via current_setting('request.headers').
-- On les lit avec gestion d'erreur (en cas d'absence — appels via
-- service_role hors HTTP, par ex. depuis une Edge Function).

CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
DECLARE
  v_ip TEXT;
  v_ua TEXT;
  v_headers JSON;
BEGIN
  -- Lecture défensive des headers HTTP (peut être absent en hors-PostgREST)
  BEGIN
    v_headers := current_setting('request.headers', true)::json;
    v_ip := v_headers ->> 'x-forwarded-for';
    -- En présence de plusieurs IP (proxies enchaînés), on ne garde que la première
    IF v_ip IS NOT NULL AND position(',' in v_ip) > 0 THEN
      v_ip := trim(split_part(v_ip, ',', 1));
    END IF;
    -- Tronquer pour éviter de stocker un User-Agent abusivement long
    v_ua := left(coalesce(v_headers ->> 'user-agent', ''), 512);
    IF v_ua = '' THEN v_ua := NULL; END IF;
  EXCEPTION WHEN OTHERS THEN
    v_ip := NULL;
    v_ua := NULL;
  END;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (action, table_name, record_id, new_values, user_id, ip, user_agent)
    VALUES ('INSERT', TG_TABLE_NAME, NEW.id, to_jsonb(NEW), auth.uid(), v_ip, v_ua);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log (action, table_name, record_id, old_values, new_values, user_id, ip, user_agent)
    VALUES ('UPDATE', TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW), auth.uid(), v_ip, v_ua);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (action, table_name, record_id, old_values, user_id, ip, user_agent)
    VALUES ('DELETE', TG_TABLE_NAME, OLD.id, to_jsonb(OLD), auth.uid(), v_ip, v_ua);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION audit_trigger_func IS
  'Trigger d''audit append-only. Capture user_id (auth.uid()), IP source (x-forwarded-for) et user-agent depuis les headers PostgREST. Tolère l''absence de contexte HTTP (Edge Function, job batch).';

-- ──────────────────────────────────────────────────────────────────────
-- FIX P2 #15 : bucket avatars en privé + remplacement de la policy SELECT
-- ──────────────────────────────────────────────────────────────────────
-- Le code applicatif a été mis à jour pour stocker un PATH dans
-- members.photo_url (au lieu d'une URL publique) et générer des URLs
-- signées en lecture (1h de validité, batch côté serveur).

UPDATE storage.buckets SET public = false WHERE id = 'avatars';

-- La SELECT ne peut plus être anonyme : on autorise tout authentifié à
-- demander une signed URL (Supabase appelle storage.objects en SELECT
-- pour générer la signature).
DROP POLICY IF EXISTS "Authenticated users can read avatars" ON storage.objects;
CREATE POLICY "Authenticated users can read avatars"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'avatars');

-- ──────────────────────────────────────────────────────────────────────
-- FIX P2 #13 : table webauthn_credentials pour FIDO2
-- ──────────────────────────────────────────────────────────────────────
-- Schéma calé sur SimpleWebAuthn — le serveur stocke credential_id,
-- public_key, counter, transports, et associe la credential à un member.
-- Les challenges sont stockés dans une table à part avec TTL court.

CREATE TABLE IF NOT EXISTS webauthn_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,

  -- credential_id encodé en base64url (binaire en interne dans WebAuthn)
  credential_id TEXT NOT NULL UNIQUE,
  -- public_key au format COSE (base64url)
  public_key TEXT NOT NULL,
  -- compteur incrémenté à chaque assertion (anti-clonage du token)
  counter BIGINT NOT NULL DEFAULT 0,
  -- transports supportés : "usb", "nfc", "ble", "internal", "hybrid"
  transports TEXT[],
  -- type de device pour distinguer plateforme/cross-plateforme
  credential_device_type TEXT,
  credential_backed_up BOOLEAN NOT NULL DEFAULT FALSE,

  -- libellé pour distinguer plusieurs credentials du même membre
  -- (ex : "Tablette salle 1", "Empreinte iPhone")
  nickname TEXT,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webauthn_credentials_member ON webauthn_credentials(member_id);
CREATE INDEX IF NOT EXISTS idx_webauthn_credentials_credid ON webauthn_credentials(credential_id);

ALTER TABLE webauthn_credentials ENABLE ROW LEVEL SECURITY;

-- SELECT : un membre voit ses propres credentials, les gestionnaires voient tout
DROP POLICY IF EXISTS "webauthn_select" ON webauthn_credentials;
CREATE POLICY "webauthn_select" ON webauthn_credentials
  FOR SELECT TO authenticated
  USING (
    is_admin_or_gestionnaire()
    OR member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
  );

-- INSERT : ouvert aux gestionnaires (enrôlement assisté) ou au membre lui-même
DROP POLICY IF EXISTS "webauthn_insert" ON webauthn_credentials;
CREATE POLICY "webauthn_insert" ON webauthn_credentials
  FOR INSERT TO authenticated
  WITH CHECK (
    is_admin_or_gestionnaire()
    OR member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
  );

-- UPDATE : seul le serveur (service_role) met à jour le counter / last_used_at
-- pas de policy UPDATE pour authenticated → tout passe par service_role
DROP POLICY IF EXISTS "webauthn_update" ON webauthn_credentials;

-- DELETE : un membre peut révoquer ses credentials, gestionnaire peut tout révoquer
DROP POLICY IF EXISTS "webauthn_delete" ON webauthn_credentials;
CREATE POLICY "webauthn_delete" ON webauthn_credentials
  FOR DELETE TO authenticated
  USING (
    is_admin_or_gestionnaire()
    OR member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
  );

-- ──────────────────────────────────────────────────────────────────────
-- Table de challenges WebAuthn (TTL 5 min, auto-purge)
-- ──────────────────────────────────────────────────────────────────────
-- Les challenges sont nonces utilisés UNE seule fois pour prévenir le
-- replay. On les stocke côté serveur le temps de l'aller-retour navigateur.

CREATE TABLE IF NOT EXISTS webauthn_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  -- 'registration' | 'authentication'
  kind TEXT NOT NULL,
  challenge TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes'),
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_member ON webauthn_challenges(member_id);
CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_expires ON webauthn_challenges(expires_at);

ALTER TABLE webauthn_challenges ENABLE ROW LEVEL SECURITY;

-- Aucune policy → seul service_role peut accéder (les challenges ne
-- doivent jamais être visibles côté client).

COMMENT ON TABLE webauthn_credentials IS
  'Credentials FIDO2/WebAuthn enrôlées par les membres pour authentification matérielle (audit #13).';
COMMENT ON TABLE webauthn_challenges IS
  'Challenges WebAuthn temporaires (5 min). Anti-replay. Accès service_role uniquement.';

-- Pas de trigger d'audit sur webauthn_challenges (volume + données sensibles).
CREATE TRIGGER audit_webauthn_credentials AFTER INSERT OR UPDATE OR DELETE ON webauthn_credentials
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
