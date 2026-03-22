export const dynamic = 'force-dynamic'

import { redirect, notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ROUTES } from '@/lib/constants'
import { TabletteElu } from '@/components/seance/tablette-elu'

interface Props {
  params: { id: string }
}

export default async function TablettePage({ params }: Props) {
  const { id } = params
  const supabase = await createServerSupabaseClient()

  const { data: userData, error: authError } = await supabase.auth.getUser()
  if (authError || !userData?.user) {
    redirect(ROUTES.LOGIN)
  }

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
      heure_ouverture,
      instance_config (
        id,
        nom,
        type_legal,
        voix_preponderante
      ),
      odj_points (*),
      president_effectif:members!seances_president_effectif_seance_id_fkey (id, prenom, nom),
      secretaire_seance:members!seances_secretaire_seance_id_fkey (id, prenom, nom)
    `)
    .eq('id', id)
    .single()

  if (seanceError || !seance) {
    notFound()
  }

  // Get current user's member info
  const { data: currentMember } = await supabase
    .from('members')
    .select('id, prenom, nom, email, qualite_officielle')
    .eq('user_id', userData.user.id)
    .maybeSingle()

  return (
    <TabletteElu
      seance={seance}
      currentMember={currentMember}
    />
  )
}
