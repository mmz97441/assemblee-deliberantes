'use server'

import crypto from 'crypto'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { requireVerifiedRole } from '@/lib/auth/require-role'

// ─── Types exportés ──────────────────────────────────────────────────────────

export interface ControlePrefectureData {
  meta: ControleMeta
  synthese: SyntheseAnnee
  seances: SeanceControle[]
  membresActifsDebut: MemberInfo[]
  membresActifsFin: MemberInfo[]
  membresEntres: MemberInfo[]
  membresSortis: MemberInfo[]
  configInstitution: ConfigInstitutionDetail
  auditTrail: AuditEntry[]
  conformiteTechnique: ConformiteTechnique
  statistiques: StatistiquesAnnuelles
  documentsNonGeres: string[]
  hashIntegrite: string
}

export interface ControleMeta {
  institutionNom: string
  institutionType: string
  institutionSiren: string | null
  institutionSiret: string | null
  institutionAdresse: string | null
  populationHabitants: number | null
  year: number
  periodeDebut: string
  periodeFin: string
  generatedAt: string
  generatedBy: string
  appName: string
}

export interface SyntheseAnnee {
  nbSeancesTotal: number
  nbSeancesParStatut: Record<string, number>
  nbDeliberationsPubliees: number
  nbDeliberationsParInstance: Record<string, number>
  nbVotesParType: Record<string, number>
  presidentsEffectifs: { nom: string; nbSeances: number }[]
}

export interface SeanceControle {
  id: string
  titre: string
  date: string
  dateFormatee: string
  lieu: string | null
  mode: string
  statut: string
  publique: boolean
  reconvocation: boolean
  instance: { nom: string; type_legal: string }

  convocation: {
    envoyeeAt: string | null
    presidentConvoquant: string | null
    delaiJours: number
    delaiLegalJours: number
    delaiOK: boolean
    convocataires: ConvocataireDetail[]
    membresEnExercice: number
    convocationComplete: boolean
  }

  tenue: {
    heureOuverture: string | null
    heureCloture: string | null
    dureeMinutes: number | null
    presidentEffectif: string | null
    secretaireSeance: string | null
    remplacementVPPreside: boolean
  }

  presences: PresenceDetail[]
  procurations: ProcurationDetail[]

  quorum: {
    typeRequis: string
    seuilCalcule: number | null
    nombrePresents: number
    atteint: boolean
    horodatageVerification: string | null
  }

  recusations: RecusationDetail[]

  points: PointODJControle[]

  pv: {
    id: string | null
    statut: string | null
    version: number | null
    signaturePresident: SignatureInfo | null
    signatureSecretaire: SignatureInfo | null
  } | null
}

export interface ConvocationEnvoiDetail {
  numeroEnvoi: number
  motif: string
  motifDetail: string | null
  emailDestinataire: string
  envoyeAt: string
  statutResend: string
  envoyePar: string | null
}

export interface ConvocataireDetail {
  nom: string
  email: string | null
  envoyeAt: string | null
  statutConvocation: string | null
  confirmeAt: string | null
  motifAbsence: string | null
  envois: ConvocationEnvoiDetail[]
}

export interface PresenceDetail {
  membreNom: string
  qualite: string | null
  statut: string
  methode: string | null
  horodatage: string | null
  marquePar: string | null
  motifAssiste: string | null
}

export interface ProcurationDetail {
  mandantNom: string
  mandataireNom: string
  canal: string | null
  documentFourni: boolean
  valide: boolean
}

export interface RecusationDetail {
  membreNom: string
  pointConcerne: string
  declarePar: string
  motif: string | null
}

export interface PointODJControle {
  position: number
  titre: string
  type: string
  rapporteur: string | null
  description: string | null
  noteSynthese: string | null
  projetDeliberation: string | null
  huisClos: boolean
  huisClosActiveAt: string | null
  huisClosLeveAt: string | null
  vote: VoteControle | null
  deliberation: DeliberationControle | null
  documents: DocumentInfoControle[]
}

