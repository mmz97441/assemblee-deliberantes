import { cookies } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { UserRole } from '@/lib/supabase/types'
import { getUserRole } from '@/lib/auth/get-user-role'

const OVERRIDABLE_ROLES: UserRole[] = [
  'gestionnaire',
  'president',
  'secretaire_seance',
  'elu',
  'preparateur',
]

/**
 * Retourne le rôle effectif de l'utilisateur courant.
 *
 * SÉCURITÉ : Le rôle est lu depuis la table `members` (vérifié), pas
 * depuis `user_metadata.role` qui est modifiable côté client. Ne JAMAIS
 * passer un rôle issu de `user_metadata` à cette fonction.
 *
 * Pour les super_admins, supporte un override via cookie `dev_role_override`
 * pour permettre la prévisualisation des autres rôles sans changer le rôle
 * en base. L'override n'est appliqué que si le RÔLE RÉEL en DB est super_admin.
 */
export async function getEffectiveRole(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const dbRole = await getUserRole(supabase, userId)
  if (!dbRole) return 'elu' // fallback sûr si pas d'entrée members

  if (dbRole !== 'super_admin') return dbRole

  // Le rôle réel en DB est super_admin → l'override par cookie est autorisé.
  try {
    const cookieStore = await cookies()
    const override = cookieStore.get('dev_role_override')?.value
    if (override && OVERRIDABLE_ROLES.includes(override as UserRole)) {
      return override
    }
  } catch {
    // cookies() not available (e.g. during static generation)
  }
  return dbRole
}
