export const dynamic = 'force-dynamic'

import { redirect, notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ROUTES } from '@/lib/constants'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'
import { PageHeader } from '@/components/layout/page-header'
import { EluPreparation } from '@/components/seance/elu-preparation'
// ODJPointRow type used implicitly via Supabase query inference

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function PreparationPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  const { data: userData, error: authError } = await supabase.auth.getUser()
  if (authError || !userData?.user) {
    redirect(ROUTES.LOGIN)
  }

  // Check user is a convocataire of this séance
  const { data: memberRecord } = await supabase
    .from('members')
    .select('id, prenom, nom')
    .eq('user_id', userData.user.id)
    .maybeSingle()

  if (!memberRecord) {
    redirect(ROUTES.DASHBOARD)
  }

  // Load séance with ODJ points and instance
  const { data: seance, error: seanceError } = await supabase
    .from('seances')
    .select(`
      id,
      titre,
      date_seance,
      statut,
      mode,
      lieu,
      instance_id,
      instance_config (id, nom, type_legal),
      odj_points (*),
      convocataires (
        id,
        member_id
      )
    `)
    .eq('id', id)
    .single()

  if (seanceError || !seance) {
    notFound()
  }

  // Verify the user is a convocataire
  const isConvocataire = seance.convocataires?.some(
    (c: { member_id: string }) => c.member_id === memberRecord.id
  )

  if (!isConvocataire) {
    redirect(`/seances/${id}`)
  }

  // Sort ODJ by position
  if (seance.odj_points && Array.isArray(seance.odj_points)) {
    seance.odj_points.sort((a, b) => a.position - b.position)
  }

  // Load rapporteur names for all points that have one
  const rapporteurIds = seance.odj_points
    ?.filter((p) => p.rapporteur_id)
    .map((p) => p.rapporteur_id!) || []

  let rapporteurs: Record<string, string> = {}
  if (rapporteurIds.length > 0) {
    const { data: rapporteurMembers } = await supabase
      .from('members')
      .select('id, prenom, nom')
      .in('id', rapporteurIds)

    if (rapporteurMembers) {
      rapporteurs = Object.fromEntries(
        rapporteurMembers.map(m => [m.id, `${m.prenom} ${m.nom}`])
      )
    }
  }

  return (
    <AuthenticatedLayout>
      <PageHeader
        title="Ma préparation"
        description={`${seance.titre} — ${seance.instance_config?.nom || 'Instance'}`}
        breadcrumbs={[
          { label: 'Tableau de bord', href: ROUTES.DASHBOARD },
          { label: 'Séances', href: ROUTES.SEANCES },
          { label: seance.titre, href: `/seances/${id}` },
          { label: 'Ma préparation' },
        ]}
      />

      <main className="px-4 sm:px-8 py-6 page-enter">
        <EluPreparation
          seanceId={seance.id}
          seanceTitre={seance.titre}
          dateSeance={seance.date_seance}
          instanceNom={seance.instance_config?.nom || ''}
          lieu={seance.lieu}
          mode={seance.mode}
          points={seance.odj_points || []}
          rapporteurs={rapporteurs}
        />
      </main>
    </AuthenticatedLayout>
  )
}
