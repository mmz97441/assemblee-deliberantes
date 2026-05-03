'use server'

import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import {
  ROUTES,
  parseFullName,
  validateFullName,
  validatePassword,
  validateEmail,
} from '@/lib/constants'
import type { UserRole } from '@/lib/supabase/types'

// ============================================
// LOGIN
// ============================================
export async function loginAction(formData: FormData) {
  const email = (formData.get('email') as string)?.trim()
  const password = formData.get('password') as string

  const emailError = validateEmail(email)
  if (emailError) return { error: emailError }

  if (!password) return { error: 'Le mot de passe est requis' }

  const supabase = await createServerSupabaseClient()

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    if (error.message === 'Invalid login credentials') {
      return { error: 'Email ou mot de passe incorrect' }
    }
    if (error.message.includes('Email not confirmed')) {
      return { error: 'Veuillez confirmer votre email avant de vous connecter' }
    }
    return { error: 'Erreur de connexion. Veuillez réessayer.' }
  }

  revalidatePath('/', 'layout')
  return { success: true }
}

// ============================================
// REGISTER (premier super-admin uniquement)
// ============================================
export async function registerAction(formData: FormData) {
  const email = (formData.get('email') as string)?.trim()
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string
  const fullName = (formData.get('fullName') as string)?.trim()

  const nameError = validateFullName(fullName)
  if (nameError) return { error: nameError }

  const emailError = validateEmail(email)
  if (emailError) return { error: emailError }

  const passwordError = validatePassword(password, confirmPassword)
  if (passwordError) return { error: passwordError }

  // Vérifier qu'il n'y a pas encore d'utilisateur (premier setup)
  // SÉCURITÉ : l'inscription directe n'est autorisée QUE pour le tout premier utilisateur.
  // Tous les autres utilisateurs doivent être invités via le flux d'invitation.
  let serviceClient
  try {
    serviceClient = await createServiceRoleClient()
  } catch {
    return { error: 'Erreur de connexion au serveur. Vérifiez la configuration Supabase.' }
  }

  // Double vérification : auth users ET table members
  // Utiliser perPage: 1 pour la performance (on a juste besoin de savoir s'il en existe)
  const { data: existingUsers, error: listError } = await serviceClient.auth.admin.listUsers({
    perPage: 1,
  })

  if (listError) {
    return { error: `Erreur serveur : ${listError.message}` }
  }

  const hasAuthUsers = existingUsers?.users && existingUsers.users.length > 0

  // Vérifier aussi la table members comme garde supplémentaire
  const { count: memberCount } = await serviceClient
    .from('members')
    .select('*', { count: 'exact', head: true })

  const hasMembersInDB = memberCount !== null && memberCount > 0

  if (hasAuthUsers || hasMembersInDB) {
    return {
      error: 'L\'inscription directe est désactivée. Demandez une invitation à votre gestionnaire.',
    }
  }

  // Créer le premier utilisateur (super_admin)
  const { prenom, nom } = parseFullName(fullName)

  const { data, error: createError } = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role: 'super_admin' as UserRole,
    },
  })

  if (createError) {
    if (createError.message.includes('already been registered')) {
      return { error: 'Cet email est déjà utilisé' }
    }
    return { error: `Erreur création compte : ${createError.message}` }
  }

  // Créer l'entrée dans la table members
  if (data.user) {
    const { error: insertError } = await serviceClient.from('members').insert({
      user_id: data.user.id,
      role: 'super_admin',
      nom,
      prenom,
      email,
      statut: 'ACTIF',
    })

    if (insertError) {
      return { error: `Erreur création membre : ${insertError.message}` }
    }
  }

  // Ne pas auto-connecter ici — les cookies serveur ne se propagent pas
  // correctement vers le client via router.push. Rediriger vers login.
  return { success: true, message: 'Compte créé avec succès. Connectez-vous.' }
}

