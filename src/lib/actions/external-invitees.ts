'use server'

/**
 * Server actions pour les invités externes (préfet, trésorier-payeur,
 * journaliste, partenaire associatif…).
 *
 * Règles juridiques (cf. migration 00036) :
 *   - Un invité externe peut être convoqué et émarger
 *   - Il N'EST PAS COMPTÉ dans le quorum
 *   - Il NE PEUT PAS voter
 *   - Il ne peut pas être président ni secrétaire de séance
 *
 * Permissions :
 *   - CRUD réservé aux 4 rôles privilégiés (super_admin / dgs /
 *     directeur_cabinet / gestionnaire) — cohérent avec la RLS définie
 *     dans la migration 00036.
 */

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ROUTES } from '@/lib/constants'
import { requireVerifiedRole } from '@/lib/auth/require-role'
import { validateEmail } from '@/lib/validators/email'
import type { ExternalInviteeRow } from '@/lib/supabase/types'

type ActionResult = { success: true } | { success: true; id: string } | { error: string }

async function getAuthenticatedUser() {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    return { user: null, supabase }
  }
  return { user: data.user, supabase }
}

/**
 * Liste les invités externes (actifs par défaut, ou archivés si demandé).
 */
export async function getExternalInvitees(
  options: { includeArchived?: boolean } = {},
): Promise<{ data: ExternalInviteeRow[] } | { error: string }> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    let query = supabase
      .from('external_invitees')
      .select('*')
      .order('nom', { ascending: true })
      .order('prenom', { ascending: true })

    if (!options.includeArchived) {
      query = query.is('archived_at', null)
    }

    const { data, error } = await query
    if (error) return { error: `Erreur de chargement : ${error.message}` }
    return { data: (data as ExternalInviteeRow[]) || [] }
  } catch (err) {
    console.error('getExternalInvitees error:', err)
    return { error: 'Erreur inattendue lors du chargement' }
  }
}

export async function createExternalInvitee(formData: FormData): Promise<ActionResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    const roleError = await requireVerifiedRole(supabase, user, ['super_admin', 'dgs', 'directeur_cabinet', 'gestionnaire'])
    if (roleError) return { error: roleError }

    const civiliteRaw = (formData.get('civilite') as string)?.trim()
    const prenom = (formData.get('prenom') as string)?.trim()
    const nom = (formData.get('nom') as string)?.trim()
    const emailRaw = (formData.get('email') as string)?.trim()

    if (!civiliteRaw || !['MADAME', 'MONSIEUR', 'AUTRE'].includes(civiliteRaw)) {
      return { error: 'La civilité est requise (Madame / Monsieur / Autre)' }
    }
    const civilite = civiliteRaw as 'MADAME' | 'MONSIEUR' | 'AUTRE'
    if (!prenom) return { error: 'Le prénom est requis' }
    if (!nom) return { error: 'Le nom est requis' }
    if (!emailRaw) return { error: "L'email est requis" }
    const emailCheck = validateEmail(emailRaw)
    if (!emailCheck.ok) return { error: emailCheck.error }

    const payload = {
      civilite,
      prenom,
      nom,
      email: emailCheck.email,
      organisation: (formData.get('organisation') as string)?.trim() || null,
      qualite_officielle: (formData.get('qualite_officielle') as string)?.trim() || null,
      telephone: (formData.get('telephone') as string)?.trim() || null,
      notes: (formData.get('notes') as string)?.trim() || null,
      created_by: user?.id || null,
    }

    const { data: inserted, error } = await supabase
      .from('external_invitees')
      .insert(payload)
      .select('id')
      .single()

    if (error) return { error: `Erreur de création : ${error.message}` }

    revalidatePath(ROUTES.MEMBRES)
    return { success: true, id: inserted.id }
  } catch (err) {
    console.error('createExternalInvitee error:', err)
    return { error: 'Erreur inattendue lors de la création' }
  }
}

