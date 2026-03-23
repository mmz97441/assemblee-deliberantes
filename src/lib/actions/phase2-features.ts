'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'

type ActionResult = { success: true } | { error: string }

async function getAuthenticatedUser() {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    return { user: null, supabase }
  }
  return { user: data.user, supabase }
}

function requireRole(user: { user_metadata?: Record<string, unknown> } | null, roles: string[]): string | null {
  if (!user) return 'Non authentifié'
  const role = (user.user_metadata?.role as string) || ''
  if (!roles.includes(role)) return 'Permissions insuffisantes'
  return null
}

// ─── PART 1: Arrivée tardive ────────────────────────────────────────────────

export type LateArrivalHandlerResult =
  | { success: true; mode: 'STRICT' | 'SOUPLE' | 'SUSPENDU'; message: string }
  | { error: string }

/**
 * Handles a late arrival during an active séance.
 * Checks the instance config mode_arrivee_tardive and acts accordingly.
 */
export async function handleLateArrival(
  seanceId: string,
  memberId: string
): Promise<LateArrivalHandlerResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    const roleError = requireRole(user, ['super_admin', 'gestionnaire'])
    if (roleError) return { error: roleError }

    // Get séance with instance config
    const { data: seance, error: seanceError } = await supabase
      .from('seances')
      .select(`
        id,
        statut,
        instance_id,
        late_arrival_mode,
        instance_config (
          id,
          mode_arrivee_tardive
        )
      `)
      .eq('id', seanceId)
      .single()

    if (seanceError || !seance) return { error: 'Séance introuvable' }
    if (seance.statut !== 'EN_COURS') return { error: 'La séance n\'est pas en cours' }

    // Determine late arrival mode (séance override or instance config)
    const instanceConfig = seance.instance_config as { mode_arrivee_tardive: string | null } | null
    const mode = (seance.late_arrival_mode || instanceConfig?.mode_arrivee_tardive || 'SOUPLE') as 'STRICT' | 'SOUPLE' | 'SUSPENDU'

    // Get member name for message
    const { data: member } = await supabase
      .from('members')
      .select('prenom, nom')
      .eq('id', memberId)
      .single()

    const memberName = member ? `${member.prenom} ${member.nom}` : 'Ce membre'

    // Record the presence with arrivee_tardive flag
    const { error: presenceError } = await supabase
      .from('presences')
      .upsert(
        {
          seance_id: seanceId,
          member_id: memberId,
          statut: 'PRESENT' as const,
          heure_arrivee: new Date().toISOString(),
          mode_authentification: 'ASSISTE' as const,
          arrivee_tardive: true,
        },
        { onConflict: 'seance_id,member_id' }
      )

    if (presenceError) return { error: `Erreur : ${presenceError.message}` }

    // If SUSPENDU mode, auto-suspend the séance
    if (mode === 'SUSPENDU') {
      const { error: suspendError } = await supabase
        .from('seances')
        .update({ statut: 'SUSPENDUE' })
        .eq('id', seanceId)

      if (suspendError) return { error: `Erreur suspension : ${suspendError.message}` }
    }

    // Build message based on mode
    let message: string
    switch (mode) {
      case 'STRICT':
        message = `${memberName} est arrivé(e) en retard (mode STRICT). Présence enregistrée mais ne pourra participer aux votes en cours.`
        break
      case 'SOUPLE':
        message = `${memberName} est arrivé(e) — Présence enregistrée. Quorum mis à jour.`
        break
      case 'SUSPENDU':
        message = `${memberName} est arrivé(e). La séance est suspendue. Voulez-vous reprendre ?`
        break
    }

    revalidatePath(`/seances/${seanceId}`)
    revalidatePath(`/seances/${seanceId}/en-cours`)
    return { success: true, mode, message }
  } catch (err) {
    console.error('handleLateArrival error:', err)
    return { error: 'Erreur inattendue' }
  }
}

// ─── PART 2: Désignation du secrétaire de séance ────────────────────────────

/**
 * Designates a secretary for the session.
 * mode: 'DIRECT' = president designates directly, 'VOTE' = formal vote
 */
