import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface RegisterDeliberationEntry {
  numero: string
  titre: string
  dateSeance: string
  instanceNom: string
  instanceTypeLegal: string
  annulee: boolean
  motifAnnulation?: string | null
  publieeAt?: string | null
  vu?: string | null
  considerant?: string | null
  formulePV?: string | null
  resultatVote?: string | null
  articles: string[]
  presidentNom?: string | null
  secretaireNom?: string | null
  lieu?: string | null
}

export interface RegisterPDFData {
  institution: {
    nom: string
    type: string
    adresse?: string | null
    prefecture?: string | null
  }
  year: number
  instanceNom?: string | null
  deliberations: RegisterDeliberationEntry[]
  presidentNom?: string | null
  closedAt?: string | null
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ═══ Common ═══
  page: {
    paddingTop: 56,
    paddingBottom: 56,
    paddingHorizontal: 56,
    fontFamily: 'Helvetica',
    fontSize: 10,
    lineHeight: 1.5,
    color: '#1a1a1a',
  },
  footer: {
    position: 'absolute',
    bottom: 28,
    left: 56,
    right: 56,
    textAlign: 'center',
    fontSize: 8,
    color: '#999999',
  },

  // ═══ Cover page ═══
  coverContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverInstitution: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  coverInstitutionType: {
    fontSize: 12,
    textAlign: 'center',
    color: '#444444',
    marginBottom: 60,
  },
  coverTitle: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 12,
    paddingVertical: 12,
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#333333',
  },
  coverYear: {
    fontSize: 28,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginBottom: 40,
    color: '#1a1a1a',
  },
  coverInstance: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
    color: '#444444',
  },
  coverCount: {
    fontSize: 12,
    textAlign: 'center',
    color: '#666666',
    marginTop: 40,
  },
  coverAddress: {
    fontSize: 10,
    textAlign: 'center',
    color: '#888888',
    marginTop: 8,
  },

  // ═══ Table of contents ═══
  tocTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    textTransform: 'uppercase',
    marginBottom: 24,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  tocRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#eeeeee',
  },
  tocRowAnnulee: {
    flexDirection: 'row',
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#eeeeee',
    opacity: 0.5,
  },
  tocNumero: {
    width: 80,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
  },
  tocDate: {
    width: 90,
    fontSize: 9,
    color: '#666666',
  },
  tocTitre: {
    flex: 1,
    fontSize: 9,
  },
  tocAnnulee: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#cc0000',
    marginLeft: 4,
  },

  // ═══ Deliberation sections ═══
  delibSeparator: {
    borderBottomWidth: 2,
    borderBottomColor: '#333333',
    marginBottom: 20,
    marginTop: 8,
  },
  delibHeader: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  delibDate: {
    fontSize: 10,
    textAlign: 'center',
    marginBottom: 4,
    color: '#444444',
  },
  delibInstance: {
    fontSize: 10,
    textAlign: 'center',
    marginBottom: 16,
    color: '#666666',
  },
  delibObjet: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 14,
  },
  instanceIntro: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    marginTop: 8,
    marginBottom: 4,
  },
  vuLine: {
    fontSize: 10,
    fontFamily: 'Helvetica-Oblique',
    marginBottom: 3,
    paddingLeft: 12,
    lineHeight: 1.5,
  },
  thinSeparator: {
    borderBottomWidth: 0.5,
    borderBottomColor: '#cccccc',
    marginVertical: 12,
  },
  delibereStatement: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  formulePV: {
    fontSize: 10,
    fontFamily: 'Helvetica-Oblique',
    marginBottom: 10,
    paddingLeft: 16,
    paddingRight: 16,
    lineHeight: 1.6,
    color: '#333333',
  },
  decideLabel: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    marginTop: 6,
    marginBottom: 6,
  },
  articleText: {
    fontSize: 10,
    marginBottom: 4,
    paddingLeft: 28,
    lineHeight: 1.5,
  },
  articleLabel: {
    fontFamily: 'Helvetica-Bold',
  },
  faitA: {
    fontSize: 10,
    marginTop: 20,
    marginBottom: 6,
  },
  signatureBlock: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 30,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#cccccc',
  },
  signatureColumn: {
    width: '45%',
    alignItems: 'center',
  },
  signatureRole: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  signatureName: {
    fontSize: 10,
    marginBottom: 20,
  },
  signatureLabel: {
    fontSize: 9,
    color: '#666666',
    borderTopWidth: 0.5,
    borderTopColor: '#999999',
    paddingTop: 4,
    width: '80%',
    textAlign: 'center',
  },

  // ═══ Watermark (annulée) ═══
  watermark: {
    position: 'absolute',
    top: '40%',
    left: '10%',
    fontSize: 60,
    fontFamily: 'Helvetica-Bold',
    color: '#ff000022',
    transform: 'rotate(-45deg)',
  },

  // ═══ Final page ═══
  finalContainer: {
    marginTop: 60,
  },
  finalText: {
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 8,
  },
  finalBold: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  finalSignature: {
    marginTop: 40,
    alignItems: 'center',
  },
  finalSignatureRole: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  finalSignatureName: {
    fontSize: 11,
    marginBottom: 28,
  },
  finalSignatureLine: {
    fontSize: 9,
    color: '#666666',
    borderTopWidth: 0.5,
    borderTopColor: '#999999',
    paddingTop: 4,
    width: 200,
    textAlign: 'center',
  },
})

