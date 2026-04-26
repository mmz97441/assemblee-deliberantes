'use client'

import { useMemo, useEffect, useState, useCallback } from 'react'
import { useAutoRefresh } from '@/lib/hooks/use-auto-refresh'
import { useRealtime } from '@/lib/hooks/use-realtime'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
} from '@/components/ui/alert-dialog'
import {
  Landmark,
  Clock,
  Users,
  Vote,
  ChevronLeft,
  ChevronRight,
  Shield,
  Timer,
  Pause,
  Hand,
  CheckCircle2,
  Eye,
  Lock,
  FileText,
  MessageSquare,
  Info,
} from 'lucide-react'
import type { ODJPointRow } from '@/lib/supabase/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MemberInfo {
  id: string
  prenom: string
  nom: string
  email: string
  qualite_officielle: string | null
}

interface PresenceItem {
  id: string
  member_id: string
  statut: string | null
  heure_arrivee: string | null
  heure_depart: string | null
  mode_authentification: string | null
}

interface InstanceConfig {
  id: string
  nom: string
  type_legal: string
  quorum_type: string | null
  quorum_fraction_numerateur: number | null
  quorum_fraction_denominateur: number | null
  composition_max: number | null
  majorite_defaut: string | null
  voix_preponderante: boolean | null
}

