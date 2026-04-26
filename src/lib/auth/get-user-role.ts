import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * SÉCURITÉ : Récupère le rôle RÉEL de l'utilisateur depuis la table members.
 *
 * user_metadata.role peut être modifié par l'utilisateur via
 * supabase.auth.updateUser({ data: { role: 'super_admin' } }).
 * La table members est protégée par RLS et ne peut être modifiée que par les admins.
 *
 * Cette fonction est utilisée en double vérification sur les actions critiques :
 * - saveInstitutionConfig (configuration)
 * - openVote / closeVoteMainLevee (votes)
 * - updateSeanceStatut (séances)
 * - publishDeliberation (délibérations)
 *
 * @returns Le rôle depuis la table members, ou null si l'utilisateur n'a pas d'entrée members.
 */
export async function getUserRole(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data: member } = await supabase
    .from('members')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle()

  return member?.role || null
}

/**
 * Vérifie que le rôle user_metadata correspond au rôle réel dans la table members.
 * Si divergence, log un avertissement de sécurité et retourne le rôle de la table members.
 *
 * @returns Le rôle vérifié (toujours celui de la table members si disponible)
 */
export async function getVerifiedRole(
  supabase: SupabaseClient,
  userId: string,
  metadataRole: string
): Promise<string> {
  const dbRole = await getUserRole(supabase, userId)

  if (!dbRole) {
    // Pas d'entrée dans members — c'est suspect sauf pour le tout premier setup
    console.warn(
      `[SÉCURITÉ] Utilisateur ${userId} a le rôle metadata "${metadataRole}" mais aucune entrée dans la table members`
    )
    return metadataRole
  }

  if (dbRole !== metadataRole) {
    console.warn(
      `[SÉCURITÉ] DIVERGENCE DE RÔLE détectée pour l'utilisateur ${userId} : ` +
      `user_metadata.role="${metadataRole}" vs members.role="${dbRole}". ` +
      `Utilisation du rôle de la table members (${dbRole}). ` +
      `Tentative possible d'élévation de privilèges.`
    )
  }

  return dbRole
}
