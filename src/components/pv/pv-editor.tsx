'use client'

import { useState, useEffect, useCallback, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
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
  Users,
  Scale,
  Vote,
  Clock,
  AlertTriangle,
  Sparkles,
  Eye,
  Handshake,
  Ban,
  ChevronDown,
  ChevronRight,
  Printer,
  Download,
  Send,
  ArrowLeft,
  PenLine,
  Lock,
  Copy,
  Check,
  Plus,
  Trash2,
  Info,
  ShieldCheck,
  MapPin,
  GlobeLock,
  Unlock,
  BookOpen,
} from 'lucide-react'
import {
  generatePVBrouillon,
  savePVContent,
  updatePVStatus,
  signPV,
  type PVContenu,
  type PVSignatureRecord,
} from '@/lib/actions/pv'
import {
  generatePointContent,
  improvePVSection,
} from '@/lib/actions/ai-pv'

// ─── Types ───────────────────────────────────────────────────────────────────

interface PVEditorProps {
  seanceId: string
  seanceTitre: string
  seanceStatut: string
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

const PV_STATUT_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  BROUILLON: { label: 'Brouillon', color: 'text-amber-700', bgColor: 'bg-amber-100' },
  EN_RELECTURE: { label: 'En relecture', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  SIGNE: { label: 'Signé', color: 'text-green-700', bgColor: 'bg-green-100' },
  PUBLIE: { label: 'Publié', color: 'text-purple-700', bgColor: 'bg-purple-100' },
}

const RESULTAT_LABELS: Record<string, { label: string; icon: typeof CheckCircle2; colorClass: string }> = {
  ADOPTE: { label: 'Adopté', icon: CheckCircle2, colorClass: 'bg-emerald-100 text-emerald-700' },
  ADOPTE_UNANIMITE: { label: 'Unanimité', icon: Sparkles, colorClass: 'bg-emerald-100 text-emerald-700' },
  ADOPTE_VOIX_PREPONDERANTE: { label: 'Voix prépondérante', icon: Scale, colorClass: 'bg-blue-100 text-blue-700' },
  REJETE: { label: 'Rejeté', icon: XCircle, colorClass: 'bg-red-100 text-red-700' },
  NUL: { label: 'Nul', icon: Ban, colorClass: 'bg-amber-100 text-amber-700' },
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

// ─── Component ───────────────────────────────────────────────────────────────

export function PVEditor({
  seanceId,
  seanceStatut,
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

  // ─── Auto-save state ─────────────────────────────────────────────────────
  const [isDirty, setIsDirty] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const contenuRef = useRef(contenu)

  // ─── Collapsible state ────────────────────────────────────────────────────
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    entete: true,
    bureau: true,
    presences: true,
    introduction: true,
    conclusion: true,
    cloture: true,
    signatures: true,
  })
  // All ODJ points open by default
  const [openPoints, setOpenPoints] = useState<Record<number, boolean>>(() => {
    const map: Record<number, boolean> = {}
    const pts = (existingPV?.contenu_json as PVContenu | null)?.points
    if (pts) pts.forEach((_, i) => { map[i] = true })
    return map
  })

  // ─── AI loading per point / section ───────────────────────────────────────
  const [aiLoadingPoint, setAiLoadingPoint] = useState<number | null>(null)
  const [aiLoadingSection, setAiLoadingSection] = useState<string | null>(null)

  // ─── Clipboard state ─────────────────────────────────────────────────────
  const [copiedFormula, setCopiedFormula] = useState<number | null>(null)

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

  function updatePoint(index: number, updates: Partial<PVContenu['points'][0]>) {
    if (!contenu) return
    const newPoints = [...contenu.points]
    newPoints[index] = { ...newPoints[index], ...updates }
    setContenu({ ...contenu, points: newPoints })
    setIsDirty(true)
  }

  function updatePointArticle(pointIndex: number, articleIndex: number, value: string) {
    if (!contenu) return
    const newPoints = [...contenu.points]
    const newArticles = [...newPoints[pointIndex].articles]
    newArticles[articleIndex] = value
    newPoints[pointIndex] = { ...newPoints[pointIndex], articles: newArticles }
    setContenu({ ...contenu, points: newPoints })
    setIsDirty(true)
  }

  function addArticle(pointIndex: number) {
    if (!contenu) return
    const newPoints = [...contenu.points]
    newPoints[pointIndex] = {
      ...newPoints[pointIndex],
      articles: [...newPoints[pointIndex].articles, ''],
    }
    setContenu({ ...contenu, points: newPoints })
    setIsDirty(true)
  }

  function removeArticle(pointIndex: number, articleIndex: number) {
    if (!contenu) return
    const newPoints = [...contenu.points]
    const newArticles = newPoints[pointIndex].articles.filter((_, i) => i !== articleIndex)
    newPoints[pointIndex] = { ...newPoints[pointIndex], articles: newArticles }
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
      toast.success('Brouillon du procès-verbal généré avec succès')
      router.refresh()
    })
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

