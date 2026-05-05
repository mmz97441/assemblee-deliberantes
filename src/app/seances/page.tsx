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

  const userRole = await getEffectiveRole(supabase, userData.user.id)

  // SECURITY (single-tenant): In single-tenant architecture, all users belong to the same
  // institution so gestionnaires/super_admin see all seances. For elu/preparateur, we restrict
  // visibility to only seances where they are convocataires (convoqued members).
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
      instance_config (
        id, nom,
        composition_max,
        quorum_type,
        quorum_fraction_numerateur,
        quorum_fraction_denominateur
      ),
      odj_points!odj_points_seance_id_fkey (id),
      convocataires (id, statut_convocation)
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

  // Récupérer les counts de procurations et présences pour les séances
  // affichées (en une seule requête groupée pour éviter le N+1)
  const seanceIds = (seancesData || []).map((s: { id: string }) => s.id)

  const procurationsBySeance = new Map<string, number>()
  const presencesBySeance = new Map<string, number>()
  if (seanceIds.length > 0) {
    // Procurations + présences sont indépendantes : on les charge en parallèle
    const [{ data: procData }, { data: presData }] = await Promise.all([
      supabase
        .from('procurations')
        .select('seance_id')
        .in('seance_id', seanceIds)
        .eq('valide', true),
      supabase
        .from('presences')
        .select('seance_id, statut')
        .in('seance_id', seanceIds),
    ])
    for (const p of procData || []) {
      const id = (p as { seance_id: string }).seance_id
      procurationsBySeance.set(id, (procurationsBySeance.get(id) || 0) + 1)
    }
    for (const p of presData || []) {
      const row = p as { seance_id: string; statut: string }
      if (row.statut === 'PRESENT' || row.statut === 'PROCURATION') {
        presencesBySeance.set(row.seance_id, (presencesBySeance.get(row.seance_id) || 0) + 1)
      }
    }
  }

  type ConvocataireSlim = { id: string; statut_convocation: string | null }
  type InstanceConfigSlim = {
    id: string
    nom: string
    composition_max: number | null
    quorum_type: string | null
    quorum_fraction_numerateur: number | null
    quorum_fraction_denominateur: number | null
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allSeances = (seancesData || []).map((s: any) => {
    const convocataires = (s.convocataires as ConvocataireSlim[] | null) || []
    const total = convocataires.length
    const sent = convocataires.filter(c => c.statut_convocation && c.statut_convocation !== 'NON_ENVOYE').length
    const confirmed = convocataires.filter(c => c.statut_convocation === 'CONFIRME_PRESENT').length
    const errored = convocataires.filter(c => c.statut_convocation === 'ERREUR_EMAIL').length
    const procurations = procurationsBySeance.get(s.id) || 0
    const presents = presencesBySeance.get(s.id) || 0

    // Calcul du quorum requis selon la config de l'instance (cohérent avec dashboard)
    const inst = (s.instance_config as InstanceConfigSlim | null)
    let quorumRequired: number | null = null
    const totalMembers = inst?.composition_max ?? total
    if (totalMembers > 0) {
      const qType = inst?.quorum_type || 'MAJORITE_MEMBRES'
      const num = inst?.quorum_fraction_numerateur || 1
      const den = inst?.quorum_fraction_denominateur || 2
      if (qType === 'MAJORITE_MEMBRES') quorumRequired = Math.floor(totalMembers / 2) + 1
      else if (qType === 'TIERS_MEMBRES') quorumRequired = Math.ceil(totalMembers / 3)
      else if (qType === 'DEUX_TIERS') quorumRequired = Math.ceil((totalMembers * 2) / 3)
      else if (qType === 'STATUTS') quorumRequired = Math.ceil((totalMembers * num) / den)
      else quorumRequired = Math.floor(totalMembers / 2) + 1
    }

    return {
      ...s,
      _count_odj: Array.isArray(s.odj_points) ? s.odj_points.length : 0,
      _count_convocataires: total,
      _convocations_sent: sent,
      _convocations_confirmed: confirmed,
      _convocations_errored: errored,
      _procurations: procurations,
      _presents: presents,
      _quorum_required: quorumRequired,
      odj_points: undefined,
      convocataires: undefined,
    }
  })

  // Split active vs archived
  const seances = allSeances.filter((s: { statut: string }) => s.statut !== 'ARCHIVEE')
  const archivedSeances = allSeances.filter((s: { statut: string }) => s.statut === 'ARCHIVEE')

  // Instances + membres pour les selects du formulaire — indépendants : parallèle
  const [
    { data: instancesData, error: instancesError },
    { data: membersData, error: membersError },
  ] = await Promise.all([
    supabase
      .from('instance_config')
      .select('*')
      .eq('actif', true)
      .order('nom', { ascending: true }),
    supabase
      .from('members')
      .select('id, prenom, nom, role, qualite_officielle')
      .eq('statut', 'ACTIF')
      .order('nom', { ascending: true }),
  ])

  if (instancesError) {
    console.error('Erreur chargement instances:', instancesError)
  }
  if (membersError) {
    console.error('Erreur chargement membres:', membersError)
  }

  const instances: InstanceConfigRow[] = instancesData || []
  const members = membersData || []

  const canManage = ['super_admin', 'dgs', 'directeur_cabinet', 'gestionnaire'].includes(userRole)

  const isEluView = ['elu', 'preparateur'].includes(userRole)

  return (
    <AuthenticatedLayout>
      <PageHeader
        title={isEluView ? 'Mes séances' : 'Séances'}
        description={isEluView ? 'Séances auxquelles vous êtes convoqué' : 'Planification et suivi des séances délibérantes'}
        breadcrumbs={[
          { label: 'Tableau de bord', href: ROUTES.DASHBOARD },
          { label: isEluView ? 'Mes séances' : 'Séances' },
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
