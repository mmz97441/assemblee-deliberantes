export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ROUTES } from '@/lib/constants'
import { getEffectiveRole } from '@/lib/auth/get-effective-role'
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

  const realUserRole = (userData.user.user_metadata?.role as string) || 'elu'
  const userRole = await getEffectiveRole(realUserRole)

  // For elu/preparateur, only show seances where they are convoque
  let eluSeanceIds: string[] | null = null
  if (['elu', 'preparateur'].includes(userRole)) {
    const { data: memberRecord } = await supabase
      .from('members')
      .select('id')
      .eq('user_id', userData.user.id)
      .maybeSingle()

    if (memberRecord) {
      const { data: convocatairesData } = await supabase
        .from('convocataires')
        .select('seance_id')
        .eq('member_id', memberRecord.id)

      eluSeanceIds = (convocatairesData || []).map(c => c.seance_id)
    } else {
      eluSeanceIds = []
    }
  }

  // Fetch seances with instance info and counts
  let seancesQuery = supabase
    .from('seances')
    .select(`
      *,
      instance_config (id, nom),
      odj_points (id),
      convocataires (id)
    `)
    .order('date_seance', { ascending: false })

  // Filter by convocataire IDs for elu/preparateur
  if (eluSeanceIds !== null) {
    if (eluSeanceIds.length === 0) {
      // No convocations — will return empty
      seancesQuery = seancesQuery.in('id', ['__none__'])
    } else {
      seancesQuery = seancesQuery.in('id', eluSeanceIds)
    }
  }

  const { data: seancesData, error: seancesError } = await seancesQuery

  if (seancesError) {
    console.error('Erreur chargement seances:', seancesError)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allSeances = (seancesData || []).map((s: any) => ({
    ...s,
    _count_odj: Array.isArray(s.odj_points) ? s.odj_points.length : 0,
    _count_convocataires: Array.isArray(s.convocataires) ? s.convocataires.length : 0,
    odj_points: undefined,
    convocataires: undefined,
  }))

  // Split active vs archived
  const seances = allSeances.filter((s: { statut: string }) => s.statut !== 'ARCHIVEE')
  const archivedSeances = allSeances.filter((s: { statut: string }) => s.statut === 'ARCHIVEE')

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

  const canManage = ['super_admin', 'gestionnaire'].includes(userRole)

  const isEluView = ['elu', 'preparateur'].includes(userRole)

  return (
    <AuthenticatedLayout>
      <PageHeader
        title={isEluView ? 'Mes s\u00e9ances' : 'S\u00e9ances'}
        description={isEluView ? 'S\u00e9ances auxquelles vous \u00eates convoqu\u00e9' : 'Planification et suivi des s\u00e9ances d\u00e9lib\u00e9rantes'}
        breadcrumbs={[
          { label: 'Tableau de bord', href: ROUTES.DASHBOARD },
          { label: isEluView ? 'Mes s\u00e9ances' : 'S\u00e9ances' },
        ]}
      />

      <main className="px-4 sm:px-8 py-6 page-enter">
        <SeancesList
          seances={seances}
          archivedSeances={archivedSeances}
          instances={instances}
          members={members}
          canManage={canManage}
          isEluView={isEluView}
        />
      </main>
    </AuthenticatedLayout>
  )
}
