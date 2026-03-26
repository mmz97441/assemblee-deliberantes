'use server'

import crypto from 'crypto'
import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { determineVoteResult, generateFormulePV, type MajoriteRequise } from '@/lib/validators/vote-result'
import { checkRateLimit } from '@/lib/security/rate-limiter'
import { sendSMS, maskPhoneNumber } from '@/lib/sms/twilio'
import {
  generateVoteSessionKey,
  encryptSessionKey,
  decryptSessionKey,
  encryptChoice,
  decryptChoice,
  generateBulletinToken,
  computeBulletinHash,
  destroyKey,
} from '@/lib/crypto/vote-encryption'

// ─── Types ───────────────────────────────────────────────────────────────────

type ActionResult = { success: true } | { error: string }

type OpenVoteResult =
  | { success: true; voteId: string; totalVotants: number }
  | { error: string }

type CloseVoteResult =
  | { success: true; resultat: string; formulePV: string }
  | { error: string }

// ─── Auth helper ─────────────────────────────────────────────────────────────

async function getAuthenticatedUser() {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    return { user: null, supabase }
  }
  return { user: data.user, supabase }
}

// ─── Server Actions ──────────────────────────────────────────────────────────

/**
 * Opens a new vote on an ODJ point.
 * Records quorum snapshot at open time (CDC requirement).
 */
export async function openVote(
  seanceId: string,
  odjPointId: string
): Promise<OpenVoteResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    const role = (user.user_metadata?.role as string) || ''
    if (!['super_admin', 'gestionnaire'].includes(role)) {
      return { error: 'Seul le gestionnaire peut ouvrir un vote' }
    }

    if (role === 'super_admin') {
      console.warn(`[AUDIT] Super admin ${user.id} performing vote action: openVote on seance ${seanceId}, point ${odjPointId}`)
    }

    // Rate limiting: max 20 ouvertures de vote par séance par heure
    const rateCheck = await checkRateLimit(supabase, user!.id, {
      actionKey: `open_vote_${seanceId}`,
      maxAttempts: 20,
      windowMinutes: 60,
    })
    if (!rateCheck.allowed) return { error: rateCheck.error! }

    // Verify seance is EN_COURS
    const { data: seance } = await supabase
      .from('seances')
      .select('id, statut, instance_id, reconvocation')
      .eq('id', seanceId)
      .single()

    if (!seance) return { error: 'Séance introuvable' }
    if (seance.statut !== 'EN_COURS') {
      return { error: 'La séance doit être en cours pour ouvrir un vote' }
    }

    // Get instance config for voix_preponderante + quorum
    const { data: instanceConfig } = await supabase
      .from('instance_config')
      .select('voix_preponderante, quorum_type, quorum_fraction_numerateur, quorum_fraction_denominateur, composition_max')
      .eq('id', seance.instance_id)
      .single()

    // Verify ODJ point allows voting
    const { data: point } = await supabase
      .from('odj_points')
      .select('id, titre, votes_interdits, type_traitement')
      .eq('id', odjPointId)
      .single()

    if (!point) return { error: 'Point ODJ introuvable' }
    if (point.votes_interdits) {
      return { error: 'Ce point est de type information — le vote est interdit' }
    }

    // Check no other vote is currently OUVERT for this seance
    const { data: openVotes } = await supabase
      .from('votes')
      .select('id')
      .eq('seance_id', seanceId)
      .eq('statut', 'OUVERT')

    if (openVotes && openVotes.length > 0) {
      return { error: 'Un vote est déjà en cours sur cette séance. Clôturez-le d\'abord.' }
    }

    // Block double vote: check if this point already has a completed (CLOS) vote
    const { data: existingClosedVotes } = await supabase
      .from('votes')
      .select('id, statut')
      .eq('odj_point_id', odjPointId)
      .eq('statut', 'CLOS')

    if (existingClosedVotes && existingClosedVotes.length > 0) {
      return { error: 'Ce point a déjà fait l\'objet d\'un vote clos. Annulez le vote précédent avant d\'en ouvrir un nouveau.' }
    }

    // CGCT L2121-21: elections must use secret ballot, not main levée
    if (point.type_traitement === 'ELECTION') {
      return { error: 'Les élections de personnes doivent obligatoirement se dérouler par vote secret (CGCT L2121-21). Utilisez le vote à bulletin secret.' }
    }

    // Calculate quorum snapshot: PRESENT + PROCURATION (without departed members)
    const { data: presences } = await supabase
      .from('presences')
      .select('id, member_id, statut, heure_depart')
      .eq('seance_id', seanceId)

    // Exclude recused members for this point (CGCT L2131-11)
    const { data: recusations } = await supabase
      .from('recusations')
      .select('member_id')
      .eq('seance_id', seanceId)
      .eq('odj_point_id', odjPointId)

    const recusedMemberIds = new Set((recusations || []).map(r => r.member_id))

    const activePresences = (presences || []).filter(
      p => (p.statut === 'PRESENT' || p.statut === 'PROCURATION') && !p.heure_depart && !recusedMemberIds.has(p.member_id)
    )
    const totalVotants = activePresences.length

    if (totalVotants === 0) {
      return { error: 'Aucun membre présent — impossible d\'ouvrir un vote' }
    }

    // H5: Check quorum before opening vote (CGCT L2121-17)
    if (instanceConfig && !(seance as Record<string, unknown>).reconvocation) {
      const total = instanceConfig.composition_max || totalVotants
      let quorumRequired = Math.floor(total / 2) + 1
      const qType = instanceConfig.quorum_type || 'MAJORITE_MEMBRES'
      if (qType === 'TIERS_MEMBRES') {
        quorumRequired = Math.ceil(total / 3)
      } else if (qType === 'DEUX_TIERS') {
        quorumRequired = Math.ceil((total * 2) / 3)
      } else if (qType === 'STATUTS' && instanceConfig.quorum_fraction_numerateur && instanceConfig.quorum_fraction_denominateur) {
        quorumRequired = Math.ceil((total * instanceConfig.quorum_fraction_numerateur) / instanceConfig.quorum_fraction_denominateur)
      }
      if (totalVotants < quorumRequired) {
        return { error: `Le quorum n'est pas atteint (${totalVotants} présents sur ${quorumRequired} requis). Le vote ne peut pas être ouvert.` }
      }
    }

    // Create the vote
    const { data: vote, error: insertError } = await supabase
      .from('votes')
      .insert({
        seance_id: seanceId,
        odj_point_id: odjPointId,
        type_vote: 'MAIN_LEVEE' as const,
        statut: 'OUVERT' as const,
        total_votants: totalVotants,
        quorum_a_ouverture: totalVotants,
        voix_preponderante_activee: instanceConfig?.voix_preponderante ?? false,
        question: point.titre,
        ouvert_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (insertError) return { error: `Erreur création vote : ${insertError.message}` }

    revalidatePath(`/seances/${seanceId}/en-cours`)
    return { success: true, voteId: vote.id, totalVotants }
  } catch (err) {
    console.error('openVote error:', err)
    return { error: 'Erreur inattendue lors de l\'ouverture du vote' }
  }
}