export async function designateSecretary(
  seanceId: string,
  memberId: string,
  mode: 'DIRECT' | 'VOTE'
): Promise<ActionResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    const roleError = requireRole(user, ['super_admin', 'gestionnaire', 'president'])
    if (roleError) return { error: roleError }

    if (!seanceId || !memberId) {
      return { error: 'Paramètres manquants' }
    }

    // Verify séance exists
    const { data: seance, error: seanceError } = await supabase
      .from('seances')
      .select('id, statut')
      .eq('id', seanceId)
      .single()

    if (seanceError || !seance) return { error: 'Séance introuvable' }

    // Verify member is a convocataire of this séance
    const { data: convocataire } = await supabase
      .from('convocataires')
      .select('id')
      .eq('seance_id', seanceId)
      .eq('member_id', memberId)
      .maybeSingle()

    if (!convocataire) {
      return { error: 'Ce membre n\'est pas convoqué pour cette séance' }
    }

    // Update séance
    const { error: updateError } = await supabase
      .from('seances')
      .update({
        secretaire_seance_id: memberId,
        secretaire_designation_mode: mode,
      })
      .eq('id', seanceId)

    if (updateError) return { error: `Erreur : ${updateError.message}` }

    // Log in audit
    const { data: member } = await supabase
      .from('members')
      .select('prenom, nom')
      .eq('id', memberId)
      .single()

    const memberName = member ? `${member.prenom} ${member.nom}` : memberId

    await supabase.from('audit_log').insert({
      action: 'DESIGNATE_SECRETARY',
      table_name: 'seances',
      record_id: seanceId,
      new_values: {
        member_id: memberId,
        member_name: memberName,
        mode,
        designation_mode_label: mode === 'DIRECT'
          ? 'Désignation directe par le/la Président(e)'
          : 'Désignation par vote',
      },
      user_id: user?.id,
    })

    revalidatePath(`/seances/${seanceId}`)
    revalidatePath(`/seances/${seanceId}/en-cours`)
    return { success: true }
  } catch (err) {
    console.error('designateSecretary error:', err)
    return { error: 'Erreur inattendue' }
  }
}

// ─── PART 3: Approbation PV en séance ───────────────────────────────────────

/**
 * Finds the previous séance's PV that needs approval, if any.
 * Returns null if no PV needs approval.
 */
export async function getPreviousSeancePVForApproval(
  instanceId: string,
  currentSeanceId: string
): Promise<{
  pvId: string
  seanceId: string
  seanceTitre: string
  seanceDate: string
  pvStatut: string
  pdfUrl: string | null
} | null> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return null

    // Find the most recent closed séance with a signed PV (not the current one)
    const { data: previousSeances } = await supabase
      .from('seances')
      .select(`
        id,
        titre,
        date_seance,
        pv:pv (id, statut, pdf_url)
      `)
      .eq('instance_id', instanceId)
      .neq('id', currentSeanceId)
      .in('statut', ['CLOTUREE', 'ARCHIVEE'])
      .order('date_seance', { ascending: false })
      .limit(5)

    if (!previousSeances || previousSeances.length === 0) return null

    // Find the first one with a SIGNE PV that hasn't been approved yet
    for (const seance of previousSeances) {
      const pvList = seance.pv as unknown as { id: string; statut: string; pdf_url: string | null }[]
      if (!pvList || pvList.length === 0) continue

      const pv = pvList[0]
      if (pv.statut === 'SIGNE') {
        // Check if already approved (has an APPROBATION_PV point in any séance that was voted ADOPTE)
        const { data: existingApproval } = await supabase
          .from('odj_points')
          .select('id, statut')
          .eq('pv_precedent_seance_id', seance.id)
          .eq('type_traitement', 'APPROBATION_PV')
          .maybeSingle()

        // If no approval point exists or it's still A_TRAITER, it needs approval
        if (!existingApproval || existingApproval.statut === 'A_TRAITER') {
          return {
            pvId: pv.id,
            seanceId: seance.id,
            seanceTitre: seance.titre,
            seanceDate: seance.date_seance,
            pvStatut: pv.statut,
            pdfUrl: pv.pdf_url,
          }
        }
      }
    }

    return null
  } catch (err) {
    console.error('getPreviousSeancePVForApproval error:', err)
    return null
  }
}

/**
 * Auto-adds an APPROBATION_PV point to the ODJ when a previous PV needs approval.
 * Called during séance creation.
 */
