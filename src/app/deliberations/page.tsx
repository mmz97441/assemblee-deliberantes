export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ROUTES } from '@/lib/constants'
import { getEffectiveRole } from '@/lib/auth/get-effective-role'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'
import { PageHeader } from '@/components/layout/page-header'
import { DeliberationsList } from '@/components/deliberations/deliberations-list'
import type { InstanceConfigRow } from '@/lib/supabase/types'

export default async function DeliberationsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: userData, error: authError } = await supabase.auth.getUser()

  if (authError || !userData?.user) {
    redirect(ROUTES.LOGIN)
  }

  // Fetch deliberations with joins
  const { data: deliberationsData, error: deliberationsError } = await supabase
    .from('deliberations')
    .select(`
      id, numero, titre, publie_at, affiche_at,
      transmis_prefecture_at, annulee, motif_annulation,
      created_at, updated_at, seance_id, vote_id, odj_point_id,
      seances (id, titre, date_seance, instance_id,
        instance_config (id, nom)
      ),
      votes (id, resultat, formule_pv)
    `)
    .order('created_at', { ascending: false })

  if (deliberationsError) {
    console.error('Erreur chargement deliberations:', deliberationsError)
  }

  const deliberations = deliberationsData || []

  // Fetch active instances for the filter
  const { data: instancesData, error: instancesError } = await supabase
    .from('instance_config')
    .select('*')
    .eq('actif', true)
    .order('nom', { ascending: true })

  if (instancesError) {
    console.error('Erreur chargement instances:', instancesError)
  }

  const instances: InstanceConfigRow[] = instancesData || []

  const realUserRole = (userData.user.user_metadata?.role as string) || 'elu'
  const userRole = await getEffectiveRole(realUserRole)
  const canManage = ['super_admin', 'gestionnaire'].includes(userRole)
  const isSuperAdmin = userRole === 'super_admin'

  return (
    <AuthenticatedLayout>
      <PageHeader
        title="Délibérations"
        description="Registre des délibérations adoptées en séance"
        breadcrumbs={[
          { label: 'Tableau de bord', href: ROUTES.DASHBOARD },
          { label: 'Délibérations' },
        ]}
      />

      <main className="px-4 sm:px-8 py-6 page-enter">
        <DeliberationsList
          deliberations={deliberations}
          instances={instances}
          canManage={canManage}
          isSuperAdmin={isSuperAdmin}
        />
      </main>
    </AuthenticatedLayout>
  )
}