/**
 * Closes a main levée vote with results.
 * The gestionnaire enters ONLY contre + abstentions.
 * Pour is calculated server-side.
 */
export async function closeVoteMainLevee(
  voteId: string,
  data: {
    contre: number
    abstentions: number
    nomsContre: string[]
    nomsAbstention: string[]
  }
): Promise<CloseVoteResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    const role = (user.user_metadata?.role as string) || ''
    if (!['super_admin', 'gestionnaire'].includes(role)) {
      return { error: 'Seul le gestionnaire peut clore un vote' }
    }

    if (role === 'super_admin') {
      console.warn(`[AUDIT] Super admin ${user.id} performing vote action: closeVoteMainLevee on vote ${voteId}`)
    }

    // Rate limiting
    const rateCheck = await checkRateLimit(supabase, user.id, {
      actionKey: `close_vote_${voteId}`,
      maxAttempts: 30,
      windowMinutes: 60,
    })
    if (!rateCheck.allowed) return { error: rateCheck.error! }

    // Fetch the open vote
    const { data: vote } = await supabase
      .from('votes')
      .select('id, seance_id, odj_point_id, statut, type_vote, total_votants, voix_preponderante_activee, question')
      .eq('id', voteId)
      .single()

    if (!vote) return { error: 'Vote introuvable' }
    if (vote.statut !== 'OUVERT') return { error: 'Ce vote n\'est pas ouvert' }
    if (vote.type_vote !== 'MAIN_LEVEE') return { error: 'Ce n\'est pas un vote à main levée' }

    const totalVotants = vote.total_votants || 0
    const { contre, abstentions, nomsContre, nomsAbstention } = data

    // Validation
    if (contre < 0 || abstentions < 0) {
      return { error: 'Les compteurs ne peuvent pas être négatifs' }
    }
    if (contre + abstentions > totalVotants) {
      return { error: `Le total des contre (${contre}) + abstentions (${abstentions}) dépasse le nombre de votants (${totalVotants})` }
    }

    // Calculate pour
    const pour = totalVotants - contre - abstentions

    // Get ODJ point for majorite_requise
    const { data: point } = await supabase
      .from('odj_points')
      .select('majorite_requise, titre')
      .eq('id', vote.odj_point_id)
      .single()

    const majoriteRequise = (point?.majorite_requise || 'SIMPLE') as MajoriteRequise

    // Determine result
    const resultat = determineVoteResult(
      pour,
      contre,
      abstentions,
      totalVotants,
      majoriteRequise,
      vote.voix_preponderante_activee ?? false
    )

    // Fetch recused members for PV formula (CGCT L2131-11)
    const { data: recusationsForPV } = await supabase
      .from('recusations')
      .select('member:members(prenom, nom)')
      .eq('seance_id', vote.seance_id)
      .eq('odj_point_id', vote.odj_point_id)

    const recusedNames = (recusationsForPV || [])
      .map((r: { member: { prenom: string; nom: string } | null }) =>
        r.member ? `${r.member.prenom} ${r.member.nom}` : null
      )
      .filter((n): n is string => n !== null)

    // Generate PV formula
    const formulePV = generateFormulePV({
      pour,
      contre,
      abstention: abstentions,
      totalVotants,
      resultat,
      nomsContre,
      nomsAbstention,
      titrePoint: point?.titre || vote.question || '',
      recuses: recusedNames,
    })

    // Compute HMAC integrity hash (tamper-proof vote results)
    // H2: Never compute HMAC with empty string — set null if secret missing
    const hmacSecret = process.env.VOTE_HMAC_SECRET
    const closedAt = new Date().toISOString()
    const hashData = `${voteId}|${pour}|${contre}|${abstentions}|${resultat}|${closedAt}`
    const hashIntegrite = hmacSecret
      ? crypto.createHmac('sha256', hmacSecret).update(hashData).digest('hex')
      : null
    if (!hmacSecret) {
      console.error('[SECURITY] VOTE_HMAC_SECRET non configuré — hash intégrité non calculé')
    }

    // Close the vote
    const { error: updateError } = await supabase
      .from('votes')
      .update({
        statut: 'CLOS' as const,
        pour,
        contre,
        abstention: abstentions,
        resultat: resultat as 'ADOPTE' | 'REJETE' | 'NUL' | 'ADOPTE_UNANIMITE' | 'ADOPTE_VOIX_PREPONDERANTE',
        formule_pv: formulePV,
        noms_contre: nomsContre,
        noms_abstention: nomsAbstention,
        clos_at: closedAt,
        hash_integrite: hashIntegrite,
      })
      .eq('id', voteId)

    if (updateError) return { error: `Erreur clôture : ${updateError.message}` }

    // Mark the ODJ point as treated
    await supabase
      .from('odj_points')
      .update({ statut: 'TRAITE' })
      .eq('id', vote.odj_point_id)

    revalidatePath(`/seances/${vote.seance_id}/en-cours`)
    revalidatePath(`/seances/${vote.seance_id}`)
    return { success: true, resultat, formulePV }
  } catch (err) {
    console.error('closeVoteMainLevee error:', err)
    return { error: 'Erreur inattendue lors de la clôture du vote' }
  }
}

/**
 * Shortcut: close vote as unanimité (contre=0, abstentions=0)
 */
export async function closeVoteUnanimite(voteId: string): Promise<CloseVoteResult> {
  return closeVoteMainLevee(voteId, {
    contre: 0,
    abstentions: 0,
    nomsContre: [],
    nomsAbstention: [],
  })
}

/**
 * Cancels an open vote.
 */
export async function cancelVote(voteId: string): Promise<ActionResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    const role = (user.user_metadata?.role as string) || ''
    if (!['super_admin', 'gestionnaire'].includes(role)) {
      return { error: 'Permissions insuffisantes' }
    }

    // Rate limiting
    const rateCheck = await checkRateLimit(supabase, user.id, {
      actionKey: `cancel_vote_${voteId}`,
      maxAttempts: 30,
      windowMinutes: 60,
    })
    if (!rateCheck.allowed) return { error: rateCheck.error! }

    const { data: vote } = await supabase
      .from('votes')
      .select('id, statut, seance_id')
      .eq('id', voteId)
      .single()

    if (!vote) return { error: 'Vote introuvable' }
    if (vote.statut !== 'OUVERT' && vote.statut !== 'CLOS') {
      return { error: 'Seul un vote ouvert ou clos peut être annulé' }
    }

    // If vote is CLOS, check if a deliberation was created from it
    if (vote.statut === 'CLOS') {
      const { data: delib } = await supabase
        .from('deliberations')
        .select('id, numero, publie_at')
        .eq('vote_id', voteId)
        .maybeSingle()

      if (delib) {
        if (delib.publie_at) {
          return { error: 'Ce vote ne peut pas être annulé car une délibération publiée (n° ' + delib.numero + ') en découle. Annulez d\'abord la délibération.' }
        }
        // Delete the draft deliberation
        await supabase
          .from('deliberations')
          .delete()
          .eq('id', delib.id)
      }
    }

    const { error: updateError } = await supabase
      .from('votes')
      .update({
        statut: 'ANNULE' as const,
        clos_at: new Date().toISOString(),
      })
      .eq('id', voteId)

    if (updateError) return { error: `Erreur : ${updateError.message}` }

    revalidatePath(`/seances/${vote.seance_id}/en-cours`)
    return { success: true }
  } catch (err) {
    console.error('cancelVote error:', err)
    return { error: 'Erreur inattendue' }
  }
}

