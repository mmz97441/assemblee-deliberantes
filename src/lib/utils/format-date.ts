// ============================================
// Fonctions de formatage de dates centralisées
// Évite la duplication dans les composants
// ============================================

export function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })
  } catch { return dateStr }
}

export function formatShortDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'long', year: 'numeric',
    })
  } catch { return dateStr }
}

export function formatTime(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleTimeString('fr-FR', {
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return '' }
}

export function formatRelativeDate(dateStr: string | null): string {
  if (!dateStr) return ''
  try {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMinutes = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMinutes < 1) return 'à l\'instant'
    if (diffMinutes < 60) return `il y a ${diffMinutes} min`
    if (diffHours < 24) return `il y a ${diffHours}h`
    if (diffDays < 7) return `il y a ${diffDays}j`
    return formatShortDate(dateStr)
  } catch { return dateStr }
}

/**
 * Format date + heure (ex: "15 mars 2026 à 14:30")
 */
export function formatDateTime(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return dateStr }
}

/**
 * Format court numérique (ex: "15/03/2026")
 */
export function formatDateNumeric(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    })
  } catch { return dateStr }
}

/**
 * Format abrégé avec jour de la semaine (ex: "lun. 15 mars")
 */
export function formatDateWeekdayShort(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      weekday: 'short', day: 'numeric', month: 'short',
    })
  } catch { return dateStr }
}
