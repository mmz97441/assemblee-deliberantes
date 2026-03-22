'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { determineVoteResult, generateFormulePV, type MajoriteRequise } from '@/lib/validators/vote-result'

// ─── Types ───────────────────────────────────────────────────────────────────

type ActionResult = { success: true } | { error: string }

type OpenVoteResult =
  | { success: true; voteId: string; totalVotants: number }
  | { error: string }

type CloseVoteResult =
  | { success: true; resultat: string; formulePV: string }
  | { error: string }

// ─── Auth helper ─────────────────────────────────────────────────────────────

async function getAuthenticatedUser() {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    return { user: null, supabase }
  }
  return { user: data.user, supabase }
}

// ─── Server Actions ──────────────────────────────────────────────────────────

/**
 * Opens a new vote on an ODJ point.
 * Records quorum snapshot at open time (CDC requirement).
 */
export async function openVote(
  seanceId: string,
  odjPointId: string
): Promise<OpenVoteResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    const role = (user.user_metadata?.role as string) || ''
    if (!['super_admin', 'gestionnaire'].includes(role)) {
      return { error: 'Seul le gestionnaire peut ouvrir un vote' }
    }

    // Verify seance is EN_COURS
    const { data: seance } = await supabase
      .from('seances')
      .select('id, statut, instance_id')
      .eq('id', seanceId)
      .single()

    if (!seance) return { error: 'Séance introuvable' }
    if (seance.statut !== 'EN_COURS') {
      return { error: 'La séance doit être en cours pour ouvrir un vote' }
    }

    // Get instance config for voix_preponderante
    const { data: instanceConfig } = await supabase
      .from('instance_config')
      .select('voix_preponderante')
      .eq('id', seance.instance_id)
      .single()

    // Verify ODJ point allows voting
    const { data: point } = await supabase
      .from('odj_points')
      .select('id, titre, votes_interdits, type_traitement')
      .eq('id', odjPointId)
      .single()

    if (!point) return { error: 'Point ODJ introuvable' }
    if (point.votes_interdits) {
      return { error: 'Ce point est de type information — le vote est interdit' }
    }

    // Check no other vote is currently OUVERT for this seance
    const { data: openVotes } = await supabase
      .from('votes')
      .select('id')
      .eq('seance_id', seanceId)
      .eq('statut', 'OUVERT')

    if (openVotes && openVotes.length > 0) {
      return { error: 'Un vote est déjà en cours sur cette séance. Clôturez-le d\'abord.' }
    }

    // Calculate quorum snapshot: PRESENT + PROCURATION (without departed members)
    const { data: presences } = await supabase
      .from('presences')
      .select('id, member_id, statut, heure_depart')
      .eq('seance_id', seanceId)

    const activePresences = (presences || []).filter(
      p => (p.statut === 'PRESENT' || p.statut === 'PROCURATION') && !p.heure_depart
    )
    const totalVotants = activePresences.length

    if (totalVotants === 0) {
      return { error: 'Aucun membre présent — impossible d\'ouvrir un vote' }
    }

    // Create the vote
    const { data: vote, error: insertError } = await supabase
      .from('votes')
      .insert({
        seance_id: seanceId,
        odj_point_id: odjPointId,
        type_vote: 'MAIN_LEVEE' as const,
        statut: 'OUVERT' as const,
        total_votants: totalVotants,
        quorum_a_ouverture: totalVotants,
        voix_preponderante_activee: instanceConfig?.voix_preponderante ?? false,
        question: point.titre,
        ouvert_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (insertError) return { error: `Erreur création vote : ${insertError.message}` }

    revalidatePath(`/seances/${seanceId}/en-cours`)
    return { success: true, voteId: vote.id, totalVotants }
  } catch (err) {
    console.error('openVote error:', err)
    return { error: 'Erreur inattendue lors de l\'ouverture du vote' }
  }
}

/**
 * Closes a main levée vote with results.
 * The gestionnaire enters ONLY contre + abstentions.
 * Pour is calculated server-side.
 */
