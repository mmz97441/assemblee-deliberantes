'use client'

import { useMemo, useEffect, useState, useRef, useCallback } from 'react'
import { useAutoRefresh } from '@/lib/hooks/use-auto-refresh'
import { useRealtime } from '@/lib/hooks/use-realtime'
import {
  Landmark,
  Clock,
  Users,
  Vote,
  CheckCircle2,
  Lock,
  Timer,
  Circle,
  Play,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ODJPoint {
  id: string
  titre: string
  position: number | null
  type_traitement: string | null
  statut: string | null
  huis_clos: boolean | null
  huis_clos_active: boolean | null
  majorite_requise: string | null
  votes_interdits: boolean | null
  description: string | null
}

interface VoteInfo {
  id: string
  odj_point_id: string
  type_vote: string | null
  statut: string | null
  resultat: string | null
  pour: number | null
  contre: number | null
  abstention: number | null
  total_votants: number | null
  ouvert_at: string | null
  clos_at: string | null
  question: string | null
}

interface SeanceData {
  id: string
  titre: string
  date_seance: string
  statut: string | null
  lieu: string | null
  heure_ouverture: string | null
  heure_cloture: string | null
  publique: boolean | null
  instance_config: { id: string; nom: string; type_legal: string } | null
  odj_points: ODJPoint[]
  votes: VoteInfo[]
}

interface PublicSessionViewProps {
  seance: SeanceData
  institutionName: string
  presenceCount: number
  totalConvocataires: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(startDate: Date, now: Date): string {
  const diffMs = now.getTime() - startDate.getTime()
  if (diffMs < 0) return '0 min'
  const totalMin = Math.floor(diffMs / 60000)
  const hours = Math.floor(totalMin / 60)
  const minutes = totalMin % 60
  if (hours > 0) return `${hours}h ${minutes.toString().padStart(2, '0')}min`
  return `${minutes} min`
}

function formatResultat(vote: VoteInfo): string {
  if (!vote.resultat) return ''
  switch (vote.resultat) {
    case 'ADOPTE_UNANIMITE':
      return `Adopté à l’unanimité`
    case 'ADOPTE':
      if (vote.pour != null && vote.contre != null && vote.abstention != null) {
        return `Adopté (${vote.pour}-${vote.contre}-${vote.abstention})`
      }
      return 'Adopté'
    case 'REJETE':
      if (vote.pour != null && vote.contre != null && vote.abstention != null) {
        return `Rejeté (${vote.pour}-${vote.contre}-${vote.abstention})`
      }
      return 'Rejeté'
    case 'EGALITE':
      return 'Égalité des voix'
    default:
      return vote.resultat
  }
}

const RESULTAT_COLORS: Record<string, string> = {
  ADOPTE_UNANIMITE: 'text-emerald-400',
  ADOPTE: 'text-emerald-400',
  REJETE: 'text-red-400',
  EGALITE: 'text-amber-400',
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PublicSessionView({
  seance,
  institutionName,
  presenceCount,
  totalConvocataires,
}: PublicSessionViewProps) {
  const [currentTime, setCurrentTime] = useState<Date | null>(null)
  const [recentVoteResult, setRecentVoteResult] = useState<VoteInfo | null>(null)
  const currentPointRef = useRef<HTMLDivElement>(null)
  const prevVotesRef = useRef<string>('')

  // ─── Live clock ──────────────────────────────────────────────────────
  useEffect(() => {
    setCurrentTime(new Date())
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // ─── Screen Wake Lock ────────────────────────────────────────────────
  useEffect(() => {
    let wakeLock: WakeLockSentinel | null = null
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await navigator.wakeLock.request('screen')
        }
      } catch {
        // Wake Lock non supporté ou refusé
      }
    }
    requestWakeLock()
    // Re-acquire on visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      wakeLock?.release()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  // ─── Realtime subscription ───────────────────────────────────────────
  const { isConnected: isRealtimeConnected } = useRealtime({
    channel: `public-${seance.id}`,
    tables: ['votes', 'odj_points', 'presences'],
    filter: `seance_id=eq.${seance.id}`,
    enabled: true,
  })

  // ─── Polling fallback ────────────────────────────────────────────────
  const pollingEnabled = !isRealtimeConnected
  useAutoRefresh({ intervalMs: 5000, enabled: pollingEnabled })
  const isPolling = pollingEnabled

  // ─── Sorted points ──────────────────────────────────────────────────
  const sortedPoints = useMemo(
    () => [...seance.odj_points].sort((a, b) => (a.position || 0) - (b.position || 0)),
    [seance.odj_points]
  )

  // ─── Current active point ───────────────────────────────────────────
  const currentPoint = useMemo(
    () => sortedPoints.find(p => p.statut === 'EN_DISCUSSION') || null,
    [sortedPoints]
  )

  // ─── Detect recent vote closure → animate result ────────────────────
  const closedVotes = useMemo(
    () => seance.votes.filter(v => v.statut === 'CLOS' && v.resultat),
    [seance.votes]
  )

  useEffect(() => {
    const currentKey = closedVotes.map(v => v.id).sort().join(',')
    if (prevVotesRef.current && currentKey !== prevVotesRef.current) {
      // Find the new vote
      const prevIds = new Set(prevVotesRef.current.split(','))
      const newVote = closedVotes.find(v => !prevIds.has(v.id))
      if (newVote) {
        setRecentVoteResult(newVote)
        const timer = setTimeout(() => setRecentVoteResult(null), 8000)
        return () => clearTimeout(timer)
      }
    }
    prevVotesRef.current = currentKey
  }, [closedVotes])

  // ─── Auto-scroll to current point ───────────────────────────────────
  useEffect(() => {
    if (currentPointRef.current) {
      currentPointRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [currentPoint?.id])

  // ─── Vote lookup helper ─────────────────────────────────────────────
  const getVoteForPoint = useCallback(
    (pointId: string): VoteInfo | undefined =>
      seance.votes.find(v => v.odj_point_id === pointId && v.statut === 'CLOS'),
    [seance.votes]
  )

  const getOpenVoteForPoint = useCallback(
    (pointId: string): VoteInfo | undefined =>
      seance.votes.find(v => v.odj_point_id === pointId && v.statut === 'OUVERT'),
    [seance.votes]
  )

  const anyOpenVote = useMemo(
    () => seance.votes.find(v => v.statut === 'OUVERT') || null,
    [seance.votes]
  )

  // ─── Status flags ──────────────────────────────────────────────────
  const isEnCours = seance.statut === 'EN_COURS'
  const isSuspendue = seance.statut === 'SUSPENDUE'
  const isCloturee = seance.statut === 'CLOTUREE' || seance.statut === 'ARCHIVEE'

  // ─── Date formatting ────────────────────────────────────────────────
  const dateStr = (() => {
    try {
      return new Date(seance.date_seance).toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    } catch {
      return seance.date_seance
    }
  })()

  const heureOuverture = seance.heure_ouverture
    ? new Date(seance.heure_ouverture).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : null

  const sessionDuration = currentTime && seance.heure_ouverture && isEnCours
    ? formatDuration(new Date(seance.heure_ouverture), currentTime)
    : null

  // ─── Huis clos on current point ─────────────────────────────────────
  const isHuisClosActive = currentPoint?.huis_clos_active === true

  // ─── Point status helpers ───────────────────────────────────────────
  function getPointIcon(point: ODJPoint) {
    if (point.statut === 'TRAITE') {
      const vote = getVoteForPoint(point.id)
      if (vote?.resultat?.startsWith('ADOPTE')) {
        return <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
      }
      if (vote?.resultat === 'REJETE') {
        return <CheckCircle2 className="h-5 w-5 text-red-400 shrink-0" />
      }
      return <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
    }
    if (point.statut === 'EN_DISCUSSION') {
      return <Play className="h-5 w-5 text-blue-400 animate-pulse shrink-0" />
    }
    if (point.huis_clos) {
      return <Lock className="h-5 w-5 text-white/30 shrink-0" />
    }
    return <Circle className="h-5 w-5 text-white/20 shrink-0" />
  }

  // ─── Render: Not started ────────────────────────────────────────────
  if (!isEnCours && !isSuspendue && !isCloturee) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-6 sm:p-12">
        <div className="flex items-center gap-4 sm:gap-6 mb-8 sm:mb-12">
          <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl bg-white/10 border border-white/20">
            <Landmark className="h-10 w-10 sm:h-12 sm:w-12 text-white/80" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight">{institutionName}</h1>
            <p className="text-lg sm:text-2xl text-white/70 mt-1">{seance.instance_config?.nom}</p>
          </div>
        </div>
        <h2 className="text-xl sm:text-3xl lg:text-4xl font-semibold text-center max-w-3xl leading-tight mb-6">
          {seance.titre}
        </h2>
        <div className="flex items-center gap-3 text-lg sm:text-2xl text-white/70 mb-12">
          <Clock className="h-6 w-6" />
          <span className="capitalize">{dateStr}</span>
        </div>
        <div className="bg-white/10 border border-white/20 rounded-2xl px-8 sm:px-12 py-4 sm:py-6">
          <p className="text-xl sm:text-2xl text-white/70">La séance n&apos;a pas encore commencé</p>
        </div>
      </div>
    )
  }

  // ─── Render: Clôturée ───────────────────────────────────────────────
  if (isCloturee) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-6 sm:p-12">
        <div className="flex items-center gap-4 sm:gap-6 mb-8 sm:mb-12">
          <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl bg-white/10 border border-white/20">
            <Landmark className="h-10 w-10 sm:h-12 sm:w-12 text-white/80" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight">{institutionName}</h1>
            <p className="text-lg sm:text-2xl text-white/70 mt-1">{seance.instance_config?.nom}</p>
          </div>
        </div>
        <div className="bg-purple-500/20 border-2 border-purple-400 rounded-2xl px-8 sm:px-12 py-4 sm:py-6 mb-6">
          <p className="text-3xl sm:text-5xl font-bold text-purple-300">SÉANCE CLÔTURÉE</p>
        </div>

        {/* Résumé des votes */}
        <div className="w-full max-w-2xl mt-8 space-y-2">
          {sortedPoints.map((point) => {
            const vote = getVoteForPoint(point.id)
            return (
              <div key={point.id} className="flex items-center gap-3 px-4 py-2 rounded-lg bg-white/5">
                <span className="text-white/50 text-sm font-mono w-6 text-right">{point.position}.</span>
                <span className="flex-1 text-sm text-white/80 truncate">{point.titre}</span>
                {vote && (
                  <span className={`text-xs font-medium ${RESULTAT_COLORS[vote.resultat || ''] || 'text-white/60'}`}>
                    {formatResultat(vote)}
                  </span>
                )}
              </div>
            )
          })}
        </div>
        <p className="text-lg text-white/50 mt-8">Merci de votre participation</p>
      </div>
    )
  }

  // ─── Render: Suspendue ──────────────────────────────────────────────
  if (isSuspendue) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-6 sm:p-12">
        <div className="flex items-center gap-4 sm:gap-6 mb-8 sm:mb-12">
          <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl bg-white/10 border border-white/20">
            <Landmark className="h-10 w-10 sm:h-12 sm:w-12 text-white/80" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight">{institutionName}</h1>
            <p className="text-lg sm:text-2xl text-white/70 mt-1">{seance.instance_config?.nom}</p>
          </div>
        </div>
        <div className="bg-amber-500/20 border-2 border-amber-400 rounded-2xl px-8 sm:px-12 py-4 sm:py-6">
          <p className="text-3xl sm:text-5xl font-bold text-amber-300 animate-pulse">SÉANCE SUSPENDUE</p>
        </div>
        <p className="text-lg sm:text-xl text-white/60 mt-6">La séance reprendra prochainement</p>
        {/* Realtime indicator */}
        <div className="fixed bottom-4 right-4">
          <span
            className={`h-2.5 w-2.5 rounded-full inline-block ${
              isRealtimeConnected ? 'bg-emerald-400' : isPolling ? 'bg-amber-400 animate-ping' : 'bg-white/20'
            }`}
            title={isRealtimeConnected ? 'Temps réel actif' : isPolling ? 'Rafraîchissement automatique' : 'Hors ligne'}
          />
        </div>
      </div>
    )
  }

  // ─── Render: En cours — Huis clos overlay ───────────────────────────
  if (isHuisClosActive) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-6 sm:p-12">
        <Lock className="h-24 w-24 sm:h-32 sm:w-32 text-red-400 mb-8 sm:mb-12" />
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6 text-center">
          SÉANCE À HUIS CLOS
        </h1>
        <p className="text-xl sm:text-2xl text-white/70 text-center max-w-2xl">
          La séance se poursuit à huis clos. Les débats ne sont pas publics.
        </p>
        {/* Realtime indicator */}
        <div className="fixed bottom-4 right-4">
          <span
            className={`h-2.5 w-2.5 rounded-full inline-block ${
              isRealtimeConnected ? 'bg-emerald-400' : isPolling ? 'bg-amber-400 animate-ping' : 'bg-white/20'
            }`}
            title={isRealtimeConnected ? 'Temps réel actif' : 'Rafraîchissement automatique'}
          />
        </div>
      </div>
    )
  }

  // ─── Render: En cours — Vue principale ──────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col text-white">
      {/* Header */}
      <header className="px-4 sm:px-8 lg:px-12 py-4 sm:py-6 border-b border-white/10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-white/10 border border-white/15 shrink-0">
              <Landmark className="h-6 w-6 sm:h-7 sm:w-7 text-white/80" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl lg:text-2xl font-bold tracking-tight truncate">{institutionName}</h1>
              <p className="text-sm sm:text-base text-white/70 truncate">
                {seance.instance_config?.nom} — <span className="capitalize">{dateStr}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 sm:gap-6 text-sm sm:text-base">
            {sessionDuration && (
              <div className="flex items-center gap-2 text-white/70">
                <Timer className="h-4 w-4" />
                <span>En cours depuis {sessionDuration}</span>
              </div>
            )}
            <div className="flex items-center gap-2 bg-white/10 rounded-full px-3 py-1.5">
              <Users className="h-4 w-4 text-white/70" />
              <span className="font-semibold">{presenceCount}</span>
              <span className="text-white/50">/ {totalConvocataires}</span>
              <span className="text-white/50 hidden sm:inline">présents</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 px-4 sm:px-8 lg:px-12 py-6 sm:py-8 overflow-y-auto">
        {/* Vote en cours overlay */}
        {anyOpenVote && (
          <div className="mb-6 bg-blue-600/20 border border-blue-400/40 rounded-xl px-4 sm:px-6 py-4 animate-pulse">
            <div className="flex items-center gap-3">
              <Vote className="h-6 w-6 text-blue-400" />
              <div>
                <p className="text-lg sm:text-xl font-semibold text-blue-300">Vote en cours</p>
                {anyOpenVote.question && (
                  <p className="text-sm text-blue-200/80 mt-0.5">{anyOpenVote.question}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Résultat récent — animation fade-in */}
        {recentVoteResult && (
          <div className="mb-6 bg-emerald-600/20 border border-emerald-400/40 rounded-xl px-4 sm:px-6 py-4 animate-in fade-in duration-700">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-emerald-400" />
              <div>
                <p className="text-lg font-semibold text-emerald-300">
                  Résultat : {formatResultat(recentVoteResult)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Ordre du jour */}
        <h2 className="text-xs sm:text-sm font-semibold text-white/50 uppercase tracking-wider mb-4">
          Ordre du jour
        </h2>

        <div className="space-y-1.5 sm:space-y-2">
          {sortedPoints.map((point) => {
            const isCurrent = point.id === currentPoint?.id
            const isTraite = point.statut === 'TRAITE'
            const vote = getVoteForPoint(point.id)
            const openVote = getOpenVoteForPoint(point.id)

            return (
              <div
                key={point.id}
                ref={isCurrent ? currentPointRef : undefined}
                className={`
                  flex items-start gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg transition-all
                  ${isCurrent
                    ? 'bg-blue-600/20 border border-blue-400/30 ring-1 ring-blue-400/20'
                    : isTraite
                      ? 'bg-white/[0.03]'
                      : 'bg-white/[0.02]'
                  }
                `}
              >
                {/* Position */}
                <span className="text-white/40 text-sm font-mono w-5 sm:w-6 text-right pt-0.5 shrink-0">
                  {point.position}.
                </span>

                {/* Icon */}
                <div className="pt-0.5">
                  {getPointIcon(point)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm sm:text-base leading-snug ${
                    isCurrent ? 'text-white font-semibold' : isTraite ? 'text-white/60' : 'text-white/80'
                  }`}>
                    {point.titre}
                  </p>

                  {/* Status line */}
                  {isCurrent && !openVote && (
                    <p className="text-xs sm:text-sm text-blue-300 mt-1 flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
                      En discussion
                    </p>
                  )}

                  {openVote && (
                    <p className="text-xs sm:text-sm text-blue-300 mt-1 flex items-center gap-1.5">
                      <Vote className="h-3.5 w-3.5" />
                      Vote en cours
                    </p>
                  )}

                  {point.huis_clos && !isCurrent && (
                    <p className="text-xs text-white/30 mt-0.5 flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      Huis clos
                    </p>
                  )}
                </div>

                {/* Result badge */}
                {vote && (
                  <span className={`text-xs sm:text-sm font-medium shrink-0 pt-0.5 ${
                    RESULTAT_COLORS[vote.resultat || ''] || 'text-white/50'
                  }`}>
                    {formatResultat(vote)}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </main>

      {/* Footer */}
      <footer className="px-4 sm:px-8 lg:px-12 py-3 border-t border-white/10 flex items-center justify-between text-xs sm:text-sm text-white/40">
        <div className="flex items-center gap-2">
          {heureOuverture && <span>Séance ouverte à {heureOuverture}</span>}
          <span className="hidden sm:inline">•</span>
          <span className="hidden sm:inline">{seance.publique !== false ? 'Séance publique' : 'Séance restreinte'}</span>
        </div>
        {/* Realtime indicator */}
        <span
          className={`h-2 w-2 rounded-full transition-all ${
            isRealtimeConnected
              ? 'bg-emerald-400'
              : isPolling
                ? 'bg-amber-400 animate-ping'
                : 'bg-white/20'
          }`}
          title={
            isRealtimeConnected
              ? 'Temps réel — mises à jour instantanées'
              : isPolling
                ? 'Rafraîchissement automatique (5s)'
                : 'Pas de mise à jour automatique'
          }
        />
      </footer>
    </div>
  )
}
