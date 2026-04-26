export const dynamic = 'force-dynamic'

import { redirect, notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ROUTES } from '@/lib/constants'
import { getEffectiveRole } from '@/lib/auth/get-effective-role'
import { PresidentTablet } from '@/components/seance/president-tablet'

interface Props {
  params: Promise<{ id: string }>
}

/**
 * Vue tablette président — accessible uniquement au président de la séance
 * ou au super_admin/gestionnaire.
 */
export default async function PresidentPage({ params }: Props) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  const { data: userData, error: authError } = await supabase.auth.getUser()
  if (authError || !userData?.user) {
    redirect(ROUTES.LOGIN)
  }

  // Vérifier le rôle
  const realRole = (userData.user.user_metadata?.role as string) || ''
  const role = await getEffectiveRole(realRole)
  if (!['super_admin', 'gestionnaire', 'president'].includes(role)) {
    redirect(`/seances/${id}`)
  }

  // Charger la séance complète
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
        ouvert_at,
        clos_at,
        question
      )
    `)
    .eq('id', id)
    .single()

  if (seanceError || !seance) {
    notFound()
  }

  // Compter les membres de l'instance pour le quorum
  const { count: instanceMemberCount } = await supabase
    .from('instance_members')
    .select('*', { count: 'exact', head: true })
    .eq('instance_config_id', seance.instance_id)

  // Nom de l'institution
  const { data: institution } = await supabase
    .from('institution_config')
    .select('nom_officiel')
    .limit(1)
    .maybeSingle()

  return (
    <PresidentTablet
      seance={seance}
      instanceMemberCount={instanceMemberCount || 0}
      institutionName={institution?.nom_officiel || process.env.NEXT_PUBLIC_INSTITUTION_NAME || 'Institution'}
    />
  )
}
