'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ROUTES } from '@/lib/constants'
import type { SeanceRow, ODJPointRow, InstanceConfigRow, MemberRow } from '@/lib/supabase/types'
import { addPVApprovalODJPoint } from '@/lib/actions/phase2-features'
import { autoCreateDeliberationsForSeance } from '@/lib/actions/deliberations'

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
    if (!user) return { error: 'Non authentifié' }

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
    return { error: 'Erreur inattendue lors du chargement des séances' }
  }
}

// ─── Détail d'une séance ─────────────────────────────────────────────────────

export async function getSeance(id: string): Promise<{ data: SeanceWithDetails } | { error: string }> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

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

    if (error) return { error: `Séance introuvable : ${error.message}` }

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

    // Validate date is not in the past
    const parsedDateSeance = new Date(dateSeance)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (parsedDateSeance < today) {
      return { error: 'La date de la séance ne peut pas être dans le passé.' }
    }

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

    if (error) return { error: `Erreur de création : ${error.message}` }

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

    // Auto-add PV approval ODJ point if previous séance has a signed PV
    if (newSeance) {
      await addPVApprovalODJPoint(newSeance.id, instanceId).catch(err => {
        console.error('Error auto-adding PV approval point:', err)
      })
    }

    revalidatePath(ROUTES.SEANCES)
    return { success: true, id: newSeance.id }
  } catch (err) {
    console.error('createSeance error:', err)
    return { error: 'Erreur inattendue lors de la création' }
  }
}

// ─── Mise à jour de séance ───────────────────────────────────────────────────

export async function updateSeance(formData: FormData): Promise<ActionResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    const roleError = requireRole(user, ['super_admin', 'gestionnaire', 'president', 'secretaire_seance'])
    if (roleError) return { error: roleError }

    const id = formData.get('id') as string
    if (!id) return { error: 'ID de la séance manquant' }

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

    if (error) return { error: `Erreur de mise à jour : ${error.message}` }

    revalidatePath(ROUTES.SEANCES)
    revalidatePath(`${ROUTES.SEANCES}/${id}`)
    return { success: true }
  } catch (err) {
    console.error('updateSeance error:', err)
    return { error: 'Erreur inattendue lors de la mise à jour' }
  }
}

// ─── Changement de statut ────────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<string, string[]> = {
  'BROUILLON': ['CONVOQUEE'],
  'CONVOQUEE': ['EN_COURS', 'BROUILLON', 'ARCHIVEE'],
  'EN_COURS': ['SUSPENDUE', 'CLOTUREE'],
  'SUSPENDUE': ['EN_COURS', 'CLOTUREE'],
  'CLOTUREE': ['ARCHIVEE'],
  'ARCHIVEE': ['CLOTUREE'],
}

