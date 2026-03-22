export const dynamic = 'force-dynamic'

import { redirect, notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ROUTES } from '@/lib/constants'
import { EmargementView } from '@/components/presence/emargement-view'

interface Props {
  params: { id: string }
}

export default async function EmargementPage({ params }: Props) {
  const { id } = params
  const supabase = await createServerSupabaseClient()

  const { data: userData, error: authError } = await supabase.auth.getUser()
  if (authError || !userData?.user) {
    redirect(ROUTES.LOGIN)
  }

  // Get seance with convocataires and existing presences
  const { data: seance, error: seanceError } = await supabase
    .from('seances')
    .select(`
      id,
      titre,
      date_seance,
      statut,
      instance_id,
      instance_config (
        id,
        nom,
        quorum_type,
        quorum_fraction_numerateur,
        quorum_fraction_denominateur,
        composition_max
      ),
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
        signature_svg,
        mode_authentification
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
    <EmargementView
      seance={seance}
      instanceMemberCount={instanceMemberCount || 0}
    />
  )
}
