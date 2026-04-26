'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAutoRefresh } from '@/lib/hooks/use-auto-refresh'
import { useRealtime } from '@/lib/hooks/use-realtime'
import { RealtimeIndicator } from '@/components/ui/realtime-indicator'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { toast } from 'sonner'
import { confirmSelfPresence } from '@/lib/actions/presences'
import { getDocumentUrl } from '@/lib/actions/documents'
import { createClient } from '@/lib/supabase/client'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  FileText,
  Vote,
  Eye,
  AlertTriangle,
  Lock,
  User,
  Landmark,
  MonitorOff,
  RefreshCw,
  CheckCircle2,
  UserCheck,
  Hand,
  PanelLeftOpen,
  PanelLeftClose,
  Download,
  StickyNote,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react'
import type { ODJPointRow } from '@/lib/supabase/types'
import type { DocumentInfo } from '@/lib/actions/documents'
import { VoteSecretBallot } from '@/components/vote/vote-secret-ballot'

// ─── Types ────────────────────────────────────────────────────────────────────

interface VoteInfo {
  id: string
  odj_point_id: string
  type_vote: string | null
  statut: string | null
  total_votants: number | null
  question: string | null
  resultat: string | null
  pour: number | null
  contre: number | null
  abstention: number | null
}

interface ConvocataireInfo {
  id: string
  member_id: string
  member: { id: string; prenom: string; nom: string } | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface SeanceData extends Record<string, any> {
  id: string
  titre: string
  date_seance: string
  statut: string | null
  lieu: string | null
  mode: string | null
  heure_ouverture: string | null
  instance_config: { id: string; nom: string; type_legal: string; voix_preponderante: boolean | null } | null
  odj_points: ODJPointRow[]
  convocataires?: ConvocataireInfo[]
  president_effectif: { id: string; prenom: string; nom: string } | null
  secretaire_seance: { id: string; prenom: string; nom: string } | null
  votes?: VoteInfo[]
}

interface MemberInfo {
  id: string
  prenom: string
  nom: string
  email: string
  qualite_officielle: string | null
}

interface PresenceInfo {
  statut: string | null
  heure_arrivee: string | null
}

interface TabletteEluProps {
  seance: SeanceData
  currentMember: MemberInfo | null
  isConvoque?: boolean
  presenceData?: PresenceInfo | null
  votesParticipation?: { vote_id: string; member_id: string }[]
  mandants?: { id: string; prenom: string; nom: string }[]
  memberRecusations?: { odj_point_id: string }[]
}

const MAJORITE_LABELS: Record<string, string> = {
  SIMPLE: 'Majorité simple',
  ABSOLUE: 'Majorité absolue',
  QUALIFIEE: 'Majorité qualifiée (2/3)',
  UNANIMITE: 'Unanimité requise',
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  DELIBERATION: { label: 'Délibération', color: 'bg-blue-100 text-blue-700' },
  INFORMATION: { label: 'Information', color: 'bg-slate-100 text-slate-600' },
  QUESTION_DIVERSE: { label: 'Question diverse', color: 'bg-amber-100 text-amber-700' },
  ELECTION: { label: 'Élection', color: 'bg-purple-100 text-purple-700' },
  APPROBATION_PV: { label: 'Approbation PV', color: 'bg-emerald-100 text-emerald-700' },
}

// ─── ODJ Sidebar Item ─────────────────────────────────────────────────────────

function ODJSidebarItem({
  point,
  index,
  currentIndex,
  votes,
  onClick,
}: {
  point: ODJPointRow
  index: number
  currentIndex: number
  votes: VoteInfo[]
  onClick: () => void
}) {
  const isActive = index === currentIndex
  const isDone = index < currentIndex
  const pointVote = votes.find(v => v.odj_point_id === point.id && v.statut === 'CLOS')

  const isVotable = !point.votes_interdits && (
    point.type_traitement === 'DELIBERATION' ||
    point.type_traitement === 'ELECTION' ||
    point.type_traitement === 'APPROBATION_PV'
  )

  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition-all ${
        isActive
          ? 'bg-institutional-blue/10 border-2 border-institutional-blue/30 shadow-sm'
          : isDone
            ? 'bg-emerald-50/50 hover:bg-emerald-50'
            : 'hover:bg-muted/50'
      }`}
      style={{ minHeight: '48px' }}
    >
      {/* Status icon */}
      <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold shrink-0 ${
        isActive
          ? 'bg-institutional-blue text-white animate-pulse'
          : isDone
            ? 'bg-emerald-500 text-white'
            : isVotable
              ? 'bg-blue-100 text-blue-700'
              : 'bg-slate-100 text-slate-500'
      }`}>
        {isDone ? <CheckCircle2 className="h-4 w-4" /> : point.position}
      </span>

