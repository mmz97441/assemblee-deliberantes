'use server'

import { revalidatePath } from 'next/cache'
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
        odj_points (*),
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
          atteint: totalPresents >= quorumRequis,
          presents: totalPresents,
          requis: quorumRequis,
        },
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
        texte: `L'ordre du jour étant épuisé, ${seance.president_effectif ? `${seance.president_effectif.prenom} ${seance.president_effectif.nom}` : 'le Président'} lève la séance à ${formatTime(seance.heure_cloture) || '...'}.`,
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
