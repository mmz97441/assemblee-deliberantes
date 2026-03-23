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
      odj_points (*),
      votes (id, odj_point_id, type_vote, statut, total_votants, question)
    `)
    .eq('id', id)
    .single()

  if (seanceError || !seance) {
    notFound()
  }

  // Enrich open secret votes with voted_count
  const openSecretVotes = (seance.votes || []).filter(
    (v: { type_vote: string | null; statut: string | null }) =>
      v.type_vote === 'SECRET' && v.statut === 'OUVERT'
  )
  for (const vote of openSecretVotes) {
    const { count } = await supabase
      .from('votes_participation')
      .select('*', { count: 'exact', head: true })
      .eq('vote_id', vote.id)
    ;(vote as Record<string, unknown>).voted_count = count || 0
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