      {/* Title + badges */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-tight truncate ${
          isActive ? 'font-bold text-institutional-blue' : isDone ? 'text-emerald-800' : 'text-foreground'
        }`}>
          {point.titre}
        </p>
        <div className="flex items-center gap-1 mt-0.5">
          {point.type_traitement && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
              TYPE_LABELS[point.type_traitement]?.color || 'bg-slate-100 text-slate-600'
            }`}>
              {TYPE_LABELS[point.type_traitement]?.label || point.type_traitement}
            </span>
          )}
          {pointVote?.resultat && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
              pointVote.resultat === 'ADOPTE'
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-red-100 text-red-700'
            }`}>
              {pointVote.resultat === 'ADOPTE' ? 'Adopté' : 'Rejeté'}
            </span>
          )}
        </div>
      </div>

      {/* Current indicator */}
      {isActive && (
        <span className="text-[10px] font-bold text-institutional-blue shrink-0">EN COURS</span>
      )}
    </button>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
// TABLET VIEW: Large text (22px base), big buttons (56px min), touch-friendly
// Used by elected officials during the session on their individual tablet.

export function TabletteElu({ seance, currentMember, isConvoque, presenceData, votesParticipation = [], mandants = [], memberRecusations = [] }: TabletteEluProps) {
  const router = useRouter()
  const [currentPointIndex, setCurrentPointIndex] = useState(0)
  const [wakeLockFailed, setWakeLockFailed] = useState(false)
  const [isPresent, setIsPresent] = useState(presenceData?.statut === 'PRESENT')
  const [presenceTime, setPresenceTime] = useState<string | null>(
    presenceData?.heure_arrivee || null
  )
  const [isConfirming, setIsConfirming] = useState(false)

  // ODJ Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Demande de parole state
  const [paroleRequested, setParoleRequested] = useState(false)
  const [paroleSending, setParoleSending] = useState(false)

  // Personal notes state
  const [showNotesEditor, setShowNotesEditor] = useState(false)
  const [noteText, setNoteText] = useState('')

  // Sync from server data on re-render (auto-refresh)
  useEffect(() => {
    if (presenceData?.statut === 'PRESENT') {
      setIsPresent(true)
      setPresenceTime(presenceData.heure_arrivee)
    }
  }, [presenceData])

  const handleConfirmPresence = async () => {
    if (!currentMember) return
    setIsConfirming(true)
    try {
      const result = await confirmSelfPresence(seance.id, currentMember.id)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        setIsPresent(true)
        setPresenceTime(new Date().toISOString())
        toast.success('Présence confirmée !')
      }
    } catch {
      toast.error('Erreur lors de la confirmation')
    } finally {
      setIsConfirming(false)
    }
  }

  const formatTime = (iso: string | null) => {
    if (!iso) return ''
    return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }

  // ─── Realtime subscription (primary) ─────────────────────────────────────
  const { isConnected: isRealtimeConnected } = useRealtime({
    channel: `tablette-${seance.id}`,
    tables: ['votes', 'odj_points', 'presences', 'votes_participation', 'bulletins_vote'],
    filter: `seance_id=eq.${seance.id}`,
    enabled: !isConfirming,
  })

  // ─── Polling fallback (when Realtime not connected) ─────────────────────
  const pollingEnabled = !isRealtimeConnected && !isConfirming
  useAutoRefresh({ intervalMs: 3000, enabled: pollingEnabled })
  const isPolling = pollingEnabled

  // Screen Wake Lock — keep tablet awake during session
  useEffect(() => {
    let wakeLock: WakeLockSentinel | null = null

    async function requestWakeLock() {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await navigator.wakeLock.request('screen')
          setWakeLockFailed(false)
        } else {
          setWakeLockFailed(true)
        }
      } catch {
        setWakeLockFailed(true)
      }
    }

    if (seance.statut === 'EN_COURS') {
      requestWakeLock()
    }

    return () => {
      wakeLock?.release()
    }
  }, [seance.statut])

  // Sort points
  const sortedPoints = useMemo(() =>
    [...seance.odj_points].sort((a, b) => (a.position || 0) - (b.position || 0)),
    [seance.odj_points]
  )

  const currentPoint = sortedPoints[currentPointIndex] || null
  const totalPoints = sortedPoints.length

  const isVotable = currentPoint && !currentPoint.votes_interdits && (
    currentPoint.type_traitement === 'DELIBERATION' ||
    currentPoint.type_traitement === 'ELECTION' ||
    currentPoint.type_traitement === 'APPROBATION_PV'
  )

  const documents: DocumentInfo[] = useMemo(() => {
    if (!currentPoint) return []
    return Array.isArray(currentPoint.documents)
      ? (currentPoint.documents as unknown as DocumentInfo[])
      : []
  }, [currentPoint])

  // Rapporteur for current point
  const currentRapporteur = useMemo(() => {
    if (!currentPoint?.rapporteur_id) return null
    const convocataires = seance.convocataires || []
    const conv = convocataires.find(c => c.member?.id === currentPoint.rapporteur_id)
    return conv?.member || null
  }, [currentPoint, seance.convocataires])

  // Vote for current point
  const currentVote = useMemo(() => {
    if (!currentPoint) return null
    return (seance.votes || []).find(
      v => v.odj_point_id === currentPoint.id && v.statut !== 'ANNULE'
    ) || null
  }, [currentPoint, seance.votes])

  const isEnCours = seance.statut === 'EN_COURS'
  const isCloturee = seance.statut === 'CLOTUREE'
  const isSuspendue = seance.statut === 'SUSPENDUE'

  // Detect open secret vote
  const openSecretVote = (seance.votes || []).find(
    v => v.type_vote === 'SECRET' && v.statut === 'OUVERT'
  ) || null

  // Check if current member has already voted
  const hasVotedInSecretVote = openSecretVote && currentMember
    ? votesParticipation.some(vp => vp.vote_id === openSecretVote.id && vp.member_id === currentMember.id)
    : false

  // ─── Personal notes (localStorage) ────────────────────────────────────────
  const notesKey = currentPoint ? `notes_${seance.id}_${currentPoint.id}` : null

  // Load notes when point changes
  useEffect(() => {
    if (!notesKey) { setNoteText(''); return }
    try {
      const saved = localStorage.getItem(notesKey)
      setNoteText(saved || '')
    } catch {
      setNoteText('')
    }
    setShowNotesEditor(false)
  }, [notesKey])

  const saveNote = useCallback(() => {
    if (!notesKey) return
    try {
      if (noteText.trim()) {
        localStorage.setItem(notesKey, noteText.trim())
      } else {
        localStorage.removeItem(notesKey)
      }
      toast.success('Note enregistrée')
      setShowNotesEditor(false)
    } catch {
      toast.error('Impossible de sauvegarder la note')
    }
  }, [notesKey, noteText])

  // ─── Demande de parole (Supabase Realtime broadcast) ──────────────────────
  const handleParoleToggle = useCallback(async () => {
    if (!currentMember || paroleSending) return
    setParoleSending(true)
    try {
      const supabase = createClient()
      const channel = supabase.channel(`parole-${seance.id}`)

      // Subscribe first (needed for broadcast to work)
      await new Promise<void>((resolve) => {
        channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') resolve()
        })
      })

      const action = paroleRequested ? 'cancel' : 'request'
      await channel.send({
        type: 'broadcast',
        event: 'demande_parole',
        payload: {
          memberId: currentMember.id,
          memberName: `${currentMember.prenom} ${currentMember.nom}`,
          action,
          timestamp: new Date().toISOString(),
        },
      })

      setParoleRequested(!paroleRequested)
      toast.success(
        paroleRequested
          ? 'Demande de parole annulée'
          : 'Demande de parole envoyée'
      )

      // Cleanup channel after sending
      supabase.removeChannel(channel)
    } catch {
      toast.error('Erreur lors de l\'envoi de la demande')
    } finally {
      setParoleSending(false)
    }
  }, [currentMember, seance.id, paroleRequested, paroleSending])

  // ─── Document viewer ──────────────────────────────────────────────────────
  const handleOpenDocument = useCallback(async (doc: DocumentInfo) => {
    try {
      const result = await getDocumentUrl(doc.path)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        window.open(result.url, '_blank')
      }
    } catch {
      toast.error('Impossible d\'ouvrir le document')
    }
  }, [])

  // ─── Render: Secret vote overlay ────────────────────────────────────────

  if (openSecretVote && currentMember && isEnCours) {
    return (
      <div className="min-h-screen bg-purple-50 flex flex-col" style={{ fontSize: '22px' }}>
        <VoteSecretBallot
          voteId={openSecretVote.id}
          voteQuestion={openSecretVote.question || 'Vote secret'}
          memberId={currentMember.id}
          hasVoted={hasVotedInSecretVote}
          mandants={mandants}
          onVoteSubmitted={() => router.refresh()}
        />
      </div>
    )
  }

  // Check if current member is recused for the current point
  const isCurrentlyRecused = currentPoint && currentMember
    ? memberRecusations.some(r => r.odj_point_id === currentPoint.id)
    : false

  // ─── Render: Recusation overlay ────────────────────────────────────────

  if (isCurrentlyRecused && isEnCours && currentPoint) {
    const openVoteOnPoint = (seance.votes || []).find(
      v => v.odj_point_id === currentPoint.id && v.statut === 'OUVERT'
    )

    return (
      <div className="min-h-screen bg-amber-50 flex flex-col items-center justify-center p-8 text-center" style={{ fontSize: '22px' }}>
        <div className="max-w-lg space-y-6">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-amber-100 border-4 border-amber-300 mx-auto">
            <UserCheck className="h-14 w-14 text-amber-600" />
          </div>
          <h1 className="text-3xl font-bold text-amber-800">
            Vous êtes récusé(e) pour ce point
          </h1>
          <p className="text-xl text-amber-700">
            Vous avez déclaré un conflit d&apos;intérêt. Votre tablette est inactive pour ce vote.
          </p>
          <div className="rounded-xl bg-amber-100 border-2 border-amber-300 p-5">
            <p className="text-lg font-semibold text-amber-800 mb-2">
              Point {currentPoint.position} : {currentPoint.titre}
            </p>
            <p className="text-base text-amber-600">
              {openVoteOnPoint
                ? 'Un vote est en cours — vous ne pouvez pas y participer.'
                : 'Vous êtes retiré(e) du débat et du vote.'}
            </p>
          </div>
          <p className="text-base text-amber-600">
            Vos droits seront rétablis au point suivant.
          </p>
        </div>
      </div>
    )
  }

  // ─── Render: Séance clôturée ──────────────────────────────────────────

  if (isCloturee) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8 text-center">
        <Landmark className="h-16 w-16 text-purple-400 mb-6" />
        <h1 className="text-3xl font-bold text-purple-800 mb-3">Séance clôturée</h1>
        <p className="text-lg text-muted-foreground mb-2">{seance.titre}</p>
        <p className="text-base text-muted-foreground">Merci de votre participation.</p>
      </div>
    )
  }

  // ─── Render: Séance suspendue ─────────────────────────────────────────

  if (isSuspendue) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8 text-center">
        <Landmark className="h-16 w-16 text-amber-400 mb-6" />
        <h1 className="text-3xl font-bold text-amber-800 mb-3 animate-pulse">Séance suspendue</h1>
        <p className="text-lg text-muted-foreground mb-2">{seance.titre}</p>
        <p className="text-base text-muted-foreground">La séance reprendra prochainement.</p>
      </div>
    )
  }

  // ─── Render: Active ───────────────────────────────────────────────────

  return (
    <TooltipProvider>
    <div className="min-h-screen bg-slate-50 flex flex-col relative" style={{ fontSize: '22px' }}>

      {/* Banner when seance not yet started */}
      {seance.statut !== 'EN_COURS' && (
        <div className="bg-blue-600 text-white px-6 py-4 text-center">
          <p className="text-sm font-bold">
            {seance.statut === 'CONVOQUEE'
              ? 'La séance n\'a pas encore commencé'
              : 'En attente d\'ouverture'}
          </p>
          <p className="text-xs text-white/80 mt-1">
            {seance.statut === 'CONVOQUEE'
              ? 'Vous pouvez consulter l\'ordre du jour en attendant.'
              : ''}
          </p>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b px-4 py-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  onClick={() => router.push(`/seances/${seance.id}`)}
                  title="Retour à la séance"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Retour à la séance</TooltipContent>
            </Tooltip>

            {/* ODJ Sidebar toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  title={sidebarOpen ? 'Masquer l\'ordre du jour' : 'Afficher l\'ordre du jour'}
                >
                  {sidebarOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{sidebarOpen ? 'Masquer l\'ordre du jour' : 'Afficher l\'ordre du jour'}</TooltipContent>
            </Tooltip>

            <Landmark className="h-6 w-6 text-institutional-blue" />
            <div className="min-w-0">
              <h1 className="text-base font-bold leading-tight truncate">{seance.titre}</h1>
              <p className="text-xs text-muted-foreground">{seance.instance_config?.nom}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {wakeLockFailed && isEnCours && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 text-xs px-2 py-1 gap-1">
                    <MonitorOff className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Veille non bloquée</span>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="max-w-[250px]">
                  L&apos;écran peut se mettre en veille automatiquement. Vérifiez les réglages de votre tablette.
                </TooltipContent>
              </Tooltip>
            )}
            {currentMember && (
              <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5">
                <User className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {currentMember.prenom} {currentMember.nom}
                </span>
              </div>
            )}
            <Badge className={`text-sm px-3 py-1 ${
              isEnCours ? 'bg-emerald-100 text-emerald-700' :
              seance.statut === 'SUSPENDUE' ? 'bg-amber-100 text-amber-700' :
              'bg-slate-100 text-slate-600'
            }`}>
              {isEnCours ? '● En cours' :
               seance.statut === 'SUSPENDUE' ? '⏸ Suspendue' :
               seance.statut === 'CLOTUREE' ? 'Clôturée' :
               seance.statut || 'Attente'}
            </Badge>
            <RealtimeIndicator isConnected={isRealtimeConnected} isPolling={isPolling} />
          </div>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-1.5 mt-2">
          {sortedPoints.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentPointIndex(idx)}
              className={`h-2 flex-1 rounded-full transition-all ${
                idx === currentPointIndex
                  ? 'bg-institutional-blue'
                  : idx < currentPointIndex
                    ? 'bg-emerald-400'
                    : 'bg-slate-200'
              }`}
              title={`Point ${idx + 1} : ${sortedPoints[idx]?.titre}`}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground text-center mt-1">
          Point {currentPointIndex + 1} / {totalPoints}
        </p>
      </header>

      {/* Presence confirmation */}
      {isConvoque && currentMember && (
        <div className="px-4 pt-3 shrink-0">
          <div className="max-w-4xl mx-auto">
            {isPresent ? (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2.5 space-y-1.5">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                  <span className="text-sm font-medium text-emerald-800">
                    Présent(e) depuis {formatTime(presenceTime)}
                  </span>
                </div>
                {mandants.length > 0 && (
                  <div className="flex items-center gap-2 pl-8 text-xs text-emerald-700">
                    <User className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      Vous représentez également : {mandants.map(m => `${m.prenom} ${m.nom}`).join(', ')} (procuration)
                    </span>
                  </div>
                )}
              </div>
            ) : (seance.statut === 'EN_COURS' || seance.statut === 'CONVOQUEE') && (
              <div className="rounded-xl bg-blue-50 border-2 border-blue-300 p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <UserCheck className="h-7 w-7 text-blue-600 shrink-0" />
                  <h3 className="text-xl font-bold text-blue-800">Confirmez votre présence</h3>
                </div>
                <Button
                  onClick={handleConfirmPresence}
                  disabled={isConfirming}
                  className="w-full h-16 text-xl font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
                  style={{ minHeight: '64px' }}
                >
                  {isConfirming ? (
                    <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                  ) : (
                    <CheckCircle2 className="h-6 w-6 mr-2" />
                  )}
                  {isConfirming ? 'Confirmation...' : 'Je suis présent(e)'}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main layout: sidebar + content */}
      <div className="flex-1 flex min-h-0 overflow-hidden">

        {/* ═══ ODJ Sidebar (collapsible) ═══ */}
        {sidebarOpen && (
          <aside className="w-80 border-r bg-white flex flex-col shrink-0 overflow-hidden">
            <div className="px-4 py-3 border-b bg-slate-50">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold">Ordre du jour</h2>
                <Badge variant="outline" className="text-xs">
                  {totalPoints} point{totalPoints > 1 ? 's' : ''}
                </Badge>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {sortedPoints.map((point, idx) => (
                <ODJSidebarItem
                  key={point.id}
                  point={point}
                  index={idx}
                  currentIndex={currentPointIndex}
                  votes={seance.votes || []}
                  onClick={() => {
                    setCurrentPointIndex(idx)
                    // Auto-close sidebar on mobile to maximize content
                    if (window.innerWidth < 768) {
                      setSidebarOpen(false)
                    }
                  }}
                />
              ))}
            </div>

            {/* Sidebar footer: stats */}
            <div className="px-4 py-2 border-t bg-slate-50 text-[10px] text-muted-foreground text-center">
              {(() => {
                const closedVotes = (seance.votes || []).filter(v => v.statut === 'CLOS')
                const adopted = closedVotes.filter(v => v.resultat === 'ADOPTE').length
                const rejected = closedVotes.filter(v => v.resultat === 'REJETE').length
                return closedVotes.length > 0
                  ? `${closedVotes.length} vote${closedVotes.length > 1 ? 's' : ''} : ${adopted} adopté${adopted > 1 ? 's' : ''}, ${rejected} rejeté${rejected > 1 ? 's' : ''}`
                  : 'Aucun vote enregistré'
              })()}
            </div>
          </aside>
        )}

        {/* ═══ Main content: current point ═══ */}
        <main className="flex-1 overflow-y-auto p-4 pb-24">
          {currentPoint ? (
            <div className="max-w-4xl mx-auto space-y-4">

              {/* Point header */}
              <div className="flex items-start gap-4">
                <span className={`flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-bold shrink-0 ${
                  isVotable ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                }`}>
                  {currentPoint.position}
                </span>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold leading-tight">{currentPoint.titre}</h2>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {currentPoint.type_traitement && (
                      <Badge className={`${TYPE_LABELS[currentPoint.type_traitement]?.color || 'bg-slate-100'} border-0 text-sm px-3 py-1`}>
                        {TYPE_LABELS[currentPoint.type_traitement]?.label || currentPoint.type_traitement}
                      </Badge>
                    )}
                    {isVotable ? (
                      <Badge className="bg-blue-50 text-blue-700 border-0 text-sm px-3 py-1">
                        <Vote className="h-4 w-4 mr-1" /> Soumis au vote
                      </Badge>
                    ) : currentPoint.type_traitement !== 'QUESTION_DIVERSE' && (
                      <Badge className="bg-slate-50 text-slate-500 border-0 text-sm px-3 py-1">
                        <Eye className="h-4 w-4 mr-1" /> Information
                      </Badge>
                    )}
                    {currentPoint.huis_clos && (
                      <Badge variant="outline" className="border-red-200 text-red-600 text-sm px-3 py-1">
                        <Lock className="h-4 w-4 mr-1" /> Huis clos
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Majority requirement badge */}
              {isVotable && currentPoint.majorite_requise && currentPoint.majorite_requise !== 'SIMPLE' && (
                <div className="rounded-xl bg-amber-50 border-2 border-amber-200 p-4 flex items-center gap-3">
                  <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0" />
                  <p className="text-base font-medium text-amber-800">
                    {MAJORITE_LABELS[currentPoint.majorite_requise] || currentPoint.majorite_requise}
                  </p>
                </div>
              )}

              {/* Rapporteur */}
              {currentRapporteur && (
                <div className="flex items-center gap-2 text-base">
                  <MessageSquare className="h-5 w-5 text-blue-500 shrink-0" />
                  <span className="text-muted-foreground">Rapporteur :</span>
                  <span className="font-semibold">{currentRapporteur.prenom} {currentRapporteur.nom}</span>
                </div>
              )}

              {/* Description */}
              {currentPoint.description && (
                <p className="text-base text-muted-foreground leading-relaxed">
                  {currentPoint.description}
                </p>
              )}

              <Separator />

              {/* ═══ Projet de délibération ═══ */}
              {currentPoint.projet_deliberation && (
                <ProjetDeliberationCard text={currentPoint.projet_deliberation} />
              )}

              {/* ═══ Documents attachés ═══ */}
              {documents.length > 0 && (
                <div>
                  <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    Documents attachés ({documents.length})
                  </h3>
                  <div className="grid gap-2">
                    {documents.map((doc, i) => (
                      <button
                        key={i}
                        onClick={() => handleOpenDocument(doc)}
                        className="flex items-center gap-3 rounded-xl border-2 border-slate-200 p-4 bg-white hover:border-blue-300 hover:bg-blue-50/50 transition-all active:scale-[0.98] text-left"
                        style={{ minHeight: '56px' }}
                        title={`Ouvrir ${doc.name}`}
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 shrink-0">
                          <FileText className="h-5 w-5 text-red-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-base font-medium truncate">{doc.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {doc.size < 1024 * 1024
                              ? `${Math.round(doc.size / 1024)} Ko`
                              : `${(doc.size / (1024 * 1024)).toFixed(1)} Mo`}
                            {' · '}{doc.type.toUpperCase()}
                          </p>
                        </div>
                        <Download className="h-5 w-5 text-blue-500 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ═══ Vote result (if voted) ═══ */}
              {currentVote && currentVote.statut === 'CLOS' && (
                <div className={`rounded-xl border-2 p-4 ${
                  currentVote.resultat === 'ADOPTE'
                    ? 'border-emerald-200 bg-emerald-50'
                    : 'border-red-200 bg-red-50'
                }`}>
                  <div className="flex items-center gap-3 mb-2">
                    <CheckCircle2 className={`h-6 w-6 ${
                      currentVote.resultat === 'ADOPTE' ? 'text-emerald-600' : 'text-red-600'
                    }`} />
                    <h3 className={`text-lg font-bold ${
                      currentVote.resultat === 'ADOPTE' ? 'text-emerald-800' : 'text-red-800'
                    }`}>
                      {currentVote.resultat === 'ADOPTE' ? 'Adopté' : 'Rejeté'}
                    </h3>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="font-medium text-emerald-700">Pour : {currentVote.pour ?? 0}</span>
                    <span className="font-medium text-red-700">Contre : {currentVote.contre ?? 0}</span>
                    <span className="font-medium text-slate-600">Abstentions : {currentVote.abstention ?? 0}</span>
                  </div>
                </div>
              )}

              {/* ═══ Vote in progress indicator ═══ */}
              {currentVote && currentVote.statut === 'OUVERT' && currentVote.type_vote !== 'SECRET' && (
                <div className="rounded-xl border-2 border-blue-300 bg-blue-50 p-4 animate-pulse">
                  <div className="flex items-center gap-3">
                    <Vote className="h-6 w-6 text-blue-600" />
                    <div>
                      <h3 className="text-lg font-bold text-blue-800">Vote en cours</h3>
                      <p className="text-sm text-blue-600">
                        {currentVote.type_vote === 'MAIN_LEVEE' ? 'Vote à main levée' :
                         currentVote.type_vote === 'TELEVOTE' ? 'Télévote' :
                         'Vote en cours'}
                        {' — En attente de la clôture'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              {currentPoint.notes_seance && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
                  <p className="text-base text-amber-800">
                    <strong>Note :</strong> {currentPoint.notes_seance}
                  </p>
                </div>
              )}

              {/* Question diverse warning */}
              {currentPoint.type_traitement === 'QUESTION_DIVERSE' && (
                <div className="rounded-xl bg-amber-50 border-2 border-amber-200 p-4 flex items-center gap-3">
                  <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0" />
                  <p className="text-base text-amber-800">
                    Questions diverses — aucun vote autorisé
                  </p>
                </div>
              )}

              {/* ═══ Personal notes card ═══ */}
              <PersonalNotesCard
                noteText={noteText}
                showEditor={showNotesEditor}
                onToggleEditor={() => setShowNotesEditor(!showNotesEditor)}
                onNoteChange={setNoteText}
                onSave={saveNote}
              />

            </div>
          ) : (
            <div className="text-center py-20 text-muted-foreground">
              <FileText className="h-16 w-16 mx-auto mb-4 opacity-40" />
              <p className="text-xl">Aucun point à l&apos;ordre du jour</p>
            </div>
          )}
        </main>
      </div>

      {/* Bottom navigation — always visible, big touch targets */}
      <footer className="bg-white border-t px-4 py-3 shrink-0">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => setCurrentPointIndex(i => i - 1)}
            disabled={currentPointIndex === 0}
            className="h-14 px-5 text-lg gap-2"
            style={{ minWidth: '56px', minHeight: '56px' }}
            title={currentPointIndex === 0 ? 'Premier point — impossible de reculer' : 'Point précédent'}
          >
            <ChevronLeft className="h-6 w-6" /> Précédent
          </Button>

          <div className="text-center flex-1 min-w-0 px-3">
            <p className="text-xs text-muted-foreground truncate">
              {currentPoint?.titre || '—'}
            </p>
          </div>

          <Button
            onClick={() => setCurrentPointIndex(i => i + 1)}
            disabled={currentPointIndex >= totalPoints - 1}
            className="h-14 px-5 text-lg gap-2"
            style={{ minWidth: '56px', minHeight: '56px' }}
            title={currentPointIndex >= totalPoints - 1 ? 'Dernier point' : 'Point suivant'}
          >
            Suivant <ChevronRight className="h-6 w-6" />
          </Button>
        </div>

        {/* Next point preview */}
        {currentPointIndex < totalPoints - 1 && (
          <p className="text-center text-xs text-muted-foreground mt-1.5">
            Prochain : {sortedPoints[currentPointIndex + 1]?.titre}
          </p>
        )}
      </footer>

      {/* ═══ Demande de parole floating button ═══ */}
      {isEnCours && currentMember && (
        <div className="fixed bottom-24 right-6 z-50 flex flex-col items-end gap-2">
          {paroleRequested && (
            <div className="bg-amber-100 border border-amber-300 rounded-xl px-4 py-2 shadow-lg flex items-center gap-2 animate-in slide-in-from-right-5">
              <span className="text-sm font-medium text-amber-800">Demande envoyée</span>
              <button
                onClick={handleParoleToggle}
                className="h-7 w-7 flex items-center justify-center rounded-full bg-amber-200 hover:bg-amber-300 transition-colors"
                title="Annuler ma demande de parole"
              >
                <X className="h-4 w-4 text-amber-700" />
              </button>
            </div>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleParoleToggle}
                disabled={paroleSending}
                className={`h-16 w-16 rounded-full shadow-lg transition-all active:scale-95 flex items-center justify-center ${
                  paroleRequested
                    ? 'bg-amber-500 hover:bg-amber-600 animate-pulse'
                    : 'bg-blue-600 hover:bg-blue-700'
                } text-white`}
                style={{ minHeight: '64px', minWidth: '64px' }}
                title={paroleRequested ? 'Annuler ma demande de parole' : 'Demander la parole'}
              >
                {paroleSending ? (
                  <RefreshCw className="h-7 w-7 animate-spin" />
                ) : (
                  <Hand className="h-8 w-8" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="left" className="text-sm">
              {paroleRequested ? 'Annuler ma demande de parole' : 'Demander la parole'}
            </TooltipContent>
          </Tooltip>
        </div>
      )}

    </div>
    </TooltipProvider>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────────

/** Expandable projet de délibération card */
function ProjetDeliberationCard({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = text.length > 500

  return (
    <div className="rounded-xl bg-blue-50 border-2 border-blue-200 overflow-hidden">
      <div className="px-5 pt-4 pb-2 flex items-center justify-between">
        <h3 className="text-base font-semibold text-blue-800 flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Projet de délibération
        </h3>
        {isLong && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium"
          >
            {expanded ? (
              <>Réduire <ChevronUp className="h-3.5 w-3.5" /></>
            ) : (
              <>Voir tout <ChevronDown className="h-3.5 w-3.5" /></>
            )}
          </button>
        )}
      </div>
      <div className={`px-5 pb-4 ${isLong && !expanded ? 'max-h-48 overflow-hidden relative' : ''}`}>
        <div className="text-base text-blue-900 whitespace-pre-line leading-relaxed">
          {text}
        </div>
        {isLong && !expanded && (
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-blue-50 to-transparent" />
        )}
      </div>
    </div>
  )
}

/** Personal notes card with inline editor */
function PersonalNotesCard({
  noteText,
  showEditor,
  onToggleEditor,
  onNoteChange,
  onSave,
}: {
  noteText: string
  showEditor: boolean
  onToggleEditor: () => void
  onNoteChange: (text: string) => void
  onSave: () => void
}) {
  return (
    <div className="rounded-xl border border-yellow-200 bg-yellow-50 overflow-hidden">
      <button
        onClick={onToggleEditor}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-yellow-100/50 transition-colors"
        style={{ minHeight: '48px' }}
      >
        <span className="flex items-center gap-2 text-sm font-medium text-yellow-800">
          <StickyNote className="h-4 w-4" />
          Mes notes personnelles
        </span>
        {noteText ? (
          <Badge className="bg-yellow-200 text-yellow-800 border-0 text-xs">
            Note enregistrée
          </Badge>
        ) : (
          <span className="text-xs text-yellow-600">Ajouter une note</span>
        )}
      </button>

      {/* Display saved note */}
      {noteText && !showEditor && (
        <div className="px-4 pb-3 border-t border-yellow-200">
          <p className="text-sm text-yellow-700 whitespace-pre-line mt-2">{noteText}</p>
        </div>
      )}

      {/* Editor */}
      {showEditor && (
        <div className="px-4 pb-3 border-t border-yellow-200 space-y-2">
          <textarea
            value={noteText}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder="Vos notes pour ce point (visibles uniquement par vous)..."
            className="w-full min-h-[80px] bg-white border border-yellow-300 rounded-lg p-3 text-sm text-yellow-900 placeholder:text-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-y"
            autoFocus
          />
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-yellow-600">Stocké localement sur cet appareil</p>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-yellow-700"
                onClick={onToggleEditor}
              >
                Annuler
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs bg-yellow-600 hover:bg-yellow-700 text-white"
                onClick={onSave}
              >
                Enregistrer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
