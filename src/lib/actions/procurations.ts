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

// ─── Create a procuration ────────────────────────────────────────────────────
// mandant = the person who GIVES their vote (absent)
// mandataire = the person who RECEIVES the vote (present, votes for both)

export async function createProcuration(
  seanceId: string,
  mandantId: string,
  mandataireId: string,
  canal: string = 'email'
): Promise<ActionResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    const role = (user.user_metadata?.role as string) || ''
    if (!['super_admin', 'gestionnaire'].includes(role)) {
      return { error: 'Permissions insuffisantes' }
    }

    // Validate: mandant ≠ mandataire
    if (mandantId === mandataireId) {
      return { error: 'Le mandant et le mandataire doivent être deux personnes différentes' }
    }

    // Check: mandant must be a convocataire of this seance
    const { data: mandantConv } = await supabase
      .from('convocataires')
      .select('id')
      .eq('seance_id', seanceId)
      .eq('member_id', mandantId)
      .maybeSingle()

    if (!mandantConv) {
      return { error: 'Le mandant n\'est pas convoqué pour cette séance' }
    }

    // Check: mandataire must be a convocataire of this seance
    const { data: mandataireConv } = await supabase
      .from('convocataires')
      .select('id')
      .eq('seance_id', seanceId)
      .eq('member_id', mandataireId)
      .maybeSingle()

    if (!mandataireConv) {
      return { error: 'Le mandataire n\'est pas convoqué pour cette séance' }
    }

    // Check: mandant doesn't already have a procuration for this seance
    const { data: existingMandant } = await supabase
      .from('procurations')
      .select('id')
      .eq('seance_id', seanceId)
      .eq('mandant_id', mandantId)
      .eq('valide', true)
      .maybeSingle()

    if (existingMandant) {
      return { error: 'Ce membre a déjà donné une procuration pour cette séance' }
    }

    // Check: mandataire doesn't already have a procuration from someone else
    // (CGCT L2121-20: max 1 procuration received per person per session)
    const { data: existingMandataire } = await supabase
      .from('procurations')
      .select('id')
      .eq('seance_id', seanceId)
      .eq('mandataire_id', mandataireId)
      .eq('valide', true)
      .maybeSingle()

    if (existingMandataire) {
      return { error: 'Ce mandataire a déjà reçu une procuration pour cette séance (maximum 1 par personne — CGCT L2121-20)' }
    }

    // Create the procuration
    const { error: insertError } = await supabase
      .from('procurations')
      .insert({
        seance_id: seanceId,
        mandant_id: mandantId,
        mandataire_id: mandataireId,
        valide: true,
        cree_par_gestionnaire: true,
        canal_communication: canal,
        validee_par: user.id,
        validee_at: new Date().toISOString(),
      })

    if (insertError) {
      // Handle unique constraint violations
      if (insertError.message.includes('unique') || insertError.code === '23505') {
        return { error: 'Cette procuration existe déjà' }
      }
      return { error: `Erreur : ${insertError.message}` }
    }

    // Also mark the mandant's presence as PROCURATION
    await supabase
      .from('presences')
      .upsert(
        {
          seance_id: seanceId,
          member_id: mandantId,
          statut: 'PROCURATION' as const,
          mode_authentification: 'ASSISTE' as const,
        },
        { onConflict: 'seance_id,member_id' }
      )

    revalidatePath(`/seances/${seanceId}`)
    revalidatePath(`/seances/${seanceId}/en-cours`)
    revalidatePath(`/seances/${seanceId}/emargement`)
    return { success: true }
  } catch (err) {
    console.error('createProcuration error:', err)
    return { error: 'Erreur inattendue lors de la création de la procuration' }
  }
}

// ─── Revoke a procuration ────────────────────────────────────────────────────

export async function revokeProcuration(
  procurationId: string,
  seanceId: string
): Promise<ActionResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    const role = (user.user_metadata?.role as string) || ''
    if (!['super_admin', 'gestionnaire'].includes(role)) {
      return { error: 'Permissions insuffisantes' }
    }

    // Get the procuration to find the mandant
    const { data: proc } = await supabase
      .from('procurations')
      .select('mandant_id')
      .eq('id', procurationId)
      .single()

    if (!proc) return { error: 'Procuration introuvable' }

    // Check if votes have been cast — procuration cannot be revoked after voting
    const { data: closedVotes } = await supabase
      .from('votes')
      .select('id')
      .eq('seance_id', seanceId)
      .in('statut', ['CLOS', 'OUVERT'])
      .limit(1)

    if (closedVotes && closedVotes.length > 0) {
      return { error: 'La procuration ne peut plus \u00eatre r\u00e9voqu\u00e9e apr\u00e8s le d\u00e9but des votes. Le mandataire a potentiellement d\u00e9j\u00e0 vot\u00e9 au nom du mandant.' }
    }

    // Invalidate the procuration (don't delete — keep trace)
    const { error: updateError } = await supabase
      .from('procurations')
      .update({ valide: false })
      .eq('id', procurationId)

    if (updateError) return { error: `Erreur : ${updateError.message}` }

    // Revert the mandant's presence to ABSENT (if they were marked as PROCURATION)
    const { data: presence } = await supabase
      .from('presences')
      .select('id, statut')
      .eq('seance_id', seanceId)
      .eq('member_id', proc.mandant_id)
      .maybeSingle()

    if (presence && presence.statut === 'PROCURATION') {
      await supabase
        .from('presences')
        .update({ statut: 'ABSENT' as const })
        .eq('id', presence.id)
    }

    revalidatePath(`/seances/${seanceId}`)
    revalidatePath(`/seances/${seanceId}/en-cours`)
    revalidatePath(`/seances/${seanceId}/emargement`)
    return { success: true }
  } catch (err) {
    console.error('revokeProcuration error:', err)
    return { error: 'Erreur inattendue' }
  }
}

// ─── Get procurations for a seance ───────────────────────────────────────────

export async function getProcurations(seanceId: string) {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    const { data, error } = await supabase
      .from('procurations')
      .select(`
        id,
        mandant_id,
        mandataire_id,
        valide,
        canal_communication,
        created_at,
        mandant:members!procurations_mandant_id_fkey (id, prenom, nom, email),
        mandataire:members!procurations_mandataire_id_fkey (id, prenom, nom, email)
      `)
      .eq('seance_id', seanceId)
      .eq('valide', true)
      .order('created_at', { ascending: true })

    if (error) return { error: error.message }
    return { data: data || [] }
  } catch (err) {
    console.error('getProcurations error:', err)
    return { error: 'Erreur inattendue' }
  }
}
