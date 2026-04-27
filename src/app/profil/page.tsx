export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ROUTES } from '@/lib/constants'
import { getEffectiveRole } from '@/lib/auth/get-effective-role'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'
import { PageHeader } from '@/components/layout/page-header'
import { UserProfile } from '@/components/profil/user-profile'
import type { UserRole } from '@/lib/supabase/types'

export default async function ProfilPage() {
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
    <AuthenticatedLayout>
      <PageHeader
        title="Mon profil"
        description="Consultez vos informations et modifiez votre mot de passe"
        breadcrumbs={[
          { label: 'Tableau de bord', href: ROUTES.DASHBOARD },
          { label: 'Mon profil' },
        ]}
      />
      <div className="px-4 sm:px-8 py-6">
        <UserProfile
          fullName={fullName}
          email={email}
          role={effectiveRole}
        />
      </div>
    </AuthenticatedLayout>
  )
}