export async function updateSeanceStatut(
  id: string,
  statut: 'BROUILLON' | 'CONVOQUEE' | 'EN_COURS' | 'SUSPENDUE' | 'CLOTUREE' | 'ARCHIVEE'
): Promise<ActionResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    const roleError = requireRole(user, ['super_admin', 'gestionnaire', 'president', 'secretaire_seance'])
    if (roleError) return { error: roleError }

    // Validate transition
    const { data: currentSeance } = await supabase
      .from('seances')
      .select('statut, president_effectif_seance_id')
      .eq('id', id)
      .single()

    const currentStatut = currentSeance?.statut || 'BROUILLON'
    const allowed = VALID_TRANSITIONS[currentStatut] || []
    if (!allowed.includes(statut)) {
      return { error: `Transition impossible : ${currentStatut} → ${statut}. Transitions autorisées : ${allowed.join(', ') || 'aucune'}` }
    }

    // ── CGCT Guards per transition ──────────────────────────────────────

    // BROUILLON → CONVOQUEE: must have ODJ, convocataires, president
    if (currentStatut === 'BROUILLON' && statut === 'CONVOQUEE') {
      const { count: odjCount } = await supabase
        .from('odj_points')
        .select('*', { count: 'exact', head: true })
        .eq('seance_id', id)

      if (!odjCount || odjCount === 0) {
        return { error: 'Impossible de convoquer : ajoutez au moins un point à l\'ordre du jour avant de convoquer la séance.' }
      }

      const { count: convCount } = await supabase
        .from('convocataires')
        .select('*', { count: 'exact', head: true })
        .eq('seance_id', id)

      if (!convCount || convCount === 0) {
        return { error: 'Impossible de convoquer : ajoutez au moins un convocataire avant de convoquer la séance.' }
      }

      if (!currentSeance?.president_effectif_seance_id) {
        return { error: 'Impossible de convoquer : désignez le président de séance avant de convoquer (CGCT L2121-10).' }
      }
    }

    // CONVOQUEE → EN_COURS: convocations must have been actually sent (CGCT L2121-10)
    if (currentStatut === 'CONVOQUEE' && statut === 'EN_COURS') {
      const { count: sentCount } = await supabase
        .from('convocataires')
        .select('*', { count: 'exact', head: true })
        .eq('seance_id', id)
        .in('statut_convocation', ['ENVOYE', 'CONFIRME_PRESENT', 'LU'])

      if (!sentCount || sentCount === 0) {
        return { error: 'Impossible d\'ouvrir la séance : aucune convocation n\'a été effectivement envoyée. Envoyez les convocations depuis l\'onglet « Convocataires » (CGCT L2121-10).' }
      }
    }

    // EN_COURS → SUSPENDUE: check no open votes
    if (currentStatut === 'EN_COURS' && statut === 'SUSPENDUE') {
      const { data: openVotesSuspend } = await supabase
        .from('votes')
        .select('id')
        .eq('seance_id', id)
        .eq('statut', 'OUVERT')

      if (openVotesSuspend && openVotesSuspend.length > 0) {
        return { error: 'Un vote est en cours \u2014 cl\u00f4turez ou annulez le vote avant de suspendre la s\u00e9ance.' }
      }
    }

    // EN_COURS → CLOTUREE: all votes must be closed (no dangling open votes)
    if (currentStatut === 'EN_COURS' && statut === 'CLOTUREE') {
      const { data: openVotes } = await supabase
        .from('votes')
        .select('id, question')
        .eq('seance_id', id)
        .eq('statut', 'OUVERT')

      if (openVotes && openVotes.length > 0) {
        const pointName = openVotes[0].question || 'un point'
        return { error: `Impossible de cl\u00f4turer : un vote est encore ouvert sur \u00ab ${pointName} \u00bb. Cl\u00f4turez ou annulez tous les votes avant de fermer la s\u00e9ance.` }
      }
    }

    // ── End CGCT Guards ─────────────────────────────────────────────────

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

    // Auto-create deliberation drafts when seance is closed
    if (statut === 'CLOTUREE') {
      try {
        const delibResult = await autoCreateDeliberationsForSeance(id)
        if ('error' in delibResult) {
          console.warn('Auto-creation deliberations warning:', delibResult.error)
        } else if (delibResult.count > 0) {
          console.log(`Auto-created ${delibResult.count} deliberation(s) for seance ${id}`)
        }
      } catch (delibErr) {
        // Don't fail the seance cloture if deliberation creation fails
        console.error('Auto-creation deliberations error:', delibErr)
      }
    }

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

    if (!seance) return { error: 'Séance introuvable' }
    if (seance.statut !== 'BROUILLON') {
      return { error: 'Seules les séances en brouillon peuvent être supprimées. Utilisez l\'archivage pour les séances convoquées ou clôturées.' }
    }

    // Extra check: no convocations sent
    const { count: sentCount } = await supabase
      .from('convocataires')
      .select('*', { count: 'exact', head: true })
      .eq('seance_id', id)
      .neq('statut_convocation', 'NON_ENVOYE')

    if (sentCount && sentCount > 0) {
      return { error: 'Des convocations ont déjà été envoyées — cette séance ne peut pas être supprimée. Archivez-la à la place.' }
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

// ─── Archivage / Désarchivage ────────────────────────────────────────────────

export async function archiveSeance(id: string): Promise<ActionResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    const roleError = requireRole(user, ['super_admin', 'gestionnaire'])
    if (roleError) return { error: roleError }

    const { data: seance } = await supabase
      .from('seances')
      .select('statut')
      .eq('id', id)
      .single()

    if (!seance) return { error: 'Séance introuvable' }

    // BROUILLON should be deleted, not archived
    if (seance.statut === 'BROUILLON') {
      return { error: 'Un brouillon doit être supprimé, pas archivé.' }
    }
    if (seance.statut === 'ARCHIVEE') {
      return { error: 'Cette séance est déjà archivée.' }
    }
    if (seance.statut === 'EN_COURS' || seance.statut === 'SUSPENDUE') {
      return { error: 'Impossible d\'archiver une séance en cours ou suspendue. Clôturez-la d\'abord.' }
    }

    // Check if séance had closed votes — if so, PV must be signed
    const { count: voteCount } = await supabase
      .from('votes')
      .select('*', { count: 'exact', head: true })
      .eq('seance_id', id)
      .eq('statut', 'CLOS')

    if (voteCount && voteCount > 0) {
      const { data: pv } = await supabase
        .from('pv')
        .select('statut')
        .eq('seance_id', id)
        .maybeSingle()

      if (!pv) {
        return { error: 'La séance a eu des votes \u2014 un procès-verbal doit être rédigé et signé avant l\'archivage.' }
      }
      if (pv.statut !== 'SIGNE' && pv.statut !== 'PUBLIE') {
        return { error: 'Le procès-verbal doit être signé avant d\'archiver la séance. Statut actuel du PV : ' + (pv.statut === 'BROUILLON' ? 'brouillon' : pv.statut === 'EN_RELECTURE' ? 'en relecture' : pv.statut) + '.' }
      }
    }

    // Check unpublished deliberations
    const { count: unpublishedDelibs } = await supabase
      .from('deliberations')
      .select('*', { count: 'exact', head: true })
      .eq('seance_id', id)
      .is('publie_at', null)
      .eq('annulee', false)

    if (unpublishedDelibs && unpublishedDelibs > 0) {
      return { error: unpublishedDelibs + ' délibération(s) non publiée(s). Publiez ou supprimez les brouillons avant d\'archiver.' }
    }

    const { error } = await supabase
      .from('seances')
      .update({ statut: 'ARCHIVEE' })
      .eq('id', id)

    if (error) return { error: `Erreur d'archivage : ${error.message}` }

    revalidatePath(ROUTES.SEANCES)
    revalidatePath(`${ROUTES.SEANCES}/${id}`)
    return { success: true }
  } catch (err) {
    console.error('archiveSeance error:', err)
    return { error: 'Erreur inattendue' }
  }
}

