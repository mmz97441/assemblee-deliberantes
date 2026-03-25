/**
 * Template HTML pour les notifications de signature de PV.
 *
 * Utilisé pour notifier le président et le secrétaire que le PV est prêt
 * à être signé, et pour les notifications après signature.
 */

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ─── Notification : PV prêt pour signature ──────────────────────────────────

interface PVSignatureNotificationData {
  memberName: string
  role: 'président' | 'secrétaire'
  seanceTitre: string
  seanceDate: string
  institutionName: string
  pvUrl: string
  secretaireName?: string
}

export function generatePVSignatureSubject(seanceDate: string): string {
  return `Signature requise — PV de la séance du ${seanceDate}`
}

export function generatePVSignatureHTML(data: PVSignatureNotificationData): string {
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
          ${escapeHtml(data.institutionName)}
        </h1>
        <p style="margin: 4px 0 0; color: rgba(255,255,255,0.7); font-size: 13px;">
          Signature de procès-verbal
        </p>
      </td>
    </tr>

    <!-- Body -->
    <tr>
      <td style="padding: 32px;">
        <p style="margin: 0 0 16px; font-size: 15px; color: #1e293b;">
          Madame, Monsieur <strong>${escapeHtml(data.memberName)}</strong>,
        </p>

        <p style="margin: 0 0 16px; font-size: 15px; color: #1e293b; line-height: 1.6;">
          Le procès-verbal de la séance du <strong>${escapeHtml(data.seanceDate)}</strong>
          (<em>${escapeHtml(data.seanceTitre)}</em>) est prêt pour votre signature.
        </p>

        <p style="margin: 0 0 24px; font-size: 15px; color: #1e293b; line-height: 1.6;">
          En tant que <strong>${escapeHtml(data.role)}</strong>, vous êtes invité(e) à le relire et le signer.
        </p>

        <!-- CTA -->
        <table cellpadding="0" cellspacing="0" style="width: 100%; margin: 0 0 24px;">
          <tr>
            <td style="text-align: center;">
              <a href="${escapeHtml(data.pvUrl)}"
                 style="display: inline-block; padding: 14px 40px; background: #1e3a5f; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600;">
                Signer le procès-verbal &rarr;
              </a>
            </td>
          </tr>
        </table>

        ${data.secretaireName ? `
        <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.5;">
          Ce PV a été rédigé par ${escapeHtml(data.secretaireName)}.
          Si vous avez des remarques, contactez-le/la avant de signer.
        </p>
        ` : ''}
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="padding: 20px 32px; background: #f1f5f9; border-top: 1px solid #e2e8f0;">
        <p style="margin: 0; font-size: 12px; color: #94a3b8; text-align: center;">
          ${escapeHtml(data.institutionName)} — Système de gestion des séances délibérantes
        </p>
        <p style="margin: 4px 0 0; font-size: 11px; color: #cbd5e1; text-align: center;">
          Cet email a été envoyé automatiquement. Merci de ne pas y répondre.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}

// ─── Notification : le président a signé (→ secrétaire) ─────────────────────

interface PVSignedByNotificationData {
  recipientName: string
  signerRole: 'président' | 'secrétaire'
  signerName: string
  seanceTitre: string
  seanceDate: string
  institutionName: string
  pvUrl: string
  allSigned: boolean
}

export function generatePVSignedBySubject(data: PVSignedByNotificationData): string {
  if (data.allSigned) {
    return `PV signé — Séance du ${data.seanceDate}`
  }
  return `Le ${data.signerRole} a signé le PV — Séance du ${data.seanceDate}`
}

export function generatePVSignedByHTML(data: PVSignedByNotificationData): string {
  const bodyText = data.allSigned
    ? `Le procès-verbal de la séance du <strong>${escapeHtml(data.seanceDate)}</strong>
       (<em>${escapeHtml(data.seanceTitre)}</em>) est désormais signé par les deux parties.
       Il est verrouillé et ne peut plus être modifié.`
    : `Le/La <strong>${escapeHtml(data.signerRole)}</strong> (${escapeHtml(data.signerName)}) a signé
       le procès-verbal de la séance du <strong>${escapeHtml(data.seanceDate)}</strong>
       (<em>${escapeHtml(data.seanceTitre)}</em>).
       <br/><br/>
       <strong>À votre tour de le relire et de le signer.</strong>`

  const ctaLabel = data.allSigned
    ? 'Voir le procès-verbal'
    : 'Signer le procès-verbal &rarr;'

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
      <td style="background: ${data.allSigned ? '#166534' : '#1e3a5f'}; padding: 24px 32px; text-align: center;">
        <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 600;">
          ${escapeHtml(data.institutionName)}
        </h1>
        <p style="margin: 4px 0 0; color: rgba(255,255,255,0.7); font-size: 13px;">
          ${data.allSigned ? 'Procès-verbal signé' : 'Signature de procès-verbal'}
        </p>
      </td>
    </tr>

    <!-- Body -->
    <tr>
      <td style="padding: 32px;">
        <p style="margin: 0 0 16px; font-size: 15px; color: #1e293b;">
          Madame, Monsieur <strong>${escapeHtml(data.recipientName)}</strong>,
        </p>

        <p style="margin: 0 0 24px; font-size: 15px; color: #1e293b; line-height: 1.6;">
          ${bodyText}
        </p>

        <!-- CTA -->
        <table cellpadding="0" cellspacing="0" style="width: 100%; margin: 0 0 24px;">
          <tr>
            <td style="text-align: center;">
              <a href="${escapeHtml(data.pvUrl)}"
                 style="display: inline-block; padding: 14px 40px; background: ${data.allSigned ? '#166534' : '#1e3a5f'}; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600;">
                ${ctaLabel}
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="padding: 20px 32px; background: #f1f5f9; border-top: 1px solid #e2e8f0;">
        <p style="margin: 0; font-size: 12px; color: #94a3b8; text-align: center;">
          ${escapeHtml(data.institutionName)} — Système de gestion des séances délibérantes
        </p>
        <p style="margin: 4px 0 0; font-size: 11px; color: #cbd5e1; text-align: center;">
          Cet email a été envoyé automatiquement. Merci de ne pas y répondre.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}