interface VoteItem {
  id: string
  odj_point_id: string
  type_vote: string | null
  statut: string | null
  pour: number | null
  contre: number | null
  abstention: number | null
  total_votants: number | null
  resultat: string | null
  formule_pv: string | null
  ouvert_at: string | null
  clos_at: string | null
  question: string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface SeanceData extends Record<string, any> {
  id: string
  titre: string
  date_seance: string
  statut: string | null
  instance_id: string
  lieu: string | null
  mode: string | null
  publique: boolean | null
  heure_ouverture: string | null
  heure_cloture: string | null
  notes: string | null
  reconvocation: boolean | null
  instance_config: InstanceConfig | null
  odj_points: ODJPointRow[]
  convocataires: { id: string; member_id: string; member: MemberInfo | null }[]
  presences: PresenceItem[]
  president_effectif: { id: string; prenom: string; nom: string } | null
  secretaire_seance: { id: string; prenom: string; nom: string } | null
  votes: VoteItem[]
}

interface PresidentTabletProps {
  seance: SeanceData
  instanceMemberCount: number
  institutionName: string
}

interface DemandeParole {
  memberId: string
  memberName: string
  timestamp: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(startDate: Date, now: Date): string {
  const diffMs = now.getTime() - startDate.getTime()
  if (diffMs < 0) return '0 min'
  const totalMin = Math.floor(diffMs / 60000)
  const hours = Math.floor(totalMin / 60)
  const minutes = totalMin % 60
  if (hours > 0) return `${hours}h${minutes.toString().padStart(2, '0')}`
  return `${minutes} min`
}

function formatResultat(vote: VoteItem): string {
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

const MAJORITE_LABELS: Record<string, string> = {
  SIMPLE: 'Majorité simple',
  ABSOLUE: 'Majorité absolue',
  QUALIFIEE: 'Majorité qualifiée (2/3)',
  UNANIMITE: 'Unanimité requise',
}

const TYPE_LABELS: Record<string, string> = {
  DELIBERATION: 'Délibération',
  INFORMATION: 'Information',
  QUESTION_DIVERSE: 'Question diverse',
  ELECTION: 'Élection',
  APPROBATION_PV: 'Approbation PV',
}

function calculateQuorum(
  presences: PresenceItem[],
  totalMembers: number,
  config: InstanceConfig | null
) {
  const presents = presences.filter(
    p => (p.statut === 'PRESENT' || p.statut === 'PROCURATION') && !p.heure_depart
  ).length
  const total = config?.composition_max || totalMembers
  const quorumType = config?.quorum_type || 'MAJORITE_MEMBRES'
  const num = config?.quorum_fraction_numerateur || 1
  const den = config?.quorum_fraction_denominateur || 2

  let required: number

  switch (quorumType) {
    case 'MAJORITE_MEMBRES':
      required = Math.floor(total / 2) + 1; break
    case 'TIERS_MEMBRES':
      required = Math.ceil(total / 3); break
    case 'DEUX_TIERS':
      required = Math.ceil((total * 2) / 3); break
    case 'STATUTS':
      required = Math.ceil((total * num) / den); break
    default:
      required = Math.floor(total / 2) + 1
  }

  return { presents, total, required, reached: presents >= required }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PresidentTablet({ seance, instanceMemberCount, institutionName }: PresidentTabletProps) {
  const [currentTime, setCurrentTime] = useState<Date | null>(null)
  const [viewIndex, setViewIndex] = useState(0)
  const [demandesParole, setDemandesParole] = useState<DemandeParole[]>([])
  const [showSuspendDialog, setShowSuspendDialog] = useState(false)

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
        // Pas supporté
      }
    }
    requestWakeLock()
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') requestWakeLock()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      wakeLock?.release()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  // ─── Sort points ────────────────────────────────────────────────────
  const sortedPoints = useMemo(
    () => [...seance.odj_points].sort((a, b) => (a.position || 0) - (b.position || 0)),
    [seance.odj_points]
  )

  // ─── Auto-detect active point for initial viewIndex ─────────────────
  useEffect(() => {
    const activeIdx = sortedPoints.findIndex(p => p.statut === 'EN_DISCUSSION')
    if (activeIdx >= 0) {
      setViewIndex(activeIdx)
    }
  }, [sortedPoints])

  const totalPoints = sortedPoints.length
  const currentViewPoint = sortedPoints[viewIndex] || null

  // ─── Find the actual active point (managed by gestionnaire) ─────────
  const activePoint = useMemo(
    () => sortedPoints.find(p => p.statut === 'EN_DISCUSSION') || null,
    [sortedPoints]
  )

  // ─── Quorum ─────────────────────────────────────────────────────────
  const quorum = calculateQuorum(seance.presences, instanceMemberCount, seance.instance_config)

  // ─── Vote for current view point ────────────────────────────────────
  const currentVote = useMemo(() => {
    if (!currentViewPoint) return null
    return seance.votes.find(v => v.odj_point_id === currentViewPoint.id) || null
  }, [currentViewPoint, seance.votes])

  const anyOpenVote = useMemo(
    () => seance.votes.find(v => v.statut === 'OUVERT') || null,
    [seance.votes]
  )

  // ─── Rapporteur lookup ──────────────────────────────────────────────
  const rapporteur = useMemo(() => {
    if (!currentViewPoint) return null
    const rapporteurId = (currentViewPoint as Record<string, unknown>).rapporteur_id as string | undefined
    if (!rapporteurId) return null
    const conv = seance.convocataires.find(c => c.member_id === rapporteurId)
    return conv?.member || null
  }, [currentViewPoint, seance.convocataires])

  const isVotable = currentViewPoint && !currentViewPoint.votes_interdits && (
    currentViewPoint.type_traitement === 'DELIBERATION' ||
    currentViewPoint.type_traitement === 'ELECTION' ||
    currentViewPoint.type_traitement === 'APPROBATION_PV'
  )

  // ─── Realtime subscription ───────────────────────────────────────────
  const { isConnected: isRealtimeConnected } = useRealtime({
    channel: `president-rt-${seance.id}`,
    tables: ['votes', 'odj_points', 'presences'],
    filter: `seance_id=eq.${seance.id}`,
    enabled: true,
  })

  // ─── Polling fallback ────────────────────────────────────────────────
  const pollingEnabled = !isRealtimeConnected
  useAutoRefresh({ intervalMs: 5000, enabled: pollingEnabled })

  // ─── Demandes de parole — broadcast listener ─────────────────────────
  useEffect(() => {
    const isLive = seance.statut === 'EN_COURS'
    if (!isLive) return

    const supabase = createClient()
    const channel = supabase.channel(`parole-${seance.id}`)

    channel.on('broadcast', { event: 'demande_parole' }, (payload) => {
      const data = payload.payload as { memberId: string; memberName: string; action: string; timestamp: string }
      if (data.action === 'request') {
        setDemandesParole(prev => {
          if (prev.some(d => d.memberId === data.memberId)) return prev
          return [...prev, { memberId: data.memberId, memberName: data.memberName, timestamp: data.timestamp }]
        })
        toast.info(`${data.memberName} demande la parole`, { duration: 5000, icon: '✋' })
      } else if (data.action === 'cancel') {
        setDemandesParole(prev => prev.filter(d => d.memberId !== data.memberId))
      }
    })

    channel.subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [seance.id, seance.statut])

  // ─── President broadcast actions ─────────────────────────────────────
  const sendPresidentRequest = useCallback(
    (action: string, pointId?: string) => {
      const supabase = createClient()
      const channel = supabase.channel(`president-${seance.id}`)

      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.send({
            type: 'broadcast',
            event: 'president_request',
            payload: { action, pointId },
          })
          setTimeout(() => supabase.removeChannel(channel), 500)
        }
      })
    },
    [seance.id]
  )

