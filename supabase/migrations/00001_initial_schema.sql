-- ============================================================
-- Migration 00001: Schema initial complet
-- Assemblee Deliberantes — Single-tenant
-- ============================================================

-- Extensions necessaires
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE institution_type AS ENUM (
  'commune', 'syndicat', 'cc', 'departement', 'asso'
);

CREATE TYPE user_role AS ENUM (
  'super_admin', 'president', 'gestionnaire', 'secretaire_seance', 'elu', 'preparateur'
);

CREATE TYPE seance_statut AS ENUM (
  'BROUILLON', 'CONVOQUEE', 'EN_COURS', 'SUSPENDUE', 'CLOTUREE', 'ARCHIVEE'
);

CREATE TYPE seance_mode AS ENUM (
  'PRESENTIEL', 'HYBRIDE', 'VISIO'
);

CREATE TYPE presence_statut AS ENUM (
  'PRESENT', 'ABSENT', 'EXCUSE', 'PROCURATION'
);

CREATE TYPE convocation_statut AS ENUM (
  'NON_ENVOYE', 'ENVOYE', 'LU', 'CONFIRME_PRESENT',
  'ABSENT_PROCURATION', 'ERREUR_EMAIL', 'ENVOYE_COURRIER'
);

CREATE TYPE vote_type AS ENUM (
  'MAIN_LEVEE', 'SECRET', 'NOMINAL', 'TELEVOTE'
);

CREATE TYPE vote_statut AS ENUM (
  'OUVERT', 'CLOS', 'ANNULE', 'CONTESTE'
);

CREATE TYPE vote_resultat AS ENUM (
  'ADOPTE', 'REJETE', 'NUL', 'ADOPTE_UNANIMITE', 'ADOPTE_VOIX_PREPONDERANTE'
);

CREATE TYPE pv_statut AS ENUM (
  'BROUILLON', 'EN_RELECTURE', 'APPROUVE_EN_SEANCE', 'SIGNE', 'PUBLIE'
);

CREATE TYPE member_statut AS ENUM (
  'ACTIF', 'SUSPENDU', 'FIN_DE_MANDAT', 'DECEDE'
);

CREATE TYPE odj_point_type AS ENUM (
  'DELIBERATION', 'INFORMATION', 'QUESTION_DIVERSE', 'ELECTION', 'APPROBATION_PV'
);

CREATE TYPE majorite_requise AS ENUM (
  'SIMPLE', 'ABSOLUE', 'QUALIFIEE', 'UNANIMITE'
);

CREATE TYPE late_arrival_mode AS ENUM (
  'STRICT', 'SOUPLE', 'SUSPENDU'
);

CREATE TYPE quorum_type AS ENUM (
  'MAJORITE_MEMBRES', 'TIERS_MEMBRES', 'DEUX_TIERS', 'STATUTS'
);

CREATE TYPE mode_authentification AS ENUM (
  'WEBAUTHN', 'PIN', 'MANUEL', 'ASSISTE'
);

-- ============================================================
-- TABLE: institution_config
-- Configuration globale de l'institution (single-tenant)
-- ============================================================

CREATE TABLE institution_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nom_officiel TEXT NOT NULL,
  type_institution institution_type NOT NULL,
  siren TEXT,
  siret TEXT,
  adresse_siege TEXT,
  email_secretariat TEXT,
  telephone TEXT,
  logo_url TEXT,
  signature_president_url TEXT,
  dpo_nom TEXT,
  dpo_email TEXT,
  url_portail_public TEXT,
  prefecture_rattachement TEXT,
  session_timeout_heures INTEGER DEFAULT 8,
  otp_expiration_minutes INTEGER DEFAULT 8,
  tentatives_login_max INTEGER DEFAULT 5,
  longueur_mdp_min INTEGER DEFAULT 12,
  format_numero_deliberation TEXT DEFAULT 'AAAA-NNN',
  prefixe_numero_deliberation TEXT,
  remise_zero_annuelle BOOLEAN DEFAULT TRUE,
  numero_depart INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: instance_config
