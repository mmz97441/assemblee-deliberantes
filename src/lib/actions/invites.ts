'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { requireVerifiedRole } from '@/lib/auth/require-role'
import { EMAIL_REGEX } from '@/lib/constants'

// Imports paresseux dans sendInvitationsEmails — évite que le constructeur
// Resend ne s'exécute au moment du build de la page publique (qui n'envoie
// jamais d'email mais transitivement importerait ce module).

const MUTATION_ROLES = ['super_admin', 'gestionnaire', 'dgs', 'directeur_cabinet'] as const

type ActionResult = { success: true } | { error: string }

async function getAuthenticatedUser() {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) return { user: null, supabase }
  return { user: data.user, supabase }
}

function normalizeCivilite(c: unknown): 'MADAME' | 'MONSIEUR' | 'AUTRE' | null {
  if (c === 'MADAME' || c === 'MONSIEUR' || c === 'AUTRE') return c
  return null
}

function validateInviteInput(d: {
  prenom: string
  nom: string
  email: string
}): string | null {
  if (!d.prenom?.trim()) return 'Le prénom est requis'
  if (!d.nom?.trim()) return 'Le nom est requis'
  if (!d.email?.trim()) return 'L\'adresse email est requise'
  if (!EMAIL_REGEX.test(d.email.trim())) return 'Format d\'email invalide'
  return null
}

// ─── Create ──────────────────────────────────────────────────────────────────

export interface CreateInviteInput {
  seanceId: string
  prenom: string
  nom: string
  email: string
  civilite?: string | null
  qualite?: string | null
  organisation?: string | null
  notes?: string | null
}

export async function createInvite(
  input: CreateInviteInput
): Promise<{ success: true; inviteId: string } | { error: string }> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    const roleErr = await requireVerifiedRole(supabase, user, [...MUTATION_ROLES])
    if (roleErr) return { error: roleErr }

    const validationErr = validateInviteInput(input)
    if (validationErr) return { error: validationErr }

    const { data: seance, error: seanceErr } = await supabase
      .from('seances')
      .select('id, statut')
      .eq('id', input.seanceId)
      .maybeSingle()
    if (seanceErr || !seance) return { error: 'Séance introuvable' }
    if (seance.statut === 'ARCHIVEE') {
      return { error: 'Impossible d\'ajouter un invité sur une séance archivée' }
    }

    const { data, error } = await supabase
      .from('invites')
      .insert({
        seance_id: input.seanceId,
        prenom: input.prenom.trim(),
        nom: input.nom.trim(),
        email: input.email.trim().toLowerCase(),
        civilite: normalizeCivilite(input.civilite),
        qualite: input.qualite?.trim() || null,
        organisation: input.organisation?.trim() || null,
        notes: input.notes?.trim() || null,
      })
      .select('id')
      .single()

    if (error) {
      if (error.code === '23505') {
        return { error: 'Cet email est déjà invité à cette séance' }
      }
      return { error: `Création impossible : ${error.message}` }
    }

    revalidatePath(`/seances/${input.seanceId}`)
    return { success: true, inviteId: data.id }
  } catch (err) {
    console.error('createInvite error:', err)
    return { error: 'Erreur inattendue lors de la création de l\'invité' }
  }
}

// ─── Update ──────────────────────────────────────────────────────────────────

export interface UpdateInviteInput {
  prenom?: string
  nom?: string
  email?: string
  civilite?: string | null
  qualite?: string | null
  organisation?: string | null
  notes?: string | null
}