/**
 * Get all votes for a seance.
 */
export async function getVotesForSeance(seanceId: string) {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    const { data, error } = await supabase
      .from('votes')
      .select('*')
      .eq('seance_id', seanceId)
      .order('ouvert_at', { ascending: true })

    if (error) return { error: error.message }
    return { data: data || [] }
  } catch (err) {
    console.error('getVotesForSeance error:', err)
    return { error: 'Erreur inattendue' }
  }
}

// ─── Secret Vote Server Actions ─────────────────────────────────────────────

type SecretVoteProgress = { votedCount: number; totalVotants: number }
type SecretVoteProgressResult = SecretVoteProgress | { error: string }

/**
 * Opens a secret ballot vote on an ODJ point.
 * Generates an AES-256 session key, encrypts it with master key, stores in DB.
 */
export async function openVoteSecret(
  seanceId: string,
  odjPointId: string
): Promise<OpenVoteResult> {
  let sessionKeyBuffer: Buffer | null = null
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    const role = (user.user_metadata?.role as string) || ''
    if (!['super_admin', 'gestionnaire'].includes(role)) {
      return { error: 'Seul le gestionnaire peut ouvrir un vote secret' }
    }

    if (role === 'super_admin') {
      console.warn(`[AUDIT] Super admin ${user.id} performing vote action: openVoteSecret on seance ${seanceId}, point ${odjPointId}`)
    }

    // Verify encryption key is configured
    const masterKeyHex = process.env.VOTE_ENCRYPTION_KEY
    if (!masterKeyHex) {
      return { error: 'La clé de chiffrement des votes n\'est pas configurée (VOTE_ENCRYPTION_KEY)' }
    }

    // Rate limiting: max 20 ouvertures de vote par séance par heure
    const rateCheck = await checkRateLimit(supabase, user.id, {
      actionKey: `open_vote_${seanceId}`,
      maxAttempts: 20,
      windowMinutes: 60,
    })
    if (!rateCheck.allowed) return { error: rateCheck.error! }

    // Verify seance is EN_COURS
    const { data: seance } = await supabase
      .from('seances')
      .select('id, statut, instance_id, reconvocation')
      .eq('id', seanceId)
      .single()

    if (!seance) return { error: 'Séance introuvable' }
    if (seance.statut !== 'EN_COURS') {
      return { error: 'La séance doit être en cours pour ouvrir un vote' }
    }

    // Get instance config for voix_preponderante + quorum
    const { data: instanceConfig } = await supabase
      .from('instance_config')
      .select('voix_preponderante, quorum_type, quorum_fraction_numerateur, quorum_fraction_denominateur, composition_max')
      .eq('id', seance.instance_id)
      .single()

    // Verify ODJ point allows voting
    const { data: point } = await supabase
      .from('odj_points')
      .select('id, titre, votes_interdits, type_traitement')
      .eq('id', odjPointId)
      .single()

    if (!point) return { error: 'Point ODJ introuvable' }
    if (point.votes_interdits) {
      return { error: 'Ce point est de type information — le vote est interdit' }
    }

    // Check no other vote is currently OUVERT for this seance
    const { data: openVotes } = await supabase
      .from('votes')
      .select('id')
      .eq('seance_id', seanceId)
      .eq('statut', 'OUVERT')

    if (openVotes && openVotes.length > 0) {
      return { error: 'Un vote est déjà en cours sur cette séance. Clôturez-le d\'abord.' }
    }

    // Block double vote: check if this point already has a completed (CLOS) vote
    const { data: existingClosedVotesSecret } = await supabase
      .from('votes')
      .select('id, statut')
      .eq('odj_point_id', odjPointId)
      .eq('statut', 'CLOS')

    if (existingClosedVotesSecret && existingClosedVotesSecret.length > 0) {
      return { error: 'Ce point a déjà fait l\'objet d\'un vote clos. Annulez le vote précédent avant d\'en ouvrir un nouveau.' }
    }

    // Calculate quorum snapshot
    const { data: presences } = await supabase
      .from('presences')
      .select('id, member_id, statut, heure_depart')
      .eq('seance_id', seanceId)

    // Exclude recused members for this point (CGCT L2131-11)
    const { data: recusationsSecret } = await supabase
      .from('recusations')
      .select('member_id')
      .eq('seance_id', seanceId)
      .eq('odj_point_id', odjPointId)

    const recusedMemberIdsSecret = new Set((recusationsSecret || []).map(r => r.member_id))

    const activePresences = (presences || []).filter(
      p => (p.statut === 'PRESENT' || p.statut === 'PROCURATION') && !p.heure_depart && !recusedMemberIdsSecret.has(p.member_id)
    )
    const totalVotants = activePresences.length

    if (totalVotants === 0) {
      return { error: 'Aucun membre présent — impossible d\'ouvrir un vote' }
    }

    // H5: Check quorum before opening vote (CGCT L2121-17)
    if (instanceConfig && !(seance as Record<string, unknown>).reconvocation) {
      const total = instanceConfig.composition_max || totalVotants
      let quorumRequired = Math.floor(total / 2) + 1
      const qType = instanceConfig.quorum_type || 'MAJORITE_MEMBRES'
      if (qType === 'TIERS_MEMBRES') {
        quorumRequired = Math.ceil(total / 3)
      } else if (qType === 'DEUX_TIERS') {
        quorumRequired = Math.ceil((total * 2) / 3)
      } else if (qType === 'STATUTS' && instanceConfig.quorum_fraction_numerateur && instanceConfig.quorum_fraction_denominateur) {
        quorumRequired = Math.ceil((total * instanceConfig.quorum_fraction_numerateur) / instanceConfig.quorum_fraction_denominateur)
      }
      if (totalVotants < quorumRequired) {
        return { error: `Le quorum n'est pas atteint (${totalVotants} présents sur ${quorumRequired} requis). Le vote ne peut pas être ouvert.` }
      }
    }

    // Generate and encrypt session key
    sessionKeyBuffer = generateVoteSessionKey()
    const encryptedKey = encryptSessionKey(sessionKeyBuffer, masterKeyHex)

    // Destroy plain key immediately
    destroyKey(sessionKeyBuffer)
    sessionKeyBuffer = null

    // Create the vote
    const { data: vote, error: insertError } = await supabase
      .from('votes')
      .insert({
        seance_id: seanceId,
        odj_point_id: odjPointId,
        type_vote: 'SECRET' as const,
        statut: 'OUVERT' as const,
        total_votants: totalVotants,
        quorum_a_ouverture: totalVotants,
        voix_preponderante_activee: instanceConfig?.voix_preponderante ?? false,
        question: point.titre,
        ouvert_at: new Date().toISOString(),
        encrypted_session_key: encryptedKey,
      })
      .select('id')
      .single()

    if (insertError) return { error: `Erreur création vote secret : ${insertError.message}` }

    revalidatePath(`/seances/${seanceId}/en-cours`)
    return { success: true, voteId: vote.id, totalVotants }
  } catch (err) {
    // Best-effort cleanup if key is still in memory
    if (sessionKeyBuffer) destroyKey(sessionKeyBuffer)
    console.error('openVoteSecret error:', err)
    return { error: 'Erreur inattendue lors de l\'ouverture du vote secret' }
  }
}

