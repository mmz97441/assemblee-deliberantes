'use server'

/**
 * Server actions WebAuthn (FIDO2) — audit sécurité #13.
 *
 * Implémente le flux WebAuthn complet (challenge serveur, vérification
 * cryptographique d'attestation et d'assertion, anti-replay via compteur).
 * Remplace l'ancien bouton « Enregistrer mon empreinte » qui ne faisait
 * qu'afficher un toast et marquait l'état authenticated sans rien vérifier.
 *
 * Stockage :
 *  - webauthn_credentials : credential_id, public_key, counter, transports.
 *  - webauthn_challenges  : nonce one-shot avec TTL 5 min (anti-replay).
 *
 * Le RP_ID (Relying Party Identifier) doit correspondre au domaine de
 * l'application (sans schéma ni port). En production, c'est le nom de
 * domaine complet (ex : "deliberantes.exemple.fr"). En local, "localhost".
 */

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server'
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { requireVerifiedRole } from '@/lib/auth/require-role'
import { checkRateLimit } from '@/lib/security/rate-limiter'

// ─── Configuration RP (Relying Party) ────────────────────────────────────────

function getRpConfig() {
  const rpId = process.env.WEBAUTHN_RP_ID || 'localhost'
  const rpName = process.env.WEBAUTHN_RP_NAME || 'Assemblées Délibérantes'
  const origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return { rpId, rpName, origin }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function getAuthenticatedUser() {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) return { user: null, supabase }
  return { user: data.user, supabase }
}

/**
 * Stocke un challenge WebAuthn (registration ou authentication) avec TTL.
 * Utilise service_role car la table webauthn_challenges n'est pas visible
 * via RLS (volontaire — anti-replay).
 */
async function storeChallenge(
  memberId: string | null,
  kind: 'registration' | 'authentication',
  challenge: string
): Promise<void> {
  const sb = await createServiceRoleClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await ((sb as any).from('webauthn_challenges')).insert({
    member_id: memberId,
    kind,
    challenge,
  })
}

/**
 * Récupère et marque comme consommé un challenge non expiré.
 * Renvoie le challenge si trouvé, null sinon. Empêche le rejeu.
 */
async function consumeChallenge(
  memberId: string | null,
  kind: 'registration' | 'authentication',
  expectedChallenge: string
): Promise<boolean> {
  const sb = await createServiceRoleClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query = ((sb as any).from('webauthn_challenges'))
    .select('id, expires_at, consumed_at')
    .eq('challenge', expectedChallenge)
    .eq('kind', kind)
    .gte('expires_at', new Date().toISOString())
    .is('consumed_at', null)

  const { data: rows } = memberId
    ? await query.eq('member_id', memberId).limit(1)
    : await query.is('member_id', null).limit(1)

  const row = rows?.[0] as { id: string } | undefined
  if (!row) return false

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await ((sb as any).from('webauthn_challenges'))
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', row.id)

  return true
}

// ─── Registration ────────────────────────────────────────────────────────────

export type RegistrationOptionsResult =
  | { success: true; options: PublicKeyCredentialCreationOptionsJSON }
  | { error: string }

/**
 * Étape 1 : générer les options de création d'une credential.
 * Le challenge est stocké côté serveur pour être vérifié à l'étape 2.
 */
export async function getRegistrationOptions(memberId: string): Promise<RegistrationOptionsResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    // Rate-limit : 5 enrôlements / heure / utilisateur (anti-spam de challenges)
    const rate = await checkRateLimit(supabase, user.id, {
      actionKey: 'webauthn_register',
      maxAttempts: 5,
      windowMinutes: 60,
    })
    if (!rate.allowed) return { error: rate.error! }

    // Vérifier que le caller a le droit d'enrôler une credential pour ce membre :
    // soit c'est lui-même, soit c'est un gestionnaire (enrôlement assisté).
    const { data: targetMember } = await supabase
      .from('members')
      .select('id, user_id, prenom, nom')
      .eq('id', memberId)
      .maybeSingle()

    if (!targetMember) return { error: 'Membre introuvable' }

    const isSelf = targetMember.user_id === user.id
    if (!isSelf) {
      const roleError = await requireVerifiedRole(supabase, user, ['super_admin', 'dgs', 'directeur_cabinet', 'gestionnaire'])
      if (roleError) return { error: 'Vous ne pouvez enrôler une credential que pour vous-même' }
    }

    // Récupérer les credentials déjà enrôlées pour exclure les doublons côté client.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await ((supabase as any).from('webauthn_credentials'))
      .select('credential_id, transports')
      .eq('member_id', memberId)

    const { rpId, rpName } = getRpConfig()

    const options = await generateRegistrationOptions({
      rpName,
      rpID: rpId,
      userID: new TextEncoder().encode(memberId),
      userName: `${targetMember.prenom} ${targetMember.nom}`.trim() || 'membre',
      attestationType: 'none',
      excludeCredentials: ((existing as { credential_id: string; transports: string[] | null }[]) || []).map(c => ({
        id: c.credential_id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        transports: (c.transports || undefined) as any,
      })),
      authenticatorSelection: {
        // Privilégier les authenticators plateforme (TouchID, FaceID, Windows Hello)
        // mais accepter aussi les clés sécurité externes (YubiKey).
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    })

    await storeChallenge(memberId, 'registration', options.challenge)

    return { success: true, options }
  } catch (err) {
    console.error('getRegistrationOptions error:', err)
    return { error: 'Erreur lors de la génération des options WebAuthn' }
  }
}

