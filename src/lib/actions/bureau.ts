'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'

type ActionResult = { success: true } | { error: string }

async function getAuthenticatedUser() {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) return { user: null, supabase }
  return { user: data.user, supabase }
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BureauMember {
  id: string
  member_id: string
  bureau_role: string
  ordre_succession: number
  member: {
    id: string
    prenom: string
    nom: string
    qualite_officielle: string | null
  }
}

// ─── Mise à jour du rôle bureau ─────────────────────────────────────────────

export async function updateBureauRole(
  instanceId: string,
  memberId: string,
  role: string | null,
  ordreSuccession?: number
): Promise<ActionResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    const userRole = (user.user_metadata?.role as string) || ''
    if (!['super_admin', 'gestionnaire'].includes(userRole)) {
      return { error: 'Permissions insuffisantes' }
    }

    // Si on assigne le rôle président, retirer l'ancien président d'abord
    if (role === 'president') {
      const { error: clearError } = await supabase
        .from('instance_members')
        .update({ bureau_role: null, ordre_succession: 0 })
        .eq('instance_config_id', instanceId)
        .eq('bureau_role', 'president')

      if (clearError) {
        return { error: `Erreur lors du retrait de l'ancien président : ${clearError.message}` }
      }
    }

    // Mettre à jour le rôle du membre
    const { error } = await supabase
      .from('instance_members')
      .update({
        bureau_role: role,
        ordre_succession: ordreSuccession ?? 0,
      })
      .eq('instance_config_id', instanceId)
      .eq('member_id', memberId)

    if (error) {
      return { error: `Erreur de mise à jour : ${error.message}` }
    }

    revalidatePath('/membres')
    revalidatePath('/configuration')
    return { success: true }
  } catch (err) {
    console.error('updateBureauRole error:', err)
    return { error: 'Erreur inattendue lors de la mise à jour du bureau' }
  }
}

// ─── Récupérer le bureau d'une instance ─────────────────────────────────────

export async function getBureau(
  instanceId: string
): Promise<{ data: BureauMember[] } | { error: string }> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    const { data, error } = await supabase
      .from('instance_members')
      .select(`
        id, member_id, bureau_role, ordre_succession,
        member:members (id, prenom, nom, qualite_officielle)
      `)
      .eq('instance_config_id', instanceId)
      .not('bureau_role', 'is', null)
      .order('ordre_succession', { ascending: true })

    if (error) {
      return { error: `Erreur de chargement du bureau : ${error.message}` }
    }

    const bureau: BureauMember[] = (data || []).map((row) => ({
      id: row.id,
      member_id: row.member_id,
      bureau_role: row.bureau_role as string,
      ordre_succession: row.ordre_succession ?? 0,
      member: row.member as unknown as BureauMember['member'],
    }))

    return { data: bureau }
  } catch (err) {
    console.error('getBureau error:', err)
    return { error: 'Erreur inattendue lors du chargement du bureau' }
  }
}

// ─── Ordre de succession (vice-présidents) ──────────────────────────────────

export async function getSuccessionOrder(
  instanceId: string
): Promise<{ data: BureauMember[] } | { error: string }> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    const { data, error } = await supabase
      .from('instance_members')
      .select(`
        id, member_id, bureau_role, ordre_succession,
        member:members (id, prenom, nom, qualite_officielle)
      `)
      .eq('instance_config_id', instanceId)
      .eq('bureau_role', 'vice_president')
      .order('ordre_succession', { ascending: true })

    if (error) {
      return { error: `Erreur de chargement de l'ordre de succession : ${error.message}` }
    }

    const vps: BureauMember[] = (data || []).map((row) => ({
      id: row.id,
      member_id: row.member_id,
      bureau_role: row.bureau_role as string,
      ordre_succession: row.ordre_succession ?? 0,
      member: row.member as unknown as BureauMember['member'],
    }))

    return { data: vps }
  } catch (err) {
    console.error('getSuccessionOrder error:', err)
    return { error: 'Erreur inattendue lors du chargement de l\'ordre de succession' }
  }
}
