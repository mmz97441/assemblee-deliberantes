import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DeliberationPDFData {
  institution: {
    nom: string
    type: string
    adresse?: string | null
    prefecture?: string | null
  }
  instance: {
    nom: string
    typeLegal: string
  }
  deliberation: {
    numero: string
    titre: string
    articles: string[]
    annulee: boolean
    motifAnnulation?: string | null
    publieeAt?: string | null
  }
  seance: {
    date: string
    lieu?: string | null
  }
  vote?: {
    formulePV?: string | null
    resultat?: string | null
  } | null
  point?: {
    vu?: string | null
    considerant?: string | null
  } | null
  signatures: {
    president: string | null
    secretaire: string | null
  }
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    paddingTop: 56,   // ~2cm
    paddingBottom: 56,
    paddingHorizontal: 56,
    fontFamily: 'Helvetica',
    fontSize: 10,
    lineHeight: 1.5,
    color: '#1a1a1a',
  },
  // ─── Header ─────────────────────────────────────────────────────────────
  headerInstitution: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  headerInstance: {
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 20,
    color: '#444444',
  },
  // ─── Reference ──────────────────────────────────────────────────────────
  refLine: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  dateLine: {
    fontSize: 10,
    textAlign: 'center',
    marginBottom: 24,
    color: '#444444',
  },
  // ─── Objet ──────────────────────────────────────────────────────────────
  objetLine: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 16,
  },
  // ─── Instance intro ─────────────────────────────────────────────────────
  instanceIntro: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 12,
  },
  // ─── Vu / Considérant ──────────────────────────────────────────────────
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
  // ─── Separator ──────────────────────────────────────────────────────────
  separator: {
    borderBottomWidth: 0.5,
    borderBottomColor: '#cccccc',
    marginVertical: 14,
  },
  // ─── Après en avoir délibéré ────────────────────────────────────────────
  delibereStatement: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 12,
  },
  // ─── Formule vote ───────────────────────────────────────────────────────
  formulePV: {
    fontSize: 10,
    fontFamily: 'Helvetica-Oblique',
    marginBottom: 12,
    paddingLeft: 16,
    paddingRight: 16,
    lineHeight: 1.6,
    color: '#333333',
  },
  // ─── Décide / Adopte ────────────────────────────────────────────────────
  decideLabel: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    marginTop: 8,
    marginBottom: 8,
  },
  // ─── Articles ───────────────────────────────────────────────────────────
  articleText: {
    fontSize: 10,
    marginBottom: 6,
    paddingLeft: 28, // ~1cm indent
    lineHeight: 1.5,
  },
  articleLabel: {
    fontFamily: 'Helvetica-Bold',
  },
  // ─── Fait à ─────────────────────────────────────────────────────────────
  faitA: {
    fontSize: 10,
    marginTop: 24,
    marginBottom: 8,
  },
  // ─── Signatures ─────────────────────────────────────────────────────────
  signatureBlock: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 40,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#cccccc',
  },
  signatureColumn: {
    width: '45%',
    alignItems: 'center',
  },
  signatureRole: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  signatureName: {
    fontSize: 10,
    marginBottom: 24,
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
  // ─── Footer ─────────────────────────────────────────────────────────────
  footer: {
    position: 'absolute',
    bottom: 28,
    left: 56,
    right: 56,
    textAlign: 'center',
    fontSize: 8,
    color: '#999999',
  },
  // ─── Watermark (annulée) ────────────────────────────────────────────────
  watermark: {
    position: 'absolute',
    top: '40%',
    left: '10%',
    fontSize: 60,
    fontFamily: 'Helvetica-Bold',
    color: '#ff000022',
    transform: 'rotate(-45deg)',
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
  // Fallback: use the raw type with article
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

/**
 * Split a "Vu" or "Considérant" text into individual lines.
 * The input may use semicolons, newlines, or "Vu " / "Considérant " as delimiters.
 */
function splitLegalLines(text: string, prefix: string): string[] {
  // Split on semicolons or newlines
  const raw = text.split(/[;\n]+/).map(s => s.trim()).filter(Boolean)
  // Ensure each line starts with the prefix
  return raw.map(line => {
    const lower = line.toLowerCase()
    if (lower.startsWith('vu ') || lower.startsWith('considérant ') || lower.startsWith('considerant ')) {
      return line
    }
    return `${prefix} ${line}`
  })
}

// ─── Component ──────────────────────────────────────────────────────────────

interface DeliberationPDFDocumentProps {
  data: DeliberationPDFData
}

export function DeliberationPDFDocument({ data }: DeliberationPDFDocumentProps) {
  const { institution, instance, deliberation, seance, vote, point, signatures } = data

  const instanceLabel = getInstanceLabel(instance.typeLegal)
  const decisionVerb = getDecisionVerb(vote?.resultat)

  const vuLines = point?.vu ? splitLegalLines(point.vu, 'Vu') : []
  const considerantLines = point?.considerant ? splitLegalLines(point.considerant, 'Considérant') : []

  return (
    <Document
      title={`Délibération ${deliberation.numero}`}
      author={institution.nom}
      subject={`Délibération ${deliberation.numero} — ${deliberation.titre}`}
    >
      <Page size="A4" style={styles.page} wrap>
        {/* ═══ Watermark if annulée ═══ */}
        {deliberation.annulee && (
          <Text style={styles.watermark}>ANNULÉE</Text>
        )}

        {/* ═══ Header ═══ */}
        <Text style={styles.headerInstitution}>{institution.nom}</Text>
        <Text style={styles.headerInstance}>
          {instance.typeLegal}{instance.nom ? ` — ${instance.nom}` : ''}
        </Text>

        {/* ═══ Reference ═══ */}
        <Text style={styles.refLine}>
          Délibération n° {deliberation.numero || '...'}
        </Text>
        <Text style={styles.dateLine}>
          Séance du {seance.date}
        </Text>

        {/* ═══ Objet ═══ */}
        <Text style={styles.objetLine}>
          OBJET : {deliberation.titre}
        </Text>

        {/* ═══ Instance intro ═══ */}
        <Text style={styles.instanceIntro}>{instanceLabel},</Text>

        {/* ═══ Vu ═══ */}
        {vuLines.length > 0 && (
          <View>
            {vuLines.map((line, i) => (
              <Text key={`vu-${i}`} style={styles.vuLine}>
                {line}{i < vuLines.length - 1 ? ' ;' : ''}
              </Text>
            ))}
          </View>
        )}

        {/* ═══ Considérant ═══ */}
        {considerantLines.length > 0 && (
          <View style={{ marginTop: vuLines.length > 0 ? 8 : 0 }}>
            {considerantLines.map((line, i) => (
              <Text key={`cons-${i}`} style={styles.vuLine}>
                {line}{i < considerantLines.length - 1 ? ' ;' : ''}
              </Text>
            ))}
          </View>
        )}

        {/* ═══ Separator ═══ */}
        {(vuLines.length > 0 || considerantLines.length > 0) && (
          <View style={styles.separator} />
        )}

        {/* ═══ Après en avoir délibéré ═══ */}
        <Text style={styles.delibereStatement}>
          APRÈS EN AVOIR DÉLIBÉRÉ,
        </Text>

        {/* ═══ Formule PV (vote result) ═══ */}
        {vote?.formulePV && (
          <Text style={styles.formulePV}>{vote.formulePV}</Text>
        )}

        {/* ═══ Décide / Adopte ═══ */}
        <Text style={styles.decideLabel}>{decisionVerb}</Text>

        {/* ═══ Articles ═══ */}
        {deliberation.articles.length > 0 ? (
          deliberation.articles.map((article, idx) => (
            <Text key={`art-${idx}`} style={styles.articleText}>
              <Text style={styles.articleLabel}>Article {idx + 1} : </Text>
              {article}
            </Text>
          ))
        ) : (
          <Text style={styles.articleText}>
            <Text style={styles.articleLabel}>Article unique : </Text>
            {deliberation.titre}
          </Text>
        )}

        {/* ═══ Annulation notice ═══ */}
        {deliberation.annulee && deliberation.motifAnnulation && (
          <View style={{ marginTop: 16 }}>
            <Text style={[styles.sectionLabel, { color: '#cc0000' }]}>
              Délibération annulée
            </Text>
            <Text style={[styles.vuLine, { color: '#cc0000' }]}>
              Motif : {deliberation.motifAnnulation}
            </Text>
          </View>
        )}

        {/* ═══ Fait à ═══ */}
        <Text style={styles.faitA}>
          Fait à {seance.lieu || '...'}, le{' '}
          {deliberation.publieeAt || seance.date}
        </Text>

        {/* ═══ Signatures ═══ */}
        <View style={styles.signatureBlock}>
          <View style={styles.signatureColumn}>
            <Text style={styles.signatureRole}>Le/La Président(e)</Text>
            <Text style={styles.signatureName}>{signatures.president || '...'}</Text>
            <Text style={styles.signatureLabel}>Signature</Text>
          </View>
          <View style={styles.signatureColumn}>
            <Text style={styles.signatureRole}>Le/La Secrétaire</Text>
            <Text style={styles.signatureName}>{signatures.secretaire || '...'}</Text>
            <Text style={styles.signatureLabel}>Signature</Text>
          </View>
        </View>

        {/* ═══ Footer ═══ */}
        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `${institution.nom} — Délibération n° ${deliberation.numero || '...'} — Page ${pageNumber} / ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  )
}