// ─── Helpers ────────────────────────────────────────────────────────────────

function getInstanceLabel(typeLegal: string): string {
  const upper = typeLegal.toUpperCase()
  if (upper.includes('CONSEIL MUNICIPAL')) return 'LE CONSEIL MUNICIPAL'
  if (upper.includes('CONSEIL COMMUNAUTAIRE')) return 'LE CONSEIL COMMUNAUTAIRE'
  if (upper.includes("CONSEIL D'ADMINISTRATION") || upper.includes('CONSEIL D\'ADMINISTRATION')) return "LE CONSEIL D'ADMINISTRATION"
  if (upper.includes('BUREAU')) return 'LE BUREAU'
  if (upper.includes('COMITÉ SYNDICAL') || upper.includes('COMITE SYNDICAL')) return 'LE COMITÉ SYNDICAL'
  if (upper.includes('COMMISSION')) return 'LA COMMISSION'
  if (upper.includes('ASSEMBLÉE') || upper.includes('ASSEMBLEE')) return "L'ASSEMBLÉE GÉNÉRALE"
  if (upper.includes('CONSEIL DÉPARTEMENTAL') || upper.includes('CONSEIL DEPARTEMENTAL')) return 'LE CONSEIL DÉPARTEMENTAL'
  return `LE ${upper}`
}

function getDecisionVerb(resultat?: string | null): string {
  if (!resultat) return 'DÉCIDE :'
  const r = resultat.toUpperCase()
  if (r.includes('ADOPTE') || r.includes('UNANIMITÉ') || r.includes('UNANIMITE') || r.includes('VOIX_PREPONDERANTE')) {
    return 'ADOPTE :'
  }
  return 'DÉCIDE :'
}

function splitLegalLines(text: string, prefix: string): string[] {
  const raw = text.split(/[;\n]+/).map(s => s.trim()).filter(Boolean)
  return raw.map(line => {
    const lower = line.toLowerCase()
    if (lower.startsWith('vu ') || lower.startsWith('considérant ') || lower.startsWith('considerant ')) {
      return line
    }
    return `${prefix} ${line}`
  })
}

// ─── Component ──────────────────────────────────────────────────────────────

interface RegisterPDFDocumentProps {
  data: RegisterPDFData
}

