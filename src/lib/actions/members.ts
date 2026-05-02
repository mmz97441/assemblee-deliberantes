'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ROUTES } from '@/lib/constants'
import { checkRateLimit } from '@/lib/security/rate-limiter'
import type { MemberRow, InstanceConfigRow, UserRole } from '@/lib/supabase/types'
import { requireVerifiedRole } from '@/lib/auth/require-role'
import { getUserRole } from '@/lib/auth/get-user-role'
import { INVITABLE_ROLES } from '@/lib/auth/helpers'

// SÉCURITÉ : seul super_admin peut attribuer/modifier les rôles privilégiés.
// Les rôles assignables par un caller donné sont contraints par INVITABLE_ROLES.
// Sans cette garde, un gestionnaire pouvait s'auto-promouvoir super_admin via
// formData.role sur createMember/updateMember.
function assertAllowedRoleAssignment(
  callerRole: string | null,
  requestedRole: UserRole
): { ok: true } | { ok: false; error: string } {
  const allowed = INVITABLE_ROLES[callerRole || ''] || []
  if (!allowed.includes(requestedRole)) {
    return {
      ok: false,
      error: `Vous n'avez pas le droit d'attribuer le rôle « ${requestedRole} ». Rôles autorisés pour vous : ${allowed.join(', ') || 'aucun'}.`,
    }
  }
  return { ok: true }
}

type ActionResult = { success: true } | { error: string }

async function getAuthenticatedUser() {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    return { user: null, supabase }
  }
  return { user: data.user, supabase }
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
    if (!user) return { error: 'Non authentifié' }

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
    const roleError = await requireVerifiedRole(supabase, user, ['super_admin', 'gestionnaire'])
    if (roleError) return { error: roleError }

    const prenom = (formData.get('prenom') as string)?.trim()
    const nom = (formData.get('nom') as string)?.trim()
    const email = (formData.get('email') as string)?.trim()

    if (!prenom) return { error: 'Le prénom est requis' }
    if (!nom) return { error: 'Le nom est requis' }
    if (!email) return { error: "L'email est requis" }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Format d\'email invalide' }

    // SÉCURITÉ : restreindre les rôles assignables au rôle réel du caller
    const requestedRole = ((formData.get('role') as string) || 'elu') as UserRole
    const callerRole = user ? await getUserRole(supabase, user.id) : null
    const roleCheck = assertAllowedRoleAssignment(callerRole, requestedRole)
    if (!roleCheck.ok) return { error: roleCheck.error }

    const payload = {
      prenom,
      nom,
      email,
      telephone: (formData.get('telephone') as string)?.trim() || null,
      role: requestedRole,
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

    if (error) return { error: `Erreur de création : ${error.message}` }

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
    const roleError = await requireVerifiedRole(supabase, user, ['super_admin', 'gestionnaire'])
    if (roleError) return { error: roleError }

    const id = formData.get('id') as string
    if (!id) return { error: 'ID du membre manquant' }

    const prenom = (formData.get('prenom') as string)?.trim()
    const nom = (formData.get('nom') as string)?.trim()
    const email = (formData.get('email') as string)?.trim()

    if (!prenom) return { error: 'Le prénom est requis' }
    if (!nom) return { error: 'Le nom est requis' }
    if (!email) return { error: "L'email est requis" }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Format d\'email invalide' }

    // SÉCURITÉ : empêcher l'élévation de privilèges via le champ role.
    const requestedRole = ((formData.get('role') as string) || 'elu') as UserRole
    const callerRole = user ? await getUserRole(supabase, user.id) : null

    // Charger l'état courant du membre cible et le member_id du caller
    const [{ data: targetMember }, { data: callerMember }] = await Promise.all([
      supabase.from('members').select('id, role, user_id').eq('id', id).maybeSingle(),
      user
        ? supabase.from('members').select('id').eq('user_id', user.id).maybeSingle()
        : Promise.resolve({ data: null }),
    ])

    if (!targetMember) return { error: 'Membre introuvable' }

    // Auto-modification du propre rôle interdite (sauf super_admin)
    const isSelfUpdate = callerMember?.id === targetMember.id
    if (isSelfUpdate && requestedRole !== targetMember.role && callerRole !== 'super_admin') {
      return { error: 'Vous ne pouvez pas modifier votre propre rôle. Demandez à un super-administrateur.' }
    }

    // Modification d'un super_admin existant : seul un super_admin peut le faire
    if (targetMember.role === 'super_admin' && callerRole !== 'super_admin') {
      return { error: 'Seul un super-administrateur peut modifier un autre super-administrateur.' }
    }

    // Si le rôle change, valider qu'il est dans les rôles assignables par le caller
    if (requestedRole !== targetMember.role) {
      const roleCheck = assertAllowedRoleAssignment(callerRole, requestedRole)
      if (!roleCheck.ok) return { error: roleCheck.error }
    }

    const payload = {
      prenom,
      nom,
      email,
      telephone: (formData.get('telephone') as string)?.trim() || null,
      role: requestedRole,
      qualite_officielle: (formData.get('qualite_officielle') as string)?.trim() || null,
      groupe_politique: (formData.get('groupe_politique') as string)?.trim() || null,
      mandat_debut: (formData.get('mandat_debut') as string) || null,
      mandat_fin: (formData.get('mandat_fin') as string) || null,
    }

    const { error } = await supabase
      .from('members')
      .update(payload)
      .eq('id', id)

    if (error) return { error: `Erreur de mise à jour : ${error.message}` }

    revalidatePath(ROUTES.MEMBRES)
    return { success: true }
  } catch (err) {
    console.error('updateMember error:', err)
    return { error: 'Erreur inattendue lors de la mise à jour' }
  }
}