// ============================================
// LOGOUT
// ============================================
export async function logoutAction() {
  const supabase = await createServerSupabaseClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect(ROUTES.LOGIN)
}

// ============================================
// INVITATION (envoyer une invitation)
// ============================================
export async function sendInvitationAction(formData: FormData) {
  const email = (formData.get('email') as string)?.trim()
  const role = formData.get('role') as UserRole
  const fullName = (formData.get('fullName') as string)?.trim()

  const nameError = validateFullName(fullName)
  if (nameError) return { error: nameError }
  if (!role) return { error: 'Le rôle est requis' }

  const emailError = validateEmail(email)
  if (emailError) return { error: emailError }

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Non authentifié' }

  // SÉCURITÉ : vérifier le rôle depuis la table members (pas user_metadata modifiable)
  const { data: currentMember } = await supabase
    .from('members')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()

  // SÉCURITÉ : on s'appuie EXCLUSIVEMENT sur la table members
  // (user_metadata.role est modifiable côté client → escalation possible).
  const currentRole = currentMember?.role as UserRole | undefined
  if (currentRole !== 'super_admin' && currentRole !== 'gestionnaire') {
    return { error: 'Permission refusée' }
  }

  const serviceClient = await createServiceRoleClient()
  const { prenom, nom } = parseFullName(fullName)

  const { data, error } = await serviceClient.auth.admin.inviteUserByEmail(email, {
    data: {
      full_name: fullName,
      role,
      invited_by: user.id,
    },
    // Le redirectTo passe par /auth/confirm pour valider le token + établir
    // la session avant d'arriver sur /invite/confirm. Sans ce passage,
    // l'utilisateur arrive sans session valide et le middleware le redirige.
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/confirm?next=${encodeURIComponent(ROUTES.INVITE_CONFIRM)}`,
  })

  if (error) {
    if (error.message.includes('already been registered')) {
      return { error: 'Cet email est déjà utilisé' }
    }
    return { error: `Erreur d'envoi: ${error.message}` }
  }

  if (data.user) {
    await serviceClient.from('members').insert({
      user_id: data.user.id,
      role,
      nom,
      prenom,
      email,
      statut: 'ACTIF',
    })
  }

  revalidatePath(ROUTES.MEMBRES)
  return { success: `Invitation envoyée à ${email}` }
}

// ============================================
// INVITER UN MEMBRE EXISTANT (rattrapage / renvoi)
// ============================================
//
// Pour les membres déjà créés en DB mais sans compte de connexion (user_id
// NULL) ou dont le compte n'a pas été activé (email_confirmed_at NULL).
// Idempotent : on peut l'appeler plusieurs fois pour relancer.
//
// Met à jour members.user_id automatiquement après création du compte
// auth.users (sinon le membre serait orphelin).

export async function sendMemberInvitation(memberId: string): Promise<
  { success: true; message: string } | { error: string }
> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  // Vérifier le rôle (gestionnaire ou super_admin uniquement)
  const { data: caller } = await supabase
    .from('members')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!caller || (caller.role !== 'super_admin' && caller.role !== 'gestionnaire')) {
    return { error: 'Permission refusée' }
  }

  // Charger le membre cible
  const { data: member } = await supabase
    .from('members')
    .select('id, prenom, nom, email, role, user_id')
    .eq('id', memberId)
    .maybeSingle()

  if (!member) return { error: 'Membre introuvable' }
  if (!member.email) return { error: 'Aucun email renseigné pour ce membre' }

  const serviceClient = await createServiceRoleClient()

  // Cas 1 : pas encore de compte auth → on en crée un via inviteUserByEmail
  if (!member.user_id) {
    const fullName = `${member.prenom} ${member.nom}`.trim()
    const { data: invited, error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(
      member.email,
      {
        data: {
          full_name: fullName,
          role: member.role,
          invited_by: user.id,
        },
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/confirm?next=${encodeURIComponent(ROUTES.INVITE_CONFIRM)}`,
      }
    )

    if (inviteError) {
      // Cas particulier : l'email correspond déjà à un compte auth.users
      // (créé via une autre voie). On récupère ce compte et on le lie au membre.
      if (inviteError.message.includes('already been registered')) {
        const { data: existingUser } = await serviceClient.auth.admin.listUsers()
        const found = existingUser?.users.find(u => u.email?.toLowerCase() === member.email.toLowerCase())
        if (found) {
          await serviceClient.from('members').update({ user_id: found.id }).eq('id', memberId)
          // Renvoyer un mail d'invitation via resetPasswordForEmail (force la définition d'un mot de passe)
          const { error: resetError } = await serviceClient.auth.resetPasswordForEmail(member.email, {
            redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/confirm?next=${encodeURIComponent(ROUTES.INVITE_CONFIRM)}`,
          })
          if (resetError) return { error: `Compte trouvé mais email non envoyé : ${resetError.message}` }
          revalidatePath(ROUTES.MEMBRES)
          return { success: true, message: `Email d'activation renvoyé à ${member.email}` }
        }
      }
      return { error: `Erreur d'invitation : ${inviteError.message}` }
    }

    if (invited?.user) {
      // Lier le compte créé au membre
      await serviceClient.from('members').update({ user_id: invited.user.id }).eq('id', memberId)
    }

    revalidatePath(ROUTES.MEMBRES)
    return { success: true, message: `Invitation envoyée à ${member.email}` }
  }

  // Cas 2 : compte existe déjà mais peut-être pas activé → on relance via
  // un lien de définition de mot de passe (resetPasswordForEmail fait ça
  // proprement, l'utilisateur arrive sur /invite/confirm via /auth/confirm).
  const { error: resetError } = await serviceClient.auth.resetPasswordForEmail(member.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/confirm?next=${encodeURIComponent(ROUTES.INVITE_CONFIRM)}`,
  })
  if (resetError) return { error: `Erreur de renvoi : ${resetError.message}` }

  revalidatePath(ROUTES.MEMBRES)
  return { success: true, message: `Email d'activation renvoyé à ${member.email}` }
}

