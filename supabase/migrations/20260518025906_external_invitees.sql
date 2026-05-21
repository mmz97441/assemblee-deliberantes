-- ============================================================
-- Migration 20260518025906 : PLACEHOLDER (FOSSILE)
--
-- Cette version a été appliquée en base distante via MCP Supabase
-- depuis une autre session Claude, créant une table
-- `external_invitees` qui n'a JAMAIS été référencée par le code
-- applicatif (0 ligne en prod, aucun import côté src/).
--
-- La table a ensuite été supprimée par
-- 20260518045641_revert_external_invitees.sql et remplacée par la
-- bonne version :
-- 20260518050228_invites.sql (table `invites` couvrant le besoin
-- réel d'invités externes à une séance, distincts des convocataires).
--
-- Fichier conservé pour aligner schema_migrations (remote) avec
-- supabase/migrations/ (local). Ne PAS ré-introduire la table.
-- ============================================================

-- no-op (table supprimée par la migration suivante)
SELECT 1;
