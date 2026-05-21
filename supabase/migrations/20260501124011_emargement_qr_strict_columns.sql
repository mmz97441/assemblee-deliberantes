-- ============================================================
-- Migration 20260501124011 : PLACEHOLDER
--
-- Cette version a été appliquée en base distante via MCP Supabase
-- en deux étapes (1124001 + 1124011) parce qu'ALTER TYPE ADD
-- VALUE doit committer avant d'être utilisable.
--
-- Le contenu équivalent est intégralement appliqué par
-- 20260501124001_emargement_qr_value.sql côté repo local (un
-- seul fichier qui combine l'ADD VALUE et les ALTER TABLE).
--
-- Fichier conservé pour aligner schema_migrations (remote) avec
-- supabase/migrations/ (local).
-- ============================================================

-- no-op
SELECT 1;
