'use server'

import { revalidatePath } from 'next/cache'
import { createHash } from 'crypto'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { Json } from '@/lib/supabase/types'

type ActionResult = { success: true } | { error: string }

async function getAuthenticatedUser() {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) return { user: null, supabase }
  return { user: data.user, supabase }
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PVContenu {
  entete: {
    institution: string
    typeInstance: string
    nomInstance: string
    dateSeance: string
    heureOuverture: string | null
    heureCloture: string | null
    lieu: string | null
    mode: string
    publique: boolean
    reconvocation: boolean
  }
  presences: {
    presents: { prenom: string; nom: string; qualite: string | null }[]
    excuses: { prenom: string; nom: string }[]
    absents: { prenom: string; nom: string }[]
    procurations: { mandant: string; mandataire: string }[]
    quorum: { atteint: boolean; presents: number; requis: number }
    quorumStatement: string
  }
  bureau: {
    president: string | null
    secretaire: string | null
  }
  points: {
    position: number
    titre: string
    type: string
    description: string | null
    rapporteur: string | null
    projetDeliberation: string | null
    vu: string
    considerant: string
    discussion: string
    articles: string[]
    vote: {
      resultat: string | null
      pour: number
      contre: number
      abstentions: number
      totalVotants: number
      nomsContre: string[]
      nomsAbstention: string[]
      formulePV: string | null
    } | null
  }[]
  cloture: {
    heure: string | null
    texte: string
  }
  // Free-text editable sections
  introductionLibre: string
  conclusionLibre: string
}

export interface PVSignatureRecord {
  user_id: string
  member_id: string
  nom: string
  prenom: string
  role: 'president' | 'secretaire'
  timestamp: string
}

export interface PVComment {
  id: string
  pv_id: string
  user_id: string
  section_key: string
  contenu: string
  resolu: boolean
  created_at: string
}

// ─── Generate PV draft ───────────────────────────────────────────────────────

export async function generatePVBrouillon(seanceId: string): Promise<
  { success: true; pvId: string; contenu: PVContenu } | { error: string }
> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    const role = (user.user_metadata?.role as string) || ''
    if (!['super_admin', 'gestionnaire'].includes(role)) {
      return { error: 'Permissions insuffisantes' }
    }

    // Load all seance data
    const { data: seance, error: seanceError } = await supabase
      .from('seances')
      .select(`
        id, titre, date_seance, statut, lieu, mode, publique, reconvocation,
        heure_ouverture, heure_cloture, instance_id,
        instance_config (id, nom, type_legal, quorum_type, quorum_fraction_numerateur, quorum_fraction_denominateur, composition_max),
        odj_points (*, vu, considerant, discussion, articles),
        convocataires (
          id, member_id, statut_convocation,
          member:members (id, prenom, nom, qualite_officielle)
        ),
        presences (id, member_id, statut, heure_arrivee),
        president_effectif:members!seances_president_effectif_seance_id_fkey (id, prenom, nom),
        secretaire_seance:members!seances_secretaire_seance_id_fkey (id, prenom, nom),
        votes (id, odj_point_id, statut, pour, contre, abstention, total_votants, resultat, formule_pv, noms_contre, noms_abstention)
      `)
      .eq('id', seanceId)
      .single()

    if (seanceError || !seance) return { error: 'Séance introuvable' }

    // Get institution info
    const { data: institution } = await supabase
      .from('institution_config')
      .select('nom_officiel, type_institution')
      .limit(1)
      .maybeSingle()

    // Build presence lists
    const presenceMap = new Map<string, string>()
    for (const p of (seance.presences || [])) {
      presenceMap.set(p.member_id, p.statut || 'ABSENT')
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const convocataires = (seance.convocataires || []) as any[]
    const presents: { prenom: string; nom: string; qualite: string | null }[] = []
    const excuses: { prenom: string; nom: string }[] = []
    const absents: { prenom: string; nom: string }[] = []

    for (const conv of convocataires) {
      if (!conv.member) continue
      const statut = presenceMap.get(conv.member_id) || 'ABSENT'
      if (statut === 'PRESENT') {
        presents.push({
          prenom: conv.member.prenom,
          nom: conv.member.nom,
          qualite: conv.member.qualite_officielle,
        })
      } else if (statut === 'EXCUSE' || statut === 'PROCURATION') {
        excuses.push({ prenom: conv.member.prenom, nom: conv.member.nom })
      } else {
        absents.push({ prenom: conv.member.prenom, nom: conv.member.nom })
      }
    }

    // Load procurations
    const { data: procurations } = await supabase
      .from('procurations')
      .select(`
        mandant:members!procurations_mandant_id_fkey (prenom, nom),
        mandataire:members!procurations_mandataire_id_fkey (prenom, nom)
      `)
      .eq('seance_id', seanceId)
      .eq('valide', true)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const procsList = (procurations || []).map((p: any) => ({
      mandant: `${p.mandant?.prenom || ''} ${p.mandant?.nom || ''}`.trim(),
      mandataire: `${p.mandataire?.prenom || ''} ${p.mandataire?.nom || ''}`.trim(),
    }))

    // Quorum calculation
    const totalPresents = presents.length + procsList.length // procurations count
    const instanceConfig = seance.instance_config as {
      composition_max: number | null
      quorum_fraction_numerateur: number | null
      quorum_fraction_denominateur: number | null
    } | null
    const compositionMax = instanceConfig?.composition_max || convocataires.length
    const num = instanceConfig?.quorum_fraction_numerateur || 1
    const den = instanceConfig?.quorum_fraction_denominateur || 2
    const quorumRequis = Math.ceil((compositionMax * num) / den)

    // Format date
    const dateObj = new Date(seance.date_seance)
    const dateStr = dateObj.toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })

    const formatTime = (t: string | null) => {
      if (!t) return null
      try { return new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }
      catch { return null }
    }

    // Build quorum statement
    const presidentNom = seance.president_effectif
      ? `${seance.president_effectif.prenom} ${seance.president_effectif.nom}`
      : 'le/la président(e)'
    const heureOuverture = formatTime(seance.heure_ouverture) || '...'
    const quorumAtteint = totalPresents >= quorumRequis
    const quorumStatement = quorumAtteint
      ? `Le quorum étant atteint (${totalPresents} présents sur ${compositionMax} membres), ${presidentNom} déclare la séance ouverte à ${heureOuverture}.`
      : `Le quorum n'étant pas atteint (${totalPresents} présents sur ${compositionMax} membres, ${quorumRequis} requis), la séance ne peut valablement délibérer.`

    // Sort ODJ points
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const odjPoints = [...(seance.odj_points || [])] as any[]
    odjPoints.sort((a: { position: number }, b: { position: number }) => a.position - b.position)

    // Build points with votes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const votes = (seance.votes || []) as any[]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allMembers = convocataires.map((c: any) => c.member).filter(Boolean)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const points = odjPoints.map((point: any) => {
      const vote = votes.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (v: any) => v.odj_point_id === point.id && v.statut === 'CLOS'
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rapporteur = point.rapporteur_id ? allMembers.find((m: any) => m.id === point.rapporteur_id) : null

      return {
        position: point.position,
        titre: point.titre,
        type: point.type_traitement || 'DELIBERATION',
        description: point.description,
        rapporteur: rapporteur ? `${rapporteur.prenom} ${rapporteur.nom}` : null,
        projetDeliberation: point.projet_deliberation,
        vu: point.vu || '',
        considerant: point.considerant || '',
        discussion: point.discussion || '',
        articles: (point.articles as string[] | null) || [],
        vote: vote ? {
          resultat: vote.resultat,
          pour: vote.pour || 0,
          contre: vote.contre || 0,
          abstentions: vote.abstention || 0,
          totalVotants: vote.total_votants || 0,
          nomsContre: vote.noms_contre || [],
          nomsAbstention: vote.noms_abstention || [],
          formulePV: vote.formule_pv,
        } : null,
      }
    })

    // Build PV content structure
    const contenu: PVContenu = {
      entete: {
        institution: institution?.nom_officiel || 'Institution',
        typeInstance: (seance.instance_config as { type_legal: string } | null)?.type_legal || '',
        nomInstance: (seance.instance_config as { nom: string } | null)?.nom || '',
        dateSeance: dateStr,
        heureOuverture: formatTime(seance.heure_ouverture),
        heureCloture: formatTime(seance.heure_cloture),
        lieu: seance.lieu,
        mode: seance.mode || 'PRESENTIEL',
        publique: seance.publique ?? true,
        reconvocation: seance.reconvocation ?? false,
      },
      presences: {
        presents,
        excuses,
        absents,
        procurations: procsList,
        quorum: {
          atteint: quorumAtteint,
          presents: totalPresents,
          requis: quorumRequis,
        },
        quorumStatement,
      },
      bureau: {
        president: seance.president_effectif
          ? `${seance.president_effectif.prenom} ${seance.president_effectif.nom}`
          : null,
        secretaire: seance.secretaire_seance
          ? `${seance.secretaire_seance.prenom} ${seance.secretaire_seance.nom}`
          : null,
      },
      points,
      cloture: {
        heure: formatTime(seance.heure_cloture),
        texte: `L'ordre du jour étant épuisé, ${presidentNom} lève la séance à ${formatTime(seance.heure_cloture) || '...'}.`,
      },
      introductionLibre: '',
      conclusionLibre: '',
    }

    // Upsert PV record
    const { data: existingPV } = await supabase
      .from('pv')
      .select('id, version')
      .eq('seance_id', seanceId)
      .maybeSingle()

    let pvId: string

    if (existingPV) {
      // Update existing
      const { error: updateError } = await supabase
        .from('pv')
        .update({
          contenu_json: contenu as unknown as Json,
          version: (existingPV.version || 1) + 1,
        })
        .eq('id', existingPV.id)

      if (updateError) return { error: `Erreur mise à jour PV : ${updateError.message}` }
      pvId = existingPV.id
    } else {
      // Create new
      const { data: newPV, error: insertError } = await supabase
        .from('pv')
        .insert({
          seance_id: seanceId,
          contenu_json: contenu as unknown as Json,
          statut: 'BROUILLON' as const,
        })
        .select('id')
        .single()

      if (insertError) return { error: `Erreur création PV : ${insertError.message}` }
      pvId = newPV.id
    }

    revalidatePath(`/seances/${seanceId}/pv`)
    return { success: true, pvId, contenu }
  } catch (err) {
    console.error('generatePVBrouillon error:', err)
    return { error: 'Erreur inattendue lors de la génération du PV' }
  }
}

