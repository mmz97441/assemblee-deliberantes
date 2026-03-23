'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/security/rate-limiter'

// ─── Types ────────────────────────────────────────────────────────────────────

type PresenceStatut = 'PRESENT' | 'ABSENT' | 'EXCUSE' | 'PROCURATION'

type ActionResult = { success: true } | { error: string }

interface QuorumResult {
  presents: number
  totalMembers: number
  quorumRequired: number
  quorumReached: boolean
  quorumType: string
  fractionLabel: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getAuthenticatedUser() {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    return { user: null, supabase }
  }
  return { user: data.user, supabase }
}

// ─── Mark presence (signature émargement) ────────────────────────────────────

export async function markPresence(
  seanceId: string,
  memberId: string,
  signatureSvg: string | null,
  statut: PresenceStatut = 'PRESENT'
): Promise<ActionResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    // Upsert: update if exists, insert if new
    const { error } = await supabase
      .from('presences')
      .upsert(
        {
          seance_id: seanceId,
          member_id: memberId,
          statut,
          signature_svg: signatureSvg,
          heure_arrivee: statut === 'PRESENT' ? new Date().toISOString() : null,
          mode_authentification: signatureSvg ? 'MANUEL' as const : 'ASSISTE' as const,
        },
        { onConflict: 'seance_id,member_id' }
      )

    if (error) return { error: `Erreur : ${error.message}` }

    revalidatePath(`/seances/${seanceId}`)
    revalidatePath(`/seances/${seanceId}/emargement`)
    return { success: true }
  } catch (err) {
    console.error('markPresence error:', err)
    return { error: 'Erreur inattendue' }
  }
}

// ─── Self-confirm presence (élu connecté) ────────────────────────────────────

export async function confirmSelfPresence(
  seanceId: string,
  memberId: string
): Promise<ActionResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    // Verify the member belongs to this user
    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('id, user_id')
      .eq('id', memberId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (memberError || !member) {
      return { error: 'Vous ne pouvez confirmer que votre propre présence' }
    }

    // Verify the member is convoqué for this séance
    const { data: convocataire } = await supabase
      .from('convocataires')
      .select('id')
      .eq('seance_id', seanceId)
      .eq('member_id', memberId)
      .maybeSingle()

    if (!convocataire) {
      return { error: 'Vous n\'êtes pas convoqué(e) pour cette séance' }
    }

    // Verify séance is in a valid state
    const { data: seance } = await supabase
      .from('seances')
      .select('statut')
      .eq('id', seanceId)
      .single()

    if (!seance || !['CONVOQUEE', 'EN_COURS'].includes(seance.statut || '')) {
      return { error: 'La séance n\'est pas ouverte aux confirmations de présence' }
    }

    // Upsert presence
    const { error } = await supabase
      .from('presences')
      .upsert(
        {
          seance_id: seanceId,
          member_id: memberId,
          statut: 'PRESENT' as const,
          heure_arrivee: new Date().toISOString(),
          mode_authentification: 'ASSISTE' as const,
        },
        { onConflict: 'seance_id,member_id' }
      )

    if (error) return { error: `Erreur : ${error.message}` }

    revalidatePath(`/seances/${seanceId}`)
    revalidatePath(`/seances/${seanceId}/emargement`)
    revalidatePath(`/seances/${seanceId}/tablette`)
    return { success: true }
  } catch (err) {
    console.error('confirmSelfPresence error:', err)
    return { error: 'Erreur inattendue' }
  }
}

// ─── Mark presence manually (gestionnaire) ───────────────────────────────────

export async function markPresenceManual(
  seanceId: string,
  memberId: string,
  statut: PresenceStatut
): Promise<ActionResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    // Check role
    const role = (user.user_metadata?.role as string) || ''
    if (!['super_admin', 'gestionnaire'].includes(role)) {
      return { error: 'Permissions insuffisantes' }
    }

    const { error } = await supabase
      .from('presences')
      .upsert(
        {
          seance_id: seanceId,
          member_id: memberId,
          statut,
          heure_arrivee: statut === 'PRESENT' ? new Date().toISOString() : null,
          mode_authentification: 'ASSISTE' as const,
        },
        { onConflict: 'seance_id,member_id' }
      )

    if (error) return { error: `Erreur : ${error.message}` }

    revalidatePath(`/seances/${seanceId}`)
    revalidatePath(`/seances/${seanceId}/emargement`)
    return { success: true }
  } catch (err) {
    console.error('markPresenceManual error:', err)
    return { error: 'Erreur inattendue' }
  }
}