-- Configuration par instance (Bureau, Conseil, Commissions...)
-- ============================================================

CREATE TABLE instance_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nom TEXT NOT NULL,
  type_legal TEXT NOT NULL,
  composition_max INTEGER,
  delai_convocation_jours INTEGER DEFAULT 5,
  quorum_type quorum_type DEFAULT 'MAJORITE_MEMBRES',
  quorum_fraction_numerateur INTEGER DEFAULT 1,
  quorum_fraction_denominateur INTEGER DEFAULT 2,
  voix_preponderante BOOLEAN DEFAULT FALSE,
  vote_secret_nominations BOOLEAN DEFAULT TRUE,
  mode_arrivee_tardive late_arrival_mode DEFAULT 'SOUPLE',
  seances_publiques_defaut BOOLEAN DEFAULT TRUE,
  votes_qd_autorises BOOLEAN DEFAULT FALSE,
  majorite_defaut majorite_requise DEFAULT 'SIMPLE',
  actif BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: rappels_config
-- Rappels configurables par instance
-- ============================================================

CREATE TABLE rappels_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instance_config_id UUID REFERENCES instance_config(id) ON DELETE CASCADE,
  actif BOOLEAN DEFAULT TRUE,
  ordre INTEGER NOT NULL,
  delai_valeur INTEGER NOT NULL,
  delai_unite TEXT NOT NULL CHECK (delai_unite IN ('jours', 'heures')),
  canaux TEXT[] DEFAULT '{"email"}',
  destinataires TEXT DEFAULT 'tous' CHECK (destinataires IN ('tous', 'non_confirmes', 'confirmes')),
  template_sujet TEXT,
  template_corps TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: members
-- Membres de l'institution (jamais de suppression physique)
-- ============================================================

CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  email TEXT NOT NULL,
  telephone TEXT,
  adresse_postale TEXT,
  qualite_officielle TEXT,
  role user_role NOT NULL DEFAULT 'elu',
  statut member_statut DEFAULT 'ACTIF',
  groupe_politique TEXT,
  webauthn_credential_id TEXT,
  device_id TEXT,
  mandat_debut DATE,
  mandat_fin DATE,
  preferences_notification JSONB DEFAULT '{"email": true, "sms": true, "in_app": true}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: members_versions
-- Versioning des membres (jamais d'ecrasement)
-- ============================================================

CREATE TABLE members_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id UUID NOT NULL REFERENCES members(id),
  data JSONB NOT NULL,
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  modified_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: instance_members
-- Association membres <-> instances (N:N)
-- ============================================================

CREATE TABLE instance_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instance_config_id UUID NOT NULL REFERENCES instance_config(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id),
  fonction_dans_instance TEXT,
  actif BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(instance_config_id, member_id)
);

-- ============================================================
-- TABLE: seances
-- Seances de l'institution
-- ============================================================

CREATE TABLE seances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  instance_id UUID NOT NULL REFERENCES instance_config(id),
  titre TEXT NOT NULL,
  date_seance TIMESTAMPTZ NOT NULL,
  lieu TEXT,
  mode seance_mode DEFAULT 'PRESENTIEL',
  statut seance_statut DEFAULT 'BROUILLON',
  quorum_requis INTEGER,
  quorum_atteint INTEGER DEFAULT 0,
  voix_preponderante BOOLEAN DEFAULT FALSE,
  late_arrival_mode late_arrival_mode DEFAULT 'SOUPLE',
  publique BOOLEAN DEFAULT TRUE,
  secretaire_seance_id UUID REFERENCES members(id),
  president_effectif_seance_id UUID REFERENCES members(id),
  heure_ouverture TIMESTAMPTZ,
  heure_cloture TIMESTAMPTZ,
  reconvocation BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: convocataires
-- Convocations envoyees par seance
-- ============================================================