export async function addPVApprovalODJPoint(
  seanceId: string,
  instanceId: string
): Promise<ActionResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    const roleError = requireRole(user, ['super_admin', 'gestionnaire', 'president', 'secretaire_seance'])
    if (roleError) return { error: roleError }

    const pvInfo = await getPreviousSeancePVForApproval(instanceId, seanceId)
    if (!pvInfo) return { success: true } // No PV to approve

    // Check if APPROBATION_PV point already exists for this séance
    const { data: existing } = await supabase
      .from('odj_points')
      .select('id')
      .eq('seance_id', seanceId)
      .eq('type_traitement', 'APPROBATION_PV')
      .maybeSingle()

    if (existing) return { success: true } // Already added

    // Get all existing points to shift positions
    const { data: existingPoints } = await supabase
      .from('odj_points')
      .select('id, position')
      .eq('seance_id', seanceId)
      .order('position', { ascending: true })

    // Shift all existing points by +1
    if (existingPoints) {
      for (const p of existingPoints) {
        await supabase
          .from('odj_points')
          .update({ position: p.position + 1 })
          .eq('id', p.id)
      }
    }

    // Format date for title
    const pvDate = new Date(pvInfo.seanceDate).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })

    // Insert APPROBATION_PV at position 1
    const { error: insertError } = await supabase
      .from('odj_points')
      .insert({
        seance_id: seanceId,
        titre: `Approbation du procès-verbal de la séance du ${pvDate}`,
        description: `Vote sur l'approbation du procès-verbal de la séance « ${pvInfo.seanceTitre} » du ${pvDate}.`,
        type_traitement: 'APPROBATION_PV' as const,
        majorite_requise: 'SIMPLE' as const,
        huis_clos: false,
        votes_interdits: false,
        position: 1,
        statut: 'A_TRAITER',
        pv_precedent_seance_id: pvInfo.seanceId,
      })

    if (insertError) return { error: `Erreur : ${insertError.message}` }

    revalidatePath(`/seances/${seanceId}`)
    return { success: true }
  } catch (err) {
    console.error('addPVApprovalODJPoint error:', err)
    return { error: 'Erreur inattendue' }
  }
}

/**
 * Handles the result of a PV approval vote.
 * If ADOPTE: updates PV status to APPROUVE_EN_SEANCE.
 * If REJETE: keeps PV in EN_RELECTURE.
 */
export async function handlePVApprovalResult(
  odjPointId: string,
  seanceId: string,
  voteResult: 'ADOPTE' | 'REJETE'
): Promise<ActionResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    const roleError = requireRole(user, ['super_admin', 'gestionnaire'])
    if (roleError) return { error: roleError }

    // Find the ODJ point to get the linked PV
    const { data: odjPoint, error: odjError } = await supabase
      .from('odj_points')
      .select('id, pv_precedent_seance_id')
      .eq('id', odjPointId)
      .single()

    if (odjError || !odjPoint) return { error: 'Point ODJ introuvable' }
    if (!odjPoint.pv_precedent_seance_id) return { error: 'Aucun PV lié à ce point' }

    // Find the PV
    const { data: pv, error: pvError } = await supabase
      .from('pv')
      .select('id, statut')
      .eq('seance_id', odjPoint.pv_precedent_seance_id)
      .single()

    if (pvError || !pv) return { error: 'PV introuvable' }

    if (voteResult === 'ADOPTE') {
      // Update PV to APPROUVE_EN_SEANCE
      const { error: updateError } = await supabase
        .from('pv')
        .update({
          statut: 'APPROUVE_EN_SEANCE',
          approuve_en_seance_id: seanceId,
        })
        .eq('id', pv.id)

      if (updateError) return { error: `Erreur : ${updateError.message}` }
    } else {
      // Keep in EN_RELECTURE
      const { error: updateError } = await supabase
        .from('pv')
        .update({ statut: 'EN_RELECTURE' })
        .eq('id', pv.id)

      if (updateError) return { error: `Erreur : ${updateError.message}` }
    }

    revalidatePath(`/seances/${seanceId}`)
    return { success: true }
  } catch (err) {
    console.error('handlePVApprovalResult error:', err)
    return { error: 'Erreur inattendue' }
  }
}
