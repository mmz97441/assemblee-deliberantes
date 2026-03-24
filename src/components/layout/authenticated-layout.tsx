import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ROUTES } from '@/lib/constants'
import { getEffectiveRole } from '@/lib/auth/get-effective-role'
import { AppLayout } from './app-layout'
import type { UserRole } from '@/lib/supabase/types'

interface AuthenticatedLayoutProps {
  children: React.ReactNode
}

export async function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  let user = null

  try {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase.auth.getUser()
    if (!error && data?.user) {
      user = data.user
    }
  } catch {
    // Supabase indisponible
  }

  if (!user) {
    redirect(ROUTES.LOGIN)
  }

  const realRole = (user.user_metadata?.role as UserRole) || 'elu'
  const effectiveRole = await getEffectiveRole(realRole) as UserRole
  const fullName = user.user_metadata?.full_name || user.email || ''
  const email = user.email || ''

  return (
    <AppLayout
      userFullName={fullName}
      userRole={effectiveRole}
      userRealRole={realRole}
      userEmail={email}
    >
      {children}
    </AppLayout>
  )
}
