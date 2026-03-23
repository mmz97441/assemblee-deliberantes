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

  // Load seance basic info + president/secretary IDs
  const { data: seance, error: seanceError } = await supabase
    .from('seances')
    .select(`
      id, titre, date_seance, statut,
      president_effectif_seance_id,
      secretaire_seance_id,
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
    .select('id, contenu_json, statut, version, signe_par, pdf_url')
    .eq('seance_id', id)
    .maybeSingle()

  // Find the current user's member record
  const { data: currentMember } = await supabase
    .from('members')
    .select('id')
    .eq('user_id', userData.user.id)
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
          existingPV={pv ? {
            id: pv.id,
            contenu_json: pv.contenu_json,
            statut: pv.statut,
            version: pv.version,
            signe_par: pv.signe_par,
            pdf_url: pv.pdf_url,
          } : null}
          canEdit={canEdit}
          currentUserMemberId={currentMember?.id || null}
          presidentMemberId={seance.president_effectif_seance_id || null}
          secretaireMemberId={seance.secretaire_seance_id || null}
        />
      </main>
    </AuthenticatedLayout>
  )
}
