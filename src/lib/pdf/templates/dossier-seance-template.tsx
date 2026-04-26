import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DossierSeancePDFData {
  institution: {
    nom: string
    type: string
  }
  instance: {
    nom: string
    typeLegal: string
  }
  seance: {
    titre: string
    date: string
    heure: string
    lieu: string | null
    mode: string
  }
  points: {
    position: number
    titre: string
    type: string
    rapporteur: string | null
    description: string | null
    projetDeliberation: string | null
    vu: string | null
    considerant: string | null
  }[]
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Cover page
  coverPage: {
    paddingTop: 160,
    paddingBottom: 56,
    paddingHorizontal: 56,
    fontFamily: 'Helvetica',
    fontSize: 10,
    lineHeight: 1.5,
    color: '#1a1a1a',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  coverInstitution: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  coverInstance: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 40,
    color: '#444444',
  },
  coverTitle: {
    fontSize: 24,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    textTransform: 'uppercase',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 3,
    borderBottomColor: '#1a1a1a',
    width: '100%',
  },
  coverSeanceTitre: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginBottom: 24,
  },
  coverInfoBlock: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
    width: '100%',
  },
  coverInfoRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  coverInfoLabel: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    width: 80,
  },
  coverInfoValue: {
    fontSize: 11,
    flex: 1,
  },
  // Table of contents
  tocPage: {
    paddingTop: 56,
    paddingBottom: 56,
    paddingHorizontal: 56,
    fontFamily: 'Helvetica',
    fontSize: 10,
    lineHeight: 1.5,
    color: '#1a1a1a',
  },
  tocTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginBottom: 24,
    textTransform: 'uppercase',
  },
  tocItem: {
    flexDirection: 'row',
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
  },
  tocNumber: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    width: 30,
  },
  tocText: {
    fontSize: 10,
    flex: 1,
  },
  tocType: {
    fontSize: 9,
    color: '#666666',
    fontFamily: 'Helvetica-Oblique',
    marginLeft: 8,
  },
  // Content pages
  page: {
    paddingTop: 56,
    paddingBottom: 56,
    paddingHorizontal: 56,
    fontFamily: 'Helvetica',
    fontSize: 10,
    lineHeight: 1.5,
    color: '#1a1a1a',
  },
  pointHeader: {
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  pointNumber: {
    fontSize: 9,
    color: '#666666',
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  pointTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
  },
  pointMeta: {
    flexDirection: 'row',
    gap: 16,
  },
  pointMetaItem: {
    fontSize: 9,
    color: '#666666',
  },
  pointMetaBold: {
    fontFamily: 'Helvetica-Bold',
  },
  // Sections
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    marginTop: 14,
    marginBottom: 6,
  },
  bodyText: {
    fontSize: 10,
    marginBottom: 4,
    lineHeight: 1.6,
  },
  projetBlock: {
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
    marginBottom: 8,
  },
  projetText: {
    fontSize: 10,
    lineHeight: 1.6,
  },
  vuLine: {
    fontSize: 10,
    fontFamily: 'Helvetica-Oblique',
    marginBottom: 3,
    paddingLeft: 12,
    lineHeight: 1.5,
  },
  // Notes section
  notesSection: {
    marginTop: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  notesLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 8,
    color: '#666666',
  },
  notesLine: {
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
    height: 20,
    marginBottom: 2,
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 28,
    left: 56,
    right: 56,
    textAlign: 'center',
    fontSize: 8,
    color: '#999999',
  },
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatModeLabel(mode: string): string {
  switch (mode) {
    case 'PRESENTIEL': return 'Présentiel'
    case 'VISIOCONFERENCE': return 'Visioconférence'
    case 'MIXTE': return 'Mixte'
    case 'HYBRIDE': return 'Hybride'
    default: return mode
  }
}

function formatTypeLabel(type: string): string {
  switch (type) {
    case 'DELIBERATION': return 'Délibération'
    case 'INFORMATION': return 'Information'
    case 'QUESTION_DIVERSE': return 'Question diverse'
    case 'ELECTION': return 'Élection'
    case 'APPROBATION_PV': return 'Approbation PV'
    default: return type
  }
}

function splitLegalLines(text: string): string[] {
  return text.split(/[;\n]+/).map(s => s.trim()).filter(Boolean)
}

// ─── Component ───────────────────────────────────────────────────────────────

interface DossierSeancePDFDocumentProps {
  data: DossierSeancePDFData
}