export async function updateInvite(
  inviteId: string,
  input: UpdateInviteInput
): Promise<ActionResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    const roleErr = await requireVerifiedRole(supabase, user, [...MUTATION_ROLES])
    if (roleErr) return { error: roleErr }

    if (input.email !== undefined) {
      if (!input.email?.trim()) return { error: 'L\'adresse email est requise' }
      if (!EMAIL_REGEX.test(input.email.trim())) return { error: 'Format d\'email invalide' }
    }
    if (input.prenom !== undefined && !input.prenom?.trim()) return { error: 'Le prénom est requis' }
    if (input.nom !== undefined && !input.nom?.trim()) return { error: 'Le nom est requis' }

    const { data: existing, error: fetchErr } = await supabase
      .from('invites')
      .select('seance_id')
      .eq('id', inviteId)
      .maybeSingle()
    if (fetchErr || !existing) return { error: 'Invité introuvable' }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- update payload dépendant des champs présents
    const updates: any = {}
    if (input.prenom !== undefined) updates.prenom = input.prenom.trim()
    if (input.nom !== undefined) updates.nom = input.nom.trim()
    if (input.email !== undefined) updates.email = input.email.trim().toLowerCase()
    if (input.civilite !== undefined) updates.civilite = normalizeCivilite(input.civilite)
    if (input.qualite !== undefined) updates.qualite = input.qualite?.trim() || null
    if (input.organisation !== undefined) updates.organisation = input.organisation?.trim() || null
    if (input.notes !== undefined) updates.notes = input.notes?.trim() || null

    const { error } = await supabase.from('invites').update(updates).eq('id', inviteId)
    if (error) {
      if (error.code === '23505') {
        return { error: 'Cet email est déjà utilisé par un autre invité de cette séance' }
      }
      return { error: `Modification impossible : ${error.message}` }
    }

    revalidatePath(`/seances/${existing.seance_id}`)
    return { success: true }
  } catch (err) {
    console.error('updateInvite error:', err)
    return { error: 'Erreur inattendue lors de la modification' }
  }
}

// ─── Delete ──────────────────────────────────────────────────────────────────

export async function deleteInvite(inviteId: string): Promise<ActionResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    const roleErr = await requireVerifiedRole(supabase, user, [...MUTATION_ROLES])
    if (roleErr) return { error: roleErr }

    const { data: existing } = await supabase
      .from('invites')
      .select('seance_id')
      .eq('id', inviteId)
      .maybeSingle()
    if (!existing) return { error: 'Invité introuvable' }

    const { error } = await supabase.from('invites').delete().eq('id', inviteId)
    if (error) return { error: `Suppression impossible : ${error.message}` }

    revalidatePath(`/seances/${existing.seance_id}`)
    return { success: true }
  } catch (err) {
    console.error('deleteInvite error:', err)
    return { error: 'Erreur inattendue lors de la suppression' }
  }
}

// ─── Envoi des emails d'invitation ───────────────────────────────────────────

interface SeanceForInvitation {
  id: string
  titre: string | null
  date_seance: string
  heure_debut: string | null
  lieu: string | null
  mode: string | null
  instance_config: { nom: string } | null
  odj_points: { position: number; titre: string; type_traitement: string }[]
}

interface InviteRow {
  id: string
  seance_id: string
  prenom: string
  nom: string
  email: string
  civilite: string | null
  qualite: string | null
  organisation: string | null
  statut_invitation: string
  token_confirmation: string
}

