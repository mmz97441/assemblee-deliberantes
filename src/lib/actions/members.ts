'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ROUTES } from '@/lib/constants'
import type { MemberRow, InstanceConfigRow, UserRole } from '@/lib/supabase/types'

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
  if (!user) return 'Non authentifie'
  const role = (user.user_metadata?.role as string) || ''
  if (!roles.includes(role)) return 'Permissions insuffisantes'
  return null
}

export interface MemberWithInstances extends MemberRow {
  instance_members: {
    id: string
    instance_config_id: string
    fonction_dans_instance: string | null
    actif: boolean | null
    instance_config: Pick<InstanceConfigRow, 'id' | 'nom'> | null
  }[]
}

export async function getMembers(): Promise<{ data: MemberWithInstances[] } | { error: string }> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifie' }

    const { data, error } = await supabase
      .from('members')
      .select(`
        *,
        instance_members (
          id,
          instance_config_id,
          fonction_dans_instance,
          actif,
          instance_config (
            id,
            nom
          )
        )
      `)
      .order('nom', { ascending: true })
      .order('prenom', { ascending: true })

    if (error) return { error: `Erreur de chargement : ${error.message}` }

    return { data: (data as MemberWithInstances[]) || [] }
  } catch (err) {
    console.error('getMembers error:', err)
    return { error: 'Erreur inattendue lors du chargement des membres' }
  }
}

export async function createMember(formData: FormData): Promise<ActionResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    const roleError = requireRole(user, ['super_admin', 'gestionnaire'])
    if (roleError) return { error: roleError }

    const prenom = (formData.get('prenom') as string)?.trim()
    const nom = (formData.get('nom') as string)?.trim()
    const email = (formData.get('email') as string)?.trim()

    if (!prenom) return { error: 'Le prenom est requis' }
    if (!nom) return { error: 'Le nom est requis' }
    if (!email) return { error: 'L\'email est requis' }

    const payload = {
      prenom,
      nom,
      email,
      telephone: (formData.get('telephone') as string)?.trim() || null,
      role: ((formData.get('role') as string) || 'elu') as UserRole,
      qualite_officielle: (formData.get('qualite_officielle') as string)?.trim() || null,
      groupe_politique: (formData.get('groupe_politique') as string)?.trim() || null,
      mandat_debut: (formData.get('mandat_debut') as string) || null,
      mandat_fin: (formData.get('mandat_fin') as string) || null,
      statut: 'ACTIF' as const,
    }

    const { data: newMember, error } = await supabase
      .from('members')
      .insert(payload)
      .select('id')
      .single()

    if (error) return { error: `Erreur de creation : ${error.message}` }

    // Assign instances if provided
    const instanceIds = formData.getAll('instance_ids') as string[]
    if (instanceIds.length > 0 && newMember) {
      const instanceAssignments = instanceIds.map(instanceId => {
        const fonction = (formData.get(`fonction_instance_${instanceId}`) as string)?.trim() || null
        return {
          member_id: newMember.id,
          instance_config_id: instanceId,
          fonction_dans_instance: fonction,
          actif: true,
        }
      })

      const { error: instanceError } = await supabase
        .from('instance_members')
        .insert(instanceAssignments)

      if (instanceError) {
        console.error('Error assigning instances:', instanceError)
        // Non-blocking: member created but instances failed
      }
    }

    revalidatePath(ROUTES.MEMBRES)
    return { success: true }
  } catch (err) {
    console.error('createMember error:', err)
    return { error: 'Erreur inattendue lors de la creation' }
  }
}

