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
    return { error: 'Erreur de connexion. Veuillez reessayer.' }
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

  // Verifier qu'il n'y a pas encore d'utilisateur (premier setup)
  let serviceClient
  try {
    serviceClient = await createServiceRoleClient()
  } catch {
    return { error: 'Erreur de connexion au serveur. Verifiez la configuration Supabase.' }
  }

  const { data: existingUsers, error: listError } = await serviceClient.auth.admin.listUsers()

  if (listError) {
    return { error: `Erreur serveur: ${listError.message}` }
  }

  const isFirstUser = !existingUsers?.users || existingUsers.users.length === 0

  if (!isFirstUser) {
    return { error: 'L\'inscription directe est desactivee. Demandez une invitation.' }
  }

  // Creer le premier utilisateur (super_admin)
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
      return { error: 'Cet email est d\u00e9j\u00e0 utilis\u00e9' }
    }
    return { error: `Erreur cr\u00e9ation compte : ${createError.message}` }
  }

  // Creer l'entree dans la table members
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
      return { error: `Erreur cr\u00e9ation membre : ${insertError.message}` }
    }
  }

  // Ne pas auto-connecter ici — les cookies serveur ne se propagent pas
  // correctement vers le client via router.push. Rediriger vers login.
  return { success: true, message: 'Compte cr\u00e9\u00e9 avec succ\u00e8s. Connectez-vous.' }
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
  if (!role) return { error: 'Le role est requis' }

  const emailError = validateEmail(email)
  if (emailError) return { error: emailError }

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Non authentifi\u00e9' }

  const currentRole = user.user_metadata?.role as UserRole
  if (currentRole !== 'super_admin' && currentRole !== 'gestionnaire') {
    return { error: 'Permission refusee' }
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
      return { error: 'Cet email est d\u00e9j\u00e0 utilis\u00e9' }
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
  return { success: `Invitation envoyee a ${email}` }
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
