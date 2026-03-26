export const dynamic = 'force-dynamic'

import { redirect, notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ROUTES } from '@/lib/constants'
import { getEffectiveRole } from '@/lib/auth/get-effective-role'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'
import { PageHeader } from '@/components/layout/page-header'
import { SeanceDetail } from '@/components/seance/seance-detail'
import type { ODJPointRow } from '@/lib/supabase/types'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function SeanceDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: userData, error: authError } = await supabase.auth.getUser()

  if (authError || !userData?.user) {
    redirect(ROUTES.LOGIN)
  }

  // Fetch seance with all details
  const { data: seance, error: seanceError } = await supabase
    .from('seances')
    .select(`
      *,
      instance_config (id, nom, type_legal, delai_convocation_jours, quorum_type, quorum_fraction_numerateur, quorum_fraction_denominateur, composition_max, majorite_defaut),
      odj_points (*),
      convocataires (
        id,
        member_id,
        statut_convocation,
        envoye_at,
        confirme_at,
        member:members (id, prenom, nom, email, role, qualite_officielle)
      ),
      president_effectif:members!seances_president_effectif_seance_id_fkey (id, prenom, nom),
      secretaire_seance:members!seances_secretaire_seance_id_fkey (id, prenom, nom),
      procurations (
        id,
        mandant_id,
        mandataire_id,
        valide,
        canal_communication,
        created_at,
        mandant:members!procurations_mandant_id_fkey (id, prenom, nom, email),
        mandataire:members!procurations_mandataire_id_fkey (id, prenom, nom, email)
      )
    `)
    .eq('id', id)
    .single()

  if (seanceError || !seance) {
    console.error('Erreur chargement seance:', seanceError)
    notFound()
  }

  // Sort ODJ by position
  if (seance.odj_points && Array.isArray(seance.odj_points)) {
    seance.odj_points.sort((a: ODJPointRow, b: ODJPointRow) => a.position - b.position)
  }

  // Fetch all active members (for adding convocataires, rapporteur selection)
  const { data: allMembers } = await supabase
    .from('members')
    .select('id, prenom, nom, email, role, qualite_officielle')
    .eq('statut', 'ACTIF')
    .order('nom', { ascending: true })

  // Fetch instance members for this instance
  const { data: instanceMembers } = await supabase
    .from('instance_members')
    .select('member_id')
    .eq('instance_config_id', seance.instance_id)
    .eq('actif', true)

  const realUserRole = (userData.user.user_metadata?.role as string) || 'elu'
  const userRole = await getEffectiveRole(realUserRole)
  const canManage = ['super_admin', 'gestionnaire'].includes(userRole)

  const statutLabel: Record<string, string> = {
    BROUILLON: 'Brouillon',
    CONVOQUEE: 'Convoquée',
    EN_COURS: 'En cours',
    SUSPENDUE: 'Suspendue',
    CLOTUREE: 'Clôturée',
    ARCHIVEE: 'Archivée',
  }

  return (
    <AuthenticatedLayout>
      <PageHeader
        title={seance.titre}
        description={`${seance.instance_config?.nom || 'Instance'} — ${statutLabel[seance.statut || 'BROUILLON']}`}
        breadcrumbs={[
          { label: 'Tableau de bord', href: ROUTES.DASHBOARD },
          { label: 'Séances', href: ROUTES.SEANCES },
          { label: seance.titre },
        ]}
      />

      <main className="px-4 sm:px-8 py-6 page-enter">
        <SeanceDetail
          seance={seance}
          allMembers={allMembers || []}
          instanceMemberIds={(instanceMembers || []).map(im => im.member_id)}
          canManage={canManage}
        />
      </main>
    </AuthenticatedLayout>
  )
}
