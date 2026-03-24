'use server'

import { cookies } from 'next/headers'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const ALLOWED_OVERRIDES = [
  'gestionnaire',
  'president',
  'secretaire_seance',
  'elu',
  'preparateur',
]

/**
 * Sets or clears the dev role override cookie.
 * Only works if the calling user is actually a super_admin.
 */
export async function setRoleOverride(role: string | null) {
  // Verify the caller is actually super_admin
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    throw new Error('Non authentifie')
  }

  const realRole = data.user.user_metadata?.role as string
  if (realRole !== 'super_admin') {
    throw new Error('Acces refuse : super_admin uniquement')
  }

  const cookieStore = await cookies()
  if (role && ALLOWED_OVERRIDES.includes(role)) {
    cookieStore.set('dev_role_override', role, {
      path: '/',
      maxAge: 60 * 60 * 24, // 24h
      httpOnly: false, // Client needs to read it for the switcher UI
      sameSite: 'lax',
    })
  } else {
    cookieStore.delete('dev_role_override')
  }
}
