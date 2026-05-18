// ============================================
// CONSTANTES CENTRALISEES
// Evite les valeurs magiques et la duplication
// ============================================

// --- Securite ---
export const PASSWORD_MIN_LENGTH = 12
export const MAX_LOGIN_ATTEMPTS = 5
export const INVITATION_EXPIRY_DAYS = 7
export const SESSION_TIMEOUT_HOURS = 8
export const PIN_LENGTH = 6

// --- Routes ---
export const ROUTES = {
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/mot-de-passe-oublie',
  RESET_PASSWORD: '/reset-password',
  PROFIL: '/profil',
  DASHBOARD: '/dashboard',
  CONFIGURATION: '/configuration',
  MEMBRES: '/membres',
  SEANCES: '/seances',
  DELIBERATIONS: '/deliberations',
  INVITE_CONFIRM: '/invite/confirm',
} as const

export const PUBLIC_ROUTES = [
  ROUTES.LOGIN,
  ROUTES.REGISTER,
  '/invite',
  '/invite-seance',
  '/vote',
  '/auth/confirm',
] as const

// ─── Sessions & inactivité ────────────────────────────────────────────────
//
// Politique : pas de timeout absolu (un utilisateur actif reste connecté
// aussi longtemps qu'il travaille), mais déconnexion automatique après
// 1 heure d'inactivité. Et reauth forcé après changement critique
// (email, mot de passe, rôle).
//
// L'utilisateur est averti à -2 min via un popup (WARNING_BEFORE_TIMEOUT_MS)
// pour qu'il puisse sauvegarder son travail s'il était en train de relire
// un PV par exemple.

/** Délai d'inactivité avant déconnexion automatique (1 heure) */
export const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000

/** Délai avant la déconnexion où on affiche le popup d'avertissement (2 min) */
export const WARNING_BEFORE_TIMEOUT_MS = 2 * 60 * 1000

/** Nom du cookie HttpOnly contenant le timestamp de la dernière activité */
export const LAST_ACTIVITY_COOKIE = 'last_activity_at'

// --- Statuts de séance ---
export const SEANCE_STATUT_CONFIG: Record<string, { label: string; color: string; description: string }> = {
  BROUILLON: { label: 'Brouillon', color: 'bg-slate-100 text-slate-700', description: 'En cours de préparation' },
  CONVOQUEE: { label: 'Convoquée', color: 'bg-blue-100 text-blue-700', description: 'Les convocations ont été envoyées' },
  EN_COURS: { label: 'En cours', color: 'bg-emerald-100 text-emerald-700', description: 'La séance est en cours' },
  SUSPENDUE: { label: 'Suspendue', color: 'bg-amber-100 text-amber-700', description: 'La séance est temporairement suspendue' },
  CLOTUREE: { label: 'Clôturée', color: 'bg-purple-100 text-purple-700', description: 'La séance est terminée' },
  ARCHIVEE: { label: 'Archivée', color: 'bg-gray-100 text-gray-500', description: 'Classée dans les archives' },
}

// --- Résultats de vote ---
export const VOTE_RESULTAT_CONFIG: Record<string, { label: string; color: string }> = {
  ADOPTE: { label: 'Adopté', color: 'bg-emerald-100 text-emerald-700' },
  ADOPTE_UNANIMITE: { label: 'Adopté à l\'unanimité', color: 'bg-emerald-100 text-emerald-700' },
  ADOPTE_VOIX_PREPONDERANTE: { label: 'Adopté (voix prépondérante)', color: 'bg-blue-100 text-blue-700' },
  REJETE: { label: 'Rejeté', color: 'bg-red-100 text-red-700' },
  NUL: { label: 'Vote nul', color: 'bg-amber-100 text-amber-700' },
}

// --- Validation ---
// @deprecated — utilisez `validateEmail` / `isValidEmail` de
// @/lib/validators/email à la place. Cette regex est conservée pour
// compatibilité ascendante mais n'est plus la source de vérité (audit
// sécurité #16 : trop permissive, pas de garde anti-CRLF, pas de longueur).
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Parse un nom complet en prenom + nom
 * "Jean Dupont" -> { prenom: "Jean", nom: "Dupont" }
 * "Jean-Pierre De La Fontaine" -> { prenom: "Jean-Pierre", nom: "De La Fontaine" }
 */
export function parseFullName(fullName: string): { prenom: string; nom: string } {
  const trimmed = fullName.trim()
  const parts = trimmed.split(/\s+/)

  if (parts.length <= 1) {
    // Si un seul mot, on le met en nom (champ NOT NULL en BDD)
    // et on laisse prenom vide — plus logique pour "Dupont" seul
    return { prenom: '', nom: trimmed }
  }

  return {
    prenom: parts[0],
    nom: parts.slice(1).join(' '),
  }
}

/**
 * Valide qu'un nom complet contient au moins prenom ET nom
 * Retourne une erreur ou null
 */
export function validateFullName(fullName: string): string | null {
  if (!fullName?.trim()) {
    return 'Le nom complet est requis'
  }
  const parts = fullName.trim().split(/\s+/)
  if (parts.length < 2) {
    return 'Veuillez saisir le prenom ET le nom (ex: Jean Dupont)'
  }
  return null
}

/**
 * Valide un mot de passe et retourne une erreur ou null
 */
export function validatePassword(
  password: string,
  confirmPassword?: string
): string | null {
  if (!password) {
    return 'Le mot de passe est requis'
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caracteres`
  }

  if (confirmPassword !== undefined && password !== confirmPassword) {
    return 'Les mots de passe ne correspondent pas'
  }

  return null
}

/**
 * Valide un format email basique
 */
export function validateEmail(email: string): string | null {
  if (!email) {
    return 'L\'adresse email est requise'
  }

  if (!EMAIL_REGEX.test(email)) {
    return 'Format d\'email invalide'
  }

  return null
}
