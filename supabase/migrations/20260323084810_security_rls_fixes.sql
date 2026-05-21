-- ============================================================
-- Migration 00008: Sécurité RLS renforcée + intégrité votes
--
-- Fix 1: presences — gestionnaire OR self+convoqué (Option D)
-- Fix 2: bulletins_vote — vote OUVERT + convoqué + member check
-- Fix 3: votes — UPDATE seulement si OUVERT
-- Fix 4: séances — DELETE seulement BROUILLON
-- Fix 5: bulletins_secret + votes_participation sécurisés
-- ============================================================

-- ============================================================
-- FIX 1: PRESENCES — Option D (gestionnaire OR self+convoqué)
-- ============================================================

-- Supprimer les politiques existantes permissives
DROP POLICY IF EXISTS "presences_insert" ON presences;
DROP POLICY IF EXISTS "presences_update" ON presences;
DROP POLICY IF EXISTS "presences_manage" ON presences;

-- Gestionnaire peut gérer toutes les présences
CREATE POLICY "presences_manage_admin" ON presences
  FOR ALL TO authenticated
  USING (is_admin_or_gestionnaire())
  WITH CHECK (is_admin_or_gestionnaire());

-- Élu peut marquer SEULEMENT sa propre présence, SI convoqué
CREATE POLICY "presences_self_insert" ON presences
  FOR INSERT TO authenticated
  WITH CHECK (
    -- member_id doit correspondre au membre authentifié
    member_id IN (
      SELECT m.id FROM members m WHERE m.user_id = auth.uid()
    )
    -- ET doit être convoqué à cette séance
    AND EXISTS (
      SELECT 1 FROM convocataires c
      WHERE c.member_id = (SELECT m.id FROM members m WHERE m.user_id = auth.uid() LIMIT 1)
      AND c.seance_id = seance_id
    )
  );

-- Élu peut mettre à jour uniquement sa propre présence
CREATE POLICY "presences_self_update" ON presences
  FOR UPDATE TO authenticated
  USING (
    member_id IN (
      SELECT m.id FROM members m WHERE m.user_id = auth.uid()
    )
  )
  WITH CHECK (
    member_id IN (
      SELECT m.id FROM members m WHERE m.user_id = auth.uid()
    )
  );

-- ============================================================
-- FIX 2: BULLETINS_VOTE — vote OUVERT + convoqué + member check
-- ============================================================

DROP POLICY IF EXISTS "bulletins_vote_insert" ON bulletins_vote;
DROP POLICY IF EXISTS "bulletins_vote_select" ON bulletins_vote;
DROP POLICY IF EXISTS "bulletins_vote_manage" ON bulletins_vote;

-- INSERT seulement si: vote OUVERT + (gestionnaire OU propre member_id + convoqué)
CREATE POLICY "bulletins_vote_insert_secure" ON bulletins_vote
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Gestionnaire peut insérer (saisie agrégée main levée)
    is_admin_or_gestionnaire()
    OR (
      -- Vote individuel: doit être pour son propre member_id
      member_id IN (SELECT m.id FROM members m WHERE m.user_id = auth.uid())
      -- Vote doit être OUVERT
      AND EXISTS (
        SELECT 1 FROM votes v WHERE v.id = vote_id AND v.statut = 'OUVERT'
      )
      -- Membre doit être convoqué à la séance du vote
      AND EXISTS (
        SELECT 1 FROM votes v
        JOIN convocataires c ON c.seance_id = v.seance_id
        WHERE v.id = vote_id
        AND c.member_id = (SELECT m.id FROM members m WHERE m.user_id = auth.uid() LIMIT 1)
      )
    )
  );

-- SELECT: tout le monde peut lire (transparence)
CREATE POLICY "bulletins_vote_select" ON bulletins_vote
  FOR SELECT TO authenticated USING (true);

-- PAS de UPDATE ni DELETE (INSERT-ONLY)

-- ============================================================
-- FIX 3: VOTES — UPDATE seulement si OUVERT
-- ============================================================

DROP POLICY IF EXISTS "votes_insert" ON votes;
DROP POLICY IF EXISTS "votes_update" ON votes;
DROP POLICY IF EXISTS "votes_manage" ON votes;

-- Gestionnaire peut créer un vote
CREATE POLICY "votes_insert" ON votes
  FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_gestionnaire());

-- Gestionnaire peut modifier SEULEMENT les votes OUVERTS (clôture/annulation)
CREATE POLICY "votes_update_open_only" ON votes
  FOR UPDATE TO authenticated
  USING (is_admin_or_gestionnaire() AND statut = 'OUVERT')
  WITH CHECK (is_admin_or_gestionnaire());

-- Tout le monde peut lire (la politique SELECT existante reste)
-- (votes_select existe déjà dans 00002)

-- ============================================================
-- FIX 4: SÉANCES — DELETE seulement BROUILLON
-- ============================================================

DROP POLICY IF EXISTS "seances_delete" ON seances;

-- Seule suppression autorisée : séances en brouillon
CREATE POLICY "seances_delete_brouillon" ON seances
  FOR DELETE TO authenticated
  USING (is_admin_or_gestionnaire() AND statut = 'BROUILLON');

-- ============================================================
-- FIX 5: VOTES_PARTICIPATION — sécurisé
-- ============================================================

DROP POLICY IF EXISTS "votes_participation_insert" ON votes_participation;
DROP POLICY IF EXISTS "votes_participation_select" ON votes_participation;
DROP POLICY IF EXISTS "votes_participation_manage" ON votes_participation;

-- INSERT: gestionnaire OU propre member_id + vote OUVERT
CREATE POLICY "votes_participation_insert_secure" ON votes_participation
  FOR INSERT TO authenticated
  WITH CHECK (
    is_admin_or_gestionnaire()
    OR (
      member_id IN (SELECT m.id FROM members m WHERE m.user_id = auth.uid())
      AND EXISTS (SELECT 1 FROM votes v WHERE v.id = vote_id AND v.statut = 'OUVERT')
    )
  );

-- SELECT: transparence
CREATE POLICY "votes_participation_select" ON votes_participation
  FOR SELECT TO authenticated USING (true);

-- PAS de UPDATE ni DELETE (INSERT-ONLY)

-- ============================================================
-- FIX 6: BULLETINS_SECRET — seulement si vote OUVERT
-- ============================================================

DROP POLICY IF EXISTS "bulletins_secret_insert" ON bulletins_secret;
DROP POLICY IF EXISTS "bulletins_secret_select" ON bulletins_secret;
DROP POLICY IF EXISTS "bulletins_secret_manage" ON bulletins_secret;

-- INSERT: seulement si le vote est OUVERT (pas de check member — c'est anonyme)
CREATE POLICY "bulletins_secret_insert_secure" ON bulletins_secret
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM votes v WHERE v.id = vote_id AND v.statut = 'OUVERT')
  );

-- SELECT: transparence (les bulletins sont chiffrés, pas de fuite)
CREATE POLICY "bulletins_secret_select" ON bulletins_secret
  FOR SELECT TO authenticated USING (true);

-- PAS de UPDATE ni DELETE (INSERT-ONLY)
