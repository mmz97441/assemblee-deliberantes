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
  DASHBOARD: '/dashboard',
  CONFIGURATION: '/configuration',
  MEMBRES: '/membres',
  SEANCES: '/seances',
  INVITE_CONFIRM: '/invite/confirm',
} as const

export const PUBLIC_ROUTES = [
  ROUTES.LOGIN,
  ROUTES.REGISTER,
  '/invite',
] as const

// --- Validation ---
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
    return { prenom: trimmed, nom: '' }
  }

  return {
    prenom: parts[0],
    nom: parts.slice(1).join(' '),
  }
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