/**
 * Submit a secret ballot.
 * Separates participation (who voted) from choice (encrypted, anonymous).
 */
export async function submitSecretBallot(
  voteId: string,
  memberId: string,
  choice: 'POUR' | 'CONTRE' | 'ABSTENTION'
): Promise<ActionResult> {
  let sessionKeyBuffer: Buffer | null = null
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    // Verify encryption key is configured
    const masterKeyHex = process.env.VOTE_ENCRYPTION_KEY
    if (!masterKeyHex) {
      return { error: 'La clé de chiffrement des votes n\'est pas configurée (VOTE_ENCRYPTION_KEY)' }
    }

    // H2: Never compute HMAC with empty string — set null if secret missing
    const hmacSecret = process.env.VOTE_HMAC_SECRET
    if (!hmacSecret) {
      console.error('[SECURITY] VOTE_HMAC_SECRET non configuré — hash intégrité non calculé')
    }

    // Rate limiting: max 60 soumissions de bulletin par heure par utilisateur
    const rateCheck = await checkRateLimit(supabase, user.id, {
      actionKey: `submit_ballot_${voteId}`,
      maxAttempts: 60,
      windowMinutes: 60,
    })
    if (!rateCheck.allowed) return { error: rateCheck.error! }

    // Fetch the vote
    const { data: vote } = await supabase
      .from('votes')
      .select('id, seance_id, odj_point_id, statut, type_vote, encrypted_session_key')
      .eq('id', voteId)
      .single()

    if (!vote) return { error: 'Vote introuvable' }
    if (vote.statut !== 'OUVERT') return { error: 'Ce vote n\'est plus ouvert' }
    if (vote.type_vote !== 'SECRET') return { error: 'Ce vote n\'est pas un scrutin secret' }
    if (!vote.encrypted_session_key) return { error: 'Erreur de configuration : clé de session manquante' }

    // Check if member is recused for this point (CGCT L2131-11)
    const { data: recusationCheck } = await supabase
      .from('recusations')
      .select('id')
      .eq('seance_id', vote.seance_id)
      .eq('odj_point_id', vote.odj_point_id)
      .eq('member_id', memberId)
      .maybeSingle()

    if (recusationCheck) {
      return { error: 'Ce membre est récusé pour ce point — vote interdit (conflit d\'intérêt)' }
    }

    // Verify member is convoqué for this séance
    const { data: convocataire } = await supabase
      .from('convocataires')
      .select('id')
      .eq('seance_id', vote.seance_id)
      .eq('member_id', memberId)
      .maybeSingle()

    if (!convocataire) {
      return { error: 'Ce membre n\'est pas convoqué pour cette séance' }
    }

    // Check: member hasn't already voted (UNIQUE constraint will also catch this)
    const { data: existingParticipation } = await supabase
      .from('votes_participation')
      .select('id')
      .eq('vote_id', voteId)
      .eq('member_id', memberId)
      .maybeSingle()

    if (existingParticipation) {
      return { error: 'Ce membre a déjà voté pour ce scrutin' }
    }

    // Decrypt session key
    sessionKeyBuffer = decryptSessionKey(vote.encrypted_session_key, masterKeyHex)

    // Generate anonymous bulletin
    const bulletinToken = generateBulletinToken()
    const encrypted = encryptChoice(choice, sessionKeyBuffer)
    const choixChiffre = `${encrypted.ciphertext}:${encrypted.iv}:${encrypted.tag}`
    const hashIntegrite = hmacSecret
      ? computeBulletinHash(
          voteId,
          bulletinToken,
          choixChiffre,
          encrypted.iv,
          hmacSecret
        )
      : null

    // Destroy key from memory
    destroyKey(sessionKeyBuffer)
    sessionKeyBuffer = null

    // INSERT participation (who voted — without the choice)
    const { error: partError } = await supabase
      .from('votes_participation')
      .insert({
        vote_id: voteId,
        member_id: memberId,
        a_vote: true,
      })

    if (partError) {
      // UNIQUE constraint violation = already voted
      if (partError.code === '23505') {
        return { error: 'Ce membre a déjà voté pour ce scrutin' }
      }
      return { error: `Erreur d'enregistrement de la participation : ${partError.message}` }
    }

    // INSERT secret bulletin (the choice — without identity)
    const { error: bulletinError } = await supabase
      .from('bulletins_secret')
      .insert({
        vote_id: voteId as string,
        bulletin_token: bulletinToken as string,
        choix_chiffre: choixChiffre as string,
        hash_integrite: hashIntegrite as string,
        nonce: encrypted.iv as string,
      })

    if (bulletinError) {
      return { error: `Erreur d'enregistrement du bulletin : ${bulletinError.message}` }
    }

    revalidatePath(`/seances/${vote.seance_id}/en-cours`)
    return { success: true }
  } catch (err) {
    if (sessionKeyBuffer) destroyKey(sessionKeyBuffer)
    console.error('submitSecretBallot error:', err)
    return { error: 'Erreur inattendue lors de la soumission du bulletin secret' }
  }
}

/**
 * Closes a secret ballot vote: decrypts all bulletins, tallies, computes result.
 * Destroys the session key after tallying.
 */