export async function closeVoteMainLevee(
  voteId: string,
  data: {
    contre: number
    abstentions: number
    nomsContre: string[]
    nomsAbstention: string[]
  }
): Promise<CloseVoteResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    const role = (user.user_metadata?.role as string) || ''
    if (!['super_admin', 'gestionnaire'].includes(role)) {
      return { error: 'Seul le gestionnaire peut clore un vote' }
    }

    // Fetch the open vote
    const { data: vote } = await supabase
      .from('votes')
      .select('id, seance_id, odj_point_id, statut, type_vote, total_votants, voix_preponderante_activee, question')
      .eq('id', voteId)
      .single()

    if (!vote) return { error: 'Vote introuvable' }
    if (vote.statut !== 'OUVERT') return { error: 'Ce vote n\'est pas ouvert' }
    if (vote.type_vote !== 'MAIN_LEVEE') return { error: 'Ce n\'est pas un vote à main levée' }

    const totalVotants = vote.total_votants || 0
    const { contre, abstentions, nomsContre, nomsAbstention } = data

    // Validation
    if (contre < 0 || abstentions < 0) {
      return { error: 'Les compteurs ne peuvent pas être négatifs' }
    }
    if (contre + abstentions > totalVotants) {
      return { error: `Le total des contre (${contre}) + abstentions (${abstentions}) dépasse le nombre de votants (${totalVotants})` }
    }

    // Calculate pour
    const pour = totalVotants - contre - abstentions

    // Get ODJ point for majorite_requise
    const { data: point } = await supabase
      .from('odj_points')
      .select('majorite_requise, titre')
      .eq('id', vote.odj_point_id)
      .single()

    const majoriteRequise = (point?.majorite_requise || 'SIMPLE') as MajoriteRequise

    // Determine result
    const resultat = determineVoteResult(
      pour,
      contre,
      abstentions,
      totalVotants,
      majoriteRequise,
      vote.voix_preponderante_activee ?? false
    )

    // Generate PV formula
    const formulePV = generateFormulePV({
      pour,
      contre,
      abstention: abstentions,
      totalVotants,
      resultat,
      nomsContre,
      nomsAbstention,
      titrePoint: point?.titre || vote.question || '',
    })

    // Close the vote
    const { error: updateError } = await supabase
      .from('votes')
      .update({
        statut: 'CLOS' as const,
        pour,
        contre,
        abstention: abstentions,
        resultat: resultat as 'ADOPTE' | 'REJETE' | 'NUL' | 'ADOPTE_UNANIMITE' | 'ADOPTE_VOIX_PREPONDERANTE',
        formule_pv: formulePV,
        noms_contre: nomsContre,
        noms_abstention: nomsAbstention,
        clos_at: new Date().toISOString(),
      })
      .eq('id', voteId)

    if (updateError) return { error: `Erreur clôture : ${updateError.message}` }

    // Mark the ODJ point as treated
    await supabase
      .from('odj_points')
      .update({ statut: 'TRAITE' })
      .eq('id', vote.odj_point_id)

    revalidatePath(`/seances/${vote.seance_id}/en-cours`)
    revalidatePath(`/seances/${vote.seance_id}`)
    return { success: true, resultat, formulePV }
  } catch (err) {
    console.error('closeVoteMainLevee error:', err)
    return { error: 'Erreur inattendue lors de la clôture du vote' }
  }
}

/**
 * Shortcut: close vote as unanimité (contre=0, abstentions=0)
 */
export async function closeVoteUnanimite(voteId: string): Promise<CloseVoteResult> {
  return closeVoteMainLevee(voteId, {
    contre: 0,
    abstentions: 0,
    nomsContre: [],
    nomsAbstention: [],
  })
}

/**
 * Cancels an open vote.
 */
export async function cancelVote(voteId: string): Promise<ActionResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    const role = (user.user_metadata?.role as string) || ''
    if (!['super_admin', 'gestionnaire'].includes(role)) {
      return { error: 'Permissions insuffisantes' }
    }

    const { data: vote } = await supabase
      .from('votes')
      .select('id, statut, seance_id')
      .eq('id', voteId)
      .single()

    if (!vote) return { error: 'Vote introuvable' }
    if (vote.statut !== 'OUVERT') return { error: 'Seul un vote ouvert peut être annulé' }

    const { error: updateError } = await supabase
      .from('votes')
      .update({
        statut: 'ANNULE' as const,
        clos_at: new Date().toISOString(),
      })
      .eq('id', voteId)

    if (updateError) return { error: `Erreur : ${updateError.message}` }

    revalidatePath(`/seances/${vote.seance_id}/en-cours`)
    return { success: true }
  } catch (err) {
    console.error('cancelVote error:', err)
    return { error: 'Erreur inattendue' }
  }
}

/**
 * Get all votes for a seance.
 */
export async function getVotesForSeance(seanceId: string) {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    const { data, error } = await supabase
      .from('votes')
      .select('*')
      .eq('seance_id', seanceId)
      .order('ouvert_at', { ascending: true })

    if (error) return { error: error.message }
    return { data: data || [] }
  } catch (err) {
    console.error('getVotesForSeance error:', err)
    return { error: 'Erreur inattendue' }
  }
}
