'use client'

import { useState, useTransition, useCallback } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  XCircle,
  MinusCircle,
  Loader2,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { submitSecretBallot } from '@/lib/actions/votes'

// ─── Types ───────────────────────────────────────────────────────────────────

type VoteChoice = 'POUR' | 'CONTRE' | 'ABSTENTION'

interface Mandant {
  id: string
  prenom: string
  nom: string
}

interface VoteSecretBallotProps {
  voteId: string
  voteQuestion: string
  memberId: string
  hasVoted: boolean
  mandants: Mandant[]
  onVoteSubmitted?: () => void
}

type BallotState = 'choosing' | 'confirming' | 'submitting' | 'voted' | 'procuration'

// ─── Choice config ───────────────────────────────────────────────────────────

const CHOICE_CONFIG: Record<VoteChoice, {
  label: string
  icon: typeof CheckCircle2
  bgClass: string
  hoverClass: string
  activeClass: string
  confirmBg: string
}> = {
  POUR: {
    label: 'POUR',
    icon: CheckCircle2,
    bgClass: 'bg-emerald-600 text-white',
    hoverClass: 'hover:bg-emerald-700',
    activeClass: 'active:scale-[0.97]',
    confirmBg: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  },
  CONTRE: {
    label: 'CONTRE',
    icon: XCircle,
    bgClass: 'bg-red-600 text-white',
    hoverClass: 'hover:bg-red-700',
    activeClass: 'active:scale-[0.97]',
    confirmBg: 'bg-red-50 border-red-200 text-red-700',
  },
  ABSTENTION: {
    label: 'ABSTENTION',
    icon: MinusCircle,
    bgClass: 'bg-amber-500 text-white',
    hoverClass: 'hover:bg-amber-600',
    activeClass: 'active:scale-[0.97]',
    confirmBg: 'bg-amber-50 border-amber-200 text-amber-700',
  },
}

// ─── Component ───────────────────────────────────────────────────────────────

