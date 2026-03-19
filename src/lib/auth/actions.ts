'use server'

import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import type { UserRole } from '@/lib/supabase/types'

// ============================================
// LOGIN
// ============================================
export async function loginAction(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Email et mot de passe requis' }
  }

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
  redirect('/dashboard')
}

// ============================================
// REGISTER (premier super-admin uniquement)
// ============================================
export async function registerAction(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string
  const fullName = formData.get('fullName') as string

  if (!email || !password || !fullName) {
    return { error: 'Tous les champs sont requis' }
  }

  if (password !== confirmPassword) {
    return { error: 'Les mots de passe ne correspondent pas' }
  }

  if (password.length < 12) {
    return { error: 'Le mot de passe doit contenir au moins 12 caracteres' }
  }

  // Verifier qu'il n'y a pas encore d'utilisateur (premier setup)
  const serviceClient = await createServiceRoleClient()
  const { data: existingUsers } = await serviceClient.auth.admin.listUsers()

  const isFirstUser = !existingUsers?.users || existingUsers.users.length === 0

  if (!isFirstUser) {
    return { error: 'L\'inscription directe est desactivee. Demandez une invitation.' }
  }

  // Creer le premier utilisateur (super_admin)
  const { data, error } = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role: 'super_admin' as UserRole,
    },
  })

  if (error) {
    if (error.message.includes('already been registered')) {
      return { error: 'Cet email est deja utilise' }
    }
    return { error: 'Erreur lors de la creation du compte' }
  }

  // Creer l'entree dans la table members
  if (data.user) {
    await serviceClient.from('members').insert({
      user_id: data.user.id,
      role: 'super_admin',
      nom: fullName.split(' ').slice(1).join(' ') || fullName,
      prenom: fullName.split(' ')[0] || '',
      email,
      statut: 'ACTIF',
    })
  }

  // Connecter directement
  const supabase = await createServerSupabaseClient()
  await supabase.auth.signInWithPassword({ email, password })

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

// ============================================
// LOGOUT
// ============================================
export async function logoutAction() {
  const supabase = await createServerSupabaseClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}

// ============================================
// INVITATION (envoyer une invitation)
// ============================================
export async function sendInvitationAction(formData: FormData) {
  const email = formData.get('email') as string
  const role = formData.get('role') as UserRole
  const fullName = formData.get('fullName') as string

  if (!email || !role || !fullName) {
    return { error: 'Tous les champs sont requis' }
  }

  // Verifier les permissions de l'utilisateur courant
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Non authentifie' }
  }

  const currentRole = user.user_metadata?.role as UserRole
  if (currentRole !== 'super_admin' && currentRole !== 'gestionnaire') {
    return { error: 'Permission refusee' }
  }

  // Creer l'invitation via Supabase Auth
  const serviceClient = await createServiceRoleClient()

  const { data, error } = await serviceClient.auth.admin.inviteUserByEmail(email, {
    data: {
      full_name: fullName,
      role,
      invited_by: user.id,
    },
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/invite/confirm`,
  })

  if (error) {
    if (error.message.includes('already been registered')) {
      return { error: 'Cet email est deja utilise' }
    }
    return { error: `Erreur d'envoi: ${error.message}` }
  }

  // Pre-creer l'entree member
  if (data.user) {
    await serviceClient.from('members').insert({
      user_id: data.user.id,
      role,
      nom: fullName.split(' ').slice(1).join(' ') || fullName,
      prenom: fullName.split(' ')[0] || '',
      email,
      statut: 'ACTIF',
    })
  }

  revalidatePath('/membres')
  return { success: `Invitation envoyee a ${email}` }
}

// ============================================
// ACCEPT INVITATION (finaliser le compte)
// ============================================
export async function acceptInvitationAction(formData: FormData) {
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string

  if (!password || password.length < 12) {
    return { error: 'Le mot de passe doit contenir au moins 12 caracteres' }
  }

  if (password !== confirmPassword) {
    return { error: 'Les mots de passe ne correspondent pas' }
  }

  const supabase = await createServerSupabaseClient()

  const { error } = await supabase.auth.updateUser({
    password,
  })

  if (error) {
    return { error: 'Erreur lors de la configuration du mot de passe' }
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}
