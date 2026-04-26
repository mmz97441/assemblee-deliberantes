/**
 * Limiteur de débit en mémoire pour les routes API (PDF, QR, etc.).
 *
 * Contrairement au rate-limiter basé sur Supabase (pour les server actions),
 * celui-ci fonctionne en mémoire pour les routes API qui ne disposent pas
 * forcément d'un contexte utilisateur Supabase.
 *
 * LIMITATIONS :
 * - Réinitialisation au redémarrage du serveur
 * - Non partagé entre les instances serverless (acceptable pour Vercel
 *   car chaque instance a son propre état, ce qui rend le rate limiting
 *   plus permissif mais toujours utile contre les abus)
 *
 * Nettoyage automatique des entrées expirées toutes les 5 minutes.
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const RATE_LIMITS = new Map<string, RateLimitEntry>()

// Nettoyage périodique pour éviter les fuites mémoire
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes
let lastCleanup = Date.now()

function cleanupExpiredEntries() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return

  lastCleanup = now
  const keysToDelete: string[] = []
  RATE_LIMITS.forEach((entry, key) => {
    if (entry.resetAt < now) {
      keysToDelete.push(key)
    }
  })
  keysToDelete.forEach(key => RATE_LIMITS.delete(key))
}

/**
 * Vérifie si une requête est autorisée selon le rate limiting.
 *
 * @param key - Identifiant unique (userId, IP, etc.)
 * @param maxRequests - Nombre max de requêtes par fenêtre
 * @param windowMs - Durée de la fenêtre en millisecondes (défaut : 60000 = 1 minute)
 * @returns true si la requête est autorisée, false sinon
 */
export function checkApiRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number = 60_000
): boolean {
  cleanupExpiredEntries()

  const now = Date.now()
  const entry = RATE_LIMITS.get(key)

  if (!entry || entry.resetAt < now) {
    RATE_LIMITS.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (entry.count >= maxRequests) {
    return false
  }

  entry.count++
  return true
}

/**
 * Constantes de rate limiting par type de route.
 * PDF : 10 par minute par utilisateur (génération coûteuse)
 * QR : 30 par minute par IP (route publique, génération légère)
 */
export const API_RATE_LIMITS = {
  PDF: { maxRequests: 10, windowMs: 60_000 },
  QR: { maxRequests: 30, windowMs: 60_000 },
} as const