export async function closeVoteSecret(voteId: string): Promise<CloseVoteResult> {
  let sessionKeyBuffer: Buffer | null = null
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    const role = (user.user_metadata?.role as string) || ''
    if (!['super_admin', 'gestionnaire'].includes(role)) {
      return { error: 'Seul le gestionnaire peut clore un vote secret' }
    }

    if (role === 'super_admin') {
      console.warn(`[AUDIT] Super admin ${user.id} performing vote action: closeVoteSecret on vote ${voteId}`)
    }

    // Verify encryption key is configured
    const masterKeyHex = process.env.VOTE_ENCRYPTION_KEY
    if (!masterKeyHex) {
      return { error: 'La clé de chiffrement des votes n\'est pas configurée (VOTE_ENCRYPTION_KEY)' }
    }

    // H2: Never compute HMAC with empty string — set null if secret missing
    const hmacSecret = process.env.VOTE_HMAC_SECRET
    if (!hmacSecret) {
      console.error('[SECURITY] VOTE_HMAC_SECRET non configuré — hash intégrité non calculé')
    }

    // Fetch the vote
    const { data: vote } = await supabase
      .from('votes')
      .select('id, seance_id, odj_point_id, statut, type_vote, total_votants, voix_preponderante_activee, question, encrypted_session_key')
      .eq('id', voteId)
      .single()

    if (!vote) return { error: 'Vote introuvable' }
    if (vote.statut !== 'OUVERT') return { error: 'Ce vote n\'est pas ouvert' }
    if (vote.type_vote !== 'SECRET') return { error: 'Ce n\'est pas un scrutin secret' }
    if (!vote.encrypted_session_key) return { error: 'Clé de session manquante — vote corrompu' }

    // Fetch all secret bulletins
    const { data: bulletins, error: bulletinsError } = await supabase
      .from('bulletins_secret')
      .select('*')
      .eq('vote_id', voteId)

    if (bulletinsError) return { error: `Erreur lecture bulletins : ${bulletinsError.message}` }
    if (!bulletins || bulletins.length === 0) {
      return { error: 'Aucun bulletin enregistré — impossible de clore le vote' }
    }

    // Decrypt session key
    sessionKeyBuffer = decryptSessionKey(vote.encrypted_session_key, masterKeyHex)

    // Decrypt and tally each bulletin
    let pour = 0
    let contre = 0
    let abstention = 0

    for (const bulletin of bulletins) {
      // Parse choix_chiffre format: "ciphertext:iv:tag"
      const parts = bulletin.choix_chiffre.split(':')
      if (parts.length !== 3) {
        destroyKey(sessionKeyBuffer)
        return { error: `Bulletin corrompu (format invalide) — token ${bulletin.bulletin_token.substring(0, 8)}...` }
      }
      const [ciphertext, iv, tag] = parts

      // Verify HMAC integrity
      const expectedHash = hmacSecret
        ? computeBulletinHash(
            voteId,
            bulletin.bulletin_token,
            bulletin.choix_chiffre,
            bulletin.nonce,
            hmacSecret
          )
        : null
      if (hmacSecret && expectedHash !== bulletin.hash_integrite) {
        destroyKey(sessionKeyBuffer)
        return { error: `Intégrité compromise sur un bulletin — le vote ne peut pas être clos. Contactez l'administrateur.` }
      }

      // Decrypt the choice
      let choix: string
      try {
        choix = decryptChoice(ciphertext, iv, tag, sessionKeyBuffer)
      } catch {
        destroyKey(sessionKeyBuffer)
        return { error: 'Erreur de déchiffrement d\'un bulletin — clé potentiellement corrompue' }
      }

      switch (choix) {
        case 'POUR':
          pour++
          break
        case 'CONTRE':
          contre++
          break
        case 'ABSTENTION':
          abstention++
          break
        default:
          destroyKey(sessionKeyBuffer)
          return { error: `Choix de vote invalide détecté : "${choix}"` }
      }
    }

    // Destroy session key
    destroyKey(sessionKeyBuffer)
    sessionKeyBuffer = null

    const totalVotants = vote.total_votants || 0

    // Get ODJ point for majorite_requise
    const { data: point } = await supabase
      .from('odj_points')
      .select('majorite_requise, titre')
      .eq('id', vote.odj_point_id)
      .single()

    const majoriteRequise = (point?.majorite_requise || 'SIMPLE') as MajoriteRequise

    // Determine result
    const resultat = determineVoteResult(
      pour,
      contre,
      abstention,
      totalVotants,
      majoriteRequise,
      vote.voix_preponderante_activee ?? false
    )

    // Fetch recused members for PV formula (CGCT L2131-11)
    const { data: recusationsForSecretPV } = await supabase
      .from('recusations')
      .select('member:members(prenom, nom)')
      .eq('seance_id', vote.seance_id)
      .eq('odj_point_id', vote.odj_point_id)

    const recusedNamesSecret = (recusationsForSecretPV || [])
      .map((r: { member: { prenom: string; nom: string } | null }) =>
        r.member ? `${r.member.prenom} ${r.member.nom}` : null
      )
      .filter((n): n is string => n !== null)

    // Generate PV formula (no names for secret ballot)
    const formulePV = generateFormulePV({
      pour,
      contre,
      abstention,
      totalVotants,
      resultat,
      nomsContre: [],
      nomsAbstention: [],
      titrePoint: point?.titre || vote.question || '',
      recuses: recusedNamesSecret,
    })

    // Compute HMAC integrity hash for the vote result (H2: null if secret missing)
    const closedAt = new Date().toISOString()
    const hashData = `${voteId}|${pour}|${contre}|${abstention}|${resultat}|${closedAt}`
    const hashIntegrite = hmacSecret
      ? crypto.createHmac('sha256', hmacSecret).update(hashData).digest('hex')
      : null

    // Close the vote and destroy the encrypted session key
    const { error: updateError } = await supabase
      .from('votes')
      .update({
        statut: 'CLOS' as const,
        pour,
        contre,
        abstention,
        resultat: resultat as 'ADOPTE' | 'REJETE' | 'NUL' | 'ADOPTE_UNANIMITE' | 'ADOPTE_VOIX_PREPONDERANTE',
        formule_pv: formulePV,
        noms_contre: [],
        noms_abstention: [],
        clos_at: closedAt,
        hash_integrite: hashIntegrite,
        encrypted_session_key: null,
      })
      .eq('id', voteId)

    if (updateError) return { error: `Erreur clôture : ${updateError.message}` }

    // Mark the ODJ point as treated
    await supabase
      .from('odj_points')
      .update({ statut: 'TRAITE' })
      .eq('id', vote.odj_point_id)

    revalidatePath(`/seances/${vote.seance_id}/en-cours`)
    revalidatePath(`/seances/${vote.seance_id}`)
    return { success: true, resultat, formulePV }
  } catch (err) {
    if (sessionKeyBuffer) destroyKey(sessionKeyBuffer)
    console.error('closeVoteSecret error:', err)
    return { error: 'Erreur inattendue lors de la clôture du vote secret' }
  }
}

/**
 * Get secret vote progress: how many have voted vs total.
 * NEVER returns individual choices — only counts.
 */
export async function getSecretVoteProgress(
  voteId: string
): Promise<SecretVoteProgressResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    // Get vote for totalVotants
    const { data: vote } = await supabase
      .from('votes')
      .select('total_votants')
      .eq('id', voteId)
      .single()

    if (!vote) return { error: 'Vote introuvable' }

    // Count participation entries
    const { count, error } = await supabase
      .from('votes_participation')
      .select('*', { count: 'exact', head: true })
      .eq('vote_id', voteId)

    if (error) return { error: `Erreur comptage : ${error.message}` }

    return {
      votedCount: count || 0,
      totalVotants: vote.total_votants || 0,
    }
  } catch (err) {
    console.error('getSecretVoteProgress error:', err)
    return { error: 'Erreur inattendue' }
  }
}

/**
 * Check if a specific member has already voted in a secret ballot.
 * Returns only boolean — never the choice.
 */
export async function checkMemberHasVoted(
  voteId: string,
  memberId: string
): Promise<{ hasVoted: boolean } | { error: string }> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    const { data } = await supabase
      .from('votes_participation')
      .select('id')
      .eq('vote_id', voteId)
      .eq('member_id', memberId)
      .maybeSingle()

    return { hasVoted: !!data }
  } catch (err) {
    console.error('checkMemberHasVoted error:', err)
    return { error: 'Erreur inattendue' }
  }
}

