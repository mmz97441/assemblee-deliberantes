-- ============================================================
-- Migration 00029 : Historique des envois de convocation (append-only)
--
-- Permet de tracer chaque envoi (initial + tous les renvois) avec :
--  - timestamp précis
--  - motif du renvoi (Email perdu, Spam, Adresse erronée, Autre)
--  - email destinataire au moment de l'envoi (snapshot)
--  - utilisateur qui a déclenché l'envoi
--  - statut Resend (résultat de l'API)
--
-- Conformité CGCT / contrôle de légalité préfectoral :
-- en cas de recours pour défaut de convocation, le préfet peut voir
-- l'intégralité de la chaîne d'envois pour chaque convocataire.
--
-- Table INSERT-ONLY (RLS permet INSERT et SELECT, pas UPDATE/DELETE).
-- ============================================================

CREATE TABLE IF NOT EXISTS convocation_envois (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  convocataire_id UUID NOT NULL REFERENCES convocataires(id) ON DELETE CASCADE,

  -- Numéro d'ordre dans la chaîne d'envois (1 = initial, 2 = 1er renvoi, ...)
  numero_envoi INTEGER NOT NULL,

  -- INITIAL pour le 1er envoi, sinon motif texte
  -- Valeurs UI courantes : 'INITIAL', 'EMAIL_PERDU', 'SPAM', 'ADRESSE_ERRONEE', 'AUTRE'
  motif TEXT NOT NULL DEFAULT 'INITIAL',

  -- Texte libre complémentaire si motif = AUTRE (ou détail sur les autres motifs)
  motif_detail TEXT,

  -- Snapshot de l'email destinataire au moment de l'envoi (utile si l'élu
  -- a changé d'email entre temps — on garde la trace réelle de ce qui a été
  -- envoyé à quelle adresse)
  email_destinataire TEXT NOT NULL,

  -- Statut renvoyé par Resend (success / error)
  statut_resend TEXT NOT NULL DEFAULT 'sent',
  resend_message_id TEXT,
  erreur_detail TEXT,

  -- Qui a déclenché l'envoi (user_id de l'auth)
  envoye_par UUID REFERENCES auth.users(id),

  envoye_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Une convocataire ne peut pas avoir 2 envois avec le même numero
  UNIQUE(convocataire_id, numero_envoi)
);

CREATE INDEX IF NOT EXISTS idx_convocation_envois_convocataire ON convocation_envois(convocataire_id);
CREATE INDEX IF NOT EXISTS idx_convocation_envois_envoye_at ON convocation_envois(envoye_at);

ALTER TABLE convocation_envois ENABLE ROW LEVEL SECURITY;

-- SELECT : visible aux gestionnaires + super_admin (pour rapports + détail séance)
CREATE POLICY "convocation_envois_select" ON convocation_envois
  FOR SELECT TO authenticated
  USING (is_admin_or_gestionnaire());

-- INSERT : ouvert aux rôles qui peuvent envoyer des convocations
-- (gestionnaire, super_admin, président, secrétaire de séance)
CREATE POLICY "convocation_envois_insert" ON convocation_envois
  FOR INSERT TO authenticated
  WITH CHECK (is_document_writer());

-- PAS de UPDATE ni DELETE (table INSERT-ONLY)

-- Audit trigger (capture IP/UA via la fonction enrichie en migration 00027)
CREATE TRIGGER audit_convocation_envois AFTER INSERT OR UPDATE OR DELETE ON convocation_envois
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

COMMENT ON TABLE convocation_envois IS
  'Historique APPEND-ONLY de tous les envois de convocations (initial + renvois). Conforme CGCT pour le contrôle de légalité préfectoral.';
COMMENT ON COLUMN convocation_envois.numero_envoi IS '1 = envoi initial, 2 = 1er renvoi, etc.';
COMMENT ON COLUMN convocation_envois.motif IS 'INITIAL, EMAIL_PERDU, SPAM, ADRESSE_ERRONEE, AUTRE';
