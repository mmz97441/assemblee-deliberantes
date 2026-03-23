'use server'

import crypto from 'crypto'
import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { determineVoteResult, generateFormulePV, type MajoriteRequise } from '@/lib/validators/vote-result'
import { checkRateLimit } from '@/lib/security/rate-limiter'
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
      .select('id, statut, instance_id')
      .eq('id', seanceId)
      .single()

    if (!seance) return { error: 'Séance introuvable' }
    if (seance.statut !== 'EN_COURS') {
      return { error: 'La séance doit être en cours pour ouvrir un vote' }
    }

    // Get instance config for voix_preponderante
    const { data: instanceConfig } = await supabase
      .from('instance_config')
      .select('voix_preponderante')
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

    // Calculate quorum snapshot: PRESENT + PROCURATION (without departed members)
    const { data: presences } = await supabase
      .from('presences')
      .select('id, member_id, statut, heure_depart')
      .eq('seance_id', seanceId)

    const activePresences = (presences || []).filter(
      p => (p.statut === 'PRESENT' || p.statut === 'PROCURATION') && !p.heure_depart
    )
    const totalVotants = activePresences.length

    if (totalVotants === 0) {
      return { error: 'Aucun membre présent — impossible d\'ouvrir un vote' }
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
    })

    // Compute HMAC integrity hash (tamper-proof vote results)
    const hmacSecret = process.env.VOTE_HMAC_SECRET || 'dev-secret-change-in-production'
    const closedAt = new Date().toISOString()
    const hashData = `${voteId}|${pour}|${contre}|${abstentions}|${resultat}|${closedAt}`
    const hashIntegrite = crypto.createHmac('sha256', hmacSecret).update(hashData).digest('hex')

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

    const { data: vote } = await supabase
      .from('votes')
      .select('id, statut, seance_id')
      .eq('id', voteId)
      .single()

    if (!vote) return { error: 'Vote introuvable' }
    if (vote.statut !== 'OUVERT') return { error: 'Seul un vote ouvert peut être annulé' }

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
      .select('id, statut, instance_id')
      .eq('id', seanceId)
      .single()

    if (!seance) return { error: 'Séance introuvable' }
    if (seance.statut !== 'EN_COURS') {
      return { error: 'La séance doit être en cours pour ouvrir un vote' }
    }

    // Get instance config for voix_preponderante
    const { data: instanceConfig } = await supabase
      .from('instance_config')
      .select('voix_preponderante')
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

    // Calculate quorum snapshot
    const { data: presences } = await supabase
      .from('presences')
      .select('id, member_id, statut, heure_depart')
      .eq('seance_id', seanceId)

    const activePresences = (presences || []).filter(
      p => (p.statut === 'PRESENT' || p.statut === 'PROCURATION') && !p.heure_depart
    )
    const totalVotants = activePresences.length

    if (totalVotants === 0) {
      return { error: 'Aucun membre présent — impossible d\'ouvrir un vote' }
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

    const hmacSecret = process.env.VOTE_HMAC_SECRET || 'dev-secret-change-in-production'

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
      .select('id, seance_id, statut, type_vote, encrypted_session_key')
      .eq('id', voteId)
      .single()

    if (!vote) return { error: 'Vote introuvable' }
    if (vote.statut !== 'OUVERT') return { error: 'Ce vote n\'est plus ouvert' }
    if (vote.type_vote !== 'SECRET') return { error: 'Ce vote n\'est pas un scrutin secret' }
    if (!vote.encrypted_session_key) return { error: 'Erreur de configuration : clé de session manquante' }

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
    const hashIntegrite = computeBulletinHash(
      voteId,
      bulletinToken,
      choixChiffre,
      encrypted.iv,
      hmacSecret
    )

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
        vote_id: voteId,
        bulletin_token: bulletinToken,
        choix_chiffre: choixChiffre,
        hash_integrite: hashIntegrite,
        nonce: encrypted.iv,
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

    // Verify encryption key is configured
    const masterKeyHex = process.env.VOTE_ENCRYPTION_KEY
    if (!masterKeyHex) {
      return { error: 'La clé de chiffrement des votes n\'est pas configurée (VOTE_ENCRYPTION_KEY)' }
    }

    const hmacSecret = process.env.VOTE_HMAC_SECRET || 'dev-secret-change-in-production'

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
      const expectedHash = computeBulletinHash(
        voteId,
        bulletin.bulletin_token,
        bulletin.choix_chiffre,
        bulletin.nonce,
        hmacSecret
      )
      if (expectedHash !== bulletin.hash_integrite) {
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
    })

    // Compute HMAC integrity hash for the vote result
    const closedAt = new Date().toISOString()
    const hashData = `${voteId}|${pour}|${contre}|${abstention}|${resultat}|${closedAt}`
    const hashIntegrite = crypto.createHmac('sha256', hmacSecret).update(hashData).digest('hex')

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
