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

import { requireVerifiedRole } from '@/lib/auth/require-role'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SendConvocationResult {
  total: number
  sent: number
  errors: { memberId: string; memberName: string; error: string }[]
}

// ─── Envoi des convocations ──────────────────────────────────────────────────

interface SendConvocationsOptions {
  /** Si fourni, ne traite QUE ce convocataire (utilisé par resendConvocation). */
  onlyConvocataireId?: string
  /** Motif du renvoi (INITIAL si premier envoi, sinon valeur depuis l'UI). */
  resendMotif?: ResendMotif
  /** Texte libre complémentaire pour le motif. */
  resendMotifDetail?: string
}

export async function sendConvocations(
  seanceId: string,
  options: SendConvocationsOptions = {}
): Promise<SendConvocationResult | { error: string }> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    const roleError = await requireVerifiedRole(supabase, user, ['super_admin', 'dgs', 'directeur_cabinet', 'gestionnaire', 'president'])
    if (roleError) return { error: roleError }

    // Rate limiting : 5 envois par séance par heure pour les envois groupés.
    // Pour les renvois individuels (onlyConvocataireId), on relâche un peu :
    // 30 par heure (le gestionnaire peut avoir plusieurs élus à dépanner).
    const isIndividualResend = !!options.onlyConvocataireId
    const rateCheck = await checkRateLimit(supabase, user!.id, {
      actionKey: isIndividualResend
        ? `resend_convocation_${seanceId}_${options.onlyConvocataireId}`
        : `send_convocations_${seanceId}`,
      maxAttempts: isIndividualResend ? 5 : 5,
      windowMinutes: isIndividualResend ? 10 : 60,
    })
    if (!rateCheck.allowed) return { error: rateCheck.error! }

    // Fetch seance with all needed data
    const { data: seance, error: seanceError } = await supabase
      .from('seances')
      .select(`
        *,
        instance_config (id, nom, type_legal),
        odj_points!odj_points_seance_id_fkey (position, titre, type_traitement, note_synthese, description, documents),
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

    // Check ODJ exists (CGCT L2121-10 — convocation must include the ODJ)
    if (!seance.odj_points || seance.odj_points.length === 0) {
      return { error: 'L\'ordre du jour est vide — ajoutez au moins un point avant d\'envoyer les convocations (CGCT L2121-10).' }
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

    // Sort ODJ points + extraire description + documents (audit produit :
    // les élus avaient besoin de voir le détail et les PJ depuis l'email)
    const odjPoints = (seance.odj_points || [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .sort((a: any, b: any) => a.position - b.position)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((p: any) => {
        // documents est un JSONB array — on garde uniquement nom + taille
        // (pas les paths, qui sont des storage paths internes)
        const rawDocs = Array.isArray(p.documents) ? p.documents : []
        const documents = rawDocs
          .filter((d: { name?: string }) => !!d?.name)
          .map((d: { name?: string; size?: number; type?: string }) => ({
            name: String(d.name),
            size: typeof d.size === 'number' ? d.size : null,
            type: d.type ? String(d.type) : null,
          }))

        return {
          position: p.position,
          titre: p.titre,
          type: p.type_traitement || 'DELIBERATION',
          description: (p.description as string | null | undefined)?.trim() || null,
          note_synthese: (p.note_synthese as string | null | undefined)?.trim() || null,
          documents,
        }
      })

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
    let toSend = convocataires.filter(
      (c) => c.statut_convocation === 'NON_ENVOYE' || c.statut_convocation === null
    )

    // Renvoi individuel : ne traiter QUE le convocataire ciblé
    // (resendConvocation a remis statut=NON_ENVOYE au préalable)
    if (options.onlyConvocataireId) {
      toSend = toSend.filter((c) => c.id === options.onlyConvocataireId)
    }

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

      // 2 actions distinctes depuis l'email : confirmer ou signaler absence.
      // Une seule URL paramétrée par `action`, gérée par la même page de
      // confirmation qui adapte son comportement.
      const confirmationUrl = `${appUrl}/convocation/confirmer?token=${token}&action=present`
      const absenceUrl = `${appUrl}/convocation/confirmer?token=${token}&action=absent`
      // Lien vers la page séance dans l'app, où l'élu peut consulter et
      // télécharger les documents de l'ODJ après authentification (RLS).
      const seanceUrl = `${appUrl}/seances/${seance.id}`
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
        absenceUrl,
        seanceUrl,
        institutionNom: institutionNom,
        qrCodeUrl,
        presidentName,
      }

      try {
        const { data: sendData, error: emailError } = await resend.emails.send({
          from: `${FROM_NAME} <${FROM_EMAIL}>`,
          to: [member.email],
          subject: generateConvocationSubject(emailData),
          html: generateConvocationHTML(emailData),
        })

        // SÉCURITÉ / TRACABILITÉ : on consigne CHAQUE envoi (succès ou erreur)
        // dans la table append-only convocation_envois pour le contrôle de
        // légalité préfectoral. Le numero_envoi est calculé à partir du nombre
        // d'envois déjà existants pour ce convocataire.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { count: nbEnvoisPrec } = await ((supabase as any).from('convocation_envois'))
          .select('id', { count: 'exact', head: true })
          .eq('convocataire_id', conv.id)
        const numeroEnvoi = (nbEnvoisPrec || 0) + 1

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await ((supabase as any).from('convocation_envois')).insert({
          convocataire_id: conv.id,
          numero_envoi: numeroEnvoi,
          // Si numero_envoi == 1, c'est l'envoi initial. Sinon, motif fourni
          // par resendConvocation (par défaut AUTRE si non spécifié).
          motif: numeroEnvoi === 1 ? 'INITIAL' : (options.resendMotif || 'AUTRE'),
          motif_detail: numeroEnvoi === 1 ? null : (options.resendMotifDetail?.trim().slice(0, 1000) || null),
          email_destinataire: member.email,
          statut_resend: emailError ? 'error' : 'sent',
          resend_message_id: sendData?.id || null,
          erreur_detail: emailError?.message || null,
          envoye_par: user?.id || null,
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

    // If seance was brouillon, auto-transition to CONVOQUEE via updateSeanceStatut
    // This ensures all CGCT guards are applied consistently
    if (seance.statut === 'BROUILLON' && result.sent > 0) {
      const { updateSeanceStatut } = await import('@/lib/actions/seances')
      await updateSeanceStatut(seanceId, 'CONVOQUEE')
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

    // M4: Rate limit confirmPresence — max 10 per minute per token prefix
    // Since this is public (service role), rate limit by token prefix to prevent brute force
    const tokenPrefix = token.substring(0, 8)
    const { count: confirmAttempts } = await supabase
      .from('rate_limits')
      .select('*', { count: 'exact', head: true })
      .eq('action_key', `confirm_presence_${tokenPrefix}`)
      .gte('created_at', new Date(Date.now() - 60 * 1000).toISOString())

    if (confirmAttempts && confirmAttempts >= 10) {
      return { error: 'Trop de tentatives. Veuillez réessayer dans une minute.' }
    }

    await supabase.from('rate_limits').insert({
      action_key: `confirm_presence_${tokenPrefix}`,
      user_id: '00000000-0000-0000-0000-000000000000',
    })

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

// ─── Signaler une absence depuis l'email de convocation ────────────────────
//
// CGCT L2121-12 / L2121-20 : permettre à l'élu de signaler son absence en
// amont, ce qui aide le gestionnaire à anticiper les procurations.
// Action publique (service role) — l'authentification se fait via le token
// unique de la convocation (UUID v4, non énumérable).

export async function signalAbsence(
  token: string,
  motif?: string
): Promise<{ success: true; seanceTitre: string; memberNom: string } | { error: string }> {
  try {
    const supabase = await createServiceRoleClient()

    // Rate limit identique à confirmPresence (anti brute-force token)
    const tokenPrefix = token.substring(0, 8)
    const { count: attempts } = await supabase
      .from('rate_limits')
      .select('*', { count: 'exact', head: true })
      .eq('action_key', `signal_absence_${tokenPrefix}`)
      .gte('created_at', new Date(Date.now() - 60 * 1000).toISOString())

    if (attempts && attempts >= 10) {
      return { error: 'Trop de tentatives. Veuillez réessayer dans une minute.' }
    }

    await supabase.from('rate_limits').insert({
      action_key: `signal_absence_${tokenPrefix}`,
      user_id: '00000000-0000-0000-0000-000000000000',
    })

    const { data: conv, error } = await supabase
      .from('convocataires')
      .select(`
        id,
        seance_id,
        member_id,
        statut_convocation,
        member:members (prenom, nom),
        seance:seances (titre, statut)
      `)
      .eq('token_confirmation', token)
      .maybeSingle()

    if (error || !conv) {
      return { error: 'Lien de convocation invalide ou expiré' }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const seance = conv.seance as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const member = conv.member as any

    if (seance?.statut === 'CLOTUREE' || seance?.statut === 'ARCHIVEE') {
      return { error: 'Cette séance est déjà clôturée' }
    }

    // Tronquer le motif pour éviter abus (max 500 chars stockés)
    const motifClean = motif?.trim().slice(0, 500) || null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updatePayload: any = {
      statut_convocation: 'ABSENT_EXCUSE',
      motif_absence: motifClean,
    }

    await supabase
      .from('convocataires')
      .update(updatePayload)
      .eq('id', conv.id)

    revalidatePath(`${ROUTES.SEANCES}/${conv.seance_id}`)

    return {
      success: true,
      seanceTitre: seance?.titre || 'Séance',
      memberNom: `${member?.prenom || ''} ${member?.nom || ''}`.trim(),
    }
  } catch (err) {
    console.error('signalAbsence error:', err)
    return { error: 'Erreur inattendue' }
  }
}

// ─── Renvoyer une convocation individuelle ───────────────────────────────────
//
// Le renvoi est toujours autorisé, même si l'élu a déjà confirmé sa présence
// (il peut avoir perdu son mail, son QR code, etc.).
//
// Conformément à la demande métier (traçabilité préfecture), chaque renvoi :
// - est consigné dans la table append-only convocation_envois avec motif
// - garde la date de la première convocation comme référence légale CGCT
// - met à jour envoye_at sur la ligne convocataire (dernier envoi)

export type ResendMotif = 'EMAIL_PERDU' | 'SPAM' | 'ADRESSE_ERRONEE' | 'AUTRE'

export async function resendConvocation(
  seanceId: string,
  memberId: string,
  motif: ResendMotif = 'AUTRE',
  motifDetail?: string
): Promise<ActionResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    const roleError = await requireVerifiedRole(supabase, user, ['super_admin', 'dgs', 'directeur_cabinet', 'gestionnaire', 'president', 'secretaire_seance'])
    if (roleError) return { error: roleError }

    // Charger le convocataire (sans bloquer sur statut)
    const { data: conv } = await supabase
      .from('convocataires')
      .select('id, statut_convocation')
      .eq('seance_id', seanceId)
      .eq('member_id', memberId)
      .maybeSingle()

    if (!conv) {
      return { error: 'Convocataire introuvable pour cette séance.' }
    }

    // Mémoriser le statut courant pour le restaurer après le renvoi
    // (sinon CONFIRME_PRESENT serait écrasé en NON_ENVOYE et la confirmation perdue)
    const previousStatut = conv.statut_convocation

    // Reset à NON_ENVOYE pour que sendConvocations re-traite cette ligne
    await supabase
      .from('convocataires')
      .update({
        statut_convocation: 'NON_ENVOYE',
        envoye_at: null,
        erreur_detail: null,
      })
      .eq('id', conv.id)

    // Renvoyer (cette action utilisera l'envoi initial enrichi + insert
    // automatique d'une ligne convocation_envois avec motif fourni)
    const result = await sendConvocations(seanceId, { resendMotif: motif, resendMotifDetail: motifDetail, onlyConvocataireId: conv.id })

    if ('error' in result) {
      // Restaurer le statut précédent en cas d'échec d'envoi
      if (previousStatut && previousStatut !== 'NON_ENVOYE') {
        await supabase
          .from('convocataires')
          .update({ statut_convocation: previousStatut })
          .eq('id', conv.id)
      }
      return { error: result.error }
    }

    if (result.sent === 0 && result.errors.length > 0) {
      // Restaurer le statut précédent
      if (previousStatut && previousStatut !== 'NON_ENVOYE') {
        await supabase
          .from('convocataires')
          .update({ statut_convocation: previousStatut })
          .eq('id', conv.id)
      }
      return { error: result.errors[0].error }
    }

    // Si l'élu avait confirmé sa présence, on restaure CONFIRME_PRESENT
    // (le renvoi n'invalide pas une confirmation antérieure)
    if (previousStatut === 'CONFIRME_PRESENT') {
      await supabase
        .from('convocataires')
        .update({ statut_convocation: 'CONFIRME_PRESENT' })
        .eq('id', conv.id)
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
    const roleError = await requireVerifiedRole(supabase, user, ['super_admin', 'dgs', 'directeur_cabinet', 'gestionnaire', 'president', 'secretaire_seance'])
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
