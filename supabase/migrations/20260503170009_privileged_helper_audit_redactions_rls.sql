-- ============================================================
-- Migration 20260503170009 : PLACEHOLDER
--
-- Cette version a été appliquée en base distante via MCP Supabase
-- en deux étapes (165932 + 170009) parce que les helpers
-- is_admin_or_gestionnaire / is_document_writer ont été enrichis
-- avec 'dgs' et 'directeur_cabinet', deux nouvelles valeurs
-- d'enum user_role qui doivent committer avant d'être utilisables
-- dans une policy.
--
-- Le contenu équivalent est intégralement appliqué par
-- 20260503165932_roles_dgs_dircab_audit_redactions.sql côté repo
-- local (un seul fichier).
--
-- Fichier conservé pour aligner schema_migrations (remote) avec
-- supabase/migrations/ (local).
-- ============================================================

-- no-op
SELECT 1;