  const handleRequestVote = useCallback(() => {
    if (!currentViewPoint) return
    sendPresidentRequest('request_vote', currentViewPoint.id)
    toast.success('Demande de vote envoyée au gestionnaire')
  }, [currentViewPoint, sendPresidentRequest])

  const handleRequestSuspend = useCallback(() => {
    sendPresidentRequest('request_suspend')
    toast.success('Demande de suspension envoyée')
    setShowSuspendDialog(false)
  }, [sendPresidentRequest])

  const handleDismissParole = useCallback((memberId: string, memberName: string) => {
    setDemandesParole(prev => prev.filter(d => d.memberId !== memberId))

    // Broadcast that parole was granted
    const supabase = createClient()
    const channel = supabase.channel(`parole-${seance.id}`)
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel.send({
          type: 'broadcast',
          event: 'demande_parole',
          payload: { memberId, memberName, action: 'granted', timestamp: new Date().toISOString() },
        })
        // Cleanup after a short delay to ensure message is sent
        setTimeout(() => supabase.removeChannel(channel), 500)
      }
    })
  }, [seance.id])

  // ─── Session state ──────────────────────────────────────────────────
  const isEnCours = seance.statut === 'EN_COURS'
  const isSuspendue = seance.statut === 'SUSPENDUE'
  const isCloturee = seance.statut === 'CLOTUREE' || seance.statut === 'ARCHIVEE'

  // ─── Duration calculations ──────────────────────────────────────────
  const sessionDuration = currentTime && seance.heure_ouverture && (isEnCours || isSuspendue)
    ? formatDuration(new Date(seance.heure_ouverture), currentTime)
    : null

  // ─── Date formatting ────────────────────────────────────────────────
  const dateStr = (() => {
    try {
      return new Date(seance.date_seance).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    } catch {
      return seance.date_seance
    }
  })()

  // ─── Navigation ─────────────────────────────────────────────────────
  const canGoPrev = viewIndex > 0
  const canGoNext = viewIndex < totalPoints - 1

  // ─── Render: Not in session ─────────────────────────────────────────
  if (!isEnCours && !isSuspendue && !isCloturee) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <Landmark className="h-16 w-16 text-muted-foreground/40 mb-6" />
        <h1 className="text-2xl font-bold text-center mb-2">{institutionName}</h1>
        <p className="text-lg text-center mb-1">{seance.titre}</p>
        <p className="text-muted-foreground text-center mb-8">
          {seance.instance_config?.nom} — {dateStr}
        </p>
        <div className="bg-white rounded-xl border p-6 text-center max-w-md">
          <Clock className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-lg font-medium">La séance n&apos;a pas encore commencé</p>
          <p className="text-sm text-muted-foreground mt-1">
            Cette vue s&apos;activera automatiquement à l&apos;ouverture de la séance.
          </p>
        </div>
      </div>
    )
  }

  // ─── Render: Clôturée ───────────────────────────────────────────────
  if (isCloturee) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <Landmark className="h-16 w-16 text-muted-foreground/40 mb-6" />
        <h1 className="text-2xl font-bold text-center mb-2">{seance.titre}</h1>
        <div className="bg-purple-50 border-2 border-purple-200 rounded-xl px-8 py-4 mt-4">
          <p className="text-2xl font-bold text-purple-700">Séance clôturée</p>
        </div>
        <p className="text-muted-foreground mt-4">Merci de votre présidence.</p>
      </div>
    )
  }

  // ─── Render: En cours / Suspendue ───────────────────────────────────
  return (
    <TooltipProvider>
      <div className="min-h-screen bg-slate-50 flex flex-col">
        {/* ─── Header ─────────────────────────────────────────────────── */}
        <header className="bg-white border-b px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 shrink-0">
              <Shield className="h-5 w-5 text-blue-700" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold truncate">Président — {seance.instance_config?.nom}</h1>
              <p className="text-xs text-muted-foreground truncate">{dateStr}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {/* Quorum badge */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                  quorum.reached ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                }`}>
                  <Users className="h-3.5 w-3.5" />
                  {quorum.presents}/{quorum.total}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{quorum.presents} présents sur {quorum.total} membres</p>
                <p className="text-xs text-muted-foreground">
                  Quorum : {quorum.required} requis — {quorum.reached ? 'Atteint' : 'Non atteint'}
                </p>
              </TooltipContent>
            </Tooltip>

            {/* Session timer */}
            {sessionDuration && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Timer className="h-3.5 w-3.5" />
                {sessionDuration}
              </div>
            )}

            {/* Realtime indicator */}
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={`h-2.5 w-2.5 rounded-full ${
                  isRealtimeConnected ? 'bg-emerald-500' : 'bg-amber-500 animate-ping'
                }`} />
              </TooltipTrigger>
              <TooltipContent>
                {isRealtimeConnected ? 'Temps réel actif' : 'Rafraîchissement automatique'}
              </TooltipContent>
            </Tooltip>
          </div>
        </header>

        {/* ─── Suspended banner ───────────────────────────────────────── */}
        {isSuspendue && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 text-center">
            <p className="text-amber-700 font-semibold animate-pulse">
              Séance suspendue
            </p>
          </div>
        )}

        {/* ─── Main content ───────────────────────────────────────────── */}
        <main className="flex-1 px-4 sm:px-6 py-4 sm:py-6 overflow-y-auto">
          {/* Current point card */}
          {currentViewPoint ? (
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              {/* Point header */}
              <div className="px-4 sm:px-6 py-4 border-b bg-slate-50">
                <div className="flex items-center justify-between gap-3 mb-1">
                  <Badge variant="outline" className="text-xs">
                    Point {currentViewPoint.position}/{totalPoints}
                  </Badge>
                  {currentViewPoint.id === activePoint?.id ? (
                    <Badge className="bg-blue-100 text-blue-700 border-0 text-xs">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse mr-1.5" />
                      Point actif
                    </Badge>
                  ) : currentViewPoint.statut === 'TRAITE' ? (
                    <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Traité
                    </Badge>
                  ) : (
                    <Badge className="bg-slate-100 text-slate-600 border-0 text-xs">
                      À venir
                    </Badge>
                  )}
                </div>
                <h2 className="text-lg sm:text-xl font-bold leading-snug mt-2">
                  {currentViewPoint.titre}
                </h2>
              </div>

              {/* Point details */}
              <div className="px-4 sm:px-6 py-4 space-y-3">
                {/* Type & majorité */}
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {TYPE_LABELS[currentViewPoint.type_traitement || ''] || currentViewPoint.type_traitement || 'Non défini'}
                  </Badge>
                  {isVotable && currentViewPoint.majorite_requise && (
                    <Badge variant="outline" className="text-xs">
                      {MAJORITE_LABELS[currentViewPoint.majorite_requise] || currentViewPoint.majorite_requise}
                    </Badge>
                  )}
                  {currentViewPoint.huis_clos && (
                    <Badge className="bg-red-100 text-red-700 border-0 text-xs">
                      <Lock className="h-3 w-3 mr-1" />
                      Huis clos
                    </Badge>
                  )}
                </div>

                {/* Rapporteur */}
                {rapporteur && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    <span>Rapporteur : <span className="font-medium text-foreground">{rapporteur.prenom} {rapporteur.nom}</span></span>
                  </div>
                )}

                {/* Description */}
                {currentViewPoint.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {currentViewPoint.description}
                  </p>
                )}

                <Separator />

                {/* Vote status */}
                {anyOpenVote && anyOpenVote.odj_point_id === currentViewPoint.id && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center gap-3">
                    <Vote className="h-5 w-5 text-blue-600 animate-pulse" />
                    <div>
                      <p className="text-sm font-semibold text-blue-700">Vote en cours</p>
                      <p className="text-xs text-blue-600/80">En attente du résultat...</p>
                    </div>
                  </div>
                )}

                {anyOpenVote && anyOpenVote.odj_point_id !== currentViewPoint.id && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center gap-3">
                    <Info className="h-5 w-5 text-amber-600" />
                    <p className="text-sm text-amber-700">
                      Un vote est en cours sur un autre point
                    </p>
                  </div>
                )}

                {currentVote && currentVote.statut === 'CLOS' && currentVote.resultat && (
                  <div className={`rounded-lg px-4 py-3 flex items-center gap-3 ${
                    currentVote.resultat.startsWith('ADOPTE')
                      ? 'bg-emerald-50 border border-emerald-200'
                      : currentVote.resultat === 'REJETE'
                        ? 'bg-red-50 border border-red-200'
                        : 'bg-amber-50 border border-amber-200'
                  }`}>
                    <CheckCircle2 className={`h-5 w-5 ${
                      currentVote.resultat.startsWith('ADOPTE') ? 'text-emerald-600' :
                      currentVote.resultat === 'REJETE' ? 'text-red-600' : 'text-amber-600'
                    }`} />
                    <div>
                      <p className={`text-sm font-semibold ${
                        currentVote.resultat.startsWith('ADOPTE') ? 'text-emerald-700' :
                        currentVote.resultat === 'REJETE' ? 'text-red-700' : 'text-amber-700'
                      }`}>
                        {formatResultat(currentVote)}
                      </p>
                    </div>
                  </div>
                )}

                {/* Not votable info */}
                {!isVotable && currentViewPoint.type_traitement === 'INFORMATION' && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Eye className="h-4 w-4" />
                    <span>Point d&apos;information — pas de vote</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border p-8 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">Aucun point à l&apos;ordre du jour</p>
            </div>
          )}

          {/* ─── Demandes de parole ─────────────────────────────────── */}
          {demandesParole.length > 0 && (
            <div className="mt-4 bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="px-4 sm:px-6 py-3 border-b bg-amber-50 flex items-center gap-2">
                <Hand className="h-4 w-4 text-amber-600" />
                <h3 className="text-sm font-semibold text-amber-800">
                  Demandes de parole ({demandesParole.length})
                </h3>
              </div>
              <div className="divide-y">
                {demandesParole.map((demande) => (
                  <div key={demande.memberId} className="px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <MessageSquare className="h-4 w-4 text-amber-500 shrink-0" />
                      <span className="text-sm font-medium truncate">{demande.memberName}</span>
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 shrink-0"
                          onClick={() => handleDismissParole(demande.memberId, demande.memberName)}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1.5 text-emerald-600" />
                          Parole accordée
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Marquer comme « parole accordée » et retirer de la liste</TooltipContent>
                    </Tooltip>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── ODJ overview ──────────────────────────────────────── */}
          <div className="mt-4 bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="px-4 sm:px-6 py-3 border-b flex items-center justify-between">
              <h3 className="text-sm font-semibold text-muted-foreground">Ordre du jour</h3>
              <span className="text-xs text-muted-foreground">{totalPoints} points</span>
            </div>
            <div className="divide-y">
              {sortedPoints.map((point, idx) => {
                const vote = seance.votes.find(v => v.odj_point_id === point.id && v.statut === 'CLOS')
                const isActive = point.id === activePoint?.id
                const isViewing = idx === viewIndex
                return (
                  <button
                    key={point.id}
                    className={`w-full text-left px-4 sm:px-6 py-2.5 flex items-center gap-3 transition-colors hover:bg-slate-50 ${
                      isViewing ? 'bg-blue-50/50 border-l-2 border-l-blue-500' : ''
                    }`}
                    onClick={() => setViewIndex(idx)}
                    title={`Voir le point ${point.position}`}
                  >
                    <span className="text-xs text-muted-foreground font-mono w-4 text-right shrink-0">
                      {point.position}
                    </span>
                    {isActive ? (
                      <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
                    ) : point.statut === 'TRAITE' ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-slate-200 shrink-0" />
                    )}
                    <span className={`text-xs flex-1 truncate ${
                      isActive ? 'font-semibold text-blue-700' : point.statut === 'TRAITE' ? 'text-muted-foreground' : ''
                    }`}>
                      {point.titre}
                    </span>
                    {vote && (
                      <span className={`text-[10px] font-medium shrink-0 ${
                        vote.resultat?.startsWith('ADOPTE') ? 'text-emerald-600' :
                        vote.resultat === 'REJETE' ? 'text-red-600' : 'text-amber-600'
                      }`}>
                        {vote.resultat === 'ADOPTE_UNANIMITE' ? 'Unanimité' :
                         vote.resultat === 'ADOPTE' ? 'Adopté' :
                         vote.resultat === 'REJETE' ? 'Rejeté' : vote.resultat}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </main>

        {/* ─── Bottom action bar ──────────────────────────────────────── */}
        <footer className="bg-white border-t px-4 sm:px-6 py-3 space-y-3">
          {/* Navigation */}
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  className="h-14 flex-1"
                  disabled={!canGoPrev}
                  onClick={() => setViewIndex(i => i - 1)}
                >
                  <ChevronLeft className="h-5 w-5 mr-1" />
                  Point précédent
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {canGoPrev
                  ? `Voir le point ${sortedPoints[viewIndex - 1]?.position}`
                  : 'Premier point atteint'
                }
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  className="h-14 flex-1"
                  disabled={!canGoNext}
                  onClick={() => setViewIndex(i => i + 1)}
                >
                  Point suivant
                  <ChevronRight className="h-5 w-5 ml-1" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {canGoNext
                  ? `Voir le point ${sortedPoints[viewIndex + 1]?.position}`
                  : 'Dernier point atteint'
                }
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {isVotable && isEnCours && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className="h-14 flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={handleRequestVote}
                    disabled={!!anyOpenVote}
                  >
                    <Vote className="h-5 w-5 mr-2" />
                    Demander le vote
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {anyOpenVote
                    ? 'Un vote est déjà en cours'
                    : 'Envoyer une demande de vote au gestionnaire'
                  }
                </TooltipContent>
              </Tooltip>
            )}

            {isEnCours && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-14"
                    onClick={() => setShowSuspendDialog(true)}
                  >
                    <Pause className="h-5 w-5" />
                    <span className="ml-2 hidden sm:inline">Suspendre</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Demander la suspension de la séance au gestionnaire</TooltipContent>
              </Tooltip>
            )}
          </div>
        </footer>

        {/* ─── Suspend confirmation dialog ────────────────────────────── */}
        <AlertDialog open={showSuspendDialog} onOpenChange={setShowSuspendDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Demander la suspension ?</AlertDialogTitle>
              <AlertDialogDescription>
                Cette demande sera envoyée au gestionnaire qui contrôle la séance.
                La suspension effective sera à sa discrétion.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={handleRequestSuspend}>
                Demander la suspension
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  )
}
