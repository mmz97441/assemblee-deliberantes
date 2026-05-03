import type { UserRole } from '@/lib/supabase/types'

// Les 4 rôles « privilégiés » qui ont les mêmes droits fonctionnels :
// lecture totale + gestion ODJ/PJ/convocations/PV/configuration.
// Différence avec super_admin : seul super_admin gère les autres
// super_admins, l'audit log redactions, et les opérations sécurité technique.
export const PRIVILEGED_ROLES: UserRole[] = [
  'super_admin',
  'gestionnaire',
  'dgs',
  'directeur_cabinet',
]

// Les rôles « bureau de séance » qui ont une visibilité opérationnelle
// pendant la séance (présences, votes, PV brouillon).
export const BUREAU_ROLES: UserRole[] = ['president', 'secretaire_seance']

// Hiérarchie utilisée pour hasMinRole — l'ordre représente le niveau
// croissant de privilège fonctionnel.
const ROLE_HIERARCHY: UserRole[] = [
  'preparateur',
  'elu',
  'secretaire_seance',
  'president',
  'gestionnaire',
  'directeur_cabinet',
  'dgs',
  'super_admin',
]

/** Vérifie si un rôle a au moins le niveau requis */
export function hasMinRole(userRole: UserRole, requiredRole: UserRole): boolean {
  const userLevel = ROLE_HIERARCHY.indexOf(userRole)
  const requiredLevel = ROLE_HIERARCHY.indexOf(requiredRole)
  return userLevel >= requiredLevel
}

/** Vérifie si un rôle est dans une liste de rôles autorisés */
export function hasRole(userRole: UserRole, allowedRoles: UserRole[]): boolean {
  return allowedRoles.includes(userRole)
}

/** Vrai si le rôle fait partie des 4 rôles privilégiés (SA, gest, DGS, dir cab) */
export function isPrivileged(userRole: UserRole | string | null | undefined): boolean {
  if (!userRole) return false
  return PRIVILEGED_ROLES.includes(userRole as UserRole)
}

/** Vrai si le rôle est dans le bureau de séance (président ou secrétaire) */
export function isBureau(userRole: UserRole | string | null | undefined): boolean {
  if (!userRole) return false
  return BUREAU_ROLES.includes(userRole as UserRole)
}

/** Labels des rôles en français */
export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super-administrateur',
  dgs: 'Directeur Général des Services',
  directeur_cabinet: 'Directeur de cabinet',
  president: 'Président de séance',
  gestionnaire: 'Gestionnaire',
  secretaire_seance: 'Secrétaire de séance',
  elu: 'Élu / Membre votant',
  preparateur: 'Agent préparateur',
}

/**
 * Description courte du rôle — affichée à l'invité sur la page
 * d'activation du compte (/invite/confirm).
 */
export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  super_admin: 'Vous aurez accès à toutes les fonctionnalités, y compris la configuration technique et la gestion des autres super-administrateurs.',
  dgs: 'Vous aurez une vue complète sur l\'activité de l\'institution et pourrez préparer/valider tous les dossiers et documents.',
  directeur_cabinet: 'Vous aurez une vue complète sur l\'activité et pourrez préparer/valider les dossiers stratégiques.',
  president: 'Vous présiderez les séances, validerez les votes et signerez les procès-verbaux.',
  gestionnaire: 'Vous préparerez les séances, gérerez les convocations et superviserez le déroulement.',
  secretaire_seance: 'Vous tiendrez les notes en séance et préparerez les procès-verbaux.',
  elu: 'Vous serez convoqué aux séances, vous voterez et consulterez les procès-verbaux publiés.',
  preparateur: 'Vous préparerez les dossiers et l\'ordre du jour des séances.',
}

/**
 * Rôles que chaque profil peut inviter (matrice d'invitation).
 * - super_admin : peut tout inviter
 * - DGS / Directeur de cabinet : peuvent inviter tout sauf super_admin
 * - gestionnaire : peut inviter les rôles opérationnels
 */
export const INVITABLE_ROLES: Record<string, UserRole[]> = {
  super_admin: [
    'super_admin', 'dgs', 'directeur_cabinet', 'president',
    'gestionnaire', 'secretaire_seance', 'elu', 'preparateur',
  ],
  dgs: [
    'dgs', 'directeur_cabinet', 'president',
    'gestionnaire', 'secretaire_seance', 'elu', 'preparateur',
  ],
  directeur_cabinet: [
    'directeur_cabinet', 'president',
    'gestionnaire', 'secretaire_seance', 'elu', 'preparateur',
  ],
  gestionnaire: ['president', 'secretaire_seance', 'elu', 'preparateur'],
}
