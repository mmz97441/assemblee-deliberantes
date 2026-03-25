export const dynamic = 'force-dynamic'

import { redirect, notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ROUTES } from '@/lib/constants'
import { getEffectiveRole } from '@/lib/auth/get-effective-role'
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
      id, titre, date_seance, statut, reconvocation,
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

  const realUserRole = (userData.user.user_metadata?.role as string) || 'elu'
  const userRole = await getEffectiveRole(realUserRole)
  let canEdit = ['super_admin', 'gestionnaire', 'secretaire_seance'].includes(userRole)
  const isManager = ['super_admin', 'gestionnaire', 'secretaire_seance'].includes(userRole)

  if (!isManager) {
    // Check if user is convoqué to this séance
    if (currentMember) {
      const { data: conv } = await supabase
        .from('convocataires')
        .select('id')
        .eq('seance_id', id)
        .eq('member_id', currentMember.id)
        .maybeSingle()

      if (!conv) {
        redirect(`/seances/${id}`)
      }
    }

    // Élu should only see PV if it's SIGNE or PUBLIE (not draft)
    if (pv && pv.statut !== 'SIGNE' && pv.statut !== 'PUBLIE') {
      canEdit = false
      redirect(`/seances/${id}`)
    }
  }

  // Load convocataires for inline designation in signature step
  const { data: convocataires } = await supabase
    .from('convocataires')
    .select('member_id, member:members (id, prenom, nom)')
    .eq('seance_id', id)

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
          seanceReconvocation={seance.reconvocation ?? false}
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
          convocataires={(convocataires || []).map(c => ({
            member_id: c.member_id,
            member: c.member as { id: string; prenom: string; nom: string } | null,
          }))}
        />
      </main>
    </AuthenticatedLayout>
  )
}
