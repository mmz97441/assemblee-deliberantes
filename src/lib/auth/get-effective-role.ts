import { cookies } from 'next/headers'
import type { UserRole } from '@/lib/supabase/types'

const OVERRIDABLE_ROLES: UserRole[] = [
  'gestionnaire',
  'president',
  'secretaire_seance',
  'elu',
  'preparateur',
]

/**
 * Returns the effective role for the current user.
 * If the real role is super_admin and a dev override cookie is set,
 * returns the overridden role instead. This allows super_admins to
 * preview the app as different roles without changing their actual role.
 */
export async function getEffectiveRole(realRole: string): Promise<string> {
  if (realRole !== 'super_admin') return realRole

  try {
    const cookieStore = await cookies()
    const override = cookieStore.get('dev_role_override')?.value
    if (override && OVERRIDABLE_ROLES.includes(override as UserRole)) {
      return override
    }
  } catch {
    // cookies() not available (e.g. during static generation)
  }
  return realRole
}