// ============================================
// MOT DE PASSE OUBLIÉ (demande de réinitialisation)
// ============================================
export async function requestPasswordReset(email: string) {
  const supabase = await createServerSupabaseClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  // Le redirectTo pointe vers /auth/confirm qui validera le token (verifyOtp)
  // et établira la session avant de rediriger vers /reset-password.
  // Sans ce passage, l'utilisateur arrive sur /reset-password SANS session
  // valide et le middleware le renvoie sur /login.
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}/auth/confirm?next=/reset-password`,
  })

  if (error) {
    // Ne pas révéler si l'email existe ou non (sécurité contre l'énumération)
    console.error('Password reset error:', error)
  }

  // Toujours retourner succès pour empêcher l'énumération d'emails
  return { success: true }
}

// ============================================
// MODIFIER LE MOT DE PASSE (utilisateur connecté ou via lien de réinitialisation)
// ============================================
export async function updatePassword(newPassword: string) {
  const supabase = await createServerSupabaseClient()

  const passwordError = validatePassword(newPassword)
  if (passwordError) {
    return { error: passwordError }
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword })

  if (error) {
    return { error: 'Erreur lors de la modification du mot de passe. Le lien a peut-être expiré.' }
  }

  return { success: true }
}

// ============================================
// ACCEPT INVITATION (finaliser le compte)
// ============================================
export async function acceptInvitationAction(formData: FormData) {
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string

  const passwordError = validatePassword(password, confirmPassword)
  if (passwordError) return { error: passwordError }

  const supabase = await createServerSupabaseClient()

  const { error } = await supabase.auth.updateUser({
    password,
  })

  if (error) {
    return { error: 'Erreur lors de la configuration du mot de passe' }
  }

  revalidatePath('/', 'layout')
  return { success: true }
}