// ─── Save PV content ─────────────────────────────────────────────────────────

export async function savePVContent(
  pvId: string,
  contenu: PVContenu,
  seanceId: string
): Promise<ActionResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    const role = (user.user_metadata?.role as string) || ''
    if (!['super_admin', 'gestionnaire'].includes(role)) {
      return { error: 'Permissions insuffisantes' }
    }

    const { error } = await supabase
      .from('pv')
      .update({
        contenu_json: contenu as unknown as Json,
      })
      .eq('id', pvId)

    if (error) return { error: `Erreur sauvegarde : ${error.message}` }

    revalidatePath(`/seances/${seanceId}/pv`)
    return { success: true }
  } catch (err) {
    console.error('savePVContent error:', err)
    return { error: 'Erreur inattendue' }
  }
}

// ─── Get PV for seance ───────────────────────────────────────────────────────

export async function getPV(seanceId: string) {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    const { data, error } = await supabase
      .from('pv')
      .select('*')
      .eq('seance_id', seanceId)
      .maybeSingle()

    if (error) return { error: error.message }
    return { data }
  } catch (err) {
    console.error('getPV error:', err)
    return { error: 'Erreur inattendue' }
  }
}

// ─── Update PV status (workflow transitions) ─────────────────────────────────

const VALID_TRANSITIONS: Record<string, string[]> = {
  BROUILLON: ['EN_RELECTURE'],
  EN_RELECTURE: ['BROUILLON', 'SIGNE'],
  SIGNE: ['PUBLIE'],
}

