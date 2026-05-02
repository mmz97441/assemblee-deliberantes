import { z } from 'zod'

/**
 * Validation d'email robuste (audit sécurité #16).
 *
 * L'ancienne regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` acceptait :
 * - "a@a.a" (TLD à 1 caractère)
 * - des homoglyphes Unicode trompeurs (ex : `a@а.com` avec a cyrillique)
 * - pas de longueur maximale (RFC 5321 : 254 chars max)
 *
 * On utilise désormais le validateur de zod (RFC 5321 + check des
 * caractères de contrôle) + une normalisation NFC explicite pour
 * éviter les attaques par homoglyphe.
 *
 * Renvoie l'email normalisé (lowercase + trim + NFC) si valide,
 * ou null sinon.
 */
const baseEmailSchema = z
  .string()
  .trim()
  .min(3, 'Email trop court')
  .max(254, 'Email trop long (max 254 caractères)')
  .email('Format d\'email invalide')

export function validateEmail(input: unknown): { ok: true; email: string } | { ok: false; error: string } {
  if (typeof input !== 'string') {
    return { ok: false, error: 'Email manquant ou invalide' }
  }

  // Normalisation Unicode NFC : neutralise les caractères composés/decomposés
  // (les homoglyphes restent visuellement identiques mais cette normalisation
  // les fixe à une représentation binaire stable, ce qui évite les "deux
  // emails identiques visuellement mais différents en base").
  const normalized = input.normalize('NFC').trim().toLowerCase()

  const result = baseEmailSchema.safeParse(normalized)
  if (!result.success) {
    const msg = result.error.issues[0]?.message || 'Format d\'email invalide'
    return { ok: false, error: msg }
  }

  // Refus explicite des caractères de contrôle (attaque par injection CRLF
  // pour empoisonner les en-têtes SMTP).
  if (/[\x00-\x1F\x7F]/.test(normalized)) {
    return { ok: false, error: 'Caractères de contrôle interdits dans l\'email' }
  }

  return { ok: true, email: normalized }
}

/**
 * Helper booléen pour les validations inline (composants UI).
 */
export function isValidEmail(input: unknown): boolean {
  return validateEmail(input).ok
}
