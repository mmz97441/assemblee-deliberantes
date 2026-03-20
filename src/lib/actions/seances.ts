'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ROUTES } from '@/lib/constants'
import type { SeanceRow, ODJPointRow, InstanceConfigRow, MemberRow } from '@/lib/supabase/types'

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

// ─── Types composites ────────────────────────────────────────────────────────

export interface SeanceWithDetails extends SeanceRow {
  instance_config: Pick<InstanceConfigRow, 'id' | 'nom' | 'type_legal'> | null
  odj_points: ODJPointRow[]
  convocataires: {
    id: string
    member_id: string
    statut_convocation: string | null
    member: Pick<MemberRow, 'id' | 'prenom' | 'nom' | 'email'> | null
  }[]
  president_effectif: Pick<MemberRow, 'id' | 'prenom' | 'nom'> | null
  secretaire_seance: Pick<MemberRow, 'id' | 'prenom' | 'nom'> | null
  _count_odj?: number
  _count_convocataires?: number
}

export interface SeanceListItem extends SeanceRow {
  instance_config: Pick<InstanceConfigRow, 'id' | 'nom'> | null
  _count_odj: number
  _count_convocataires: number
}

// ─── Liste des séances ───────────────────────────────────────────────────────

export async function getSeances(): Promise<{ data: SeanceListItem[] } | { error: string }> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifie' }

    const { data, error } = await supabase
      .from('seances')
      .select(`
        *,
        instance_config (id, nom),
        odj_points (id),
        convocataires (id)
      `)
      .order('date_seance', { ascending: false })

    if (error) return { error: `Erreur de chargement : ${error.message}` }

    const items: SeanceListItem[] = (data || []).map((s: Record<string, unknown>) => {
      const { odj_points, convocataires, ...rest } = s as SeanceRow & {
        instance_config: Pick<InstanceConfigRow, 'id' | 'nom'> | null
        odj_points: { id: string }[]
        convocataires: { id: string }[]
      }
      return {
        ...rest,
        instance_config: (s as Record<string, unknown>).instance_config as Pick<InstanceConfigRow, 'id' | 'nom'> | null,
        _count_odj: Array.isArray(odj_points) ? odj_points.length : 0,
        _count_convocataires: Array.isArray(convocataires) ? convocataires.length : 0,
      }
    })

    return { data: items }
  } catch (err) {
    console.error('getSeances error:', err)
    return { error: 'Erreur inattendue lors du chargement des seances' }
  }
}

// ─── Détail d'une séance ─────────────────────────────────────────────────────

export async function getSeance(id: string): Promise<{ data: SeanceWithDetails } | { error: string }> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifie' }

    const { data, error } = await supabase
      .from('seances')
      .select(`
        *,
        instance_config (id, nom, type_legal),
        odj_points (
          *
        ),
        convocataires (
          id,
          member_id,
          statut_convocation,
          member:members (id, prenom, nom, email)
        ),
        president_effectif:members!seances_president_effectif_seance_id_fkey (id, prenom, nom),
        secretaire_seance:members!seances_secretaire_seance_id_fkey (id, prenom, nom)
      `)
      .eq('id', id)
      .single()

    if (error) return { error: `Seance introuvable : ${error.message}` }

    // Sort ODJ by position
    if (data.odj_points && Array.isArray(data.odj_points)) {
      data.odj_points.sort((a: ODJPointRow, b: ODJPointRow) => a.position - b.position)
    }

    return { data: data as unknown as SeanceWithDetails }
  } catch (err) {
    console.error('getSeance error:', err)
    return { error: 'Erreur inattendue' }
  }
}

// ─── Création de séance ──────────────────────────────────────────────────────