export async function unarchiveSeance(id: string): Promise<ActionResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    const roleError = requireRole(user, ['super_admin', 'gestionnaire'])
    if (roleError) return { error: roleError }

    const { data: seance } = await supabase
      .from('seances')
      .select('statut')
      .eq('id', id)
      .single()

    if (!seance) return { error: 'Séance introuvable' }
    if (seance.statut !== 'ARCHIVEE') {
      return { error: 'Cette séance n\'est pas archivée.' }
    }

    // Restore to CLOTUREE (safe default for archived séances)
    const { error } = await supabase
      .from('seances')
      .update({ statut: 'CLOTUREE' })
      .eq('id', id)

    if (error) return { error: `Erreur de désarchivage : ${error.message}` }

    revalidatePath(ROUTES.SEANCES)
    revalidatePath(`${ROUTES.SEANCES}/${id}`)
    return { success: true }
  } catch (err) {
    console.error('unarchiveSeance error:', err)
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

    if (!seanceId) return { error: 'ID de séance manquant' }
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

    if (error) return { error: `Erreur de création : ${error.message}` }

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

    // Check if convocations have been sent — ODJ is communicated and cannot change
    const { count: sentCount } = await supabase
      .from('convocataires')
      .select('*', { count: 'exact', head: true })
      .eq('seance_id', seanceId)
      .neq('statut_convocation', 'NON_ENVOYE')

    if (sentCount && sentCount > 0) {
      return { error: 'L\'ordre du jour ne peut plus être modifié après l\'envoi des convocations. L\'ODJ a été communiqué aux membres.' }
    }

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

    if (error) return { error: `Erreur de mise à jour : ${error.message}` }

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

    // Check if convocations have been sent — ODJ is communicated and cannot change
    const { count: sentCount } = await supabase
      .from('convocataires')
      .select('*', { count: 'exact', head: true })
      .eq('seance_id', seanceId)
      .neq('statut_convocation', 'NON_ENVOYE')

    if (sentCount && sentCount > 0) {
      return { error: 'L\'ordre du jour ne peut plus être modifié après l\'envoi des convocations. L\'ODJ a été communiqué aux membres.' }
    }

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

    // Check if convocations have been sent — ODJ is communicated and cannot change
    const { count: sentCount } = await supabase
      .from('convocataires')
      .select('*', { count: 'exact', head: true })
      .eq('seance_id', seanceId)
      .neq('statut_convocation', 'NON_ENVOYE')

    if (sentCount && sentCount > 0) {
      return { error: 'L\'ordre du jour ne peut plus être modifié après l\'envoi des convocations. L\'ODJ a été communiqué aux membres.' }
    }

    for (let i = 0; i < orderedIds.length; i++) {
      const { error } = await supabase
        .from('odj_points')
        .update({ position: i + 1 })
        .eq('id', orderedIds[i])
        .eq('seance_id', seanceId)

      if (error) return { error: `Erreur de réordonnancement : ${error.message}` }
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

    if (!seanceId) return { error: 'ID de séance manquant' }

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
      return { error: 'Les points standards (Approbation PV et Questions diverses) existent déjà' }
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
          titre: 'Approbation du procès-verbal de la séance précédente',
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
    console.error('addStandardODJPoints error:', err instanceof Error ? err.message : err, err)
    return { error: `Erreur inattendue : ${err instanceof Error ? err.message : String(err)}` }
  }
}

