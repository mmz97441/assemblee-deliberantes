import twilio from 'twilio'

let _client: ReturnType<typeof twilio> | null = null

function getClient() {
  if (_client) return _client
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!sid || !token) return null
  _client = twilio(sid, token)
  return _client
}

export interface SMSResult {
  success: boolean
  sid?: string
  error?: string
}

/**
 * Envoie un SMS via Twilio.
 * Ne jamais appeler côté client — serveur uniquement.
 */
export async function sendSMS(to: string, body: string): Promise<SMSResult> {
  const client = getClient()
  if (!client) {
    console.warn('[Twilio] Non configuré — SMS non envoyé')
    return { success: false, error: 'Twilio non configuré' }
  }

  const from = process.env.TWILIO_FROM_NUMBER
  if (!from) {
    console.warn('[Twilio] TWILIO_FROM_NUMBER manquant')
    return { success: false, error: 'Numéro expéditeur non configuré' }
  }

  try {
    const message = await client.messages.create({
      body,
      from,
      to,
    })
    return { success: true, sid: message.sid }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Erreur inconnue'
    console.error('[Twilio] Erreur envoi SMS:', errMsg)
    return { success: false, error: errMsg }
  }
}

/**
 * Masque partiellement un numéro de téléphone pour affichage.
 * Ex: "0612345678" → "06 ** ** ** 78"
 * Ex: "+33612345678" → "+33 6 ** ** ** 78"
 */
export function maskPhoneNumber(phone: string): string {
  // Nettoyer le numéro
  const cleaned = phone.replace(/\s/g, '')

  if (cleaned.startsWith('+33') && cleaned.length >= 12) {
    const last2 = cleaned.slice(-2)
    return `+33 6 ** ** ** ${last2}`
  }

  if (cleaned.startsWith('0') && cleaned.length >= 10) {
    const prefix = cleaned.slice(0, 2)
    const last2 = cleaned.slice(-2)
    return `${prefix} ** ** ** ${last2}`
  }

  // Fallback: masquer le milieu
  if (cleaned.length > 4) {
    return cleaned.slice(0, 2) + '*'.repeat(cleaned.length - 4) + cleaned.slice(-2)
  }

  return '****'
}
