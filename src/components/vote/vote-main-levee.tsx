'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  CheckCircle2,
  XCircle,
  Minus as MinusIcon,
  Plus as PlusIcon,
  ChevronDown,
  Loader2,
  Vote,
  Hand,
  AlertTriangle,
  Ban,
  Scale,
  Sparkles,
  RotateCcw,
} from 'lucide-react'
import { openVote, closeVoteMainLevee, closeVoteUnanimite, cancelVote } from '@/lib/actions/votes'

// ─── Types ───────────────────────────────────────────────────────────────────

interface PresentMember {
  id: string
  prenom: string
  nom: string
}

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
}

interface VoteMainLeveeProps {
  seanceId: string
  odjPointId: string
  odjPointTitre: string
  odjPointMajorite: string
  totalPresents: number
  voixPreponderante: boolean
  presentMembers: PresentMember[]
  existingVote: VoteData | null
  onVoteComplete?: () => void
}

type Phase = 'idle' | 'open' | 'confirming' | 'closed'

// ─── Result config ───────────────────────────────────────────────────────────

const RESULTAT_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  ADOPTE: { label: 'Adopté', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  ADOPTE_UNANIMITE: { label: 'Adopté à l\'unanimité', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: Sparkles },
  ADOPTE_VOIX_PREPONDERANTE: { label: 'Adopté (voix prépondérante)', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Scale },
  REJETE: { label: 'Rejeté', color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
  NUL: { label: 'Vote nul', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Ban },
}

// ─── Component ───────────────────────────────────────────────────────────────

export function VoteMainLevee({
  seanceId,
  odjPointId,
  odjPointTitre,
  odjPointMajorite,
  totalPresents,
  voixPreponderante,
  presentMembers,
  existingVote,
  onVoteComplete,
}: VoteMainLeveeProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Determine initial phase from existing vote
  const initialPhase: Phase = existingVote
    ? (existingVote.statut === 'OUVERT' ? 'open' : 'closed')
    : 'idle'

  const [phase, setPhase] = useState<Phase>(initialPhase)
  const [voteId, setVoteId] = useState<string | null>(existingVote?.id || null)
  const [totalVotants, setTotalVotants] = useState(existingVote?.total_votants || totalPresents)

  // Vote input state
  const [contre, setContre] = useState(0)
  const [abstentions, setAbstentions] = useState(0)
  const [nomsContre, setNomsContre] = useState<string[]>([])
  const [nomsAbstention, setNomsAbstention] = useState<string[]>([])
  const [detailsOpen, setDetailsOpen] = useState(false)

  // Confirmation dialog
  const [confirmType, setConfirmType] = useState<'unanimite' | 'standard' | null>(null)

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
  const pour = useMemo(() => totalVotants - contre - abstentions, [totalVotants, contre, abstentions])
  const isOverflow = contre + abstentions > totalVotants

  // ─── Handlers ────────────────────────────────────────────────────────────

  function handleOpenVote() {
    startTransition(async () => {
      const result = await openVote(seanceId, odjPointId)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      setVoteId(result.voteId)
      setTotalVotants(result.totalVotants)
      setContre(0)
      setAbstentions(0)
      setNomsContre([])
      setNomsAbstention([])
      setDetailsOpen(false)
      setPhase('open')
      toast.success(`Vote ouvert — ${result.totalVotants} votant${result.totalVotants > 1 ? 's' : ''}`)
    })
  }

  function handleCloseUnanimite() {
    if (!voteId) return
    startTransition(async () => {
      const result = await closeVoteUnanimite(voteId)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      setLastResult({ resultat: result.resultat, formulePV: result.formulePV })
      setPhase('closed')
      setConfirmType(null)
      toast.success('Adopté à l\'unanimité !')
      router.refresh()
      onVoteComplete?.()
    })
  }

  function handleCloseStandard() {
    if (!voteId) return
    startTransition(async () => {
      const result = await closeVoteMainLevee(voteId, {
        contre,
        abstentions,
        nomsContre,
        nomsAbstention,
      })
      if ('error' in result) {
        toast.error(result.error)
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
      toast.success('Vote annulé')
      router.refresh()
    })
  }

  function handleNewVote() {
    setPhase('idle')
    setVoteId(null)
    setLastResult(null)
    setContre(0)
    setAbstentions(0)
    setNomsContre([])
    setNomsAbstention([])
  }

  // Name toggle helpers
  function toggleNameContre(name: string) {
    setNomsContre(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    )
  }

  function toggleNameAbstention(name: string) {
    setNomsAbstention(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    )
  }

  // Members available for each list (can't be in both)
  const membersForContre = presentMembers.filter(m => {
    const fullName = `${m.prenom} ${m.nom}`
    return !nomsAbstention.includes(fullName)
  })
  const membersForAbstention = presentMembers.filter(m => {
    const fullName = `${m.prenom} ${m.nom}`
    return !nomsContre.includes(fullName)
  })

  // ─── Render ──────────────────────────────────────────────────────────────

  // Phase: IDLE — no vote, show button or previous result
  if (phase === 'idle') {
    return (
      <div className="space-y-3">
        <Button
          onClick={handleOpenVote}
          disabled={isPending}
          className="w-full h-14 text-base gap-3"
          size="lg"
        >
          {isPending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Vote className="h-5 w-5" />
          )}
          Ouvrir le vote
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          {totalPresents} membre{totalPresents > 1 ? 's' : ''} présent{totalPresents > 1 ? 's' : ''}
          {voixPreponderante && ' • Voix prépondérante activée'}
        </p>
      </div>
    )
  }

  // Phase: CLOSED — show result
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
              <span>Pour : <strong>{existingVote.pour ?? pour}</strong></span>
              <span>Contre : <strong>{existingVote.contre ?? contre}</strong></span>
              <span>Abstentions : <strong>{existingVote.abstention ?? abstentions}</strong></span>
            </div>
          )}
        </div>

        {/* PV Formula */}
        {lastResult.formulePV && (
          <div className="rounded-lg border bg-blue-50 border-blue-200 p-4">
            <p className="text-xs font-semibold text-blue-700 mb-1">Formule pour le procès-verbal :</p>
            <p className="text-sm text-blue-800 italic leading-relaxed">{lastResult.formulePV}</p>
          </div>
        )}

        {/* Re-vote button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleNewVote}
          className="w-full text-xs"
        >
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
          Voter à nouveau sur ce point
        </Button>
      </div>
    )
  }

  // Phase: OPEN — the main vote interface (3 elements max)
  return (
    <>
      <div className="space-y-3">
        {/* Header: vote status */}
        <div className="flex items-center justify-between">
          <Badge className="bg-emerald-100 text-emerald-700 border-0 animate-pulse">
            <Vote className="h-3 w-3 mr-1" />
            Vote en cours
          </Badge>
          <span className="text-xs text-muted-foreground font-medium">
            {totalVotants} votant{totalVotants > 1 ? 's' : ''}
          </span>
        </div>

        {/* ═══ Element 1: Big UNANIMITÉ button ═══ */}
        <button
          onClick={() => setConfirmType('unanimite')}
          disabled={isPending || contre > 0 || abstentions > 0}
          className={`
            w-full rounded-xl border-2 p-6 text-center transition-all
            ${contre === 0 && abstentions === 0
              ? 'border-emerald-300 bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-400 cursor-pointer'
              : 'border-muted bg-muted/30 opacity-50 cursor-not-allowed'
            }
          `}
          title={contre > 0 || abstentions > 0 ? 'Des voix contre ou abstentions ont été saisies' : 'Adopté sans opposition'}
        >
          <Sparkles className={`h-8 w-8 mx-auto mb-2 ${contre === 0 && abstentions === 0 ? 'text-emerald-600' : 'text-muted-foreground'}`} />
          <p className={`text-lg font-bold ${contre === 0 && abstentions === 0 ? 'text-emerald-700' : 'text-muted-foreground'}`}>
            ADOPTÉ À L&apos;UNANIMITÉ
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Aucune opposition, aucune abstention
          </p>
        </button>

        {/* ═══ Element 2: Opposition / Abstention (collapsible) ═══ */}
        <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between rounded-xl border-2 border-dashed p-4 hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-2">
                <Hand className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium">Opposition / Abstention</span>
                {(contre > 0 || abstentions > 0) && (
                  <Badge variant="secondary" className="text-[10px]">
                    {contre + abstentions} voix
                  </Badge>
                )}
              </div>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${detailsOpen ? 'rotate-180' : ''}`} />
            </button>
          </CollapsibleTrigger>

          <CollapsibleContent className="mt-2 space-y-4 rounded-xl border p-4">
            {/* Contre counter */}
            <div>
              <Label className="text-sm font-medium flex items-center gap-2 mb-2">
                <XCircle className="h-4 w-4 text-red-500" />
                Voix contre
              </Label>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 shrink-0"
                  onClick={() => setContre(Math.max(0, contre - 1))}
                  disabled={contre === 0}
                >
                  <MinusIcon className="h-5 w-5" />
                </Button>
                <div className="flex-1 text-center">
                  <span className="text-3xl font-bold tabular-nums">{contre}</span>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 shrink-0"
                  onClick={() => setContre(Math.min(totalVotants - abstentions, contre + 1))}
                  disabled={contre + abstentions >= totalVotants}
                >
                  <PlusIcon className="h-5 w-5" />
                </Button>
              </div>

              {/* Name selection for contre */}
              {contre > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Noms des opposants ({nomsContre.length}/{contre}) :
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {membersForContre.map(m => {
                      const fullName = `${m.prenom} ${m.nom}`
                      const selected = nomsContre.includes(fullName)
                      return (
                        <button
                          key={m.id}
                          onClick={() => toggleNameContre(fullName)}
                          disabled={!selected && nomsContre.length >= contre}
                          className={`
                            text-xs px-2.5 py-1.5 rounded-full border transition-colors
                            ${selected
                              ? 'bg-red-100 border-red-300 text-red-700 font-medium'
                              : 'hover:bg-muted/50 disabled:opacity-30'
                            }
                          `}
                        >
                          {fullName}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Abstention counter */}
            <div>
              <Label className="text-sm font-medium flex items-center gap-2 mb-2">
                <Ban className="h-4 w-4 text-amber-500" />
                Abstentions
              </Label>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 shrink-0"
                  onClick={() => setAbstentions(Math.max(0, abstentions - 1))}
                  disabled={abstentions === 0}
                >
                  <MinusIcon className="h-5 w-5" />
                </Button>
                <div className="flex-1 text-center">
                  <span className="text-3xl font-bold tabular-nums">{abstentions}</span>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 shrink-0"
                  onClick={() => setAbstentions(Math.min(totalVotants - contre, abstentions + 1))}
                  disabled={contre + abstentions >= totalVotants}
                >
                  <PlusIcon className="h-5 w-5" />
                </Button>
              </div>

              {/* Name selection for abstention */}
              {abstentions > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Noms des abstentionnistes ({nomsAbstention.length}/{abstentions}) :
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {membersForAbstention.map(m => {
                      const fullName = `${m.prenom} ${m.nom}`
                      const selected = nomsAbstention.includes(fullName)
                      return (
                        <button
                          key={m.id}
                          onClick={() => toggleNameAbstention(fullName)}
                          disabled={!selected && nomsAbstention.length >= abstentions}
                          className={`
                            text-xs px-2.5 py-1.5 rounded-full border transition-colors
                            ${selected
                              ? 'bg-amber-100 border-amber-300 text-amber-700 font-medium'
                              : 'hover:bg-muted/50 disabled:opacity-30'
                            }
                          `}
                        >
                          {fullName}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Overflow warning */}
            {isOverflow && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                <p className="text-xs text-red-700 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  Le total contre + abstentions dépasse le nombre de votants ({totalVotants})
                </p>
              </div>
            )}

            {/* Summary + close button */}
            {(contre > 0 || abstentions > 0) && !isOverflow && (
              <div className="space-y-3">
                <div className="rounded-lg bg-muted/50 p-3">
                  <div className="grid grid-cols-3 gap-2 text-center text-sm">
                    <div>
                      <p className="text-2xl font-bold text-emerald-600">{pour}</p>
                      <p className="text-[10px] text-muted-foreground">Pour</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-red-600">{contre}</p>
                      <p className="text-[10px] text-muted-foreground">Contre</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-amber-600">{abstentions}</p>
                      <p className="text-[10px] text-muted-foreground">Abstentions</p>
                    </div>
                  </div>
                </div>

                <Button
                  className="w-full h-12"
                  onClick={() => setConfirmType('standard')}
                  disabled={isPending || isOverflow}
                >
                  <CheckCircle2 className="h-5 w-5 mr-2" />
                  Valider et clore le vote
                </Button>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* ═══ Element 3: Cancel link ═══ */}
        <div className="text-center">
          <button
            onClick={handleCancel}
            disabled={isPending}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors underline-offset-2 hover:underline"
          >
            Annuler le vote
          </button>
        </div>
      </div>

      {/* ─── Confirmation dialogs ─── */}
      <AlertDialog open={confirmType === 'unanimite'} onOpenChange={() => setConfirmType(null)}>
        <AlertDialogContent aria-describedby={undefined}>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-500" />
              Confirmer le vote à l&apos;unanimité ?
            </AlertDialogTitle>
            <div className="space-y-3 mt-2">
              <p className="text-sm text-muted-foreground">
                Le vote sur <strong>&quot;{odjPointTitre}&quot;</strong> sera clos comme adopté à l&apos;unanimité.
              </p>
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-center">
                <p className="text-lg font-bold text-emerald-700">
                  {totalVotants} voix POUR — 0 contre — 0 abstention
                </p>
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCloseUnanimite}
              disabled={isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enregistrement...</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-2" /> Adopté à l&apos;unanimité</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmType === 'standard'} onOpenChange={() => setConfirmType(null)}>
        <AlertDialogContent aria-describedby={undefined}>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Vote className="h-5 w-5 text-blue-500" />
              Confirmer et clore le vote ?
            </AlertDialogTitle>
            <div className="space-y-3 mt-2">
              <p className="text-sm text-muted-foreground">
                Le vote sur <strong>&quot;{odjPointTitre}&quot;</strong> sera clos avec les résultats suivants :
              </p>
              <div className="rounded-lg border p-3">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xl font-bold text-emerald-600">{pour}</p>
                    <p className="text-xs text-muted-foreground">Pour</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-red-600">{contre}</p>
                    <p className="text-xs text-muted-foreground">Contre</p>
                    {nomsContre.length > 0 && (
                      <p className="text-[10px] text-red-600 mt-0.5">{nomsContre.join(', ')}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xl font-bold text-amber-600">{abstentions}</p>
                    <p className="text-xs text-muted-foreground">Abstentions</p>
                    {nomsAbstention.length > 0 && (
                      <p className="text-[10px] text-amber-600 mt-0.5">{nomsAbstention.join(', ')}</p>
                    )}
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Majorité requise : {odjPointMajorite === 'ABSOLUE' ? 'absolue' : odjPointMajorite === 'QUALIFIEE' ? 'qualifiée (2/3)' : 'simple'}
                {voixPreponderante && ' • Voix prépondérante du président activée'}
              </p>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCloseStandard}
              disabled={isPending}
            >
              {isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enregistrement...</>
              ) : (
                <><CheckCircle2 className="h-4 w-4 mr-2" /> Confirmer et clore</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
