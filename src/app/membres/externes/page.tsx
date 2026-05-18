export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ROUTES } from '@/lib/constants'
import { getEffectiveRole } from '@/lib/auth/get-effective-role'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'
import { PageHeader } from '@/components/layout/page-header'
import { ExternalInviteesList } from '@/components/membres/external-invitees-list'
import type { ExternalInviteeRow } from '@/lib/supabase/types'

export default async function ExternalInviteesPage() {
  const supabase = await createServerSupabaseClient()
  const { data: userData, error: authError } = await supabase.auth.getUser()

  if (authError || !userData?.user) {
    redirect(ROUTES.LOGIN)
  }

  const role = await getEffectiveRole(supabase, userData.user.id)
  const canManage = ['super_admin', 'dgs', 'directeur_cabinet', 'gestionnaire'].includes(role)
  // Lecture autorisée à : privilégiés + bureau + élus (cf. RLS migration 00036)
  const canRead = canManage || ['president', 'secretaire_seance', 'elu', 'preparateur'].includes(role)

  if (!canRead) {
    redirect(ROUTES.DASHBOARD)
  }

  const { data: invitees } = await supabase
    .from('external_invitees')
    .select('*')
    .order('nom', { ascending: true })
    .order('prenom', { ascending: true })

  return (
    <AuthenticatedLayout>
      <PageHeader
        title="Invités externes"
        description="Personnes extérieures à la collectivité (préfet, trésorier-payeur, journaliste…) pouvant être convoquées en séance"
        breadcrumbs={[
          { label: 'Tableau de bord', href: ROUTES.DASHBOARD },
          { label: 'Membres', href: ROUTES.MEMBRES },
          { label: 'Invités externes' },
        ]}
      />

      <main className="px-4 sm:px-8 py-6 page-enter">
        <ExternalInviteesList
          invitees={(invitees as ExternalInviteeRow[]) || []}
          canManage={canManage}
        />
      </main>
    </AuthenticatedLayout>
  )
}
