import type { UserRole } from '@/lib/supabase/types'

// Hierarchie des roles (index = niveau de privilege)
const ROLE_HIERARCHY: UserRole[] = [
  'preparateur',
  'elu',
  'secretaire_seance',
  'gestionnaire',
  'president',
  'super_admin',
]

/**
 * Verifie si un role a au moins le niveau requis
 */
export function hasMinRole(userRole: UserRole, requiredRole: UserRole): boolean {
  const userLevel = ROLE_HIERARCHY.indexOf(userRole)
  const requiredLevel = ROLE_HIERARCHY.indexOf(requiredRole)
  return userLevel >= requiredLevel
}

/**
 * Verifie si un role est dans une liste de roles autorises
 */
export function hasRole(userRole: UserRole, allowedRoles: UserRole[]): boolean {
  return allowedRoles.includes(userRole)
}

/**
 * Labels des roles en francais
 */
export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super-administrateur',
  president: 'President de seance',
  gestionnaire: 'Gestionnaire',
  secretaire_seance: 'Secretaire de seance',
  elu: 'Elu / Membre votant',
  preparateur: 'Agent preparateur',
}

/**
 * Roles que chaque profil peut inviter
 */
export const INVITABLE_ROLES: Record<string, UserRole[]> = {
  super_admin: ['super_admin', 'president', 'gestionnaire', 'secretaire_seance', 'elu', 'preparateur'],
  gestionnaire: ['elu', 'preparateur'],
}