export function DossierSeancePDFDocument({ data }: DossierSeancePDFDocumentProps) {
  const { institution, instance, seance, points } = data

  return (
    <Document
      title={`Dossier de séance - ${seance.titre} - ${seance.date}`}
      author={institution.nom}
      subject={`Dossier de séance du ${seance.date}`}
    >
      {/* ═══ Cover page ═══ */}
      <Page size="A4" style={styles.coverPage}>
        <Text style={styles.coverInstitution}>{institution.nom}</Text>
        <Text style={styles.coverInstance}>
          {instance.typeLegal}{instance.nom ? ` — ${instance.nom}` : ''}
        </Text>

        <Text style={styles.coverTitle}>Dossier de séance</Text>
        <Text style={styles.coverSeanceTitre}>{seance.titre}</Text>

        <View style={styles.coverInfoBlock}>
          <View style={styles.coverInfoRow}>
            <Text style={styles.coverInfoLabel}>Date :</Text>
            <Text style={styles.coverInfoValue}>{seance.date}</Text>
          </View>
          <View style={styles.coverInfoRow}>
            <Text style={styles.coverInfoLabel}>Heure :</Text>
            <Text style={styles.coverInfoValue}>{seance.heure}</Text>
          </View>
          {seance.lieu && (
            <View style={styles.coverInfoRow}>
              <Text style={styles.coverInfoLabel}>Lieu :</Text>
              <Text style={styles.coverInfoValue}>{seance.lieu}</Text>
            </View>
          )}
          <View style={styles.coverInfoRow}>
            <Text style={styles.coverInfoLabel}>Mode :</Text>
            <Text style={styles.coverInfoValue}>{formatModeLabel(seance.mode)}</Text>
          </View>
          <View style={styles.coverInfoRow}>
            <Text style={styles.coverInfoLabel}>Points :</Text>
            <Text style={styles.coverInfoValue}>{points.length} point{points.length > 1 ? 's' : ''} à l&apos;ordre du jour</Text>
          </View>
        </View>

        <Text style={styles.footer}>
          Document généré automatiquement — {institution.nom}
        </Text>
      </Page>

      {/* ═══ Table of contents ═══ */}
      <Page size="A4" style={styles.tocPage}>
        <Text style={styles.tocTitle}>Table des matières</Text>
        {points.map((point) => (
          <View key={point.position} style={styles.tocItem}>
            <Text style={styles.tocNumber}>
              {point.position}.
            </Text>
            <Text style={styles.tocText}>{point.titre}</Text>
            <Text style={styles.tocType}>
              {formatTypeLabel(point.type)}
            </Text>
          </View>
        ))}
        <Text style={styles.footer}>
          {institution.nom} — Dossier de séance du {seance.date}
        </Text>
      </Page>

      {/* ═══ One page per point ═══ */}
      {points.map((point) => (
        <Page key={point.position} size="A4" style={styles.page} wrap>
          {/* Point header */}
          <View style={styles.pointHeader}>
            <Text style={styles.pointNumber}>
              Point n° {point.position} — {formatTypeLabel(point.type)}
            </Text>
            <Text style={styles.pointTitle}>{point.titre}</Text>
            <View style={styles.pointMeta}>
              {point.rapporteur && (
                <Text style={styles.pointMetaItem}>
                  <Text style={styles.pointMetaBold}>Rapporteur : </Text>
                  {point.rapporteur}
                </Text>
              )}
            </View>
          </View>

          {/* Vu */}
          {point.vu && (
            <>
              <Text style={styles.sectionLabel}>Vu</Text>
              {splitLegalLines(point.vu).map((line, i) => (
                <Text key={i} style={styles.vuLine}>{line} ;</Text>
              ))}
            </>
          )}

          {/* Considérant */}
          {point.considerant && (
            <>
              <Text style={styles.sectionLabel}>Considérant</Text>
              {splitLegalLines(point.considerant).map((line, i) => (
                <Text key={i} style={styles.vuLine}>{line} ;</Text>
              ))}
            </>
          )}

          {/* Projet de délibération */}
          {point.projetDeliberation && (
            <>
              <Text style={styles.sectionLabel}>Projet de délibération</Text>
              <View style={styles.projetBlock}>
                <Text style={styles.projetText}>{point.projetDeliberation}</Text>
              </View>
            </>
          )}

          {/* Description */}
          {point.description && (
            <>
              <Text style={styles.sectionLabel}>Description</Text>
              <Text style={styles.bodyText}>{point.description}</Text>
            </>
          )}

          {/* Notes section (blank lines for handwriting) */}
          <View style={styles.notesSection}>
            <Text style={styles.notesLabel}>Espace pour vos annotations</Text>
            {Array.from({ length: 8 }).map((_, i) => (
              <View key={i} style={styles.notesLine} />
            ))}
          </View>

          {/* Footer */}
          <Text style={styles.footer}>
            {institution.nom} — Dossier de séance du {seance.date} — Point {point.position}/{points.length}
          </Text>
        </Page>
      ))}
    </Document>
  )
}