// ─── Duplication de séance ───────────────────────────────────────────────────

export async function duplicateSeance(
  sourceSeanceId: string
): Promise<{ success: true; newSeanceId: string } | { error: string }> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    const roleError = requireRole(user, ['super_admin', 'gestionnaire'])
    if (roleError) return { error: roleError }

    // Fetch source séance with ODJ and convocataires
    const { data: source, error: fetchError } = await supabase
      .from('seances')
      .select(`
        *,
        odj_points (*),
        convocataires (member_id)
      `)
      .eq('id', sourceSeanceId)
      .single()

    if (fetchError || !source) return { error: 'Séance source introuvable' }

    // Compute new date: today + 7 days, same time as original
    const originalDate = new Date(source.date_seance)
    const newDate = new Date()
    newDate.setDate(newDate.getDate() + 7)
    newDate.setHours(originalDate.getHours(), originalDate.getMinutes(), originalDate.getSeconds(), 0)

    // Create new séance
    const { data: newSeance, error: insertError } = await supabase
      .from('seances')
      .insert({
        titre: `${source.titre} (copie)`,
        instance_id: source.instance_id,
        date_seance: newDate.toISOString(),
        mode: source.mode,
        lieu: source.lieu,
        publique: source.publique,
        voix_preponderante: source.voix_preponderante,
        late_arrival_mode: source.late_arrival_mode,
        notes: source.notes,
        president_effectif_seance_id: null,
        secretaire_seance_id: null,
        statut: 'BROUILLON' as const,
        created_by: user?.id ?? null,
      })
      .select('id')
      .single()

    if (insertError || !newSeance) {
      return { error: `Erreur de duplication : ${insertError?.message || 'Erreur inconnue'}` }
    }

    // Copy ODJ points
    const odjPoints = source.odj_points as ODJPointRow[]
    if (odjPoints && odjPoints.length > 0) {
      const sortedPoints = [...odjPoints].sort((a, b) => a.position - b.position)
      const odjPayloads = sortedPoints.map((p) => ({
        seance_id: newSeance.id,
        titre: p.titre,
        description: p.description,
        type_traitement: p.type_traitement,
        majorite_requise: p.majorite_requise,
        rapporteur_id: p.rapporteur_id,
        huis_clos: p.huis_clos,
        votes_interdits: p.votes_interdits,
        projet_deliberation: p.projet_deliberation,
        position: p.position,
        statut: 'A_TRAITER',
        notes_seance: null,
        documents: null,
      }))

      const { error: odjError } = await supabase
        .from('odj_points')
        .insert(odjPayloads)

      if (odjError) {
        console.error('Error copying ODJ points:', odjError)
      }
    }

    // Copy convocataires
    const convocataires = source.convocataires as { member_id: string }[]
    if (convocataires && convocataires.length > 0) {
      const convPayloads = convocataires.map((c) => ({
        seance_id: newSeance.id,
        member_id: c.member_id,
        statut_convocation: 'NON_ENVOYE' as const,
      }))

      const { error: convError } = await supabase
        .from('convocataires')
        .insert(convPayloads)

      if (convError) {
        console.error('Error copying convocataires:', convError)
      }
    }

    revalidatePath(ROUTES.SEANCES)
    return { success: true, newSeanceId: newSeance.id }
  } catch (err) {
    console.error('duplicateSeance error:', err)
    return { error: 'Erreur inattendue lors de la duplication' }
  }
}

// ─── Reconvocation (quorum non atteint) ─────────────────────────────────────

/**
 * Reconvoque une séance quand le quorum n\'est pas atteint.
 * Crée une nouvelle séance à J+3 (CGCT L2121-17 : pas de condition de quorum).
 * L'ancienne séance est marquée comme "CLOTUREE" avec un PV de carence.
 */