export async function toggleMemberStatus(
  id: string,
  statut: 'ACTIF' | 'SUSPENDU' | 'FIN_DE_MANDAT' | 'DECEDE'
): Promise<ActionResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    const roleError = await requireVerifiedRole(supabase, user, ['super_admin', 'gestionnaire'])
    if (roleError) return { error: roleError }

    if (!id) return { error: 'ID du membre manquant' }

    const memberId = id
    const newStatut = statut

    // Check if member holds active bureau roles
    const { data: bureauRoles } = await supabase
      .from('instance_members')
      .select('bureau_role, instance_config(nom)')
      .eq('member_id', memberId)
      .not('bureau_role', 'is', null)

    if (bureauRoles && bureauRoles.length > 0 && ['SUSPENDU', 'FIN_DE_MANDAT', 'DECEDE'].includes(newStatut)) {
      const roles = bureauRoles.map(r => `${r.bureau_role} de ${(r.instance_config as { nom: string } | null)?.nom || 'une instance'}`).join(', ')
      return { error: `Ce membre occupe des rôles actifs : ${roles}. Désignez un remplaçant dans le bureau avant de modifier son statut.` }
    }

    // Check if member is president/secretary of future séances
    const { data: futureSeances } = await supabase
      .from('seances')
      .select('titre, president_effectif_seance_id, secretaire_seance_id')
      .or(`president_effectif_seance_id.eq.${memberId},secretaire_seance_id.eq.${memberId}`)
      .in('statut', ['BROUILLON', 'CONVOQUEE', 'EN_COURS'])

    if (futureSeances && futureSeances.length > 0) {
      return { error: `Ce membre est désigné comme président ou secrétaire de ${futureSeances.length} séance(s) à venir. Modifiez ces séances avant de changer son statut.` }
    }

    // Check if member is currently present in an active séance
    const { data: activePresence } = await supabase
      .from('presences')
      .select('seance_id, seance:seances(titre, statut)')
      .eq('member_id', memberId)
      .eq('statut', 'PRESENT')

    const inActiveSeance = activePresence?.filter(p => {
      const seanceData = p.seance as { titre: string; statut: string } | null
      return seanceData?.statut === 'EN_COURS' || seanceData?.statut === 'SUSPENDUE'
    })
    if (inActiveSeance && inActiveSeance.length > 0) {
      const seanceData = inActiveSeance[0].seance as { titre: string; statut: string } | null
      return { error: `Ce membre est actuellement présent dans une séance en cours (${seanceData?.titre || 'séance'}). Attendez la clôture de la séance.` }
    }

    const { error } = await supabase
      .from('members')
      .update({ statut })
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
    const roleError = await requireVerifiedRole(supabase, user, ['super_admin', 'gestionnaire'])
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
    const roleError = await requireVerifiedRole(supabase, user, ['super_admin', 'gestionnaire'])
    if (roleError) return { error: roleError }

    // M5: Rate limit invitations — max 5 per hour
    const rateCheck = await checkRateLimit(supabase, user!.id, {
      actionKey: 'send_member_invitation',
      maxAttempts: 5,
      windowMinutes: 60,
    })
    if (!rateCheck.allowed) return { error: rateCheck.error! }

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
      return { error: 'Une invitation est déjà en cours pour ce membre' }
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
        invited_by: user?.id ?? null,
        token,
        expires_at: expiresAt.toISOString(),
      })

    if (inviteError) return { error: `Erreur de création d'invitation : ${inviteError.message}` }

    // Email sending will be implemented later with Resend
    revalidatePath(ROUTES.MEMBRES)
    return { success: true }
  } catch (err) {
    console.error('sendMemberInvitation error:', err)
    return { error: 'Erreur inattendue' }
  }
}

