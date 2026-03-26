import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer'
import type { PVContenu } from '@/lib/actions/pv'

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    paddingTop: 56, // ~2cm
    paddingBottom: 56,
    paddingHorizontal: 56,
    fontFamily: 'Helvetica',
    fontSize: 10,
    lineHeight: 1.5,
    color: '#1a1a1a',
  },
  // ─── Header ────────────────────────────────────────────────────────────────
  headerInstitution: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  headerInstance: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 8,
    color: '#444444',
  },
  headerRef: {
    fontSize: 9,
    textAlign: 'center',
    marginBottom: 24,
    color: '#666666',
  },
  // ─── Title ─────────────────────────────────────────────────────────────────
  title: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    textTransform: 'uppercase',
    marginBottom: 20,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  // ─── Sections ──────────────────────────────────────────────────────────────
  sectionHeader: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    marginTop: 16,
    marginBottom: 6,
    color: '#1a1a1a',
  },
  sectionSubHeader: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    marginTop: 10,
    marginBottom: 4,
  },
  bodyText: {
    fontSize: 10,
    marginBottom: 4,
    lineHeight: 1.5,
  },
  listItem: {
    fontSize: 10,
    marginBottom: 2,
    paddingLeft: 12,
  },
  italicText: {
    fontSize: 10,
    fontFamily: 'Helvetica-Oblique',
    marginBottom: 4,
    paddingLeft: 16,
    lineHeight: 1.5,
  },
  // ─── Points ODJ ────────────────────────────────────────────────────────────
  pointTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    marginTop: 18,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#999999',
  },
  pointLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    marginTop: 6,
    marginBottom: 2,
  },
  formulePV: {
    fontSize: 10,
    fontFamily: 'Helvetica-Oblique',
    marginTop: 8,
    marginBottom: 4,
    paddingLeft: 16,
    paddingRight: 16,
    lineHeight: 1.6,
    color: '#333333',
  },
  articleText: {
    fontSize: 10,
    marginBottom: 3,
    paddingLeft: 20,
  },
  // ─── Quorum ────────────────────────────────────────────────────────────────
  quorumStatement: {
    fontSize: 10,
    fontFamily: 'Helvetica-Oblique',
    marginTop: 8,
    marginBottom: 12,
    textAlign: 'center',
    color: '#333333',
  },
  // ─── Cloture ───────────────────────────────────────────────────────────────
  clotureText: {
    fontSize: 10,
    marginTop: 20,
    marginBottom: 24,
    textAlign: 'center',
    fontFamily: 'Helvetica-Oblique',
  },
  // ─── Signatures ────────────────────────────────────────────────────────────
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
  // ─── Footer ────────────────────────────────────────────────────────────────
  footer: {
    position: 'absolute',
    bottom: 28,
    left: 56,
    right: 56,
    textAlign: 'center',
    fontSize: 8,
    color: '#999999',
  },
  // ─── Misc ──────────────────────────────────────────────────────────────────
  separator: {
    borderBottomWidth: 0.5,
    borderBottomColor: '#dddddd',
    marginVertical: 12,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  infoLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    width: 100,
  },
  infoValue: {
    fontSize: 10,
    flex: 1,
  },
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatModeLabel(mode: string): string {
  switch (mode) {
    case 'PRESENTIEL': return 'Présentiel'
    case 'VISIOCONFERENCE': return 'Visioconférence'
    case 'MIXTE': return 'Mixte (présentiel + visio)'
    default: return mode
  }
}

function formatPresenceList(
  members: { prenom: string; nom: string; qualite?: string | null }[]
): string {
  if (members.length === 0) return 'Néant'
  return members
    .map(m => {
      const name = `${m.prenom} ${m.nom}`
      return m.qualite ? `${name} (${m.qualite})` : name
    })
    .join(', ')
}

function formatSimpleList(members: { prenom: string; nom: string }[]): string {
  if (members.length === 0) return 'Néant'
  return members.map(m => `${m.prenom} ${m.nom}`).join(', ')
}

// ─── Component ───────────────────────────────────────────────────────────────

interface PVPDFDocumentProps {
  contenu: PVContenu
}