export async function createSeance(formData: FormData): Promise<{ success: true; id: string } | { error: string }> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    const roleError = requireRole(user, ['super_admin', 'gestionnaire', 'president', 'secretaire_seance'])
    if (roleError) return { error: roleError }

    const titre = (formData.get('titre') as string)?.trim()
    const instanceId = formData.get('instance_id') as string
    const dateSeance = formData.get('date_seance') as string

    if (!titre) return { error: 'Le titre est requis' }
    if (!instanceId) return { error: "L'instance est requise" }
    if (!dateSeance) return { error: 'La date est requise' }

    const mode = (formData.get('mode') as string) || 'PRESENTIEL'
    const lieu = (formData.get('lieu') as string)?.trim() || null
    const publique = formData.get('publique') !== 'false'
    const notes = (formData.get('notes') as string)?.trim() || null
    const presidentId = (formData.get('president_effectif_seance_id') as string) || null
    const secretaireId = (formData.get('secretaire_seance_id') as string) || null

    // Fetch instance config for defaults
    const { data: instanceConfig } = await supabase
      .from('instance_config')
      .select('voix_preponderante, mode_arrivee_tardive, seances_publiques_defaut')
      .eq('id', instanceId)
      .single()

    const payload = {
      titre,
      instance_id: instanceId,
      date_seance: dateSeance,
      mode: mode as 'PRESENTIEL' | 'HYBRIDE' | 'VISIO',
      lieu,
      publique: instanceConfig?.seances_publiques_defaut ?? publique,
      voix_preponderante: instanceConfig?.voix_preponderante ?? false,
      late_arrival_mode: instanceConfig?.mode_arrivee_tardive ?? 'SOUPLE',
      notes,
      president_effectif_seance_id: presidentId,
      secretaire_seance_id: secretaireId,
      statut: 'BROUILLON' as const,
      created_by: user?.id ?? null,
    }

    const { data: newSeance, error } = await supabase
      .from('seances')
      .insert(payload)
      .select('id')
      .single()

    if (error) return { error: `Erreur de creation : ${error.message}` }

    // Auto-add instance members as convocataires
    const autoConvoque = formData.get('auto_convoque') !== 'false'
    if (autoConvoque && newSeance) {
      const { data: instanceMembers } = await supabase
        .from('instance_members')
        .select('member_id')
        .eq('instance_config_id', instanceId)
        .eq('actif', true)

      if (instanceMembers && instanceMembers.length > 0) {
        const convocataires = instanceMembers.map(im => ({
          seance_id: newSeance.id,
          member_id: im.member_id,
          statut_convocation: 'NON_ENVOYE' as const,
        }))

        const { error: convError } = await supabase
          .from('convocataires')
          .insert(convocataires)

        if (convError) {
          console.error('Error adding convocataires:', convError)
        }
      }
    }

    revalidatePath(ROUTES.SEANCES)
    return { success: true, id: newSeance.id }
  } catch (err) {
    console.error('createSeance error:', err)
    return { error: 'Erreur inattendue lors de la creation' }
  }
}

// ─── Mise à jour de séance ───────────────────────────────────────────────────

export async function updateSeance(formData: FormData): Promise<ActionResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    const roleError = requireRole(user, ['super_admin', 'gestionnaire', 'president', 'secretaire_seance'])
    if (roleError) return { error: roleError }

    const id = formData.get('id') as string
    if (!id) return { error: 'ID de la seance manquant' }

    const titre = (formData.get('titre') as string)?.trim()
    const instanceId = formData.get('instance_id') as string
    const dateSeance = formData.get('date_seance') as string

    if (!titre) return { error: 'Le titre est requis' }
    if (!instanceId) return { error: "L'instance est requise" }
    if (!dateSeance) return { error: 'La date est requise' }

    const payload = {
      titre,
      instance_id: instanceId,
      date_seance: dateSeance,
      mode: ((formData.get('mode') as string) || 'PRESENTIEL') as 'PRESENTIEL' | 'HYBRIDE' | 'VISIO',
      lieu: (formData.get('lieu') as string)?.trim() || null,
      publique: formData.get('publique') !== 'false',
      notes: (formData.get('notes') as string)?.trim() || null,
      president_effectif_seance_id: (formData.get('president_effectif_seance_id') as string) || null,
      secretaire_seance_id: (formData.get('secretaire_seance_id') as string) || null,
    }

    const { error } = await supabase
      .from('seances')
      .update(payload)
      .eq('id', id)

    if (error) return { error: `Erreur de mise a jour : ${error.message}` }

    revalidatePath(ROUTES.SEANCES)
    revalidatePath(`${ROUTES.SEANCES}/${id}`)
    return { success: true }
  } catch (err) {
    console.error('updateSeance error:', err)
    return { error: 'Erreur inattendue lors de la mise a jour' }
  }
}

// ─── Changement de statut ────────────────────────────────────────────────────

