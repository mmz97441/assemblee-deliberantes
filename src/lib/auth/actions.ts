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

  const currentRole = (currentMember?.role || user.user_metadata?.role) as UserRole
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
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}${ROUTES.INVITE_CONFIRM}`,
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
