'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  Lock,
  CheckCircle2,
  Loader2,
  XCircle,
  Vote,
  Ban,
  Scale,
  Sparkles,
  RotateCcw,
} from 'lucide-react'
import { openVoteSecret, closeVoteSecret, cancelVote } from '@/lib/actions/votes'

// ─── Types ───────────────────────────────────────────────────────────────────

interface VoteData {
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
  voted_count?: number
}

interface VoteSecretProps {
  seanceId: string
  odjPointId: string
  odjPointTitre: string
  odjPointMajorite: string
  totalPresents: number
  voixPreponderante: boolean
  existingVote: VoteData | null
  onVoteComplete?: () => void
}

type Phase = 'idle' | 'waiting' | 'closing' | 'closed'

// ─── Result config ───────────────────────────────────────────────────────────

const RESULTAT_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  ADOPTE: { label: 'Adopté', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  ADOPTE_UNANIMITE: { label: 'Adopté à l\'unanimité', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: Sparkles },
  ADOPTE_VOIX_PREPONDERANTE: { label: 'Adopté (voix prépondérante)', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Scale },
  REJETE: { label: 'Rejeté', color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
  NUL: { label: 'Vote nul', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Ban },
}

// ─── Component ───────────────────────────────────────────────────────────────

export function VoteSecret({
  seanceId,
  odjPointId,
  odjPointTitre,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  odjPointMajorite: _odjPointMajorite,
  totalPresents,
  voixPreponderante,
  existingVote,
  onVoteComplete,
}: VoteSecretProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Determine initial phase from existing vote
  const initialPhase: Phase = existingVote
    ? (existingVote.statut === 'OUVERT' ? 'waiting' : 'closed')
    : 'idle'

  const [phase, setPhase] = useState<Phase>(initialPhase)
  const [voteId, setVoteId] = useState<string | null>(existingVote?.id || null)
  const [totalVotants, setTotalVotants] = useState(existingVote?.total_votants || totalPresents)

  // Track voted count from existingVote (parent refreshes every 3s)
  const votedCount = existingVote?.voted_count ?? 0

  // Confirmation dialog state
  const [confirmType, setConfirmType] = useState<'close_all' | 'close_partial' | 'cancel' | null>(null)

  // Result display
  const [lastResult, setLastResult] = useState<{
    resultat: string
    formulePV: string
  } | null>(
    existingVote?.resultat ? {
      resultat: existingVote.resultat,
      formulePV: existingVote.formule_pv || '',
    } : null
  )

  // Computed
  const allVoted = votedCount >= totalVotants
  const progressPercent = totalVotants > 0 ? Math.round((votedCount / totalVotants) * 100) : 0

  // ─── Handlers ────────────────────────────────────────────────────────────

  function handleOpenVote() {
    startTransition(async () => {
      const result = await openVoteSecret(seanceId, odjPointId)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      setVoteId(result.voteId)
      setTotalVotants(result.totalVotants)
      setPhase('waiting')
      toast.success(`Vote secret ouvert — ${result.totalVotants} votant${result.totalVotants > 1 ? 's' : ''}`)
    })
  }

  function handleCloseVote() {
    if (!voteId) return
    setPhase('closing')
    startTransition(async () => {
      const result = await closeVoteSecret(voteId)
      if ('error' in result) {
        toast.error(result.error)
        setPhase('waiting')
        return
      }
      setLastResult({ resultat: result.resultat, formulePV: result.formulePV })
      setPhase('closed')
      setConfirmType(null)
      toast.success(`Vote clos — ${RESULTAT_CONFIG[result.resultat]?.label || result.resultat}`)
      router.refresh()
      onVoteComplete?.()
    })
  }

  function handleCancel() {
    if (!voteId) return
    startTransition(async () => {
      const result = await cancelVote(voteId)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      setPhase('idle')
      setVoteId(null)
      setConfirmType(null)
      toast.success('Vote secret annulé')
      router.refresh()
    })
  }

  function handleNewVote() {
    if (!voteId) return
    startTransition(async () => {
      // Cancel the existing closed vote before allowing a new one
      const result = await cancelVote(voteId)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      setPhase('idle')
      setVoteId(null)
      setLastResult(null)
      toast.success('Vote précédent annulé — vous pouvez voter à nouveau')
      router.refresh()
    })
  }

  function requestClose() {
    if (allVoted) {
      setConfirmType('close_all')
    } else {
      setConfirmType('close_partial')
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  // Phase: IDLE
  if (phase === 'idle') {
    return (
      <div className="space-y-3">
        <Button
          onClick={handleOpenVote}
          disabled={isPending}
          title={isPending ? 'Traitement en cours...' : undefined}
          className="w-full h-14 text-base gap-3 btn-press bg-purple-600 hover:bg-purple-700"
          size="lg"
        >
          {isPending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Lock className="h-5 w-5" />
          )}
          Ouvrir un vote secret
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          {totalPresents} membre{totalPresents > 1 ? 's' : ''} present{totalPresents > 1 ? 's' : ''}
          {voixPreponderante && ' • Voix prépondérante activée'}
        </p>
      </div>
    )
  }

  // Phase: CLOSED
  if (phase === 'closed' && lastResult) {
    const config = RESULTAT_CONFIG[lastResult.resultat] || RESULTAT_CONFIG.ADOPTE
    const ResultIcon = config.icon

    return (
      <div className="space-y-4">
        {/* Result badge */}
        <div className={`rounded-xl border-2 p-5 text-center ${config.color}`}>
          <ResultIcon className="h-10 w-10 mx-auto mb-2" />
          <p className="text-xl font-bold">{config.label}</p>
          {existingVote && (
            <div className="flex items-center justify-center gap-4 mt-3 text-sm">
              <span>Pour : <strong>{existingVote.pour ?? 0}</strong></span>
              <span>Contre : <strong>{existingVote.contre ?? 0}</strong></span>
              <span>Abstentions : <strong>{existingVote.abstention ?? 0}</strong></span>
            </div>
          )}
          {/* Secret vote: NO names displayed */}
          <p className="text-xs mt-2 opacity-70">
            <Lock className="h-3 w-3 inline mr-1" />
            Vote à bulletin secret — noms non divulgués
          </p>
        </div>

        {/* PV Formula */}
        {lastResult.formulePV && (
          <div className="rounded-lg border bg-blue-50 border-blue-200 p-4">
            <p className="text-xs font-semibold text-blue-700 mb-1">Formule pour le procès-verbal :</p>
            <p className="text-sm text-blue-800 italic leading-relaxed">{lastResult.formulePV}</p>
          </div>
        )}

        {/* Re-vote button — cancels the existing vote first */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleNewVote}
          disabled={isPending}
          className="w-full text-xs text-amber-700 border-amber-300 hover:bg-amber-50"
          title="Annule le vote actuel et permet de voter à nouveau sur ce point"
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
          )}
          Annuler ce vote et voter à nouveau
        </Button>
      </div>
    )
  }

  // Phase: CLOSING (depouillement)
  if (phase === 'closing') {
    return (
      <div className="flex flex-col items-center justify-center py-10 space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-purple-600" />
        <p className="text-base font-medium text-purple-700">Dépouillement en cours...</p>
        <p className="text-xs text-muted-foreground">Comptage des bulletins</p>
      </div>
    )
  }

  // Phase: WAITING (vote in progress)
  return (
    <>
      <div className="space-y-4">
        {/* Header badge */}
        <div className="flex items-center justify-between">
          <Badge className="bg-purple-100 text-purple-700 border-0 animate-pulse">
            <Lock className="h-3 w-3 mr-1" />
            Vote secret en cours
          </Badge>
          <span className="text-xs text-muted-foreground font-medium">
            {totalVotants} votant{totalVotants > 1 ? 's' : ''}
          </span>
        </div>

        {/* Big progress circle */}
        <div className="flex flex-col items-center py-6">
          <div className="relative h-32 w-32 flex items-center justify-center">
            {/* Background ring */}
            <svg className="absolute inset-0 h-32 w-32 -rotate-90" viewBox="0 0 128 128">
              <circle
                cx="64" cy="64" r="56"
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                className="text-purple-100"
              />
              <circle
                cx="64" cy="64" r="56"
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 56}`}
                strokeDashoffset={`${2 * Math.PI * 56 * (1 - progressPercent / 100)}`}
                className="text-purple-600 transition-all duration-500"
              />
            </svg>
            {/* Center text */}
            <div className="text-center z-10">
              <p className="text-3xl font-bold tabular-nums text-purple-700">
                {votedCount}/{totalVotants}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {allVoted ? 'Complet' : 'ont voté'}
              </p>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2.5 bg-purple-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-purple-600 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <Separator />

        {/* Close button */}
        {allVoted ? (
          <Button
            onClick={requestClose}
            disabled={isPending}
            title={isPending ? 'Traitement en cours...' : undefined}
            className="w-full h-12 text-base gap-2 bg-emerald-600 hover:bg-emerald-700"
          >
            <CheckCircle2 className="h-5 w-5" />
            Tous ont voté — Clore le scrutin
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={requestClose}
            disabled={isPending}
            title={isPending ? 'Traitement en cours...' : undefined}
            className="w-full h-12 text-base gap-2"
          >
            <Vote className="h-5 w-5" />
            Clore le scrutin ({votedCount}/{totalVotants})
          </Button>
        )}

        {/* Cancel link */}
        <div className="text-center">
          <button
            onClick={() => setConfirmType('cancel')}
            disabled={isPending}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors underline-offset-2 hover:underline"
          >
            Annuler le vote
          </button>
        </div>
      </div>

      {/* ─── Confirmation dialogs ─── */}

      {/* Close with all voted */}
      <AlertDialog open={confirmType === 'close_all'} onOpenChange={() => setConfirmType(null)}>
        <AlertDialogContent aria-describedby={undefined}>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              Clore le scrutin secret ?
            </AlertDialogTitle>
            <div className="space-y-3 mt-2">
              <p className="text-sm text-muted-foreground">
                Tous les membres ont voté. Le scrutin sur <strong>&quot;{odjPointTitre}&quot;</strong> sera clos et les résultats révélés.
              </p>
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-center">
                <p className="text-lg font-bold text-emerald-700">
                  {totalVotants} bulletin{totalVotants > 1 ? 's' : ''} enregistré{totalVotants > 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCloseVote}
              disabled={isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Dépouillement...</>
              ) : (
                <><Lock className="h-4 w-4 mr-2" /> Clore et dépouiller</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Close with some missing */}
      <AlertDialog open={confirmType === 'close_partial'} onOpenChange={() => setConfirmType(null)}>
        <AlertDialogContent aria-describedby={undefined}>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Vote className="h-5 w-5 text-amber-500" />
              Clore le scrutin malgré les votes manquants ?
            </AlertDialogTitle>
            <div className="space-y-3 mt-2">
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                <p className="text-sm text-amber-800">
                  <strong>Attention :</strong> seulement {votedCount} sur {totalVotants} ont voté.
                  Les non-votants seront comptés comme abstentions.
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                Le scrutin sur <strong>&quot;{odjPointTitre}&quot;</strong> sera clos et les résultats révélés.
              </p>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Attendre</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCloseVote}
              disabled={isPending}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Dépouillement...</>
              ) : (
                <><Lock className="h-4 w-4 mr-2" /> Clore malgré tout</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel vote */}
      <AlertDialog open={confirmType === 'cancel'} onOpenChange={() => setConfirmType(null)}>
        <AlertDialogContent aria-describedby={undefined}>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              Annuler le vote secret ?
            </AlertDialogTitle>
            <div className="space-y-3 mt-2">
              <p className="text-sm text-muted-foreground">
                Les {votedCount > 0 ? `${votedCount} bulletin${votedCount > 1 ? 's' : ''} déjà enregistré${votedCount > 1 ? 's' : ''}` : 'bulletins'} seront supprimés.
                Cette action est irréversible.
              </p>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Retour</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Annulation...</>
              ) : (
                <><XCircle className="h-4 w-4 mr-2" /> Annuler le vote</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