function formatLongDate(d: string): string {
  const date = new Date(d)
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatHeure(h: string | null): string {
  if (!h) return ''
  // h peut être 'HH:MM:SS' ou 'HH:MM'
  return h.slice(0, 5).replace(':', 'h')
}

export interface SendInvitationsResult {
  total: number
  sent: number
  errors: { inviteId: string; nom: string; error: string }[]
}

export async function sendInvitationsEmails(
  seanceId: string,
  inviteIds?: string[]
): Promise<SendInvitationsResult | { error: string }> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    const roleErr = await requireVerifiedRole(supabase, user, [...MUTATION_ROLES])
    if (roleErr) return { error: roleErr }

    const { data: seance, error: seanceErr } = await supabase
      .from('seances')
      .select(`
        id, titre, date_seance, heure_debut, lieu, mode,
        instance_config (nom),
        odj_points!odj_points_seance_id_fkey (position, titre, type_traitement)
      `)
      .eq('id', seanceId)
      .single()

    if (seanceErr || !seance) return { error: 'Séance introuvable' }
    const s = seance as unknown as SeanceForInvitation

    let inviteQuery = supabase
      .from('invites')
      .select('id, seance_id, prenom, nom, email, civilite, qualite, organisation, statut_invitation, token_confirmation')
      .eq('seance_id', seanceId)

    if (inviteIds && inviteIds.length > 0) {
      inviteQuery = inviteQuery.in('id', inviteIds)
    } else {
      inviteQuery = inviteQuery.eq('statut_invitation', 'NON_ENVOYE')
    }

    const { data: invites, error: invErr } = await inviteQuery
    if (invErr) return { error: `Lecture des invités impossible : ${invErr.message}` }
    if (!invites || invites.length === 0) {
      return { total: 0, sent: 0, errors: [] }
    }

    // Imports paresseux : Resend / templates ne sont chargés que lors d'un
    // envoi réel — pas au build de la page publique de confirmation.
    const { resend, FROM_EMAIL, FROM_NAME } = await import('@/lib/email/resend')
    const { generateInvitationHTML, generateInvitationSubject } = await import('@/lib/email/invitation-template')

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
    const institutionNom = process.env.NEXT_PUBLIC_INSTITUTION_NAME || FROM_NAME
    const dateLisible = formatLongDate(s.date_seance)
    const heureLisible = formatHeure(s.heure_debut)
    const titreSeance = s.titre || `${s.instance_config?.nom ?? 'Séance'} du ${dateLisible}`

    const result: SendInvitationsResult = { total: invites.length, sent: 0, errors: [] }

    for (const invite of invites as InviteRow[]) {
      try {
        const html = generateInvitationHTML({
          civilite: normalizeCivilite(invite.civilite),
          prenom: invite.prenom,
          nom: invite.nom,
          qualite: invite.qualite,
          organisation: invite.organisation,
          titreSeance,
          instanceNom: s.instance_config?.nom ?? '',
          dateSeance: dateLisible,
          heureSeance: heureLisible,
          lieu: s.lieu,
          mode: s.mode ?? 'PRESENTIEL',
          odjPoints: (s.odj_points ?? []).map(p => ({
            position: p.position,
            titre: p.titre,
            type: p.type_traitement,
          })),
          confirmationUrl: `${appUrl}/invite-seance/${invite.token_confirmation}/confirmer`,
          institutionNom,
        })

        const subject = generateInvitationSubject({
          civilite: normalizeCivilite(invite.civilite),
          prenom: invite.prenom,
          nom: invite.nom,
          qualite: invite.qualite,
          organisation: invite.organisation,
          titreSeance,
          instanceNom: s.instance_config?.nom ?? '',
          dateSeance: dateLisible,
          heureSeance: heureLisible,
          lieu: s.lieu,
          mode: s.mode ?? 'PRESENTIEL',
          odjPoints: [],
          confirmationUrl: '',
          institutionNom,
        })

        const { error: mailErr } = await resend.emails.send({
          from: `${FROM_NAME} <${FROM_EMAIL}>`,
          to: invite.email,
          subject,
          html,
        })

        if (mailErr) {
          await supabase
            .from('invites')
            .update({
              statut_invitation: 'ERREUR_EMAIL',
              erreur_detail: mailErr.message ?? String(mailErr),
            })
            .eq('id', invite.id)
          result.errors.push({ inviteId: invite.id, nom: `${invite.prenom} ${invite.nom}`, error: mailErr.message ?? String(mailErr) })
        } else {
          await supabase
            .from('invites')
            .update({
              statut_invitation: 'ENVOYE',
              envoye_at: new Date().toISOString(),
              erreur_detail: null,
            })
            .eq('id', invite.id)
          result.sent += 1
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Erreur inconnue'
        await supabase
          .from('invites')
          .update({ statut_invitation: 'ERREUR_EMAIL', erreur_detail: msg })
          .eq('id', invite.id)
        result.errors.push({ inviteId: invite.id, nom: `${invite.prenom} ${invite.nom}`, error: msg })
      }
    }

    revalidatePath(`/seances/${seanceId}`)
    return result
  } catch (err) {
    console.error('sendInvitationsEmails error:', err)
    return { error: 'Erreur inattendue lors de l\'envoi des invitations' }
  }
}

export async function resendInvitationEmail(inviteId: string): Promise<ActionResult> {
  const { user, supabase } = await getAuthenticatedUser()
  const roleErr = await requireVerifiedRole(supabase, user, [...MUTATION_ROLES])
  if (roleErr) return { error: roleErr }

  const { data: invite } = await supabase
    .from('invites')
    .select('seance_id')
    .eq('id', inviteId)
    .maybeSingle()
  if (!invite) return { error: 'Invité introuvable' }

  const res = await sendInvitationsEmails(invite.seance_id, [inviteId])
  if ('error' in res) return { error: res.error }
  if (res.errors.length > 0) return { error: res.errors[0].error }
  return { success: true }
}

// ─── Action publique : confirmer ou décliner depuis l'email ──────────────────

/**
 * Action publique (pas d'auth requise — le token est la garantie).
 * Appelée depuis la page /invite-seance/[token]/confirmer.
 */
