import type { SupabaseClient } from '@supabase/supabase-js'
import { getUserRole } from '@/lib/auth/get-user-role'

/**
 * SÉCURITÉ : Vérifie que l'utilisateur authentifié a un rôle autorisé,
 * en lisant la valeur RÉELLE depuis la table `members` (pas user_metadata,
 * qui est modifiable côté client par `supabase.auth.updateUser({...})`).
 *
 * Cette fonction est la garde standard pour TOUTES les server actions —
 * elle remplace le pattern `requireRole(user, roles)` qui lisait
 * `user.user_metadata.role` (vulnérable à l'élévation de privilèges).
 *
 * @returns null si autorisé, sinon une chaîne d'erreur à retourner au client.
 */
export async function requireVerifiedRole(
  supabase: SupabaseClient,
  user: { id: string } | null,
  roles: string[]
): Promise<string | null> {
  if (!user) return 'Non authentifié'

  const dbRole = await getUserRole(supabase, user.id)
  if (!dbRole) return 'Permissions insuffisantes'
  if (!roles.includes(dbRole)) return 'Permissions insuffisantes'
  return null
}

/**
 * Variante booléenne — utile pour les branchements conditionnels (lecture
 * autorisée selon le rôle, etc.). Retourne false si user null ou rôle absent.
 */
export async function hasVerifiedRole(
  supabase: SupabaseClient,
  user: { id: string } | null,
  roles: string[]
): Promise<boolean> {
  if (!user) return false
  const dbRole = await getUserRole(supabase, user.id)
  return !!dbRole && roles.includes(dbRole)
}