// ─── Mark departure ──────────────────────────────────────────────────────────

export async function markDeparture(
  seanceId: string,
  memberId: string
): Promise<ActionResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    const role = (user.user_metadata?.role as string) || ''
    if (!['super_admin', 'gestionnaire'].includes(role)) {
      return { error: 'Permissions insuffisantes' }
    }

    const { error } = await supabase
      .from('presences')
      .update({ heure_depart: new Date().toISOString() })
      .eq('seance_id', seanceId)
      .eq('member_id', memberId)

    if (error) return { error: `Erreur : ${error.message}` }

    revalidatePath(`/seances/${seanceId}`)
    return { success: true }
  } catch (err) {
    console.error('markDeparture error:', err)
    return { error: 'Erreur inattendue' }
  }
}

// ─── Calculate quorum ────────────────────────────────────────────────────────

export async function calculateQuorum(seanceId: string): Promise<QuorumResult | { error: string }> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    // Get seance with instance config
    const { data: seance, error: seanceError } = await supabase
      .from('seances')
      .select(`
        id,
        instance_id,
        instance_config (
          id,
          quorum_type,
          quorum_fraction_numerateur,
          quorum_fraction_denominateur,
          composition_max
        )
      `)
      .eq('id', seanceId)
      .single()

    if (seanceError || !seance) return { error: 'Séance introuvable' }

    const config = seance.instance_config as {
      quorum_type: string | null
      quorum_fraction_numerateur: number | null
      quorum_fraction_denominateur: number | null
      composition_max: number | null
    } | null

    // Count members of the instance
    const { count: totalMembers } = await supabase
      .from('instance_members')
      .select('*', { count: 'exact', head: true })
      .eq('instance_id', seance.instance_id)

    // Count presents (including procurations that count)
    const { count: presents } = await supabase
      .from('presences')
      .select('*', { count: 'exact', head: true })
      .eq('seance_id', seanceId)
      .in('statut', ['PRESENT', 'PROCURATION'])

    const total = config?.composition_max || totalMembers || 0
    const presentsCount = presents || 0
    const numerateur = config?.quorum_fraction_numerateur || 1
    const denominateur = config?.quorum_fraction_denominateur || 2
    const quorumType = config?.quorum_type || 'MAJORITE_MEMBRES'

    // Calculate required quorum based on type
    let quorumRequired: number
    let fractionLabel: string

    switch (quorumType) {
      case 'MAJORITE_MEMBRES':
        quorumRequired = Math.ceil(total / 2) + 1
        fractionLabel = 'Majorité des membres'
        break
      case 'TIERS_MEMBRES':
        quorumRequired = Math.ceil(total / 3)
        fractionLabel = 'Tiers des membres'
        break
      case 'DEUX_TIERS':
        quorumRequired = Math.ceil((total * 2) / 3)
        fractionLabel = 'Deux tiers des membres'
        break
      case 'STATUTS':
        quorumRequired = Math.ceil((total * numerateur) / denominateur)
        fractionLabel = `${numerateur}/${denominateur} des membres`
        break
      default:
        quorumRequired = Math.ceil(total / 2) + 1
        fractionLabel = 'Majorité des membres'
    }

    return {
      presents: presentsCount,
      totalMembers: total,
      quorumRequired,
      quorumReached: presentsCount >= quorumRequired,
      quorumType,
      fractionLabel,
    }
  } catch (err) {
    console.error('calculateQuorum error:', err)
    return { error: 'Erreur de calcul du quorum' }
  }
}

// ─── Scan QR code (émargement par token unique) ──────────────────────────────

