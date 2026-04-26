export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ROUTES } from '@/lib/constants'
import { getEffectiveRole } from '@/lib/auth/get-effective-role'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'
import { PageHeader } from '@/components/layout/page-header'
import { SeanceCreationWizard } from '@/components/seance/seance-creation-wizard'

export default async function NewSeancePage() {
  const supabase = await createServerSupabaseClient()
  const { data: userData, error: authError } = await supabase.auth.getUser()

  if (authError || !userData?.user) {
    redirect(ROUTES.LOGIN)
  }

  const realUserRole = (userData.user.user_metadata?.role as string) || 'elu'
  const userRole = await getEffectiveRole(realUserRole)

  if (!['super_admin', 'gestionnaire', 'president', 'secretaire_seance'].includes(userRole)) {
    redirect(ROUTES.SEANCES)
  }

  // Fetch active instances with member counts
  const { data: instancesData } = await supabase
    .from('instance_config')
    .select('*')
    .eq('actif', true)
    .order('nom', { ascending: true })

  const instances = instancesData || []

  // Fetch all active members
  const { data: membersData } = await supabase
    .from('members')
    .select('id, prenom, nom, email, role, qualite_officielle, statut')
    .eq('statut', 'ACTIF')
    .order('nom', { ascending: true })

  const members = membersData || []

  // Fetch instance members (who belongs to which instance)
  const { data: instanceMembersData } = await supabase
    .from('instance_members')
    .select('instance_config_id, member_id, bureau_role, actif')
    .eq('actif', true)

  const instanceMembers = instanceMembersData || []

  // Fetch the last séance per instance (for "copier depuis la dernière séance")
  const { data: lastSeances } = await supabase
    .from('seances')
    .select('id, instance_id, date_seance, titre')
    .order('date_seance', { ascending: false })

  // Group: keep only the most recent per instance
  const lastSeanceByInstance: Record<string, { id: string; date_seance: string; titre: string }> = {}
  for (const s of lastSeances || []) {
    if (!lastSeanceByInstance[s.instance_id]) {
      lastSeanceByInstance[s.instance_id] = {
        id: s.id,
        date_seance: s.date_seance,
        titre: s.titre,
      }
    }
  }

  return (
    <AuthenticatedLayout>
      <PageHeader
        title="Nouvelle séance"
        description="Assistant de création en 5 étapes"
        breadcrumbs={[
          { label: 'Tableau de bord', href: ROUTES.DASHBOARD },
          { label: 'Séances', href: ROUTES.SEANCES },
          { label: 'Nouvelle séance' },
        ]}
      />

      <main className="px-4 sm:px-8 py-6 page-enter">
        <SeanceCreationWizard
          instances={instances}
          members={members}
          instanceMembers={instanceMembers}
          lastSeanceByInstance={lastSeanceByInstance}
        />
      </main>
    </AuthenticatedLayout>
  )
}
