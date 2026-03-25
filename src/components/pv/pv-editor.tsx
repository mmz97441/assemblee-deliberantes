'use client'

import { useState, useEffect, useCallback, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  FileText,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  Sparkles,
  Ban,
  Printer,
  Download,
  PenLine,
  Lock,
  Clock,
  AlertTriangle,
  Scale,
  Eye,
  Check,
  ChevronLeft,
  ChevronRight,
  Save,
  ArrowLeft,
} from 'lucide-react'
import {
  generatePVBrouillon,
  savePVContent,
  updatePVStatus,
  signPV,
  type PVContenu,
  type PVSignatureRecord,
} from '@/lib/actions/pv'
import { improvePVSection } from '@/lib/actions/ai-pv'

// ─── Types ───────────────────────────────────────────────────────────────────

interface PVEditorProps {
  seanceId: string
  seanceTitre: string
  seanceStatut: string
  seanceReconvocation?: boolean
  existingPV: {
    id: string
    contenu_json: unknown
    statut: string | null
    version: number | null
    signe_par: unknown
    pdf_url: string | null
  } | null
  canEdit: boolean
  currentUserMemberId: string | null
  presidentMemberId: string | null
  secretaireMemberId: string | null
}

const RESULTAT_LABELS: Record<string, { label: string; icon: typeof CheckCircle2; colorClass: string }> = {
  ADOPTE: { label: 'Adopté', icon: CheckCircle2, colorClass: 'text-emerald-700' },
  ADOPTE_UNANIMITE: { label: 'Unanimité', icon: Sparkles, colorClass: 'text-emerald-700' },
  ADOPTE_VOIX_PREPONDERANTE: { label: 'Voix prépondérante', icon: Scale, colorClass: 'text-blue-700' },
  REJETE: { label: 'Rejeté', icon: XCircle, colorClass: 'text-red-700' },
  NUL: { label: 'Nul', icon: Ban, colorClass: 'text-amber-700' },
}

const TYPE_LABELS: Record<string, string> = {
  DELIBERATION: 'Délibération',
  ELECTION: 'Élection',
  APPROBATION_PV: 'Approbation PV',
  INFORMATION: 'Information',
  QUESTION_DIVERSE: 'Question diverse',
}

const INFORMATION_TYPES = ['INFORMATION', 'QUESTION_DIVERSE']

const AUTO_SAVE_INTERVAL_MS = 30_000

type StepId = 'presences' | 'discussions' | 'observations' | 'relecture' | 'signatures' | 'carence'

const STEP_LABELS: Record<StepId, string> = {
  presences: 'Présences',
  discussions: 'Discussions',
  observations: 'Observations',
  relecture: 'Relecture',
  signatures: 'Signatures',
  carence: 'Carence',
}

// ─── Component ───────────────────────────────────────────────────────────────

