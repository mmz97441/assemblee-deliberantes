/**
 * Template HTML pour les convocations par email.
 *
 * On utilise du HTML inline (pas React Email) pour garder la simplicite
 * et eviter une dependance supplementaire en Phase 1.
 */

interface ConvocationEmailData {
  prenomMembre: string
  nomMembre: string
  titreSeance: string
  instanceNom: string
  dateSeance: string
  heureSeance: string
  lieu: string | null
  mode: string
  odjPoints: { position: number; titre: string; type: string }[]
  confirmationUrl: string
  institutionNom: string
  qrCodeUrl?: string // URL de l'image QR code d'émargement
  presidentName?: string // Nom du président qui convoque (CGCT L2121-10)
}

function formatMode(mode: string): string {
  switch (mode) {
    case 'PRESENTIEL': return 'en presentiel'
    case 'HYBRIDE': return 'en hybride (presentiel + visioconference)'
    case 'VISIO': return 'en visioconference'
    default: return ''
  }
}

function formatType(type: string): string {
  switch (type) {
    case 'DELIBERATION': return 'Deliberation'
    case 'INFORMATION': return 'Information'
    case 'QUESTION_DIVERSE': return 'Question diverse'
    case 'ELECTION': return 'Election'
    case 'APPROBATION_PV': return 'Approbation PV'
    default: return type
  }
}

export function generateConvocationSubject(data: ConvocationEmailData): string {
  return `Convocation — ${data.titreSeance}`
}

export function generateConvocationHTML(data: ConvocationEmailData): string {
  const odjHTML = data.odjPoints.length > 0
    ? `
      <table cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <thead>
          <tr>
            <th style="text-align: left; padding: 8px 12px; background: #f1f5f9; border: 1px solid #e2e8f0; font-size: 13px; color: #475569;">N&deg;</th>
            <th style="text-align: left; padding: 8px 12px; background: #f1f5f9; border: 1px solid #e2e8f0; font-size: 13px; color: #475569;">Point</th>
            <th style="text-align: left; padding: 8px 12px; background: #f1f5f9; border: 1px solid #e2e8f0; font-size: 13px; color: #475569;">Type</th>
          </tr>
        </thead>
        <tbody>
          ${data.odjPoints.map(p => `
            <tr>
              <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-size: 13px; text-align: center; width: 40px;">${p.position}</td>
              <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-size: 13px;">${escapeHtml(p.titre)}</td>
              <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-size: 13px; color: #64748b;">${formatType(p.type)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `
    : '<p style="color: #64748b; font-style: italic;">L\'ordre du jour sera communique ulterieurement.</p>'

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table cellpadding="0" cellspacing="0" style="width: 100%; max-width: 600px; margin: 0 auto; background: #ffffff;">
    <!-- Header -->
    <tr>
      <td style="background: #1e3a5f; padding: 24px 32px; text-align: center;">
        <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 600;">
          ${escapeHtml(data.institutionNom)}
        </h1>
        <p style="margin: 4px 0 0; color: rgba(255,255,255,0.7); font-size: 13px;">
          Convocation officielle
        </p>
      </td>
    </tr>

    <!-- Body -->
    <tr>
      <td style="padding: 32px;">
        <p style="margin: 0 0 16px; font-size: 15px; color: #1e293b;">
          Madame, Monsieur <strong>${escapeHtml(data.prenomMembre)} ${escapeHtml(data.nomMembre)}</strong>,
        </p>

        <p style="margin: 0 0 16px; font-size: 15px; color: #1e293b; line-height: 1.6;">
          Sur convocation de <strong>${escapeHtml(data.presidentName || 'le Président')}</strong>,
          vous êtes convoqué(e) à la séance suivante :
        </p>

        <!-- Session info card -->
        <table cellpadding="0" cellspacing="0" style="width: 100%; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin: 16px 0;">
          <tr>
            <td style="padding: 20px;">
              <h2 style="margin: 0 0 12px; font-size: 17px; color: #1e293b;">
                ${escapeHtml(data.titreSeance)}
              </h2>
              <table cellpadding="0" cellspacing="0" style="width: 100%;">
                <tr>
                  <td style="padding: 4px 0; font-size: 14px; color: #64748b; width: 100px;">Instance</td>
                  <td style="padding: 4px 0; font-size: 14px; color: #1e293b; font-weight: 500;">${escapeHtml(data.instanceNom)}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; font-size: 14px; color: #64748b;">Date</td>
                  <td style="padding: 4px 0; font-size: 14px; color: #1e293b; font-weight: 500;">${escapeHtml(data.dateSeance)}</td>
                </tr>
                ${data.heureSeance ? `
                <tr>
                  <td style="padding: 4px 0; font-size: 14px; color: #64748b;">Heure</td>
                  <td style="padding: 4px 0; font-size: 14px; color: #1e293b; font-weight: 500;">${escapeHtml(data.heureSeance)}</td>
                </tr>
                ` : ''}
                ${data.lieu ? `
                <tr>
                  <td style="padding: 4px 0; font-size: 14px; color: #64748b;">Lieu</td>
                  <td style="padding: 4px 0; font-size: 14px; color: #1e293b; font-weight: 500;">${escapeHtml(data.lieu)}</td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 4px 0; font-size: 14px; color: #64748b;">Mode</td>
                  <td style="padding: 4px 0; font-size: 14px; color: #1e293b; font-weight: 500;">${formatMode(data.mode)}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- ODJ -->
        <h3 style="margin: 24px 0 8px; font-size: 15px; color: #1e293b;">
          Ordre du jour
        </h3>
        ${odjHTML}

        <!-- CTA -->
        <table cellpadding="0" cellspacing="0" style="width: 100%; margin: 28px 0 16px;">
          <tr>
            <td style="text-align: center;">
              <a href="${data.confirmationUrl}"
                 style="display: inline-block; padding: 12px 32px; background: #1e3a5f; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 15px; font-weight: 600;">
                Confirmer ma presence
              </a>
            </td>
          </tr>
        </table>

        ${data.qrCodeUrl ? `
        <!-- QR Code émargement -->
        <table width="100%" style="margin: 24px 0 0;">
          <tr>
            <td style="text-align: center; padding: 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
              <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #1e293b;">
                Votre QR code d'emargement
              </p>
              <img src="${data.qrCodeUrl}" alt="QR Code" width="200" height="200" style="display: block; margin: 0 auto;" />
              <p style="margin: 12px 0 0; font-size: 12px; color: #64748b;">
                Presentez ce QR code a l'entree de la salle pour confirmer votre presence.
                <br/>Ce code est personnel et a usage unique.
              </p>
            </td>
          </tr>
        </table>
        ` : ''}

        <p style="margin: 16px 0 0; font-size: 13px; color: #94a3b8; text-align: center;">
          Si vous ne pouvez pas assister a cette seance, veuillez en informer le secretariat
          dans les meilleurs delais.
        </p>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="padding: 20px 32px; background: #f1f5f9; border-top: 1px solid #e2e8f0;">
        <p style="margin: 0; font-size: 12px; color: #94a3b8; text-align: center;">
          ${escapeHtml(data.institutionNom)} — Systeme de gestion des seances deliberantes
        </p>
        <p style="margin: 4px 0 0; font-size: 11px; color: #cbd5e1; text-align: center;">
          Cet email a ete envoye automatiquement. Merci de ne pas y repondre.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