CREATE TABLE convocataires (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seance_id UUID NOT NULL REFERENCES seances(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id),
  statut_convocation convocation_statut DEFAULT 'NON_ENVOYE',
  token_confirmation UUID DEFAULT uuid_generate_v4(),
  envoye_at TIMESTAMPTZ,
  lu_at TIMESTAMPTZ,
  confirme_at TIMESTAMPTZ,
  ar_recu_at TIMESTAMPTZ,
  canal_communication TEXT DEFAULT 'email',
  erreur_detail TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(seance_id, member_id)
);

-- ============================================================
-- TABLE: odj_points
-- Points de l'ordre du jour
-- ============================================================

CREATE TABLE odj_points (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seance_id UUID NOT NULL REFERENCES seances(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  titre TEXT NOT NULL,
  description TEXT,
  type_traitement odj_point_type DEFAULT 'DELIBERATION',
  huis_clos BOOLEAN DEFAULT FALSE,
  votes_interdits BOOLEAN DEFAULT FALSE,
  rapporteur_id UUID REFERENCES members(id),
  majorite_requise majorite_requise DEFAULT 'SIMPLE',
  statut TEXT DEFAULT 'A_TRAITER' CHECK (statut IN ('A_TRAITER', 'EN_COURS', 'TRAITE', 'REPORTE')),
  notes_seance TEXT,
  source_bureau_deliberation_id UUID,
  documents JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: presences
-- Emargement et presences
-- ============================================================

CREATE TABLE presences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seance_id UUID NOT NULL REFERENCES seances(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id),
  statut presence_statut DEFAULT 'ABSENT',
  heure_arrivee TIMESTAMPTZ,
  heure_depart TIMESTAMPTZ,
  signature_svg TEXT,
  biometrie_hash TEXT,
  hash_document TEXT,
  horodatage_serveur TIMESTAMPTZ DEFAULT NOW(),
  timestamp_tsa TEXT,
  device_id TEXT,
  webauthn_assertion_id TEXT,
  mode_authentification mode_authentification,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(seance_id, member_id)
);

-- ============================================================
-- TABLE: recusations
-- Conflits d'interet
-- ============================================================

CREATE TABLE recusations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seance_id UUID NOT NULL REFERENCES seances(id),
  odj_point_id UUID NOT NULL REFERENCES odj_points(id),
  member_id UUID NOT NULL REFERENCES members(id),
  motif TEXT,
  declared_by UUID REFERENCES auth.users(id),
  horodatage TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(odj_point_id, member_id)
);

-- ============================================================
-- TABLE: votes
-- Scrutins
-- ============================================================

CREATE TABLE votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  odj_point_id UUID NOT NULL REFERENCES odj_points(id),
  seance_id UUID NOT NULL REFERENCES seances(id),
  type_vote vote_type DEFAULT 'MAIN_LEVEE',
  statut vote_statut DEFAULT 'OUVERT',
  question TEXT,
  pour INTEGER DEFAULT 0,
  contre INTEGER DEFAULT 0,
  abstention INTEGER DEFAULT 0,
  nul INTEGER DEFAULT 0,
  total_votants INTEGER DEFAULT 0,
  quorum_a_ouverture INTEGER NOT NULL,
  voix_preponderante_activee BOOLEAN DEFAULT FALSE,
  resultat vote_resultat,
  formule_pv TEXT,
  noms_contre TEXT[] DEFAULT '{}',
  noms_abstention TEXT[] DEFAULT '{}',
  ouvert_at TIMESTAMPTZ DEFAULT NOW(),
  clos_at TIMESTAMPTZ,
  hash_integrite TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: bulletins_vote (PUBLIC — avec identite)
-- INSERT ONLY — aucun UPDATE ni DELETE
-- ============================================================

CREATE TABLE bulletins_vote (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vote_id UUID NOT NULL REFERENCES votes(id),
  member_id UUID NOT NULL REFERENCES members(id),
  choix TEXT NOT NULL CHECK (choix IN ('POUR', 'CONTRE', 'ABSTENTION', 'NSVP')),
  horodatage_serveur TIMESTAMPTZ DEFAULT NOW(),
  hash_integrite TEXT NOT NULL,
  nonce TEXT NOT NULL,
  device_id TEXT,
  est_procuration BOOLEAN DEFAULT FALSE,
  mandant_id UUID REFERENCES members(id),
  UNIQUE(vote_id, member_id)
);