export async function updateSeanceStatut(
  id: string,
  statut: 'BROUILLON' | 'CONVOQUEE' | 'EN_COURS' | 'SUSPENDUE' | 'CLOTUREE' | 'ARCHIVEE'
): Promise<ActionResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    const roleError = requireRole(user, ['super_admin', 'gestionnaire', 'president', 'secretaire_seance'])
    if (roleError) return { error: roleError }

    const updateData: Record<string, unknown> = { statut }

    if (statut === 'EN_COURS') {
      updateData.heure_ouverture = new Date().toISOString()
    } else if (statut === 'CLOTUREE') {
      updateData.heure_cloture = new Date().toISOString()
    }

    const { error } = await supabase
      .from('seances')
      .update(updateData)
      .eq('id', id)

    if (error) return { error: `Erreur : ${error.message}` }

    revalidatePath(ROUTES.SEANCES)
    revalidatePath(`${ROUTES.SEANCES}/${id}`)
    return { success: true }
  } catch (err) {
    console.error('updateSeanceStatut error:', err)
    return { error: 'Erreur inattendue' }
  }
}

// ─── Suppression d'un brouillon ──────────────────────────────────────────────

export async function deleteSeance(id: string): Promise<ActionResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    const roleError = requireRole(user, ['super_admin', 'gestionnaire'])
    if (roleError) return { error: roleError }

    // Only allow deleting BROUILLON seances
    const { data: seance } = await supabase
      .from('seances')
      .select('statut')
      .eq('id', id)
      .single()

    if (!seance) return { error: 'Seance introuvable' }
    if (seance.statut !== 'BROUILLON') {
      return { error: 'Seule une seance en brouillon peut etre supprimee' }
    }

    // Delete convocataires first (FK)
    await supabase.from('convocataires').delete().eq('seance_id', id)
    // Delete ODJ points (FK)
    await supabase.from('odj_points').delete().eq('seance_id', id)
    // Delete seance
    const { error } = await supabase.from('seances').delete().eq('id', id)

    if (error) return { error: `Erreur de suppression : ${error.message}` }

    revalidatePath(ROUTES.SEANCES)
    return { success: true }
  } catch (err) {
    console.error('deleteSeance error:', err)
    return { error: 'Erreur inattendue' }
  }
}

// ─── Points ODJ ──────────────────────────────────────────────────────────────

export async function addODJPoint(formData: FormData): Promise<{ success: true; id: string } | { error: string }> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    const roleError = requireRole(user, ['super_admin', 'gestionnaire', 'president', 'secretaire_seance'])
    if (roleError) return { error: roleError }

    const seanceId = formData.get('seance_id') as string
    const titre = (formData.get('titre') as string)?.trim()

    if (!seanceId) return { error: 'ID de seance manquant' }
    if (!titre) return { error: 'Le titre du point est requis' }

    // Get next position
    const { data: existingPoints } = await supabase
      .from('odj_points')
      .select('position')
      .eq('seance_id', seanceId)
      .order('position', { ascending: false })
      .limit(1)

    const nextPosition = existingPoints && existingPoints.length > 0
      ? existingPoints[0].position + 1
      : 1

    const typeTraitement = (formData.get('type_traitement') as string) || 'DELIBERATION'
    const majoriteRequise = (formData.get('majorite_requise') as string) || 'SIMPLE'

    const payload = {
      seance_id: seanceId,
      titre,
      description: (formData.get('description') as string)?.trim() || null,
      type_traitement: typeTraitement as 'DELIBERATION' | 'INFORMATION' | 'QUESTION_DIVERSE' | 'ELECTION' | 'APPROBATION_PV',
      majorite_requise: majoriteRequise as 'SIMPLE' | 'ABSOLUE' | 'QUALIFIEE' | 'UNANIMITE',
      rapporteur_id: (formData.get('rapporteur_id') as string) || null,
      huis_clos: formData.get('huis_clos') === 'true',
      votes_interdits: formData.get('votes_interdits') === 'true',
      projet_deliberation: (formData.get('projet_deliberation') as string)?.trim() || null,
      position: nextPosition,
      statut: 'A_TRAITER',
    }

    const { data, error } = await supabase
      .from('odj_points')
      .insert(payload)
      .select('id')
      .single()

    if (error) return { error: `Erreur de creation : ${error.message}` }

    revalidatePath(`${ROUTES.SEANCES}/${seanceId}`)
    return { success: true, id: data.id }
  } catch (err) {
    console.error('addODJPoint error:', err)
    return { error: 'Erreur inattendue' }
  }
}