export function PVPDFDocument({ contenu }: PVPDFDocumentProps) {
  const { entete, presences, bureau, points, cloture } = contenu

  return (
    <Document
      title={`Procès-verbal - ${entete.dateSeance}`}
      author={entete.institution}
      subject="Procès-verbal de séance délibérante"
    >
      <Page size="A4" style={styles.page} wrap>
        {/* ═══ Header ═══ */}
        <Text style={styles.headerInstitution}>{entete.institution}</Text>
        {entete.typeInstance && (
          <Text style={styles.headerInstance}>
            {entete.typeInstance}{entete.nomInstance ? ` — ${entete.nomInstance}` : ''}
          </Text>
        )}
        <Text style={styles.headerRef}>
          Séance du {entete.dateSeance}
          {entete.lieu ? ` — ${entete.lieu}` : ''}
          {' — '}{formatModeLabel(entete.mode)}
          {!entete.publique ? ' — Huis clos' : ''}
          {entete.reconvocation ? ' — Reconvocation' : ''}
        </Text>

        {/* ═══ Title ═══ */}
        <Text style={styles.title}>
          PROCÈS-VERBAL DE LA SÉANCE DU {entete.dateSeance.toUpperCase()}
        </Text>

        {/* ═══ Introduction libre ═══ */}
        {contenu.introductionLibre ? (
          <Text style={styles.bodyText}>{contenu.introductionLibre}</Text>
        ) : null}

        {/* ═══ Session info ═══ */}
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Ouverture :</Text>
          <Text style={styles.infoValue}>{entete.heureOuverture || '...'}</Text>
        </View>
        {entete.lieu && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Lieu :</Text>
            <Text style={styles.infoValue}>{entete.lieu}</Text>
          </View>
        )}
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Mode :</Text>
          <Text style={styles.infoValue}>{formatModeLabel(entete.mode)}</Text>
        </View>

        {/* ═══ Presences ═══ */}
        <Text style={styles.sectionHeader}>Étaient présents :</Text>
        <Text style={styles.bodyText}>
          {formatPresenceList(presences.presents)}
        </Text>

        {presences.excuses.length > 0 && (
          <>
            <Text style={styles.sectionSubHeader}>Excusés :</Text>
            <Text style={styles.bodyText}>{formatSimpleList(presences.excuses)}</Text>
          </>
        )}

        {presences.absents.length > 0 && (
          <>
            <Text style={styles.sectionSubHeader}>Absents :</Text>
            <Text style={styles.bodyText}>{formatSimpleList(presences.absents)}</Text>
          </>
        )}

        {presences.procurations.length > 0 && (
          <>
            <Text style={styles.sectionSubHeader}>Procurations :</Text>
            {presences.procurations.map((p, i) => (
              <Text key={i} style={styles.listItem}>
                {'• '}{p.mandant} donne procuration à {p.mandataire}
              </Text>
            ))}
          </>
        )}

        {/* ═══ Quorum ═══ */}
        <Text style={styles.quorumStatement}>{presences.quorumStatement}</Text>

        {/* ═══ Bureau ═══ */}
        <Text style={styles.sectionHeader}>Bureau de la séance</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Président(e) :</Text>
          <Text style={styles.infoValue}>{bureau.president || 'Non désigné(e)'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Secrétaire :</Text>
          <Text style={styles.infoValue}>{bureau.secretaire || 'Non désigné(e)'}</Text>
        </View>
        {bureau.mentionRemplacement && (
          <Text style={{ fontSize: 9, fontStyle: 'italic', marginTop: 4 }}>
            {bureau.mentionRemplacement}
          </Text>
        )}

        <View style={styles.separator} />

        {/* ═══ Points ODJ ═══ */}
        {points.map((point, idx) => (
          <View key={idx} wrap={false}>
            <Text style={styles.pointTitle}>
              POINT N° {point.position} : {point.titre}
            </Text>

            {point.rapporteur && (
              <Text style={styles.bodyText}>Rapporteur : {point.rapporteur}</Text>
            )}

            {point.type !== 'DELIBERATION' && (
              <Text style={[styles.bodyText, { fontFamily: 'Helvetica-Oblique', color: '#666666' }]}>
                Type : {point.type === 'INFORMATION' ? 'Information' : point.type === 'ELECTION' ? 'Élection' : point.type === 'APPROBATION_PV' ? 'Approbation de PV' : point.type}
              </Text>
            )}

            {point.vu ? (
              <>
                <Text style={styles.pointLabel}>Vu :</Text>
                <Text style={styles.bodyText}>{point.vu}</Text>
              </>
            ) : null}

            {point.considerant ? (
              <>
                <Text style={styles.pointLabel}>Considérant :</Text>
                <Text style={styles.bodyText}>{point.considerant}</Text>
              </>
            ) : null}

            {point.description ? (
              <>
                <Text style={styles.pointLabel}>Exposé :</Text>
                <Text style={styles.bodyText}>{point.description}</Text>
              </>
            ) : null}

            {point.projetDeliberation ? (
              <>
                <Text style={styles.pointLabel}>Projet de délibération :</Text>
                <Text style={styles.bodyText}>{point.projetDeliberation}</Text>
              </>
            ) : null}

            {point.discussion ? (
              <>
                <Text style={styles.pointLabel}>Discussion :</Text>
                <Text style={styles.bodyText}>{point.discussion}</Text>
              </>
            ) : null}

            {/* Vote result */}
            {point.vote?.formulePV && (
              <Text style={styles.formulePV}>{point.vote.formulePV}</Text>
            )}

            {/* Articles */}
            {point.articles.length > 0 && (
              <>
                <Text style={styles.pointLabel}>Décide :</Text>
                {point.articles.map((article, aIdx) => (
                  <Text key={aIdx} style={styles.articleText}>
                    Article {aIdx + 1} : {article}
                  </Text>
                ))}
              </>
            )}
          </View>
        ))}

        {/* ═══ Conclusion libre ═══ */}
        {contenu.conclusionLibre ? (
          <>
            <View style={styles.separator} />
            <Text style={styles.sectionHeader}>Questions diverses</Text>
            <Text style={styles.bodyText}>{contenu.conclusionLibre}</Text>
          </>
        ) : null}

        {/* ═══ Cloture ═══ */}
        <Text style={styles.clotureText}>{cloture.texte}</Text>

        {/* ═══ Signatures ═══ */}
        <View style={styles.signatureBlock}>
          <View style={styles.signatureColumn}>
            <Text style={styles.signatureRole}>Le/La Président(e)</Text>
            <Text style={styles.signatureName}>{bureau.president || '...'}</Text>
            <Text style={styles.signatureLabel}>Signature</Text>
          </View>
          <View style={styles.signatureColumn}>
            <Text style={styles.signatureRole}>Le/La Secrétaire</Text>
            <Text style={styles.signatureName}>{bureau.secretaire || '...'}</Text>
            <Text style={styles.signatureLabel}>Signature</Text>
          </View>
        </View>

        {/* ═══ Footer (page number) ═══ */}
        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `${entete.institution} — PV du ${entete.dateSeance} — Page ${pageNumber} / ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  )
}
