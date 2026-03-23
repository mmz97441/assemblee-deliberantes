export const dynamic = 'force-dynamic'

import { redirect, notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ROUTES } from '@/lib/constants'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'
import { PageHeader } from '@/components/layout/page-header'
import { PVEditor } from '@/components/pv/pv-editor'

interface Props {
  params: { id: string }
}

export default async function PVPage({ params }: Props) {
  const { id } = params
  const supabase = await createServerSupabaseClient()

  const { data: userData, error: authError } = await supabase.auth.getUser()
  if (authError || !userData?.user) {
    redirect(ROUTES.LOGIN)
  }

  // Load seance basic info
  const { data: seance, error: seanceError } = await supabase
    .from('seances')
    .select(`
      id, titre, date_seance, statut,
      instance_config (nom)
    `)
    .eq('id', id)
    .single()

  if (seanceError || !seance) {
    notFound()
  }

  // Load existing PV if any
  const { data: pv } = await supabase
    .from('pv')
    .select('*')
    .eq('seance_id', id)
    .maybeSingle()

  const userRole = (userData.user.user_metadata?.role as string) || 'elu'
  const canEdit = ['super_admin', 'gestionnaire'].includes(userRole)

  const instanceNom = (seance.instance_config as { nom: string } | null)?.nom || ''

  return (
    <AuthenticatedLayout>
      <PageHeader
        title={`Procès-verbal — ${seance.titre}`}
        description={`${instanceNom} — ${new Date(seance.date_seance).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`}
        breadcrumbs={[
          { label: 'Tableau de bord', href: ROUTES.DASHBOARD },
          { label: 'Séances', href: ROUTES.SEANCES },
          { label: seance.titre, href: `/seances/${id}` },
          { label: 'Procès-verbal' },
        ]}
      />

      <main className="px-8 py-6 page-enter">
        <PVEditor
          seanceId={id}
          seanceTitre={seance.titre}
          seanceStatut={seance.statut || 'BROUILLON'}
          existingPV={pv}
          canEdit={canEdit}
        />
      </main>
    </AuthenticatedLayout>
  )
}