export async function updateODJPoint(formData: FormData): Promise<ActionResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    const roleError = requireRole(user, ['super_admin', 'gestionnaire', 'president', 'secretaire_seance'])
    if (roleError) return { error: roleError }

    const id = formData.get('id') as string
    const seanceId = formData.get('seance_id') as string
    if (!id) return { error: 'ID du point manquant' }

    const titre = (formData.get('titre') as string)?.trim()
    if (!titre) return { error: 'Le titre est requis' }

    const payload = {
      titre,
      description: (formData.get('description') as string)?.trim() || null,
      type_traitement: ((formData.get('type_traitement') as string) || 'DELIBERATION') as 'DELIBERATION' | 'INFORMATION' | 'QUESTION_DIVERSE' | 'ELECTION' | 'APPROBATION_PV',
      majorite_requise: ((formData.get('majorite_requise') as string) || 'SIMPLE') as 'SIMPLE' | 'ABSOLUE' | 'QUALIFIEE' | 'UNANIMITE',
      rapporteur_id: (formData.get('rapporteur_id') as string) || null,
      huis_clos: formData.get('huis_clos') === 'true',
      votes_interdits: formData.get('votes_interdits') === 'true',
      projet_deliberation: (formData.get('projet_deliberation') as string)?.trim() || null,
    }

    const { error } = await supabase
      .from('odj_points')
      .update(payload)
      .eq('id', id)

    if (error) return { error: `Erreur de mise a jour : ${error.message}` }

    revalidatePath(`${ROUTES.SEANCES}/${seanceId}`)
    return { success: true }
  } catch (err) {
    console.error('updateODJPoint error:', err)
    return { error: 'Erreur inattendue' }
  }
}

export async function deleteODJPoint(id: string, seanceId: string): Promise<ActionResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    const roleError = requireRole(user, ['super_admin', 'gestionnaire', 'president', 'secretaire_seance'])
    if (roleError) return { error: roleError }

    const { error } = await supabase
      .from('odj_points')
      .delete()
      .eq('id', id)

    if (error) return { error: `Erreur de suppression : ${error.message}` }

    // Re-number remaining points
    const { data: remainingPoints } = await supabase
      .from('odj_points')
      .select('id, position')
      .eq('seance_id', seanceId)
      .order('position', { ascending: true })

    if (remainingPoints) {
      for (let i = 0; i < remainingPoints.length; i++) {
        if (remainingPoints[i].position !== i + 1) {
          await supabase
            .from('odj_points')
            .update({ position: i + 1 })
            .eq('id', remainingPoints[i].id)
        }
      }
    }

    revalidatePath(`${ROUTES.SEANCES}/${seanceId}`)
    return { success: true }
  } catch (err) {
    console.error('deleteODJPoint error:', err)
    return { error: 'Erreur inattendue' }
  }
}

export async function reorderODJPoints(
  seanceId: string,
  orderedIds: string[]
): Promise<ActionResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    const roleError = requireRole(user, ['super_admin', 'gestionnaire', 'president', 'secretaire_seance'])
    if (roleError) return { error: roleError }

    for (let i = 0; i < orderedIds.length; i++) {
      const { error } = await supabase
        .from('odj_points')
        .update({ position: i + 1 })
        .eq('id', orderedIds[i])
        .eq('seance_id', seanceId)

      if (error) return { error: `Erreur de reordonnancement : ${error.message}` }
    }

    revalidatePath(`${ROUTES.SEANCES}/${seanceId}`)
    return { success: true }
  } catch (err) {
    console.error('reorderODJPoints error:', err)
    return { error: 'Erreur inattendue' }
  }
}

// ─── Points ODJ standards ─────────────────────────────────────────────────────