export function VoteSecretBallot({
  voteId,
  voteQuestion,
  memberId,
  hasVoted: initialHasVoted,
  mandants,
  onVoteSubmitted,
}: VoteSecretBallotProps) {
  const [isPending, startTransition] = useTransition()

  // State machine
  const initialState: BallotState = initialHasVoted
    ? (mandants.length > 0 ? 'procuration' : 'voted')
    : 'choosing'

  const [state, setState] = useState<BallotState>(initialState)
  const [selectedChoice, setSelectedChoice] = useState<VoteChoice | null>(null)

  // Track procurations progress
  const [currentMandantIndex, setCurrentMandantIndex] = useState(0)
  const [ownVoteDone, setOwnVoteDone] = useState(initialHasVoted)
  const [allProcurationsDone, setAllProcurationsDone] = useState(false)

  const currentMandant = mandants[currentMandantIndex] || null

  // ─── Handlers ──────────────────────────────────────────────────────────

  const handleChoiceSelect = useCallback((choice: VoteChoice) => {
    setSelectedChoice(choice)
    setState('confirming')
  }, [])

  const handleCancelConfirm = useCallback(() => {
    setSelectedChoice(null)
    if (state === 'confirming' && ownVoteDone && currentMandant) {
      setState('procuration')
    } else {
      setState(ownVoteDone ? 'procuration' : 'choosing')
    }
  }, [state, ownVoteDone, currentMandant])

  const handleConfirmVote = useCallback(() => {
    if (!selectedChoice) return

    const votingForMemberId = state === 'confirming' && ownVoteDone && currentMandant
      ? currentMandant.id
      : memberId

    setState('submitting')
    startTransition(async () => {
      const result = await submitSecretBallot(voteId, votingForMemberId, selectedChoice)
      if ('error' in result) {
        toast.error(result.error)
        setState(ownVoteDone ? 'procuration' : 'choosing')
        setSelectedChoice(null)
        return
      }

      // Was this the member's own vote or a procuration?
      if (!ownVoteDone) {
        // Own vote done
        setOwnVoteDone(true)
        setSelectedChoice(null)

        if (mandants.length > 0) {
          // Move to procuration voting
          setState('voted') // brief "voted" screen before procuration
        } else {
          setState('voted')
          onVoteSubmitted?.()
        }
      } else {
        // Procuration vote done
        setSelectedChoice(null)
        const nextIndex = currentMandantIndex + 1

        if (nextIndex < mandants.length) {
          setCurrentMandantIndex(nextIndex)
          setState('procuration')
        } else {
          // All procurations done
          setAllProcurationsDone(true)
          setState('voted')
          onVoteSubmitted?.()
        }
      }
    })
  }, [selectedChoice, state, ownVoteDone, currentMandant, memberId, voteId, mandants.length, currentMandantIndex, onVoteSubmitted])

  // Move from "voted" screen to procuration if mandants exist
  const handleProceedToProcuration = useCallback(() => {
    setState('procuration')
  }, [])

  // ─── Render: Vote buttons ──────────────────────────────────────────────

  function renderVoteButtons() {
    return (
      <div className="space-y-4">
        {(['POUR', 'CONTRE', 'ABSTENTION'] as VoteChoice[]).map((choice) => {
          const config = CHOICE_CONFIG[choice]
          const Icon = config.icon
          return (
            <button
              key={choice}
              onClick={() => handleChoiceSelect(choice)}
              disabled={isPending}
              title={isPending ? 'Traitement en cours...' : undefined}
              className={`
                w-full h-20 rounded-2xl flex items-center justify-center gap-4
                text-2xl font-bold transition-all duration-150
                ${config.bgClass} ${config.hoverClass} ${config.activeClass}
                disabled:opacity-50 disabled:cursor-not-allowed
                focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-offset-2 focus-visible:ring-purple-400
              `}
              style={{ minHeight: '80px' }}
            >
              <Icon className="h-8 w-8" />
              {config.label}
            </button>
          )
        })}
      </div>
    )
  }

  // ─── Render: CHOOSING state ────────────────────────────────────────────

  if (state === 'choosing') {
    return (
      <div className="flex flex-col gap-6 p-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 text-purple-700">
            <Lock className="h-6 w-6" />
            <h2 className="text-xl font-bold">Vote à bulletin secret</h2>
          </div>
          <p className="text-base text-muted-foreground leading-relaxed">
            {voteQuestion}
          </p>
        </div>

        {/* Vote buttons */}
        {renderVoteButtons()}

        {/* Confidentiality footer */}
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="h-4 w-4" />
          <span>Votre vote est anonyme et confidentiel</span>
        </div>
      </div>
    )
  }

  // ─── Render: SUBMITTING state ──────────────────────────────────────────

  if (state === 'submitting') {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 space-y-4">
        <Loader2 className="h-12 w-12 animate-spin text-purple-600" />
        <p className="text-lg font-medium text-purple-700">Enregistrement de votre vote...</p>
        <p className="text-sm text-muted-foreground">Veuillez patienter</p>
      </div>
    )
  }

  // ─── Render: VOTED state ───────────────────────────────────────────────

  if (state === 'voted') {
    const hasPendingProcurations = mandants.length > 0 && !allProcurationsDone && ownVoteDone

    return (
      <div className="flex flex-col items-center justify-center py-10 px-6 space-y-6">
        {/* Success card */}
        <div className="w-full rounded-2xl bg-emerald-50 border-2 border-emerald-200 p-8 text-center space-y-4">
          <CheckCircle2 className="h-16 w-16 text-emerald-600 mx-auto" />
          <h2 className="text-2xl font-bold text-emerald-800">
            Vote enregistré
          </h2>
          <p className="text-base text-emerald-700">
            Votre vote a été enregistré de manière anonyme
          </p>
          <div className="flex items-center justify-center gap-2">
            <Lock className="h-4 w-4 text-emerald-600" />
            <Badge className="bg-emerald-100 text-emerald-700 border-0">
              Confidentiel
            </Badge>
          </div>
        </div>

        {/* Procuration prompt */}
        {hasPendingProcurations && (
          <div className="w-full rounded-2xl bg-blue-50 border-2 border-blue-200 p-6 text-center space-y-4">
            <div className="flex items-center justify-center gap-2 text-blue-700">
              <Users className="h-6 w-6" />
              <h3 className="text-lg font-bold">Procuration</h3>
            </div>
            <p className="text-base text-blue-700">
              Vous avez {mandants.length - currentMandantIndex} procuration{mandants.length - currentMandantIndex > 1 ? 's' : ''} à exercer
            </p>
            <Button
              onClick={handleProceedToProcuration}
              className="w-full h-16 text-lg bg-blue-600 hover:bg-blue-700"
              style={{ minHeight: '64px' }}
            >
              <Users className="h-5 w-5 mr-2" />
              Voter pour {currentMandant?.prenom} {currentMandant?.nom}
            </Button>
          </div>
        )}
      </div>
    )
  }

  // ─── Render: PROCURATION state ─────────────────────────────────────────

  if (state === 'procuration' && currentMandant) {
    return (
      <div className="flex flex-col gap-6 p-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="rounded-2xl border-2 border-blue-300 bg-blue-50 p-4 space-y-1">
            <div className="flex items-center justify-center gap-2 text-blue-700">
              <Users className="h-5 w-5" />
              <span className="text-sm font-semibold">Procuration</span>
            </div>
            <h2 className="text-xl font-bold text-blue-800">
              Vote pour {currentMandant.prenom} {currentMandant.nom}
            </h2>
            {mandants.length > 1 && (
              <p className="text-xs text-blue-600">
                Procuration {currentMandantIndex + 1} / {mandants.length}
              </p>
            )}
          </div>
          <p className="text-base text-muted-foreground leading-relaxed">
            {voteQuestion}
          </p>
        </div>

        {/* Vote buttons */}
        {renderVoteButtons()}

        {/* Confidentiality footer */}
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="h-4 w-4" />
          <span>Ce vote est anonyme et confidentiel</span>
        </div>
      </div>
    )
  }

  // ─── Render: CONFIRMING state (AlertDialog) ────────────────────────────

  // This renders as an overlay on top of the choosing/procuration state
  // We need a base render for the dialog to attach to
  const isConfirmingProcuration = ownVoteDone && currentMandant
  const confirmTitle = isConfirmingProcuration
    ? `Confirmer le vote pour ${currentMandant?.prenom} ${currentMandant?.nom}`
    : 'Confirmez votre vote'

  return (
    <>
      {/* Background: show buttons (disabled feel) */}
      <div className="flex flex-col gap-6 p-6 opacity-50 pointer-events-none">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 text-purple-700">
            <Lock className="h-6 w-6" />
            <h2 className="text-xl font-bold">
              {isConfirmingProcuration ? `Vote pour ${currentMandant?.prenom} ${currentMandant?.nom}` : 'Vote à bulletin secret'}
            </h2>
          </div>
        </div>
        {renderVoteButtons()}
      </div>

      {/* Confirmation dialog */}
      <AlertDialog open={state === 'confirming'} onOpenChange={(open) => { if (!open) handleCancelConfirm() }}>
        <AlertDialogContent aria-describedby={undefined}>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-purple-500" />
              {confirmTitle}
            </AlertDialogTitle>
            <div className="space-y-4 mt-3">
              {/* Show selected choice prominently */}
              {selectedChoice && (() => {
                const config = CHOICE_CONFIG[selectedChoice]
                const Icon = config.icon
                return (
                  <div className={`rounded-xl border-2 p-5 text-center ${config.confirmBg}`}>
                    <Icon className="h-10 w-10 mx-auto mb-2" />
                    <p className="text-2xl font-bold">{config.label}</p>
                  </div>
                )
              })()}
              <p className="text-sm text-muted-foreground text-center">
                Votre choix est définitif et ne pourra pas être modifié.
              </p>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending} onClick={handleCancelConfirm}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmVote}
              disabled={isPending}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enregistrement...</>
              ) : (
                <><ShieldCheck className="h-4 w-4 mr-2" /> Confirmer mon vote</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
