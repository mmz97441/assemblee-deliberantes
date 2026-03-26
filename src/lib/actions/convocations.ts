'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { ROUTES } from '@/lib/constants'
import { checkRateLimit } from '@/lib/security/rate-limiter'
import { resend, FROM_EMAIL, FROM_NAME } from '@/lib/email/resend'
import {
  generateConvocationHTML,
  generateConvocationSubject,
  generateReminderHTML,
  generateReminderSubject,
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
  if (!user) return 'Non authentifié'
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

    // Rate limiting: max 5 envois par séance par heure
    const rateCheck = await checkRateLimit(supabase, user!.id, {
      actionKey: `send_convocations_${seanceId}`,
      maxAttempts: 5,
      windowMinutes: 60,
    })
    if (!rateCheck.allowed) return { error: rateCheck.error! }

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
          token_emargement,
          member:members (id, prenom, nom, email)
        )
      `)
      .eq('id', seanceId)
      .single()

    if (seanceError || !seance) {
      return { error: 'Séance introuvable' }
    }

    if (seance.statut !== 'CONVOQUEE' && seance.statut !== 'BROUILLON') {
      return { error: 'Les convocations ne peuvent être envoyées que pour une séance en brouillon ou convoquée' }
    }

    // Check president is designated (CGCT L2121-10 — convocation must come from the president)
    if (!seance.president_effectif_seance_id) {
      return { error: 'Le président de séance doit être désigné avant l\'envoi des convocations (CGCT L2121-10). Modifiez la séance pour désigner un président.' }
    }

    // Load president name for convocation email
    const { data: president } = await supabase
      .from('members')
      .select('prenom, nom, qualite_officielle')
      .eq('id', seance.president_effectif_seance_id)
      .single()

    const presidentName = president
      ? `${president.qualite_officielle ? president.qualite_officielle + ' ' : ''}${president.prenom} ${president.nom}`
      : 'le Président'

    // Get institution name
    const { data: institution } = await supabase
      .from('institution_config')
      .select('nom_officiel')
      .limit(1)
      .maybeSingle()

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
      return { error: 'Toutes les convocations ont déjà été envoyées' }
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

      // Ensure emargement token exists
      let tokenEmargement = conv.token_emargement
      if (!tokenEmargement) {
        tokenEmargement = crypto.randomUUID()
        await supabase
          .from('convocataires')
          .update({ token_emargement: tokenEmargement })
          .eq('id', conv.id)
      }

      const confirmationUrl = `${appUrl}/convocation/confirmer?token=${token}`
      const qrCodeUrl = `${appUrl}/api/qr?data=${encodeURIComponent(tokenEmargement)}`

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
        qrCodeUrl,
        presidentName,
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
    // Use service role — this is a PUBLIC action (no user logged in)
    const supabase = await createServiceRoleClient()

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
      .maybeSingle()

    if (error || !conv) {
      return { error: 'Lien de confirmation invalide ou expiré' }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const seance = conv.seance as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const member = conv.member as any

    // Check seance isn't already closed
    if (seance?.statut === 'CLOTUREE' || seance?.statut === 'ARCHIVEE') {
      return { error: 'Cette séance est déjà clôturée' }
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
      seanceTitre: seance?.titre || 'Séance',
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

    // Block resend if member already confirmed presence (no point)
    const { data: conv } = await supabase
      .from('convocataires')
      .select('statut_convocation')
      .eq('seance_id', seanceId)
      .eq('member_id', memberId)
      .maybeSingle()

    if (conv && conv.statut_convocation === 'CONFIRME_PRESENT') {
      return { error: 'Ce membre a déjà confirmé sa présence.' }
    }

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

// ─── Envoi de rappels aux membres non confirmés ─────────────────────────────

export async function sendReminders(seanceId: string): Promise<{ sent: number; error?: string }> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    const roleError = requireRole(user, ['super_admin', 'gestionnaire', 'president', 'secretaire_seance'])
    if (roleError) return { sent: 0, error: roleError }

    // Rate limiting: max 3 rappels par séance par heure
    const rateCheck = await checkRateLimit(supabase, user!.id, {
      actionKey: `send_reminders_${seanceId}`,
      maxAttempts: 3,
      windowMinutes: 60,
    })
    if (!rateCheck.allowed) return { sent: 0, error: rateCheck.error! }

    // Load séance
    const { data: seance, error: seanceError } = await supabase
      .from('seances')
      .select('id, titre, date_seance, statut, instance_config(nom)')
      .eq('id', seanceId)
      .single()

    if (seanceError || !seance) return { sent: 0, error: 'Séance introuvable' }
    if (seance.statut !== 'CONVOQUEE') return { sent: 0, error: 'Les rappels ne peuvent être envoyés que pour les séances convoquées' }

    // Get institution name
    const { data: institution } = await supabase
      .from('institution_config')
      .select('nom_officiel')
      .limit(1)
      .maybeSingle()

    const institutionNom = institution?.nom_officiel
      || process.env.NEXT_PUBLIC_INSTITUTION_NAME
      || 'Institution'

    // Get convocataires who haven't confirmed
    const { data: convocataires } = await supabase
      .from('convocataires')
      .select('member_id, statut_convocation, member:members(prenom, nom, email)')
      .eq('seance_id', seanceId)
      .in('statut_convocation', ['ENVOYE', 'LU'])

    if (!convocataires || convocataires.length === 0) {
      return { sent: 0, error: 'Tous les membres ont déjà confirmé ou sont en erreur' }
    }

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
    const instanceNom = (seance.instance_config as any)?.nom || ''

    // Send reminder emails
    let sent = 0
    for (const conv of convocataires) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const member = conv.member as any
      if (!member?.email) continue

      const emailData = {
        memberName: `${member.prenom} ${member.nom}`,
        seanceTitre: seance.titre,
        seanceDate: dateFormatted,
        seanceHeure: heureFormatted,
        instanceNom,
        institutionNom,
      }

      try {
        const { error: emailError } = await resend.emails.send({
          from: `${FROM_NAME} <${FROM_EMAIL}>`,
          to: [member.email],
          subject: generateReminderSubject(emailData),
          html: generateReminderHTML(emailData),
        })

        if (!emailError) {
          sent++
        } else {
          console.error(`Reminder failed for ${member.email}:`, emailError.message)
        }
      } catch (err) {
        console.error(`Reminder failed for ${member.email}:`, err)
      }
    }

    revalidatePath(`${ROUTES.SEANCES}/${seanceId}`)
    return { sent }
  } catch (err) {
    console.error('sendReminders error:', err)
    return { sent: 0, error: 'Erreur inattendue lors de l\'envoi des rappels' }
  }
}
