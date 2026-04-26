import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EmargementPDFData {
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
  }
  convocataires: {
    prenom: string
    nom: string
    qualite: string | null
  }[]
  quorumRequis: number | null
  totalMembres: number
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 40,
    paddingHorizontal: 40,
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
  },
  subtitle: {
    fontSize: 10,
    textAlign: 'center',
    marginBottom: 4,
    color: '#444444',
  },
  seanceInfo: {
    fontSize: 10,
    textAlign: 'center',
    marginBottom: 16,
  },
  // Table
  table: {
    width: '100%',
    marginTop: 8,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#1a1a1a',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#cbd5e1',
    minHeight: 32,
  },
  tableRowEven: {
    backgroundColor: '#f8fafc',
  },
  // Cells
  cellNumber: {
    width: 30,
    padding: 6,
    fontSize: 9,
    textAlign: 'center',
    borderRightWidth: 0.5,
    borderRightColor: '#cbd5e1',
  },
  cellNumberHeader: {
    width: 30,
    padding: 6,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    borderRightWidth: 0.5,
    borderRightColor: '#cbd5e1',
  },
  cellName: {
    width: 160,
    padding: 6,
    fontSize: 10,
    borderRightWidth: 0.5,
    borderRightColor: '#cbd5e1',
  },
  cellNameHeader: {
    width: 160,
    padding: 6,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    borderRightWidth: 0.5,
    borderRightColor: '#cbd5e1',
  },
  cellQualite: {
    width: 120,
    padding: 6,
    fontSize: 9,
    color: '#666666',
    borderRightWidth: 0.5,
    borderRightColor: '#cbd5e1',
  },
  cellQualiteHeader: {
    width: 120,
    padding: 6,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    borderRightWidth: 0.5,
    borderRightColor: '#cbd5e1',
  },
  cellSignature: {
    flex: 1,
    padding: 6,
    fontSize: 9,
    borderRightWidth: 0.5,
    borderRightColor: '#cbd5e1',
  },
  cellSignatureHeader: {
    flex: 1,
    padding: 6,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    borderRightWidth: 0.5,
    borderRightColor: '#cbd5e1',
  },
  cellHeure: {
    width: 70,
    padding: 6,
    fontSize: 9,
  },
  cellHeureHeader: {
    width: 70,
    padding: 6,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
  },
  // Footer
  quorumFooter: {
    marginTop: 16,
    padding: 8,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quorumText: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
  },
  quorumValue: {
    fontSize: 10,
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#999999',
  },
})

// ─── Component ───────────────────────────────────────────────────────────────

interface EmargementPDFDocumentProps {
  data: EmargementPDFData
}

export function EmargementPDFDocument({ data }: EmargementPDFDocumentProps) {
  const { institution, instance, seance, convocataires, quorumRequis, totalMembres } = data

  // Sort alphabetically by nom then prenom
  const sorted = [...convocataires].sort((a, b) => {
    const cmp = a.nom.localeCompare(b.nom, 'fr')
    if (cmp !== 0) return cmp
    return a.prenom.localeCompare(b.prenom, 'fr')
  })

  return (
    <Document
      title={`Feuille d'émargement - ${seance.titre} - ${seance.date}`}
      author={institution.nom}
      subject={`Feuille d'émargement du ${seance.date}`}
    >
      <Page size="A4" style={styles.page} wrap>
        {/* Header */}
        <Text style={styles.headerInstitution}>{institution.nom}</Text>
        <Text style={styles.headerInstance}>
          {instance.typeLegal}{instance.nom ? ` — ${instance.nom}` : ''}
        </Text>

        {/* Title */}
        <Text style={styles.title}>Feuille d&apos;émargement</Text>
        <Text style={styles.subtitle}>{seance.titre}</Text>
        <Text style={styles.seanceInfo}>
          Séance du {seance.date} à {seance.heure}
          {seance.lieu ? ` — ${seance.lieu}` : ''}
        </Text>

        {/* Table */}
        <View style={styles.table}>
          {/* Header row */}
          <View style={styles.tableHeaderRow}>
            <Text style={styles.cellNumberHeader}>N°</Text>
            <Text style={styles.cellNameHeader}>Nom Prénom</Text>
            <Text style={styles.cellQualiteHeader}>Qualité</Text>
            <Text style={styles.cellSignatureHeader}>Signature</Text>
            <Text style={styles.cellHeureHeader}>Heure</Text>
          </View>

          {/* Data rows */}
          {sorted.map((member, idx) => (
            <View
              key={idx}
              style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowEven : {}]}
              wrap={false}
            >
              <Text style={styles.cellNumber}>{idx + 1}</Text>
              <Text style={styles.cellName}>
                {member.nom} {member.prenom}
              </Text>
              <Text style={styles.cellQualite}>
                {member.qualite || ''}
              </Text>
              <Text style={styles.cellSignature}>{/* blank for signature */}</Text>
              <Text style={styles.cellHeure}>{/* blank for time */}</Text>
            </View>
          ))}
        </View>

        {/* Quorum footer */}
        <View style={styles.quorumFooter}>
          <Text style={styles.quorumText}>
            Membres convoqués : {totalMembres}
          </Text>
          {quorumRequis !== null && (
            <Text style={styles.quorumValue}>
              Quorum requis : {quorumRequis} membre{quorumRequis > 1 ? 's' : ''}
            </Text>
          )}
          <Text style={styles.quorumValue}>
            Présents : _____ / {totalMembres}
          </Text>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          {institution.nom} — Feuille d&apos;émargement — Séance du {seance.date}
        </Text>
      </Page>
    </Document>
  )
}
