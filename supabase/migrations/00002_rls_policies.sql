-- ============================================================
-- Migration 00002: Row Level Security Policies
-- ============================================================

-- Activer RLS sur toutes les tables metier
ALTER TABLE institution_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE instance_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE rappels_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE members_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE instance_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE seances ENABLE ROW LEVEL SECURITY;
ALTER TABLE convocataires ENABLE ROW LEVEL SECURITY;
ALTER TABLE odj_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE presences ENABLE ROW LEVEL SECURITY;
ALTER TABLE recusations ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulletins_vote ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes_participation ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulletins_secret ENABLE ROW LEVEL SECURITY;
ALTER TABLE procurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pv ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliberations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pin_secours ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Helper: recuperer le role du user courant
-- ============================================================

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM members WHERE user_id = auth.uid() AND statut = 'ACTIF' LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_admin_or_gestionnaire()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM members
    WHERE user_id = auth.uid()
    AND statut = 'ACTIF'
    AND role IN ('super_admin', 'gestionnaire')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM members
    WHERE user_id = auth.uid()
    AND statut = 'ACTIF'
    AND role = 'super_admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- POLICIES: institution_config
-- ============================================================

CREATE POLICY "institution_config_select" ON institution_config
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "institution_config_update" ON institution_config
  FOR UPDATE TO authenticated USING (is_super_admin());

-- ============================================================
-- POLICIES: instance_config
-- ============================================================

CREATE POLICY "instance_config_select" ON instance_config
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "instance_config_insert" ON instance_config
  FOR INSERT TO authenticated WITH CHECK (is_super_admin());

CREATE POLICY "instance_config_update" ON instance_config
  FOR UPDATE TO authenticated USING (is_super_admin());

-- ============================================================
-- POLICIES: rappels_config
-- ============================================================

CREATE POLICY "rappels_config_select" ON rappels_config
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "rappels_config_manage" ON rappels_config
  FOR ALL TO authenticated USING (is_admin_or_gestionnaire());

-- ============================================================
-- POLICIES: members
-- ============================================================

CREATE POLICY "members_select" ON members
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "members_insert" ON members
  FOR INSERT TO authenticated WITH CHECK (is_admin_or_gestionnaire());

CREATE POLICY "members_update" ON members
  FOR UPDATE TO authenticated USING (is_admin_or_gestionnaire());

-- ============================================================
-- POLICIES: members_versions
-- ============================================================

CREATE POLICY "members_versions_select" ON members_versions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "members_versions_insert" ON members_versions
  FOR INSERT TO authenticated WITH CHECK (is_admin_or_gestionnaire());

-- ============================================================
-- POLICIES: instance_members
-- ============================================================

CREATE POLICY "instance_members_select" ON instance_members
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "instance_members_manage" ON instance_members
  FOR ALL TO authenticated USING (is_admin_or_gestionnaire());

-- ============================================================
-- POLICIES: seances
-- ============================================================

CREATE POLICY "seances_select" ON seances
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "seances_insert" ON seances
  FOR INSERT TO authenticated WITH CHECK (is_admin_or_gestionnaire());

CREATE POLICY "seances_update" ON seances
  FOR UPDATE TO authenticated USING (is_admin_or_gestionnaire());

-- ============================================================
-- POLICIES: convocataires
-- ============================================================

CREATE POLICY "convocataires_select" ON convocataires
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "convocataires_manage" ON convocataires
  FOR ALL TO authenticated USING (is_admin_or_gestionnaire());

-- ============================================================
-- POLICIES: odj_points
-- ============================================================

CREATE POLICY "odj_points_select" ON odj_points
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "odj_points_manage" ON odj_points
  FOR ALL TO authenticated USING (is_admin_or_gestionnaire());

-- ============================================================
-- POLICIES: presences
-- ============================================================

CREATE POLICY "presences_select" ON presences
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "presences_insert" ON presences
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "presences_update" ON presences
  FOR UPDATE TO authenticated USING (is_admin_or_gestionnaire());

-- ============================================================
-- POLICIES: recusations
-- ============================================================