export async function confirmInviteAttendance(
  token: string,
  choice: 'CONFIRME' | 'DECLINE'
): Promise<ActionResult> {
  try {
    if (!token) return { error: 'Lien invalide' }
    if (choice !== 'CONFIRME' && choice !== 'DECLINE') return { error: 'Choix invalide' }

    const supabase = await createServerSupabaseClient()

    const { data: invite, error: fetchErr } = await supabase
      .from('invites')
      .select('id, seance_id, statut_invitation, seance:seances(statut)')
      .eq('token_confirmation', token)
      .maybeSingle()

    if (fetchErr || !invite) return { error: 'Lien invalide ou expiré' }

    const seanceStatut = (invite as { seance: { statut: string } | null }).seance?.statut
    if (seanceStatut === 'CLOTUREE' || seanceStatut === 'ARCHIVEE') {
      return { error: 'Cette séance est terminée — la confirmation n\'est plus possible' }
    }

    const now = new Date().toISOString()
    const updates =
      choice === 'CONFIRME'
        ? { statut_invitation: 'CONFIRME', confirme_at: now, decline_at: null }
        : { statut_invitation: 'DECLINE', decline_at: now, confirme_at: null }

    const { error } = await supabase
      .from('invites')
      .update(updates)
      .eq('id', invite.id)

    if (error) return { error: `Mise à jour impossible : ${error.message}` }

    revalidatePath(`/invite-seance/${token}/confirmer`)
    return { success: true }
  } catch (err) {
    console.error('confirmInviteAttendance error:', err)
    return { error: 'Erreur inattendue' }
  }
}

// ─── Lecture (pour la page publique) ─────────────────────────────────────────

export interface PublicInviteView {
  prenom: string
  nom: string
  email: string
  civilite: string | null
  qualite: string | null
  organisation: string | null
  statut_invitation: string
  seance: {
    id: string
    titre: string | null
    date_seance: string
    heure_debut: string | null
    lieu: string | null
    statut: string
    instance_nom: string | null
  }
}

export async function getInviteByToken(
  token: string
): Promise<{ data: PublicInviteView } | { error: string }> {
  try {
    if (!token) return { error: 'Lien invalide' }
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
      .from('invites')
      .select(`
        prenom, nom, email, civilite, qualite, organisation, statut_invitation,
        seance:seances(id, titre, date_seance, heure_debut, lieu, statut, instance_config(nom))
      `)
      .eq('token_confirmation', token)
      .maybeSingle()

    if (error || !data) return { error: 'Lien invalide ou expiré' }

    const seance = (data as unknown as {
      seance: {
        id: string
        titre: string | null
        date_seance: string
        heure_debut: string | null
        lieu: string | null
        statut: string
        instance_config: { nom: string } | null
      } | null
    }).seance

    if (!seance) return { error: 'Séance introuvable' }

    return {
      data: {
        prenom: data.prenom,
        nom: data.nom,
        email: data.email,
        civilite: data.civilite,
        qualite: data.qualite,
        organisation: data.organisation,
        statut_invitation: data.statut_invitation,
        seance: {
          id: seance.id,
          titre: seance.titre,
          date_seance: seance.date_seance,
          heure_debut: seance.heure_debut,
          lieu: seance.lieu,
          statut: seance.statut,
          instance_nom: seance.instance_config?.nom ?? null,
        },
      },
    }
  } catch (err) {
    console.error('getInviteByToken error:', err)
    return { error: 'Erreur inattendue' }
  }
}

// ─── Lecture (pour la page séance) ───────────────────────────────────────────

export interface InviteListItem {
  id: string
  prenom: string
  nom: string
  email: string
  civilite: string | null
  qualite: string | null
  organisation: string | null
  statut_invitation: string
  envoye_at: string | null
  lu_at: string | null
  confirme_at: string | null
  decline_at: string | null
  erreur_detail: string | null
}

export async function listInvitesForSeance(
  seanceId: string
): Promise<{ data: InviteListItem[] } | { error: string }> {
  try {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase
      .from('invites')
      .select('id, prenom, nom, email, civilite, qualite, organisation, statut_invitation, envoye_at, lu_at, confirme_at, decline_at, erreur_detail')
      .eq('seance_id', seanceId)
      .order('created_at', { ascending: true })

    if (error) return { error: `Lecture impossible : ${error.message}` }
    return { data: data ?? [] }
  } catch (err) {
    console.error('listInvitesForSeance error:', err)
    return { error: 'Erreur inattendue' }
  }
}