-- ============================================================
-- TABLE: votes_participation (VOTE SECRET — qui a vote, sans le choix)
-- INSERT ONLY
-- ============================================================

CREATE TABLE votes_participation (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vote_id UUID NOT NULL REFERENCES votes(id),
  member_id UUID NOT NULL REFERENCES members(id),
  a_vote BOOLEAN DEFAULT TRUE,
  horodatage_serveur TIMESTAMPTZ DEFAULT NOW(),
  device_id TEXT,
  UNIQUE(vote_id, member_id)
);

-- ============================================================
-- TABLE: bulletins_secret (VOTE SECRET — le choix, sans identite)
-- INSERT ONLY — JAMAIS de member_id ici
-- ============================================================

CREATE TABLE bulletins_secret (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vote_id UUID NOT NULL REFERENCES votes(id),
  bulletin_token TEXT NOT NULL,
  choix_chiffre TEXT NOT NULL,
  hash_integrite TEXT NOT NULL,
  nonce TEXT NOT NULL,
  horodatage_serveur TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: procurations
-- ============================================================

CREATE TABLE procurations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seance_id UUID NOT NULL REFERENCES seances(id),
  mandant_id UUID NOT NULL REFERENCES members(id),
  mandataire_id UUID NOT NULL REFERENCES members(id),
  valide BOOLEAN DEFAULT TRUE,
  document_url TEXT,
  validee_par UUID REFERENCES auth.users(id),
  validee_at TIMESTAMPTZ,
  cree_par_gestionnaire BOOLEAN DEFAULT FALSE,
  canal_communication TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- 1 procuration max par mandataire par seance (CGCT L2121-20)
  UNIQUE(seance_id, mandataire_id),
  -- 1 mandant ne peut donner qu'1 procuration par seance
  UNIQUE(seance_id, mandant_id)
);

-- ============================================================
-- TABLE: pv
-- Proces-verbaux
-- ============================================================