CREATE POLICY "recusations_select" ON recusations
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "recusations_insert" ON recusations
  FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================
-- POLICIES: votes
-- ============================================================

CREATE POLICY "votes_select" ON votes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "votes_insert" ON votes
  FOR INSERT TO authenticated WITH CHECK (is_admin_or_gestionnaire());

CREATE POLICY "votes_update" ON votes
  FOR UPDATE TO authenticated USING (is_admin_or_gestionnaire());

-- ============================================================
-- POLICIES: bulletins_vote — INSERT ONLY
-- ============================================================

CREATE POLICY "bulletins_vote_select" ON bulletins_vote
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "bulletins_vote_insert" ON bulletins_vote
  FOR INSERT TO authenticated WITH CHECK (true);

-- PAS de UPDATE ni DELETE

-- ============================================================
-- POLICIES: votes_participation — INSERT ONLY
-- ============================================================

CREATE POLICY "votes_participation_select" ON votes_participation
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "votes_participation_insert" ON votes_participation
  FOR INSERT TO authenticated WITH CHECK (true);

-- PAS de UPDATE ni DELETE

-- ============================================================
-- POLICIES: bulletins_secret — INSERT ONLY
-- ============================================================

CREATE POLICY "bulletins_secret_select" ON bulletins_secret
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "bulletins_secret_insert" ON bulletins_secret
  FOR INSERT TO authenticated WITH CHECK (true);

-- PAS de UPDATE ni DELETE

-- ============================================================
-- POLICIES: procurations
-- ============================================================

CREATE POLICY "procurations_select" ON procurations
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "procurations_manage" ON procurations
  FOR ALL TO authenticated USING (is_admin_or_gestionnaire());

-- ============================================================
-- POLICIES: pv
-- ============================================================

CREATE POLICY "pv_select" ON pv
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "pv_insert" ON pv
  FOR INSERT TO authenticated WITH CHECK (is_admin_or_gestionnaire());

CREATE POLICY "pv_update" ON pv
  FOR UPDATE TO authenticated USING (
    is_admin_or_gestionnaire()
    AND statut NOT IN ('SIGNE', 'PUBLIE')
  );

-- ============================================================
-- POLICIES: deliberations
-- ============================================================

CREATE POLICY "deliberations_select" ON deliberations
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "deliberations_insert" ON deliberations
  FOR INSERT TO authenticated WITH CHECK (is_admin_or_gestionnaire());

CREATE POLICY "deliberations_update" ON deliberations
  FOR UPDATE TO authenticated USING (
    is_admin_or_gestionnaire()
    AND publie_at IS NULL
  );

-- ============================================================
-- POLICIES: audit_log — APPEND ONLY
-- ============================================================

CREATE POLICY "audit_log_select" ON audit_log
  FOR SELECT TO authenticated USING (is_super_admin());

-- INSERT via trigger uniquement (SECURITY DEFINER)
-- PAS de UPDATE ni DELETE

-- ============================================================
-- POLICIES: invitations
-- ============================================================

CREATE POLICY "invitations_select" ON invitations
  FOR SELECT TO authenticated USING (is_admin_or_gestionnaire());

CREATE POLICY "invitations_insert" ON invitations
  FOR INSERT TO authenticated WITH CHECK (is_admin_or_gestionnaire());

CREATE POLICY "invitations_update" ON invitations
  FOR UPDATE TO authenticated USING (is_admin_or_gestionnaire());

-- Acces public pour la verification du token (sans auth)
CREATE POLICY "invitations_select_by_token" ON invitations
  FOR SELECT TO anon USING (
    used_at IS NULL
    AND expires_at > NOW()
  );

-- ============================================================
-- POLICIES: pin_secours
-- ============================================================

CREATE POLICY "pin_secours_select" ON pin_secours
  FOR SELECT TO authenticated USING (is_admin_or_gestionnaire());

CREATE POLICY "pin_secours_manage" ON pin_secours
  FOR ALL TO authenticated USING (is_admin_or_gestionnaire());
