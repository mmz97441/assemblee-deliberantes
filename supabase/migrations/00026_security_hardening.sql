-- ============================================================
-- Migration 00026 : Durcissement sécurité (audit pré-vente)
--
-- Cette migration corrige plusieurs failles identifiées lors de l'audit
-- de sécurité réalisé avant la commercialisation :
--
-- FIX P1 #3  : pv_select / pv_comments_select trop permissifs (brouillons
--              de PV lisibles par tout authentifié → fuite info confidentielle)
-- FIX P1 #8  : presences_self_update permet à un élu de modifier sa
--              propre présence (signature, mode_authentification, heures)
--              après coup → fraude au quorum/à l'authentification
-- FIX P1 #2  : Storage `documents` permet écriture hors arborescence prévue
--              et upsert silencieux par les non-admin → écraser un PV
-- FIX P2 #19 : openVote a une race possible (deux votes OUVERT simultanés
--              sur la même séance) → contrainte d'unicité partielle
--
-- Note : le REVOKE de `encrypted_session_key` et des colonnes PII members
-- a été écarté car il casserait les Server Actions existantes (submitBallot,
-- closeVoteSecret, listes membres) qui utilisent la session utilisateur.
-- Mitigation alternative : les colonnes sensibles ne sont jamais envoyées
-- au client (sélections explicites côté serveur), et un audit de chemin
-- est documenté en suivi pour bascule en service_role.
-- ============================================================

-- ──────────────────────────────────────────────────────────────────────
-- HELPERS : rôles intermédiaires
-- ──────────────────────────────────────────────────────────────────────

-- Vrai si l'utilisateur est dans le bureau de la séance (président
-- effectif ou secrétaire désigné). Utilisé pour autoriser la lecture
-- des brouillons de PV à ces seuls profils, en plus des gestionnaires.
CREATE OR REPLACE FUNCTION is_pv_drafter_for_seance(p_seance_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM seances s
    JOIN members m ON m.user_id = auth.uid()
    WHERE s.id = p_seance_id
      AND m.statut = 'ACTIF'
      AND (
        s.president_effectif_seance_id = m.id
        OR s.secretaire_seance_id = m.id
      )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION is_pv_drafter_for_seance(UUID) IS
  'Vrai si l''utilisateur est président effectif ou secrétaire de la séance — autorisé à voir les brouillons de PV.';

-- ──────────────────────────────────────────────────────────────────────
-- FIX P1 #3 : restreindre la lecture des brouillons de PV
-- ──────────────────────────────────────────────────────────────────────
-- Avant : pv_select USING (true) → tout authentifié voyait les brouillons.
-- Après : seulement les PV en statut publique (SIGNE / PUBLIE / APPROUVE_EN_SEANCE)
-- sont lisibles par tous. Les autres statuts (BROUILLON, EN_RELECTURE, etc.)
-- ne sont visibles qu'aux gestionnaires + bureau de la séance concernée.

DROP POLICY IF EXISTS "pv_select" ON pv;
CREATE POLICY "pv_select" ON pv
  FOR SELECT TO authenticated
  USING (
    statut IN ('SIGNE', 'PUBLIE', 'APPROUVE_EN_SEANCE')
    OR is_admin_or_gestionnaire()
    OR is_pv_drafter_for_seance(seance_id)
  );

-- Idem pour les commentaires de relecture (potentiellement sensibles)
DROP POLICY IF EXISTS "pv_comments_select" ON pv_comments;
CREATE POLICY "pv_comments_select" ON pv_comments
  FOR SELECT TO authenticated
  USING (
    is_admin_or_gestionnaire()
    OR EXISTS (
      SELECT 1 FROM pv WHERE pv.id = pv_comments.pv_id
      AND is_pv_drafter_for_seance(pv.seance_id)
    )
  );

-- ──────────────────────────────────────────────────────────────────────
-- FIX P1 #8 : durcir presences_self_update
-- ──────────────────────────────────────────────────────────────────────
-- Avant : un élu pouvait UPDATE n'importe quelle colonne de SA présence,
-- y compris signature_svg, mode_authentification, heure_arrivee, statut,
-- même après la séance. C'était une porte ouverte à la fraude
-- d'émargement (réécrire son mode d'auth de MANUEL en WEBAUTHN par ex.).
-- Après : on supprime carrément la self-update. Toute modification d'une
-- présence existante passe par le gestionnaire (markPresenceManual).
-- L'élu peut toujours faire un INSERT initial via presences_self_insert.

DROP POLICY IF EXISTS "presences_self_update" ON presences;
-- Pas de remplacement : la mise à jour d'une présence est désormais
-- réservée aux gestionnaires (policy presences_manage_admin déjà en place).

-- ──────────────────────────────────────────────────────────────────────
-- FIX P2 #19 : empêcher 2 votes OUVERTS simultanés sur la même séance
-- ──────────────────────────────────────────────────────────────────────
-- Avant : openVote faisait un check applicatif puis un INSERT — race
-- possible si deux gestionnaires cliquent au même moment.
-- Après : index UNIQUE partiel garantit qu'au plus 1 vote OUVERT par
-- séance peut exister à un instant T. La 2e tentative tombe en erreur
-- 23505 que l'application gère déjà.

CREATE UNIQUE INDEX IF NOT EXISTS idx_votes_one_open_per_seance
  ON votes (seance_id)
  WHERE statut = 'OUVERT';

-- ──────────────────────────────────────────────────────────────────────
-- FIX P1 #2 : durcir l'INSERT/UPDATE Storage documents
-- ──────────────────────────────────────────────────────────────────────
-- Avant : la policy "Managers can upload documents" autorisait tout
-- is_document_writer() à uploader N'IMPORTE OÙ dans le bucket documents,
-- y compris écraser un PDF existant via upsert.
-- Après : on contraint le préfixe (le code utilise toujours "seances/…"
-- ou "deliberations/…"), et on bloque les UPDATE storage (donc les upsert
-- silencieux) pour les rôles non-admin.

DROP POLICY IF EXISTS "Managers can upload documents" ON storage.objects;
CREATE POLICY "Managers can upload documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND is_document_writer()
  AND (
    (storage.foldername(name))[1] IN ('seances', 'deliberations', 'pv', 'note-synthese', 'procurations')
  )
);

-- Bloquer l'UPDATE Storage (upsert silencieux) sauf pour gestionnaires/admin.
-- Sans cette policy, Supabase autorise l'UPDATE par défaut tant que SELECT
-- est ouvert. Avec, seuls les gestionnaires peuvent réellement écraser un
-- objet existant.
DROP POLICY IF EXISTS "Only admins can overwrite documents" ON storage.objects;
CREATE POLICY "Only admins can overwrite documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documents'
  AND is_admin_or_gestionnaire()
)
WITH CHECK (
  bucket_id = 'documents'
  AND is_admin_or_gestionnaire()
);

COMMENT ON POLICY "Managers can upload documents" ON storage.objects IS
  'Limite les uploads dans documents/ aux préfixes attendus (seances, deliberations, pv, note-synthese) — empêche l''écriture en dehors de l''arborescence prévue.';

COMMENT ON POLICY "Only admins can overwrite documents" ON storage.objects IS
  'Empêche un secrétaire/président de remplacer silencieusement un document existant via upsert. Seuls les gestionnaires peuvent overwrite.';
