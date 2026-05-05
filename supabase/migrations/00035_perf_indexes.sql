-- ============================================================
-- Migration 00035 : Indexes pour les requêtes membre-centriques
--
-- Plusieurs tables ont une contrainte UNIQUE sur (seance_id, member_id)
-- ou (vote_id, member_id) ce qui crée un index utilisable pour filtrer
-- sur la première colonne ou les deux. Mais les requêtes filtrant sur
-- `member_id` SEUL (ex : « historique d'un élu », « archiver un membre »
-- vérifie ses présences passées) doivent scanner toute la table.
--
-- Ces nouveaux indexes ciblés divisent par 10–100 le temps des requêtes
-- chaudes côté gestionnaire/dashboard. Aucun changement de comportement
-- côté application — pure accélération.
-- ============================================================

-- presences : utilisé par /dashboard (stats élu), archiveMember, /historique
CREATE INDEX IF NOT EXISTS idx_presences_member_id
  ON presences (member_id);

-- convocataires : utilisé par /seances (filtre élu), member archive checks
CREATE INDEX IF NOT EXISTS idx_convocataires_member_id
  ON convocataires (member_id);

-- instance_members : utilisé par toutes les vérifications de bureau
-- (toggleMemberStatus, archiveMember, getMembers)
CREATE INDEX IF NOT EXISTS idx_instance_members_member_id
  ON instance_members (member_id);

-- members_versions : historique d'un membre (RGPD trail, page profil)
CREATE INDEX IF NOT EXISTS idx_members_versions_member_id
  ON members_versions (member_id);

-- audit_log : la page /historique pagine par created_at DESC en filtrant
-- éventuellement par user_id. L'index composite (user_id, created_at DESC)
-- permet la pagination efficace sans tri en mémoire.
CREATE INDEX IF NOT EXISTS idx_audit_log_user_created
  ON audit_log (user_id, created_at DESC);