export async function updateExternalInvitee(formData: FormData): Promise<ActionResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    const roleError = await requireVerifiedRole(supabase, user, ['super_admin', 'dgs', 'directeur_cabinet', 'gestionnaire'])
    if (roleError) return { error: roleError }

    const id = formData.get('id') as string
    if (!id) return { error: 'ID manquant' }

    const civiliteRaw = (formData.get('civilite') as string)?.trim()
    const prenom = (formData.get('prenom') as string)?.trim()
    const nom = (formData.get('nom') as string)?.trim()
    const emailRaw = (formData.get('email') as string)?.trim()

    if (!civiliteRaw || !['MADAME', 'MONSIEUR', 'AUTRE'].includes(civiliteRaw)) {
      return { error: 'La civilité est requise (Madame / Monsieur / Autre)' }
    }
    const civilite = civiliteRaw as 'MADAME' | 'MONSIEUR' | 'AUTRE'
    if (!prenom) return { error: 'Le prénom est requis' }
    if (!nom) return { error: 'Le nom est requis' }
    if (!emailRaw) return { error: "L'email est requis" }
    const emailCheck = validateEmail(emailRaw)
    if (!emailCheck.ok) return { error: emailCheck.error }

    const payload = {
      civilite,
      prenom,
      nom,
      email: emailCheck.email,
      organisation: (formData.get('organisation') as string)?.trim() || null,
      qualite_officielle: (formData.get('qualite_officielle') as string)?.trim() || null,
      telephone: (formData.get('telephone') as string)?.trim() || null,
      notes: (formData.get('notes') as string)?.trim() || null,
    }

    const { error } = await supabase
      .from('external_invitees')
      .update(payload)
      .eq('id', id)

    if (error) return { error: `Erreur de mise à jour : ${error.message}` }

    revalidatePath(ROUTES.MEMBRES)
    return { success: true }
  } catch (err) {
    console.error('updateExternalInvitee error:', err)
    return { error: 'Erreur inattendue' }
  }
}

export async function archiveExternalInvitee(id: string): Promise<ActionResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    const roleError = await requireVerifiedRole(supabase, user, ['super_admin', 'dgs', 'directeur_cabinet', 'gestionnaire'])
    if (roleError) return { error: roleError }

    if (!id) return { error: 'ID manquant' }

    const { error } = await supabase
      .from('external_invitees')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', id)

    if (error) return { error: `Erreur d'archivage : ${error.message}` }

    revalidatePath(ROUTES.MEMBRES)
    return { success: true }
  } catch (err) {
    console.error('archiveExternalInvitee error:', err)
    return { error: 'Erreur inattendue' }
  }
}

export async function unarchiveExternalInvitee(id: string): Promise<ActionResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    const roleError = await requireVerifiedRole(supabase, user, ['super_admin', 'dgs', 'directeur_cabinet', 'gestionnaire'])
    if (roleError) return { error: roleError }

    if (!id) return { error: 'ID manquant' }

    const { error } = await supabase
      .from('external_invitees')
      .update({ archived_at: null })
      .eq('id', id)

    if (error) return { error: `Erreur : ${error.message}` }

    revalidatePath(ROUTES.MEMBRES)
    return { success: true }
  } catch (err) {
    console.error('unarchiveExternalInvitee error:', err)
    return { error: 'Erreur inattendue' }
  }
}

/**
 * Ajoute un invité externe comme convocataire d'une séance.
 * Le statut initial est NON_ENVOYE — l'envoi de la convocation se fait
 * via le bouton dédié (sendConvocations) comme pour les membres.
 */
export async function addExternalConvocataire(
  seanceId: string,
  externalInviteeId: string,
): Promise<ActionResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    const roleError = await requireVerifiedRole(supabase, user, ['super_admin', 'dgs', 'directeur_cabinet', 'gestionnaire', 'president', 'secretaire_seance'])
    if (roleError) return { error: roleError }

    if (!seanceId) return { error: 'Séance manquante' }
    if (!externalInviteeId) return { error: 'Invité manquant' }

    // Vérifier que l'invité existe et n'est pas archivé
    const { data: invitee } = await supabase
      .from('external_invitees')
      .select('id, archived_at')
      .eq('id', externalInviteeId)
      .maybeSingle()

    if (!invitee) return { error: 'Invité externe introuvable' }
    if (invitee.archived_at) return { error: 'Cet invité est archivé — désarchivez-le d\'abord' }

    // L'index unique partiel évite les doublons silencieusement, mais on
    // donne un message d'erreur plus parlant si jamais.
    const { error } = await supabase
      .from('convocataires')
      .insert({
        seance_id: seanceId,
        external_invitee_id: externalInviteeId,
        statut_convocation: 'NON_ENVOYE' as const,
      })

    if (error) {
      if (error.code === '23505') {
        return { error: 'Cet invité est déjà convoqué pour cette séance' }
      }
      return { error: `Erreur d'ajout : ${error.message}` }
    }

    revalidatePath(`${ROUTES.SEANCES}/${seanceId}`)
    return { success: true }
  } catch (err) {
    console.error('addExternalConvocataire error:', err)
    return { error: 'Erreur inattendue' }
  }
}