// ─── Télévote (OTP SMS) Server Actions ──────────────────────────────────────

// Helper: televote_otps wrapper for consistency.
// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
function televoteOtps(supabase: any) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).from('televote_otps')
}

const OTP_EXPIRY_MINUTES = 8
const MAX_RESENDS = 3

type TelevoteSMSStatus = {
  memberId: string
  nom: string
  prenom: string
  telephone: string | null
  maskedPhone: string | null
  sent: boolean
  error?: string
}

type OpenTelevoteResult =
  | { success: true; voteId: string; totalVotants: number; smsStatuses: TelevoteSMSStatus[] }
  | { error: string }

function generateOTP(): { code: string; hash: string } {
  const code = String(crypto.randomInt(100000, 999999))
  const hash = crypto.createHash('sha256').update(code).digest('hex')
  return { code, hash }
}

export async function openVoteTelevote(
  seanceId: string,
  odjPointId: string,
  remoteMemberIds: string[]
): Promise<OpenTelevoteResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    const role = (user.user_metadata?.role as string) || ''
    if (!['super_admin', 'gestionnaire'].includes(role)) {
      return { error: 'Seul le gestionnaire peut ouvrir un télévote' }
    }

    if (role === 'super_admin') {
      console.warn(`[AUDIT] Super admin ${user.id} performing vote action: openVoteTelevote on seance ${seanceId}, point ${odjPointId}`)
    }

    const rateCheck = await checkRateLimit(supabase, user.id, {
      actionKey: `open_vote_${seanceId}`,
      maxAttempts: 20,
      windowMinutes: 60,
    })
    if (!rateCheck.allowed) return { error: rateCheck.error! }

    if (!remoteMemberIds || remoteMemberIds.length === 0) {
      return { error: 'Sélectionnez au moins un membre distant pour le télévote' }
    }

    const { data: seance } = await supabase
      .from('seances')
      .select('id, statut, instance_id, titre, reconvocation')
      .eq('id', seanceId)
      .single()

    if (!seance) return { error: 'Séance introuvable' }
    if (seance.statut !== 'EN_COURS') {
      return { error: 'La séance doit être en cours pour ouvrir un vote' }
    }

    const { data: instanceConfig } = await supabase
      .from('instance_config')
      .select('voix_preponderante, quorum_type, quorum_fraction_numerateur, quorum_fraction_denominateur, composition_max')
      .eq('id', seance.instance_id)
      .single()

    const { data: point } = await supabase
      .from('odj_points')
      .select('id, titre, votes_interdits, type_traitement')
      .eq('id', odjPointId)
      .single()

    if (!point) return { error: 'Point ODJ introuvable' }
    if (point.votes_interdits) {
      return { error: 'Ce point est de type information — le vote est interdit' }
    }

    // M13: ELECTION check — elections must use secret ballot
    if ((point as Record<string, unknown>).type_traitement === 'ELECTION') {
      return { error: 'Les élections de personnes doivent obligatoirement se dérouler par vote secret (CGCT L2121-21). Utilisez le vote à bulletin secret.' }
    }

    // M13: Block double vote on CLOS points
    const { data: existingClosedVotesTele } = await supabase
      .from('votes')
      .select('id, statut')
      .eq('odj_point_id', odjPointId)
      .eq('statut', 'CLOS')

    if (existingClosedVotesTele && existingClosedVotesTele.length > 0) {
      return { error: 'Ce point a déjà fait l\'objet d\'un vote clos. Annulez le vote précédent avant d\'en ouvrir un nouveau.' }
    }

    const { data: openVotes } = await supabase
      .from('votes')
      .select('id')
      .eq('seance_id', seanceId)
      .eq('statut', 'OUVERT')

    if (openVotes && openVotes.length > 0) {
      return { error: 'Un vote est déjà en cours sur cette séance. Clôturez-le d\'abord.' }
    }

    const { data: members } = await supabase
      .from('members')
      .select('id, prenom, nom, telephone')
      .in('id', remoteMemberIds)

    if (!members || members.length === 0) {
      return { error: 'Aucun membre trouvé pour les identifiants fournis' }
    }

    const membersWithoutPhone = members.filter(m => !m.telephone)
    if (membersWithoutPhone.length > 0) {
      const names = membersWithoutPhone.map(m => `${m.prenom} ${m.nom}`).join(', ')
      return { error: `Numéro de téléphone manquant pour : ${names}. Mettez à jour leur fiche membre.` }
    }

    const totalVotants = members.length

    // H5: Check quorum before opening televote (CGCT L2121-17)
    if (instanceConfig && !(seance as Record<string, unknown>).reconvocation) {
      const total = instanceConfig.composition_max || totalVotants
      let quorumRequired = Math.floor(total / 2) + 1
      const qType = (instanceConfig as Record<string, unknown>).quorum_type as string || 'MAJORITE_MEMBRES'
      if (qType === 'TIERS_MEMBRES') {
        quorumRequired = Math.ceil(total / 3)
      } else if (qType === 'DEUX_TIERS') {
        quorumRequired = Math.ceil((total * 2) / 3)
      }
      if (totalVotants < quorumRequired) {
        return { error: `Le quorum n'est pas atteint (${totalVotants} présents sur ${quorumRequired} requis). Le vote ne peut pas être ouvert.` }
      }
    }

    const { data: vote, error: insertError } = await supabase
      .from('votes')
      .insert({
        seance_id: seanceId,
        odj_point_id: odjPointId,
        type_vote: 'TELEVOTE' as const,
        statut: 'OUVERT' as const,
        total_votants: totalVotants,
        quorum_a_ouverture: totalVotants,
        voix_preponderante_activee: instanceConfig?.voix_preponderante ?? false,
        question: point.titre,
        ouvert_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (insertError) return { error: `Erreur création vote : ${insertError.message}` }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const voteUrl = `${appUrl}/vote/${vote.id}`
    const smsStatuses: TelevoteSMSStatus[] = []

    for (const member of members) {
      const { code, hash } = generateOTP()
      const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString()

      const { error: otpError } = await televoteOtps(supabase)
        .insert({
          vote_id: vote.id,
          member_id: member.id,
          otp_hash: hash,
          expires_at: expiresAt,
        })

      if (otpError) {
        smsStatuses.push({
          memberId: member.id,
          nom: member.nom,
          prenom: member.prenom,
          telephone: member.telephone,
          maskedPhone: member.telephone ? maskPhoneNumber(member.telephone) : null,
          sent: false,
          error: `Erreur enregistrement OTP : ${otpError.message}`,
        })
        continue
      }

      const smsBody = `Votre code de vote : ${code}. Votez sur ${voteUrl}. Code valable ${OTP_EXPIRY_MINUTES} min.`
      const smsResult = await sendSMS(member.telephone!, smsBody)

      if (smsResult.success && smsResult.sid) {
        await televoteOtps(supabase)
          .update({ sms_sid: smsResult.sid })
          .eq('vote_id', vote.id)
          .eq('member_id', member.id)
      }

      smsStatuses.push({
        memberId: member.id,
        nom: member.nom,
        prenom: member.prenom,
        telephone: member.telephone,
        maskedPhone: member.telephone ? maskPhoneNumber(member.telephone) : null,
        sent: smsResult.success,
        error: smsResult.error,
      })
    }

    revalidatePath(`/seances/${seanceId}/en-cours`)
    return { success: true, voteId: vote.id, totalVotants, smsStatuses }
  } catch (err) {
    console.error('openVoteTelevote error:', err)
    return { error: 'Erreur inattendue lors de l\'ouverture du télévote' }
  }
}