export function PVEditor({
  seanceId,
  seanceStatut,
  seanceReconvocation,
  existingPV,
  canEdit,
  currentUserMemberId,
  presidentMemberId,
  secretaireMemberId,
}: PVEditorProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // ─── Core state ──────────────────────────────────────────────────────────
  const [pvId, setPvId] = useState<string | null>(existingPV?.id || null)
  const [contenu, setContenu] = useState<PVContenu | null>(
    existingPV?.contenu_json as PVContenu | null
  )
  const [pvStatut, setPvStatut] = useState(existingPV?.statut || 'BROUILLON')
  const [signatures, setSignatures] = useState<PVSignatureRecord[]>(
    (existingPV?.signe_par as PVSignatureRecord[] | null) || []
  )
  const [pdfUrl] = useState<string | null>(existingPV?.pdf_url || null)

  // ─── Wizard state ─────────────────────────────────────────────────────
  const [currentStep, setCurrentStep] = useState(0)
  const [currentPointIndex, setCurrentPointIndex] = useState(0)
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())

  // ─── Auto-save state ─────────────────────────────────────────────────────
  const [isDirty, setIsDirty] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const contenuRef = useRef(contenu)

  // ─── AI loading per point ──────────────────────────────────────────────
  const [aiLoadingPoint, setAiLoadingPoint] = useState<number | null>(null)
  const [aiLoadingObservations, setAiLoadingObservations] = useState(false)

  // Keep ref in sync
  useEffect(() => {
    contenuRef.current = contenu
  }, [contenu])

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  // ─── Auto-save logic ─────────────────────────────────────────────────────
  const doSave = useCallback(async () => {
    if (!pvId || !contenuRef.current || isSaving) return
    setIsSaving(true)
    try {
      const result = await savePVContent(pvId, contenuRef.current, seanceId)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        setLastSaved(new Date())
        setIsDirty(false)
      }
    } finally {
      setIsSaving(false)
    }
  }, [pvId, seanceId, isSaving])

  useEffect(() => {
    if (!isDirty || !pvId || !canEdit || pvStatut === 'SIGNE' || pvStatut === 'PUBLIE') return

    const timer = setInterval(() => {
      if (isDirty) {
        doSave()
      }
    }, AUTO_SAVE_INTERVAL_MS)

    return () => clearInterval(timer)
  }, [isDirty, pvId, canEdit, pvStatut, doSave])

  // ─── Content update helpers ──────────────────────────────────────────────
  function updateContenu(updates: Partial<PVContenu>) {
    if (!contenu) return
    setContenu({ ...contenu, ...updates })
    setIsDirty(true)
  }

  function updatePointDiscussion(index: number, discussion: string) {
    if (!contenu) return
    const newPoints = [...contenu.points]
    newPoints[index] = { ...newPoints[index], discussion }
    setContenu({ ...contenu, points: newPoints })
    setIsDirty(true)
  }

  // ─── Handlers ──────────────────────────────────────────────────────────
  function handleGenerate() {
    startTransition(async () => {
      const result = await generatePVBrouillon(seanceId)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      setPvId(result.pvId)
      setContenu(result.contenu)
      setPvStatut('BROUILLON')
      setLastSaved(new Date())
      setIsDirty(false)
      setCurrentStep(0)
      setCurrentPointIndex(0)
      setCompletedSteps(new Set())
      toast.success('Brouillon du procès-verbal généré avec succès')
      router.refresh()
    })
  }

  async function handleSaveAndAdvance() {
    if (pvId && contenu && isDirty) {
      setIsSaving(true)
      try {
        const result = await savePVContent(pvId, contenu, seanceId)
        if ('error' in result) {
          toast.error(result.error)
          return
        }
        setLastSaved(new Date())
        setIsDirty(false)
      } finally {
        setIsSaving(false)
      }
    }
  }

  async function handleManualSave() {
    if (!pvId || !contenu) return
    setIsSaving(true)
    try {
      const result = await savePVContent(pvId, contenu, seanceId)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        setLastSaved(new Date())
        setIsDirty(false)
        toast.success('Procès-verbal sauvegardé')
      }
    } finally {
      setIsSaving(false)
    }
  }

  function handleSign() {
    if (!pvId) return
    startTransition(async () => {
      // Save first if dirty
      if (isDirty && contenu) {
        await savePVContent(pvId, contenu, seanceId)
        setIsDirty(false)
      }
      const result = await signPV(pvId, seanceId)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      const newSig: PVSignatureRecord = {
        user_id: '',
        member_id: currentUserMemberId || '',
        nom: '',
        prenom: '',
        role: isCurrentUserPresident ? 'president' : 'secretaire',
        timestamp: new Date().toISOString(),
      }
      setSignatures(prev => [...prev, newSig])

      if (result.bothSigned) {
        setPvStatut('SIGNE')
        toast.success('Procès-verbal signé par les deux parties ! Le PV est désormais verrouillé.')
      } else {
        toast.success('Votre signature a été enregistrée. En attente de la seconde signature.')
      }
      router.refresh()
    })
  }

  function handlePublish() {
    if (!pvId) return
    startTransition(async () => {
      const result = await updatePVStatus(pvId, 'PUBLIE', seanceId)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      setPvStatut('PUBLIE')
      toast.success('Procès-verbal publié')
      router.refresh()
    })
  }

  function handlePrint() {
    window.print()
  }

  // ─── AI Handlers ──────────────────────────────────────────────────────────
  async function handleImproveDiscussion(pointIndex: number) {
    if (!contenu) return
    const point = contenu.points[pointIndex]
    const currentText = point.discussion

    setAiLoadingPoint(pointIndex)
    try {
      const result = await improvePVSection(
        seanceId,
        `point-${pointIndex}`,
        'discussion',
        currentText || ''
      )
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      updatePointDiscussion(pointIndex, result.improvedText)
      toast.success(currentText ? 'Texte reformulé' : 'Texte suggéré')
    } catch {
      toast.error('Erreur lors de la génération IA')
    } finally {
      setAiLoadingPoint(null)
    }
  }

  async function handleImproveObservations() {
    if (!contenu) return
    setAiLoadingObservations(true)
    try {
      const result = await improvePVSection(
        seanceId,
        'observations',
        'discussion',
        contenu.conclusionLibre || ''
      )
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      updateContenu({ conclusionLibre: result.improvedText })
      toast.success(contenu.conclusionLibre ? 'Texte reformulé' : 'Texte suggéré')
    } catch {
      toast.error('Erreur lors de la génération IA')
    } finally {
      setAiLoadingObservations(false)
    }
  }

  // ─── Wizard navigation ────────────────────────────────────────────────────
  const isEditable = canEdit && pvStatut !== 'SIGNE' && pvStatut !== 'PUBLIE'
  const isCurrentUserPresident = currentUserMemberId === presidentMemberId
  const isCurrentUserSecretaire = currentUserMemberId === secretaireMemberId
  const canSignPV = (isCurrentUserPresident || isCurrentUserSecretaire)
    && (pvStatut === 'BROUILLON' || pvStatut === 'EN_RELECTURE')

  const presidentSignature = signatures.find(s => s.role === 'president')
  const secretaireSignature = signatures.find(s => s.role === 'secretaire')
  const bothSigned = !!presidentSignature && !!secretaireSignature

  // Detect PV de carence: quorum not met and no points with votes
  const isCarence = contenu
    ? !contenu.presences.quorum.atteint && contenu.points.every(p => !p.vote)
    : false

  const steps: StepId[] = isCarence
    ? ['presences', 'carence', 'signatures']
    : ['presences', 'discussions', 'observations', 'relecture', 'signatures']

  const totalSteps = steps.length
  const totalPoints = contenu?.points.length || 0

  // Compute progress percentage
  function computeProgress(): number {
    if (totalSteps === 0) return 0
    // Each step gets equal weight, but discussions step tracks sub-progress
    let completed = 0
    for (let i = 0; i < totalSteps; i++) {
      if (completedSteps.has(i)) {
        completed += 1
      } else if (i === currentStep) {
        // Partial progress for current step
        if (steps[i] === 'discussions' && totalPoints > 0) {
          completed += currentPointIndex / totalPoints
        } else {
          completed += 0.1 // just started
        }
      }
    }
    return Math.round((completed / totalSteps) * 100)
  }

  const progressPercent = computeProgress()

  async function goToStep(stepIndex: number) {
    if (stepIndex < 0 || stepIndex >= totalSteps) return
    // Save before transitioning
    await handleSaveAndAdvance()
    // Mark current step as completed if going forward
    if (stepIndex > currentStep) {
      setCompletedSteps(prev => {
        const next = new Set(prev)
        next.add(currentStep)
        return next
      })
    }
    setCurrentStep(stepIndex)
    // Reset point index when entering discussions
    if (steps[stepIndex] === 'discussions') {
      setCurrentPointIndex(0)
    }
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function nextStep() {
    await goToStep(currentStep + 1)
  }

  async function prevStep() {
    await goToStep(currentStep - 1)
  }

  async function nextPoint() {
    if (currentPointIndex < totalPoints - 1) {
      await handleSaveAndAdvance()
      setCurrentPointIndex(prev => prev + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      // Last point: advance to next step
      await nextStep()
    }
  }

  async function prevPoint() {
    if (currentPointIndex > 0) {
      setCurrentPointIndex(prev => prev - 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      await prevStep()
    }
  }

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't interfere when typing in textarea
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return
      if (e.key === 'Escape' && currentStep > 0) {
        prevStep()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep])

  // ─── No PV yet — generate button ──────────────────────────────────────
  if (!contenu) {
    const canGenerate = seanceStatut === 'CLOTUREE' || seanceStatut === 'ARCHIVEE'

    return (
      <div className="max-w-3xl mx-auto">
        <div className="text-center py-16 rounded-xl border border-dashed">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
          <h2 className="text-lg font-semibold mb-2">Procès-verbal</h2>
          {canGenerate ? (
            <>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                La séance est clôturée. Générez le brouillon du procès-verbal automatiquement
                à partir des données de la séance.
              </p>
              <Button
                size="lg"
                onClick={handleGenerate}
                disabled={isPending}
                className="gap-2 min-h-[44px]"
              >
                {isPending ? (
                  <><Loader2 className="h-5 w-5 animate-spin" /> Génération en cours...</>
                ) : (
                  <><Sparkles className="h-5 w-5" /> Générer le procès-verbal</>
                )}
              </Button>
            </>
          ) : (
            <>
              <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                Le procès-verbal pourra être généré une fois la séance clôturée.
              </p>
              <div className="flex items-center justify-center gap-2 text-amber-600">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm">Séance en statut : {seanceStatut}</span>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  // ─── PV already SIGNE or PUBLIE — read-only document view ─────────────
  if (pvStatut === 'SIGNE' || pvStatut === 'PUBLIE') {
    return (
      <TooltipProvider delayDuration={300}>
        <div className="max-w-4xl mx-auto pb-16">
          {/* Top bar */}
          <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b py-3 px-1 print:hidden">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <Badge className={pvStatut === 'SIGNE'
                  ? 'bg-green-100 text-green-700 border-0 font-medium'
                  : 'bg-purple-100 text-purple-700 border-0 font-medium'
                }>
                  <Lock className="h-3 w-3 mr-1" />
                  {pvStatut === 'SIGNE' ? 'Signé' : 'Publié'}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" onClick={handlePrint} className="min-h-[36px]">
                      <Printer className="h-4 w-4" />
                      <span className="hidden sm:inline ml-1.5">Imprimer</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Imprimer le procès-verbal</TooltipContent>
                </Tooltip>
                {pdfUrl && (
                  <Button size="sm" asChild className="min-h-[36px] gap-1.5">
                    <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                      <Download className="h-4 w-4" />
                      Télécharger PDF
                    </a>
                  </Button>
                )}
                {pvStatut === 'SIGNE' && canEdit && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" disabled={isPending} className="min-h-[36px] gap-1.5">
                        <Download className="h-4 w-4" />
                        Publier
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent aria-describedby={undefined}>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Publier le procès-verbal ?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Le procès-verbal signé sera publié et accessible à tous les membres.
                          Cette action est définitive.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={handlePublish}>
                          Publier définitivement
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
          </div>

          {/* Read-only document */}
          <ReadOnlyDocument
            contenu={contenu}
            seanceReconvocation={seanceReconvocation}
            presidentSignature={presidentSignature}
            secretaireSignature={secretaireSignature}
            bothSigned={bothSigned}
            isCarence={isCarence}
          />
        </div>
      </TooltipProvider>
    )
  }

  // ─── WIZARD MODE ──────────────────────────────────────────────────────
  const currentStepId = steps[currentStep]

  return (
    <TooltipProvider delayDuration={300}>
      <div className="max-w-3xl mx-auto pb-16">
        {/* ── Progress Bar (always visible) ────────────────────────────── */}
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b py-4 px-1 print:hidden">
          {/* Progress percentage + save indicator */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground">
                {progressPercent}%
              </span>
              {isSaving && (
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Sauvegarde...
                </span>
              )}
              {!isSaving && lastSaved && !isDirty && (
                <span className="text-xs text-emerald-600 flex items-center gap-1" suppressHydrationWarning>
                  <Check className="h-3 w-3" />
                  Sauvegardé
                </span>
              )}
              {!isSaving && isDirty && (
                <span className="text-xs text-amber-600">Non sauvegardé</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleManualSave}
                    disabled={isPending || isSaving || !isDirty}
                    className="min-h-[36px] h-8"
                  >
                    <Save className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Sauvegarder</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={handlePrint} className="min-h-[36px] h-8">
                    <Printer className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Imprimer le procès-verbal complet</TooltipContent>
              </Tooltip>
              {pdfUrl && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" asChild className="min-h-[36px] h-8">
                      <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                        <Download className="h-4 w-4" />
                      </a>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Télécharger le PDF</TooltipContent>
                </Tooltip>
              )}
              {canEdit && pvStatut === 'BROUILLON' && (
                <AlertDialog>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" disabled={isPending} className="min-h-[36px] h-8">
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Regénérer le brouillon depuis les données de la séance</TooltipContent>
                  </Tooltip>
                  <AlertDialogContent aria-describedby={undefined}>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Regénérer le brouillon ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Le contenu actuel sera remplacé par un nouveau brouillon
                        généré à partir des données actuelles de la séance.
                        Toutes les modifications manuelles seront perdues.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction onClick={handleGenerate}>
                        Regénérer le brouillon
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <Progress value={progressPercent} className="h-2 mb-3" />

          {/* Step indicators */}
          <div className="flex items-center gap-1 overflow-x-auto">
            {steps.map((stepId, idx) => {
              const isCompleted = completedSteps.has(idx)
              const isCurrent = idx === currentStep
              const isClickable = isCompleted || idx <= currentStep

              return (
                <button
                  key={stepId}
                  type="button"
                  onClick={() => isClickable ? goToStep(idx) : undefined}
                  className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full transition-colors whitespace-nowrap min-h-[32px] ${
                    isCurrent
                      ? 'bg-primary text-primary-foreground font-medium'
                      : isCompleted
                        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 cursor-pointer'
                        : 'bg-muted text-muted-foreground'
                  } ${isClickable && !isCurrent ? 'cursor-pointer' : ''}`}
                  disabled={!isClickable}
                >
                  {isCompleted ? (
                    <Check className="h-3 w-3" />
                  ) : isCurrent && stepId === 'discussions' && totalPoints > 0 ? (
                    <span className="text-[10px] font-mono">
                      {currentPointIndex + 1}/{totalPoints}
                    </span>
                  ) : null}
                  {STEP_LABELS[stepId]}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Step Content ──────────────────────────────────────────────── */}
        <div className="mt-6">
          {currentStepId === 'presences' && (
            <StepPresences
              contenu={contenu}
              seanceReconvocation={seanceReconvocation}
              seanceId={seanceId}
              onValidate={() => nextStep()}
            />
          )}

          {currentStepId === 'discussions' && (
            <StepDiscussions
              contenu={contenu}
              currentPointIndex={currentPointIndex}
              totalPoints={totalPoints}
              isEditable={isEditable}
              aiLoadingPoint={aiLoadingPoint}
              onDiscussionChange={updatePointDiscussion}
              onImproveDiscussion={handleImproveDiscussion}
              onNextPoint={nextPoint}
              onPrevPoint={prevPoint}
            />
          )}

          {currentStepId === 'observations' && (
            <StepObservations
              contenu={contenu}
              isEditable={isEditable}
              aiLoading={aiLoadingObservations}
              onChange={(text) => updateContenu({ conclusionLibre: text })}
              onImprove={handleImproveObservations}
              onNext={() => nextStep()}
              onSkip={() => nextStep()}
              onPrev={() => prevStep()}
            />
          )}

          {currentStepId === 'relecture' && (
            <StepRelecture
              contenu={contenu}
              seanceReconvocation={seanceReconvocation}
              onNext={() => nextStep()}
              onGoToStep={goToStep}
              steps={steps}
            />
          )}

          {currentStepId === 'signatures' && (
            <StepSignatures
              contenu={contenu}
              seanceId={seanceId}
              presidentSignature={presidentSignature}
              secretaireSignature={secretaireSignature}
              bothSigned={bothSigned}
              canSignPV={canSignPV}
              isPending={isPending}
              isCurrentUserPresident={isCurrentUserPresident}
              isCurrentUserSecretaire={isCurrentUserSecretaire}
              onSign={handleSign}
              pdfUrl={pdfUrl}
              onPrev={() => prevStep()}
            />
          )}

          {currentStepId === 'carence' && (
            <StepCarence
              contenu={contenu}
              onNext={() => nextStep()}
              onPrev={() => prevStep()}
            />
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}

// ─── Step 1: Presences ───────────────────────────────────────────────────────

function StepPresences({
  contenu,
  seanceReconvocation,
  seanceId,
  onValidate,
}: {
  contenu: PVContenu
  seanceReconvocation?: boolean
  seanceId: string
  onValidate: () => void
}) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-xl font-semibold mb-2">Vérifiez les présences</h2>
        <p className="text-muted-foreground text-sm">
          Confirmez que la liste des présents, excusés et absents est correcte.
        </p>
      </div>

      {/* Reconvocation banner */}
      {(contenu.entete.reconvocation || seanceReconvocation) && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-800">
              Séance de reconvocation \u2014 elle se tient valablement sans condition de quorum.
            </p>
          </div>
        </div>
      )}

      {/* Quorum */}
      <div className={`rounded-lg p-4 ${
        contenu.presences.quorum.atteint
          ? 'bg-emerald-50 border border-emerald-200'
          : 'bg-red-50 border border-red-200'
      }`}>
        <div className="flex items-center gap-2">
          {contenu.presences.quorum.atteint ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          ) : (
            <XCircle className="h-5 w-5 text-red-600 shrink-0" />
          )}
          <div>
            <p className={`text-sm font-medium ${
              contenu.presences.quorum.atteint ? 'text-emerald-700' : 'text-red-700'
            }`}>
              Quorum {contenu.presences.quorum.atteint ? 'atteint' : 'non atteint'}
            </p>
            <p className={`text-xs ${
              contenu.presences.quorum.atteint ? 'text-emerald-600' : 'text-red-600'
            }`}>
              {contenu.presences.quorum.presents} présent{contenu.presences.quorum.presents > 1 ? 's' : ''}
              {' '}sur {contenu.presences.quorum.requis} requis
            </p>
          </div>
        </div>
      </div>

      {/* Presents */}
      {contenu.presences.presents.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Présents ({contenu.presences.presents.length})
            </p>
            <div className="space-y-1">
              {contenu.presences.presents.map((p, i) => (
                <p key={i} className="text-sm">
                  {p.prenom} {p.nom}
                  {p.qualite && <span className="text-muted-foreground"> \u2014 {p.qualite}</span>}
                </p>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Excuses */}
      {contenu.presences.excuses.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Excusés ({contenu.presences.excuses.length})
            </p>
            <div className="space-y-1">
              {contenu.presences.excuses.map((p, i) => (
                <p key={i} className="text-sm">{p.prenom} {p.nom}</p>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Absents */}
      {contenu.presences.absents.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Absents ({contenu.presences.absents.length})
            </p>
            <div className="space-y-1">
              {contenu.presences.absents.map((p, i) => (
                <p key={i} className="text-sm">{p.prenom} {p.nom}</p>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Procurations */}
      {contenu.presences.procurations.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Procurations ({contenu.presences.procurations.length})
            </p>
            <div className="space-y-1">
              {contenu.presences.procurations.map((p, i) => (
                <p key={i} className="text-sm">
                  {p.mandant} a donné pouvoir à <strong>{p.mandataire}</strong>
                </p>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bureau */}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Bureau de séance
          </p>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Président(e)</p>
              <p className="font-medium">{contenu.bureau.president || 'Non désigné'}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Secrétaire</p>
              <p className="font-medium">{contenu.bureau.secretaire || 'Non désigné'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quorum statement */}
      {contenu.presences.quorumStatement && (
        <p className="text-sm italic text-muted-foreground text-center px-4">
          {contenu.presences.quorumStatement}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-4">
        <Button
          variant="outline"
          size="sm"
          asChild
          className="min-h-[44px] gap-1.5"
        >
          <a href={`/seances/${seanceId}`}>
            <ArrowLeft className="h-4 w-4" />
            Modifier les présences
          </a>
        </Button>
        <Button
          size="lg"
          onClick={onValidate}
          className="min-h-[44px] gap-2"
        >
          <Check className="h-4 w-4" />
          Tout est correct
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

// ─── Step 2: Discussions (ONE point at a time) ───────────────────────────────

function StepDiscussions({
  contenu,
  currentPointIndex,
  totalPoints,
  isEditable,
  aiLoadingPoint,
  onDiscussionChange,
  onImproveDiscussion,
  onNextPoint,
  onPrevPoint,
}: {
  contenu: PVContenu
  currentPointIndex: number
  totalPoints: number
  isEditable: boolean
  aiLoadingPoint: number | null
  onDiscussionChange: (index: number, text: string) => void
  onImproveDiscussion: (index: number) => void
  onNextPoint: () => void
  onPrevPoint: () => void
}) {
  if (totalPoints === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
        <p className="text-muted-foreground">Aucun point à l&apos;ordre du jour.</p>
        <Button onClick={onNextPoint} className="mt-4 min-h-[44px]">
          Étape suivante <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    )
  }

  const point = contenu.points[currentPointIndex]
  if (!point) return null

  const isInfoPoint = INFORMATION_TYPES.includes(point.type)
  const resultatConfig = point.vote?.resultat
    ? RESULTAT_LABELS[point.vote.resultat]
    : null
  const ResultIcon = resultatConfig?.icon || Eye
  const isLastPoint = currentPointIndex === totalPoints - 1
  const hasEmptyDiscussion = !point.discussion?.trim()
  const voteResultat = point.vote?.resultat || null

  // Smart warning logic based on vote result
  type DiscussionWarning = { level: 'amber' | 'red'; message: string } | null
  const discussionWarning: DiscussionWarning = (() => {
    if (!hasEmptyDiscussion) return null
    if (isInfoPoint || !point.vote) return null
    if (voteResultat === 'ADOPTE_UNANIMITE') return null
    if (voteResultat === 'REJETE') {
      return { level: 'red', message: 'Ce point a été rejeté \u2014 la discussion est fortement recommandée' }
    }
    if (voteResultat === 'ADOPTE_VOIX_PREPONDERANTE') {
      return { level: 'red', message: 'Vote départagé par la voix du président \u2014 les arguments doivent figurer au PV' }
    }
    if (voteResultat === 'ADOPTE' && (point.vote?.nomsContre?.length || 0) > 0) {
      return { level: 'amber', message: 'Ce point a eu des voix contre \u2014 la discussion est recommandée pour le PV' }
    }
    return null
  })()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center mb-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
          Rédigez les discussions
        </p>
        <h2 className="text-xl font-semibold">
          Point {currentPointIndex + 1}/{totalPoints}
        </h2>
      </div>

      {/* Mini dots progress */}
      <div className="flex items-center justify-center gap-1.5">
        {Array.from({ length: totalPoints }).map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => {
              // Allow jumping to any point
              if (i < currentPointIndex) {
                // go back
                for (let j = currentPointIndex; j > i; j--) {
                  // We just set the index directly
                }
              }
            }}
            className={`h-2 rounded-full transition-all ${
              i === currentPointIndex
                ? 'w-6 bg-primary'
                : i < currentPointIndex
                  ? 'w-2 bg-emerald-400'
                  : 'w-2 bg-muted-foreground/20'
            }`}
            aria-label={`Point ${i + 1}`}
          />
        ))}
      </div>

      {/* Point card */}
      <Card>
        <CardContent className="p-6">
          {/* Point title and badges */}
          <h3 className="text-lg font-semibold mb-2">{point.titre}</h3>
          <div className="flex items-center gap-2 flex-wrap mb-4">
            <Badge variant="outline" className="text-xs">
              {TYPE_LABELS[point.type] || point.type}
            </Badge>
            {point.rapporteur && (
              <span className="text-xs text-muted-foreground">
                Rapporteur : {point.rapporteur}
              </span>
            )}
            {point.vote?.resultat && (
              <Badge className={`text-xs gap-1 ${
                resultatConfig?.colorClass === 'text-emerald-700' ? 'bg-emerald-100 text-emerald-700 border-0' :
                resultatConfig?.colorClass === 'text-red-700' ? 'bg-red-100 text-red-700 border-0' :
                resultatConfig?.colorClass === 'text-blue-700' ? 'bg-blue-100 text-blue-700 border-0' :
                'bg-amber-100 text-amber-700 border-0'
              }`}>
                <ResultIcon className="h-3 w-3" />
                {resultatConfig?.label || point.vote.resultat}
              </Badge>
            )}
            {isInfoPoint && (
              <span className="text-xs italic text-muted-foreground">Pas de vote</span>
            )}
          </div>

          {/* Formule PV (read-only) */}
          {point.vote?.formulePV && (
            <div className="rounded-lg bg-blue-50/70 border border-blue-200 p-3 mb-4">
              <p className="text-sm italic leading-relaxed text-blue-900">
                {point.vote.formulePV}
              </p>
            </div>
          )}

          {/* Vote details */}
          {point.vote && !isInfoPoint && (
            <div className="grid grid-cols-4 gap-2 text-center mb-4">
              <div className="rounded-lg bg-muted/50 p-2">
                <p className="text-base font-bold text-emerald-600">{point.vote.pour}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Pour</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-2">
                <p className="text-base font-bold text-red-600">{point.vote.contre}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Contre</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-2">
                <p className="text-base font-bold text-amber-600">{point.vote.abstentions}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Abstentions</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-2">
                <p className="text-base font-bold">{point.vote.totalVotants}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Votants</p>
              </div>
            </div>
          )}

          {/* Description context (read-only) */}
          {point.description && (
            <div className="rounded-lg bg-muted/30 p-3 mb-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Exposé
              </p>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{point.description}</p>
            </div>
          )}

          {/* Projet de deliberation (read-only context) */}
          {point.projetDeliberation && (
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 mb-4">
              <p className="text-xs font-semibold text-blue-700 mb-1">Résolution proposée :</p>
              <p className="text-sm text-blue-800 whitespace-pre-line">{point.projetDeliberation}</p>
            </div>
          )}

          <Separator className="my-4" />

          {/* Discussion textarea */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <PenLine className="h-3.5 w-3.5" />
              Discussion
            </label>

            {isEditable ? (
              <div className="space-y-2">
                <Textarea
                  value={point.discussion}
                  onChange={(e) => onDiscussionChange(currentPointIndex, e.target.value)}
                  placeholder="Résumez les interventions principales, les arguments avancés et les questions posées par les membres."
                  rows={4}
                  className="text-sm resize-y min-h-[100px]"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onImproveDiscussion(currentPointIndex)}
                  disabled={aiLoadingPoint === currentPointIndex}
                  className="gap-1.5 text-xs text-muted-foreground hover:text-foreground min-h-[44px]"
                >
                  {aiLoadingPoint === currentPointIndex ? (
                    <><Loader2 className="h-3 w-3 animate-spin" /> Reformulation en cours...</>
                  ) : point.discussion ? (
                    <><Sparkles className="h-3 w-3" /> Reformuler avec l&apos;IA</>
                  ) : (
                    <><Sparkles className="h-3 w-3" /> Suggérer un texte</>
                  )}
                </Button>
              </div>
            ) : (
              point.discussion ? (
                <p className="text-sm leading-relaxed whitespace-pre-line">{point.discussion}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">Aucune discussion notée.</p>
              )
            )}

            {/* Smart warning for empty discussion based on vote result */}
            {discussionWarning && (
              <div className={`mt-3 rounded-lg p-3 flex items-start gap-2 ${
                discussionWarning.level === 'red'
                  ? 'bg-red-50 border border-red-200'
                  : 'bg-amber-50 border border-amber-200'
              }`}>
                <AlertTriangle className={`h-4 w-4 shrink-0 mt-0.5 ${
                  discussionWarning.level === 'red' ? 'text-red-500' : 'text-amber-500'
                }`} />
                <p className={`text-sm ${
                  discussionWarning.level === 'red' ? 'text-red-700' : 'text-amber-700'
                }`}>
                  {discussionWarning.message}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <Button
          variant="outline"
          onClick={onPrevPoint}
          className="min-h-[44px] gap-1.5"
        >
          <ChevronLeft className="h-4 w-4" />
          {currentPointIndex > 0 ? 'Point précédent' : 'Étape précédente'}
        </Button>
        <Button
          onClick={onNextPoint}
          className="min-h-[44px] gap-1.5"
        >
          {isLastPoint ? (
            <>
              Étape suivante
              <ChevronRight className="h-4 w-4" />
            </>
          ) : (
            <>
              Point suivant
              <ChevronRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

// ─── Step 3: Observations ────────────────────────────────────────────────────

function StepObservations({
  contenu,
  isEditable,
  aiLoading,
  onChange,
  onImprove,
  onNext,
  onSkip,
  onPrev,
}: {
  contenu: PVContenu
  isEditable: boolean
  aiLoading: boolean
  onChange: (text: string) => void
  onImprove: () => void
  onNext: () => void
  onSkip: () => void
  onPrev: () => void
}) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-xl font-semibold mb-2">Observations complémentaires</h2>
        <p className="text-muted-foreground text-sm">
          Ajoutez des remarques générales sur la séance si nécessaire. Cette étape est facultative.
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          {isEditable ? (
            <div className="space-y-2">
              <Textarea
                value={contenu.conclusionLibre}
                onChange={(e) => onChange(e.target.value)}
                placeholder="Ajoutez des remarques ou observations générales sur la séance (facultatif)"
                rows={4}
                className="text-sm resize-y min-h-[100px]"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={onImprove}
                disabled={aiLoading}
                className="gap-1.5 text-xs text-muted-foreground hover:text-foreground min-h-[44px]"
              >
                {aiLoading ? (
                  <><Loader2 className="h-3 w-3 animate-spin" /> Génération en cours...</>
                ) : (
                  <><Sparkles className="h-3 w-3" /> Suggérer</>
                )}
              </Button>
            </div>
          ) : contenu.conclusionLibre ? (
            <p className="text-sm leading-relaxed whitespace-pre-line">{contenu.conclusionLibre}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic">Aucune observation.</p>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4">
        <Button
          variant="outline"
          onClick={onPrev}
          className="min-h-[44px] gap-1.5"
        >
          <ChevronLeft className="h-4 w-4" />
          Étape précédente
        </Button>
        <div className="flex items-center gap-2">
          {!contenu.conclusionLibre?.trim() && (
            <Button
              variant="ghost"
              onClick={onSkip}
              className="min-h-[44px] text-muted-foreground"
            >
              Passer cette étape
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
          {contenu.conclusionLibre?.trim() && (
            <Button
              onClick={onNext}
              className="min-h-[44px] gap-1.5"
            >
              Étape suivante
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Step 4: Relecture ───────────────────────────────────────────────────────

function StepRelecture({
  contenu,
  seanceReconvocation,
  onNext,
  onGoToStep,
  steps,
}: {
  contenu: PVContenu
  seanceReconvocation?: boolean
  onNext: () => void
  onGoToStep: (idx: number) => void
  steps: StepId[]
}) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-xl font-semibold mb-2">Relisez le procès-verbal</h2>
        <p className="text-muted-foreground text-sm">
          Vérifiez que tout est correct avant de passer aux signatures.
        </p>
      </div>

      {/* Full document (serif, official look) */}
      <ReadOnlyDocument
        contenu={contenu}
        seanceReconvocation={seanceReconvocation}
        presidentSignature={undefined}
        secretaireSignature={undefined}
        bothSigned={false}
        isCarence={false}
      />

      {/* Quick-fix links */}
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <span>Quelque chose à corriger ?</span>
        {steps.includes('presences') && (
          <button
            type="button"
            onClick={() => onGoToStep(steps.indexOf('presences'))}
            className="underline hover:text-foreground transition-colors"
          >
            Présences
          </button>
        )}
        {steps.includes('discussions') && (
          <button
            type="button"
            onClick={() => onGoToStep(steps.indexOf('discussions'))}
            className="underline hover:text-foreground transition-colors"
          >
            Discussions
          </button>
        )}
        {steps.includes('observations') && (
          <button
            type="button"
            onClick={() => onGoToStep(steps.indexOf('observations'))}
            className="underline hover:text-foreground transition-colors"
          >
            Observations
          </button>
        )}
      </div>

      {/* ── Verification recap card before signatures ────────────────── */}
      <RelectureRecapCard
        contenu={contenu}
        onGoToDiscussions={() => onGoToStep(steps.indexOf('discussions'))}
        onGoToSignatures={onNext}
      />

      {/* Navigation */}
      <div className="flex items-center justify-center pt-4">
        <Button
          size="lg"
          onClick={onNext}
          className="min-h-[48px] gap-2"
        >
          Tout est correct \u2014 procéder aux signatures
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

// ─── Step 5: Signatures ──────────────────────────────────────────────────────

function StepSignatures({
  contenu,
  seanceId,
  presidentSignature,
  secretaireSignature,
  bothSigned,
  canSignPV,
  isPending,
  isCurrentUserPresident,
  isCurrentUserSecretaire,
  onSign,
  pdfUrl,
  onPrev,
}: {
  contenu: PVContenu
  seanceId: string
  presidentSignature: PVSignatureRecord | undefined
  secretaireSignature: PVSignatureRecord | undefined
  bothSigned: boolean
  canSignPV: boolean
  isPending: boolean
  isCurrentUserPresident: boolean
  isCurrentUserSecretaire: boolean
  onSign: () => void
  pdfUrl: string | null
  onPrev: () => void
}) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-xl font-semibold mb-2">Signatures</h2>
        <p className="text-muted-foreground text-sm">
          {bothSigned
            ? 'Le procès-verbal est signé et verrouillé.'
            : 'Le procès-verbal doit être signé par le président et le secrétaire.'}
        </p>
      </div>

      {/* Both signed success */}
      {bothSigned && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-6 text-center">
          <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-emerald-700 mb-1">
            Procès-verbal signé et verrouillé
          </h3>
          <p className="text-sm text-emerald-600 mb-4">
            Le procès-verbal ne peut plus être modifié.
          </p>
          <div className="flex items-center justify-center gap-3">
            {pdfUrl && (
              <Button asChild className="min-h-[44px] gap-1.5">
                <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                  <Download className="h-4 w-4" />
                  Télécharger le PDF
                </a>
              </Button>
            )}
            <Button variant="outline" asChild className="min-h-[44px] gap-1.5">
              <a href={`/seances/${seanceId}`}>
                <ArrowLeft className="h-4 w-4" />
                Revenir à la séance
              </a>
            </Button>
          </div>
        </div>
      )}

      {/* Signature cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* President */}
        <Card className={presidentSignature ? 'border-emerald-200 bg-emerald-50/50' : ''}>
          <CardContent className="p-6 text-center">
            <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">
              Le/La Président(e)
            </p>
            <p className="font-medium text-sm mb-4">
              {contenu.bureau.president || '...'}
            </p>
            {presidentSignature ? (
              <div className="flex items-center justify-center gap-1.5 text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
                <span className="text-xs" suppressHydrationWarning>
                  Signé le{' '}
                  {new Date(presidentSignature.timestamp).toLocaleDateString('fr-FR', {
                    day: 'numeric', month: 'long', year: 'numeric',
                  })}
                  {' '}à{' '}
                  {new Date(presidentSignature.timestamp).toLocaleTimeString('fr-FR', {
                    hour: '2-digit', minute: '2-digit',
                  })}
                </span>
              </div>
            ) : canSignPV && isCurrentUserPresident ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="lg"
                    className="gap-2 min-h-[48px] w-full"
                    disabled={isPending}
                  >
                    {isPending ? (
                      <><Loader2 className="h-5 w-5 animate-spin" /> Signature en cours...</>
                    ) : (
                      <><PenLine className="h-5 w-5" /> Signer</>
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent aria-describedby={undefined}>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Signer le procès-verbal ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Êtes-vous sûr(e) de vouloir signer ce procès-verbal en tant que Président(e) ?
                      Cette action est définitive.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={onSign}>
                      Signer définitivement
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <Badge variant="outline" className="text-xs text-amber-600 border-amber-200">
                En attente
              </Badge>
            )}
          </CardContent>
        </Card>

        {/* Secretary */}
        <Card className={secretaireSignature ? 'border-emerald-200 bg-emerald-50/50' : ''}>
          <CardContent className="p-6 text-center">
            <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">
              Le/La Secrétaire
            </p>
            <p className="font-medium text-sm mb-4">
              {contenu.bureau.secretaire || '...'}
            </p>
            {secretaireSignature ? (
              <div className="flex items-center justify-center gap-1.5 text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
                <span className="text-xs" suppressHydrationWarning>
                  Signé le{' '}
                  {new Date(secretaireSignature.timestamp).toLocaleDateString('fr-FR', {
                    day: 'numeric', month: 'long', year: 'numeric',
                  })}
                  {' '}à{' '}
                  {new Date(secretaireSignature.timestamp).toLocaleTimeString('fr-FR', {
                    hour: '2-digit', minute: '2-digit',
                  })}
                </span>
              </div>
            ) : canSignPV && isCurrentUserSecretaire ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="lg"
                    className="gap-2 min-h-[48px] w-full"
                    disabled={isPending}
                  >
                    {isPending ? (
                      <><Loader2 className="h-5 w-5 animate-spin" /> Signature en cours...</>
                    ) : (
                      <><PenLine className="h-5 w-5" /> Signer</>
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent aria-describedby={undefined}>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Signer le procès-verbal ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Êtes-vous sûr(e) de vouloir signer ce procès-verbal en tant que Secrétaire de séance ?
                      Cette action est définitive.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={onSign}>
                      Signer définitivement
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <Badge variant="outline" className="text-xs text-amber-600 border-amber-200">
                En attente
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Back button */}
      {!bothSigned && (
        <div className="flex items-center justify-start pt-4">
          <Button
            variant="outline"
            onClick={onPrev}
            className="min-h-[44px] gap-1.5"
          >
            <ChevronLeft className="h-4 w-4" />
            Étape précédente
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── Step Carence (for PV de carence) ────────────────────────────────────────

function StepCarence({
  contenu,
  onNext,
  onPrev,
}: {
  contenu: PVContenu
  onNext: () => void
  onPrev: () => void
}) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-xl font-semibold mb-2">Constat de carence</h2>
        <p className="text-muted-foreground text-sm">
          Le quorum n&apos;étant pas atteint, la séance ne peut valablement délibérer.
        </p>
      </div>

      <Card>
        <CardContent className="p-6 font-serif space-y-4 leading-relaxed">
          <p>
            Le quorum n&apos;étant pas atteint ({contenu.presences.quorum.presents} présent{contenu.presences.quorum.presents > 1 ? 's' : ''}{' '}
            sur {contenu.presences.quorum.requis} requis), le/la Président(e){' '}
            {contenu.bureau.president ? <strong>{contenu.bureau.president}</strong> : 'M./Mme ...'}{' '}
            constate la carence et prononce l&apos;ajournement de la séance.
          </p>

          {contenu.presences.presents.length > 0 && (
            <div>
              <p className="font-semibold text-sm font-sans uppercase tracking-wider text-muted-foreground mb-1">
                Étaient présents
              </p>
              <p>{contenu.presences.presents.map(p => `${p.prenom} ${p.nom}`).join(', ')}</p>
            </div>
          )}

          {contenu.presences.excuses.length > 0 && (
            <div>
              <p className="font-semibold text-sm font-sans uppercase tracking-wider text-muted-foreground mb-1">
                Étaient excusés
              </p>
              <p>{contenu.presences.excuses.map(p => `${p.prenom} ${p.nom}`).join(', ')}</p>
            </div>
          )}

          {contenu.presences.absents.length > 0 && (
            <div>
              <p className="font-semibold text-sm font-sans uppercase tracking-wider text-muted-foreground mb-1">
                Étaient absents
              </p>
              <p>{contenu.presences.absents.map(p => `${p.prenom} ${p.nom}`).join(', ')}</p>
            </div>
          )}

          <p>
            Une reconvocation sera adressée aux membres dans les meilleurs délais,
            conformément aux dispositions de l&apos;article L2121-17 du Code général des collectivités territoriales.
          </p>

          <p className="text-muted-foreground">
            Fait à {contenu.entete.lieu || '...'}, le {contenu.entete.dateSeance}
          </p>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4">
        <Button
          variant="outline"
          onClick={onPrev}
          className="min-h-[44px] gap-1.5"
        >
          <ChevronLeft className="h-4 w-4" />
          Étape précédente
        </Button>
        <Button
          onClick={onNext}
          className="min-h-[44px] gap-1.5"
        >
          Procéder aux signatures
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

// ─── Relecture recap card (verification before signatures) ──────────────────

const INFORMATION_TYPES_SET = new Set(INFORMATION_TYPES)

function RelectureRecapCard({
  contenu,
  onGoToDiscussions,
  onGoToSignatures,
}: {
  contenu: PVContenu
  onGoToDiscussions: () => void
  onGoToSignatures: () => void
}) {
  // Analyze each point
  const pointAnalysis = contenu.points.map((point) => {
    const hasDiscussion = !!point.discussion?.trim()
    const isInfo = INFORMATION_TYPES_SET.has(point.type)
    const voteResultat = point.vote?.resultat || null
    const hasOpposition =
      voteResultat === 'REJETE' ||
      voteResultat === 'ADOPTE_VOIX_PREPONDERANTE' ||
      (voteResultat === 'ADOPTE' && (point.vote?.nomsContre?.length || 0) > 0)

    return {
      titre: point.titre,
      hasDiscussion,
      isInfo,
      voteResultat,
      hasOpposition,
      noVote: !point.vote && !isInfo,
    }
  })

  const missingImportant = pointAnalysis.filter(
    (p) => !p.hasDiscussion && p.hasOpposition
  ).length

  return (
    <div className={`rounded-xl border-2 p-5 mt-6 ${
      missingImportant > 0
        ? 'border-amber-200 bg-amber-50'
        : 'border-emerald-200 bg-emerald-50'
    }`}>
      <h3 className={`font-semibold flex items-center gap-2 mb-3 ${
        missingImportant > 0 ? 'text-amber-800' : 'text-emerald-800'
      }`}>
        <AlertTriangle className={`h-5 w-5 ${
          missingImportant > 0 ? 'text-amber-600' : 'text-emerald-600'
        }`} />
        Vérification avant signature
      </h3>

      <div className="space-y-2">
        {pointAnalysis.map((pa, idx) => (
          <div key={idx} className="flex items-center gap-2 text-sm flex-wrap">
            {pa.hasDiscussion ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
            ) : pa.hasOpposition ? (
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
            <span className={pa.hasOpposition && !pa.hasDiscussion ? 'text-amber-900' : ''}>
              {pa.titre}
            </span>
            {!pa.hasDiscussion && pa.hasOpposition && (
              <Badge className="bg-amber-100 text-amber-700 text-[10px] border-0 shrink-0">
                Discussion manquante
              </Badge>
            )}
            {!pa.hasDiscussion && !pa.hasOpposition && !pa.isInfo && pa.voteResultat && (
              <span className="text-xs text-muted-foreground">(adopté sans débat)</span>
            )}
            {!pa.hasDiscussion && pa.isInfo && (
              <span className="text-xs text-muted-foreground">(information)</span>
            )}
            {!pa.hasDiscussion && pa.noVote && !pa.isInfo && (
              <span className="text-xs text-muted-foreground">(pas de vote)</span>
            )}
            {pa.hasDiscussion && (
              <Badge className="bg-emerald-100 text-emerald-700 text-[10px] border-0 shrink-0">
                Complète
              </Badge>
            )}
          </div>
        ))}
      </div>

      {missingImportant > 0 && (
        <div className="mt-4 pt-3 border-t border-amber-200">
          <p className="text-sm text-amber-700">
            {missingImportant} discussion{missingImportant > 1 ? 's' : ''} manquante{missingImportant > 1 ? 's' : ''} sur des points avec opposition.
          </p>
          <div className="flex gap-2 mt-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={onGoToDiscussions} className="min-h-[44px]">
              Compléter les discussions
            </Button>
            <Button size="sm" onClick={onGoToSignatures} className="min-h-[44px]">
              Continuer quand même
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {missingImportant === 0 && (
        <div className="mt-4 pt-3 border-t border-emerald-200">
          <p className="text-sm text-emerald-700 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Toutes les discussions importantes sont complètes
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Read-only document view (used in relecture + signed/published) ──────────

function ReadOnlyDocument({
  contenu,
  seanceReconvocation,
  presidentSignature,
  secretaireSignature,
  bothSigned,
  isCarence,
}: {
  contenu: PVContenu
  seanceReconvocation?: boolean
  presidentSignature: PVSignatureRecord | undefined
  secretaireSignature: PVSignatureRecord | undefined
  bothSigned: boolean
  isCarence: boolean
}) {
  if (isCarence) {
    return (
      <div className="bg-white shadow-lg rounded-xl my-6 p-8 sm:p-12 font-serif print:shadow-none print:rounded-none print:my-0">
        <p className="text-sm text-muted-foreground uppercase tracking-[0.2em] font-sans text-center">
          {contenu.entete.institution}
        </p>
        <h1 className="text-2xl font-bold text-center uppercase tracking-wide mt-4">
          Procès-verbal de carence
        </h1>
        <p className="text-center text-muted-foreground mt-2 font-sans">
          Séance du {contenu.entete.dateSeance} \u2014 {contenu.entete.nomInstance}
        </p>
        <Separator className="my-8" />
        <div className="space-y-6 leading-relaxed">
          <p>
            Le quorum n&apos;étant pas atteint ({contenu.presences.quorum.presents} présent{contenu.presences.quorum.presents > 1 ? 's' : ''}{' '}
            sur {contenu.presences.quorum.requis} requis), le/la Président(e){' '}
            {contenu.bureau.president ? <strong>{contenu.bureau.president}</strong> : 'M./Mme ...'}{' '}
            constate la carence et prononce l&apos;ajournement de la séance.
          </p>
          {contenu.presences.presents.length > 0 && (
            <div>
              <p className="font-semibold text-sm font-sans uppercase tracking-wider text-muted-foreground mb-2">Étaient présents</p>
              <p>{contenu.presences.presents.map(p => `${p.prenom} ${p.nom}`).join(', ')}</p>
            </div>
          )}
          {contenu.presences.excuses.length > 0 && (
            <div>
              <p className="font-semibold text-sm font-sans uppercase tracking-wider text-muted-foreground mb-2">Étaient excusés</p>
              <p>{contenu.presences.excuses.map(p => `${p.prenom} ${p.nom}`).join(', ')}</p>
            </div>
          )}
          {contenu.presences.absents.length > 0 && (
            <div>
              <p className="font-semibold text-sm font-sans uppercase tracking-wider text-muted-foreground mb-2">Étaient absents</p>
              <p>{contenu.presences.absents.map(p => `${p.prenom} ${p.nom}`).join(', ')}</p>
            </div>
          )}
          <p>
            Une reconvocation sera adressée aux membres dans les meilleurs délais.
          </p>
          <p className="text-muted-foreground">
            Fait à {contenu.entete.lieu || '...'}, le {contenu.entete.dateSeance}
          </p>
        </div>
        <Separator className="my-8" />
        <SignatureDisplay
          bureau={contenu.bureau}
          presidentSignature={presidentSignature}
          secretaireSignature={secretaireSignature}
          bothSigned={bothSigned}
        />
      </div>
    )
  }

  return (
    <div
      className="bg-white shadow-lg rounded-xl my-6 p-8 sm:p-12 font-serif print:shadow-none print:rounded-none print:my-0"
      id="pv-content"
    >
      {/* Title */}
      <p className="text-sm text-muted-foreground uppercase tracking-[0.2em] font-sans text-center">
        {contenu.entete.institution}
      </p>
      <h1 className="text-2xl font-bold text-center uppercase tracking-wide mt-4">
        Procès-verbal de la séance du {contenu.entete.dateSeance}
      </h1>
      <p className="text-center text-muted-foreground mt-2 font-sans">
        {contenu.entete.nomInstance}
        {contenu.entete.lieu && <> \u2014 {contenu.entete.lieu}</>}
      </p>
      <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground mt-2 font-sans flex-wrap">
        <span className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          <span suppressHydrationWarning>
            {contenu.entete.heureOuverture || '...'} \u2014 {contenu.entete.heureCloture || '...'}
          </span>
        </span>
        <span>{contenu.entete.publique ? 'Séance publique' : 'Huis clos'}</span>
        <span>{contenu.entete.mode === 'VISIOCONFERENCE' ? 'Visioconférence' : 'Présentiel'}</span>
      </div>

      {/* Reconvocation */}
      {(contenu.entete.reconvocation || seanceReconvocation) && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-6">
          <p className="text-sm text-amber-800">
            Cette séance fait suite à une reconvocation.
          </p>
        </div>
      )}

      {/* Bureau */}
      <div className="mt-6 text-sm">
        <p>
          Sous la présidence de{' '}
          <strong>{contenu.bureau.president || '...'}</strong>
          {contenu.bureau.secretaire && (
            <>, {contenu.bureau.secretaire} assure le secrétariat de séance</>
          )}.
        </p>
      </div>

      <Separator className="my-8" />

      {/* Presences */}
      <h2 className="text-lg font-bold uppercase tracking-wider font-sans mb-4">Présences</h2>
      <div className="space-y-3 text-sm">
        {contenu.presences.presents.length > 0 && (
          <p>
            <strong className="font-sans">Présents ({contenu.presences.presents.length}) :</strong>{' '}
            {contenu.presences.presents.map((p, i) => (
              <span key={i}>
                {p.prenom} {p.nom}
                {p.qualite && <span className="text-muted-foreground"> ({p.qualite})</span>}
                {i < contenu.presences.presents.length - 1 ? ', ' : ''}
              </span>
            ))}
          </p>
        )}
        {contenu.presences.excuses.length > 0 && (
          <p>
            <strong className="font-sans">Excusés ({contenu.presences.excuses.length}) :</strong>{' '}
            {contenu.presences.excuses.map(p => `${p.prenom} ${p.nom}`).join(', ')}
          </p>
        )}
        {contenu.presences.absents.length > 0 && (
          <p>
            <strong className="font-sans">Absents ({contenu.presences.absents.length}) :</strong>{' '}
            {contenu.presences.absents.map(p => `${p.prenom} ${p.nom}`).join(', ')}
          </p>
        )}
        {contenu.presences.procurations.length > 0 && (
          <p>
            <strong className="font-sans">Procurations :</strong>{' '}
            {contenu.presences.procurations.map((p, i) => (
              <span key={i}>
                {p.mandant} a donné pouvoir à {p.mandataire}
                {i < contenu.presences.procurations.length - 1 ? ' ; ' : ''}
              </span>
            ))}
          </p>
        )}
        <div className={`rounded-lg p-3 mt-2 ${
          contenu.presences.quorum.atteint
            ? 'bg-emerald-50 border border-emerald-200'
            : 'bg-red-50 border border-red-200'
        }`}>
          <div className="flex items-center gap-2">
            {contenu.presences.quorum.atteint ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 text-red-600 shrink-0" />
            )}
            <span className={`text-sm font-sans font-medium ${
              contenu.presences.quorum.atteint ? 'text-emerald-700' : 'text-red-700'
            }`}>
              Quorum {contenu.presences.quorum.atteint ? 'atteint' : 'non atteint'} :
              {' '}{contenu.presences.quorum.presents} présent{contenu.presences.quorum.presents > 1 ? 's' : ''}
              {' '}sur {contenu.presences.quorum.requis} requis
            </span>
          </div>
        </div>
      </div>

      {contenu.presences.quorumStatement && (
        <p className="text-sm italic text-muted-foreground mt-3">
          {contenu.presences.quorumStatement}
        </p>
      )}

      {/* Points */}
      {contenu.points.map((point, idx) => {
        const isInfoPoint = INFORMATION_TYPES.includes(point.type)
        const resultatConfig = point.vote?.resultat
          ? RESULTAT_LABELS[point.vote.resultat]
          : null
        const ResultIcon = resultatConfig?.icon || Eye

        return (
          <div key={idx}>
            <Separator className="my-8" />
            <h2 className="text-lg font-bold font-sans mb-1">
              Point {point.position} \u2014 {point.titre}
            </h2>
            <div className="flex items-center gap-3 text-sm text-muted-foreground font-sans mb-4 flex-wrap">
              <span>{TYPE_LABELS[point.type] || point.type}</span>
              {point.rapporteur && <span>Rapporteur : {point.rapporteur}</span>}
              {point.vote?.resultat && (
                <span className={`flex items-center gap-1 font-medium ${resultatConfig?.colorClass || ''}`}>
                  <ResultIcon className="h-3.5 w-3.5" />
                  {resultatConfig?.label || point.vote.resultat}
                </span>
              )}
              {isInfoPoint && (
                <span className="italic">Point d&apos;information \u2014 pas de vote</span>
              )}
            </div>

            {point.description && (
              <p className="text-sm leading-relaxed mb-4 whitespace-pre-line">{point.description}</p>
            )}

            {point.projetDeliberation && (
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 mb-4">
                <p className="text-xs font-semibold text-blue-700 mb-1 font-sans">Résolution proposée :</p>
                <p className="text-sm text-blue-800 whitespace-pre-line">{point.projetDeliberation}</p>
              </div>
            )}

            {point.vote?.formulePV && (
              <div className="rounded-lg bg-blue-50/70 border border-blue-200 p-4 mb-4">
                <p className="text-sm italic leading-relaxed text-blue-900">{point.vote.formulePV}</p>
              </div>
            )}

            {point.vote && !isInfoPoint && (
              <div className="grid grid-cols-4 gap-3 text-center mb-4 font-sans">
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <p className="text-lg font-bold text-emerald-600">{point.vote.pour}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Pour</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <p className="text-lg font-bold text-red-600">{point.vote.contre}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Contre</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <p className="text-lg font-bold text-amber-600">{point.vote.abstentions}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Abstentions</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <p className="text-lg font-bold">{point.vote.totalVotants}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Votants</p>
                </div>
              </div>
            )}

            {point.vote?.nomsContre && point.vote.nomsContre.length > 0 && (
              <p className="text-xs text-muted-foreground font-sans mb-1">
                Contre : {point.vote.nomsContre.join(', ')}
              </p>
            )}
            {point.vote?.nomsAbstention && point.vote.nomsAbstention.length > 0 && (
              <p className="text-xs text-muted-foreground font-sans mb-4">
                Abstentions : {point.vote.nomsAbstention.join(', ')}
              </p>
            )}

            {/* Discussion */}
            {point.discussion && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider font-sans mb-2 flex items-center gap-1.5">
                  <PenLine className="h-3.5 w-3.5" />
                  Discussion
                </p>
                <p className="text-sm leading-relaxed whitespace-pre-line">{point.discussion}</p>
              </div>
            )}
          </div>
        )
      })}

      {/* Observations */}
      {contenu.conclusionLibre && (
        <>
          <Separator className="my-8" />
          <h2 className="text-lg font-bold uppercase tracking-wider font-sans mb-4">Observations</h2>
          <p className="text-sm leading-relaxed whitespace-pre-line mb-6">{contenu.conclusionLibre}</p>
        </>
      )}

      {/* Cloture */}
      <Separator className="my-8" />
      <h2 className="text-lg font-bold uppercase tracking-wider font-sans mb-4">Clôture</h2>
      <p className="text-sm italic leading-relaxed text-muted-foreground">
        {contenu.cloture.texte}
      </p>

      {/* Signatures */}
      <Separator className="my-8" />
      <SignatureDisplay
        bureau={contenu.bureau}
        presidentSignature={presidentSignature}
        secretaireSignature={secretaireSignature}
        bothSigned={bothSigned}
      />
    </div>
  )
}

// ─── Signature display (read-only) ──────────────────────────────────────────

function SignatureDisplay({
  bureau,
  presidentSignature,
  secretaireSignature,
  bothSigned,
}: {
  bureau: PVContenu['bureau']
  presidentSignature: PVSignatureRecord | undefined
  secretaireSignature: PVSignatureRecord | undefined
  bothSigned: boolean
}) {
  return (
    <div>
      <h2 className="text-lg font-bold uppercase tracking-wider font-sans mb-4">Signatures</h2>

      {bothSigned && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 mb-4">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-emerald-600" />
            <p className="text-sm font-semibold text-emerald-700 font-sans">
              Procès-verbal signé et verrouillé
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-sans">
        <Card className={presidentSignature ? 'border-emerald-200 bg-emerald-50/50' : ''}>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Le/La Président(e)</p>
            <p className="font-medium text-sm mb-3">{bureau.president || '...'}</p>
            {presidentSignature ? (
              <div className="flex items-center justify-center gap-1.5 text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-xs" suppressHydrationWarning>
                  Signé le {new Date(presidentSignature.timestamp).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  {' '}à {new Date(presidentSignature.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ) : (
              <Badge variant="outline" className="text-xs text-amber-600 border-amber-200">En attente</Badge>
            )}
          </CardContent>
        </Card>
        <Card className={secretaireSignature ? 'border-emerald-200 bg-emerald-50/50' : ''}>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Le/La Secrétaire</p>
            <p className="font-medium text-sm mb-3">{bureau.secretaire || '...'}</p>
            {secretaireSignature ? (
              <div className="flex items-center justify-center gap-1.5 text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-xs" suppressHydrationWarning>
                  Signé le {new Date(secretaireSignature.timestamp).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  {' '}à {new Date(secretaireSignature.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ) : (
              <Badge variant="outline" className="text-xs text-amber-600 border-amber-200">En attente</Badge>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
