export const dynamic = 'force-dynamic'

import { redirect, notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ROUTES } from '@/lib/constants'
import { TabletWrapper } from '@/components/tablette/tablet-wrapper'

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
      secretaire_seance:members!seances_secretaire_seance_id_fkey (id, prenom, nom),
      votes (id, odj_point_id, type_vote, statut, total_votants, question)
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

  // Check if current member is convoqué for this séance
  let isConvoque = false
  if (currentMember) {
    const { data: convocataire } = await supabase
      .from('convocataires')
      .select('id')
      .eq('seance_id', id)
      .eq('member_id', currentMember.id)
      .maybeSingle()
    isConvoque = !!convocataire
  }

  // Get current member's presence status
  let presenceData: { statut: string | null; heure_arrivee: string | null } | null = null
  if (currentMember) {
    const { data: presence } = await supabase
      .from('presences')
      .select('statut, heure_arrivee')
      .eq('seance_id', id)
      .eq('member_id', currentMember.id)
      .maybeSingle()
    if (presence) {
      presenceData = { statut: presence.statut, heure_arrivee: presence.heure_arrivee }
    }
  }

  // Load votes_participation for current member (to check if already voted in secret ballots)
  let votesParticipation: { vote_id: string; member_id: string }[] = []
  if (currentMember) {
    const openSecretVoteIds = (seance.votes || [])
      .filter((v: { type_vote: string | null; statut: string | null }) =>
        v.type_vote === 'SECRET' && v.statut === 'OUVERT'
      )
      .map((v: { id: string }) => v.id)

    if (openSecretVoteIds.length > 0) {
      const { data: participations } = await supabase
        .from('votes_participation')
        .select('vote_id, member_id')
        .in('vote_id', openSecretVoteIds)
        .eq('member_id', currentMember.id)
      votesParticipation = participations || []
    }
  }

  // Load active procurations where current member is mandataire
  let mandants: { id: string; prenom: string; nom: string }[] = []
  if (currentMember) {
    const { data: procurations } = await supabase
      .from('procurations')
      .select('id, mandant_id, mandant:members!procurations_mandant_id_fkey (id, prenom, nom)')
      .eq('mandataire_id', currentMember.id)
      .eq('seance_id', id)
      .eq('valide', true)

    if (procurations) {
      mandants = procurations
        .map((p) => {
          const m = p.mandant as unknown as { id: string; prenom: string; nom: string } | null
          return m ? { id: m.id, prenom: m.prenom, nom: m.nom } : null
        })
        .filter((m): m is { id: string; prenom: string; nom: string } => m !== null)
    }
  }

  // Load recusations for current member
  let memberRecusations: { odj_point_id: string }[] = []
  if (currentMember) {
    const { data: recusationData } = await supabase
      .from('recusations')
      .select('odj_point_id')
      .eq('seance_id', id)
      .eq('member_id', currentMember.id)
    memberRecusations = recusationData || []
  }

  // Check for existing device_session
  let hasDeviceSession = false
  if (currentMember) {
    const { data: deviceSession } = await supabase
      .from('device_sessions')
      .select('id')
      .eq('seance_id', id)
      .eq('member_id', currentMember.id)
      .eq('active', true)
      .maybeSingle()
    hasDeviceSession = !!deviceSession
  }

  return (
    <TabletWrapper
      seance={seance}
      currentMember={currentMember}
      isConvoque={isConvoque}
      presenceData={presenceData}
      votesParticipation={votesParticipation}
      mandants={mandants}
      hasDeviceSession={hasDeviceSession}
      memberRecusations={memberRecusations}
    />
  )
}
