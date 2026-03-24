export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ROUTES } from '@/lib/constants'
import { ROLE_LABELS } from '@/lib/auth/helpers'
import { getEffectiveRole } from '@/lib/auth/get-effective-role'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'
import { PageHeader } from '@/components/layout/page-header'
import { EluDashboard } from '@/components/dashboard/elu-dashboard'
import type { EluDashboardProps } from '@/components/dashboard/elu-dashboard'
import { PresidentDashboard } from '@/components/dashboard/president-dashboard'
import type { PresidentDashboardProps } from '@/components/dashboard/president-dashboard'
import { SecretaireDashboard } from '@/components/dashboard/secretaire-dashboard'
import type { SecretaireDashboardProps } from '@/components/dashboard/secretaire-dashboard'
import { GestionnaireDashboard } from '@/components/dashboard/gestionnaire-dashboard'
import type { GestionnaireDashboardProps } from '@/components/dashboard/gestionnaire-dashboard'
import {
  Mail,
  FileText,
  ClipboardList,
  Eye,
  Send,
  PenLine,
  Users,
} from 'lucide-react'
import type { UserRole } from '@/lib/supabase/types'
import React from 'react'

export default async function DashboardPage() {
  let user = null

  try {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase.auth.getUser()
    if (!error && data?.user) {
      user = data.user
    }
  } catch {
    // Supabase indisponible
  }

  if (!user) {
    redirect(ROUTES.LOGIN)
  }

  const realRole = (user.user_metadata?.role as UserRole) || 'elu'
  const role = await getEffectiveRole(realRole) as UserRole
  const fullName = user.user_metadata?.full_name || user.email
  const firstName = fullName?.split(' ')[0] || ''

  // Determine greeting based on time
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon apres-midi' : 'Bonsoir'

  const supabase = await createServerSupabaseClient()
  const now = new Date()
  const yearStart = `${now.getFullYear()}-01-01`
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  // ════════════════════════════════════════════════════════════════
  // ELU / PREPARATEUR DASHBOARD
  // ════════════════════════════════════════════════════════════════
  if (['elu', 'preparateur'].includes(role)) {
    const { data: memberRecord } = await supabase
      .from('members')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    const props: Omit<EluDashboardProps, 'firstName' | 'greeting'> = {
      nextSeance: null,
      stats: {
        seancesParticipees: 0,
        seancesConvoquees: 0,
        votesEffectues: 0,
        procurationsGiven: 0,
        procurationsReceived: 0,
      },
      recentVotes: [],
      recentPV: [],
    }

    if (memberRecord) {
      const memberId = memberRecord.id

      // ── Convocations with seance details ──
      const { data: convocataires } = await supabase
        .from('convocataires')
        .select('seance_id, statut_convocation')
        .eq('member_id', memberId)

      const seanceIds = (convocataires || []).map((c) => c.seance_id)
      const convocationMap = new Map(
        (convocataires || []).map((c) => [c.seance_id, c.statut_convocation])
      )

      if (seanceIds.length > 0) {
        // ── Next seance (upcoming, most imminent first) ──
        const { data: upcomingSeances } = await supabase
          .from('seances')
          .select('id, titre, date_seance, statut, lieu, mode, instance_config (nom)')
          .in('id', seanceIds)
          .or(`statut.eq.CONVOQUEE,statut.eq.EN_COURS`)
          .gte('date_seance', now.toISOString().slice(0, 10))
          .order('date_seance', { ascending: true })
          .limit(1)

        // Also check for EN_COURS regardless of date
        const { data: enCoursSeances } = await supabase
          .from('seances')
          .select('id, titre, date_seance, statut, lieu, mode, instance_config (nom)')
          .in('id', seanceIds)
          .eq('statut', 'EN_COURS')
          .limit(1)

        const nextRaw = enCoursSeances?.[0] || upcomingSeances?.[0]

        if (nextRaw) {
          // Load ODJ points for next seance
          const { data: odjPoints } = await supabase
            .from('odj_points')
            .select('position, titre')
            .eq('seance_id', nextRaw.id)
            .order('position', { ascending: true })

          props.nextSeance = {
            id: nextRaw.id,
            titre: nextRaw.titre,
            date_seance: nextRaw.date_seance,
            statut: nextRaw.statut,
            instance_nom: (nextRaw.instance_config as { nom: string } | null)?.nom || null,
            lieu: nextRaw.lieu,
            mode: nextRaw.mode,
            convocation_statut: convocationMap.get(nextRaw.id) || null,
            odj_points: (odjPoints || []).map((p) => ({
              position: p.position,
              titre: p.titre,
            })),
          }
        }
      }

      // ── Stats: presences this year ──
      const { data: presences } = await supabase
        .from('presences')
        .select('id, statut')
        .eq('member_id', memberId)
        .gte('created_at', yearStart)

      props.stats.seancesConvoquees = seanceIds.length
      props.stats.seancesParticipees = (presences || []).filter(
        (p) => p.statut === 'PRESENT'
      ).length

      // ── Stats: votes ──
      const { count: votesCount } = await supabase
        .from('bulletins_vote')
        .select('id', { count: 'exact', head: true })
        .eq('member_id', memberId)

      const { count: secretVotesCount } = await supabase
        .from('votes_participation')
        .select('id', { count: 'exact', head: true })
        .eq('member_id', memberId)

      props.stats.votesEffectues = (votesCount || 0) + (secretVotesCount || 0)

      // ── Stats: procurations ──
      const { count: procGiven } = await supabase
        .from('procurations')
        .select('id', { count: 'exact', head: true })
        .eq('mandant_id', memberId)
        .eq('valide', true)

      const { count: procReceived } = await supabase
        .from('procurations')
        .select('id', { count: 'exact', head: true })
        .eq('mandataire_id', memberId)
        .eq('valide', true)

      props.stats.procurationsGiven = procGiven || 0
      props.stats.procurationsReceived = procReceived || 0

      // ── Recent votes (last 5, non-secret) ──
      const { data: recentBulletins } = await supabase
        .from('bulletins_vote')
        .select('id, choix, vote_id')
        .eq('member_id', memberId)
        .order('horodatage_serveur', { ascending: false })
        .limit(5)

      // Get vote details for bulletins
      if (recentBulletins && recentBulletins.length > 0) {
        const voteIds = recentBulletins.map((b) => b.vote_id)
        const { data: votesData } = await supabase
          .from('votes')
          .select('id, question, resultat, clos_at, type_vote')
          .in('id', voteIds)

        const votesMap = new Map((votesData || []).map((v) => [v.id, v]))

        props.recentVotes = recentBulletins
          .map((b) => {
            const vote = votesMap.get(b.vote_id)
            if (!vote) return null
            return {
              id: b.id,
              question: vote.question,
              resultat: vote.resultat,
              clos_at: vote.clos_at,
              type_vote: vote.type_vote,
              choix: b.choix,
              is_secret: false,
            }
          })
          .filter((v): v is NonNullable<typeof v> => v !== null)
      }

      // Also check secret votes participation
      const { data: secretParticipations } = await supabase
        .from('votes_participation')
        .select('id, vote_id')
        .eq('member_id', memberId)
        .order('horodatage_serveur', { ascending: false })
        .limit(5)

      if (secretParticipations && secretParticipations.length > 0) {
        const secretVoteIds = secretParticipations.map((p) => p.vote_id)
        const { data: secretVotesData } = await supabase
          .from('votes')
          .select('id, question, resultat, clos_at, type_vote')
          .in('id', secretVoteIds)

        const secretMap = new Map((secretVotesData || []).map((v) => [v.id, v]))

        const secretVotesSummary = secretParticipations
          .map((p) => {
            const vote = secretMap.get(p.vote_id)
            if (!vote) return null
            return {
              id: p.id,
              question: vote.question,
              resultat: vote.resultat,
              clos_at: vote.clos_at,
              type_vote: vote.type_vote,
              choix: null,
              is_secret: true,
            }
          })
          .filter((v): v is NonNullable<typeof v> => v !== null)

        // Merge and sort by date, keep top 5
        const allVotes = [...props.recentVotes, ...secretVotesSummary]
          .sort((a, b) => {
            const da = a.clos_at ? new Date(a.clos_at).getTime() : 0
            const db = b.clos_at ? new Date(b.clos_at).getTime() : 0
            return db - da
          })
          .slice(0, 5)

        props.recentVotes = allVotes
      }

      // ── Recent PV (published, from seances I attended) ──
      if (seanceIds.length > 0) {
        const { data: pvData } = await supabase
          .from('pv')
          .select('seance_id, pdf_url, statut')
          .in('seance_id', seanceIds)
          .in('statut', ['SIGNE', 'PUBLIE'])
          .limit(3)

        if (pvData && pvData.length > 0) {
          const pvSeanceIds = pvData.map((p) => p.seance_id)
          const { data: pvSeances } = await supabase
            .from('seances')
            .select('id, titre, date_seance')
            .in('id', pvSeanceIds)

          const seanceMap = new Map(
            (pvSeances || []).map((s) => [s.id, { titre: s.titre, date: s.date_seance }])
          )

          props.recentPV = pvData.map((pv) => {
            const s = seanceMap.get(pv.seance_id)
            return {
              seance_id: pv.seance_id,
              seance_titre: s?.titre || 'Seance',
              seance_date: s?.date || '',
              pdf_url: pv.pdf_url,
            }
          })
        }
      }
    }

    return (
      <AuthenticatedLayout>
        <PageHeader
          title={`${greeting}, ${firstName}`}
          description={`${ROLE_LABELS[role]} — Voici un resume de votre espace`}
        />
        <main className="px-4 sm:px-8 py-8 page-enter">
          <EluDashboard
            firstName={firstName}
            greeting={greeting}
            {...props}
          />
        </main>
      </AuthenticatedLayout>
    )
  }

  // ════════════════════════════════════════════════════════════════
  // PRESIDENT DASHBOARD
  // ════════════════════════════════════════════════════════════════
  if (role === 'president') {
    const { data: memberRecord } = await supabase
      .from('members')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    const props: Omit<PresidentDashboardProps, 'firstName' | 'greeting'> = {
      urgentActions: [],
      stats: {
        seancesPresidees: 0,
        deliberationsPubliees: 0,
        tauxParticipationMoyen: 0,
        pvEnAttente: 0,
      },
      quorumPrediction: null,
      recentDelibs: [],
      seances: [],
    }

    if (memberRecord) {
      const memberId = memberRecord.id

      // ── Seances where I am president ──
      const { data: seancesPresidees } = await supabase
        .from('seances')
        .select('id, titre, date_seance, statut, lieu, instance_config (nom)')
        .eq('president_effectif_seance_id', memberId)
        .order('date_seance', { ascending: true })

      props.seances = (seancesPresidees || []).map((s) => ({
        id: s.id,
        titre: s.titre,
        date_seance: s.date_seance,
        statut: s.statut,
        instance_nom: (s.instance_config as { nom: string } | null)?.nom || null,
        lieu: s.lieu,
      }))

      const seanceIds = (seancesPresidees || []).map((s) => s.id)

      // ── Stats: seances presidees this year ──
      props.stats.seancesPresidees = (seancesPresidees || []).filter((s) => {
        return s.date_seance >= yearStart && ['CLOTUREE', 'ARCHIVEE', 'EN_COURS'].includes(s.statut || '')
      }).length

      if (seanceIds.length > 0) {
        // ── PV en attente ──
        const { data: pvData } = await supabase
          .from('pv')
          .select('seance_id, statut')
          .in('seance_id', seanceIds)
          .in('statut', ['BROUILLON', 'EN_RELECTURE'])

        props.stats.pvEnAttente = pvData?.length || 0

        // Urgent actions: PV en attente de signature
        if (pvData && pvData.length > 0) {
          const pvEnRelecture = pvData.filter((pv) => pv.statut === 'EN_RELECTURE')
          if (pvEnRelecture.length > 0) {
            props.urgentActions.push({
              id: 'pv-signature',
              severity: 'red',
              label: `${pvEnRelecture.length} PV en attente de votre signature`,
              href: `/seances/${pvEnRelecture[0].seance_id}/pv`,
            })
          }
        }

        // Urgent: seance EN_COURS
        const enCours = (seancesPresidees || []).find((s) => s.statut === 'EN_COURS')
        if (enCours) {
          props.urgentActions.unshift({
            id: 'seance-en-cours',
            severity: 'red',
            label: `Seance EN COURS — ${enCours.titre}`,
            href: `/seances/${enCours.id}/en-cours`,
          })
        }

        // ── Deliberations: published count + recent ──
        const { data: deliberations } = await supabase
          .from('deliberations')
          .select('id, numero, titre, publie_at, vote_id')
          .in('seance_id', seanceIds)
          .not('publie_at', 'is', null)
          .order('publie_at', { ascending: false })
          .limit(20)

        props.stats.deliberationsPubliees = (deliberations || []).filter(
          (d) => d.publie_at && d.publie_at >= yearStart
        ).length

        // Recent 5
        const recentDelibsRaw = (deliberations || []).slice(0, 5)
        if (recentDelibsRaw.length > 0) {
          // Get vote results for deliberations
          const voteIds = recentDelibsRaw
            .map((d) => d.vote_id)
            .filter((id): id is string => id !== null)

          let votesMap = new Map<string, string | null>()
          if (voteIds.length > 0) {
            const { data: votes } = await supabase
              .from('votes')
              .select('id, resultat')
              .in('id', voteIds)
            votesMap = new Map((votes || []).map((v) => [v.id, v.resultat]))
          }

          props.recentDelibs = recentDelibsRaw.map((d) => ({
            id: d.id,
            numero: d.numero,
            titre: d.titre,
            publie_at: d.publie_at,
            resultat: d.vote_id ? (votesMap.get(d.vote_id) || null) : null,
          }))
        }

        // ── Deliberations without affichage (> 24h) ──
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
        const { count: delibsSansAffichage } = await supabase
          .from('deliberations')
          .select('id', { count: 'exact', head: true })
          .in('seance_id', seanceIds)
          .not('publie_at', 'is', null)
          .lte('publie_at', twentyFourHoursAgo)
          .is('affiche_at', null)

        if (delibsSansAffichage && delibsSansAffichage > 0) {
          props.urgentActions.push({
            id: 'delibs-affichage',
            severity: 'amber',
            label: `${delibsSansAffichage} deliberation(s) en attente d'affichage (> 24h)`,
            href: ROUTES.DELIBERATIONS,
          })
        }

        // ── Deliberations not transmitted to prefecture (> 15 days) ──
        const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString()
        const { count: delibsSansTransmission } = await supabase
          .from('deliberations')
          .select('id', { count: 'exact', head: true })
          .in('seance_id', seanceIds)
          .not('publie_at', 'is', null)
          .lte('publie_at', fifteenDaysAgo)
          .is('transmis_prefecture_at', null)

        if (delibsSansTransmission && delibsSansTransmission > 0) {
          props.urgentActions.push({
            id: 'delibs-prefecture',
            severity: 'amber',
            label: `${delibsSansTransmission} deliberation(s) non transmise(s) a la prefecture (> 15j)`,
            href: ROUTES.DELIBERATIONS,
          })
        }

        // ── Taux de participation moyen ──
        const closedSeanceIds = (seancesPresidees || [])
          .filter((s) => ['CLOTUREE', 'ARCHIVEE'].includes(s.statut || ''))
          .map((s) => s.id)

        if (closedSeanceIds.length > 0) {
          const { data: allPresences } = await supabase
            .from('presences')
            .select('seance_id, statut')
            .in('seance_id', closedSeanceIds)

          const { data: allConvocataires } = await supabase
            .from('convocataires')
            .select('seance_id')
            .in('seance_id', closedSeanceIds)

          const presencesBySeance = new Map<string, number>()
          const convocBySeance = new Map<string, number>()

          for (const p of allPresences || []) {
            if (p.statut === 'PRESENT') {
              presencesBySeance.set(p.seance_id, (presencesBySeance.get(p.seance_id) || 0) + 1)
            }
          }
          for (const c of allConvocataires || []) {
            convocBySeance.set(c.seance_id, (convocBySeance.get(c.seance_id) || 0) + 1)
          }

          let totalRate = 0
          let countSeances = 0
          for (const sid of closedSeanceIds) {
            const presents = presencesBySeance.get(sid) || 0
            const total = convocBySeance.get(sid) || 0
            if (total > 0) {
              totalRate += (presents / total) * 100
              countSeances++
            }
          }

          props.stats.tauxParticipationMoyen =
            countSeances > 0 ? Math.round(totalRate / countSeances) : 0
        }

        // ── Quorum prediction for next upcoming seance ──
        const nextUpcoming = (seancesPresidees || []).find(
          (s) =>
            (s.statut === 'CONVOQUEE' || s.statut === 'EN_COURS') &&
            new Date(s.date_seance) >= now
        )

        if (nextUpcoming) {
          const { data: nextConvocataires } = await supabase
            .from('convocataires')
            .select('statut_convocation')
            .eq('seance_id', nextUpcoming.id)

          const totalConvocataires = nextConvocataires?.length || 0
          const confirmes = (nextConvocataires || []).filter(
            (c) => c.statut_convocation === 'CONFIRME_PRESENT'
          ).length

          // Get quorum requis from seance or estimate as majority
          const quorumRequis = nextUpcoming.statut === 'EN_COURS'
            ? 0 // Already started
            : Math.ceil(totalConvocataires / 2) + 1 // Default: majority

          // Try to get from seance data
          const { data: seanceDetail } = await supabase
            .from('seances')
            .select('quorum_requis')
            .eq('id', nextUpcoming.id)
            .single()

          props.quorumPrediction = {
            seance_id: nextUpcoming.id,
            seance_titre: nextUpcoming.titre,
            seance_date: nextUpcoming.date_seance,
            confirmes,
            totalConvocataires,
            quorumRequis: seanceDetail?.quorum_requis || quorumRequis,
          }
        }
      }
    }

    return (
      <AuthenticatedLayout>
        <PageHeader
          title={`${greeting}, ${firstName}`}
          description={`${ROLE_LABELS[role]} — Voici un resume de votre espace`}
        />
        <main className="px-4 sm:px-8 py-8 page-enter">
          <PresidentDashboard
            firstName={firstName}
            greeting={greeting}
            {...props}
          />
        </main>
      </AuthenticatedLayout>
    )
  }

  // ════════════════════════════════════════════════════════════════
  // SECRETAIRE DASHBOARD
  // ════════════════════════════════════════════════════════════════
  if (role === 'secretaire_seance') {
    const { data: memberRecord } = await supabase
      .from('members')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    const props: Omit<SecretaireDashboardProps, 'firstName' | 'greeting'> = {
      pvToRedact: [],
      upcomingSeances: [],
    }

    if (memberRecord) {
      const memberId = memberRecord.id

      // ── Seances where I am secretaire ──
      const { data: mySeances } = await supabase
        .from('seances')
        .select('id, titre, date_seance, statut, lieu, instance_config (nom)')
        .eq('secretaire_seance_id', memberId)
        .order('date_seance', { ascending: true })

      // ── PV to redact: closed seances with no PV or BROUILLON PV ──
      const closedSeances = (mySeances || []).filter((s) =>
        ['CLOTUREE'].includes(s.statut || '')
      )

      if (closedSeances.length > 0) {
        const closedIds = closedSeances.map((s) => s.id)
        const { data: pvData } = await supabase
          .from('pv')
          .select('seance_id, statut, id')
          .in('seance_id', closedIds)

        const pvMap = new Map(
          (pvData || []).map((pv) => [pv.seance_id, { statut: pv.statut, id: pv.id }])
        )

        props.pvToRedact = closedSeances
          .map((s) => {
            const pv = pvMap.get(s.id)
            // Show if no PV or PV is still in BROUILLON
            if (!pv || pv.statut === 'BROUILLON') {
              return {
                seance_id: s.id,
                seance_titre: s.titre,
                seance_date: s.date_seance,
                pv_statut: pv?.statut || null,
                pv_id: pv?.id || null,
              }
            }
            return null
          })
          .filter((item): item is NonNullable<typeof item> => item !== null)
      }

      // ── Upcoming seances ──
      props.upcomingSeances = (mySeances || [])
        .filter(
          (s) =>
            new Date(s.date_seance) >= now ||
            s.statut === 'EN_COURS'
        )
        .map((s) => ({
          id: s.id,
          titre: s.titre,
          date_seance: s.date_seance,
          statut: s.statut,
          instance_nom: (s.instance_config as { nom: string } | null)?.nom || null,
          lieu: s.lieu,
        }))
    }

    return (
      <AuthenticatedLayout>
        <PageHeader
          title={`${greeting}, ${firstName}`}
          description={`${ROLE_LABELS[role]} — Voici un resume de votre espace`}
        />
        <main className="px-4 sm:px-8 py-8 page-enter">
          <SecretaireDashboard
            firstName={firstName}
            greeting={greeting}
            {...props}
          />
        </main>
      </AuthenticatedLayout>
    )
  }

  // ════════════════════════════════════════════════════════════════
  // GESTIONNAIRE / SUPER ADMIN DASHBOARD
  // ════════════════════════════════════════════════════════════════
  let isConfigured = false
  const isSuperAdmin = role === 'super_admin'

  try {
    const { data: configData } = await supabase
      .from('institution_config')
      .select('id')
      .limit(1)
      .maybeSingle()
    isConfigured = !!configData
  } catch {
    // Continue with defaults
  }

  // ── Stats (real data) ──
  const { count: seancesThisMonth } = await supabase
    .from('seances')
    .select('id', { count: 'exact', head: true })
    .gte('date_seance', monthStart)

  const { count: delibsThisMonth } = await supabase
    .from('deliberations')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', monthStart)

  const { count: membresActifs } = await supabase
    .from('members')
    .select('id', { count: 'exact', head: true })
    .eq('statut', 'ACTIF')

  const { count: pvBrouillonCount } = await supabase
    .from('pv')
    .select('id', { count: 'exact', head: true })
    .in('statut', ['BROUILLON', 'EN_RELECTURE'])

  const gestionnaireStats: GestionnaireDashboardProps['stats'] = {
    seancesCeMois: seancesThisMonth || 0,
    deliberationsCeMois: delibsThisMonth || 0,
    pvEnAttente: pvBrouillonCount || 0,
    membresActifs: membresActifs || 0,
  }

  // ── Build tasks ──
  const tasks: GestionnaireDashboardProps['tasks'] = []

  // Task: Seances < 3 days without convocations sent
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString()
  const { data: soonSeances } = await supabase
    .from('seances')
    .select('id, titre, statut')
    .in('statut', ['BROUILLON', 'CONVOQUEE'])
    .gte('date_seance', now.toISOString().slice(0, 10))
    .lte('date_seance', threeDaysFromNow)

  if (soonSeances) {
    for (const s of soonSeances) {
      if (s.statut === 'BROUILLON') {
        // Check if convocations sent
        const { count: convSent } = await supabase
          .from('convocataires')
          .select('id', { count: 'exact', head: true })
          .eq('seance_id', s.id)
          .neq('statut_convocation', 'NON_ENVOYE')

        if (!convSent || convSent === 0) {
          tasks.push({
            id: `conv-urgent-${s.id}`,
            severity: 'red',
            icon: <Mail className="h-5 w-5" />,
            label: `"${s.titre}" dans < 3 jours sans convocations envoyees`,
            action_label: 'Envoyer',
            href: `/seances/${s.id}`,
          })
        }
      }
    }
  }

  // Task: Seances CLOTUREE without PV
  const { data: closedSeances } = await supabase
    .from('seances')
    .select('id, titre')
    .eq('statut', 'CLOTUREE')

  if (closedSeances) {
    const closedIds = closedSeances.map((s) => s.id)
    if (closedIds.length > 0) {
      const { data: existingPV } = await supabase
        .from('pv')
        .select('seance_id')
        .in('seance_id', closedIds)

      const pvSeanceIds = new Set((existingPV || []).map((p) => p.seance_id))

      for (const s of closedSeances) {
        if (!pvSeanceIds.has(s.id)) {
          tasks.push({
            id: `pv-missing-${s.id}`,
            severity: 'red',
            icon: <PenLine className="h-5 w-5" />,
            label: `"${s.titre}" cloturee sans PV`,
            action_label: 'Rediger',
            href: `/seances/${s.id}/pv`,
          })
        }
      }
    }
  }

  // Task: PV BROUILLON not sent for review
  const { data: pvBrouillons } = await supabase
    .from('pv')
    .select('seance_id, statut')
    .eq('statut', 'BROUILLON')

  if (pvBrouillons) {
    for (const pv of pvBrouillons) {
      tasks.push({
        id: `pv-brouillon-${pv.seance_id}`,
        severity: 'amber',
        icon: <Send className="h-5 w-5" />,
        label: `PV en brouillon a envoyer en relecture`,
        action_label: 'Relecture',
        href: `/seances/${pv.seance_id}/pv`,
      })
    }
  }

  // Task: Deliberations BROUILLON (not published)
  const { data: delibsBrouillon } = await supabase
    .from('deliberations')
    .select('id, titre, seance_id')
    .is('publie_at', null)
    .is('annulee', null)
    .limit(5)

  if (delibsBrouillon) {
    for (const d of delibsBrouillon) {
      tasks.push({
        id: `delib-brouillon-${d.id}`,
        severity: 'amber',
        icon: <FileText className="h-5 w-5" />,
        label: `Deliberation "${d.titre}" a publier`,
        action_label: 'Publier',
        href: ROUTES.DELIBERATIONS,
      })
    }
  }

  // Task: Deliberations published > 24h without affichage
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const { count: delibsSansAffichage } = await supabase
    .from('deliberations')
    .select('id', { count: 'exact', head: true })
    .not('publie_at', 'is', null)
    .lte('publie_at', twentyFourHoursAgo)
    .is('affiche_at', null)

  if (delibsSansAffichage && delibsSansAffichage > 0) {
    tasks.push({
      id: 'delibs-affichage',
      severity: 'amber',
      icon: <Eye className="h-5 w-5" />,
      label: `${delibsSansAffichage} deliberation(s) publiee(s) > 24h sans affichage`,
      action_label: 'Afficher',
      href: ROUTES.DELIBERATIONS,
    })
  }

  // Task: Seances BROUILLON without ODJ
  const { data: brouillonSeances } = await supabase
    .from('seances')
    .select('id, titre')
    .eq('statut', 'BROUILLON')
    .gte('date_seance', now.toISOString().slice(0, 10))

  if (brouillonSeances) {
    for (const s of brouillonSeances) {
      const { count: odjCount } = await supabase
        .from('odj_points')
        .select('id', { count: 'exact', head: true })
        .eq('seance_id', s.id)

      if (!odjCount || odjCount === 0) {
        tasks.push({
          id: `odj-missing-${s.id}`,
          severity: 'blue',
          icon: <ClipboardList className="h-5 w-5" />,
          label: `"${s.titre}" sans ordre du jour`,
          action_label: 'Preparer',
          href: `/seances/${s.id}`,
        })
      }

      const { count: convCount } = await supabase
        .from('convocataires')
        .select('id', { count: 'exact', head: true })
        .eq('seance_id', s.id)

      if (!convCount || convCount === 0) {
        tasks.push({
          id: `conv-missing-${s.id}`,
          severity: 'blue',
          icon: <Users className="h-5 w-5" />,
          label: `"${s.titre}" sans convocataires`,
          action_label: 'Ajouter',
          href: `/seances/${s.id}`,
        })
      }
    }
  }

  // Sort tasks: red first, then amber, then blue
  const severityOrder = { red: 0, amber: 1, blue: 2 }
  tasks.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

  // ── Upcoming seances with prep status ──
  const upcomingSeances: GestionnaireDashboardProps['upcomingSeances'] = []

  const { data: allUpcoming } = await supabase
    .from('seances')
    .select('id, titre, date_seance, statut, instance_config (nom)')
    .in('statut', ['BROUILLON', 'CONVOQUEE', 'EN_COURS'])
    .gte('date_seance', now.toISOString().slice(0, 10))
    .order('date_seance', { ascending: true })
    .limit(3)

  if (allUpcoming) {
    for (const s of allUpcoming) {
      const { count: odjCount } = await supabase
        .from('odj_points')
        .select('id', { count: 'exact', head: true })
        .eq('seance_id', s.id)

      const { count: convCount } = await supabase
        .from('convocataires')
        .select('id', { count: 'exact', head: true })
        .eq('seance_id', s.id)

      const { count: convSentCount } = await supabase
        .from('convocataires')
        .select('id', { count: 'exact', head: true })
        .eq('seance_id', s.id)
        .neq('statut_convocation', 'NON_ENVOYE')

      const hasOdj = (odjCount || 0) > 0
      const hasConv = (convCount || 0) > 0
      const convSent = hasConv && (convSentCount || 0) > 0

      let prepPercent = 0
      if (hasOdj) prepPercent += 33
      if (hasConv) prepPercent += 33
      if (convSent) prepPercent += 34

      upcomingSeances.push({
        id: s.id,
        titre: s.titre,
        date_seance: s.date_seance,
        instance_nom: (s.instance_config as { nom: string } | null)?.nom || null,
        statut: s.statut,
        has_odj: hasOdj,
        has_convocataires: hasConv,
        convocations_envoyees: convSent,
        preparation_percent: prepPercent,
      })
    }
  }

  return (
    <AuthenticatedLayout>
      <PageHeader
        title={`${greeting}, ${firstName}`}
        description={`${ROLE_LABELS[role]} — Voici un resume de votre espace`}
      />
      <main className="px-4 sm:px-8 py-8 page-enter">
        <GestionnaireDashboard
          firstName={firstName}
          greeting={greeting}
          isConfigured={isConfigured}
          isSuperAdmin={isSuperAdmin}
          tasks={tasks}
          upcomingSeances={upcomingSeances}
          stats={gestionnaireStats}
        />
      </main>
    </AuthenticatedLayout>
  )
}
