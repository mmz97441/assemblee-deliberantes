/**
 * Génération de fichiers iCalendar (RFC 5545) pour les convocations.
 *
 * Le .ics est attaché à l'email de convocation : un clic sur la pièce jointe
 * dans n'importe quel client (Apple Mail, Gmail, Outlook, Thunderbird,
 * mobile) propose d'ajouter l'événement à l'agenda.
 *
 * Choix techniques :
 * - Heure « flottante » (pas de TZID) — l'événement physique a lieu à 14h
 *   locales pour tout le monde, peu importe le fuseau du destinataire.
 * - METHOD:PUBLISH (pas REQUEST) — on ne veut PAS que les clients envoient
 *   automatiquement une réponse RSVP au serveur (notre app gère sa propre
 *   confirmation via les liens « Présent / Absent »).
 * - SEQUENCE:0 par défaut — incrémenter en cas de mise à jour future
 *   (séance reportée, salle changée…) pour que les clients mettent
 *   l'événement à jour au lieu de l'ajouter en doublon.
 */

interface ICSEventData {
  /** Identifiant unique stable de l'événement (UID RFC 5545) */
  uid: string
  /** Date/heure de début (Date JavaScript ; sera traitée en heure locale flottante) */
  start: Date
  /** Date/heure de fin */
  end: Date
  /** Titre court de l'événement (« Conseil municipal du 15 mars ») */
  summary: string
  /** Description longue : ODJ + lien vers la page séance */
  description: string
  /** Lieu physique (ou URL visio si distanciel) */
  location: string | null
  /** Email de l'organisateur (institution / mairie) */
  organizerEmail: string
  /** Nom affiché de l'organisateur */
  organizerName: string
  /** URL vers la page séance dans l'app (optionnel) */
  url?: string
  /** Numéro de séquence (incrémenté à chaque update) */
  sequence?: number
  /** ANNULE si la séance a été annulée */
  cancelled?: boolean
}

/** Formate une Date en heure locale flottante : YYYYMMDDTHHMMSS */
function formatLocalDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    'T' +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  )
}

/** Formate une Date en UTC pour DTSTAMP : YYYYMMDDTHHMMSSZ */
function formatUTCDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  )
}

/**
 * Échappe une valeur texte selon RFC 5545 §3.3.11 :
 *   \  →  \\
 *   ;  →  \;
 *   ,  →  \,
 *   \n →  \n (séquence littérale, pas un retour réel)
 */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
}

/**
 * Plie les lignes longues à 75 octets selon RFC 5545 §3.1.
 * Les clients tolérants acceptent davantage, mais Outlook tronque parfois.
 */
function foldLine(line: string): string {
  if (line.length <= 75) return line
  const parts: string[] = []
  let remaining = line
  parts.push(remaining.slice(0, 75))
  remaining = remaining.slice(75)
  while (remaining.length > 0) {
    parts.push(' ' + remaining.slice(0, 74))
    remaining = remaining.slice(74)
  }
  return parts.join('\r\n')
}

export function generateConvocationICS(data: ICSEventData): string {
  const now = new Date()
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Assemblees Deliberantes//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${data.uid}`,
    `DTSTAMP:${formatUTCDateTime(now)}`,
    `DTSTART:${formatLocalDateTime(data.start)}`,
    `DTEND:${formatLocalDateTime(data.end)}`,
    `SUMMARY:${escapeText(data.summary)}`,
    `DESCRIPTION:${escapeText(data.description)}`,
  ]

  if (data.location) {
    lines.push(`LOCATION:${escapeText(data.location)}`)
  }
  if (data.url) {
    lines.push(`URL:${data.url}`)
  }

  lines.push(
    `ORGANIZER;CN=${escapeText(data.organizerName)}:mailto:${data.organizerEmail}`,
    `STATUS:${data.cancelled ? 'CANCELLED' : 'CONFIRMED'}`,
    `SEQUENCE:${data.sequence ?? 0}`,
    'TRANSP:OPAQUE',
    // Rappel 1h avant — c'est le standard pour les réunions pro
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Rappel de séance dans 1 heure',
    'TRIGGER:-PT1H',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  )

  // CRLF entre les lignes (RFC 5545 §3.1) + line folding
  return lines.map(foldLine).join('\r\n') + '\r\n'
}
