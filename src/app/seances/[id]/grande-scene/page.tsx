export const dynamic = 'force-dynamic'

import { redirect, notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ROUTES } from '@/lib/constants'
import { GrandeScene } from '@/components/seance/grande-scene'

interface Props {
  params: { id: string }
}

export default async function GrandeScenePage({ params }: Props) {
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
      heure_ouverture,
      instance_config (
        id,
        nom,
        type_legal
      ),
      odj_points (*)
    `)
    .eq('id', id)
    .single()

  if (seanceError || !seance) {
    notFound()
  }

  // Get institution name for the logo area
  const { data: institution } = await supabase
    .from('institution_config')
    .select('nom_officiel')
    .limit(1)
    .maybeSingle()

  return (
    <GrandeScene
      seance={seance}
      institutionName={institution?.nom_officiel || process.env.NEXT_PUBLIC_INSTITUTION_NAME || 'Institution'}
    />
  )
}
