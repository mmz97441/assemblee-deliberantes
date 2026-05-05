/**
 * Liens « Ajouter à mon agenda » pour les principaux calendriers en ligne.
 * Utilisés en complément du fichier .ics attaché : un clic = un événement
 * pré-rempli dans Google Agenda ou Outlook.com sans rien télécharger.
 */

interface CalendarLinkData {
  start: Date
  end: Date
  title: string
  description: string
  location: string | null
}

/** Format Google : YYYYMMDDTHHMMSSZ (UTC, sans tirets) */
function formatGoogle(d: Date): string {
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

/** Format Outlook : ISO 8601 standard */
function formatOutlook(d: Date): string {
  return d.toISOString()
}

/**
 * Lien Google Agenda — ouvre l'écran de création d'événement pré-rempli.
 * https://support.google.com/calendar/thread/81344786
 */
export function buildGoogleCalendarUrl(data: CalendarLinkData): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: data.title,
    dates: `${formatGoogle(data.start)}/${formatGoogle(data.end)}`,
    details: data.description,
  })
  if (data.location) params.set('location', data.location)
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

/**
 * Lien Outlook.com — ouvre la composition d'événement pré-remplie.
 * Fonctionne pour Outlook Web (outlook.live.com et outlook.office.com).
 */
export function buildOutlookUrl(data: CalendarLinkData): string {
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: data.title,
    startdt: formatOutlook(data.start),
    enddt: formatOutlook(data.end),
    body: data.description,
  })
  if (data.location) params.set('location', data.location)
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`
}

/**
 * Lien Yahoo Calendar — moins courant mais utile pour les utilisateurs
 * de boîtes Yahoo (encore actif sur certaines mairies).
 */
export function buildYahooCalendarUrl(data: CalendarLinkData): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const formatYahoo = (d: Date) =>
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'

  const params = new URLSearchParams({
    v: '60',
    title: data.title,
    st: formatYahoo(data.start),
    et: formatYahoo(data.end),
    desc: data.description,
  })
  if (data.location) params.set('in_loc', data.location)
  return `https://calendar.yahoo.com/?${params.toString()}`
}