export type RegistrationVerifyResult =
  | { success: true; credentialId: string }
  | { error: string }

/**
 * Étape 2 : vérifier la réponse d'attestation et enregistrer la credential.
 */
export async function verifyRegistration(
  memberId: string,
  response: RegistrationResponseJSON,
  nickname?: string
): Promise<RegistrationVerifyResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    const { data: targetMember } = await supabase
      .from('members')
      .select('id, user_id')
      .eq('id', memberId)
      .maybeSingle()

    if (!targetMember) return { error: 'Membre introuvable' }

    const isSelf = targetMember.user_id === user.id
    if (!isSelf) {
      const roleError = await requireVerifiedRole(supabase, user, ['super_admin', 'dgs', 'directeur_cabinet', 'gestionnaire'])
      if (roleError) return { error: 'Vous ne pouvez enrôler une credential que pour vous-même' }
    }

    const { rpId, origin } = getRpConfig()

    // Récupérer le challenge stocké pour ce member (vérification anti-replay)
    const sbService = await createServiceRoleClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: pendingChallenges } = await ((sbService as any).from('webauthn_challenges'))
      .select('challenge, expires_at, consumed_at')
      .eq('member_id', memberId)
      .eq('kind', 'registration')
      .is('consumed_at', null)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)

    const expectedChallenge = (pendingChallenges as { challenge: string }[] | null)?.[0]?.challenge
    if (!expectedChallenge) return { error: 'Challenge expiré ou inexistant — recommencez l\'enrôlement' }

    let verification
    try {
      verification = await verifyRegistrationResponse({
        response,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpId,
        requireUserVerification: false,
      })
    } catch (e) {
      console.warn('verifyRegistrationResponse failed:', e)
      return { error: 'Vérification cryptographique échouée — credential rejetée' }
    }

    if (!verification.verified || !verification.registrationInfo) {
      return { error: 'Attestation invalide' }
    }

    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo

    // Marquer le challenge comme consommé (anti-replay)
    await consumeChallenge(memberId, 'registration', expectedChallenge)

    // Insérer la credential
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError } = await ((sbService as any).from('webauthn_credentials')).insert({
      member_id: memberId,
      credential_id: credential.id,
      public_key: Buffer.from(credential.publicKey).toString('base64'),
      counter: credential.counter,
      transports: credential.transports || null,
      credential_device_type: credentialDeviceType,
      credential_backed_up: credentialBackedUp,
      nickname: nickname?.trim() || null,
    })

    if (insertError) {
      // Conflit unique → credential déjà enrôlée
      if (insertError.code === '23505') {
        return { error: 'Cette credential est déjà enregistrée' }
      }
      return { error: `Erreur d'enregistrement : ${insertError.message}` }
    }

    return { success: true, credentialId: credential.id }
  } catch (err) {
    console.error('verifyRegistration error:', err)
    return { error: 'Erreur lors de la vérification de la credential' }
  }
}

// ─── Authentication ──────────────────────────────────────────────────────────

export type AuthOptionsResult =
  | { success: true; options: PublicKeyCredentialRequestOptionsJSON }
  | { error: string }

/**
 * Étape 1 : générer les options d'authentification pour un membre.
 * Si memberId est fourni, on restreint aux credentials de ce membre
 * (mode tablette nominative). Sinon, mode discoverable credential.
 */
export async function getAuthenticationOptions(
  memberId: string | null
): Promise<AuthOptionsResult> {
  try {
    const supabase = await createServiceRoleClient()
    const { rpId } = getRpConfig()

    let allowCredentials: { id: string; transports?: string[] }[] = []
    if (memberId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await ((supabase as any).from('webauthn_credentials'))
        .select('credential_id, transports')
        .eq('member_id', memberId)

      allowCredentials = ((data as { credential_id: string; transports: string[] | null }[]) || []).map(c => ({
        id: c.credential_id,
        transports: c.transports || undefined,
      }))

      if (allowCredentials.length === 0) {
        return { error: 'Aucune credential enrôlée pour ce membre' }
      }
    }

    const options = await generateAuthenticationOptions({
      rpID: rpId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      allowCredentials: allowCredentials as any,
      userVerification: 'preferred',
    })

    await storeChallenge(memberId, 'authentication', options.challenge)

    return { success: true, options }
  } catch (err) {
    console.error('getAuthenticationOptions error:', err)
    return { error: 'Erreur lors de la génération des options WebAuthn' }
  }
}