export interface VoteControle {
  id: string
  type: string
  ouvertAt: string | null
  ouvertPar: string | null
  closAt: string | null
  closPar: string | null
  quorumOuvert: number | null
  resultat: string
  pour: number | null
  contre: number | null
  abstention: number | null
  votants: number | null
  nomsPour: string[] | null // vote nominal
  nomsContre: string[] | null
  nomsAbstention: string[] | null
  formulePV: string | null
  hashIntegrite: string | null
  participation: { nom: string; aVote: boolean }[] // vote secret : qui a voté sans le choix
}

export interface DeliberationControle {
  numero: string | null
  titre: string
  publieAt: string | null
  afficheAt: string | null
  transmisPrefAt: string | null
  executoireAt: string | null
  annulee: boolean
  articles: string[]
}

export interface DocumentInfoControle {
  nom: string
  taille: number | null
  uploadeAt: string | null
}

export interface SignatureInfo {
  nom: string
  timestamp: string
  hashSha256: string | null
}

export interface MemberInfo {
  id: string
  nom: string
  prenom: string
  email: string | null
  qualite: string | null
  role: string | null
  statut: string | null
  dateInvitation: string | null
}

export interface ConfigInstitutionDetail {
  nomOfficiel: string
  typeInstitution: string
  siren: string | null
  siret: string | null
  adresseSiege: string | null
  emailSecretariat: string | null
  prefectureRattachement: string | null
  formatNumeroDeliberation: string
  prefixeNumeroDeliberation: string | null
  remiseZeroAnnuelle: boolean
  populationHabitants: number | null
  noteSyntheseObligatoire: boolean
  noteSyntheseSeuilPopulation: number
}

export interface AuditEntry {
  horodatage: string
  acteurNom: string | null
  action: string
  table: string
  recordId: string | null
  ip: string | null
  userAgent: string | null
}

export interface ConformiteTechnique {
  algoChiffrementVoteSecret: string
  algoHmacIntegrite: string
  algoSignaturePV: string
  separationVotesSecret: string
  auditLogAppendOnly: boolean
  rateLimitingActif: boolean
  horodatageRfc3161: boolean
  webauthnEnrollment: boolean
}

export interface StatistiquesAnnuelles {
  tauxParticipationMoyen: number | null
  delaiMoyenConvocationJours: number | null
  delaiMoyenPublicationJours: number | null
  delaiMoyenTransmissionPrefJours: number | null
  nbDelibsHorsDelai: number
  nbSeancesAvecQuorumNonAtteint: number
  nbReconvocations: number
}

// ─── Action principale ───────────────────────────────────────────────────────