// ─── Bulk Import ─────────────────────────────────────────────────────────────

export interface ImportRow {
  prenom: string
  nom: string
  email: string
  telephone?: string
  qualite_officielle?: string
  groupe_politique?: string
  role?: string
  mandat_debut?: string
  mandat_fin?: string
}

export interface ImportResult {
  total: number
  created: number
  skipped: number
  errors: { row: number; message: string }[]
}

const VALID_ROLES = ['super_admin', 'president', 'gestionnaire', 'secretaire_seance', 'elu', 'preparateur']

export async function importMembers(rows: ImportRow[]): Promise<ImportResult | { error: string }> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    const roleError = await requireVerifiedRole(supabase, user, ['super_admin', 'gestionnaire'])
    if (roleError) return { error: roleError }

    // M7: Rate limit imports — max 3 per hour
    const rateCheck = await checkRateLimit(supabase, user!.id, {
      actionKey: 'import_members',
      maxAttempts: 3,
      windowMinutes: 60,
    })
    if (!rateCheck.allowed) return { error: rateCheck.error! }

    if (!rows || rows.length === 0) return { error: 'Aucune donnée à importer' }
    if (rows.length > 500) return { error: 'Maximum 500 lignes par import' }

    // Fetch existing emails to skip duplicates
    const { data: existingMembers } = await supabase
      .from('members')
      .select('email')
    const existingEmails = new Set((existingMembers || []).map(m => m.email.toLowerCase()))

    const result: ImportResult = { total: rows.length, created: 0, skipped: 0, errors: [] }
    const toInsert: Array<{
      prenom: string
      nom: string
      email: string
      telephone: string | null
      qualite_officielle: string | null
      groupe_politique: string | null
      role: UserRole
      mandat_debut: string | null
      mandat_fin: string | null
      statut: 'ACTIF'
    }> = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNum = i + 2 // +2 for header + 0-index

      // Validate required fields
      const prenom = row.prenom?.trim()
      const nom = row.nom?.trim()
      const email = row.email?.trim()?.toLowerCase()

      if (!prenom || !nom) {
        result.errors.push({ row: rowNum, message: 'Prénom et nom requis' })
        continue
      }
      if (!email) {
        result.errors.push({ row: rowNum, message: 'Email requis' })
        continue
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        result.errors.push({ row: rowNum, message: `Email invalide: ${email}` })
        continue
      }

      // Skip duplicates
      if (existingEmails.has(email)) {
        result.skipped++
        continue
      }

      // Validate role if provided
      const role = row.role?.trim().toLowerCase() || 'elu'
      if (!VALID_ROLES.includes(role)) {
        result.errors.push({ row: rowNum, message: `Rôle inconnu: ${row.role}` })
        continue
      }

      existingEmails.add(email) // Prevent duplicate within same import

      toInsert.push({
        prenom,
        nom,
        email,
        telephone: row.telephone?.trim() || null,
        qualite_officielle: row.qualite_officielle?.trim() || null,
        groupe_politique: row.groupe_politique?.trim() || null,
        role: role as UserRole,
        mandat_debut: row.mandat_debut?.trim() || null,
        mandat_fin: row.mandat_fin?.trim() || null,
        statut: 'ACTIF',
      })
    }

    // Batch insert (Supabase handles up to 1000 rows)
    if (toInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('members')
        .insert(toInsert)

      if (insertError) {
        return { error: `Erreur d'insertion : ${insertError.message}` }
      }
      result.created = toInsert.length
    }

    revalidatePath(ROUTES.MEMBRES)
    return result
  } catch (err) {
    console.error('importMembers error:', err)
    return { error: 'Erreur inattendue lors de l\'import' }
  }
}

