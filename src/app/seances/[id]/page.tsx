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
  params: { id: string }
}

export default async function SeanceDetailPage({ params }: PageProps) {
  const { id } = params
  const supabase = await createServerSupabaseClient()
  const { data: userData, error: authError } = await supabase.auth.getUser()

  if (authError || !userData?.user) {
    redirect(ROUTES.LOGIN)
  }

  // Fetch seance — simple query, related data loaded separately to avoid PostgREST FK ambiguity
  const { data: seance, error: seanceError } = await supabase
    .from('seances')
    .select(`
      *,
      instance_config (id, nom, type_legal, delai_convocation_jours, quorum_type, quorum_fraction_numerateur, quorum_fraction_denominateur, composition_max, majorite_defaut, ecran_public_active, tablette_president_active),
      odj_points!odj_points_seance_id_fkey (*),
      convocataires (
        id,
        member_id,
        external_invitee_id,
        statut_convocation,
        envoye_at,
        confirme_at,
        member:members (id, prenom, nom, email, role, qualite_officielle)
      )
    `)
    .eq('id', id)
    .single()

  if (seanceError || !seance) {
    console.error('Erreur chargement seance:', seanceError?.message, seanceError?.code)
    notFound()
  }

  // ─── Chargement parallèle des données dépendant de la séance ─────────────
  // Toutes ces requêtes sont indépendantes les unes des autres : on les
  // lance en parallèle pour diviser le TTFB de cette page (auparavant ~6
  // allers-retours en série vers Postgres).
  const [
    presidentEffectifResult,
    secretaireSeanceResult,
    procurationsResult,
    allMembersResult,
    allInstancesResult,
    instanceMembersResult,
    institutionConfigResult,
    currentUserMemberResult,
    externalInviteesResult,
  ] = await Promise.all([
    seance.president_effectif_seance_id
      ? supabase
          .from('members')
          .select('id, prenom, nom')
          .eq('id', seance.president_effectif_seance_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    seance.secretaire_seance_id
      ? supabase
          .from('members')
          .select('id, prenom, nom')
          .eq('id', seance.secretaire_seance_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('procurations')
      .select(`
        id,
        mandant_id,
        mandataire_id,
        valide,
        canal_communication,
        created_at,
        mandant:members!procurations_mandant_id_fkey (id, prenom, nom, email),
        mandataire:members!procurations_mandataire_id_fkey (id, prenom, nom, email)
      `)
      .eq('seance_id', id),
    supabase
      .from('members')
      .select('id, prenom, nom, email, role, qualite_officielle')
      .eq('statut', 'ACTIF')
      .order('nom', { ascending: true }),
    supabase
      .from('instance_config')
      .select('*')
      .eq('actif', true)
      .order('nom', { ascending: true }),
    supabase
      .from('instance_members')
      .select('member_id')
      .eq('instance_config_id', seance.instance_id)
      .eq('actif', true),
    supabase
      .from('institution_config')
      .select('population_habitants, note_synthese_obligatoire, note_synthese_seuil_population, type_institution')
      .limit(1)
      .maybeSingle(),
    supabase
      .from('members')
      .select('id')
      .eq('user_id', userData.user.id)
      .maybeSingle(),
    // Invités externes actifs — pour le bouton « Inviter un externe » dans la séance
    supabase
      .from('external_invitees')
      .select('id, prenom, nom, email, organisation, qualite_officielle')
      .is('archived_at', null)
      .order('nom', { ascending: true }),
  ])

  const presidentEffectif = presidentEffectifResult.data
  const secretaireSeance = secretaireSeanceResult.data
  const procurationsData = procurationsResult.data
  const allMembers = allMembersResult.data
  const allInstances = allInstancesResult.data
  const instanceMembers = instanceMembersResult.data
  const institutionConfig = institutionConfigResult.data
  const currentUserMember = currentUserMemberResult.data
  const externalInvitees = externalInviteesResult.data

  // Compose the full seance object
  // PHASE 1 invités externes : on filtre les convocataires « membres » pour
  // que SeanceDetail garde son type actuel (`member_id: string`). Les
  // convocataires externes seront affichés dans une section dédiée en phase 3.
  const seanceWithProcurations = {
    ...seance,
    president_effectif: presidentEffectif,
    secretaire_seance: secretaireSeance,
    procurations: procurationsData || [],
    convocataires: (seance.convocataires || []).filter(
      (c): c is typeof c & { member_id: string } => c.member_id !== null,
    ),
  }

  // Sort ODJ by position
  if (seance.odj_points && Array.isArray(seance.odj_points)) {
    seance.odj_points.sort((a: ODJPointRow, b: ODJPointRow) => a.position - b.position)
  }

  const userRole = await getEffectiveRole(supabase, userData.user.id)
  const canManage = ['super_admin', 'dgs', 'directeur_cabinet', 'gestionnaire'].includes(userRole)

  // Vrai si l'utilisateur courant est président effectif OU secrétaire
  // de cette séance précise.
  const isBureauSeance = !!currentUserMember && (
    seance.president_effectif_seance_id === currentUserMember.id ||
    seance.secretaire_seance_id === currentUserMember.id
  )

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
          seance={seanceWithProcurations}
          allMembers={allMembers || []}
          externalInvitees={externalInvitees || []}
          externalInviteesAlreadyConvoques={
            (seance.convocataires || [])
              .map(c => c.external_invitee_id)
              .filter((id): id is string => !!id)
          }
          allInstances={allInstances || []}
          instanceMemberIds={(instanceMembers || []).map(im => im.member_id)}
          canManage={canManage}
          isBureauSeance={isBureauSeance}
          institutionConfig={institutionConfig || null}
        />
      </main>
    </AuthenticatedLayout>
  )
}
