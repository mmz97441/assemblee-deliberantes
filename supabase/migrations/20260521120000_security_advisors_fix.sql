-- ============================================================
-- Migration 00038 : Fix advisors de sécurité Supabase
--
-- Corrige les 3 catégories de warnings remontés par l'advisor
-- de sécurité Supabase (`get_advisors type=security`) :
--
--   (1) `function_search_path_mutable` (9 fonctions) — search_path
--       non figé, un attaquant pourrait potentiellement injecter
--       un schéma malveillant avant `public`. Fix : ALTER FUNCTION
--       ... SET search_path = public, pg_temp.
--
--   (2) `anon_security_definer_function_executable` (6 fonctions) —
--       fonctions SECURITY DEFINER appelables par anon via
--       /rest/v1/rpc/. Pour les trigger functions (jamais appelées
--       directement), on revoke pour tout le monde. Pour les helpers
--       RLS, on revoke uniquement pour anon + PUBLIC, mais on garde
--       EXECUTE pour authenticated (sinon les policies RLS qui
--       appellent ces helpers plantent avec "permission denied").
--
--   (3) `rls_policy_always_true` sur recusations_insert — la
--       migration 00002 avait créé `recusations_select` +
--       `recusations_insert` (WITH CHECK true). La 00016 les a
--       remplacées par `recusations_select_all`, `recusations_insert_self`
--       et `recusations_manage_admin` MAIS sans dropper les
--       anciennes. Résultat : 5 policies coexistent en base et la
--       permissive est toujours active. On supprime les obsolètes.
-- ============================================================

-- ─── (1) search_path figé sur les 9 fonctions ────────────────
-- pg_temp est ajouté pour éviter les recherches dans les schémas
-- temporaires (référence Postgres officielle).
ALTER FUNCTION public.update_updated_at()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.cleanup_rate_limits()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.get_user_role()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.is_super_admin()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.is_admin_or_gestionnaire()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.check_pv_immutable()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.is_document_writer()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.is_pv_drafter_for_seance(uuid)
  SET search_path = public, pg_temp;
ALTER FUNCTION public.audit_trigger_func()
  SET search_path = public, pg_temp;

-- ─── (2a) Trigger functions : REVOKE EXECUTE pour tous ───────
-- Ces fonctions ne sont JAMAIS appelées directement (ni RPC ni
-- policy RLS) — uniquement par des triggers. Les triggers
-- s'exécutent avec les droits du owner (postgres), pas du caller.
REVOKE EXECUTE ON FUNCTION public.audit_trigger_func()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_rate_limits()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_pv_immutable()
  FROM PUBLIC, anon, authenticated;

-- ─── (2b) Helpers RLS : REVOKE FROM anon + PUBLIC seulement ──
-- IMPORTANT : on NE PEUT PAS revoke pour authenticated parce que
-- ces helpers sont référencés dans des policies RLS sur des
-- tables accédées par authenticated (members, seances, votes,
-- audit_log, etc.). Revoke FROM authenticated ferait planter
-- toutes les requêtes authentifiées avec :
--   ERROR: permission denied for function is_admin_or_gestionnaire
REVOKE EXECUTE ON FUNCTION public.get_user_role()
  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin()
  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_gestionnaire()
  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_document_writer()
  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_pv_drafter_for_seance(uuid)
  FROM PUBLIC, anon;

-- ─── (3) Nettoyage policies recusations obsolètes ────────────
-- Créées par 00002 (trop permissives), remplacées par 00016 sans
-- DROP préalable. À supprimer pour ne garder que :
--   - recusations_select_all (lecture authentifiée)
--   - recusations_insert_self (auto-récusation par l'élu)
--   - recusations_manage_admin (gestion par super_admin /
--     gestionnaire / président)
DROP POLICY IF EXISTS "recusations_select" ON public.recusations;
DROP POLICY IF EXISTS "recusations_insert" ON public.recusations;