export async function reconvoquerSeance(
  seanceId: string
): Promise<{ success: true; newSeanceId: string } | { error: string }> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    const roleError = requireRole(user, ['super_admin', 'gestionnaire'])
    if (roleError) return { error: roleError }

    // Fetch source séance
    const { data: source } = await supabase
      .from('seances')
      .select('*, odj_points (*), convocataires (member_id)')
      .eq('id', seanceId)
      .single()

    if (!source) return { error: 'Séance introuvable' }

    // Calculate reconvocation date (J+3)
    const sourceDate = new Date(source.date_seance)
    const reconvocationDate = new Date(sourceDate)
    reconvocationDate.setDate(reconvocationDate.getDate() + 3)
    // Keep the same time
    reconvocationDate.setHours(sourceDate.getHours(), sourceDate.getMinutes())

    // Create new séance (reconvocation)
    const { data: newSeance, error: createError } = await supabase
      .from('seances')
      .insert({
        titre: source.titre,
        date_seance: reconvocationDate.toISOString(),
        instance_id: source.instance_id,
        statut: 'BROUILLON' as const,
        mode: source.mode,
        lieu: source.lieu,
        publique: source.publique,
        reconvocation: true,
        notes: `Reconvocation de la séance du ${sourceDate.toLocaleDateString('fr-FR')} — quorum non atteint. CGCT L2121-17 : cette séance se tient sans condition de quorum.`,
      })
      .select('id')
      .single()

    if (createError || !newSeance) {
      return { error: `Erreur lors de la création : ${createError?.message || 'inconnue'}` }
    }

    // Copy ODJ points
    const sortedPoints = (source.odj_points || []).sort(
      (a: ODJPointRow, b: ODJPointRow) => a.position - b.position
    )
    for (const point of sortedPoints) {
      await supabase.from('odj_points').insert({
        seance_id: newSeance.id,
        titre: point.titre,
        description: point.description,
        type_traitement: point.type_traitement,
        majorite_requise: point.majorite_requise,
        position: point.position,
        rapporteur_id: point.rapporteur_id,
        huis_clos: point.huis_clos,
        votes_interdits: point.votes_interdits,
        projet_deliberation: point.projet_deliberation,
      })
    }

    // Copy convocataires
    const memberIds = (source.convocataires || []).map((c: { member_id: string }) => c.member_id)
    for (const memberId of memberIds) {
      await supabase.from('convocataires').insert({
        seance_id: newSeance.id,
        member_id: memberId,
        statut_convocation: 'NON_ENVOYE' as const,
      })
    }

    // Close the original séance as "carence" (quorum not met)
    await supabase
      .from('seances')
      .update({
        statut: 'CLOTUREE' as const,
        notes: (source.notes || '') + '\n\n⚠️ Séance close pour défaut de quorum. Reconvocation effectuée.',
      })
      .eq('id', seanceId)

    revalidatePath(ROUTES.SEANCES)
    revalidatePath(`/seances/${seanceId}`)
    return { success: true, newSeanceId: newSeance.id }
  } catch (err) {
    console.error('reconvoquerSeance error:', err)
    return { error: 'Erreur inattendue lors de la reconvocation' }
  }
}

// ─── Convocataires ───────────────────────────────────────────────────────────

export async function addConvocataire(seanceId: string, memberId: string): Promise<ActionResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    const roleError = requireRole(user, ['super_admin', 'gestionnaire', 'president', 'secretaire_seance'])
    if (roleError) return { error: roleError }

    // Block adding convocataires if séance is EN_COURS or later
    const { data: seance } = await supabase
      .from('seances')
      .select('statut')
      .eq('id', seanceId)
      .single()

    if (seance && ['EN_COURS', 'SUSPENDUE', 'CLOTUREE', 'ARCHIVEE'].includes(seance.statut || '')) {
      return { error: 'La liste des convocataires ne peut plus être modifiée une fois la séance ouverte.' }
    }

    const { error } = await supabase
      .from('convocataires')
      .insert({
        seance_id: seanceId,
        member_id: memberId,
        statut_convocation: 'NON_ENVOYE',
      })

    if (error) {
      if (error.code === '23505') return { error: 'Ce membre est déjà convoqué' }
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

    // Check if this specific convocataire has already been sent a convocation
    const { data: conv } = await supabase
      .from('convocataires')
      .select('statut_convocation')
      .eq('seance_id', seanceId)
      .eq('member_id', memberId)
      .maybeSingle()

    if (conv && conv.statut_convocation && conv.statut_convocation !== 'NON_ENVOYE') {
      return { error: 'Ce membre a déjà reçu sa convocation — il ne peut plus être retiré de la liste.' }
    }

    // Block removal if séance is EN_COURS or later
    const { data: seance } = await supabase
      .from('seances')
      .select('statut')
      .eq('id', seanceId)
      .single()

    if (seance && ['EN_COURS', 'SUSPENDUE', 'CLOTUREE', 'ARCHIVEE'].includes(seance.statut || '')) {
      return { error: 'La liste des convocataires ne peut plus être modifiée une fois la séance ouverte.' }
    }

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