export async function updatePVStatus(
  pvId: string,
  newStatus: string,
  seanceId: string
): Promise<ActionResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    const role = (user.user_metadata?.role as string) || ''
    if (!['super_admin', 'gestionnaire'].includes(role)) {
      return { error: 'Permissions insuffisantes' }
    }

    // Fetch current PV
    const { data: pv, error: pvError } = await supabase
      .from('pv')
      .select('id, statut, contenu_json, signe_par')
      .eq('id', pvId)
      .single()

    if (pvError || !pv) return { error: 'Procès-verbal introuvable' }

    const currentStatus = pv.statut || 'BROUILLON'
    const allowed = VALID_TRANSITIONS[currentStatus] || []

    if (!allowed.includes(newStatus)) {
      return { error: `Transition invalide : impossible de passer de « ${currentStatus} » à « ${newStatus} »` }
    }

    // Validate transition-specific requirements
    if (currentStatus === 'BROUILLON' && newStatus === 'EN_RELECTURE') {
      const contenu = pv.contenu_json as unknown as PVContenu | null
      if (!contenu?.points || contenu.points.length === 0) {
        return { error: 'Le PV doit contenir au moins un point à l\'ordre du jour avant de passer en relecture' }
      }
    }

    if (currentStatus === 'EN_RELECTURE' && newStatus === 'SIGNE') {
      const signatures = (pv.signe_par as unknown as PVSignatureRecord[] | null) || []
      const hasPresident = signatures.some(s => s.role === 'president')
      const hasSecretaire = signatures.some(s => s.role === 'secretaire')
      if (!hasPresident || !hasSecretaire) {
        return { error: 'Les signatures du président et du secrétaire sont requises avant de passer au statut « Signé »' }
      }
    }

    // Update status
    const { error: updateError } = await supabase
      .from('pv')
      .update({ statut: newStatus as 'BROUILLON' | 'EN_RELECTURE' | 'SIGNE' | 'PUBLIE' })
      .eq('id', pvId)

    if (updateError) return { error: `Erreur mise à jour du statut : ${updateError.message}` }

    revalidatePath(`/seances/${seanceId}/pv`)
    return { success: true }
  } catch (err) {
    console.error('updatePVStatus error:', err)
    return { error: 'Erreur inattendue lors de la mise à jour du statut' }
  }
}

// ─── Sign PV (president or secretary) ────────────────────────────────────────

export async function signPV(
  pvId: string,
  seanceId: string
): Promise<{ success: true; bothSigned: boolean } | { error: string }> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    // Find the member record for the current user
    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('id, prenom, nom, user_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (memberError || !member) {
      return { error: 'Aucun membre associé à votre compte utilisateur' }
    }

    // Load seance to check president/secretary
    const { data: seance, error: seanceError } = await supabase
      .from('seances')
      .select('id, president_effectif_seance_id, secretaire_seance_id')
      .eq('id', seanceId)
      .single()

    if (seanceError || !seance) return { error: 'Séance introuvable' }

    // Determine role
    let sigRole: 'president' | 'secretaire' | null = null
    if (seance.president_effectif_seance_id === member.id) {
      sigRole = 'president'
    } else if (seance.secretaire_seance_id === member.id) {
      sigRole = 'secretaire'
    }

    if (!sigRole) {
      return { error: 'Vous n\'êtes ni le président ni le secrétaire de cette séance. Seuls le président et le secrétaire peuvent signer le procès-verbal.' }
    }

    // Load current PV
    const { data: pv, error: pvError } = await supabase
      .from('pv')
      .select('id, statut, signe_par, contenu_json')
      .eq('id', pvId)
      .single()

    if (pvError || !pv) return { error: 'Procès-verbal introuvable' }

    if (pv.statut !== 'EN_RELECTURE') {
      return { error: 'Le procès-verbal doit être en relecture pour pouvoir être signé' }
    }

    // Check if already signed with this role
    const existingSignatures = (pv.signe_par as unknown as PVSignatureRecord[] | null) || []
    if (existingSignatures.some(s => s.role === sigRole)) {
      return { error: `Le procès-verbal a déjà été signé par le ${sigRole === 'president' ? 'président' : 'secrétaire'}` }
    }

    // Build new signature record
    const newSignature: PVSignatureRecord = {
      user_id: user.id,
      member_id: member.id,
      nom: member.nom,
      prenom: member.prenom,
      role: sigRole,
      timestamp: new Date().toISOString(),
    }

    const updatedSignatures = [...existingSignatures, newSignature]

    // Check if both signatures are now present
    const hasPresident = updatedSignatures.some(s => s.role === 'president')
    const hasSecretaire = updatedSignatures.some(s => s.role === 'secretaire')
    const bothSigned = hasPresident && hasSecretaire

    // Build update payload — use raw SQL for columns not in generated types
    // Since signe_president_at and signe_secretaire_at are not in the generated types,
    // we use an RPC-style approach via raw update
    if (bothSigned) {
      // Both signed: compute hash and set status to SIGNE
      const hashIntegrite = createHash('sha256')
        .update(JSON.stringify(pv.contenu_json))
        .digest('hex')

      const timestampCol = sigRole === 'president' ? 'signe_president_at' : 'signe_secretaire_at'

      // Use raw SQL to update columns not in generated types
      const { error: updateError } = await supabase.rpc('exec_sql' as never, {
        query: `
          UPDATE pv SET
            signe_par = $1::jsonb,
            ${timestampCol} = NOW(),
            hash_integrite = $2,
            statut = 'SIGNE'
          WHERE id = $3
        `,
        params: [JSON.stringify(updatedSignatures), hashIntegrite, pvId],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)

      // Fallback: if RPC not available, use standard update + separate raw query
      if (updateError) {
        // Standard update for typed columns
        const { error: stdError } = await supabase
          .from('pv')
          .update({
            signe_par: updatedSignatures as unknown as Json,
            statut: 'SIGNE',
          })
          .eq('id', pvId)

        if (stdError) return { error: `Erreur lors de la signature : ${stdError.message}` }

        // Update non-typed columns via raw SQL
        await supabase.from('pv').update({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          [timestampCol]: new Date().toISOString() as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          hash_integrite: hashIntegrite as any,
        } as Record<string, unknown>).eq('id', pvId)
      }
    } else {
      // Single signature: update signe_par and the timestamp column
      const timestampCol = sigRole === 'president' ? 'signe_president_at' : 'signe_secretaire_at'

      const { error: updateError } = await supabase
        .from('pv')
        .update({
          signe_par: updatedSignatures as unknown as Json,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          [timestampCol]: new Date().toISOString() as any,
        } as Record<string, unknown>)
        .eq('id', pvId)

      if (updateError) return { error: `Erreur lors de la signature : ${updateError.message}` }
    }

    revalidatePath(`/seances/${seanceId}/pv`)
    return { success: true, bothSigned }
  } catch (err) {
    console.error('signPV error:', err)
    return { error: 'Erreur inattendue lors de la signature du procès-verbal' }
  }
}

