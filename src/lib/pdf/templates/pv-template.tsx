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
    case 'PRESENTIEL': return 'Pr\u00e9sentiel'
    case 'VISIOCONFERENCE': return 'Visioconf\u00e9rence'
    case 'MIXTE': return 'Mixte (pr\u00e9sentiel + visio)'
    default: return mode
  }
}

function formatPresenceList(
  members: { prenom: string; nom: string; qualite?: string | null }[]
): string {
  if (members.length === 0) return 'N\u00e9ant'
  return members
    .map(m => {
      const name = `${m.prenom} ${m.nom}`
      return m.qualite ? `${name} (${m.qualite})` : name
    })
    .join(', ')
}

function formatSimpleList(members: { prenom: string; nom: string }[]): string {
  if (members.length === 0) return 'N\u00e9ant'
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
      title={`Proc\u00e8s-verbal - ${entete.dateSeance}`}
      author={entete.institution}
      subject="Proc\u00e8s-verbal de s\u00e9ance d\u00e9lib\u00e9rante"
    >
      <Page size="A4" style={styles.page} wrap>
        {/* ═══ Header ═══ */}
        <Text style={styles.headerInstitution}>{entete.institution}</Text>
        {entete.typeInstance && (
          <Text style={styles.headerInstance}>
            {entete.typeInstance}{entete.nomInstance ? ` \u2014 ${entete.nomInstance}` : ''}
          </Text>
        )}
        <Text style={styles.headerRef}>
          S\u00e9ance du {entete.dateSeance}
          {entete.lieu ? ` \u2014 ${entete.lieu}` : ''}
          {' \u2014 '}{formatModeLabel(entete.mode)}
          {!entete.publique ? ' \u2014 Huis clos' : ''}
          {entete.reconvocation ? ' \u2014 Reconvocation' : ''}
        </Text>

        {/* ═══ Title ═══ */}
        <Text style={styles.title}>
          PROC\u00c8S-VERBAL DE LA S\u00c9ANCE DU {entete.dateSeance.toUpperCase()}
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
        <Text style={styles.sectionHeader}>\u00c9taient pr\u00e9sents :</Text>
        <Text style={styles.bodyText}>
          {formatPresenceList(presences.presents)}
        </Text>

        {presences.excuses.length > 0 && (
          <>
            <Text style={styles.sectionSubHeader}>Excus\u00e9s :</Text>
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
                {'\u2022 '}{p.mandant} donne procuration \u00e0 {p.mandataire}
              </Text>
            ))}
          </>
        )}

        {/* ═══ Quorum ═══ */}
        <Text style={styles.quorumStatement}>{presences.quorumStatement}</Text>

        {/* ═══ Bureau ═══ */}
        <Text style={styles.sectionHeader}>Bureau de la s\u00e9ance</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Pr\u00e9sident(e) :</Text>
          <Text style={styles.infoValue}>{bureau.president || 'Non d\u00e9sign\u00e9(e)'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Secr\u00e9taire :</Text>
          <Text style={styles.infoValue}>{bureau.secretaire || 'Non d\u00e9sign\u00e9(e)'}</Text>
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
              POINT N\u00b0 {point.position} : {point.titre}
            </Text>

            {point.rapporteur && (
              <Text style={styles.bodyText}>Rapporteur : {point.rapporteur}</Text>
            )}

            {point.type !== 'DELIBERATION' && (
              <Text style={[styles.bodyText, { fontFamily: 'Helvetica-Oblique', color: '#666666' }]}>
                Type : {point.type === 'INFORMATION' ? 'Information' : point.type === 'ELECTION' ? '\u00c9lection' : point.type === 'APPROBATION_PV' ? 'Approbation de PV' : point.type}
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
                <Text style={styles.pointLabel}>Consid\u00e9rant :</Text>
                <Text style={styles.bodyText}>{point.considerant}</Text>
              </>
            ) : null}

            {point.description ? (
              <>
                <Text style={styles.pointLabel}>Expos\u00e9 :</Text>
                <Text style={styles.bodyText}>{point.description}</Text>
              </>
            ) : null}

            {point.projetDeliberation ? (
              <>
                <Text style={styles.pointLabel}>Projet de d\u00e9lib\u00e9ration :</Text>
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
                <Text style={styles.pointLabel}>D\u00e9cide :</Text>
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
            <Text style={styles.signatureRole}>Le/La Pr\u00e9sident(e)</Text>
            <Text style={styles.signatureName}>{bureau.president || '...'}</Text>
            <Text style={styles.signatureLabel}>Signature</Text>
          </View>
          <View style={styles.signatureColumn}>
            <Text style={styles.signatureRole}>Le/La Secr\u00e9taire</Text>
            <Text style={styles.signatureName}>{bureau.secretaire || '...'}</Text>
            <Text style={styles.signatureLabel}>Signature</Text>
          </View>
        </View>

        {/* ═══ Footer (page number) ═══ */}
        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `${entete.institution} \u2014 PV du ${entete.dateSeance} \u2014 Page ${pageNumber} / ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  )
}
