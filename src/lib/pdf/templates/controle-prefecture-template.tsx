import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type {
  ControlePrefectureData,
  SeanceControle,
  PointODJControle,
  VoteControle,
  DeliberationControle,
} from '@/lib/actions/controle-prefecture'

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    paddingTop: 56,
    paddingBottom: 56,
    paddingHorizontal: 56,
    fontFamily: 'Helvetica',
    fontSize: 9,
    lineHeight: 1.4,
    color: '#1a1a1a',
  },
  // Cover
  coverPage: {
    paddingTop: 120,
    paddingBottom: 56,
    paddingHorizontal: 56,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#1a1a1a',
  },
  coverInstitution: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  coverType: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 60,
    color: '#555',
  },
  coverTitle: {
    fontSize: 26,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    textTransform: 'uppercase',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 3,
    borderBottomColor: '#1a1a1a',
  },
  coverSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
    color: '#444',
  },
  coverPeriod: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginTop: 32,
    marginBottom: 60,
  },
  coverInfoBlock: {
    marginTop: 40,
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 4,
  },
  coverInfoRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  coverInfoLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    width: 130,
  },
  coverInfoValue: {
    fontSize: 10,
    flex: 1,
  },
  // Section / page
  pageTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    marginBottom: 16,
    paddingBottom: 6,
    borderBottomWidth: 2,
    borderBottomColor: '#1a1a1a',
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    marginTop: 14,
    marginBottom: 6,
    color: '#1e3a5f',
  },
  sectionSubtitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    marginTop: 8,
    marginBottom: 4,
  },
  // Tables
  table: {
    marginVertical: 4,
    borderWidth: 0.5,
    borderColor: '#cbd5e1',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 0.5,
    borderBottomColor: '#cbd5e1',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
  },
  th: {
    padding: 4,
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#475569',
    borderRightWidth: 0.5,
    borderRightColor: '#cbd5e1',
  },
  td: {
    padding: 4,
    fontSize: 8,
    borderRightWidth: 0.5,
    borderRightColor: '#e2e8f0',
  },
  // Common
  bodyText: {
    fontSize: 9,
    marginBottom: 4,
  },
  small: {
    fontSize: 8,
    color: '#64748b',
  },
  bold: {
    fontFamily: 'Helvetica-Bold',
  },
  italic: {
    fontFamily: 'Helvetica-Oblique',
    color: '#64748b',
  },
  pill: {
    fontSize: 8,
    paddingVertical: 1,
    paddingHorizontal: 4,
    borderRadius: 2,
    backgroundColor: '#e2e8f0',
  },
  ok: { color: '#15803d' },
  ko: { color: '#b91c1c' },
  warn: { color: '#a16207' },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 56,
    right: 56,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: '#94a3b8',
    paddingTop: 6,
    borderTopWidth: 0.5,
    borderTopColor: '#e2e8f0',
  },
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return `${d.toLocaleDateString('fr-FR')} ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
  } catch {
    return iso
  }
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('fr-FR')
  } catch {
    return iso
  }
}

const TYPE_LABELS: Record<string, string> = {
  DELIBERATION: 'Délibération',
  INFORMATION: 'Information',
  QUESTION_DIVERSE: 'Question diverse',
  ELECTION: 'Élection',
  APPROBATION_PV: 'Approbation PV',
}

const VOTE_TYPE_LABELS: Record<string, string> = {
  MAIN_LEVEE: 'Vote à main levée',
  SECRET: 'Vote à scrutin secret',
  NOMINAL: 'Vote nominal',
  TELEVOTE: 'Télévote',
}

const INSTITUTION_TYPE_LABELS: Record<string, string> = {
  commune: 'Commune',
  syndicat: 'Syndicat intercommunal',
  cc: 'Communauté de communes',
  departement: 'Conseil départemental',
  asso: 'Association loi 1901',
}

// ─── Footer commun à toutes les pages ────────────────────────────────────────

function PageFooter({ data, pageLabel }: { data: ControlePrefectureData; pageLabel: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text>
        Dossier de contrôle réglementaire {data.meta.year} — {data.meta.institutionNom}
      </Text>
      <Text>{pageLabel}</Text>
    </View>
  )
}

// ─── Page de couverture ──────────────────────────────────────────────────────

function CoverPage({ data }: { data: ControlePrefectureData }) {
  const { meta } = data
  return (
    <Page size="A4" style={styles.coverPage}>
      <Text style={styles.coverInstitution}>{meta.institutionNom}</Text>
      <Text style={styles.coverType}>
        {INSTITUTION_TYPE_LABELS[meta.institutionType] || meta.institutionType}
      </Text>

      <Text style={styles.coverTitle}>Dossier de contrôle</Text>
      <Text style={styles.coverSubtitle}>de légalité préfectoral</Text>

      <Text style={styles.coverPeriod}>
        Période : du 1ᵉʳ janvier au 31 décembre {meta.year}
      </Text>

      <View style={styles.coverInfoBlock}>
        <View style={styles.coverInfoRow}>
          <Text style={styles.coverInfoLabel}>SIREN :</Text>
          <Text style={styles.coverInfoValue}>{meta.institutionSiren || '—'}</Text>
        </View>
        <View style={styles.coverInfoRow}>
          <Text style={styles.coverInfoLabel}>SIRET :</Text>
          <Text style={styles.coverInfoValue}>{meta.institutionSiret || '—'}</Text>
        </View>
        <View style={styles.coverInfoRow}>
          <Text style={styles.coverInfoLabel}>Adresse :</Text>
          <Text style={styles.coverInfoValue}>{meta.institutionAdresse || '—'}</Text>
        </View>
        <View style={styles.coverInfoRow}>
          <Text style={styles.coverInfoLabel}>Population :</Text>
          <Text style={styles.coverInfoValue}>
            {meta.populationHabitants != null ? `${meta.populationHabitants.toLocaleString('fr-FR')} habitants` : '—'}
          </Text>
        </View>
        <View style={[styles.coverInfoRow, { marginTop: 12 }]}>
          <Text style={styles.coverInfoLabel}>Généré le :</Text>
          <Text style={styles.coverInfoValue}>{fmtDateTime(meta.generatedAt)}</Text>
        </View>
        <View style={styles.coverInfoRow}>
          <Text style={styles.coverInfoLabel}>Généré par :</Text>
          <Text style={styles.coverInfoValue}>{meta.generatedBy}</Text>
        </View>
        <View style={[styles.coverInfoRow, { marginTop: 12 }]}>
          <Text style={styles.coverInfoLabel}>Hash SHA-256 :</Text>
          <Text style={[styles.coverInfoValue, { fontFamily: 'Courier', fontSize: 8 }]}>
            {data.hashIntegrite}
          </Text>
        </View>
      </View>

      <Text
        style={[styles.italic, { textAlign: 'center', marginTop: 60, fontSize: 9 }]}
      >
        Ce dossier a été généré automatiquement à partir des registres
        électroniques de l&apos;institution. Le hash SHA-256 ci-dessus permet de
        vérifier l&apos;intégrité du document.
      </Text>
    </Page>
  )
}

// ─── Synthèse annuelle ───────────────────────────────────────────────────────

function SynthesePage({ data }: { data: ControlePrefectureData }) {
  const s = data.synthese
  return (
    <Page size="A4" style={styles.page} wrap>
      <Text style={styles.pageTitle}>Synthèse de l&apos;année {data.meta.year}</Text>

      <Text style={styles.sectionTitle}>Séances</Text>
      <View style={styles.coverInfoRow}>
        <Text style={styles.coverInfoLabel}>Total :</Text>
        <Text style={styles.coverInfoValue}>{s.nbSeancesTotal}</Text>
      </View>
      {Object.entries(s.nbSeancesParStatut).map(([statut, n]) => (
        <View key={statut} style={styles.coverInfoRow}>
          <Text style={styles.coverInfoLabel}>{statut} :</Text>
          <Text style={styles.coverInfoValue}>{n}</Text>
        </View>
      ))}

      <Text style={styles.sectionTitle}>Délibérations</Text>
      <View style={styles.coverInfoRow}>
        <Text style={styles.coverInfoLabel}>Total publiées :</Text>
        <Text style={styles.coverInfoValue}>{s.nbDeliberationsPubliees}</Text>
      </View>
      {Object.entries(s.nbDeliberationsParInstance).map(([nom, n]) => (
        <View key={nom} style={styles.coverInfoRow}>
          <Text style={styles.coverInfoLabel}>{nom} :</Text>
          <Text style={styles.coverInfoValue}>{n}</Text>
        </View>
      ))}

      <Text style={styles.sectionTitle}>Votes par type</Text>
      {Object.entries(s.nbVotesParType).length === 0 ? (
        <Text style={styles.italic}>Aucun vote enregistré sur la période.</Text>
      ) : (
        Object.entries(s.nbVotesParType).map(([type, n]) => (
          <View key={type} style={styles.coverInfoRow}>
            <Text style={styles.coverInfoLabel}>{VOTE_TYPE_LABELS[type] || type} :</Text>
            <Text style={styles.coverInfoValue}>{n}</Text>
          </View>
        ))
      )}

      <Text style={styles.sectionTitle}>Présidents effectifs sur l&apos;année</Text>
      {s.presidentsEffectifs.length === 0 ? (
        <Text style={styles.italic}>Aucun.</Text>
      ) : (
        s.presidentsEffectifs.map((p) => (
          <Text key={p.nom} style={styles.bodyText}>
            • {p.nom} — {p.nbSeances} séance{p.nbSeances > 1 ? 's' : ''}
          </Text>
        ))
      )}

      <PageFooter data={data} pageLabel="Synthèse annuelle" />
    </Page>
  )
}

// ─── Page détaillée par séance ───────────────────────────────────────────────

function SeancePage({ data, seance }: { data: ControlePrefectureData; seance: SeanceControle }) {
  return (
    <Page size="A4" style={styles.page} wrap>
      <Text style={styles.pageTitle}>{seance.titre}</Text>
      <Text style={styles.bodyText}>
        <Text style={styles.bold}>Date :</Text> {seance.dateFormatee}
        {seance.lieu ? `   Lieu : ${seance.lieu}` : ''}
        {`   Mode : ${seance.mode.toLowerCase()}`}
      </Text>
      <Text style={styles.bodyText}>
        <Text style={styles.bold}>Instance :</Text> {seance.instance.nom} ({seance.instance.type_legal})
        {`   Statut : ${seance.statut}`}
        {seance.publique ? '   Publique : oui' : '   Publique : non (huis clos)'}
        {seance.reconvocation ? '   Reconvocation (CGCT L2121-17) : oui' : ''}
      </Text>

      {/* ─── Convocation ─── */}
      <Text style={styles.sectionTitle}>1. Convocation</Text>
      <Text style={styles.bodyText}>
        <Text style={styles.bold}>Convoquée par :</Text>{' '}
        {seance.convocation.presidentConvoquant || '—'} (CGCT L2121-10)
      </Text>
      <Text style={styles.bodyText}>
        <Text style={styles.bold}>Première convocation envoyée :</Text>{' '}
        {fmtDateTime(seance.convocation.envoyeeAt)}
      </Text>
      <Text style={styles.bodyText}>
        <Text style={styles.bold}>Délai effectif :</Text> {seance.convocation.delaiJours} jour
        {seance.convocation.delaiJours > 1 ? 's' : ''} avant la séance
        <Text style={seance.convocation.delaiOK ? styles.ok : styles.ko}>
          {' '}
          {seance.convocation.delaiOK
            ? `✓ conforme (≥ ${seance.convocation.delaiLegalJours}j)`
            : `✗ inférieur au délai légal de ${seance.convocation.delaiLegalJours}j`}
        </Text>
      </Text>
      <Text style={styles.bodyText}>
        <Text style={styles.bold}>Membres en exercice :</Text>{' '}
        {seance.convocation.membresEnExercice} —{' '}
        <Text style={styles.bold}>convoqués :</Text> {seance.convocation.convocataires.length}
        <Text style={seance.convocation.convocationComplete ? styles.ok : styles.ko}>
          {' '}
          {seance.convocation.convocationComplete
            ? '✓ Convocation complète'
            : '✗ Convocation incomplète'}
        </Text>
      </Text>

      <Text style={styles.sectionSubtitle}>Convocataires</Text>
      <View style={styles.table}>
        <View style={styles.tableHeader} fixed>
          <Text style={[styles.th, { width: '32%' }]}>Nom</Text>
          <Text style={[styles.th, { width: '28%' }]}>Email</Text>
          <Text style={[styles.th, { width: '15%' }]}>Envoyée</Text>
          <Text style={[styles.th, { width: '15%' }]}>Statut</Text>
          <Text style={[styles.th, { width: '10%', borderRightWidth: 0 }]}>Confirmée</Text>
        </View>
        {seance.convocation.convocataires.map((c, i) => (
          <View key={i} style={styles.tableRow} wrap={false}>
            <Text style={[styles.td, { width: '32%' }]}>{c.nom}</Text>
            <Text style={[styles.td, { width: '28%', fontSize: 7 }]}>{c.email || '—'}</Text>
            <Text style={[styles.td, { width: '15%' }]}>{fmtDate(c.envoyeAt)}</Text>
            <Text style={[styles.td, { width: '15%' }]}>{c.statutConvocation || '—'}</Text>
            <Text style={[styles.td, { width: '10%', borderRightWidth: 0 }]}>{fmtDate(c.confirmeAt)}</Text>
          </View>
        ))}
      </View>

      {/* ─── Tenue de séance ─── */}
      <Text style={styles.sectionTitle}>2. Tenue de la séance</Text>
      <Text style={styles.bodyText}>
        <Text style={styles.bold}>Ouverture :</Text> {fmtDateTime(seance.tenue.heureOuverture)}
        {`   Clôture : ${fmtDateTime(seance.tenue.heureCloture)}`}
        {seance.tenue.dureeMinutes != null
          ? `   Durée : ${Math.floor(seance.tenue.dureeMinutes / 60)}h${String(seance.tenue.dureeMinutes % 60).padStart(2, '0')}`
          : ''}
      </Text>
      <Text style={styles.bodyText}>
        <Text style={styles.bold}>Président effectif :</Text> {seance.tenue.presidentEffectif || '—'}
      </Text>
      <Text style={styles.bodyText}>
        <Text style={styles.bold}>Secrétaire de séance :</Text> {seance.tenue.secretaireSeance || '—'}
      </Text>

      {/* ─── Quorum ─── */}
      <Text style={styles.sectionTitle}>3. Quorum (vérifié à l&apos;ouverture)</Text>
      <Text style={styles.bodyText}>
        <Text style={styles.bold}>Type :</Text> {seance.quorum.typeRequis}
        {seance.quorum.seuilCalcule != null
          ? `   Seuil requis : ${seance.quorum.seuilCalcule} membres`
          : ''}
        {`   Présents : ${seance.quorum.nombrePresents}`}
        <Text style={seance.quorum.atteint ? styles.ok : styles.ko}>
          {' '}
          {seance.quorum.atteint ? '✓ atteint' : '✗ non atteint'}
        </Text>
      </Text>
      <Text style={styles.small}>
        Vérification horodatée : {fmtDateTime(seance.quorum.horodatageVerification)}
      </Text>

      {/* ─── Présences ─── */}
      <Text style={styles.sectionTitle}>4. Présences détaillées</Text>
      <View style={styles.table}>
        <View style={styles.tableHeader} fixed>
          <Text style={[styles.th, { width: '32%' }]}>Membre</Text>
          <Text style={[styles.th, { width: '14%' }]}>Statut</Text>
          <Text style={[styles.th, { width: '14%' }]}>Méthode</Text>
          <Text style={[styles.th, { width: '20%' }]}>Horodatage</Text>
          <Text style={[styles.th, { width: '20%', borderRightWidth: 0 }]}>Marqué par</Text>
        </View>
        {seance.presences.length === 0 ? (
          <View style={styles.tableRow}>
            <Text style={[styles.td, styles.italic, { flex: 1 }]}>Aucun émargement enregistré.</Text>
          </View>
        ) : (
          seance.presences.map((p, i) => (
            <View key={i} style={styles.tableRow} wrap={false}>
              <Text style={[styles.td, { width: '32%' }]}>
                {p.membreNom}
                {p.qualite ? ` (${p.qualite})` : ''}
              </Text>
              <Text style={[styles.td, { width: '14%' }]}>{p.statut}</Text>
              <Text style={[styles.td, { width: '14%' }]}>
                {p.methode || '—'}
                {p.motifAssiste ? '\n(mode dégradé)' : ''}
              </Text>
              <Text style={[styles.td, { width: '20%' }]}>{fmtDateTime(p.horodatage)}</Text>
              <Text style={[styles.td, { width: '20%', borderRightWidth: 0 }]}>
                {p.marquePar || '—'}
                {p.motifAssiste ? `\nMotif : ${p.motifAssiste}` : ''}
              </Text>
            </View>
          ))
        )}
      </View>

      {/* ─── Procurations ─── */}
      {seance.procurations.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>5. Procurations (CGCT L2121-20)</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader} fixed>
              <Text style={[styles.th, { width: '36%' }]}>Mandant</Text>
              <Text style={[styles.th, { width: '36%' }]}>Mandataire</Text>
              <Text style={[styles.th, { width: '14%' }]}>Canal</Text>
              <Text style={[styles.th, { width: '14%', borderRightWidth: 0 }]}>Document</Text>
            </View>
            {seance.procurations.map((p, i) => (
              <View key={i} style={styles.tableRow} wrap={false}>
                <Text style={[styles.td, { width: '36%' }]}>{p.mandantNom}</Text>
                <Text style={[styles.td, { width: '36%' }]}>{p.mandataireNom}</Text>
                <Text style={[styles.td, { width: '14%' }]}>{p.canal || '—'}</Text>
                <Text style={[styles.td, { width: '14%', borderRightWidth: 0 }]}>
                  {p.documentFourni ? 'Fourni' : 'Aucun'}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* ─── Récusations ─── */}
      {seance.recusations.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>6. Récusations (CGCT L2131-11)</Text>
          {seance.recusations.map((r, i) => (
            <Text key={i} style={styles.bodyText}>
              • <Text style={styles.bold}>{r.membreNom}</Text> récusé sur «{' '}
              {r.pointConcerne} » — déclaré par {r.declarePar}
              {r.motif ? ` — motif : ${r.motif}` : ''}
            </Text>
          ))}
        </>
      )}

      {/* ─── Points ODJ ─── */}
      <Text style={styles.sectionTitle}>7. Ordre du jour et délibérations</Text>
      {seance.points.map((point) => (
        <PointBlock key={point.position} point={point} />
      ))}

      {/* ─── PV ─── */}
      <Text style={styles.sectionTitle}>8. Procès-verbal</Text>
      {seance.pv ? (
        <>
          <Text style={styles.bodyText}>
            <Text style={styles.bold}>Statut :</Text> {seance.pv.statut || '—'}
            {`   Version : ${seance.pv.version ?? 1}`}
          </Text>
          <Text style={styles.bodyText}>
            <Text style={styles.bold}>Signature président :</Text>{' '}
            {seance.pv.signaturePresident
              ? `${seance.pv.signaturePresident.nom} le ${fmtDateTime(seance.pv.signaturePresident.timestamp)}`
              : '— non signé'}
          </Text>
          {seance.pv.signaturePresident?.hashSha256 && (
            <Text style={[styles.small, { fontFamily: 'Courier' }]}>
              Hash : {seance.pv.signaturePresident.hashSha256}
            </Text>
          )}
          <Text style={styles.bodyText}>
            <Text style={styles.bold}>Signature secrétaire :</Text>{' '}
            {seance.pv.signatureSecretaire
              ? `${seance.pv.signatureSecretaire.nom} le ${fmtDateTime(seance.pv.signatureSecretaire.timestamp)}`
              : '— non signé'}
          </Text>
          {seance.pv.signatureSecretaire?.hashSha256 && (
            <Text style={[styles.small, { fontFamily: 'Courier' }]}>
              Hash : {seance.pv.signatureSecretaire.hashSha256}
            </Text>
          )}
        </>
      ) : (
        <Text style={styles.italic}>Aucun procès-verbal enregistré pour cette séance.</Text>
      )}

      <PageFooter data={data} pageLabel={`Séance — ${seance.dateFormatee}`} />
    </Page>
  )
}

// ─── Bloc d'un point ODJ ─────────────────────────────────────────────────────

function PointBlock({ point }: { point: PointODJControle }) {
  return (
    <View style={{ marginBottom: 10, paddingBottom: 8, borderBottomWidth: 0.5, borderBottomColor: '#cbd5e1' }} wrap={false}>
      <Text style={[styles.bold, { fontSize: 10, marginBottom: 2 }]}>
        {point.position}. {point.titre}
      </Text>
      <Text style={styles.small}>
        Type : {TYPE_LABELS[point.type] || point.type}
        {point.rapporteur ? `   Rapporteur : ${point.rapporteur}` : ''}
        {point.huisClos ? '   Huis clos : oui' : ''}
      </Text>
      {point.huisClosActiveAt && (
        <Text style={styles.small}>
          Huis clos activé : {fmtDateTime(point.huisClosActiveAt)}
          {point.huisClosLeveAt ? `   Levé : ${fmtDateTime(point.huisClosLeveAt)}` : ''}
        </Text>
      )}
      {point.description && (
        <Text style={[styles.bodyText, { marginTop: 3 }]}>{point.description}</Text>
      )}
      {point.noteSynthese && (
        <View style={{ marginTop: 4, padding: 6, backgroundColor: '#f0f9ff', borderLeftWidth: 2, borderLeftColor: '#0284c7' }}>
          <Text style={[styles.bold, { fontSize: 8, marginBottom: 2 }]}>
            Note de synthèse (CGCT L2121-12)
          </Text>
          <Text style={{ fontSize: 8 }}>{point.noteSynthese}</Text>
        </View>
      )}
      {point.projetDeliberation && (
        <View style={{ marginTop: 4, padding: 6, backgroundColor: '#f8fafc', borderLeftWidth: 2, borderLeftColor: '#64748b' }}>
          <Text style={[styles.bold, { fontSize: 8, marginBottom: 2 }]}>Projet de délibération</Text>
          <Text style={{ fontSize: 8 }}>{point.projetDeliberation}</Text>
        </View>
      )}
      {point.documents.length > 0 && (
        <View style={{ marginTop: 3 }}>
          <Text style={[styles.small, styles.bold]}>Documents joints ({point.documents.length}) :</Text>
          {point.documents.map((d, i) => (
            <Text key={i} style={styles.small}>
              • {d.nom}
              {d.taille ? ` (${Math.round(d.taille / 1024)} Ko)` : ''}
              {d.uploadeAt ? `, joint le ${fmtDate(d.uploadeAt)}` : ''}
            </Text>
          ))}
        </View>
      )}
      {point.vote && <VoteBlock vote={point.vote} />}
      {point.deliberation && <DeliberationBlock delib={point.deliberation} />}
    </View>
  )
}

function VoteBlock({ vote }: { vote: VoteControle }) {
  return (
    <View style={{ marginTop: 6, padding: 6, backgroundColor: '#fefce8', borderLeftWidth: 2, borderLeftColor: '#ca8a04' }}>
      <Text style={[styles.bold, { fontSize: 9, marginBottom: 2 }]}>
        Vote : {VOTE_TYPE_LABELS[vote.type] || vote.type}
      </Text>
      <Text style={styles.small}>
        Ouvert : {fmtDateTime(vote.ouvertAt)}{vote.ouvertPar ? ` par ${vote.ouvertPar}` : ''}
        {`   Clos : ${fmtDateTime(vote.closAt)}`}
        {vote.closPar ? ` par ${vote.closPar}` : ''}
      </Text>
      {vote.quorumOuvert != null && (
        <Text style={styles.small}>Quorum à l&apos;ouverture : {vote.quorumOuvert} présents</Text>
      )}
      <Text style={[styles.bodyText, { fontSize: 9 }]}>
        <Text style={styles.bold}>Résultat :</Text> {vote.resultat}
        {vote.pour != null
          ? `   Pour : ${vote.pour}   Contre : ${vote.contre}   Abstention : ${vote.abstention}`
          : ''}
        {vote.votants != null ? `   Votants : ${vote.votants}` : ''}
      </Text>
      {vote.formulePV && (
        <Text style={[styles.small, styles.italic]}>« {vote.formulePV} »</Text>
      )}
      {/* Vote nominal — liste des choix par membre */}
      {vote.type === 'NOMINAL' && (vote.nomsPour || vote.nomsContre || vote.nomsAbstention) && (
        <View style={{ marginTop: 3 }}>
          {vote.nomsPour && vote.nomsPour.length > 0 && (
            <Text style={styles.small}>
              <Text style={styles.bold}>Pour :</Text> {vote.nomsPour.join(', ')}
            </Text>
          )}
          {vote.nomsContre && vote.nomsContre.length > 0 && (
            <Text style={styles.small}>
              <Text style={styles.bold}>Contre :</Text> {vote.nomsContre.join(', ')}
            </Text>
          )}
          {vote.nomsAbstention && vote.nomsAbstention.length > 0 && (
            <Text style={styles.small}>
              <Text style={styles.bold}>Abstention :</Text> {vote.nomsAbstention.join(', ')}
            </Text>
          )}
        </View>
      )}
      {/* Vote secret — participation seulement (anonymat préservé) */}
      {vote.type === 'SECRET' && vote.participation.length > 0 && (
        <View style={{ marginTop: 3 }}>
          <Text style={styles.small}>
            <Text style={styles.bold}>Participation au scrutin secret</Text> (les bulletins
            individuels restent anonymes — CGCT L2121-21) :{' '}
            {vote.participation.filter((p) => p.aVote).length} bulletins exprimés sur{' '}
            {vote.participation.length} membres.
          </Text>
        </View>
      )}
      {vote.hashIntegrite && (
        <Text style={[styles.small, { fontFamily: 'Courier', marginTop: 2 }]}>
          Hash intégrité : {vote.hashIntegrite}
        </Text>
      )}
    </View>
  )
}

function DeliberationBlock({ delib }: { delib: DeliberationControle }) {
  return (
    <View style={{ marginTop: 6, padding: 6, backgroundColor: '#f0fdf4', borderLeftWidth: 2, borderLeftColor: '#16a34a' }}>
      <Text style={[styles.bold, { fontSize: 9, marginBottom: 2 }]}>
        Délibération {delib.numero || '(numéro non attribué)'}
        {delib.annulee ? ' — ANNULÉE' : ''}
      </Text>
      <Text style={styles.small}>
        Publiée : {fmtDate(delib.publieAt)}
        {`   Affichée : ${fmtDate(delib.afficheAt)}`}
        {`   Transmise préfecture : ${fmtDate(delib.transmisPrefAt)}`}
      </Text>
      {delib.executoireAt && (
        <Text style={[styles.small, { fontFamily: 'Helvetica-Bold' }]}>
          Caractère exécutoire à compter du : {fmtDate(delib.executoireAt)}
        </Text>
      )}
      {delib.articles.length > 0 && (
        <View style={{ marginTop: 3 }}>
          {delib.articles.map((a, i) => (
            <Text key={i} style={[styles.small, { marginBottom: 1 }]}>
              {a}
            </Text>
          ))}
        </View>
      )}
    </View>
  )
}

// ─── Document principal ──────────────────────────────────────────────────────

interface ControlePrefecturePDFProps {
  data: ControlePrefectureData
}

export function ControlePrefecturePDF({ data }: ControlePrefecturePDFProps) {
  return (
    <Document
      title={`Dossier de contrôle préfecture ${data.meta.year} — ${data.meta.institutionNom}`}
      author={data.meta.generatedBy}
      subject={`Contrôle de légalité ${data.meta.year}`}
    >
      <CoverPage data={data} />
      <SynthesePage data={data} />

      {data.seances.map((seance) => (
        <SeancePage key={seance.id} data={data} seance={seance} />
      ))}

      <AnnexesPages data={data} />
    </Document>
  )
}

// ─── Annexes (composition, conformité, audit, statistiques, certificat) ─────

function AnnexesPages({ data }: { data: ControlePrefectureData }) {
  return (
    <>
      {/* Page : Composition du conseil */}
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.pageTitle}>Annexe A — Composition du conseil</Text>
        <Text style={styles.sectionTitle}>Membres actifs au 31 décembre {data.meta.year}</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader} fixed>
            <Text style={[styles.th, { width: '28%' }]}>Nom</Text>
            <Text style={[styles.th, { width: '24%' }]}>Email</Text>
            <Text style={[styles.th, { width: '20%' }]}>Qualité</Text>
            <Text style={[styles.th, { width: '14%' }]}>Rôle</Text>
            <Text style={[styles.th, { width: '14%', borderRightWidth: 0 }]}>Invité le</Text>
          </View>
          {data.membresActifsFin.map((m) => (
            <View key={m.id} style={styles.tableRow} wrap={false}>
              <Text style={[styles.td, { width: '28%' }]}>{m.prenom} {m.nom}</Text>
              <Text style={[styles.td, { width: '24%', fontSize: 7 }]}>{m.email || '—'}</Text>
              <Text style={[styles.td, { width: '20%' }]}>{m.qualite || '—'}</Text>
              <Text style={[styles.td, { width: '14%' }]}>{m.role || '—'}</Text>
              <Text style={[styles.td, { width: '14%', borderRightWidth: 0 }]}>{fmtDate(m.dateInvitation)}</Text>
            </View>
          ))}
        </View>

        {data.membresEntres.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Mouvements : entrées sur l&apos;année</Text>
            {data.membresEntres.map((m) => (
              <Text key={m.id} style={styles.bodyText}>
                • {m.prenom} {m.nom} — invité le {fmtDate(m.dateInvitation)}
              </Text>
            ))}
          </>
        )}

        {data.membresSortis.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Mouvements : sorties (statut non actif)</Text>
            {data.membresSortis.map((m) => (
              <Text key={m.id} style={styles.bodyText}>
                • {m.prenom} {m.nom} — statut : {m.statut}
              </Text>
            ))}
          </>
        )}

        <PageFooter data={data} pageLabel="Annexe A — Composition" />
      </Page>

      {/* Page : Statistiques */}
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.pageTitle}>Annexe B — Statistiques annuelles</Text>
        <View style={styles.coverInfoRow}>
          <Text style={styles.coverInfoLabel}>Taux de participation moyen :</Text>
          <Text style={styles.coverInfoValue}>
            {data.statistiques.tauxParticipationMoyen != null
              ? `${data.statistiques.tauxParticipationMoyen} %`
              : '—'}
          </Text>
        </View>
        <View style={styles.coverInfoRow}>
          <Text style={styles.coverInfoLabel}>Délai moyen convocation → séance :</Text>
          <Text style={styles.coverInfoValue}>
            {data.statistiques.delaiMoyenConvocationJours != null
              ? `${data.statistiques.delaiMoyenConvocationJours} jours`
              : '—'}
          </Text>
        </View>
        <View style={styles.coverInfoRow}>
          <Text style={styles.coverInfoLabel}>Délai moyen séance → publication :</Text>
          <Text style={styles.coverInfoValue}>
            {data.statistiques.delaiMoyenPublicationJours != null
              ? `${data.statistiques.delaiMoyenPublicationJours} jours`
              : '—'}
          </Text>
        </View>
        <View style={styles.coverInfoRow}>
          <Text style={styles.coverInfoLabel}>Délai moyen publication → préfecture :</Text>
          <Text style={styles.coverInfoValue}>
            {data.statistiques.delaiMoyenTransmissionPrefJours != null
              ? `${data.statistiques.delaiMoyenTransmissionPrefJours} jours`
              : '—'}
          </Text>
        </View>
        <View style={styles.coverInfoRow}>
          <Text style={styles.coverInfoLabel}>Délibérations transmises hors délai (&gt; 15 j) :</Text>
          <Text style={[styles.coverInfoValue, data.statistiques.nbDelibsHorsDelai > 0 ? styles.warn : styles.ok]}>
            {data.statistiques.nbDelibsHorsDelai}
          </Text>
        </View>
        <View style={styles.coverInfoRow}>
          <Text style={styles.coverInfoLabel}>Séances avec quorum non atteint :</Text>
          <Text style={[styles.coverInfoValue, data.statistiques.nbSeancesAvecQuorumNonAtteint > 0 ? styles.warn : styles.ok]}>
            {data.statistiques.nbSeancesAvecQuorumNonAtteint}
          </Text>
        </View>
        <View style={styles.coverInfoRow}>
          <Text style={styles.coverInfoLabel}>Reconvocations (CGCT L2121-17) :</Text>
          <Text style={styles.coverInfoValue}>{data.statistiques.nbReconvocations}</Text>
        </View>

        <PageFooter data={data} pageLabel="Annexe B — Statistiques" />
      </Page>

      {/* Page : Conformité technique */}
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.pageTitle}>Annexe C — Conformité technique</Text>
        <Text style={styles.sectionTitle}>Algorithmes cryptographiques</Text>
        <Text style={styles.bodyText}>
          <Text style={styles.bold}>Chiffrement vote secret :</Text>{' '}
          {data.conformiteTechnique.algoChiffrementVoteSecret}
        </Text>
        <Text style={styles.bodyText}>
          <Text style={styles.bold}>HMAC d&apos;intégrité :</Text>{' '}
          {data.conformiteTechnique.algoHmacIntegrite}
        </Text>
        <Text style={styles.bodyText}>
          <Text style={styles.bold}>Signature PV :</Text>{' '}
          {data.conformiteTechnique.algoSignaturePV}
        </Text>

        <Text style={styles.sectionTitle}>Anonymat du vote secret (CGCT L2121-21)</Text>
        <Text style={styles.bodyText}>{data.conformiteTechnique.separationVotesSecret}</Text>

        <Text style={styles.sectionTitle}>Audit log</Text>
        <Text style={styles.bodyText}>
          <Text style={styles.bold}>Append-only :</Text>{' '}
          {data.conformiteTechnique.auditLogAppendOnly ? '✓ oui (RLS bloquant UPDATE/DELETE)' : '✗ non'}
        </Text>
        <Text style={styles.bodyText}>
          <Text style={styles.bold}>Rate limiting :</Text>{' '}
          {data.conformiteTechnique.rateLimitingActif ? '✓ actif sur les actions sensibles' : '✗ non'}
        </Text>

        <Text style={styles.sectionTitle}>Limites connues (V1)</Text>
        <Text style={styles.bodyText}>
          <Text style={styles.bold}>Horodatage RFC 3161 / eIDAS :</Text>{' '}
          {data.conformiteTechnique.horodatageRfc3161
            ? '✓ activé'
            : '✗ non implémenté en V1 — hashes SHA-256 internes uniquement'}
        </Text>
        <Text style={styles.bodyText}>
          <Text style={styles.bold}>Enrôlement WebAuthn / FIDO2 réel :</Text>{' '}
          {data.conformiteTechnique.webauthnEnrollment
            ? '✓ actif'
            : '✗ simulé en V1 — sera activé avec capteur biométrique en V2'}
        </Text>

        <PageFooter data={data} pageLabel="Annexe C — Conformité technique" />
      </Page>

      {/* Page : Audit trail */}
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.pageTitle}>Annexe D — Journal d&apos;audit</Text>
        <Text style={[styles.italic, { marginBottom: 8 }]}>
          {data.auditTrail.length} entrée{data.auditTrail.length > 1 ? 's' : ''} sur les tables
          critiques (séances, votes, PV, délibérations, présences, procurations, ODJ).
          {data.auditTrail.length >= 5000 ? ' Limité aux 5000 entrées les plus anciennes.' : ''}
        </Text>
        <View style={styles.table}>
          <View style={styles.tableHeader} fixed>
            <Text style={[styles.th, { width: '20%' }]}>Date / heure</Text>
            <Text style={[styles.th, { width: '20%' }]}>Acteur</Text>
            <Text style={[styles.th, { width: '12%' }]}>Action</Text>
            <Text style={[styles.th, { width: '14%' }]}>Table</Text>
            <Text style={[styles.th, { width: '20%' }]}>ID enregistrement</Text>
            <Text style={[styles.th, { width: '14%', borderRightWidth: 0 }]}>IP</Text>
          </View>
          {data.auditTrail.map((a, i) => (
            <View key={i} style={styles.tableRow} wrap={false}>
              <Text style={[styles.td, { width: '20%', fontSize: 7 }]}>{fmtDateTime(a.horodatage)}</Text>
              <Text style={[styles.td, { width: '20%', fontSize: 7 }]}>{a.acteurNom || '—'}</Text>
              <Text style={[styles.td, { width: '12%', fontSize: 7 }]}>{a.action}</Text>
              <Text style={[styles.td, { width: '14%', fontSize: 7 }]}>{a.table}</Text>
              <Text style={[styles.td, { width: '20%', fontSize: 6, fontFamily: 'Courier' }]}>{a.recordId || '—'}</Text>
              <Text style={[styles.td, { width: '14%', fontSize: 7, borderRightWidth: 0 }]}>{a.ip || '—'}</Text>
            </View>
          ))}
        </View>

        <PageFooter data={data} pageLabel="Annexe D — Audit trail" />
      </Page>

      {/* Page : Documents non gérés + Certificat */}
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.pageTitle}>Annexe E — Documents complémentaires</Text>
        <Text style={[styles.italic, { marginBottom: 8 }]}>
          Les éléments suivants ne sont pas couverts par cette application et doivent
          être consultés ailleurs :
        </Text>
        {data.documentsNonGeres.map((d, i) => (
          <Text key={i} style={[styles.bodyText, { marginBottom: 4 }]}>
            • {d}
          </Text>
        ))}

        <Text style={styles.pageTitle}>Certificat d&apos;intégrité</Text>
        <Text style={styles.bodyText}>
          Ce dossier de contrôle a été généré automatiquement par l&apos;application
          <Text style={styles.bold}> {data.meta.appName}</Text>, le{' '}
          <Text style={styles.bold}>{fmtDateTime(data.meta.generatedAt)}</Text>, par{' '}
          <Text style={styles.bold}>{data.meta.generatedBy}</Text>, à partir des registres
          électroniques de l&apos;institution {data.meta.institutionNom}.
        </Text>
        <Text style={[styles.bodyText, { marginTop: 8 }]}>
          <Text style={styles.bold}>Hash SHA-256 du dossier :</Text>
        </Text>
        <Text style={[{ fontFamily: 'Courier', fontSize: 9, padding: 6, backgroundColor: '#f1f5f9', borderRadius: 2 }]}>
          {data.hashIntegrite}
        </Text>
        <Text style={[styles.italic, { marginTop: 8, fontSize: 8 }]}>
          Ce hash permet de vérifier l&apos;intégrité de l&apos;export en le recalculant à
          partir des données source. Toute modification ultérieure invalide le hash.
        </Text>

        <PageFooter data={data} pageLabel="Annexe E + Certificat" />
      </Page>
    </>
  )
}
