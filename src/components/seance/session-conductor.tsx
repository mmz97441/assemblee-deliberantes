'use client'

import { useState, useTransition, useMemo, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAutoRefresh } from '@/lib/hooks/use-auto-refresh'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  ChevronLeft,
  ChevronRight,
  Users,
  FileText,
  Vote,
  Eye,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Monitor,
  Loader2,
  PenLine,
  ArrowLeft,
  MessageSquare,
  Lock,
  Pause,
  Square,
  Tablet,
  Play,
  Clock,
  RefreshCw,
} from 'lucide-react'
import { updateSeanceStatut } from '@/lib/actions/seances'
import type { ODJPointRow } from '@/lib/supabase/types'
import type { DocumentInfo } from '@/lib/actions/documents'
import { VoteMainLevee } from '@/components/vote/vote-main-levee'

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
  noms_contre: string[] | null
  noms_abstention: string[] | null
  voix_preponderante_activee: boolean | null
  ouvert_at: string | null
  clos_at: string | null
}

interface SessionConductorProps {
  seance: SeanceData
  instanceMemberCount: number
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

// ─── Quorum calculation ───────────────────────────────────────────────────────

function calculateQuorum(
  presences: PresenceItem[],
  totalMembers: number,
  config: InstanceConfig | null
) {
  const presents = presences.filter(p => p.statut === 'PRESENT' || p.statut === 'PROCURATION').length
  const total = config?.composition_max || totalMembers
  const quorumType = config?.quorum_type || 'MAJORITE_MEMBRES'
  const num = config?.quorum_fraction_numerateur || 1
  const den = config?.quorum_fraction_denominateur || 2

  let required: number
  let label: string

  switch (quorumType) {
    case 'MAJORITE_MEMBRES':
      required = Math.ceil(total / 2) + 1; label = 'Majorité des membres'; break
    case 'TIERS_MEMBRES':
      required = Math.ceil(total / 3); label = 'Tiers des membres'; break
    case 'DEUX_TIERS':
      required = Math.ceil((total * 2) / 3); label = 'Deux tiers'; break
    case 'STATUTS':
      required = Math.ceil((total * num) / den); label = `${num}/${den} des membres`; break
    default:
      required = Math.ceil(total / 2) + 1; label = 'Majorité des membres'
  }

  return { presents, total, required, reached: presents >= required, label }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SessionConductor({ seance, instanceMemberCount }: SessionConductorProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [currentPointIndex, setCurrentPointIndex] = useState(0)
  const [statusDialog, setStatusDialog] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState<Date | null>(null)

  // Live clock (client-only to avoid hydration mismatch)
  useEffect(() => {
    setCurrentTime(new Date())
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Sort ODJ points by position
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

  // Quorum
  const quorum = useMemo(() =>
    calculateQuorum(seance.presences, instanceMemberCount, seance.instance_config),
    [seance.presences, instanceMemberCount, seance.instance_config]
  )

  // Presence stats
  const presenceStats = useMemo(() => {
    const total = seance.convocataires.length
    const presents = seance.presences.filter(p => p.statut === 'PRESENT').length
    const excuses = seance.presences.filter(p => p.statut === 'EXCUSE').length
    const procurations = seance.presences.filter(p => p.statut === 'PROCURATION').length
    return { total, presents, excuses, procurations, absent: total - presents - excuses - procurations }
  }, [seance.convocataires, seance.presences])

  // Votants count (presents + procurations, for vote calculations)
  const votantsCount = presenceStats.presents + presenceStats.procurations

  // Session duration
  const sessionDuration = useMemo(() => {
    if (!seance.heure_ouverture || !currentTime) return null
    const start = new Date(seance.heure_ouverture).getTime()
    const now = currentTime.getTime()
    const diffMs = now - start
    if (diffMs < 0) return null
    const hours = Math.floor(diffMs / 3600000)
    const minutes = Math.floor((diffMs % 3600000) / 60000)
    return hours > 0 ? `${hours}h${String(minutes).padStart(2, '0')}` : `${minutes} min`
  }, [seance.heure_ouverture, currentTime])

  // Rapporteur for current point (memoized, not repeated .find())
  const currentRapporteur = useMemo(() => {
    if (!currentPoint?.rapporteur_id) return null
    const conv = seance.convocataires.find(c => c.member?.id === currentPoint.rapporteur_id)
    return conv?.member || null
  }, [currentPoint, seance.convocataires])

  // Documents for current point
  const currentDocuments: DocumentInfo[] = useMemo(() => {
    if (!currentPoint) return []
    return Array.isArray(currentPoint.documents)
      ? (currentPoint.documents as unknown as DocumentInfo[])
      : []
  }, [currentPoint])

  // ─── Keyboard shortcuts ─────────────────────────────────────────────────
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't trigger if typing in an input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

    switch (e.key.toLowerCase()) {
      case 'k':
      case 'arrowright':
        if (currentPointIndex < totalPoints - 1) setCurrentPointIndex(i => i + 1)
        break
      case 'j':
      case 'arrowleft':
        if (currentPointIndex > 0) setCurrentPointIndex(i => i - 1)
        break
      case 'escape':
        // Cancel / go back
        break
    }
  }, [currentPointIndex, totalPoints])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // ─── Auto-refresh every 5 seconds ───────────────────────────────────────
  const { secondsSinceRefresh, isRefreshing } = useAutoRefresh({ intervalMs: 5000 })

  // ─── Handlers ─────────────────────────────────────────────────────────
  function handleStatusChange(newStatut: string) {
    startTransition(async () => {
      const result = await updateSeanceStatut(
        seance.id,
        newStatut as 'BROUILLON' | 'CONVOQUEE' | 'EN_COURS' | 'SUSPENDUE' | 'CLOTUREE' | 'ARCHIVEE'
      )
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success(
          newStatut === 'CLOTUREE' ? 'Séance clôturée' :
          newStatut === 'SUSPENDUE' ? 'Séance suspendue' :
          newStatut === 'EN_COURS' ? 'Séance reprise' :
          'Statut mis à jour'
        )
        router.refresh()
      }
      setStatusDialog(null)
    })
  }

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">

      {/* ═══ Top bar ═══ */}
      <header className="bg-white border-b shadow-sm px-4 py-2 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push(`/seances/${seance.id}`)} title="Retour à la séance">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-base font-bold leading-tight">{seance.titre}</h1>
            <p className="text-xs text-muted-foreground">{seance.instance_config?.nom} — Conduite de séance</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Live clock + session duration */}
          <div className="text-right mr-2 hidden sm:block">
            <p className="text-sm font-mono font-bold tabular-nums">
              {currentTime?.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) ?? '--:--:--'}
            </p>
            {sessionDuration && (
              <p className="text-[10px] text-muted-foreground flex items-center gap-1 justify-end">
                <Clock className="h-2.5 w-2.5" />
                Séance : {sessionDuration}
              </p>
            )}
          </div>

          {/* Auto-refresh indicator */}
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground" title="Les données se rafraîchissent automatiquement toutes les 5 secondes">
            <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin text-blue-500' : ''}`} />
            <span className="tabular-nums hidden sm:inline">
              {isRefreshing ? 'Mise a jour...' : `il y a ${secondsSinceRefresh}s`}
            </span>
          </div>

          <Separator orientation="vertical" className="h-6" />

          {/* Quick links to other screens */}
          <Button
            variant="outline" size="sm"
            onClick={() => window.open(`/seances/${seance.id}/grande-scene`, '_blank')}
            title="Ouvrir la Grande Scène (vidéoprojecteur) dans un nouvel onglet"
          >
            <Monitor className="h-4 w-4 mr-1.5" />
            Grande Scène
          </Button>
          <Button
            variant="outline" size="sm"
            onClick={() => window.open(`/seances/${seance.id}/tablette`, '_blank')}
            title="Ouvrir la vue tablette élu dans un nouvel onglet"
          >
            <Tablet className="h-4 w-4 mr-1.5" />
            Vue élu
          </Button>
          <Button
            variant="outline" size="sm"
            onClick={() => router.push(`/seances/${seance.id}/emargement`)}
            title="Ouvrir l'émargement tablette"
          >
            <PenLine className="h-4 w-4 mr-1.5" />
            Émargement
          </Button>

          <Separator orientation="vertical" className="h-6" />

          {/* Session controls */}
          {seance.statut === 'CONVOQUEE' && (
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setStatusDialog('EN_COURS')} title="Ouvrir officiellement la séance">
              <Play className="h-4 w-4 mr-1.5" />
              Ouvrir la séance
            </Button>
          )}
          {seance.statut === 'EN_COURS' && (
            <>
              <Button variant="outline" size="sm" onClick={() => setStatusDialog('SUSPENDUE')} title="Suspendre temporairement la séance">
                <Pause className="h-4 w-4 mr-1.5" />
                Suspendre
              </Button>
              <Button size="sm" className="bg-purple-600 hover:bg-purple-700" onClick={() => setStatusDialog('CLOTUREE')} title="Clôturer définitivement la séance">
                <Square className="h-4 w-4 mr-1.5" />
                Clôturer
              </Button>
            </>
          )}
          {seance.statut === 'SUSPENDUE' && (
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setStatusDialog('EN_COURS')} title="Reprendre la séance">
              <Play className="h-4 w-4 mr-1.5" />
              Reprendre
            </Button>
          )}

          <Badge className={`text-xs px-2 py-0.5 ${
            seance.statut === 'EN_COURS' ? 'bg-emerald-100 text-emerald-700' :
            seance.statut === 'SUSPENDUE' ? 'bg-amber-100 text-amber-700' :
            seance.statut === 'CLOTUREE' ? 'bg-purple-100 text-purple-700' :
            'bg-slate-100 text-slate-600'
          }`}>
            {seance.statut === 'EN_COURS' ? '● En cours' :
             seance.statut === 'SUSPENDUE' ? '⏸ Suspendue' :
             seance.statut === 'CLOTUREE' ? 'Clôturée' :
             seance.statut || 'Brouillon'}
          </Badge>
        </div>
      </header>

      {/* ═══ Quorum alert banner — impossible to miss ═══ */}
      {!quorum.reached && seance.statut === 'EN_COURS' && (
        <div className="bg-red-600 text-white px-6 py-3 flex items-center justify-center gap-3 animate-pulse">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-bold">
            QUORUM NON ATTEINT — {quorum.presents} présent{quorum.presents > 1 ? 's' : ''} sur {quorum.required} requis (manque {quorum.required - quorum.presents})
          </p>
          <AlertTriangle className="h-5 w-5 shrink-0" />
        </div>
      )}

      {/* ═══ Main content ═══ */}
      <div className="flex-1 flex">

        {/* ─── Left: Current point ─── */}
        <div className="flex-1 p-6 overflow-y-auto">

          {/* Point navigation */}
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="outline"
              onClick={() => setCurrentPointIndex(i => i - 1)}
              disabled={currentPointIndex === 0}
              className="gap-1.5"
            >
              <ChevronLeft className="h-4 w-4" /> Précédent
            </Button>

            <div className="flex items-center gap-2">
              {sortedPoints.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentPointIndex(idx)}
                  className={`h-3 w-3 rounded-full transition-all ${
                    idx === currentPointIndex
                      ? 'bg-institutional-blue scale-125'
                      : idx < currentPointIndex
                        ? 'bg-emerald-400'
                        : 'bg-slate-300'
                  }`}
                  title={`Point ${idx + 1}`}
                />
              ))}
            </div>

            <Button
              onClick={() => setCurrentPointIndex(i => i + 1)}
              disabled={currentPointIndex >= totalPoints - 1}
              className="gap-1.5"
            >
              Suivant <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Current point card */}
          {currentPoint ? (
            <Card className="border-2">
              <CardContent className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold ${
                        isVotable ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {currentPoint.position}
                      </span>
                      <div>
                        <Badge className={`${TYPE_LABELS[currentPoint.type_traitement || 'DELIBERATION']?.color || 'bg-slate-100'} border-0`}>
                          {TYPE_LABELS[currentPoint.type_traitement || 'DELIBERATION']?.label}
                        </Badge>
                        {isVotable && (
                          <Badge className="bg-blue-50 text-blue-700 border-0 ml-1">
                            <Vote className="h-3 w-3 mr-0.5" /> Soumis au vote
                          </Badge>
                        )}
                        {currentPoint.huis_clos && (
                          <Badge variant="outline" className="border-red-200 text-red-600 ml-1">
                            <Lock className="h-3 w-3 mr-0.5" /> Huis clos
                          </Badge>
                        )}
                      </div>
                    </div>
                    <h2 className="text-xl font-bold">{currentPoint.titre}</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Point {currentPointIndex + 1} sur {totalPoints}
                    </p>
                  </div>

                  {/* Majority info */}
                  {isVotable && currentPoint.majorite_requise && (
                    <div className="text-right">
                      <Badge variant="outline" className="text-xs">
                        {MAJORITE_LABELS[currentPoint.majorite_requise] || currentPoint.majorite_requise}
                      </Badge>
                      {currentPoint.majorite_requise !== 'SIMPLE' && (
                        <p className="text-xs text-amber-600 mt-1 flex items-center gap-1 justify-end">
                          <AlertTriangle className="h-3 w-3" />
                          Majorité renforcée
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <Separator className="my-4" />

                {/* Rapporteur */}
                {currentRapporteur && (
                  <div className="flex items-center gap-2 mb-4 text-sm">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Rapporteur :</span>
                    <span className="font-medium">{currentRapporteur.prenom} {currentRapporteur.nom}</span>
                  </div>
                )}

                {/* Description */}
                {currentPoint.description && (
                  <div className="mb-4">
                    <p className="text-sm text-muted-foreground">{currentPoint.description}</p>
                  </div>
                )}

                {/* Projet de délibération */}
                {currentPoint.projet_deliberation && (
                  <div className="mb-4 rounded-lg bg-blue-50 border border-blue-200 p-4">
                    <h3 className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-1.5">
                      <FileText className="h-4 w-4" />
                      Projet de délibération
                    </h3>
                    <p className="text-sm text-blue-900 whitespace-pre-line leading-relaxed">
                      {currentPoint.projet_deliberation}
                    </p>
                  </div>
                )}

                {/* Documents */}
                {currentDocuments.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-muted-foreground mb-2">Documents joints</h3>
                    <div className="flex flex-wrap gap-2">
                      {currentDocuments.map((doc, i) => (
                        <Badge key={i} variant="outline" className="gap-1.5 py-1 px-2">
                          <FileText className="h-3 w-3" />
                          {doc.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {currentPoint.notes_seance && (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                    <p className="text-sm text-amber-800">
                      <strong>Note :</strong> {currentPoint.notes_seance}
                    </p>
                  </div>
                )}

                <Separator className="my-4" />

                {/* Vote action area */}
                {isVotable && seance.statut === 'EN_COURS' && (() => {
                  // Find existing vote for this point
                  const existingVote = (seance.votes || []).find(
                    v => v.odj_point_id === currentPoint.id && v.statut !== 'ANNULE'
                  ) || null

                  // Build list of present members for name selection
                  const presentMembersList = seance.presences
                    .filter(p => (p.statut === 'PRESENT' || p.statut === 'PROCURATION') && !p.heure_depart)
                    .map(p => {
                      const conv = seance.convocataires.find(c => c.member_id === p.member_id)
                      return conv?.member ? {
                        id: conv.member.id,
                        prenom: conv.member.prenom,
                        nom: conv.member.nom,
                      } : null
                    })
                    .filter((m): m is { id: string; prenom: string; nom: string } => m !== null)

                  return (
                    <VoteMainLevee
                      seanceId={seance.id}
                      odjPointId={currentPoint.id}
                      odjPointTitre={currentPoint.titre}
                      odjPointMajorite={currentPoint.majorite_requise || 'SIMPLE'}
                      totalPresents={presentMembersList.length}
                      voixPreponderante={seance.instance_config?.voix_preponderante ?? false}
                      presentMembers={presentMembersList}
                      existingVote={existingVote}
                      onVoteComplete={() => router.refresh()}
                    />
                  )
                })()}

                {!isVotable && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Eye className="h-4 w-4" />
                    <p className="text-sm">Point d&apos;information — pas de vote</p>
                  </div>
                )}

                {currentPoint.type_traitement === 'QUESTION_DIVERSE' && (
                  <div className="flex items-center gap-2 text-amber-600 bg-amber-50 rounded-lg p-3 mt-2">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <p className="text-sm">Questions diverses — aucun vote autorisé (CGCT L2121-10)</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="text-lg">Aucun point à l&apos;ordre du jour</p>
            </div>
          )}

          {/* Next point preview */}
          {currentPointIndex < totalPoints - 1 && (
            <button
              onClick={() => setCurrentPointIndex(i => i + 1)}
              className="mt-4 w-full text-left rounded-lg border border-dashed p-3 hover:bg-muted/50 transition-colors group"
            >
              <p className="text-xs text-muted-foreground mb-0.5">Point suivant :</p>
              <p className="text-sm font-medium group-hover:text-institutional-blue transition-colors">
                {sortedPoints[currentPointIndex + 1]?.position}. {sortedPoints[currentPointIndex + 1]?.titre}
              </p>
            </button>
          )}
        </div>

        {/* ─── Right sidebar: Quorum + Presences + Quick actions ─── */}
        <aside className="w-80 border-l bg-white p-4 overflow-y-auto flex flex-col gap-4">

          {/* Quorum gauge */}
          <div className={`rounded-xl p-4 ${
            quorum.reached ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold flex items-center gap-1.5">
                <Shield className={`h-4 w-4 ${quorum.reached ? 'text-emerald-600' : 'text-red-600'}`} />
                Quorum
              </span>
              {quorum.reached ? (
                <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">
                  <CheckCircle2 className="h-3 w-3 mr-0.5" /> Atteint
                </Badge>
              ) : (
                <Badge className="bg-red-100 text-red-700 border-0 text-xs">
                  <AlertTriangle className="h-3 w-3 mr-0.5" /> Manque {quorum.required - quorum.presents}
                </Badge>
              )}
            </div>
            <div className="text-2xl font-bold text-center my-2">
              {quorum.presents} / {quorum.required}
            </div>
            <div className="w-full bg-white/60 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  quorum.reached ? 'bg-emerald-500' : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(100, quorum.required > 0 ? (quorum.presents / quorum.required) * 100 : 0)}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground text-center mt-1.5">
              {quorum.label} • {quorum.total} membres
            </p>
          </div>

          {/* Presence summary */}
          <div className="rounded-xl border p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
              <Users className="h-4 w-4 text-muted-foreground" />
              Présences
            </h3>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="rounded-lg bg-emerald-50 p-2">
                <p className="text-lg font-bold text-emerald-700">{presenceStats.presents}</p>
                <p className="text-[10px] text-emerald-600">Présents</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-2">
                <p className="text-lg font-bold text-slate-600">{presenceStats.absent}</p>
                <p className="text-[10px] text-slate-500">Absents</p>
              </div>
              <div className="rounded-lg bg-blue-50 p-2">
                <p className="text-lg font-bold text-blue-600">{presenceStats.procurations}</p>
                <p className="text-[10px] text-blue-500">Procurations</p>
              </div>
              <div className="rounded-lg bg-amber-50 p-2">
                <p className="text-lg font-bold text-amber-600">{presenceStats.excuses}</p>
                <p className="text-[10px] text-amber-500">Excusés</p>
              </div>
            </div>

            {seance.statut === 'EN_COURS' && (
              <div className="mt-3 text-center">
                <p className="text-xs text-muted-foreground">
                  <strong>{votantsCount}</strong> votant{votantsCount > 1 ? 's' : ''} (présents + procurations)
                </p>
              </div>
            )}
          </div>

          {/* Session info */}
          <div className="rounded-xl border p-4 space-y-2">
            <h3 className="text-sm font-semibold">Séance</h3>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Président(e)</span>
                <span className="font-medium">
                  {seance.president_effectif
                    ? `${seance.president_effectif.prenom} ${seance.president_effectif.nom}`
                    : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Secrétaire</span>
                <span className={`font-medium ${!seance.secretaire_seance ? 'text-amber-600' : ''}`}>
                  {seance.secretaire_seance
                    ? `${seance.secretaire_seance.prenom} ${seance.secretaire_seance.nom}`
                    : '⚠ Non désigné'}
                </span>
              </div>
              {seance.heure_ouverture && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Ouverture</span>
                  <span className="font-medium">
                    {new Date(seance.heure_ouverture).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}
              {seance.instance_config?.voix_preponderante && (
                <div className="flex items-center gap-1 text-blue-600 mt-1">
                  <Shield className="h-3 w-3" />
                  Voix prépondérante du président
                </div>
              )}
            </div>
          </div>

          {/* ODJ overview */}
          <div className="rounded-xl border p-4">
            <h3 className="text-sm font-semibold mb-2">Ordre du jour</h3>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {sortedPoints.map((point, idx) => {
                const isActive = idx === currentPointIndex
                const pointIsVotable = !point.votes_interdits && (
                  point.type_traitement === 'DELIBERATION' ||
                  point.type_traitement === 'ELECTION' ||
                  point.type_traitement === 'APPROBATION_PV'
                )
                return (
                  <button
                    key={point.id}
                    onClick={() => setCurrentPointIndex(idx)}
                    className={`w-full text-left flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors ${
                      isActive ? 'bg-institutional-blue/10 text-institutional-blue font-semibold' : 'hover:bg-muted/50'
                    }`}
                  >
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold shrink-0 ${
                      isActive ? 'bg-institutional-blue text-white' :
                      pointIsVotable ? 'bg-blue-100 text-blue-700' : 'bg-muted'
                    }`}>
                      {point.position}
                    </span>
                    <span className="truncate">{point.titre}</span>
                    {pointIsVotable && !isActive && (
                      <Vote className="h-3 w-3 text-blue-500 shrink-0 ml-auto" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Keyboard shortcuts help */}
          <div className="rounded-xl border p-3 text-xs text-muted-foreground">
            <p className="font-medium mb-1">Raccourcis clavier</p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
              <span><kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">←</kbd> Précédent</span>
              <span><kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">→</kbd> Suivant</span>
              <span><kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Esc</kbd> Annuler</span>
            </div>
            <p className="text-[10px] text-muted-foreground/60 mt-1">
              Vote : <kbd className="px-1 bg-muted rounded">U</kbd> unanimité · <kbd className="px-1 bg-muted rounded">V</kbd> vote · <kbd className="px-1 bg-muted rounded">Entrée</kbd> clôturer
            </p>
          </div>
        </aside>
      </div>

      {/* ═══ Bottom bar: always visible "Next point" ═══ */}
      <footer className="bg-white border-t px-6 py-3 flex items-center justify-between sticky bottom-0 z-10">
        <div className="text-sm text-muted-foreground">
          Point <strong>{currentPointIndex + 1}</strong> / {totalPoints}
          {currentPoint && (
            <span className="ml-2">— {currentPoint.titre}</span>
          )}
        </div>
        <Button
          onClick={() => setCurrentPointIndex(i => i + 1)}
          disabled={currentPointIndex >= totalPoints - 1}
          className="gap-2 px-6"
        >
          Point suivant <ChevronRight className="h-4 w-4" />
        </Button>
      </footer>

      {/* ═══ Status change dialog ═══ */}
      <AlertDialog open={!!statusDialog} onOpenChange={() => setStatusDialog(null)}>
        <AlertDialogContent aria-describedby={undefined}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {statusDialog === 'EN_COURS' && seance.statut === 'CONVOQUEE' && 'Ouvrir la séance ?'}
              {statusDialog === 'EN_COURS' && seance.statut === 'SUSPENDUE' && 'Reprendre la séance ?'}
              {statusDialog === 'SUSPENDUE' && 'Suspendre la séance ?'}
              {statusDialog === 'CLOTUREE' && 'Clôturer la séance ?'}
            </AlertDialogTitle>
            <div className="space-y-2 mt-2">
              {statusDialog === 'EN_COURS' && seance.statut === 'CONVOQUEE' && (
                <>
                  <p className="text-sm text-muted-foreground">
                    La séance sera officiellement ouverte. L&apos;heure d&apos;ouverture sera enregistrée.
                  </p>
                  <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 space-y-1 text-xs text-blue-700">
                    <p className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3" /> Les votes pourront commencer</p>
                    <p className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3" /> Le quorum sera vérifié en continu</p>
                    <p className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3" /> La Grande Scène affichera le point en cours</p>
                  </div>
                  {!quorum.reached && (
                    <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                      <p className="text-xs text-red-700 flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        Attention : le quorum n&apos;est pas encore atteint ({quorum.presents}/{quorum.required})
                      </p>
                    </div>
                  )}
                </>
              )}
              {statusDialog === 'EN_COURS' && seance.statut === 'SUSPENDUE' && (
                <p className="text-sm text-muted-foreground">
                  La séance reprendra là où elle a été suspendue.
                </p>
              )}
              {statusDialog === 'CLOTUREE' && (
                <>
                  <p className="text-sm text-muted-foreground">
                    La séance sera définitivement clôturée. Plus aucun vote ne sera possible.
                  </p>
                  {!seance.secretaire_seance && (
                    <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                      <p className="text-xs text-amber-700 flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        Aucun secrétaire de séance désigné.
                      </p>
                    </div>
                  )}
                </>
              )}
              {statusDialog === 'SUSPENDUE' && (
                <p className="text-sm text-muted-foreground">
                  La séance sera suspendue temporairement. Vous pourrez la reprendre à tout moment.
                </p>
              )}
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => statusDialog && handleStatusChange(statusDialog)}
              disabled={isPending}
              className={statusDialog === 'CLOTUREE' ? 'bg-purple-600 hover:bg-purple-700' : ''}
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {statusDialog === 'SUSPENDUE' && 'Suspendre'}
              {statusDialog === 'CLOTUREE' && 'Clôturer définitivement'}
              {statusDialog === 'EN_COURS' && seance.statut === 'CONVOQUEE' && 'Ouvrir la séance'}
              {statusDialog === 'EN_COURS' && seance.statut === 'SUSPENDUE' && 'Reprendre'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
