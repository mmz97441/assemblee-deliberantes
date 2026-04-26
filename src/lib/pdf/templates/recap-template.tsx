import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RecapPDFData {
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
    heureOuverture: string | null
    heureCloture: string | null
    lieu: string | null
    mode: string
  }
  presences: {
    presents: number
    excuses: number
    absents: number
    quorumAtteint: boolean
    quorumRequis: number | null
  }
  points: {
    position: number
    titre: string
    type: string
    resultat: string | null
    voteDetail: string | null
  }[]
  prochainEtape: string
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 40,
    paddingHorizontal: 48,
    fontFamily: 'Helvetica',
    fontSize: 10,
    lineHeight: 1.4,
    color: '#1a1a1a',
  },
  // Header
  headerInstitution: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginBottom: 2,
  },
  headerInstance: {
    fontSize: 10,
    textAlign: 'center',
    marginBottom: 12,
    color: '#444444',
  },
  // Title
  title: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    textTransform: 'uppercase',
    marginBottom: 4,
    paddingBottom: 4,
    borderBottomWidth: 2,
    borderBottomColor: '#1a1a1a',
  },
  seanceTitre: {
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 4,
    fontFamily: 'Helvetica-Bold',
  },
  seanceDate: {
    fontSize: 10,
    textAlign: 'center',
    marginBottom: 16,
    color: '#444444',
  },
  // Presence summary
  presenceBlock: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    padding: 10,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
  },
  presenceItem: {
    alignItems: 'center',
  },
  presenceNumber: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
  },
  presenceLabel: {
    fontSize: 8,
    color: '#666666',
    marginTop: 2,
  },
  quorumBadge: {
    marginTop: 2,
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    padding: 2,
    borderRadius: 2,
  },
  quorumOk: {
    color: '#16a34a',
    backgroundColor: '#dcfce7',
  },
  quorumKo: {
    color: '#dc2626',
    backgroundColor: '#fef2f2',
  },
  // Section
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    marginTop: 12,
    marginBottom: 6,
    textTransform: 'uppercase',
    color: '#1a1a1a',
  },
  // Points table
  pointRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 4,
    paddingHorizontal: 4,
    minHeight: 20,
  },
  pointRowEven: {
    backgroundColor: '#f8fafc',
  },
  pointNumber: {
    width: 24,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
  },
  pointTitle: {
    flex: 1,
    fontSize: 9,
    paddingRight: 8,
  },
  pointResultat: {
    width: 140,
    fontSize: 9,
    textAlign: 'right',
  },
  resultatAdopte: {
    color: '#16a34a',
    fontFamily: 'Helvetica-Bold',
  },
  resultatRejete: {
    color: '#dc2626',
    fontFamily: 'Helvetica-Bold',
  },
  resultatInfo: {
    color: '#666666',
    fontFamily: 'Helvetica-Oblique',
  },
  // Horaires
  horairesBlock: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  horaireItem: {
    fontSize: 10,
  },
  horaireLabel: {
    fontFamily: 'Helvetica-Bold',
  },
  // Next step
  nextStepBlock: {
    marginTop: 12,
    padding: 8,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 4,
  },
  nextStepLabel: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#1d4ed8',
    marginBottom: 2,
  },
  nextStepText: {
    fontSize: 9,
    color: '#1e40af',
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 48,
    right: 48,
    textAlign: 'center',
    fontSize: 8,
    color: '#999999',
  },
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatResultat(resultat: string | null, detail: string | null): {
  text: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  style: any
} {
  if (!resultat) {
    return { text: 'Information', style: styles.resultatInfo }
  }

  switch (resultat) {
    case 'ADOPTE':
      return { text: detail || 'Adopté', style: styles.resultatAdopte }
    case 'ADOPTE_UNANIMITE':
      return { text: 'Adopté à l\'unanimité', style: styles.resultatAdopte }
    case 'ADOPTE_VOIX_PREPONDERANTE':
      return { text: detail || 'Adopté (voix prépondérante)', style: styles.resultatAdopte }
    case 'REJETE':
      return { text: detail || 'Rejeté', style: styles.resultatRejete }
    case 'NUL':
      return { text: 'Vote nul', style: styles.resultatRejete }
    default:
      return { text: resultat, style: styles.resultatInfo }
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

interface RecapPDFDocumentProps {
  data: RecapPDFData
}

export function RecapPDFDocument({ data }: RecapPDFDocumentProps) {
  const { institution, instance, seance, presences, points, prochainEtape } = data

  return (
    <Document
      title={`Récapitulatif - ${seance.titre} - ${seance.date}`}
      author={institution.nom}
      subject={`Récapitulatif de la séance du ${seance.date}`}
    >
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <Text style={styles.headerInstitution}>{institution.nom}</Text>
        <Text style={styles.headerInstance}>
          {instance.typeLegal}{instance.nom ? ` — ${instance.nom}` : ''}
        </Text>

        {/* Title */}
        <Text style={styles.title}>Récapitulatif de séance</Text>
        <Text style={styles.seanceTitre}>{seance.titre}</Text>
        <Text style={styles.seanceDate}>
          Séance du {seance.date}
          {seance.lieu ? ` — ${seance.lieu}` : ''}
        </Text>

        {/* Présences */}
        <Text style={styles.sectionTitle}>Présences</Text>
        <View style={styles.presenceBlock}>
          <View style={styles.presenceItem}>
            <Text style={styles.presenceNumber}>{presences.presents}</Text>
            <Text style={styles.presenceLabel}>Présent{presences.presents > 1 ? 's' : ''}</Text>
          </View>
          <View style={styles.presenceItem}>
            <Text style={styles.presenceNumber}>{presences.excuses}</Text>
            <Text style={styles.presenceLabel}>Excusé{presences.excuses > 1 ? 's' : ''}</Text>
          </View>
          <View style={styles.presenceItem}>
            <Text style={styles.presenceNumber}>{presences.absents}</Text>
            <Text style={styles.presenceLabel}>Absent{presences.absents > 1 ? 's' : ''}</Text>
          </View>
          <View style={styles.presenceItem}>
            <Text
              style={[
                styles.quorumBadge,
                presences.quorumAtteint ? styles.quorumOk : styles.quorumKo,
              ]}
            >
              Quorum {presences.quorumAtteint ? 'atteint' : 'non atteint'}
            </Text>
            {presences.quorumRequis !== null && (
              <Text style={styles.presenceLabel}>
                Requis : {presences.quorumRequis}
              </Text>
            )}
          </View>
        </View>

        {/* Points ODJ + results */}
        <Text style={styles.sectionTitle}>Ordre du jour et résultats</Text>
        {points.map((point, idx) => {
          const res = formatResultat(point.resultat, point.voteDetail)
          return (
            <View
              key={point.position}
              style={[styles.pointRow, idx % 2 === 1 ? styles.pointRowEven : {}]}
              wrap={false}
            >
              <Text style={styles.pointNumber}>{point.position}</Text>
              <Text style={styles.pointTitle}>{point.titre}</Text>
              <Text style={[styles.pointResultat, res.style]}>{res.text}</Text>
            </View>
          )
        })}

        {/* Horaires */}
        <View style={styles.horairesBlock}>
          <Text style={styles.horaireItem}>
            <Text style={styles.horaireLabel}>Séance ouverte à </Text>
            {seance.heureOuverture || '...'}
          </Text>
          <Text style={styles.horaireItem}>
            <Text style={styles.horaireLabel}>Séance clôturée à </Text>
            {seance.heureCloture || '...'}
          </Text>
        </View>

        {/* Prochaine étape */}
        {prochainEtape && (
          <View style={styles.nextStepBlock}>
            <Text style={styles.nextStepLabel}>Prochaine étape</Text>
            <Text style={styles.nextStepText}>{prochainEtape}</Text>
          </View>
        )}

        {/* Footer */}
        <Text style={styles.footer}>
          {institution.nom} — Récapitulatif de séance du {seance.date} — Document généré automatiquement
        </Text>
      </Page>
    </Document>
  )
}
