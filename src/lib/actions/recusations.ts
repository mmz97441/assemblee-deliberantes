'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// ─── Types ───────────────────────────────────────────────────────────────────

type ActionResult = { success: true } | { error: string }

export interface RecusationInfo {
  id: string
  seance_id: string
  odj_point_id: string
  member_id: string
  motif: string | null
  declare_par: string
  horodatage: string
  member?: {
    id: string
    prenom: string
    nom: string
  }
}

// ─── Auth helper ─────────────────────────────────────────────────────────────

async function getAuthenticatedUser() {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    return { user: null, supabase }
  }
  return { user: data.user, supabase }
}

// ─── Récusation Server Actions ───────────────────────────────────────────────

/**
 * Creates a recusation (conflict of interest declaration) for a member on a specific ODJ point.
 * Can be triggered by the élu themselves or by the gestionnaire.
 */
export async function recuseFromPoint(
  seanceId: string,
  odjPointId: string,
  memberId: string,
  motif?: string,
  declarePar: 'ELU' | 'GESTIONNAIRE' = 'ELU'
): Promise<ActionResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    // M1: Role validation for recusation
    const role = (user.user_metadata?.role as string) || ''
    if (declarePar === 'GESTIONNAIRE' && !['super_admin', 'gestionnaire'].includes(role)) {
      return { error: 'Seul le gestionnaire peut déclarer une récusation pour un autre membre' }
    }
    if (declarePar === 'ELU') {
      // Verify the memberId matches the auth user's member record
      const { data: memberRecord } = await supabase
        .from('members')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()
      if (!memberRecord || memberRecord.id !== memberId) {
        return { error: 'Vous ne pouvez déclarer une récusation que pour vous-même' }
      }
    }

    // Verify seance exists
    const { data: seance } = await supabase
      .from('seances')
      .select('id, statut')
      .eq('id', seanceId)
      .single()

    if (!seance) return { error: 'Séance introuvable' }

    // Verify the ODJ point exists and belongs to this seance
    const { data: point } = await supabase
      .from('odj_points')
      .select('id, seance_id')
      .eq('id', odjPointId)
      .eq('seance_id', seanceId)
      .single()

    if (!point) return { error: 'Point de l\'ordre du jour introuvable' }

    // Check that no vote is already open or closed for this point
    const { data: existingVote } = await supabase
      .from('votes')
      .select('id, statut')
      .eq('odj_point_id', odjPointId)
      .in('statut', ['OUVERT', 'CLOS'])
      .maybeSingle()

    if (existingVote) {
      return { error: 'Impossible de se récuser : un vote est déjà en cours ou clos pour ce point' }
    }

    // Verify the member exists
    const { data: member } = await supabase
      .from('members')
      .select('id')
      .eq('id', memberId)
      .single()

    if (!member) return { error: 'Membre introuvable' }

    // Insert recusation
    const { error: insertError } = await supabase
      .from('recusations')
      .insert({
        seance_id: seanceId,
        odj_point_id: odjPointId,
        member_id: memberId,
        motif: motif?.trim() || null,
        declare_par: declarePar,
        declared_by: user.id,
      })

    if (insertError) {
      if (insertError.code === '23505') {
        return { error: 'Ce membre est déjà récusé pour ce point' }
      }
      return { error: `Erreur lors de la récusation : ${insertError.message}` }
    }

    revalidatePath(`/seances/${seanceId}/en-cours`)
    return { success: true }
  } catch (err) {
    console.error('recuseFromPoint error:', err)
    return { error: 'Erreur inattendue lors de la récusation' }
  }
}

/**
 * Cancels a recusation. Only allowed before a vote is opened on this point.
 */
export async function cancelRecusation(
  recusationId: string,
  seanceId: string
): Promise<ActionResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    // Fetch the recusation to get the ODJ point and member
    const { data: recusation } = await supabase
      .from('recusations')
      .select('id, odj_point_id, member_id, declared_by')
      .eq('id', recusationId)
      .single()

    if (!recusation) return { error: 'Récusation introuvable' }

    // M2: Require gestionnaire role OR the member who created the recusation
    const cancelRole = (user.user_metadata?.role as string) || ''
    const isGestionnaire = ['super_admin', 'gestionnaire'].includes(cancelRole)
    if (!isGestionnaire && recusation.declared_by !== user.id) {
      return { error: 'Seul le gestionnaire ou le membre concerné peut annuler cette récusation' }
    }

    // Check no vote has started on this point
    const { data: existingVote } = await supabase
      .from('votes')
      .select('id, statut')
      .eq('odj_point_id', recusation.odj_point_id)
      .in('statut', ['OUVERT', 'CLOS'])
      .maybeSingle()

    if (existingVote) {
      return { error: 'Impossible d\'annuler : un vote est déjà en cours ou clos pour ce point' }
    }

    // Delete the recusation
    const { error: deleteError } = await supabase
      .from('recusations')
      .delete()
      .eq('id', recusationId)

    if (deleteError) return { error: `Erreur : ${deleteError.message}` }

    revalidatePath(`/seances/${seanceId}/en-cours`)
    return { success: true }
  } catch (err) {
    console.error('cancelRecusation error:', err)
    return { error: 'Erreur inattendue' }
  }
}