// ─── Add PV comment ──────────────────────────────────────────────────────────

export async function addPVComment(
  pvId: string,
  sectionKey: string,
  contenu: string
): Promise<{ success: true; commentId: string } | { error: string }> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    if (!contenu.trim()) {
      return { error: 'Le commentaire ne peut pas être vide' }
    }

    if (!sectionKey.trim()) {
      return { error: 'La section du commentaire doit être précisée' }
    }

    // Insert comment via raw SQL since pv_comments is not in generated types
    const { data, error } = await supabase
      .from('pv_comments' as never)
      .insert({
        pv_id: pvId,
        user_id: user.id,
        section_key: sectionKey,
        contenu: contenu.trim(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .select('id')
      .single()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (error) return { error: `Erreur lors de l'ajout du commentaire : ${(error as any).message}` }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { success: true, commentId: (data as any).id }
  } catch (err) {
    console.error('addPVComment error:', err)
    return { error: 'Erreur inattendue lors de l\'ajout du commentaire' }
  }
}

// ─── Resolve PV comment ──────────────────────────────────────────────────────

export async function resolvePVComment(
  commentId: string
): Promise<ActionResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    const { error } = await supabase
      .from('pv_comments' as never)
      .update({ resolu: true } as never)
      .eq('id' as never, commentId as never)

    if (error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { error: `Erreur lors de la résolution du commentaire : ${(error as any).message}` }
    }

    return { success: true }
  } catch (err) {
    console.error('resolvePVComment error:', err)
    return { error: 'Erreur inattendue lors de la résolution du commentaire' }
  }
}

// ─── Get PV with comments ────────────────────────────────────────────────────

export async function getPVWithComments(seanceId: string): Promise<
  { data: { pv: Record<string, unknown>; comments: PVComment[] } } | { error: string }
> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    // Fetch PV
    const { data: pv, error: pvError } = await supabase
      .from('pv')
      .select('*')
      .eq('seance_id', seanceId)
      .maybeSingle()

    if (pvError) return { error: pvError.message }
    if (!pv) return { error: 'Aucun procès-verbal trouvé pour cette séance' }

    // Fetch comments
    const { data: comments, error: commentsError } = await supabase
      .from('pv_comments' as never)
      .select('*' as never)
      .eq('pv_id' as never, pv.id as never)
      .order('created_at' as never, { ascending: true } as never)

    if (commentsError) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { error: `Erreur chargement des commentaires : ${(commentsError as any).message}` }
    }

    return {
      data: {
        pv: pv as unknown as Record<string, unknown>,
        comments: (comments || []) as unknown as PVComment[],
      },
    }
  } catch (err) {
    console.error('getPVWithComments error:', err)
    return { error: 'Erreur inattendue' }
  }
}