  function handleStatusChange(newStatus: string, label: string) {
    if (!pvId) return
    startTransition(async () => {
      // Save first if dirty
      if (isDirty && contenu) {
        await savePVContent(pvId, contenu, seanceId)
        setIsDirty(false)
      }
      const result = await updatePVStatus(pvId, newStatus, seanceId)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      setPvStatut(newStatus)
      toast.success(`Statut mis à jour : ${label}`)
      router.refresh()
    })
  }

  function handleSign() {
    if (!pvId) return
    startTransition(async () => {
      const result = await signPV(pvId, seanceId)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      // Update local signatures state
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

  function handlePrint() {
    window.print()
  }

  async function handleCopyFormula(index: number, text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedFormula(index)
      toast.success('Formule copiée dans le presse-papiers')
      setTimeout(() => setCopiedFormula(null), 2000)
    } catch {
      toast.error('Impossible de copier dans le presse-papiers')
    }
  }

  // ─── AI Handlers ──────────────────────────────────────────────────────────

  async function handleGeneratePointAI(pointIndex: number) {
    if (!contenu) return
    setAiLoadingPoint(pointIndex)
    try {
      const result = await generatePointContent(seanceId, `point-${pointIndex}`)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      updatePoint(pointIndex, {
        vu: result.content.vu,
        considerant: result.content.considerant,
        articles: result.content.articles,
      })
      toast.success('Vu, Considérant et Articles générés avec l\'IA')
    } catch {
      toast.error('Erreur lors de la génération IA')
    } finally {
      setAiLoadingPoint(null)
    }
  }

  async function handleImproveSection(
    pointIndex: number,
    sectionType: 'vu' | 'considerant' | 'discussion' | 'article',
    currentText: string
  ) {
    if (!currentText.trim()) {
      toast.error('Ajoutez d\'abord du texte à améliorer')
      return
    }
    const sectionKey = `point-${pointIndex}-${sectionType}`
    setAiLoadingSection(sectionKey)
    try {
      const result = await improvePVSection(
        seanceId,
        `point-${pointIndex}`,
        sectionType,
        currentText
      )
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      if (sectionType === 'vu') {
        updatePoint(pointIndex, { vu: result.improvedText })
      } else if (sectionType === 'considerant') {
        updatePoint(pointIndex, { considerant: result.improvedText })
      } else if (sectionType === 'discussion') {
        updatePoint(pointIndex, { discussion: result.improvedText })
      }
      toast.success('Texte amélioré avec l\'IA')
    } catch {
      toast.error('Erreur lors de l\'amélioration IA')
    } finally {
      setAiLoadingSection(null)
    }
  }

  // ─── Section toggle helpers ────────────────────────────────────────────────
  function toggleSection(key: string) {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function togglePoint(index: number) {
    setOpenPoints(prev => ({ ...prev, [index]: !prev[index] }))
  }

  // ─── Derived state ────────────────────────────────────────────────────────
  const statutConfig = PV_STATUT_CONFIG[pvStatut] || PV_STATUT_CONFIG.BROUILLON
  const isReadOnly = !canEdit || pvStatut === 'SIGNE' || pvStatut === 'PUBLIE'
  const isCurrentUserPresident = currentUserMemberId === presidentMemberId
  const isCurrentUserSecretaire = currentUserMemberId === secretaireMemberId
  const canSign = (isCurrentUserPresident || isCurrentUserSecretaire) && pvStatut === 'EN_RELECTURE'

  const presidentSignature = signatures.find(s => s.role === 'president')
  const secretaireSignature = signatures.find(s => s.role === 'secretaire')
  const bothSigned = !!presidentSignature && !!secretaireSignature

  // ─── No PV yet — generate button ──────────────────────────────────────

  if (!contenu) {
    const canGenerate = seanceStatut === 'CLOTUREE' || seanceStatut === 'ARCHIVEE'

    return (
      <div className="max-w-4xl mx-auto">
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
                  <><Sparkles className="h-5 w-5" /> Générer le brouillon du PV</>
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

  // ─── PV Editor (main view) ───────────────────────────────────────────────

  return (
    <TooltipProvider delayDuration={300}>
      <div className="max-w-4xl mx-auto space-y-6 pb-16">
        {/* Sticky Toolbar */}
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b py-3 px-1 print:hidden">
          <div className="flex items-center justify-between flex-wrap gap-2">
            {/* Left side: status + save indicator */}
            <div className="flex items-center gap-3 flex-wrap">
              <Badge className={`${statutConfig.bgColor} ${statutConfig.color} border-0 font-medium`}>
                {statutConfig.label}
              </Badge>

              {isSaving && (
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Sauvegarde automatique...
                </span>
              )}
              {!isSaving && lastSaved && (
                <span className="text-xs text-emerald-600 flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  Sauvegardé à {lastSaved.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              {!isSaving && isDirty && (
                <span className="text-xs text-amber-600">Modifications non sauvegardées</span>
              )}
            </div>

            {/* Right side: actions */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Regenerate */}
              {canEdit && pvStatut === 'BROUILLON' && (
                <AlertDialog>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" disabled={isPending} className="min-h-[36px]">
                          <RefreshCw className="h-4 w-4 mr-1.5" />
                          <span className="hidden sm:inline">Regénérer</span>
                        </Button>
                      </AlertDialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Regénérer le brouillon depuis les données de la séance</TooltipContent>
                  </Tooltip>
                  <AlertDialogContent aria-describedby={undefined}>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Regénérer le brouillon ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Le contenu actuel du procès-verbal sera remplacé par un nouveau brouillon
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

              {/* Manual save */}
              {canEdit && !isReadOnly && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleManualSave}
                      disabled={isPending || isSaving || !isDirty}
                      className="min-h-[36px]"
                    >
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      <span className="hidden sm:inline ml-1.5">Sauvegarder</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isDirty ? 'Sauvegarder les modifications' : 'Aucune modification à sauvegarder'}
                  </TooltipContent>
                </Tooltip>
              )}

              {/* Print */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={handlePrint} className="min-h-[36px]">
                    <Printer className="h-4 w-4" />
                    <span className="hidden sm:inline ml-1.5">Imprimer</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Imprimer le procès-verbal</TooltipContent>
              </Tooltip>

              {/* Export PDF */}
              {pdfUrl && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" asChild className="min-h-[36px]">
                      <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                        <Download className="h-4 w-4" />
                        <span className="hidden sm:inline ml-1.5">Télécharger PDF</span>
                      </a>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Télécharger le procès-verbal en PDF</TooltipContent>
                </Tooltip>
              )}

              <Separator orientation="vertical" className="h-6 hidden sm:block" />

              {/* Status workflow buttons */}
              {canEdit && pvStatut === 'BROUILLON' && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" disabled={isPending} className="min-h-[36px] gap-1.5">
                      <Send className="h-4 w-4" />
                      <span className="hidden sm:inline">Envoyer en relecture</span>
                      <span className="sm:hidden">Relecture</span>
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent aria-describedby={undefined}>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Envoyer en relecture ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Le procès-verbal passera en statut &laquo; En relecture &raquo;.
                        Le président et le secrétaire pourront alors le signer.
                        Vous pourrez revenir au brouillon si besoin.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleStatusChange('EN_RELECTURE', 'En relecture')}>
                        Envoyer en relecture
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}

              {canEdit && pvStatut === 'EN_RELECTURE' && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleStatusChange('BROUILLON', 'Brouillon')}
                      disabled={isPending}
                      className="min-h-[36px] gap-1.5"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      <span className="hidden sm:inline">Revenir au brouillon</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Repasser le PV en brouillon pour modifications</TooltipContent>
                </Tooltip>
              )}

              {canEdit && pvStatut === 'SIGNE' && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" disabled={isPending} className="min-h-[36px] gap-1.5">
                      <BookOpen className="h-4 w-4" />
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
                      <AlertDialogAction onClick={() => handleStatusChange('PUBLIE', 'Publié')}>
                        Publier définitivement
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        </div>

        {/* PV Document Content */}
        <div
          className="bg-white shadow-lg rounded-lg border print:shadow-none print:border-0 print:rounded-none"
          id="pv-content"
        >
          <div className="p-6 sm:p-8 md:p-10 space-y-8 print:p-8 font-serif">

            {/* 1. En-tête */}
            <CollapsibleSection
              id="entete"
              title="En-tête"
              icon={<FileText className="h-4 w-4" />}
              open={openSections.entete}
              onToggle={() => toggleSection('entete')}
            >
              <div className="text-center space-y-3">
                <p className="text-sm text-muted-foreground uppercase tracking-[0.2em] font-sans">
                  {contenu.entete.institution}
                </p>
                <h1 className="text-xl sm:text-2xl font-bold leading-tight">
                  Procès-verbal de la séance
                  {contenu.entete.nomInstance ? ` du ${contenu.entete.nomInstance}` : ''}
                </h1>
                <p className="text-lg font-semibold text-blue-800">
                  {contenu.entete.dateSeance}
                </p>
                <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground flex-wrap font-sans">
                  {contenu.entete.lieu && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {contenu.entete.lieu}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {contenu.entete.heureOuverture || '...'} — {contenu.entete.heureCloture || '...'}
                  </span>
                  <span className="flex items-center gap-1">
                    {contenu.entete.publique ? (
                      <><Unlock className="h-3.5 w-3.5" /> Séance publique</>
                    ) : (
                      <><GlobeLock className="h-3.5 w-3.5" /> Huis clos</>
                    )}
                  </span>
                </div>
                {contenu.entete.reconvocation && (
                  <Badge variant="outline" className="border-amber-300 text-amber-700 font-sans">
                    Reconvocation
                  </Badge>
                )}
              </div>
            </CollapsibleSection>

            <Separator className="print:hidden" />

            {/* 2. Bureau */}
            <CollapsibleSection
              id="bureau"
              title="Bureau de séance"
              icon={<Scale className="h-4 w-4" />}
              open={openSections.bureau}
              onToggle={() => toggleSection('bureau')}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-sans">
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Président(e)</p>
                  <p className="font-medium">{contenu.bureau.president || 'Non désigné(e)'}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Secrétaire de séance</p>
                  <p className="font-medium">{contenu.bureau.secretaire || 'Non désigné(e)'}</p>
                </div>
              </div>
            </CollapsibleSection>

            <Separator className="print:hidden" />

            {/* 3. Présences */}
            <CollapsibleSection
              id="presences"
              title="Présences"
              icon={<Users className="h-4 w-4" />}
              open={openSections.presences}
              onToggle={() => toggleSection('presences')}
            >
              <div className="space-y-4 font-sans">
                {/* Quorum statement */}
                <div className={`rounded-lg p-4 ${
                  contenu.presences.quorum.atteint
                    ? 'bg-emerald-50 border border-emerald-200'
                    : 'bg-red-50 border border-red-200'
                }`}>
                  <div className="flex items-start gap-2">
                    {contenu.presences.quorum.atteint ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className={`text-sm font-medium ${
                        contenu.presences.quorum.atteint ? 'text-emerald-700' : 'text-red-700'
                      }`}>
                        Quorum {contenu.presences.quorum.atteint ? 'atteint' : 'non atteint'} :
                        {' '}{contenu.presences.quorum.presents} présent{contenu.presences.quorum.presents > 1 ? 's' : ''}
                        {' '}sur {contenu.presences.quorum.requis} requis
                      </p>
                      {contenu.presences.quorumStatement && (
                        <p className="text-xs text-muted-foreground mt-1 italic">
                          {contenu.presences.quorumStatement}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Présents */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Présents ({contenu.presences.presents.length})
                  </p>
                  {contenu.presences.presents.length > 0 ? (
                    <ol className="list-decimal list-inside text-sm space-y-0.5">
                      {contenu.presences.presents.map((p, i) => (
                        <li key={i}>
                          {p.prenom} {p.nom}
                          {p.qualite && (
                            <span className="text-muted-foreground"> — {p.qualite}</span>
                          )}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Aucun présent enregistré</p>
                  )}
                </div>

                {/* Excusés */}
                {contenu.presences.excuses.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Excusés ({contenu.presences.excuses.length})
                    </p>
                    <ul className="text-sm space-y-0.5">
                      {contenu.presences.excuses.map((p, i) => (
                        <li key={i} className="text-amber-700">
                          {p.prenom} {p.nom}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Absents */}
                {contenu.presences.absents.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Absents ({contenu.presences.absents.length})
                    </p>
                    <ul className="text-sm space-y-0.5">
                      {contenu.presences.absents.map((p, i) => (
                        <li key={i} className="text-red-700">
                          {p.prenom} {p.nom}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Procurations */}
                {contenu.presences.procurations.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Handshake className="h-3.5 w-3.5" />
                      Procurations ({contenu.presences.procurations.length})
                    </p>
                    <ul className="text-sm space-y-0.5">
                      {contenu.presences.procurations.map((p, i) => (
                        <li key={i} className="text-muted-foreground">
                          {p.mandant} a donné procuration à {p.mandataire}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </CollapsibleSection>

            <Separator className="print:hidden" />

            {/* 4. Introduction libre */}
            <CollapsibleSection
              id="introduction"
              title="Introduction"
              icon={<PenLine className="h-4 w-4" />}
              open={openSections.introduction}
              onToggle={() => toggleSection('introduction')}
              badge={!isReadOnly ? 'modifiable' : undefined}
            >
              {isReadOnly ? (
                contenu.introductionLibre ? (
                  <p className="text-sm leading-relaxed whitespace-pre-line">
                    {contenu.introductionLibre}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Aucune introduction.</p>
                )
              ) : (
                <Textarea
                  value={contenu.introductionLibre}
                  onChange={(e) => updateContenu({ introductionLibre: e.target.value })}
                  placeholder="Introduction facultative du procès-verbal (contexte, observations préliminaires...)"
                  rows={3}
                  className="text-sm font-sans resize-y"
                />
              )}
            </CollapsibleSection>

            <Separator className="print:hidden" />

            {/* 5. Points de l'ordre du jour */}
            <div className="space-y-4">
              <h2 className="text-base font-bold flex items-center gap-2 font-sans print:text-lg">
                <FileText className="h-4 w-4 text-muted-foreground print:hidden" />
                Ordre du jour
              </h2>

              {contenu.points.length === 0 && (
                <div className="text-center py-8 text-muted-foreground border rounded-lg border-dashed">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Aucun point à l&apos;ordre du jour</p>
                </div>
              )}

              {contenu.points.map((point, idx) => {
                const isInfoPoint = INFORMATION_TYPES.includes(point.type)
                const resultatConfig = point.vote?.resultat
                  ? RESULTAT_LABELS[point.vote.resultat]
                  : null
                const ResultIcon = resultatConfig?.icon || Eye

                return (
                  <Collapsible
                    key={idx}
                    open={openPoints[idx] !== false}
                    onOpenChange={() => togglePoint(idx)}
                  >
                    <Card className="overflow-hidden">
                      <CollapsibleTrigger asChild>
                        <button
                          className="w-full text-left p-4 sm:p-6 flex items-start gap-3 hover:bg-muted/30 transition-colors cursor-pointer"
                          type="button"
                        >
                          {/* Position number */}
                          <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold shrink-0 font-sans ${
                            point.vote ? 'bg-blue-100 text-blue-700' : 'bg-muted text-muted-foreground'
                          }`}>
                            {point.position}
                          </span>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-sm font-sans">{point.titre}</h3>
                              <Badge variant="outline" className="text-[10px] font-sans shrink-0">
                                {TYPE_LABELS[point.type] || point.type}
                              </Badge>
                            </div>
                            {point.rapporteur && (
                              <p className="text-xs text-muted-foreground font-sans mt-0.5">
                                Rapporteur : {point.rapporteur}
                              </p>
                            )}
                          </div>

                          {/* Result badge */}
                          {point.vote?.resultat && (
                            <Badge className={`border-0 text-xs shrink-0 font-sans ${resultatConfig?.colorClass || ''}`}>
                              <ResultIcon className="h-3 w-3 mr-1" />
                              {resultatConfig?.label || point.vote.resultat}
                            </Badge>
                          )}

                          {/* Chevron */}
                          <span className="shrink-0 text-muted-foreground print:hidden">
                            {openPoints[idx] !== false ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </span>
                        </button>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <div className="px-4 sm:px-6 pb-4 sm:pb-6 space-y-4">
                          <Separator />

                          {/* Info point badge */}
                          {isInfoPoint && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Info className="h-4 w-4" />
                              <span className="text-xs font-sans">
                                {point.type === 'QUESTION_DIVERSE'
                                  ? 'Questions diverses — point informatif, pas de vote'
                                  : 'Point d\'information — pas de vote'}
                              </span>
                            </div>
                          )}

                          {/* Description / Exposé */}
                          {(point.description || point.projetDeliberation || !isReadOnly) && (
                            <div className="space-y-2">
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider font-sans">
                                Exposé
                              </p>
                              {isReadOnly ? (
                                <div className="text-sm leading-relaxed whitespace-pre-line">
                                  {point.description}
                                  {point.projetDeliberation && (
                                    <div className="mt-2 rounded-lg bg-blue-50 border border-blue-200 p-3">
                                      <p className="text-xs font-semibold text-blue-700 mb-1 font-sans">
                                        Résolution proposée :
                                      </p>
                                      <p className="text-sm text-blue-800 whitespace-pre-line">
                                        {point.projetDeliberation}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <Textarea
                                  value={point.description || ''}
                                  onChange={(e) => updatePoint(idx, { description: e.target.value })}
                                  placeholder="Exposé du point (description, contexte, résolution proposée...)"
                                  rows={3}
                                  className="text-sm font-sans resize-y"
                                />
                              )}
                            </div>
                          )}

                          {/* Votable sections: Vu, Considérant, Discussion, Articles */}
                          {!isInfoPoint && (
                            <>
                              {/* Vu */}
                              <EditableSection
                                label="Vu"
                                tooltip="Références juridiques et textes applicables (lois, décrets, règlements...)"
                                value={point.vu}
                                onChange={(val) => updatePoint(idx, { vu: val })}
                                readOnly={isReadOnly}
                                placeholder="Vu le Code général des collectivités territoriales, et notamment l'article L.XXXX-X ;&#10;Vu la délibération n°XXXX du..."
                                onImprove={() => handleImproveSection(idx, 'vu', point.vu)}
                                isImproving={aiLoadingSection === `point-${idx}-vu`}
                              />

                              {/* Considérant */}
                              <EditableSection
                                label="Considérant"
                                tooltip="Justifications et motifs de la décision"
                                value={point.considerant}
                                onChange={(val) => updatePoint(idx, { considerant: val })}
                                readOnly={isReadOnly}
                                placeholder="Considérant que...&#10;Considérant la nécessité de..."
                                onImprove={() => handleImproveSection(idx, 'considerant', point.considerant)}
                                isImproving={aiLoadingSection === `point-${idx}-considerant`}
                              />

                              {/* Discussion */}
                              <EditableSection
                                label="Discussion"
                                tooltip="Compte rendu des débats et interventions des élus"
                                value={point.discussion}
                                onChange={(val) => updatePoint(idx, { discussion: val })}
                                readOnly={isReadOnly}
                                placeholder="Après en avoir délibéré, les membres ont discuté de..."
                                onImprove={() => handleImproveSection(idx, 'discussion', point.discussion)}
                                isImproving={aiLoadingSection === `point-${idx}-discussion`}
                              />

                              {/* Formule de vote (read-only, highlighted) */}
                              {point.vote?.formulePV && (
                                <div className="space-y-1.5">
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider font-sans">
                                    Formule de vote
                                  </p>
                                  <div className="rounded-lg bg-blue-50/70 border border-blue-200 p-4 relative group">
                                    <p className="text-sm italic leading-relaxed text-blue-900">
                                      {point.vote.formulePV}
                                    </p>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="absolute top-2 right-2 h-11 w-11 p-0 opacity-0 group-hover:opacity-100 transition-opacity print:hidden"
                                          onClick={() => handleCopyFormula(idx, point.vote!.formulePV!)}
                                        >
                                          {copiedFormula === idx ? (
                                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                                          ) : (
                                            <Copy className="h-3.5 w-3.5" />
                                          )}
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Copier la formule de vote</TooltipContent>
                                    </Tooltip>
                                  </div>
                                </div>
                              )}

                              {/* Vote results */}
                              {point.vote && (
                                <div className="space-y-3 font-sans">
                                  <div className="flex items-center gap-2">
                                    <Vote className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                      Résultat du vote
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-4 gap-3 text-center">
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

                                  {point.vote.nomsContre.length > 0 && (
                                    <p className="text-xs text-muted-foreground">
                                      Contre : {point.vote.nomsContre.join(', ')}
                                    </p>
                                  )}
                                  {point.vote.nomsAbstention.length > 0 && (
                                    <p className="text-xs text-muted-foreground">
                                      Abstentions : {point.vote.nomsAbstention.join(', ')}
                                    </p>
                                  )}
                                </div>
                              )}

                              {/* Articles */}
                              <div className="space-y-2">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider font-sans">
                                  Articles
                                </p>
                                {point.articles.length === 0 && isReadOnly && (
                                  <p className="text-sm text-muted-foreground italic font-sans">Aucun article.</p>
                                )}
                                {point.articles.map((article, artIdx) => (
                                  <div key={artIdx} className="flex items-start gap-2">
                                    <span className="text-xs font-bold text-muted-foreground mt-2.5 font-sans shrink-0 w-16">
                                      Art. {artIdx + 1}
                                    </span>
                                    {isReadOnly ? (
                                      <p className="text-sm leading-relaxed flex-1 whitespace-pre-line">{article}</p>
                                    ) : (
                                      <div className="flex-1 flex items-start gap-1">
                                        <Input
                                          value={article}
                                          onChange={(e) => updatePointArticle(idx, artIdx, e.target.value)}
                                          placeholder={`Contenu de l'article ${artIdx + 1}...`}
                                          className="text-sm font-sans"
                                        />
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-11 w-11 p-0 text-muted-foreground hover:text-red-600 shrink-0"
                                              onClick={() => removeArticle(idx, artIdx)}
                                            >
                                              <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>Supprimer cet article</TooltipContent>
                                        </Tooltip>
                                      </div>
                                    )}
                                  </div>
                                ))}
                                {!isReadOnly && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => addArticle(idx)}
                                    className="gap-1.5 font-sans text-xs mt-1"
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                    Ajouter un article
                                  </Button>
                                )}
                              </div>

                              {/* Generate all with AI */}
                              {!isReadOnly && (
                                <div className="pt-2 print:hidden">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleGeneratePointAI(idx)}
                                    disabled={aiLoadingPoint === idx}
                                    title={aiLoadingPoint === idx ? 'Génération en cours...' : undefined}
                                    className="gap-1.5 font-sans text-xs min-h-[44px]"
                                  >
                                    {aiLoadingPoint === idx ? (
                                      <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Génération en cours...</>
                                    ) : (
                                      <><Sparkles className="h-3.5 w-3.5" /> Générer Vu + Considérant + Articles avec l&apos;IA</>
                                    )}
                                  </Button>
                                </div>
                              )}
                            </>
                          )}

                          {/* No vote — information point indicator */}
                          {!isInfoPoint && !point.vote && (
                            <div className="flex items-center gap-2 text-muted-foreground font-sans">
                              <Eye className="h-4 w-4" />
                              <span className="text-xs">Aucun vote enregistré sur ce point</span>
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                )
              })}
            </div>

            <Separator className="print:hidden" />

            {/* 6. Conclusion / Observations */}
            <CollapsibleSection
              id="conclusion"
              title="Observations complémentaires"
              icon={<PenLine className="h-4 w-4" />}
              open={openSections.conclusion}
              onToggle={() => toggleSection('conclusion')}
              badge={!isReadOnly ? 'modifiable' : undefined}
            >
              {isReadOnly ? (
                contenu.conclusionLibre ? (
                  <p className="text-sm leading-relaxed whitespace-pre-line">
                    {contenu.conclusionLibre}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Aucune observation.</p>
                )
              ) : (
                <Textarea
                  value={contenu.conclusionLibre}
                  onChange={(e) => updateContenu({ conclusionLibre: e.target.value })}
                  placeholder="Observations complémentaires, remarques du secrétaire de séance..."
                  rows={3}
                  className="text-sm font-sans resize-y"
                />
              )}
            </CollapsibleSection>

            <Separator className="print:hidden" />

            {/* 7. Clôture */}
            <CollapsibleSection
              id="cloture"
              title="Clôture de la séance"
              icon={<Clock className="h-4 w-4" />}
              open={openSections.cloture}
              onToggle={() => toggleSection('cloture')}
            >
              <p className="text-sm italic leading-relaxed text-muted-foreground">
                {contenu.cloture.texte}
              </p>
            </CollapsibleSection>

            <Separator />

            {/* 8. Signatures */}
            <CollapsibleSection
              id="signatures"
              title="Signatures"
              icon={<ShieldCheck className="h-4 w-4" />}
              open={openSections.signatures}
              onToggle={() => toggleSection('signatures')}
            >
              {/* Both signed banner */}
              {bothSigned && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 mb-4">
                  <div className="flex items-center gap-2">
                    <Lock className="h-5 w-5 text-emerald-600" />
                    <div>
                      <p className="text-sm font-semibold text-emerald-700">
                        Procès-verbal signé et verrouillé
                      </p>
                      <p className="text-xs text-emerald-600">
                        Signé le{' '}
                        {new Date(
                          secretaireSignature!.timestamp > presidentSignature!.timestamp
                            ? secretaireSignature!.timestamp
                            : presidentSignature!.timestamp
                        ).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                        {' '}à{' '}
                        {new Date(
                          secretaireSignature!.timestamp > presidentSignature!.timestamp
                            ? secretaireSignature!.timestamp
                            : presidentSignature!.timestamp
                        ).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Signature cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-sans">
                {/* President signature */}
                <Card className={`${presidentSignature ? 'border-emerald-200 bg-emerald-50/50' : ''}`}>
                  <CardContent className="p-4 text-center">
                    <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">
                      Signature du/de la Président(e)
                    </p>
                    <p className="font-medium text-sm mb-3">
                      {contenu.bureau.president || '...'}
                    </p>
                    {presidentSignature ? (
                      <div className="flex items-center justify-center gap-1.5 text-emerald-600">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="text-xs">
                          Signé le{' '}
                          {new Date(presidentSignature.timestamp).toLocaleDateString('fr-FR', {
                            day: 'numeric', month: 'long', year: 'numeric',
                          })}
                        </span>
                      </div>
                    ) : (
                      <Badge variant="outline" className="text-xs text-amber-600 border-amber-200">
                        En attente
                      </Badge>
                    )}
                  </CardContent>
                </Card>

                {/* Secretary signature */}
                <Card className={`${secretaireSignature ? 'border-emerald-200 bg-emerald-50/50' : ''}`}>
                  <CardContent className="p-4 text-center">
                    <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">
                      Signature du/de la Secrétaire
                    </p>
                    <p className="font-medium text-sm mb-3">
                      {contenu.bureau.secretaire || '...'}
                    </p>
                    {secretaireSignature ? (
                      <div className="flex items-center justify-center gap-1.5 text-emerald-600">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="text-xs">
                          Signé le{' '}
                          {new Date(secretaireSignature.timestamp).toLocaleDateString('fr-FR', {
                            day: 'numeric', month: 'long', year: 'numeric',
                          })}
                        </span>
                      </div>
                    ) : (
                      <Badge variant="outline" className="text-xs text-amber-600 border-amber-200">
                        En attente
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Sign button for authorized users */}
              {canSign && !bothSigned && (
                <div className="mt-4 text-center print:hidden">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="lg"
                        className="gap-2 min-h-[48px]"
                        disabled={isPending}
                      >
                        {isPending ? (
                          <><Loader2 className="h-5 w-5 animate-spin" /> Signature en cours...</>
                        ) : (
                          <><PenLine className="h-5 w-5" /> Signer le procès-verbal</>
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent aria-describedby={undefined}>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Signer le procès-verbal ?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Cette action est irréversible. En signant, vous certifiez que le contenu
                          du procès-verbal est conforme aux délibérations de la séance.
                          {isCurrentUserPresident && !presidentSignature && (
                            <span className="block mt-2 font-medium text-foreground">
                              Vous signez en tant que Président(e).
                            </span>
                          )}
                          {isCurrentUserSecretaire && !secretaireSignature && (
                            <span className="block mt-2 font-medium text-foreground">
                              Vous signez en tant que Secrétaire de séance.
                            </span>
                          )}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={handleSign}>
                          Signer définitivement
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </CollapsibleSection>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}

// ─── Collapsible Section Sub-component ──────────────────────────────────────

function CollapsibleSection({
  id,
  title,
  icon,
  open,
  onToggle,
  children,
  badge,
}: {
  id: string
  title: string
  icon: React.ReactNode
  open: boolean
  onToggle: () => void
  children: React.ReactNode
  badge?: string
}) {
  return (
    <Collapsible open={open} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center gap-2 text-left py-2 hover:text-foreground transition-colors cursor-pointer group print:cursor-default"
          data-section={id}
        >
          <span className="text-muted-foreground group-hover:text-foreground transition-colors print:hidden">
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </span>
          <span className="text-muted-foreground">{icon}</span>
          <h2 className="text-base font-bold font-sans">{title}</h2>
          {badge && (
            <Badge variant="outline" className="text-[10px] font-sans ml-2 print:hidden">
              {badge}
            </Badge>
          )}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3">
        {children}
      </CollapsibleContent>
    </Collapsible>
  )
}

// ─── Editable Section Sub-component (Vu / Considérant / Discussion) ─────────

function EditableSection({
  label,
  tooltip,
  value,
  onChange,
  readOnly,
  placeholder,
  onImprove,
  isImproving,
}: {
  label: string
  tooltip: string
  value: string
  onChange: (val: string) => void
  readOnly: boolean
  placeholder: string
  onImprove: () => void
  isImproving: boolean
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider font-sans">
          {label}
        </p>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help print:hidden" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">{tooltip}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {readOnly ? (
        value ? (
          <p className="text-sm leading-relaxed whitespace-pre-line">{value}</p>
        ) : (
          <p className="text-sm text-muted-foreground italic font-sans">Non renseigné.</p>
        )
      ) : (
        <div className="space-y-1.5">
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={3}
            className="text-sm font-sans resize-y"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={onImprove}
            disabled={isImproving}
            title={isImproving ? 'Amélioration en cours...' : undefined}
            className="gap-1.5 text-xs font-sans min-h-[44px] print:hidden"
          >
            {isImproving ? (
              <><Loader2 className="h-3 w-3 animate-spin" /> Amélioration en cours...</>
            ) : (
              <><Sparkles className="h-3 w-3" /> Améliorer avec l&apos;IA</>
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