export async function updateMember(formData: FormData): Promise<ActionResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    const roleError = requireRole(user, ['super_admin', 'gestionnaire'])
    if (roleError) return { error: roleError }

    const id = formData.get('id') as string
    if (!id) return { error: 'ID du membre manquant' }

    const prenom = (formData.get('prenom') as string)?.trim()
    const nom = (formData.get('nom') as string)?.trim()
    const email = (formData.get('email') as string)?.trim()

    if (!prenom) return { error: 'Le prenom est requis' }
    if (!nom) return { error: 'Le nom est requis' }
    if (!email) return { error: 'L\'email est requis' }

    const payload = {
      prenom,
      nom,
      email,
      telephone: (formData.get('telephone') as string)?.trim() || null,
      role: ((formData.get('role') as string) || 'elu') as UserRole,
      qualite_officielle: (formData.get('qualite_officielle') as string)?.trim() || null,
      groupe_politique: (formData.get('groupe_politique') as string)?.trim() || null,
      mandat_debut: (formData.get('mandat_debut') as string) || null,
      mandat_fin: (formData.get('mandat_fin') as string) || null,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase
      .from('members')
      .update(payload)
      .eq('id', id)

    if (error) return { error: `Erreur de mise a jour : ${error.message}` }

    revalidatePath(ROUTES.MEMBRES)
    return { success: true }
  } catch (err) {
    console.error('updateMember error:', err)
    return { error: 'Erreur inattendue lors de la mise a jour' }
  }
}

export async function toggleMemberStatus(
  id: string,
  statut: 'ACTIF' | 'SUSPENDU' | 'FIN_DE_MANDAT' | 'DECEDE'
): Promise<ActionResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    const roleError = requireRole(user, ['super_admin', 'gestionnaire'])
    if (roleError) return { error: roleError }

    if (!id) return { error: 'ID du membre manquant' }

    const { error } = await supabase
      .from('members')
      .update({ statut, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) return { error: `Erreur : ${error.message}` }

    revalidatePath(ROUTES.MEMBRES)
    return { success: true }
  } catch (err) {
    console.error('toggleMemberStatus error:', err)
    return { error: 'Erreur inattendue' }
  }
}

export async function assignMemberToInstances(
  memberId: string,
  assignments: { instanceId: string; fonction: string | null }[]
): Promise<ActionResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    const roleError = requireRole(user, ['super_admin', 'gestionnaire'])
    if (roleError) return { error: roleError }

    if (!memberId) return { error: 'ID du membre manquant' }

    // Delete existing assignments
    const { error: deleteError } = await supabase
      .from('instance_members')
      .delete()
      .eq('member_id', memberId)

    if (deleteError) return { error: `Erreur de suppression : ${deleteError.message}` }

    // Insert new assignments
    if (assignments.length > 0) {
      const rows = assignments.map(a => ({
        member_id: memberId,
        instance_config_id: a.instanceId,
        fonction_dans_instance: a.fonction,
        actif: true,
      }))

      const { error: insertError } = await supabase
        .from('instance_members')
        .insert(rows)

      if (insertError) return { error: `Erreur d'assignation : ${insertError.message}` }
    }

    revalidatePath(ROUTES.MEMBRES)
    return { success: true }
  } catch (err) {
    console.error('assignMemberToInstances error:', err)
    return { error: 'Erreur inattendue' }
  }
}

export async function sendMemberInvitation(memberId: string): Promise<ActionResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    const roleError = requireRole(user, ['super_admin', 'gestionnaire'])
    if (roleError) return { error: roleError }

    if (!memberId) return { error: 'ID du membre manquant' }

    // Fetch member info
    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('id, email, role')
      .eq('id', memberId)
      .single()

    if (memberError || !member) return { error: 'Membre introuvable' }

    // Check for existing pending invitation
    const { data: existing } = await supabase
      .from('invitations')
      .select('id')
      .eq('member_id', memberId)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (existing) {
      return { error: 'Une invitation est deja en cours pour ce membre' }
    }

    // Create invitation record
    const token = crypto.randomUUID()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // 7 days

    const { error: inviteError } = await supabase
      .from('invitations')
      .insert({
        email: member.email,
        role: member.role,
        member_id: memberId,
        invited_by: user!.id,
        token,
        expires_at: expiresAt.toISOString(),
      })

    if (inviteError) return { error: `Erreur de creation d'invitation : ${inviteError.message}` }

    // Email sending will be implemented later with Resend
    revalidatePath(ROUTES.MEMBRES)
    return { success: true }
  } catch (err) {
    console.error('sendMemberInvitation error:', err)
    return { error: 'Erreur inattendue' }
  }
}
