/**
 * Template HTML pour les notifications de signature de PV — formulation
 * protocolaire (« Monsieur le Maire », « Madame la Présidente », etc.)
 * conforme aux usages des institutions publiques françaises.
 */

import { formatProtocolaire, salutationFinale } from '@/lib/protocole/appellation'

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ─── Notification : PV prêt pour signature ──────────────────────────────────

interface PVSignatureNotificationData {
  /** Civilité du destinataire pour appellation protocolaire */
  civiliteMembre: 'MADAME' | 'MONSIEUR' | 'AUTRE'
  /** Qualité officielle du destinataire (« Maire », « Adjoint au maire »…) */
  qualiteMembre: string | null
  prenomMembre: string
  nomMembre: string
  /** Rôle dans la séance (président / secrétaire) — pour le contexte du courrier */
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
  const proto = formatProtocolaire(
    data.civiliteMembre,
    data.qualiteMembre,
    data.prenomMembre,
    data.nomMembre,
  )
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
          ${escapeHtml(proto.appellation)},
        </p>

        <p style="margin: 0 0 16px; font-size: 15px; color: #1e293b; line-height: 1.6;">
          Le procès-verbal de la séance du <strong>${escapeHtml(data.seanceDate)}</strong>
          (<em>${escapeHtml(data.seanceTitre)}</em>) est prêt pour votre signature.
        </p>

        <p style="margin: 0 0 24px; font-size: 15px; color: #1e293b; line-height: 1.6;">
          En votre qualité de <strong>${escapeHtml(data.role)} de séance</strong>,
          vous êtes invité${data.civiliteMembre === 'MADAME' ? 'e' : ''} à le relire et à le signer (CGCT L2121-15).
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
          Ce procès-verbal a été rédigé par ${escapeHtml(data.secretaireName)}.
          Pour toute remarque préalable à la signature, le secrétariat reste à votre disposition.
        </p>
        ` : ''}

        <p style="margin: 24px 0 0; font-size: 13px; color: #475569; line-height: 1.6;">
          ${escapeHtml(salutationFinale(proto.appellation))}
        </p>
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
  /** Civilité du destinataire pour appellation protocolaire */
  civiliteRecipient: 'MADAME' | 'MONSIEUR' | 'AUTRE'
  qualiteRecipient: string | null
  prenomRecipient: string
  nomRecipient: string
  signerRole: 'président' | 'secrétaire'
  /** Nom complet du signataire (déjà formaté avec civilité — utilisé tel quel) */
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
  const proto = formatProtocolaire(
    data.civiliteRecipient,
    data.qualiteRecipient,
    data.prenomRecipient,
    data.nomRecipient,
  )
  const articleSigner = data.signerRole === 'président' ? 'Le' : 'La'
  const bodyText = data.allSigned
    ? `Le procès-verbal de la séance du <strong>${escapeHtml(data.seanceDate)}</strong>
       (<em>${escapeHtml(data.seanceTitre)}</em>) est désormais signé par les deux parties.
       Il est verrouillé et ne peut plus être modifié (CGCT L2121-15).`
    : `${articleSigner} <strong>${escapeHtml(data.signerRole)} de séance</strong>
       (${escapeHtml(data.signerName)}) a apposé sa signature sur le procès-verbal de la séance
       du <strong>${escapeHtml(data.seanceDate)}</strong>
       (<em>${escapeHtml(data.seanceTitre)}</em>).
       <br/><br/>
       Il vous appartient désormais d&rsquo;en prendre connaissance et de le contresigner.`

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
          ${escapeHtml(proto.appellation)},
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

        <p style="margin: 24px 0 0; font-size: 13px; color: #475569; line-height: 1.6;">
          ${escapeHtml(salutationFinale(proto.appellation))}
        </p>
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
