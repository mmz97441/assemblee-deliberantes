import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from '@react-pdf/renderer'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ConvocationPDFData {
  institution: {
    nom: string
    type: string
    adresse?: string | null
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
  president: {
    civilite: string
    nom: string
  }
  membre: {
    civilite: string
    prenom: string
    nom: string
    qualite?: string | null
  }
  odjPoints: {
    position: number
    titre: string
    type: string
  }[]
  qrCodeUrl: string | null
  dateFait: string
  lieuFait: string
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    paddingTop: 56,
    paddingBottom: 56,
    paddingHorizontal: 56,
    fontFamily: 'Helvetica',
    fontSize: 10,
    lineHeight: 1.5,
    color: '#1a1a1a',
  },
  // Header
  headerInstitution: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  headerInstance: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 20,
    color: '#444444',
  },
  // Title
  title: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    textTransform: 'uppercase',
    marginBottom: 24,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#1a1a1a',
  },
  // Body
  bodyText: {
    fontSize: 10,
    marginBottom: 8,
    lineHeight: 1.6,
  },
  bodyTextBold: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 8,
    lineHeight: 1.6,
  },
  // Séance info block
  infoBlock: {
    marginTop: 12,
    marginBottom: 20,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  infoLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    width: 80,
  },
  infoValue: {
    fontSize: 10,
    flex: 1,
  },
  // ODJ
  odjTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    marginTop: 16,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  odjItem: {
    flexDirection: 'row',
    marginBottom: 4,
    paddingLeft: 8,
  },
  odjNumber: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    width: 24,
    textAlign: 'right',
    marginRight: 8,
  },
  odjText: {
    fontSize: 10,
    flex: 1,
  },
  odjType: {
    fontSize: 9,
    color: '#666666',
    fontFamily: 'Helvetica-Oblique',
    marginLeft: 8,
  },
  // QR code
  qrSection: {
    marginTop: 24,
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  qrLabel: {
    fontSize: 9,
    color: '#666666',
    marginBottom: 8,
    textAlign: 'center',
  },
  qrImage: {
    width: 120,
    height: 120,
  },
  qrCaption: {
    fontSize: 8,
    color: '#999999',
    marginTop: 6,
    textAlign: 'center',
  },
  // Footer
  faitA: {
    fontSize: 10,
    marginTop: 32,
    textAlign: 'right',
  },
  signature: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    marginTop: 4,
    textAlign: 'right',
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
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatModeLabel(mode: string): string {
  switch (mode) {
    case 'PRESENTIEL': return 'présentiel'
    case 'VISIOCONFERENCE': return 'visioconférence'
    case 'MIXTE': return 'mixte (présentiel et visioconférence)'
    case 'HYBRIDE': return 'hybride'
    default: return mode.toLowerCase()
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

// ─── Component ───────────────────────────────────────────────────────────────

interface ConvocationPDFDocumentProps {
  data: ConvocationPDFData
}

export function ConvocationPDFDocument({ data }: ConvocationPDFDocumentProps) {
  const { institution, instance, seance, president, membre, odjPoints, qrCodeUrl, dateFait, lieuFait } = data

  return (
    <Document
      title={`Convocation - ${membre.prenom} ${membre.nom} - ${seance.date}`}
      author={institution.nom}
      subject={`Convocation à la séance du ${seance.date}`}
    >
      <Page size="A4" style={styles.page} wrap>
        {/* Header */}
        <Text style={styles.headerInstitution}>{institution.nom}</Text>
        <Text style={styles.headerInstance}>
          {instance.typeLegal}{instance.nom ? ` — ${instance.nom}` : ''}
        </Text>

        {/* Title */}
        <Text style={styles.title}>CONVOCATION</Text>

        {/* Greeting and intro */}
        <Text style={styles.bodyText}>
          {membre.civilite} {membre.prenom} {membre.nom}
          {membre.qualite ? `, ${membre.qualite}` : ''}
        </Text>

        <Text style={styles.bodyText}>
          Sur convocation de {president.civilite} {president.nom}, vous êtes convoqué(e) à la séance
          du {instance.typeLegal.toLowerCase()} qui se tiendra :
        </Text>

        {/* Séance info */}
        <View style={styles.infoBlock}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Date :</Text>
            <Text style={styles.infoValue}>{seance.date}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Heure :</Text>
            <Text style={styles.infoValue}>{seance.heure}</Text>
          </View>
          {seance.lieu && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Lieu :</Text>
              <Text style={styles.infoValue}>{seance.lieu}</Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Mode :</Text>
            <Text style={styles.infoValue}>En {formatModeLabel(seance.mode)}</Text>
          </View>
        </View>

        {/* ODJ */}
        <Text style={styles.odjTitle}>Ordre du jour</Text>
        {odjPoints.map((point) => (
          <View key={point.position} style={styles.odjItem}>
            <Text style={styles.odjNumber}>{point.position}.</Text>
            <Text style={styles.odjText}>
              {point.titre}
            </Text>
            <Text style={styles.odjType}>
              ({formatTypeLabel(point.type)})
            </Text>
          </View>
        ))}

        {/* QR code for émargement */}
        {qrCodeUrl && (
          <View style={styles.qrSection}>
            <Text style={styles.qrLabel}>
              Présentez ce QR code à votre arrivée pour l&apos;émargement
            </Text>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- React-PDF Image does not support alt attribute */}
            <Image style={styles.qrImage} src={qrCodeUrl} />
            <Text style={styles.qrCaption}>
              Code personnel — ne pas partager
            </Text>
          </View>
        )}

        {/* Fait à */}
        <Text style={styles.faitA}>
          Fait à {lieuFait}, le {dateFait}
        </Text>
        <Text style={styles.signature}>
          {president.civilite} {president.nom}
        </Text>

        {/* Footer */}
        <Text style={styles.footer}>
          {institution.nom}
          {institution.adresse ? ` — ${institution.adresse}` : ''}
        </Text>
      </Page>
    </Document>
  )
}