export async function verifyOTPAndVote(
  voteId: string,
  otp: string,
  choice: 'POUR' | 'CONTRE' | 'ABSTENTION'
): Promise<{ success: true; memberName: string } | { error: string; code?: string }> {
  try {
    const supabase = await createServiceRoleClient()

    // H3: Rate limit OTP attempts by voteId (max 10 attempts per vote per 5 min)
    // Uses service role so we can't use user-based rate limiting
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const { count: attemptCount } = await supabase
      .from('rate_limits')
      .select('*', { count: 'exact', head: true })
      .eq('action_key', `otp_verify_${voteId}`)
      .gte('created_at', fiveMinAgo)

    if (attemptCount && attemptCount >= 10) {
      return { error: 'Trop de tentatives. Veuillez réessayer dans quelques minutes.', code: 'RATE_LIMITED' }
    }

    // Record this attempt
    await supabase.from('rate_limits').insert({
      action_key: `otp_verify_${voteId}`,
      user_id: '00000000-0000-0000-0000-000000000000',
    })

    const otpHash = crypto.createHash('sha256').update(otp).digest('hex')

    const { data: otpRecord } = await televoteOtps(supabase)
      .select('id, vote_id, member_id, otp_hash, expires_at, used')
      .eq('vote_id', voteId)
      .eq('otp_hash', otpHash)
      .maybeSingle()

    if (!otpRecord) {
      return { error: 'Code invalide. Vérifiez votre SMS et réessayez.', code: 'INVALID_OTP' }
    }
    if (otpRecord.used) {
      return { error: 'Ce code a déjà été utilisé. Vous avez déjà voté.', code: 'ALREADY_USED' }
    }
    if (new Date(otpRecord.expires_at) < new Date()) {
      return { error: 'Ce code a expiré. Demandez un nouveau code au gestionnaire.', code: 'EXPIRED' }
    }

    const { data: vote } = await supabase
      .from('votes')
      .select('id, seance_id, statut, type_vote, question')
      .eq('id', voteId)
      .single()

    if (!vote) return { error: 'Vote introuvable.' }
    if (vote.statut !== 'OUVERT') return { error: 'Ce vote n\'est plus ouvert.', code: 'VOTE_CLOSED' }
    if (vote.type_vote !== 'TELEVOTE') return { error: 'Ce n\'est pas un télévote.' }

    const { data: existingPart } = await supabase
      .from('votes_participation')
      .select('id')
      .eq('vote_id', voteId)
      .eq('member_id', otpRecord.member_id)
      .maybeSingle()

    if (existingPart) {
      return { error: 'Vous avez déjà voté pour ce scrutin.', code: 'ALREADY_VOTED' }
    }

    const { data: member } = await supabase
      .from('members')
      .select('prenom, nom')
      .eq('id', otpRecord.member_id)
      .single()

    await televoteOtps(supabase)
      .update({ used: true, used_at: new Date().toISOString(), choix: choice })
      .eq('id', otpRecord.id)

    const { error: partError } = await supabase
      .from('votes_participation')
      .insert({ vote_id: voteId, member_id: otpRecord.member_id, a_vote: true })

    if (partError) {
      if (partError.code === '23505') {
        return { error: 'Vous avez déjà voté pour ce scrutin.', code: 'ALREADY_VOTED' }
      }
      return { error: `Erreur d'enregistrement : ${partError.message}` }
    }

    const memberName = member ? `${member.prenom} ${member.nom}` : 'Membre'
    return { success: true, memberName }
  } catch (err) {
    console.error('verifyOTPAndVote error:', err)
    return { error: 'Erreur inattendue lors de la vérification du code' }
  }
}

export async function resendTelevoteOTP(
  voteId: string,
  memberId: string
): Promise<{ success: true } | { error: string }> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    const role = (user.user_metadata?.role as string) || ''
    if (!['super_admin', 'gestionnaire'].includes(role)) {
      return { error: 'Permissions insuffisantes' }
    }

    const { data: existing } = await televoteOtps(supabase)
      .select('id, resend_count, used')
      .eq('vote_id', voteId)
      .eq('member_id', memberId)
      .maybeSingle()

    if (!existing) return { error: 'Aucun OTP trouvé pour ce membre sur ce vote' }
    if (existing.used) return { error: 'Ce membre a déjà voté' }
    if ((existing.resend_count || 0) >= MAX_RESENDS) {
      return { error: `Nombre maximum de renvois atteint (${MAX_RESENDS}). Contactez l'administrateur.` }
    }

    const { data: vote } = await supabase
      .from('votes')
      .select('statut')
      .eq('id', voteId)
      .single()

    if (!vote || vote.statut !== 'OUVERT') {
      return { error: 'Ce vote n\'est plus ouvert' }
    }

    const { data: member } = await supabase
      .from('members')
      .select('telephone, prenom, nom')
      .eq('id', memberId)
      .single()

    if (!member?.telephone) {
      return { error: 'Numéro de téléphone manquant pour ce membre' }
    }

    const { code, hash } = generateOTP()
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString()

    await televoteOtps(supabase)
      .update({
        otp_hash: hash,
        expires_at: expiresAt,
        resend_count: (existing.resend_count || 0) + 1,
      })
      .eq('id', existing.id)

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const voteUrl = `${appUrl}/vote/${voteId}`
    const smsBody = `Nouveau code de vote : ${code}. Votez sur ${voteUrl}. Code valable ${OTP_EXPIRY_MINUTES} min.`
    const smsResult = await sendSMS(member.telephone, smsBody)

    if (!smsResult.success) {
      return { error: `Erreur envoi SMS : ${smsResult.error}` }
    }

    if (smsResult.sid) {
      await televoteOtps(supabase)
        .update({ sms_sid: smsResult.sid })
        .eq('id', existing.id)
    }

    return { success: true }
  } catch (err) {
    console.error('resendTelevoteOTP error:', err)
    return { error: 'Erreur inattendue lors du renvoi du code' }
  }
}

export async function getTelevoteProgress(voteId: string): Promise<
  | {
      votedCount: number
      totalVotants: number
      members: Array<{
        memberId: string
        nom: string
        prenom: string
        maskedPhone: string | null
        hasVoted: boolean
        otpExpired: boolean
        resendCount: number
      }>
    }
  | { error: string }
> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    const { data: vote } = await supabase
      .from('votes')
      .select('id, total_votants')
      .eq('id', voteId)
      .single()

    if (!vote) return { error: 'Vote introuvable' }

    const { data: otps } = await televoteOtps(supabase)
      .select('member_id, used, expires_at, resend_count')
      .eq('vote_id', voteId)

    if (!otps) return { error: 'Aucun OTP trouvé' }

    const memberIds = otps.map((o: { member_id: string }) => o.member_id)
    const { data: membersData } = await supabase
      .from('members')
      .select('id, prenom, nom, telephone')
      .in('id', memberIds)

    const memberMap = new Map(membersData?.map(m => [m.id, m]) || [])
    const now = new Date()
    let votedCount = 0

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const memberStatuses = otps.map((otp: any) => {
      const member = memberMap.get(otp.member_id)
      const hasVoted = otp.used === true
      if (hasVoted) votedCount++
      return {
        memberId: otp.member_id,
        nom: member?.nom || '?',
        prenom: member?.prenom || '?',
        maskedPhone: member?.telephone ? maskPhoneNumber(member.telephone) : null,
        hasVoted,
        otpExpired: !hasVoted && new Date(otp.expires_at) < now,
        resendCount: otp.resend_count || 0,
      }
    })

    return { votedCount, totalVotants: vote.total_votants || 0, members: memberStatuses }
  } catch (err) {
    console.error('getTelevoteProgress error:', err)
    return { error: 'Erreur inattendue' }
  }
}

export async function closeVoteTelevote(voteId: string): Promise<CloseVoteResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    const role = (user.user_metadata?.role as string) || ''
    if (!['super_admin', 'gestionnaire'].includes(role)) {
      return { error: 'Seul le gestionnaire peut clore un télévote' }
    }

    if (role === 'super_admin') {
      console.warn(`[AUDIT] Super admin ${user.id} performing vote action: closeVoteTelevote on vote ${voteId}`)
    }

    const { data: vote } = await supabase
      .from('votes')
      .select('id, seance_id, odj_point_id, statut, type_vote, total_votants, voix_preponderante_activee, question')
      .eq('id', voteId)
      .single()

    if (!vote) return { error: 'Vote introuvable' }
    if (vote.statut !== 'OUVERT') return { error: 'Ce vote n\'est pas ouvert' }
    if (vote.type_vote !== 'TELEVOTE') return { error: 'Ce n\'est pas un télévote' }

    const { data: otps } = await televoteOtps(supabase)
      .select('member_id, used, choix')
      .eq('vote_id', voteId)

    if (!otps || otps.length === 0) {
      return { error: 'Aucun OTP enregistré — impossible de clore le vote' }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const votedOtps = otps.filter((o: any) => o.used && o.choix)
    if (votedOtps.length === 0) {
      return { error: 'Aucun vote enregistré — impossible de clore le vote' }
    }

    let pour = 0
    let contre = 0
    let abstention = 0
    const nomsContre: string[] = []
    const nomsAbstention: string[] = []

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const memberIds = votedOtps.map((o: any) => o.member_id)
    const { data: membersData } = await supabase
      .from('members')
      .select('id, prenom, nom')
      .in('id', memberIds)
    const memberMap = new Map(membersData?.map(m => [m.id, m]) || [])

    for (const otp of votedOtps) {
      const member = memberMap.get(otp.member_id)
      const name = member ? `${member.prenom} ${member.nom}` : '?'
      switch (otp.choix) {
        case 'POUR': pour++; break
        case 'CONTRE': contre++; nomsContre.push(name); break
        case 'ABSTENTION': abstention++; nomsAbstention.push(name); break
      }
    }

    const totalVotants = vote.total_votants || 0

    const { data: point } = await supabase
      .from('odj_points')
      .select('majorite_requise, titre')
      .eq('id', vote.odj_point_id)
      .single()

    const majoriteRequise = (point?.majorite_requise || 'SIMPLE') as MajoriteRequise

    const resultat = determineVoteResult(
      pour, contre, abstention, totalVotants, majoriteRequise,
      vote.voix_preponderante_activee ?? false
    )

    const formulePV = generateFormulePV({
      pour, contre, abstention, totalVotants, resultat,
      nomsContre, nomsAbstention,
      titrePoint: point?.titre || vote.question || '',
    })

    // H2: Never compute HMAC with empty string — set null if secret missing
    const hmacSecret = process.env.VOTE_HMAC_SECRET
    if (!hmacSecret) {
      console.error('[SECURITY] VOTE_HMAC_SECRET non configuré — hash intégrité non calculé')
    }
    const closedAt = new Date().toISOString()
    const hashData = `${voteId}|${pour}|${contre}|${abstention}|${resultat}|${closedAt}`
    const hashIntegrite = hmacSecret
      ? crypto.createHmac('sha256', hmacSecret).update(hashData).digest('hex')
      : null

    const { error: updateError } = await supabase
      .from('votes')
      .update({
        statut: 'CLOS' as const,
        pour, contre, abstention,
        resultat: resultat as 'ADOPTE' | 'REJETE' | 'NUL' | 'ADOPTE_UNANIMITE' | 'ADOPTE_VOIX_PREPONDERANTE',
        formule_pv: formulePV,
        noms_contre: nomsContre,
        noms_abstention: nomsAbstention,
        clos_at: closedAt,
        hash_integrite: hashIntegrite,
      })
      .eq('id', voteId)

    if (updateError) return { error: `Erreur clôture : ${updateError.message}` }

    await supabase
      .from('odj_points')
      .update({ statut: 'TRAITE' })
      .eq('id', vote.odj_point_id)

    revalidatePath(`/seances/${vote.seance_id}/en-cours`)
    revalidatePath(`/seances/${vote.seance_id}`)
    return { success: true, resultat, formulePV }
  } catch (err) {
    console.error('closeVoteTelevote error:', err)
    return { error: 'Erreur inattendue lors de la clôture du télévote' }
  }
}

export async function getPublicVoteInfo(voteId: string): Promise<
  | {
      question: string
      institutionName: string
      seanceTitre: string
      statut: string
      typeVote: string
      expires_at: string | null
    }
  | { error: string }
> {
  try {
    const supabase = await createServiceRoleClient()

    const { data: vote } = await supabase
      .from('votes')
      .select('id, question, statut, type_vote, seance_id')
      .eq('id', voteId)
      .single()

    if (!vote) return { error: 'Vote introuvable' }

    const { data: seance } = await supabase
      .from('seances')
      .select('titre')
      .eq('id', vote.seance_id)
      .single()

    // Get the latest OTP expiry for this vote to provide a server-based timer
    const { data: latestOtp } = await televoteOtps(supabase)
      .select('expires_at')
      .eq('vote_id', voteId)
      .eq('used', false)
      .order('expires_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    return {
      question: vote.question || 'Vote en cours',
      institutionName: process.env.NEXT_PUBLIC_INSTITUTION_NAME || 'Institution',
      seanceTitre: seance?.titre || 'Séance',
      statut: vote.statut || 'OUVERT',
      typeVote: vote.type_vote || 'TELEVOTE',
      expires_at: latestOtp?.expires_at || null,
    }
  } catch (err) {
    console.error('getPublicVoteInfo error:', err)
    return { error: 'Erreur inattendue' }
  }
}