export async function getControlePrefectureData(
  year: number
): Promise<{ data: ControlePrefectureData } | { error: string }> {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: userData } = await supabase.auth.getUser()
    const user = userData?.user || null
    const roleError = await requireVerifiedRole(supabase, user, ['super_admin', 'dgs', 'directeur_cabinet', 'gestionnaire'])
    if (roleError) return { error: roleError }

    const periodeDebut = `${year}-01-01T00:00:00.000Z`
    const periodeFin = `${year + 1}-01-01T00:00:00.000Z`

    // ─── 1. Configuration institution + meta ──────────────────────────
    const { data: instConfig } = await supabase
      .from('institution_config')
      .select('*')
      .limit(1)
      .maybeSingle()

    if (!instConfig) return { error: "Configuration de l'institution introuvable" }

    // Nom du gestionnaire qui génère
    const { data: currentMember } = await supabase
      .from('members')
      .select('prenom, nom')
      .eq('user_id', user!.id)
      .maybeSingle()
    const generatedBy = currentMember
      ? `${currentMember.prenom} ${currentMember.nom}`
      : (user!.email || 'Inconnu')

    const meta: ControleMeta = {
      institutionNom: instConfig.nom_officiel,
      institutionType: instConfig.type_institution,
      institutionSiren: instConfig.siren,
      institutionSiret: instConfig.siret,
      institutionAdresse: instConfig.adresse_siege,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      populationHabitants: (instConfig as any).population_habitants ?? null,
      year,
      periodeDebut,
      periodeFin,
      generatedAt: new Date().toISOString(),
      generatedBy,
      appName: 'Assemblées Délibérantes',
    }

    const configInstitution: ConfigInstitutionDetail = {
      nomOfficiel: instConfig.nom_officiel,
      typeInstitution: instConfig.type_institution,
      siren: instConfig.siren,
      siret: instConfig.siret,
      adresseSiege: instConfig.adresse_siege,
      emailSecretariat: instConfig.email_secretariat,
      prefectureRattachement: instConfig.prefecture_rattachement,
      formatNumeroDeliberation: instConfig.format_numero_deliberation || 'AAAA-NNN',
      prefixeNumeroDeliberation: instConfig.prefixe_numero_deliberation,
      remiseZeroAnnuelle: instConfig.remise_zero_annuelle ?? true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      populationHabitants: (instConfig as any).population_habitants ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      noteSyntheseObligatoire: (instConfig as any).note_synthese_obligatoire ?? false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      noteSyntheseSeuilPopulation: (instConfig as any).note_synthese_seuil_population ?? 3500,
    }

    // ─── 2. Liste des séances de l'année ──────────────────────────────
    const { data: seancesData } = await supabase
      .from('seances')
      .select(`
        *,
        instance_config (id, nom, type_legal, delai_convocation_jours, quorum_type, quorum_fraction_numerateur, quorum_fraction_denominateur, composition_max),
        president_effectif:members!seances_president_effectif_seance_id_fkey (id, prenom, nom),
        secretaire_seance:members!seances_secretaire_seance_id_fkey (id, prenom, nom)
      `)
      .gte('date_seance', periodeDebut)
      .lt('date_seance', periodeFin)
      .order('date_seance', { ascending: true })

    const seances = await Promise.all(
      (seancesData || []).map((s) => buildSeanceControle(supabase, s))
    )

    // ─── 3. Synthèse annuelle ─────────────────────────────────────────
    const synthese = buildSynthese(seances)

    // ─── 4. Membres : actifs et mouvements sur l'année ────────────────
    const { data: allMembers } = await supabase
      .from('members')
      .select('id, prenom, nom, email, qualite_officielle, role, statut, created_at')
      .order('nom', { ascending: true })

    const membresActifsFin: MemberInfo[] = (allMembers || [])
      .filter((m) => m.statut === 'ACTIF')
      .map(toMemberInfo)
    const membresActifsDebut: MemberInfo[] = (allMembers || [])
      .filter((m) => m.created_at && m.created_at < periodeDebut && m.statut === 'ACTIF')
      .map(toMemberInfo)
    const membresEntres: MemberInfo[] = (allMembers || [])
      .filter((m) => m.created_at && m.created_at >= periodeDebut && m.created_at < periodeFin)
      .map(toMemberInfo)
    const membresSortis: MemberInfo[] = (allMembers || [])
      .filter((m) => m.statut !== 'ACTIF')
      .map(toMemberInfo)

    // ─── 5. Audit trail filtré sur la période ─────────────────────────
    const { data: auditData } = await supabase
      .from('audit_log')
      .select('*')
      .gte('created_at', periodeDebut)
      .lt('created_at', periodeFin)
      .in('table_name', ['seances', 'votes', 'pv', 'deliberations', 'presences', 'procurations', 'odj_points'])
      .order('created_at', { ascending: true })
      .limit(5000)

    const userIds = Array.from(new Set((auditData || []).map((a) => a.user_id).filter(Boolean) as string[]))
    const { data: usersForAudit } = userIds.length > 0
      ? await supabase.from('members').select('user_id, prenom, nom').in('user_id', userIds)
      : { data: [] }
    const userNameMap = new Map<string, string>()
    for (const u of usersForAudit || []) {
      if (u.user_id) userNameMap.set(u.user_id, `${u.prenom} ${u.nom}`)
    }

    const auditTrail: AuditEntry[] = (auditData || []).map((a) => ({
      horodatage: a.created_at || '',
      acteurNom: a.user_id ? (userNameMap.get(a.user_id) || a.user_id) : null,
      action: a.action,
      table: a.table_name,
      recordId: a.record_id,
      ip: a.ip,
      userAgent: a.user_agent,
    }))

    // ─── 6. Statistiques annuelles ────────────────────────────────────
    const statistiques = buildStatistiques(seances)

    // ─── 7. Conformité technique (constants + détection runtime) ──────
    const conformiteTechnique: ConformiteTechnique = {
      algoChiffrementVoteSecret: 'AES-256-GCM (clé de session par vote, master AES-256)',
      algoHmacIntegrite: 'HMAC-SHA256 (par bulletin secret, secret HMAC institution)',
      algoSignaturePV: 'SHA-256 sur le contenu signé (timestamp serveur)',
      separationVotesSecret:
        'Tables séparées votes_participation (qui) et bulletins_secret (choix) — INSERT-ONLY, sans member_id sur le bulletin (CGCT L2121-21)',
      auditLogAppendOnly: true,
      rateLimitingActif: true,
      horodatageRfc3161: false,
      webauthnEnrollment: false,
    }

    const documentsNonGeres = [
      'Décisions du maire prises par délégation (CGCT L2122-22) — non tracées dans l\'application, voir registre interne',
      'Conventions, contrats, marchés publics — hors scope, voir service marchés publics',
      'Permis (urbanisme, construire) — hors scope, voir service urbanisme',
      'Horodatage qualifié RFC 3161 (eIDAS) — non implémenté, hashes SHA-256 internes uniquement',
      'Signature électronique qualifiée eIDAS — non implémentée, signatures internes via WebAuthn + SHA-256',
      'Accusés de transmission @ctes physiques — pas d\'intégration directe, voir système @ctes ou dossier papier',
    ]

    // ─── 8. Hash global d'intégrité du dossier ────────────────────────
    const partial: Omit<ControlePrefectureData, 'hashIntegrite'> = {
      meta,
      synthese,
      seances,
      membresActifsDebut,
      membresActifsFin,
      membresEntres,
      membresSortis,
      configInstitution,
      auditTrail,
      conformiteTechnique,
      statistiques,
      documentsNonGeres,
    }
    const hashIntegrite = computeHash(JSON.stringify(partial))

    return {
      data: {
        ...partial,
        hashIntegrite,
      },
    }
  } catch (err) {
    console.error('getControlePrefectureData error:', err)
    return { error: 'Erreur inattendue lors de la génération du dossier' }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toMemberInfo(m: any): MemberInfo {
  return {
    id: m.id,
    nom: m.nom,
    prenom: m.prenom,
    email: m.email,
    qualite: m.qualite_officielle,
    role: m.role,
    statut: m.statut,
    dateInvitation: m.created_at,
  }
}

function computeHash(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex')
}

function formatDateLong(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

// ─── buildSeanceControle : pour une séance, agrège tous les détails ─────────

async function buildSeanceControle(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  s: any
): Promise<SeanceControle> {
  const seanceId = s.id

  // ─── Convocataires + membres en exercice à la convocation ──────────
  const { data: convs } = await supabase
    .from('convocataires')
    .select('id, member_id, statut_convocation, envoye_at, confirme_at, motif_absence, member:members(prenom, nom, email)')
    .eq('seance_id', seanceId)

  const { count: nbMembresActifs } = await supabase
    .from('members')
    .select('*', { count: 'exact', head: true })
    .eq('statut', 'ACTIF')

  // Historique des envois (table append-only) — un appel batch par séance
  // pour éviter le N+1.
  const convocataireIds = (convs || []).map((c: { id: string }) => c.id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const envoisByConvocataire = new Map<string, ConvocationEnvoiDetail[]>()
  if (convocataireIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: envois } = await ((supabase as any).from('convocation_envois'))
      .select('convocataire_id, numero_envoi, motif, motif_detail, email_destinataire, envoye_at, statut_resend, envoye_par')
      .in('convocataire_id', convocataireIds)
      .order('numero_envoi', { ascending: true })

    for (const e of (envois || [])) {
      const list = envoisByConvocataire.get(e.convocataire_id) || []
      list.push({
        numeroEnvoi: e.numero_envoi,
        motif: e.motif,
        motifDetail: e.motif_detail,
        emailDestinataire: e.email_destinataire,
        envoyeAt: e.envoye_at,
        statutResend: e.statut_resend,
        envoyePar: e.envoye_par,
      })
      envoisByConvocataire.set(e.convocataire_id, list)
    }
  }

  const convocataires: ConvocataireDetail[] = (convs || []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (c: any) => ({
      nom: c.member ? `${c.member.prenom} ${c.member.nom}` : 'Inconnu',
      email: c.member?.email || null,
      envoyeAt: c.envoye_at,
      statutConvocation: c.statut_convocation,
      confirmeAt: c.confirme_at,
      motifAbsence: c.motif_absence,
      envois: envoisByConvocataire.get(c.id) || [],
    })
  )

  const nbConvoques = convocataires.length
  const dateSeance = new Date(s.date_seance)
  const earliestEnvoyeAt = (convs || [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((c: any) => c.envoye_at)
    .filter(Boolean)
    .sort()[0] || null
  const delaiJours = earliestEnvoyeAt
    ? Math.floor((dateSeance.getTime() - new Date(earliestEnvoyeAt).getTime()) / 86400000)
    : 0
  const delaiLegal = s.instance_config?.delai_convocation_jours || 5

  // ─── Présences ─────────────────────────────────────────────────────
  const { data: presencesData } = await supabase
    .from('presences')
    .select(`
      *,
      member:members(prenom, nom, qualite_officielle),
      marquee_par:members!presences_marquee_par_fkey(prenom, nom)
    `)
    .eq('seance_id', seanceId)

  const presences: PresenceDetail[] = (presencesData || []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (p: any) => ({
      membreNom: p.member ? `${p.member.prenom} ${p.member.nom}` : 'Inconnu',
      qualite: p.member?.qualite_officielle || null,
      statut: p.statut,
      methode: p.mode_authentification || p.methode_emargement || null,
      horodatage: p.heure_arrivee || p.emargement_at || null,
      marquePar: p.marquee_par ? `${p.marquee_par.prenom} ${p.marquee_par.nom}` : null,
      motifAssiste: p.mode_assiste_motif || null,
    })
  )

  // ─── Procurations ──────────────────────────────────────────────────
  const { data: procsData } = await supabase
    .from('procurations')
    .select(`
      *,
      mandant:members!procurations_mandant_id_fkey(prenom, nom),
      mandataire:members!procurations_mandataire_id_fkey(prenom, nom)
    `)
    .eq('seance_id', seanceId)

  const procurations: ProcurationDetail[] = (procsData || []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (p: any) => ({
      mandantNom: p.mandant ? `${p.mandant.prenom} ${p.mandant.nom}` : 'Inconnu',
      mandataireNom: p.mandataire ? `${p.mandataire.prenom} ${p.mandataire.nom}` : 'Inconnu',
      canal: p.canal_communication,
      documentFourni: !!p.document_url,
      valide: p.valide ?? false,
    })
  )

  // ─── Récusations ───────────────────────────────────────────────────
  const { data: recusationsData } = await supabase
    .from('recusations')
    .select(`*, member:members(prenom, nom), declared_by_member:members!recusations_declared_by_fkey(prenom, nom)`)
    .eq('seance_id', seanceId)

  // Mapping odj_point_id → titre, alimenté plus bas après chargement des points
  const odjPointsMap = new Map<string, string>()

  const recusations: RecusationDetail[] = (recusationsData || []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (r: any) => ({
      membreNom: r.member ? `${r.member.prenom} ${r.member.nom}` : 'Inconnu',
      pointConcerne: odjPointsMap.get(r.odj_point_id) || r.odj_point_id || '—',
      declarePar: r.declared_by_member ? `${r.declared_by_member.prenom} ${r.declared_by_member.nom}` : (r.declarer_role || 'Inconnu'),
      motif: r.motif || null,
    })
  )

  // ─── Points ODJ ────────────────────────────────────────────────────
  const { data: pointsData } = await supabase
    .from('odj_points')
    .select(`
      *,
      rapporteur:members(prenom, nom)
    `)
    .eq('seance_id', seanceId)
    .order('position', { ascending: true })

  // ─── Votes ─────────────────────────────────────────────────────────
  const { data: votesData } = await supabase
    .from('votes')
    .select(`
      *,
      ouvert_par_member:members!votes_ouvert_par_fkey(prenom, nom),
      clos_par_member:members!votes_clos_par_fkey(prenom, nom)
    `)
    .eq('seance_id', seanceId)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const votesMap = new Map<string, any>()
  for (const v of votesData || []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    votesMap.set((v as any).odj_point_id, v)
  }

  // ─── Délibérations ─────────────────────────────────────────────────
  const { data: delibsData } = await supabase
    .from('deliberations')
    .select('*')
    .eq('seance_id', seanceId)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const delibsMap = new Map<string, any>()
  for (const d of delibsData || []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((d as any).odj_point_id) delibsMap.set((d as any).odj_point_id, d)
  }

  const points: PointODJControle[] = await Promise.all(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pointsData || []).map(async (p: any) => {
      const vote = votesMap.get(p.id)
      const delib = delibsMap.get(p.id)
      const voteControle = vote ? await buildVoteControle(supabase, vote) : null
      const delibControle = delib ? buildDeliberationControle(delib) : null

      return {
        position: p.position,
        titre: p.titre,
        type: p.type_traitement || 'DELIBERATION',
        rapporteur: p.rapporteur ? `${p.rapporteur.prenom} ${p.rapporteur.nom}` : null,
        description: p.description,
        noteSynthese: p.note_synthese,
        projetDeliberation: p.projet_deliberation,
        huisClos: p.huis_clos || false,
        huisClosActiveAt: p.huis_clos_active_at || null,
        huisClosLeveAt: p.huis_clos_leve_at || null,
        vote: voteControle,
        deliberation: delibControle,
        documents: ((p.documents || []) as DocumentInfoControle[]).map((d) => ({
          nom: d.nom || 'Sans nom',
          taille: d.taille || null,
          uploadeAt: d.uploadeAt || null,
        })),
      }
    })
  )

  // Fill ODJ titles for recusations
  for (const p of pointsData || []) {
    odjPointsMap.set(p.id, p.titre)
  }
  for (let i = 0; i < recusations.length; i++) {
    const r = recusationsData![i]
    if (r?.odj_point_id) {
      recusations[i].pointConcerne = odjPointsMap.get(r.odj_point_id) || '—'
    }
  }

  // ─── PV ────────────────────────────────────────────────────────────
  const { data: pvData } = await supabase
    .from('pv')
    .select('id, statut, version, signe_par, signe_at')
    .eq('seance_id', seanceId)
    .maybeSingle()

  let pvControle: SeanceControle['pv'] = null
  if (pvData) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sigs = ((pvData.signe_par as any[]) || []) as { role?: string; nom?: string; prenom?: string; timestamp?: string; hash?: string }[]
    const sigPres = sigs.find((s) => s.role === 'president')
    const sigSecr = sigs.find((s) => s.role === 'secretaire')
    pvControle = {
      id: pvData.id,
      statut: pvData.statut,
      version: pvData.version,
      signaturePresident: sigPres
        ? { nom: `${sigPres.prenom || ''} ${sigPres.nom || ''}`.trim(), timestamp: sigPres.timestamp || '', hashSha256: sigPres.hash || null }
        : null,
      signatureSecretaire: sigSecr
        ? { nom: `${sigSecr.prenom || ''} ${sigSecr.nom || ''}`.trim(), timestamp: sigSecr.timestamp || '', hashSha256: sigSecr.hash || null }
        : null,
    }
  }

  // ─── Quorum ────────────────────────────────────────────────────────
  const composition = s.instance_config?.composition_max
  const num = s.instance_config?.quorum_fraction_numerateur || 1
  const den = s.instance_config?.quorum_fraction_denominateur || 2
  const seuilCalcule = composition ? Math.ceil((composition * num) / den) : null
  const nombrePresents = presences.filter((p) => p.statut === 'PRESENT' || p.statut === 'PROCURATION').length

  // ─── Construction finale ───────────────────────────────────────────
  return {
    id: seanceId,
    titre: s.titre,
    date: s.date_seance,
    dateFormatee: formatDateLong(s.date_seance),
    lieu: s.lieu,
    mode: s.mode || 'PRESENTIEL',
    statut: s.statut || 'BROUILLON',
    publique: s.publique ?? true,
    reconvocation: s.reconvocation || false,
    instance: {
      nom: s.instance_config?.nom || '—',
      type_legal: s.instance_config?.type_legal || '—',
    },
    convocation: {
      envoyeeAt: earliestEnvoyeAt,
      presidentConvoquant: s.president_effectif
        ? `${s.president_effectif.prenom} ${s.president_effectif.nom}`
        : null,
      delaiJours,
      delaiLegalJours: delaiLegal,
      delaiOK: delaiJours >= delaiLegal,
      convocataires,
      membresEnExercice: nbMembresActifs || 0,
      convocationComplete: nbConvoques >= (nbMembresActifs || 0),
    },
    tenue: {
      heureOuverture: s.heure_ouverture,
      heureCloture: s.heure_cloture,
      dureeMinutes:
        s.heure_ouverture && s.heure_cloture
          ? Math.round((new Date(s.heure_cloture).getTime() - new Date(s.heure_ouverture).getTime()) / 60000)
          : null,
      presidentEffectif: s.president_effectif
        ? `${s.president_effectif.prenom} ${s.president_effectif.nom}`
        : null,
      secretaireSeance: s.secretaire_seance
        ? `${s.secretaire_seance.prenom} ${s.secretaire_seance.nom}`
        : null,
      // Détection grossière : si le président effectif n'est pas le président
      // de bureau de l'instance, on suppose un remplacement (CGCT L2122-17).
      // Le wording exact dépend du contexte — on indique juste que le PV doit
      // mentionner le remplacement.
      remplacementVPPreside: false, // simplifié pour cette V1
    },
    presences,
    procurations,
    quorum: {
      typeRequis: s.instance_config?.quorum_type || 'MAJORITE_MEMBRES',
      seuilCalcule,
      nombrePresents,
      atteint: seuilCalcule !== null ? nombrePresents >= seuilCalcule : true,
      horodatageVerification: s.heure_ouverture,
    },
    recusations,
    points,
    pv: pvControle,
  }
}

async function buildVoteControle(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  v: any
): Promise<VoteControle> {
  // Pour le vote secret, on ne charge que la PARTICIPATION (pas les bulletins
  // individuels) afin de préserver l'anonymat (CGCT L2121-21).
  let participation: { nom: string; aVote: boolean }[] = []
  if (v.type_vote === 'SECRET') {
    const { data: partData } = await supabase
      .from('votes_participation')
      .select('a_vote, member:members(prenom, nom)')
      .eq('vote_id', v.id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    participation = (partData || []).map((p: any) => ({
      nom: p.member ? `${p.member.prenom} ${p.member.nom}` : 'Inconnu',
      aVote: p.a_vote ?? true,
    }))
  }

  return {
    id: v.id,
    type: v.type_vote || 'MAIN_LEVEE',
    ouvertAt: v.ouvert_at,
    ouvertPar: v.ouvert_par_member
      ? `${v.ouvert_par_member.prenom} ${v.ouvert_par_member.nom}`
      : null,
    closAt: v.clos_at,
    closPar: v.clos_par_member
      ? `${v.clos_par_member.prenom} ${v.clos_par_member.nom}`
      : null,
    quorumOuvert: v.quorum_ouvert || null,
    resultat: v.resultat || 'INCONNU',
    pour: v.pour,
    contre: v.contre,
    abstention: v.abstention,
    votants: v.total_votants,
    nomsPour: Array.isArray(v.noms_pour) ? v.noms_pour : null,
    nomsContre: Array.isArray(v.noms_contre) ? v.noms_contre : null,
    nomsAbstention: Array.isArray(v.noms_abstention) ? v.noms_abstention : null,
    formulePV: v.formule_pv,
    hashIntegrite: v.hash_integrite || null,
    participation,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildDeliberationControle(d: any): DeliberationControle {
  let executoire: string | null = null
  if (d.transmis_prefecture_at && d.affiche_at) {
    const dT = new Date(d.transmis_prefecture_at).getTime()
    const dA = new Date(d.affiche_at).getTime()
    executoire = new Date(Math.max(dT, dA) + 86400000).toISOString()
  }

  let articles: string[] = []
  if (Array.isArray(d.contenu_articles)) {
    articles = d.contenu_articles
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((a: any) => (typeof a === 'string' ? a : a?.texte || ''))
      .filter(Boolean)
  }

  return {
    numero: d.numero,
    titre: d.titre,
    publieAt: d.publie_at,
    afficheAt: d.affiche_at,
    transmisPrefAt: d.transmis_prefecture_at,
    executoireAt: executoire,
    annulee: d.annulee || false,
    articles,
  }
}

function buildSynthese(seances: SeanceControle[]): SyntheseAnnee {
  const nbSeancesParStatut: Record<string, number> = {}
  const nbDeliberationsParInstance: Record<string, number> = {}
  const nbVotesParType: Record<string, number> = {}
  const presidentsCount: Record<string, number> = {}

  let nbDeliberationsPubliees = 0

  for (const s of seances) {
    nbSeancesParStatut[s.statut] = (nbSeancesParStatut[s.statut] || 0) + 1

    if (s.tenue.presidentEffectif) {
      presidentsCount[s.tenue.presidentEffectif] = (presidentsCount[s.tenue.presidentEffectif] || 0) + 1
    }

    for (const p of s.points) {
      if (p.vote) {
        nbVotesParType[p.vote.type] = (nbVotesParType[p.vote.type] || 0) + 1
      }
      if (p.deliberation && p.deliberation.publieAt && !p.deliberation.annulee) {
        nbDeliberationsPubliees++
        const inst = s.instance.nom
        nbDeliberationsParInstance[inst] = (nbDeliberationsParInstance[inst] || 0) + 1
      }
    }
  }

  return {
    nbSeancesTotal: seances.length,
    nbSeancesParStatut,
    nbDeliberationsPubliees,
    nbDeliberationsParInstance,
    nbVotesParType,
    presidentsEffectifs: Object.entries(presidentsCount)
      .map(([nom, nbSeances]) => ({ nom, nbSeances }))
      .sort((a, b) => b.nbSeances - a.nbSeances),
  }
}

function buildStatistiques(seances: SeanceControle[]): StatistiquesAnnuelles {
  let totalParticipationRatio = 0
  let nbWithRatio = 0
  let totalDelaiConvocation = 0
  let nbWithDelai = 0
  let totalDelaiPub = 0
  let nbWithPub = 0
  let totalDelaiTransmis = 0
  let nbWithTransmis = 0
  let nbDelibsHorsDelai = 0
  let nbSeancesQuorumNonAtteint = 0
  let nbReconvocations = 0

  for (const s of seances) {
    if (s.reconvocation) nbReconvocations++

    const totalConv = s.convocation.convocataires.length
    if (totalConv > 0) {
      totalParticipationRatio += s.quorum.nombrePresents / totalConv
      nbWithRatio++
    }

    if (s.convocation.envoyeeAt && s.convocation.delaiJours >= 0) {
      totalDelaiConvocation += s.convocation.delaiJours
      nbWithDelai++
    }

    if (!s.quorum.atteint) nbSeancesQuorumNonAtteint++

    for (const p of s.points) {
      if (p.deliberation && !p.deliberation.annulee) {
        if (p.deliberation.publieAt && p.deliberation.transmisPrefAt) {
          const dPub = new Date(p.deliberation.publieAt).getTime()
          const dTransmis = new Date(p.deliberation.transmisPrefAt).getTime()
          const days = Math.round((dTransmis - dPub) / 86400000)
          totalDelaiTransmis += days
          nbWithTransmis++
          if (days > 15) nbDelibsHorsDelai++
        }
        if (p.deliberation.publieAt && s.date) {
          const days = Math.round((new Date(p.deliberation.publieAt).getTime() - new Date(s.date).getTime()) / 86400000)
          if (days >= 0) {
            totalDelaiPub += days
            nbWithPub++
          }
        }
      }
    }
  }

  return {
    tauxParticipationMoyen: nbWithRatio ? Math.round((totalParticipationRatio / nbWithRatio) * 100) : null,
    delaiMoyenConvocationJours: nbWithDelai ? Math.round(totalDelaiConvocation / nbWithDelai) : null,
    delaiMoyenPublicationJours: nbWithPub ? Math.round(totalDelaiPub / nbWithPub) : null,
    delaiMoyenTransmissionPrefJours: nbWithTransmis ? Math.round(totalDelaiTransmis / nbWithTransmis) : null,
    nbDelibsHorsDelai,
    nbSeancesAvecQuorumNonAtteint: nbSeancesQuorumNonAtteint,
    nbReconvocations,
  }
}