export async function addStandardODJPoints(seanceId: string): Promise<ActionResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    const roleError = requireRole(user, ['super_admin', 'gestionnaire', 'president', 'secretaire_seance'])
    if (roleError) return { error: roleError }

    if (!seanceId) return { error: 'ID de seance manquant' }

    // Fetch existing points to check for duplicates and determine positions
    const { data: existingPoints, error: fetchError } = await supabase
      .from('odj_points')
      .select('id, position, type_traitement')
      .eq('seance_id', seanceId)
      .order('position', { ascending: true })

    if (fetchError) return { error: `Erreur de chargement : ${fetchError.message}` }

    const points = existingPoints || []
    const hasApprobationPV = points.some(p => p.type_traitement === 'APPROBATION_PV')
    const hasQuestionDiverse = points.some(p => p.type_traitement === 'QUESTION_DIVERSE')

    if (hasApprobationPV && hasQuestionDiverse) {
      return { error: 'Les points standards (Approbation PV et Questions diverses) existent deja' }
    }

    // If adding APPROBATION_PV at position 1, shift all existing points down
    if (!hasApprobationPV) {
      // Shift all existing points by +1
      for (const p of points) {
        const { error: shiftError } = await supabase
          .from('odj_points')
          .update({ position: p.position + 1 })
          .eq('id', p.id)

        if (shiftError) return { error: `Erreur de reordonnancement : ${shiftError.message}` }
      }

      // Insert Approbation PV at position 1
      const { error: insertPVError } = await supabase
        .from('odj_points')
        .insert({
          seance_id: seanceId,
          titre: 'Approbation du proces-verbal de la seance precedente',
          description: null,
          type_traitement: 'APPROBATION_PV' as const,
          majorite_requise: 'SIMPLE' as const,
          rapporteur_id: null,
          huis_clos: false,
          votes_interdits: false,
          position: 1,
          statut: 'A_TRAITER',
        })

      if (insertPVError) return { error: `Erreur de creation : ${insertPVError.message}` }
    }

    // Determine position for Questions diverses (last)
    if (!hasQuestionDiverse) {
      // Re-fetch to get updated positions
      const { data: updatedPoints } = await supabase
        .from('odj_points')
        .select('position')
        .eq('seance_id', seanceId)
        .order('position', { ascending: false })
        .limit(1)

      const lastPosition = updatedPoints && updatedPoints.length > 0
        ? updatedPoints[0].position + 1
        : 1

      const { error: insertQDError } = await supabase
        .from('odj_points')
        .insert({
          seance_id: seanceId,
          titre: 'Questions diverses',
          description: null,
          type_traitement: 'QUESTION_DIVERSE' as const,
          majorite_requise: 'SIMPLE' as const,
          rapporteur_id: null,
          huis_clos: false,
          votes_interdits: true,
          position: lastPosition,
          statut: 'A_TRAITER',
        })

      if (insertQDError) return { error: `Erreur de creation : ${insertQDError.message}` }
    }

    revalidatePath(`${ROUTES.SEANCES}/${seanceId}`)
    return { success: true }
  } catch (err) {
    console.error('addStandardODJPoints error:', err)
    return { error: 'Erreur inattendue' }
  }
}

// ─── Convocataires ───────────────────────────────────────────────────────────

export async function addConvocataire(seanceId: string, memberId: string): Promise<ActionResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    const roleError = requireRole(user, ['super_admin', 'gestionnaire', 'president', 'secretaire_seance'])
    if (roleError) return { error: roleError }

    const { error } = await supabase
      .from('convocataires')
      .insert({
        seance_id: seanceId,
        member_id: memberId,
        statut_convocation: 'NON_ENVOYE',
      })

    if (error) {
      if (error.code === '23505') return { error: 'Ce membre est deja convoque' }
      return { error: `Erreur : ${error.message}` }
    }

    revalidatePath(`${ROUTES.SEANCES}/${seanceId}`)
    return { success: true }
  } catch (err) {
    console.error('addConvocataire error:', err)
    return { error: 'Erreur inattendue' }
  }
}

export async function removeConvocataire(seanceId: string, memberId: string): Promise<ActionResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    const roleError = requireRole(user, ['super_admin', 'gestionnaire', 'president', 'secretaire_seance'])
    if (roleError) return { error: roleError }

    const { error } = await supabase
      .from('convocataires')
      .delete()
      .eq('seance_id', seanceId)
      .eq('member_id', memberId)

    if (error) return { error: `Erreur : ${error.message}` }

    revalidatePath(`${ROUTES.SEANCES}/${seanceId}`)
    return { success: true }
  } catch (err) {
    console.error('removeConvocataire error:', err)
    return { error: 'Erreur inattendue' }
  }
}