export async function scanQREmargement(
  seanceId: string,
  token: string
): Promise<{ success: true; memberName: string } | { error: string }> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    // Rate limiting: max 60 scans par minute (anti brute-force token)
    const rateCheck = await checkRateLimit(supabase, user!.id, {
      actionKey: 'qr_scan',
      maxAttempts: 60,
      windowMinutes: 1,
    })
    if (!rateCheck.allowed) return { error: rateCheck.error! }

    // Find the convocataire by emargement token
    const { data: convocataire, error: findError } = await supabase
      .from('convocataires')
      .select(`
        id,
        member_id,
        seance_id,
        token_emargement,
        emargement_scanne_at,
        member:members (id, prenom, nom)
      `)
      .eq('token_emargement', token)
      .eq('seance_id', seanceId)
      .maybeSingle()

    if (findError || !convocataire) {
      return { error: 'QR code invalide ou non reconnu pour cette séance' }
    }

    // Check if already scanned (usage unique)
    if (convocataire.emargement_scanne_at) {
      const member = convocataire.member as { prenom: string; nom: string } | null
      const name = member ? `${member.prenom} ${member.nom}` : 'Ce membre'
      return { error: `${name} a déjà émargé à ${new Date(convocataire.emargement_scanne_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` }
    }

    // Mark as scanned (usage unique)
    const { error: updateError } = await supabase
      .from('convocataires')
      .update({ emargement_scanne_at: new Date().toISOString() })
      .eq('id', convocataire.id)

    if (updateError) return { error: `Erreur mise à jour : ${updateError.message}` }

    // Upsert presence
    const { error: presenceError } = await supabase
      .from('presences')
      .upsert(
        {
          seance_id: seanceId,
          member_id: convocataire.member_id,
          statut: 'PRESENT' as const,
          heure_arrivee: new Date().toISOString(),
          mode_authentification: 'MANUEL' as const,
        },
        { onConflict: 'seance_id,member_id' }
      )

    if (presenceError) return { error: `Erreur présence : ${presenceError.message}` }

    const member = convocataire.member as { prenom: string; nom: string } | null
    const memberName = member ? `${member.prenom} ${member.nom}` : 'Membre'

    revalidatePath(`/seances/${seanceId}`)
    revalidatePath(`/seances/${seanceId}/emargement`)
    return { success: true, memberName }
  } catch (err) {
    console.error('scanQREmargement error:', err)
    return { error: 'Erreur inattendue lors du scan' }
  }
}

// ─── Get all presences for a seance ──────────────────────────────────────────

export async function getPresences(seanceId: string) {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    const { data, error } = await supabase
      .from('presences')
      .select(`
        id,
        member_id,
        statut,
        heure_arrivee,
        heure_depart,
        signature_svg,
        mode_authentification,
        member:members (id, prenom, nom, email, qualite_officielle)
      `)
      .eq('seance_id', seanceId)
      .order('created_at', { ascending: true })

    if (error) return { error: error.message }

    return { data: data || [] }
  } catch (err) {
    console.error('getPresences error:', err)
    return { error: 'Erreur inattendue' }
  }
}

// ─── Tablet authentication (token_emargement → device_session) ──────────────

type AuthenticateTabletResult =
  | { success: true; memberId: string; memberName: string }
  | { error: string }

/**
 * Authenticates a member on a tablet using their convocation token.
 * Creates a device_session record to lock the tablet for this member.
 */
export async function authenticateTablet(
  seanceId: string,
  token: string,
  deviceFingerprint: string
): Promise<AuthenticateTabletResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    // Rate limiting: max 30 tentatives par minute
    const rateCheck = await checkRateLimit(supabase, user.id, {
      actionKey: 'tablet_auth',
      maxAttempts: 30,
      windowMinutes: 1,
    })
    if (!rateCheck.allowed) return { error: rateCheck.error! }

    // Find the convocataire by token
    const { data: convocataire, error: findError } = await supabase
      .from('convocataires')
      .select(`
        id,
        member_id,
        seance_id,
        token_emargement,
        member:members (id, prenom, nom)
      `)
      .eq('token_emargement', token)
      .eq('seance_id', seanceId)
      .maybeSingle()

    if (findError || !convocataire) {
      return { error: 'Code de convocation invalide ou non reconnu pour cette séance' }
    }

    const member = convocataire.member as { id: string; prenom: string; nom: string } | null
    if (!member) return { error: 'Membre introuvable' }

    // Create or update device_session
    const { error: sessionError } = await supabase
      .from('device_sessions')
      .upsert({
        seance_id: seanceId,
        member_id: member.id,
        device_fingerprint: deviceFingerprint,
        auth_method: 'QR_ONLY',
        authenticated_at: new Date().toISOString(),
        active: true,
      }, { onConflict: 'seance_id,member_id' })

    if (sessionError) {
      return { error: `Erreur de session : ${sessionError.message}` }
    }

    revalidatePath(`/seances/${seanceId}/tablette`)
    return { success: true, memberId: member.id, memberName: `${member.prenom} ${member.nom}` }
  } catch (err) {
    console.error('authenticateTablet error:', err)
    return { error: 'Erreur inattendue lors de l\'authentification' }
  }
}