// ─── Upload de la photo de profil d'un membre ──────────────────────────────

const ALLOWED_PHOTO_MIME = ['image/png', 'image/jpeg', 'image/webp']
const MAX_PHOTO_SIZE = 5 * 1024 * 1024 // 5 Mo

export async function uploadMemberPhoto(
  formData: FormData
): Promise<{ success: true; url: string } | { error: string }> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    const roleError = await requireVerifiedRole(supabase, user, ['super_admin', 'gestionnaire'])
    if (roleError) return { error: roleError }

    const memberId = formData.get('member_id') as string
    const file = formData.get('file') as File | null
    if (!memberId) return { error: 'Membre manquant' }
    if (!file) return { error: 'Aucun fichier fourni' }

    if (!ALLOWED_PHOTO_MIME.includes(file.type)) {
      return { error: 'Format non supporté. Utilisez PNG, JPEG ou WebP.' }
    }
    if (file.size > MAX_PHOTO_SIZE) {
      return { error: 'La photo dépasse 5 Mo. Réduisez sa taille.' }
    }

    // Vérifier que le membre existe
    const { data: existing } = await supabase
      .from('members')
      .select('id, photo_url')
      .eq('id', memberId)
      .maybeSingle()
    if (!existing) return { error: 'Membre introuvable' }

    // Nom de fichier déterministe pour éviter d'accumuler des photos orphelines
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
    const path = `members/${memberId}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, bytes, {
        contentType: file.type,
        upsert: true,
        cacheControl: '3600',
      })
    if (uploadError) return { error: `Erreur upload : ${uploadError.message}` }

    // URL publique (bucket public)
    const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path)
    const url = `${pub.publicUrl}?v=${Date.now()}` // cache-buster pour update immédiat

    const { error: updateError } = await supabase
      .from('members')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ photo_url: url } as any)
      .eq('id', memberId)
    if (updateError) return { error: `Erreur mise à jour : ${updateError.message}` }

    revalidatePath(ROUTES.MEMBRES)
    return { success: true, url }
  } catch (err) {
    console.error('uploadMemberPhoto error:', err)
    return { error: 'Erreur inattendue lors de l\'upload de la photo' }
  }
}

export async function removeMemberPhoto(memberId: string): Promise<ActionResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    const roleError = await requireVerifiedRole(supabase, user, ['super_admin', 'gestionnaire'])
    if (roleError) return { error: roleError }

    const { data: existing } = await supabase
      .from('members')
      .select('id, photo_url')
      .eq('id', memberId)
      .maybeSingle()
    if (!existing) return { error: 'Membre introuvable' }

    // Suppression best-effort des fichiers (3 extensions possibles)
    await supabase.storage.from('avatars').remove([
      `members/${memberId}.png`,
      `members/${memberId}.jpg`,
      `members/${memberId}.webp`,
    ])

    const { error: updateError } = await supabase
      .from('members')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ photo_url: null } as any)
      .eq('id', memberId)
    if (updateError) return { error: `Erreur mise à jour : ${updateError.message}` }

    revalidatePath(ROUTES.MEMBRES)
    return { success: true }
  } catch (err) {
    console.error('removeMemberPhoto error:', err)
    return { error: 'Erreur inattendue' }
  }
}
