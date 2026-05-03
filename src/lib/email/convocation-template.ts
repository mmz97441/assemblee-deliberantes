/**
 * Template HTML pour les convocations par email.
 *
 * On utilise du HTML inline (pas React Email) pour garder la simplicite
 * et eviter une dependance supplementaire en Phase 1.
 */

interface OdjDocument {
  name: string
  size: number | null
  type: string | null
}

interface ConvocationOdjPoint {
  position: number
  titre: string
  type: string
  description?: string | null
  note_synthese?: string | null
  documents?: OdjDocument[]
}

interface ConvocationEmailData {
  prenomMembre: string
  nomMembre: string
  titreSeance: string
  instanceNom: string
  dateSeance: string
  heureSeance: string
  lieu: string | null
  mode: string
  odjPoints: ConvocationOdjPoint[]
  /** URL « Confirmer ma présence » — ?action=present */
  confirmationUrl: string
  /** URL « Signaler mon absence » — ?action=absent */
  absenceUrl?: string
  /** URL vers la page séance dans l'app pour consulter docs et détails */
  seanceUrl?: string
  institutionNom: string
  qrCodeUrl?: string
  presidentName?: string
}

function formatFileSize(bytes: number | null): string {
  if (!bytes || bytes <= 0) return ''
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
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

export function generateConvocationSubject(data: ConvocationEmailData): string {
  return `Convocation — ${data.titreSeance}`
}

export function generateConvocationHTML(data: ConvocationEmailData): string {
  // ODJ détaillé : description sous chaque titre + liste des PJ par point
  // (CTA « Consulter en ligne » vers la page séance pour télécharger les PJ
  // — pas de signed URLs dans l'email pour des raisons de sécurité).
  const odjHTML = data.odjPoints.length > 0
    ? `
      <div style="margin: 12px 0;">
        ${data.odjPoints.map(p => {
          const docsHTML = (p.documents && p.documents.length > 0)
            ? `
              <div style="margin: 10px 0 0; padding: 10px 12px; background: #f1f5f9; border-radius: 6px;">
                <p style="margin: 0 0 6px; font-size: 12px; font-weight: 600; color: #475569;">
                  Pièces jointes (${p.documents.length})
                </p>
                ${p.documents.map(d => `
                  <p style="margin: 2px 0; font-size: 13px; color: #1e293b;">
                    📎 ${escapeHtml(d.name)}${d.size ? ` <span style="color: #94a3b8; font-size: 11px;">(${formatFileSize(d.size)})</span>` : ''}
                  </p>
                `).join('')}
              </div>
            `
            : ''

          const descHTML = (p.description && p.description.trim())
            ? `
              <p style="margin: 6px 0 0; font-size: 13px; color: #475569; line-height: 1.5; white-space: pre-wrap;">
                ${escapeHtml(p.description.trim())}
              </p>
            `
            : ''

          return `
            <div style="padding: 14px 16px; margin: 0 0 10px; border: 1px solid #e2e8f0; border-radius: 8px; background: #ffffff;">
              <table cellpadding="0" cellspacing="0" style="width: 100%;">
                <tr>
                  <td style="font-size: 13px; color: #94a3b8; width: 32px; vertical-align: top; padding-top: 2px;">
                    ${p.position}.
                  </td>
                  <td>
                    <p style="margin: 0; font-size: 14px; font-weight: 600; color: #1e293b;">
                      ${escapeHtml(p.titre)}
                    </p>
                    <p style="margin: 2px 0 0; font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.4px;">
                      ${formatType(p.type)}
                    </p>
                    ${descHTML}
                    ${docsHTML}
                  </td>
                </tr>
              </table>
            </div>
          `
        }).join('')}
      </div>
      ${data.seanceUrl ? `
        <p style="margin: 8px 0 0; text-align: center;">
          <a href="${data.seanceUrl}" style="font-size: 13px; color: #1e3a5f; text-decoration: underline;">
            Consulter le détail et télécharger les documents en ligne
          </a>
        </p>
      ` : ''}
    `
    : '<p style="color: #64748b; font-style: italic;">L\'ordre du jour sera communiqué ultérieurement.</p>'

  // ─── Notes explicatives de synthèse (CGCT L2121-12) ──────────────────────
  const pointsWithNote = data.odjPoints.filter((p) => (p.note_synthese || '').trim().length > 0)
  const notesSyntheseHTML = pointsWithNote.length > 0
    ? `
      <h2 style="margin: 24px 0 8px; color: #1e3a5f; font-size: 15px; font-weight: 600;">Notes explicatives de synthèse</h2>
      <p style="margin: 0 0 12px; color: #64748b; font-size: 12px; font-style: italic;">CGCT L2121-12 — adressées avec la convocation</p>
      ${pointsWithNote.map(p => `
        <div style="margin: 0 0 16px; padding: 12px 16px; background: #f8fafc; border-left: 3px solid #1e3a5f; border-radius: 4px;">
          <p style="margin: 0 0 6px; font-size: 13px; font-weight: 600; color: #1e3a5f;">Point ${p.position} — ${escapeHtml(p.titre)}</p>
          <p style="margin: 0; font-size: 13px; color: #334155; line-height: 1.5; white-space: pre-wrap;">${escapeHtml(p.note_synthese || '')}</p>
        </div>
      `).join('')}
    `
    : ''

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
        ${notesSyntheseHTML}

        <!-- CTA : 2 boutons côte-à-côte (Présent vert / Absent gris) -->
        <table cellpadding="0" cellspacing="0" style="width: 100%; margin: 28px 0 8px;">
          <tr>
            <td style="text-align: center;">
              <p style="margin: 0 0 14px; font-size: 14px; color: #475569;">
                Merci de répondre à cette convocation :
              </p>
              <a href="${data.confirmationUrl}"
                 style="display: inline-block; padding: 12px 28px; background: #1e3a5f; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 15px; font-weight: 600; margin: 4px 6px;">
                ✓ Je serai présent(e)
              </a>
              ${data.absenceUrl ? `
                <a href="${data.absenceUrl}"
                   style="display: inline-block; padding: 12px 28px; background: #ffffff; color: #475569; text-decoration: none; border: 1.5px solid #cbd5e1; border-radius: 6px; font-size: 15px; font-weight: 600; margin: 4px 6px;">
                  ✗ Je serai absent(e)
                </a>
              ` : ''}
            </td>
          </tr>
        </table>

        ${data.qrCodeUrl ? `
        <!-- QR Code émargement -->
        <table width="100%" style="margin: 24px 0 0;">
          <tr>
            <td style="text-align: center; padding: 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
              <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #1e293b;">
                Votre QR code d'émargement
              </p>
              <img src="${data.qrCodeUrl}" alt="QR Code" width="200" height="200" style="display: block; margin: 0 auto;" />
              <p style="margin: 12px 0 0; font-size: 12px; color: #64748b;">
                Présentez ce QR code à l'entrée de la salle pour confirmer votre présence.
                <br/>Ce code est personnel et à usage unique.
              </p>
            </td>
          </tr>
        </table>
        ` : ''}

        <p style="margin: 16px 0 0; font-size: 12px; color: #94a3b8; text-align: center;">
          Pour donner procuration à un autre élu, contactez le secrétariat
          de votre institution (CGCT L2121-20).
        </p>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="padding: 20px 32px; background: #f1f5f9; border-top: 1px solid #e2e8f0;">
        <p style="margin: 0; font-size: 12px; color: #94a3b8; text-align: center;">
          ${escapeHtml(data.institutionNom)} — Système de gestion des séances délibérantes
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

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ─── Reminder email template ────────────────────────────────────────────────

interface ReminderEmailData {
  memberName: string
  seanceTitre: string
  seanceDate: string
  seanceHeure: string
  instanceNom: string
  institutionNom: string
}

export function generateReminderSubject(data: ReminderEmailData): string {
  return `Rappel — ${data.seanceTitre} le ${data.seanceDate}`
}

export function generateReminderHTML(data: ReminderEmailData): string {
  const { memberName, seanceTitre, seanceDate, seanceHeure, instanceNom, institutionNom } = data

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
      <td style="background: #f59e0b; padding: 24px 32px; text-align: center;">
        <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 600;">
          Rappel de séance
        </h1>
        <p style="margin: 4px 0 0; color: rgba(255,255,255,0.8); font-size: 13px;">
          ${escapeHtml(institutionNom)}
        </p>
      </td>
    </tr>

    <!-- Body -->
    <tr>
      <td style="padding: 32px;">
        <p style="margin: 0 0 16px; font-size: 15px; color: #1e293b;">
          Madame, Monsieur <strong>${escapeHtml(memberName)}</strong>,
        </p>

        <p style="margin: 0 0 16px; font-size: 15px; color: #1e293b; line-height: 1.6;">
          Nous vous rappelons que vous êtes convoqué(e) à la séance suivante :
        </p>

        <!-- Session info card -->
        <table cellpadding="0" cellspacing="0" style="width: 100%; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; margin: 16px 0;">
          <tr>
            <td style="padding: 20px;">
              <h2 style="margin: 0 0 12px; font-size: 17px; color: #1e293b;">
                ${escapeHtml(seanceTitre)}
              </h2>
              <table cellpadding="0" cellspacing="0" style="width: 100%;">
                <tr>
                  <td style="padding: 4px 0; font-size: 14px; color: #64748b; width: 100px;">Instance</td>
                  <td style="padding: 4px 0; font-size: 14px; color: #1e293b; font-weight: 500;">${escapeHtml(instanceNom)}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; font-size: 14px; color: #64748b;">Date</td>
                  <td style="padding: 4px 0; font-size: 14px; color: #1e293b; font-weight: 600;">${escapeHtml(seanceDate)}</td>
                </tr>
                ${seanceHeure ? `
                <tr>
                  <td style="padding: 4px 0; font-size: 14px; color: #64748b;">Heure</td>
                  <td style="padding: 4px 0; font-size: 14px; color: #1e293b; font-weight: 600;">${escapeHtml(seanceHeure)}</td>
                </tr>
                ` : ''}
              </table>
            </td>
          </tr>
        </table>

        <p style="margin: 16px 0 0; font-size: 14px; color: #64748b; line-height: 1.6;">
          Si vous ne pouvez pas assister à cette séance, veuillez en informer le secrétariat
          et, le cas échéant, établir une procuration.
        </p>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="padding: 20px 32px; background: #f1f5f9; border-top: 1px solid #e2e8f0;">
        <p style="margin: 0; font-size: 12px; color: #94a3b8; text-align: center;">
          ${escapeHtml(institutionNom)} — Système de gestion des séances délibérantes
        </p>
        <p style="margin: 4px 0 0; font-size: 11px; color: #cbd5e1; text-align: center;">
          Cet email de rappel a été envoyé automatiquement. Merci de ne pas y répondre.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}
