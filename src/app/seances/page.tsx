export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ROUTES } from '@/lib/constants'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'
import { PageHeader } from '@/components/layout/page-header'
import { SeancesList } from '@/components/seance/seances-list'
import type { InstanceConfigRow } from '@/lib/supabase/types'

export default async function SeancesPage() {
  const supabase = await createServerSupabaseClient()
  const { data: userData, error: authError } = await supabase.auth.getUser()

  if (authError || !userData?.user) {
    redirect(ROUTES.LOGIN)
  }

  // Fetch seances with instance info and counts
  const { data: seancesData, error: seancesError } = await supabase
    .from('seances')
    .select(`
      *,
      instance_config (id, nom),
      odj_points (id),
      convocataires (id)
    `)
    .order('date_seance', { ascending: false })

  if (seancesError) {
    console.error('Erreur chargement seances:', seancesError)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seances = (seancesData || []).map((s: any) => ({
    ...s,
    _count_odj: Array.isArray(s.odj_points) ? s.odj_points.length : 0,
    _count_convocataires: Array.isArray(s.convocataires) ? s.convocataires.length : 0,
    odj_points: undefined,
    convocataires: undefined,
  }))

  // Fetch active instances for the filter and create form
  const { data: instancesData, error: instancesError } = await supabase
    .from('instance_config')
    .select('*')
    .eq('actif', true)
    .order('nom', { ascending: true })

  if (instancesError) {
    console.error('Erreur chargement instances:', instancesError)
  }

  const instances: InstanceConfigRow[] = instancesData || []

  // Fetch members for president/secretaire selection
  const { data: membersData, error: membersError } = await supabase
    .from('members')
    .select('id, prenom, nom, role, qualite_officielle')
    .eq('statut', 'ACTIF')
    .order('nom', { ascending: true })

  if (membersError) {
    console.error('Erreur chargement membres:', membersError)
  }

  const members = membersData || []

  const userRole = (userData.user.user_metadata?.role as string) || 'elu'
  const canManage = ['super_admin', 'gestionnaire', 'president', 'secretaire_seance'].includes(userRole)

  return (
    <AuthenticatedLayout>
      <PageHeader
        title="Séances"
        description="Planification et suivi des séances délibérantes"
        breadcrumbs={[
          { label: 'Tableau de bord', href: ROUTES.DASHBOARD },
          { label: 'Séances' },
        ]}
      />

      <main className="px-8 py-6 page-enter">
        <SeancesList
          seances={seances}
          instances={instances}
          members={members}
          canManage={canManage}
        />
      </main>
    </AuthenticatedLayout>
  )
}
