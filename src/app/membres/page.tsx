export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ROUTES } from '@/lib/constants'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'
import { PageHeader } from '@/components/layout/page-header'
import { MembersList } from '@/components/membres/members-list'
import type { MemberWithInstances } from '@/lib/actions/members'
import type { InstanceConfigRow } from '@/lib/supabase/types'

export default async function MembresPage() {
  const supabase = await createServerSupabaseClient()
  const { data: userData, error: authError } = await supabase.auth.getUser()

  if (authError || !userData?.user) {
    redirect(ROUTES.LOGIN)
  }

  let members: MemberWithInstances[] = []
  let instances: InstanceConfigRow[] = []

  try {
    const { data: membersData } = await supabase
      .from('members')
      .select(`
        *,
        instance_members (
          id,
          instance_config_id,
          fonction_dans_instance,
          actif,
          instance_config (
            id,
            nom
          )
        )
      `)
      .order('nom', { ascending: true })
      .order('prenom', { ascending: true })

    members = (membersData as MemberWithInstances[]) || []

    const { data: instancesData } = await supabase
      .from('instance_config')
      .select('*')
      .eq('actif', true)
      .order('nom', { ascending: true })

    instances = instancesData || []
  } catch (err) {
    console.error('Erreur chargement membres:', err)
  }

  const userRole = (userData.user.user_metadata?.role as string) || 'elu'
  const canManage = ['super_admin', 'gestionnaire'].includes(userRole)

  return (
    <AuthenticatedLayout>
      <PageHeader
        title="Membres"
        description="Gestion des elus et agents de l'institution"
        breadcrumbs={[
          { label: 'Tableau de bord', href: ROUTES.DASHBOARD },
          { label: 'Membres' },
        ]}
      />

      <main className="px-8 py-6 page-enter">
        <MembersList
          members={members}
          instances={instances}
          canManage={canManage}
        />
      </main>
    </AuthenticatedLayout>
  )
}
