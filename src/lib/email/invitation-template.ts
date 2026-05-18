/**
 * Template HTML pour les invitations par email — destiné aux personnes
 * EXTERNES à l'institution (DGS d'une autre collectivité, expert,
 * fonctionnaire, représentant associatif, élu d'une autre instance...).
 *
 * Différent d'une convocation (CGCT) :
 *   - Ton « invitation » et non « convocation »
 *   - Mention explicite : pas de droit de vote, pas dans le quorum
 *   - Pas de QR code d'émargement (les invités ne signent pas la feuille
 *     officielle)
 *   - Boutons « Confirmer » / « Décliner » sur la page publique
 */

interface OdjInvitationPoint {
  position: number
  titre: string
  type: string
}

export interface InvitationEmailData {
  civilite: 'MADAME' | 'MONSIEUR' | 'AUTRE' | null
  prenom: string
  nom: string
  qualite: string | null
  organisation: string | null
  titreSeance: string
  instanceNom: string
  dateSeance: string
  heureSeance: string
  lieu: string | null
  mode: string
  odjPoints: OdjInvitationPoint[]
  /** URL vers la page de confirmation (publique, tokenisée) */
  confirmationUrl: string
  institutionNom: string
}

function salutation(civilite: 'MADAME' | 'MONSIEUR' | 'AUTRE' | null): string {
  if (civilite === 'MADAME') return 'Madame'
  if (civilite === 'MONSIEUR') return 'Monsieur'
  return 'Madame, Monsieur'
}

function formatMode(mode: string): string {
  switch (mode) {
    case 'PRESENTIEL': return 'en présentiel'
    case 'HYBRIDE': return 'en hybride (présentiel + visioconférence)'
    case 'VISIO': return 'en visioconférence'
    default: return ''
  }
}

function formatType(type: string): string {
  switch (type) {
    case 'DELIBERATION': return 'Délibération'
    case 'INFORMATION': return 'Information'
    case 'QUESTION_DIVERSE': return 'Question diverse'
    case 'ELECTION': return 'Élection'
    case 'APPROBATION_PV': return 'Approbation PV'
    default: return type
  }
}

export function generateInvitationSubject(data: InvitationEmailData): string {
  return `Invitation — ${data.titreSeance}`
}

export function generateInvitationHTML(data: InvitationEmailData): string {
  const civiliteSalut = salutation(data.civilite)
  const modeText = formatMode(data.mode)

  const qualiteOrga = [data.qualite, data.organisation].filter(Boolean).join(' — ')

  const odjHTML = data.odjPoints.length > 0
    ? `
      <h2 style="font-size: 16px; color: #1f2937; margin-top: 32px; margin-bottom: 12px;">Ordre du jour prévisionnel</h2>
      <ol style="padding-left: 20px; color: #374151;">
        ${data.odjPoints
          .sort((a, b) => a.position - b.position)
          .map(
            p => `<li style="margin-bottom: 6px;"><strong>${formatType(p.type)}</strong> — ${escapeHTML(p.titre)}</li>`
          )
          .join('')}
      </ol>
    `
    : ''

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>Invitation</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; color: #111827;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background: #f9fafb; padding: 24px 0;">
    <tr>
      <td align="center">
        <table cellpadding="0" cellspacing="0" border="0" width="600" style="background: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); overflow: hidden;">
          <tr>
            <td style="padding: 32px 40px 16px 40px;">
              <p style="font-size: 13px; color: #6b7280; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px;">${escapeHTML(data.institutionNom)}</p>
              <h1 style="font-size: 22px; color: #111827; margin: 0 0 16px 0;">Invitation à assister à une séance</h1>

              <p style="font-size: 15px; line-height: 1.6; color: #374151;">
                ${civiliteSalut}${qualiteOrga ? ` ${escapeHTML(data.prenom)} ${escapeHTML(data.nom)} <em style="color:#6b7280;">(${escapeHTML(qualiteOrga)})</em>` : ` ${escapeHTML(data.prenom)} ${escapeHTML(data.nom)}`},
              </p>

              <p style="font-size: 15px; line-height: 1.6; color: #374151;">
                Vous êtes cordialement invité(e) à assister à la séance
                <strong>${escapeHTML(data.instanceNom)}</strong>
                organisée par <strong>${escapeHTML(data.institutionNom)}</strong>.
              </p>

              <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; font-size: 14px; color: #78350f;">
                  <strong>Cette invitation est à titre d'observateur(trice)&nbsp;:</strong>
                  vous n'avez pas droit de vote et n'êtes pas compté(e) dans le quorum.
                </p>
              </div>

              <h2 style="font-size: 16px; color: #1f2937; margin-top: 24px; margin-bottom: 8px;">Informations pratiques</h2>
              <table cellpadding="0" cellspacing="0" border="0" style="font-size: 14px; color: #374151;">
                <tr><td style="padding: 4px 12px 4px 0; color:#6b7280;">Séance</td><td style="padding: 4px 0;"><strong>${escapeHTML(data.titreSeance)}</strong></td></tr>
                <tr><td style="padding: 4px 12px 4px 0; color:#6b7280;">Date</td><td style="padding: 4px 0;">${escapeHTML(data.dateSeance)}</td></tr>
                <tr><td style="padding: 4px 12px 4px 0; color:#6b7280;">Heure</td><td style="padding: 4px 0;">${escapeHTML(data.heureSeance)}</td></tr>
                ${data.lieu ? `<tr><td style="padding: 4px 12px 4px 0; color:#6b7280;">Lieu</td><td style="padding: 4px 0;">${escapeHTML(data.lieu)}</td></tr>` : ''}
                ${modeText ? `<tr><td style="padding: 4px 12px 4px 0; color:#6b7280;">Mode</td><td style="padding: 4px 0;">${escapeHTML(modeText)}</td></tr>` : ''}
              </table>

              ${odjHTML}

              <div style="text-align: center; margin: 32px 0 16px 0;">
                <a href="${data.confirmationUrl}"
                   style="display: inline-block; background: #2563eb; color: #ffffff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 15px;">
                  Confirmer ou décliner ma présence
                </a>
              </div>

              <p style="font-size: 13px; color: #6b7280; text-align: center; margin: 8px 0 0 0;">
                Merci de nous indiquer votre disponibilité dès que possible.
              </p>

              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0 16px 0;" />

              <p style="font-size: 12px; color: #9ca3af; line-height: 1.5; margin: 0;">
                Vous recevez cette invitation car votre adresse a été enregistrée
                comme invité à cette séance. Si vous pensez qu'il s'agit d'une erreur,
                vous pouvez ignorer ce message.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function escapeHTML(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