export type AuthVerifyResult =
  | { success: true; memberId: string; memberName: string }
  | { error: string }

/**
 * Étape 2 : vérifier l'assertion et identifier le membre.
 * Met à jour le compteur (anti-clonage) et last_used_at.
 */
export async function verifyAuthentication(
  response: AuthenticationResponseJSON,
  memberIdHint?: string | null
): Promise<AuthVerifyResult> {
  try {
    const { rpId, origin } = getRpConfig()
    const supabase = await createServiceRoleClient()

    // Retrouver la credential par son id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: cred } = await ((supabase as any).from('webauthn_credentials'))
      .select('id, member_id, credential_id, public_key, counter, transports, member:members(prenom, nom)')
      .eq('credential_id', response.id)
      .maybeSingle()

    if (!cred) return { error: 'Credential inconnue' }

    if (memberIdHint && cred.member_id !== memberIdHint) {
      return { error: 'Cette credential ne correspond pas au membre attendu' }
    }

    // Récupérer le challenge en attente pour ce membre
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: pendingChallenges } = await ((supabase as any).from('webauthn_challenges'))
      .select('challenge')
      .eq('kind', 'authentication')
      .or(`member_id.eq.${cred.member_id},member_id.is.null`)
      .is('consumed_at', null)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)

    const expectedChallenge = (pendingChallenges as { challenge: string }[] | null)?.[0]?.challenge
    if (!expectedChallenge) return { error: 'Challenge expiré — recommencez l\'authentification' }

    let verification
    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpId,
        credential: {
          id: cred.credential_id,
          publicKey: new Uint8Array(Buffer.from(cred.public_key, 'base64')),
          counter: cred.counter,
          transports: cred.transports || undefined,
        },
        requireUserVerification: false,
      })
    } catch (e) {
      console.warn('verifyAuthenticationResponse failed:', e)
      return { error: 'Vérification cryptographique échouée' }
    }

    if (!verification.verified) return { error: 'Assertion invalide' }

    // Anti-clonage : compteur DOIT augmenter (sauf si l'authenticator ne le supporte pas)
    const newCounter = verification.authenticationInfo.newCounter
    if (newCounter !== 0 && newCounter <= cred.counter) {
      console.error(`[WEBAUTHN] Compteur suspect pour credential ${cred.id} : ${cred.counter} -> ${newCounter}`)
      return { error: 'Authenticator suspect — credential potentiellement clonée. Contactez le gestionnaire.' }
    }

    // Mise à jour counter + last_used_at
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ((supabase as any).from('webauthn_credentials'))
      .update({ counter: newCounter, last_used_at: new Date().toISOString() })
      .eq('id', cred.id)

    // Marquer le challenge consommé
    await consumeChallenge(cred.member_id, 'authentication', expectedChallenge)

    const member = cred.member as { prenom: string; nom: string } | null
    return {
      success: true,
      memberId: cred.member_id,
      memberName: member ? `${member.prenom} ${member.nom}`.trim() : 'Membre',
    }
  } catch (err) {
    console.error('verifyAuthentication error:', err)
    return { error: 'Erreur lors de la vérification de l\'assertion' }
  }
}

// ─── Listing & Management ───────────────────────────────────────────────────

export interface WebAuthnCredentialInfo {
  id: string
  credential_id: string
  nickname: string | null
  credential_device_type: string | null
  last_used_at: string | null
  created_at: string
}

export async function listMemberCredentials(
  memberId: string
): Promise<{ data: WebAuthnCredentialInfo[] } | { error: string }> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await ((supabase as any).from('webauthn_credentials'))
      .select('id, credential_id, nickname, credential_device_type, last_used_at, created_at')
      .eq('member_id', memberId)
      .order('created_at', { ascending: false })

    if (error) return { error: `Erreur de chargement : ${error.message}` }
    return { data: (data as WebAuthnCredentialInfo[]) || [] }
  } catch (err) {
    console.error('listMemberCredentials error:', err)
    return { error: 'Erreur inattendue' }
  }
}

export async function deleteCredential(
  credentialDbId: string
): Promise<{ success: true } | { error: string }> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await ((supabase as any).from('webauthn_credentials'))
      .delete()
      .eq('id', credentialDbId)

    if (error) return { error: `Erreur de suppression : ${error.message}` }
    return { success: true }
  } catch (err) {
    console.error('deleteCredential error:', err)
    return { error: 'Erreur inattendue' }
  }
}