/**
 * Returns all recusations for a specific ODJ point.
 */
export async function getRecusationsForPoint(
  seanceId: string,
  odjPointId: string
): Promise<{ data: RecusationInfo[] } | { error: string }> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    const { data, error } = await supabase
      .from('recusations')
      .select(`
        id,
        seance_id,
        odj_point_id,
        member_id,
        motif,
        declare_par,
        horodatage,
        member:members (id, prenom, nom)
      `)
      .eq('seance_id', seanceId)
      .eq('odj_point_id', odjPointId)

    if (error) return { error: error.message }

    return { data: (data || []) as unknown as RecusationInfo[] }
  } catch (err) {
    console.error('getRecusationsForPoint error:', err)
    return { error: 'Erreur inattendue' }
  }
}

/**
 * Returns all recusations for a seance (all points).
 */
export async function getRecusationsForSeance(
  seanceId: string
): Promise<{ data: RecusationInfo[] } | { error: string }> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    const { data, error } = await supabase
      .from('recusations')
      .select(`
        id,
        seance_id,
        odj_point_id,
        member_id,
        motif,
        declare_par,
        horodatage,
        member:members (id, prenom, nom)
      `)
      .eq('seance_id', seanceId)

    if (error) return { error: error.message }

    return { data: (data || []) as unknown as RecusationInfo[] }
  } catch (err) {
    console.error('getRecusationsForSeance error:', err)
    return { error: 'Erreur inattendue' }
  }
}

/**
 * Quick check: is a specific member recused for a specific point?
 */
export async function isRecused(
  seanceId: string,
  odjPointId: string,
  memberId: string
): Promise<{ recused: boolean } | { error: string }> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    const { data } = await supabase
      .from('recusations')
      .select('id')
      .eq('seance_id', seanceId)
      .eq('odj_point_id', odjPointId)
      .eq('member_id', memberId)
      .maybeSingle()

    return { recused: !!data }
  } catch (err) {
    console.error('isRecused error:', err)
    return { error: 'Erreur inattendue' }
  }
}

// ─── Huis Clos Server Actions ────────────────────────────────────────────────

/**
 * Activates huis clos on an ODJ point.
 * The gestionnaire should first hold a vote to approve the huis clos.
 */
export async function activateHuisClos(
  seanceId: string,
  odjPointId: string
): Promise<ActionResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    const role = (user.user_metadata?.role as string) || ''
    if (!['super_admin', 'gestionnaire'].includes(role)) {
      return { error: 'Seul le gestionnaire peut activer le huis clos' }
    }

    // Verify seance is EN_COURS
    const { data: seance } = await supabase
      .from('seances')
      .select('id, statut')
      .eq('id', seanceId)
      .single()

    if (!seance) return { error: 'Séance introuvable' }
    if (seance.statut !== 'EN_COURS') {
      return { error: 'La séance doit être en cours pour activer le huis clos' }
    }

    // Verify point belongs to this seance
    const { data: point } = await supabase
      .from('odj_points')
      .select('id')
      .eq('id', odjPointId)
      .eq('seance_id', seanceId)
      .single()

    if (!point) return { error: 'Point de l\'ordre du jour introuvable' }

    // Activate huis clos
    const { error: updateError } = await supabase
      .from('odj_points')
      .update({ huis_clos_active: true })
      .eq('id', odjPointId)

    if (updateError) return { error: `Erreur : ${updateError.message}` }

    revalidatePath(`/seances/${seanceId}/en-cours`)
    return { success: true }
  } catch (err) {
    console.error('activateHuisClos error:', err)
    return { error: 'Erreur inattendue lors de l\'activation du huis clos' }
  }
}

/**
 * Deactivates huis clos on an ODJ point — resumes public session.
 */
export async function deactivateHuisClos(
  seanceId: string,
  odjPointId: string
): Promise<ActionResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    const role = (user.user_metadata?.role as string) || ''
    if (!['super_admin', 'gestionnaire'].includes(role)) {
      return { error: 'Seul le gestionnaire peut désactiver le huis clos' }
    }

    const { error: updateError } = await supabase
      .from('odj_points')
      .update({ huis_clos_active: false })
      .eq('id', odjPointId)

    if (updateError) return { error: `Erreur : ${updateError.message}` }

    revalidatePath(`/seances/${seanceId}/en-cours`)
    return { success: true }
  } catch (err) {
    console.error('deactivateHuisClos error:', err)
    return { error: 'Erreur inattendue lors de la désactivation du huis clos' }
  }
}