CREATE TABLE pv (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seance_id UUID NOT NULL REFERENCES seances(id) UNIQUE,
  contenu_json JSONB DEFAULT '{}',
  statut pv_statut DEFAULT 'BROUILLON',
  version INTEGER DEFAULT 1,
  signe_par JSONB DEFAULT '[]',
  signe_at TIMESTAMPTZ,
  pdf_url TEXT,
  approuve_en_seance_id UUID REFERENCES seances(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: deliberations
-- ============================================================

CREATE TABLE deliberations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seance_id UUID NOT NULL REFERENCES seances(id),
  vote_id UUID REFERENCES votes(id),
  odj_point_id UUID REFERENCES odj_points(id),
  numero TEXT,
  titre TEXT NOT NULL,
  contenu_articles JSONB DEFAULT '[]',
  publie_at TIMESTAMPTZ,
  affiche_at TIMESTAMPTZ,
  transmis_prefecture_at TIMESTAMPTZ,
  pdf_url TEXT,
  annulee BOOLEAN DEFAULT FALSE,
  motif_annulation TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: audit_log (APPEND ONLY — jamais effacable)
-- ============================================================

CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: invitations
-- Tokens d'invitation pour nouveaux utilisateurs
-- ============================================================

CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'elu',
  member_id UUID REFERENCES members(id),
  token UUID DEFAULT uuid_generate_v4() UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  used_at TIMESTAMPTZ,
  invited_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: pin_secours
-- PINs de secours par seance (WebAuthn fallback)
-- ============================================================

CREATE TABLE pin_secours (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seance_id UUID NOT NULL REFERENCES seances(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id),
  pin_hash TEXT NOT NULL,
  expire_at TIMESTAMPTZ NOT NULL,
  utilise BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(seance_id, member_id)
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_members_user_id ON members(user_id);
CREATE INDEX idx_members_email ON members(email);
CREATE INDEX idx_members_statut ON members(statut);
CREATE INDEX idx_seances_instance ON seances(instance_id);
CREATE INDEX idx_seances_date ON seances(date_seance);
CREATE INDEX idx_seances_statut ON seances(statut);
CREATE INDEX idx_convocataires_seance ON convocataires(seance_id);
CREATE INDEX idx_convocataires_token ON convocataires(token_confirmation);
CREATE INDEX idx_odj_points_seance ON odj_points(seance_id);
CREATE INDEX idx_odj_points_position ON odj_points(seance_id, position);
CREATE INDEX idx_presences_seance ON presences(seance_id);
CREATE INDEX idx_votes_seance ON votes(seance_id);
CREATE INDEX idx_votes_odj ON votes(odj_point_id);
CREATE INDEX idx_bulletins_vote_vote ON bulletins_vote(vote_id);
CREATE INDEX idx_votes_participation_vote ON votes_participation(vote_id);
CREATE INDEX idx_bulletins_secret_vote ON bulletins_secret(vote_id);
CREATE INDEX idx_procurations_seance ON procurations(seance_id);
CREATE INDEX idx_deliberations_seance ON deliberations(seance_id);
CREATE INDEX idx_deliberations_numero ON deliberations(numero);
CREATE INDEX idx_audit_log_created ON audit_log(created_at);
CREATE INDEX idx_audit_log_table ON audit_log(table_name);
CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_invitations_email ON invitations(email);

-- ============================================================
-- TRIGGER: audit_log automatique
-- ============================================================

CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (action, table_name, record_id, new_values, user_id)
    VALUES ('INSERT', TG_TABLE_NAME, NEW.id, to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log (action, table_name, record_id, old_values, new_values, user_id)
    VALUES ('UPDATE', TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (action, table_name, record_id, old_values, user_id)
    VALUES ('DELETE', TG_TABLE_NAME, OLD.id, to_jsonb(OLD), auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Appliquer le trigger sur toutes les tables metier
CREATE TRIGGER audit_institution_config AFTER INSERT OR UPDATE OR DELETE ON institution_config FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER audit_instance_config AFTER INSERT OR UPDATE OR DELETE ON instance_config FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER audit_members AFTER INSERT OR UPDATE OR DELETE ON members FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER audit_seances AFTER INSERT OR UPDATE OR DELETE ON seances FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER audit_convocataires AFTER INSERT OR UPDATE OR DELETE ON convocataires FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER audit_odj_points AFTER INSERT OR UPDATE OR DELETE ON odj_points FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER audit_presences AFTER INSERT OR UPDATE OR DELETE ON presences FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER audit_votes AFTER INSERT OR UPDATE OR DELETE ON votes FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER audit_bulletins_vote AFTER INSERT OR UPDATE OR DELETE ON bulletins_vote FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER audit_votes_participation AFTER INSERT OR UPDATE OR DELETE ON votes_participation FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER audit_bulletins_secret AFTER INSERT OR UPDATE OR DELETE ON bulletins_secret FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER audit_procurations AFTER INSERT OR UPDATE OR DELETE ON procurations FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER audit_pv AFTER INSERT OR UPDATE OR DELETE ON pv FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER audit_deliberations AFTER INSERT OR UPDATE OR DELETE ON deliberations FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- ============================================================
-- TRIGGER: updated_at automatique
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_institution_config BEFORE UPDATE ON institution_config FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at_instance_config BEFORE UPDATE ON instance_config FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at_members BEFORE UPDATE ON members FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at_seances BEFORE UPDATE ON seances FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at_convocataires BEFORE UPDATE ON convocataires FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at_odj_points BEFORE UPDATE ON odj_points FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at_presences BEFORE UPDATE ON presences FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at_votes BEFORE UPDATE ON votes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at_pv BEFORE UPDATE ON pv FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at_deliberations BEFORE UPDATE ON deliberations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