export function RegisterPDFDocument({ data }: RegisterPDFDocumentProps) {
  const { institution, year, deliberations, presidentNom, closedAt } = data

  const todayFormatted = closedAt || new Date().toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const footerText = `${institution.nom} — Registre des délibérations ${year}`

  return (
    <Document
      title={`Registre des délibérations — ${year}`}
      author={institution.nom}
      subject={`Registre officiel des délibérations de l'année ${year}`}
    >
      {/* ═══════════════════════════════════════════════════════════════════════
           COVER PAGE
           ═══════════════════════════════════════════════════════════════════════ */}
      <Page size="A4" style={styles.page}>
        <View style={styles.coverContainer}>
          <Text style={styles.coverInstitution}>{institution.nom}</Text>
          {institution.type && (
            <Text style={styles.coverInstitutionType}>{institution.type}</Text>
          )}

          <Text style={styles.coverTitle}>REGISTRE DES DÉLIBÉRATIONS</Text>

          <Text style={styles.coverYear}>Année {year}</Text>

          {data.instanceNom && (
            <Text style={styles.coverInstance}>{data.instanceNom}</Text>
          )}

          <Text style={styles.coverCount}>
            {deliberations.length} délibération{deliberations.length > 1 ? 's' : ''} enregistrée{deliberations.length > 1 ? 's' : ''}
          </Text>

          {institution.adresse && (
            <Text style={styles.coverAddress}>{institution.adresse}</Text>
          )}
        </View>

        <Text style={styles.footer} fixed>
          {footerText}
        </Text>
      </Page>

      {/* ═══════════════════════════════════════════════════════════════════════
           TABLE OF CONTENTS
           ═══════════════════════════════════════════════════════════════════════ */}
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.tocTitle}>Table des matières</Text>

        {deliberations.map((delib, idx) => (
          <View
            key={`toc-${idx}`}
            style={delib.annulee ? styles.tocRowAnnulee : styles.tocRow}
            wrap={false}
          >
            <Text style={styles.tocNumero}>n° {delib.numero}</Text>
            <Text style={styles.tocDate}>{delib.dateSeance}</Text>
            <Text style={styles.tocTitre}>
              {delib.titre}
              {delib.annulee && (
                <Text style={styles.tocAnnulee}> [ANNULÉE]</Text>
              )}
            </Text>
          </View>
        ))}

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `${footerText} — Page ${pageNumber} / ${totalPages}`
          }
          fixed
        />
      </Page>

      {/* ═══════════════════════════════════════════════════════════════════════
           DELIBERATION PAGES
           ═══════════════════════════════════════════════════════════════════════ */}
      {deliberations.map((delib, idx) => {
        const instanceLabel = getInstanceLabel(delib.instanceTypeLegal)
        const decisionVerb = getDecisionVerb(delib.resultatVote)
        const vuLines = delib.vu ? splitLegalLines(delib.vu, 'Vu') : []
        const considerantLines = delib.considerant ? splitLegalLines(delib.considerant, 'Considérant') : []

        return (
          <Page key={`delib-${idx}`} size="A4" style={styles.page} wrap>
            {/* Watermark if annulée */}
            {delib.annulee && (
              <Text style={styles.watermark}>ANNULÉE</Text>
            )}

            {/* Separator bar */}
            <View style={styles.delibSeparator} />

            {/* Header */}
            <Text style={styles.delibHeader}>
              Délibération n° {delib.numero}
            </Text>
            <Text style={styles.delibDate}>
              Séance du {delib.dateSeance}
            </Text>
            {delib.instanceNom && (
              <Text style={styles.delibInstance}>
                {delib.instanceTypeLegal}{delib.instanceNom ? ` — ${delib.instanceNom}` : ''}
              </Text>
            )}

            {/* Objet */}
            <Text style={styles.delibObjet}>
              OBJET : {delib.titre}
            </Text>

            {/* Instance intro */}
            <Text style={styles.instanceIntro}>{instanceLabel},</Text>

            {/* Vu */}
            {vuLines.length > 0 && (
              <View>
                {vuLines.map((line, i) => (
                  <Text key={`vu-${i}`} style={styles.vuLine}>
                    {line}{i < vuLines.length - 1 ? ' ;' : ''}
                  </Text>
                ))}
              </View>
            )}

            {/* Considérant */}
            {considerantLines.length > 0 && (
              <View style={{ marginTop: vuLines.length > 0 ? 8 : 0 }}>
                {considerantLines.map((line, i) => (
                  <Text key={`cons-${i}`} style={styles.vuLine}>
                    {line}{i < considerantLines.length - 1 ? ' ;' : ''}
                  </Text>
                ))}
              </View>
            )}

            {/* Separator */}
            {(vuLines.length > 0 || considerantLines.length > 0) && (
              <View style={styles.thinSeparator} />
            )}

            {/* Après en avoir délibéré */}
            <Text style={styles.delibereStatement}>
              APRÈS EN AVOIR DÉLIBÉRÉ,
            </Text>

            {/* Formule PV */}
            {delib.formulePV && (
              <Text style={styles.formulePV}>{delib.formulePV}</Text>
            )}

            {/* Décide / Adopte */}
            <Text style={styles.decideLabel}>{decisionVerb}</Text>

            {/* Articles */}
            {delib.articles.length > 0 ? (
              delib.articles.map((article, aIdx) => (
                <Text key={`art-${aIdx}`} style={styles.articleText}>
                  <Text style={styles.articleLabel}>Article {aIdx + 1} : </Text>
                  {article}
                </Text>
              ))
            ) : (
              <Text style={styles.articleText}>
                <Text style={styles.articleLabel}>Article unique : </Text>
                {delib.titre}
              </Text>
            )}

            {/* Annulation notice */}
            {delib.annulee && delib.motifAnnulation && (
              <View style={{ marginTop: 14 }}>
                <Text style={[styles.sectionLabel, { color: '#cc0000' }]}>
                  Délibération annulée
                </Text>
                <Text style={[styles.vuLine, { color: '#cc0000' }]}>
                  Motif : {delib.motifAnnulation}
                </Text>
              </View>
            )}

            {/* Fait à */}
            <Text style={styles.faitA}>
              Fait à {delib.lieu || '...'}, le{' '}
              {delib.publieeAt || delib.dateSeance}
            </Text>

            {/* Signatures */}
            <View style={styles.signatureBlock}>
              <View style={styles.signatureColumn}>
                <Text style={styles.signatureRole}>Le/La Président(e)</Text>
                <Text style={styles.signatureName}>{delib.presidentNom || '...'}</Text>
                <Text style={styles.signatureLabel}>Signature</Text>
              </View>
              <View style={styles.signatureColumn}>
                <Text style={styles.signatureRole}>Le/La Secrétaire</Text>
                <Text style={styles.signatureName}>{delib.secretaireNom || '...'}</Text>
                <Text style={styles.signatureLabel}>Signature</Text>
              </View>
            </View>

            {/* Footer */}
            <Text
              style={styles.footer}
              render={({ pageNumber, totalPages }) =>
                `${footerText} — Page ${pageNumber} / ${totalPages}`
              }
              fixed
            />
          </Page>
        )
      })}

      {/* ═══════════════════════════════════════════════════════════════════════
           FINAL (CERTIFICATION) PAGE
           ═══════════════════════════════════════════════════════════════════════ */}
      <Page size="A4" style={styles.page}>
        <View style={styles.finalContainer}>
          <Text style={styles.finalBold}>
            {institution.nom}
          </Text>
          <Text style={styles.finalText}>
            {'\n'}
          </Text>
          <Text style={styles.finalBold}>
            REGISTRE DES DÉLIBÉRATIONS — Année {year}
          </Text>
          <Text style={styles.finalText}>
            {'\n'}
          </Text>
          <Text style={styles.finalText}>
            Le présent registre contient {deliberations.length} délibération{deliberations.length > 1 ? 's' : ''}.
          </Text>
          <Text style={styles.finalText}>
            {'\n'}
          </Text>
          <Text style={styles.finalText}>
            Arrêté et clos le {todayFormatted}
          </Text>
          <Text style={styles.finalText}>
            {'\n'}
          </Text>
          <Text style={styles.finalText}>
            Certifié conforme,
          </Text>

          <View style={styles.finalSignature}>
            <Text style={styles.finalSignatureRole}>Le/La Président(e)</Text>
            <Text style={styles.finalSignatureName}>{presidentNom || '...'}</Text>
            <Text style={styles.finalSignatureLine}>Signature</Text>
          </View>

          {institution.adresse && (
            <Text style={[styles.finalText, { marginTop: 40, color: '#888888', fontSize: 9 }]}>
              Fait à {institution.adresse}
            </Text>
          )}
        </View>

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `${footerText} — Page ${pageNumber} / ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  )
}
