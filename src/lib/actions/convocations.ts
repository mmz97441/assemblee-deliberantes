'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ROUTES } from '@/lib/constants'
import { resend, FROM_EMAIL, FROM_NAME } from '@/lib/email/resend'
import {
  generateConvocationHTML,
  generateConvocationSubject,
} from '@/lib/email/convocation-template'

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

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SendConvocationResult {
  total: number
  sent: number
  errors: { memberId: string; memberName: string; error: string }[]
}

// ─── Envoi des convocations ──────────────────────────────────────────────────

export async function sendConvocations(seanceId: string): Promise<SendConvocationResult | { error: string }> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    const roleError = requireRole(user, ['super_admin', 'gestionnaire', 'president', 'secretaire_seance'])
    if (roleError) return { error: roleError }

    // Fetch seance with all needed data
    const { data: seance, error: seanceError } = await supabase
      .from('seances')
      .select(`
        *,
        instance_config (id, nom, type_legal),
        odj_points (position, titre, type_traitement),
        convocataires (
          id,
          member_id,
          statut_convocation,
          token_confirmation,
          member:members (id, prenom, nom, email)
        )
      `)
      .eq('id', seanceId)
      .single()

    if (seanceError || !seance) {
      return { error: 'Seance introuvable' }
    }

    if (seance.statut !== 'CONVOQUEE' && seance.statut !== 'BROUILLON') {
      return { error: 'Les convocations ne peuvent etre envoyees que pour une seance en brouillon ou convoquee' }
    }

    // Get institution name
    const { data: institution } = await supabase
      .from('institution_config')
      .select('nom_officiel')
      .limit(1)
      .single()

    const institutionNom = institution?.nom_officiel
      || process.env.NEXT_PUBLIC_INSTITUTION_NAME
      || 'Institution'

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    // Sort ODJ points
    const odjPoints = (seance.odj_points || [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .sort((a: any, b: any) => a.position - b.position)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((p: any) => ({
        position: p.position,
        titre: p.titre,
        type: p.type_traitement || 'DELIBERATION',
      }))

    // Format date
    const dateObj = new Date(seance.date_seance)
    const dateFormatted = dateObj.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    const heureFormatted = seance.date_seance.includes('T')
      ? dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      : ''

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const convocataires = (seance.convocataires || []) as any[]
    const toSend = convocataires.filter(
      (c) => c.statut_convocation === 'NON_ENVOYE' || c.statut_convocation === null
    )

    if (toSend.length === 0) {
      return { error: 'Toutes les convocations ont deja ete envoyees' }
    }

    const result: SendConvocationResult = {
      total: toSend.length,
      sent: 0,
      errors: [],
    }

    for (const conv of toSend) {
      const member = conv.member
      if (!member?.email) {
        result.errors.push({
          memberId: conv.member_id,
          memberName: `${member?.prenom || '?'} ${member?.nom || '?'}`,
          error: 'Email manquant',
        })
        continue
      }

      // Generate or reuse confirmation token
      let token = conv.token_confirmation
      if (!token) {
        token = crypto.randomUUID()
        await supabase
          .from('convocataires')
          .update({ token_confirmation: token })
          .eq('id', conv.id)
      }

      const confirmationUrl = `${appUrl}/convocation/confirmer?token=${token}`

      const emailData = {
        prenomMembre: member.prenom,
        nomMembre: member.nom,
        titreSeance: seance.titre,
        instanceNom: seance.instance_config?.nom || 'Instance',
        dateSeance: dateFormatted,
        heureSeance: heureFormatted,
        lieu: seance.lieu,
        mode: seance.mode || 'PRESENTIEL',
        odjPoints,
        confirmationUrl,
        institutionNom: institutionNom,
      }

      try {
        const { error: emailError } = await resend.emails.send({
          from: `${FROM_NAME} <${FROM_EMAIL}>`,
          to: [member.email],
          subject: generateConvocationSubject(emailData),
          html: generateConvocationHTML(emailData),
        })

        if (emailError) {
          result.errors.push({
            memberId: conv.member_id,
            memberName: `${member.prenom} ${member.nom}`,
            error: emailError.message,
          })

          await supabase
            .from('convocataires')
            .update({
              statut_convocation: 'ERREUR_EMAIL',
              erreur_detail: emailError.message,
            })
            .eq('id', conv.id)
        } else {
          result.sent++

          await supabase
            .from('convocataires')
            .update({
              statut_convocation: 'ENVOYE',
              envoye_at: new Date().toISOString(),
              token_confirmation: token,
            })
            .eq('id', conv.id)
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Erreur inconnue'
        result.errors.push({
          memberId: conv.member_id,
          memberName: `${member.prenom} ${member.nom}`,
          error: errMsg,
        })

        await supabase
          .from('convocataires')
          .update({
            statut_convocation: 'ERREUR_EMAIL',
            erreur_detail: errMsg,
          })
          .eq('id', conv.id)
      }
    }

    // If seance was brouillon, auto-update to CONVOQUEE
    if (seance.statut === 'BROUILLON' && result.sent > 0) {
      await supabase
        .from('seances')
        .update({ statut: 'CONVOQUEE' })
        .eq('id', seanceId)
    }

    revalidatePath(`${ROUTES.SEANCES}/${seanceId}`)
    revalidatePath(ROUTES.SEANCES)
    return result
  } catch (err) {
    console.error('sendConvocations error:', err)
    return { error: 'Erreur inattendue lors de l\'envoi des convocations' }
  }
}

// ─── Confirmation de presence ────────────────────────────────────────────────

export async function confirmPresence(token: string): Promise<
  { success: true; seanceTitre: string; memberNom: string } | { error: string }
> {
  try {
    const supabase = await createServerSupabaseClient()

    // Find convocataire by token
    const { data: conv, error } = await supabase
      .from('convocataires')
      .select(`
        id,
        seance_id,
        member_id,
        statut_convocation,
        member:members (prenom, nom),
        seance:seances (titre, date_seance, statut)
      `)
      .eq('token_confirmation', token)
      .single()

    if (error || !conv) {
      return { error: 'Lien de confirmation invalide ou expire' }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const seance = conv.seance as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const member = conv.member as any

    // Check seance isn't already closed
    if (seance?.statut === 'CLOTUREE' || seance?.statut === 'ARCHIVEE') {
      return { error: 'Cette seance est deja cloturee' }
    }

    // Update convocataire status
    await supabase
      .from('convocataires')
      .update({
        statut_convocation: 'CONFIRME_PRESENT',
        confirme_at: new Date().toISOString(),
      })
      .eq('id', conv.id)

    // Also mark as "LU" if it was just "ENVOYE"
    if (conv.statut_convocation === 'ENVOYE') {
      await supabase
        .from('convocataires')
        .update({ lu_at: new Date().toISOString() })
        .eq('id', conv.id)
    }

    revalidatePath(`${ROUTES.SEANCES}/${conv.seance_id}`)

    return {
      success: true,
      seanceTitre: seance?.titre || 'Seance',
      memberNom: `${member?.prenom || ''} ${member?.nom || ''}`.trim(),
    }
  } catch (err) {
    console.error('confirmPresence error:', err)
    return { error: 'Erreur inattendue' }
  }
}

// ─── Renvoyer une convocation individuelle ───────────────────────────────────

export async function resendConvocation(seanceId: string, memberId: string): Promise<ActionResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    const roleError = requireRole(user, ['super_admin', 'gestionnaire', 'president', 'secretaire_seance'])
    if (roleError) return { error: roleError }

    // Reset status to NON_ENVOYE so sendConvocations picks it up
    const { error } = await supabase
      .from('convocataires')
      .update({
        statut_convocation: 'NON_ENVOYE',
        envoye_at: null,
        erreur_detail: null,
      })
      .eq('seance_id', seanceId)
      .eq('member_id', memberId)

    if (error) return { error: `Erreur : ${error.message}` }

    // Then send
    const result = await sendConvocations(seanceId)
    if ('error' in result) return { error: result.error }

    if (result.sent === 0 && result.errors.length > 0) {
      return { error: result.errors[0].error }
    }

    return { success: true }
  } catch (err) {
    console.error('resendConvocation error:', err)
    return { error: 'Erreur inattendue' }
  }
}
