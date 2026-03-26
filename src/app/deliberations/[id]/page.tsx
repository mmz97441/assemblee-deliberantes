export const dynamic = 'force-dynamic'

import { redirect, notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ROUTES } from '@/lib/constants'
import { getEffectiveRole } from '@/lib/auth/get-effective-role'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'
import { PageHeader } from '@/components/layout/page-header'
import { DeliberationDetail } from '@/components/deliberations/deliberation-detail'

interface Props {
  params: Promise<{ id: string }>
}

export default async function DeliberationDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: userData, error: authError } = await supabase.auth.getUser()

  if (authError || !userData?.user) {
    redirect(ROUTES.LOGIN)
  }

  // Fetch the deliberation with full data
  const { data: delib, error: fetchError } = await supabase
    .from('deliberations')
    .select(`
      id, numero, titre, contenu_articles, publie_at, affiche_at,
      transmis_prefecture_at, pdf_url, annulee, motif_annulation,
      created_at, updated_at, seance_id, vote_id, odj_point_id,
      seances (id, titre, date_seance, statut, instance_id,
        instance_config (id, nom)
      ),
      votes (id, resultat, pour, contre, abstention, total_votants, formule_pv, type_vote)
    `)
    .eq('id', id)
    .single()

  if (fetchError || !delib) {
    notFound()
  }

  const realUserRole = (userData.user.user_metadata?.role as string) || 'elu'
  const userRole = await getEffectiveRole(realUserRole)
  const canManage = ['super_admin', 'gestionnaire'].includes(userRole)
  const isSuperAdmin = userRole === 'super_admin'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seance = delib.seances as any
  const seanceTitle = seance?.titre || 'Seance'
  const instanceName = seance?.instance_config?.nom || ''

  return (
    <AuthenticatedLayout>
      <PageHeader
        title={delib.numero ? `Délibération n°\u00a0${delib.numero}` : 'Délibération (brouillon)'}
        description={delib.titre}
        breadcrumbs={[
          { label: 'Tableau de bord', href: ROUTES.DASHBOARD },
          { label: 'Délibérations', href: ROUTES.DELIBERATIONS },
          { label: delib.numero || 'Brouillon' },
        ]}
      />

      <main className="px-4 sm:px-8 py-6 page-enter">
        <DeliberationDetail
          deliberation={delib}
          seanceTitle={seanceTitle}
          instanceName={instanceName}
          canManage={canManage}
          isSuperAdmin={isSuperAdmin}
        />
      </main>
    </AuthenticatedLayout>
  )
}
