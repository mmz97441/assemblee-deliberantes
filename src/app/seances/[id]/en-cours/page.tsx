export const dynamic = 'force-dynamic'

import { redirect, notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ROUTES } from '@/lib/constants'
import { SessionConductor } from '@/components/seance/session-conductor'

interface Props {
  params: { id: string }
}

export default async function SeanceEnCoursPage({ params }: Props) {
  const { id } = params
  const supabase = await createServerSupabaseClient()

  const { data: userData, error: authError } = await supabase.auth.getUser()
  if (authError || !userData?.user) {
    redirect(ROUTES.LOGIN)
  }

  // Check role
  const role = (userData.user.user_metadata?.role as string) || ''
  if (!['super_admin', 'gestionnaire'].includes(role)) {
    redirect(`/seances/${id}`)
  }

  // Load full seance data
  const { data: seance, error: seanceError } = await supabase
    .from('seances')
    .select(`
      id,
      titre,
      date_seance,
      statut,
      instance_id,
      lieu,
      mode,
      publique,
      heure_ouverture,
      heure_cloture,
      notes,
      reconvocation,
      instance_config (
        id,
        nom,
        type_legal,
        quorum_type,
        quorum_fraction_numerateur,
        quorum_fraction_denominateur,
        composition_max,
        majorite_defaut,
        voix_preponderante
      ),
      odj_points (*),
      convocataires (
        id,
        member_id,
        member:members (id, prenom, nom, email, qualite_officielle)
      ),
      presences (
        id,
        member_id,
        statut,
        heure_arrivee,
        heure_depart,
        mode_authentification
      ),
      president_effectif:members!seances_president_effectif_seance_id_fkey (id, prenom, nom),
      secretaire_seance:members!seances_secretaire_seance_id_fkey (id, prenom, nom),
      votes (
        id,
        odj_point_id,
        type_vote,
        statut,
        pour,
        contre,
        abstention,
        total_votants,
        resultat,
        formule_pv,
        noms_contre,
        noms_abstention,
        voix_preponderante_activee,
        ouvert_at,
        clos_at
      )
    `)
    .eq('id', id)
    .single()

  if (seanceError || !seance) {
    notFound()
  }

  // Count total instance members for quorum
  const { count: instanceMemberCount } = await supabase
    .from('instance_members')
    .select('*', { count: 'exact', head: true })
    .eq('instance_id', seance.instance_id)

  return (
    <SessionConductor
      seance={seance}
      instanceMemberCount={instanceMemberCount || 0}
    />
  )
}
