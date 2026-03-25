'use client'

import { useState, useEffect, useCallback, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent } from '@/components/ui/card'
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

const PV_STATUT_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  BROUILLON: { label: 'Brouillon', color: 'text-amber-700', bgColor: 'bg-amber-100' },
  EN_RELECTURE: { label: 'En relecture', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  SIGNE: { label: 'Sign\u00e9', color: 'text-green-700', bgColor: 'bg-green-100' },
  PUBLIE: { label: 'Publi\u00e9', color: 'text-purple-700', bgColor: 'bg-purple-100' },
}

const RESULTAT_LABELS: Record<string, { label: string; icon: typeof CheckCircle2; colorClass: string }> = {
  ADOPTE: { label: 'Adopt\u00e9', icon: CheckCircle2, colorClass: 'text-emerald-700' },
  ADOPTE_UNANIMITE: { label: 'Unanimit\u00e9', icon: Sparkles, colorClass: 'text-emerald-700' },
  ADOPTE_VOIX_PREPONDERANTE: { label: 'Voix pr\u00e9pond\u00e9rante', icon: Scale, colorClass: 'text-blue-700' },
  REJETE: { label: 'Rejet\u00e9', icon: XCircle, colorClass: 'text-red-700' },
  NUL: { label: 'Nul', icon: Ban, colorClass: 'text-amber-700' },
}

const TYPE_LABELS: Record<string, string> = {
  DELIBERATION: 'D\u00e9lib\u00e9ration',
  ELECTION: '\u00c9lection',
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

  // ─── Auto-save state ─────────────────────────────────────────────────────
  const [isDirty, setIsDirty] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const contenuRef = useRef(contenu)

  // ─── AI loading per point ──────────────────────────────────────────────
  const [aiLoadingPoint, setAiLoadingPoint] = useState<number | null>(null)

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
      toast.success('Brouillon du proc\u00e8s-verbal g\u00e9n\u00e9r\u00e9 avec succ\u00e8s')
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
        toast.success('Proc\u00e8s-verbal sauvegard\u00e9')
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
        toast.success('Proc\u00e8s-verbal sign\u00e9 par les deux parties ! Le PV est d\u00e9sormais verrouill\u00e9.')
      } else {
        toast.success('Votre signature a \u00e9t\u00e9 enregistr\u00e9e. En attente de la seconde signature.')
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
      toast.success('Proc\u00e8s-verbal publi\u00e9')
      router.refresh()
    })
  }

  function handlePrint() {
    window.print()
  }

  // ─── AI Handler ──────────────────────────────────────────────────────────
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
      toast.success(currentText ? 'Texte reformul\u00e9' : 'Texte sugg\u00e9r\u00e9')
    } catch {
      toast.error('Erreur lors de la g\u00e9n\u00e9ration IA')
    } finally {
      setAiLoadingPoint(null)
    }
  }

  // ─── Derived state ────────────────────────────────────────────────────────
  const statutConfig = PV_STATUT_CONFIG[pvStatut] || PV_STATUT_CONFIG.BROUILLON
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

  // ─── No PV yet — generate button ──────────────────────────────────────
  if (!contenu) {
    const canGenerate = seanceStatut === 'CLOTUREE' || seanceStatut === 'ARCHIVEE'

    return (
      <div className="max-w-4xl mx-auto">
        <div className="text-center py-16 rounded-xl border border-dashed">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
          <h2 className="text-lg font-semibold mb-2">Proc\u00e8s-verbal</h2>
          {canGenerate ? (
            <>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                La s\u00e9ance est cl\u00f4tur\u00e9e. G\u00e9n\u00e9rez le brouillon du proc\u00e8s-verbal automatiquement
                \u00e0 partir des donn\u00e9es de la s\u00e9ance.
              </p>
              <Button
                size="lg"
                onClick={handleGenerate}
                disabled={isPending}
                className="gap-2 min-h-[44px]"
              >
                {isPending ? (
                  <><Loader2 className="h-5 w-5 animate-spin" /> G\u00e9n\u00e9ration en cours...</>
                ) : (
                  <><Sparkles className="h-5 w-5" /> G\u00e9n\u00e9rer le proc\u00e8s-verbal</>
                )}
              </Button>
            </>
          ) : (
            <>
              <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                Le proc\u00e8s-verbal pourra \u00eatre g\u00e9n\u00e9r\u00e9 une fois la s\u00e9ance cl\u00f4tur\u00e9e.
              </p>
              <div className="flex items-center justify-center gap-2 text-amber-600">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm">S\u00e9ance en statut : {seanceStatut}</span>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  // ─── PV de carence ──────────────────────────────────────────────────────
  if (isCarence) {
    return (
      <TooltipProvider delayDuration={300}>
        <div className="max-w-4xl mx-auto pb-16">
          {/* Toolbar */}
          <PVToolbar
            statutConfig={statutConfig}
            pvStatut={pvStatut}
            isSaving={isSaving}
            lastSaved={lastSaved}
            isDirty={isDirty}
            isPending={isPending}
            canEdit={canEdit}
            pdfUrl={pdfUrl}
            isEditable={isEditable}
            onPrint={handlePrint}
            onManualSave={handleManualSave}
            onGenerate={handleGenerate}
            onPublish={handlePublish}
            canSignPV={canSignPV}
            bothSigned={bothSigned}
            onSign={handleSign}
            isCurrentUserPresident={isCurrentUserPresident}
            isCurrentUserSecretaire={isCurrentUserSecretaire}
            presidentSignature={presidentSignature}
            secretaireSignature={secretaireSignature}
          />

          {/* Document de carence */}
          <div className="bg-white shadow-lg rounded-xl my-6 p-8 sm:p-12 font-serif print:shadow-none print:rounded-none print:my-0">
            <p className="text-sm text-muted-foreground uppercase tracking-[0.2em] font-sans text-center">
              {contenu.entete.institution}
            </p>

            <h1 className="text-2xl font-bold text-center uppercase tracking-wide mt-4">
              Proc\u00e8s-verbal de carence
            </h1>

            <p className="text-center text-muted-foreground mt-2 font-sans">
              S\u00e9ance du {contenu.entete.dateSeance} \u2014 {contenu.entete.nomInstance}
            </p>

            <Separator className="my-8" />

            <div className="space-y-6 leading-relaxed">
              <p>
                Le quorum n&apos;\u00e9tant pas atteint ({contenu.presences.quorum.presents} pr\u00e9sent{contenu.presences.quorum.presents > 1 ? 's' : ''}{' '}
                sur {contenu.presences.quorum.requis} requis), le/la Pr\u00e9sident(e){' '}
                {contenu.bureau.president ? <strong>{contenu.bureau.president}</strong> : 'M./Mme ...'}{' '}
                constate la carence et prononce l&apos;ajournement de la s\u00e9ance.
              </p>

              {contenu.presences.presents.length > 0 && (
                <div>
                  <p className="font-semibold text-sm font-sans uppercase tracking-wider text-muted-foreground mb-2">
                    \u00c9taient pr\u00e9sents
                  </p>
                  <p>
                    {contenu.presences.presents.map(p => `${p.prenom} ${p.nom}`).join(', ')}
                  </p>
                </div>
              )}

              {contenu.presences.excuses.length > 0 && (
                <div>
                  <p className="font-semibold text-sm font-sans uppercase tracking-wider text-muted-foreground mb-2">
                    \u00c9taient excus\u00e9s
                  </p>
                  <p>
                    {contenu.presences.excuses.map(p => `${p.prenom} ${p.nom}`).join(', ')}
                  </p>
                </div>
              )}

              {contenu.presences.absents.length > 0 && (
                <div>
                  <p className="font-semibold text-sm font-sans uppercase tracking-wider text-muted-foreground mb-2">
                    \u00c9taient absents
                  </p>
                  <p>
                    {contenu.presences.absents.map(p => `${p.prenom} ${p.nom}`).join(', ')}
                  </p>
                </div>
              )}

              <p>
                Une reconvocation sera adress\u00e9e aux membres dans les meilleurs d\u00e9lais,
                conform\u00e9ment aux dispositions de l&apos;article L2121-17 du Code g\u00e9n\u00e9ral des collectivit\u00e9s territoriales.
              </p>

              <p className="text-muted-foreground">
                Fait \u00e0 {contenu.entete.lieu || '...'}, le {contenu.entete.dateSeance}
              </p>
            </div>

            <Separator className="my-8" />

            {/* Signatures */}
            <SignaturesSection
              bureau={contenu.bureau}
              presidentSignature={presidentSignature}
              secretaireSignature={secretaireSignature}
              bothSigned={bothSigned}
              canSignPV={canSignPV}
              isPending={isPending}
              isCurrentUserPresident={isCurrentUserPresident}
              isCurrentUserSecretaire={isCurrentUserSecretaire}
              onSign={handleSign}
            />
          </div>
        </div>
      </TooltipProvider>
    )
  }

  // ─── PV normal (document view) ──────────────────────────────────────────
  return (
    <TooltipProvider delayDuration={300}>
      <div className="max-w-4xl mx-auto pb-16">
        {/* Toolbar */}
        <PVToolbar
          statutConfig={statutConfig}
          pvStatut={pvStatut}
          isSaving={isSaving}
          lastSaved={lastSaved}
          isDirty={isDirty}
          isPending={isPending}
          canEdit={canEdit}
          pdfUrl={pdfUrl}
          isEditable={isEditable}
          onPrint={handlePrint}
          onManualSave={handleManualSave}
          onGenerate={handleGenerate}
          onPublish={handlePublish}
          canSignPV={canSignPV}
          bothSigned={bothSigned}
          onSign={handleSign}
          isCurrentUserPresident={isCurrentUserPresident}
          isCurrentUserSecretaire={isCurrentUserSecretaire}
          presidentSignature={presidentSignature}
          secretaireSignature={secretaireSignature}
        />

        {/* Document */}
        <div
          className="bg-white shadow-lg rounded-xl my-6 p-8 sm:p-12 font-serif print:shadow-none print:rounded-none print:my-0"
          id="pv-content"
        >
          {/* ── Title ────────────────────────────────────────────────── */}
          <p className="text-sm text-muted-foreground uppercase tracking-[0.2em] font-sans text-center">
            {contenu.entete.institution}
          </p>

          <h1 className="text-2xl font-bold text-center uppercase tracking-wide mt-4">
            Proc\u00e8s-verbal de la s\u00e9ance du {contenu.entete.dateSeance}
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
            <span>{contenu.entete.publique ? 'S\u00e9ance publique' : 'Huis clos'}</span>
            <span>{contenu.entete.mode === 'VISIOCONFERENCE' ? 'Visioconf\u00e9rence' : 'Pr\u00e9sentiel'}</span>
          </div>

          {/* ── Reconvocation banner ─────────────────────────────────── */}
          {(contenu.entete.reconvocation || seanceReconvocation) && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-6">
              <p className="text-sm text-amber-800">
                Cette s\u00e9ance fait suite \u00e0 une reconvocation. Conform\u00e9ment au CGCT L2121-17,
                elle se tient valablement sans condition de quorum.
              </p>
            </div>
          )}

          {/* ── Bureau de s\u00e9ance ────────────────────────────────────── */}
          <div className="mt-6 text-sm">
            <p>
              Sous la pr\u00e9sidence de{' '}
              <strong>{contenu.bureau.president || '...'}</strong>
              {contenu.bureau.secretaire && (
                <>, {contenu.bureau.secretaire} assure le secr\u00e9tariat de s\u00e9ance</>
              )}.
            </p>
          </div>

          <Separator className="my-8" />

          {/* ── Pr\u00e9sences ──────────────────────────────────────────── */}
          <h2 className="text-lg font-bold uppercase tracking-wider font-sans mb-4">Pr\u00e9sences</h2>

          <div className="space-y-3 text-sm">
            {contenu.presences.presents.length > 0 && (
              <p>
                <strong className="font-sans">Pr\u00e9sents ({contenu.presences.presents.length}) :</strong>{' '}
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
                <strong className="font-sans">Excus\u00e9s ({contenu.presences.excuses.length}) :</strong>{' '}
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
                    {p.mandant} a donn\u00e9 pouvoir \u00e0 {p.mandataire}
                    {i < contenu.presences.procurations.length - 1 ? ' ; ' : ''}
                  </span>
                ))}
              </p>
            )}

            {/* Quorum */}
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
                  {' '}{contenu.presences.quorum.presents} pr\u00e9sent{contenu.presences.quorum.presents > 1 ? 's' : ''}
                  {' '}sur {contenu.presences.quorum.requis} requis
                </span>
              </div>
            </div>
          </div>

          {/* Quorum statement */}
          {contenu.presences.quorumStatement && (
            <p className="text-sm italic text-muted-foreground mt-3">
              {contenu.presences.quorumStatement}
            </p>
          )}

          {/* ── Points de l&apos;ordre du jour ─────────────────────────── */}
          {contenu.points.map((point, idx) => {
            const isInfoPoint = INFORMATION_TYPES.includes(point.type)
            const resultatConfig = point.vote?.resultat
              ? RESULTAT_LABELS[point.vote.resultat]
              : null
            const ResultIcon = resultatConfig?.icon || Eye

            return (
              <div key={idx}>
                <Separator className="my-8" />

                {/* Point header */}
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

                {/* Description / expos\u00e9 */}
                {point.description && (
                  <p className="text-sm leading-relaxed mb-4 whitespace-pre-line">
                    {point.description}
                  </p>
                )}

                {/* Projet de d\u00e9lib\u00e9ration */}
                {point.projetDeliberation && (
                  <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 mb-4">
                    <p className="text-xs font-semibold text-blue-700 mb-1 font-sans">R\u00e9solution propos\u00e9e :</p>
                    <p className="text-sm text-blue-800 whitespace-pre-line">{point.projetDeliberation}</p>
                  </div>
                )}

                {/* Formule PV (auto-generated, read-only) */}
                {point.vote?.formulePV && (
                  <div className="rounded-lg bg-blue-50/70 border border-blue-200 p-4 mb-4">
                    <p className="text-sm italic leading-relaxed text-blue-900">
                      {point.vote.formulePV}
                    </p>
                  </div>
                )}

                {/* Vote details */}
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

                {/* ── Discussion textarea (the main editable part) ─── */}
                <div className="mt-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider font-sans mb-2 flex items-center gap-1.5">
                    <PenLine className="h-3.5 w-3.5" />
                    Discussion
                  </p>

                  {isEditable ? (
                    <div className="space-y-2">
                      <Textarea
                        value={point.discussion}
                        onChange={(e) => updatePointDiscussion(idx, e.target.value)}
                        placeholder="Notes de discussion\u2026 (interventions des \u00e9lus, remarques, d\u00e9bats)"
                        rows={3}
                        className="text-sm font-sans resize-y min-h-[80px]"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleImproveDiscussion(idx)}
                        disabled={aiLoadingPoint === idx}
                        className="gap-1.5 text-xs font-sans text-muted-foreground hover:text-foreground min-h-[44px] print:hidden"
                      >
                        {aiLoadingPoint === idx ? (
                          <><Loader2 className="h-3 w-3 animate-spin" /> Reformulation en cours...</>
                        ) : point.discussion ? (
                          <><Sparkles className="h-3 w-3" /> Reformuler avec l&apos;IA</>
                        ) : (
                          <><Sparkles className="h-3 w-3" /> Sugg\u00e9rer un texte</>
                        )}
                      </Button>
                    </div>
                  ) : (
                    point.discussion ? (
                      <p className="text-sm leading-relaxed whitespace-pre-line">{point.discussion}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground italic font-sans">Aucune discussion not\u00e9e.</p>
                    )
                  )}
                </div>
              </div>
            )
          })}

          <Separator className="my-8" />

          {/* ── Observations (optional textarea) ──────────────────── */}
          {isEditable && (
            <>
              <h2 className="text-lg font-bold uppercase tracking-wider font-sans mb-4">Observations</h2>
              <Textarea
                value={contenu.conclusionLibre}
                onChange={(e) => updateContenu({ conclusionLibre: e.target.value })}
                placeholder="Observations compl\u00e9mentaires (facultatif)\u2026"
                rows={3}
                className="text-sm font-sans resize-y mb-6"
              />
            </>
          )}
          {!isEditable && contenu.conclusionLibre && (
            <>
              <h2 className="text-lg font-bold uppercase tracking-wider font-sans mb-4">Observations</h2>
              <p className="text-sm leading-relaxed whitespace-pre-line mb-6">{contenu.conclusionLibre}</p>
            </>
          )}

          {/* ── Cl\u00f4ture ──────────────────────────────────────────── */}
          <Separator className="my-8" />

          <h2 className="text-lg font-bold uppercase tracking-wider font-sans mb-4">Cl\u00f4ture</h2>
          <p className="text-sm italic leading-relaxed text-muted-foreground">
            {contenu.cloture.texte}
          </p>

          <Separator className="my-8" />

          {/* ── Signatures ──────────────────────────────────────────── */}
          <SignaturesSection
            bureau={contenu.bureau}
            presidentSignature={presidentSignature}
            secretaireSignature={secretaireSignature}
            bothSigned={bothSigned}
            canSignPV={canSignPV}
            isPending={isPending}
            isCurrentUserPresident={isCurrentUserPresident}
            isCurrentUserSecretaire={isCurrentUserSecretaire}
            onSign={handleSign}
          />
        </div>
      </div>
    </TooltipProvider>
  )
}

// ─── Toolbar Sub-component ──────────────────────────────────────────────────

function PVToolbar({
  statutConfig,
  pvStatut,
  isSaving,
  lastSaved,
  isDirty,
  isPending,
  canEdit,
  pdfUrl,
  isEditable,
  onPrint,
  onManualSave,
  onGenerate,
  onPublish,
  canSignPV,
  bothSigned,
  onSign,
  isCurrentUserPresident,
  isCurrentUserSecretaire,
  presidentSignature,
  secretaireSignature,
}: {
  statutConfig: { label: string; color: string; bgColor: string }
  pvStatut: string
  isSaving: boolean
  lastSaved: Date | null
  isDirty: boolean
  isPending: boolean
  canEdit: boolean
  pdfUrl: string | null
  isEditable: boolean
  onPrint: () => void
  onManualSave: () => void
  onGenerate: () => void
  onPublish: () => void
  canSignPV: boolean
  bothSigned: boolean
  onSign: () => void
  isCurrentUserPresident: boolean
  isCurrentUserSecretaire: boolean
  presidentSignature: PVSignatureRecord | undefined
  secretaireSignature: PVSignatureRecord | undefined
}) {
  return (
    <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b py-3 px-1 print:hidden">
      <div className="flex items-center justify-between flex-wrap gap-2">
        {/* Left: status + save indicator */}
        <div className="flex items-center gap-3 flex-wrap">
          <Badge className={`${statutConfig.bgColor} ${statutConfig.color} border-0 font-medium`}>
            {statutConfig.label}
          </Badge>

          {isSaving && (
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              Sauvegarde...
            </span>
          )}
          {!isSaving && lastSaved && (
            <span className="text-xs text-emerald-600 flex items-center gap-1" suppressHydrationWarning>
              <Check className="h-3 w-3" />
              Sauvegard\u00e9 \u00e0 {lastSaved.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {!isSaving && isDirty && (
            <span className="text-xs text-amber-600">Modifications non sauvegard\u00e9es</span>
          )}
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Regenerate (BROUILLON only) */}
          {canEdit && pvStatut === 'BROUILLON' && (
            <AlertDialog>
              <Tooltip>
                <TooltipTrigger asChild>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" disabled={isPending} className="min-h-[36px]">
                      <RefreshCw className="h-4 w-4 mr-1.5" />
                      <span className="hidden sm:inline">Reg\u00e9n\u00e9rer</span>
                    </Button>
                  </AlertDialogTrigger>
                </TooltipTrigger>
                <TooltipContent>Reg\u00e9n\u00e9rer le brouillon depuis les donn\u00e9es de la s\u00e9ance</TooltipContent>
              </Tooltip>
              <AlertDialogContent aria-describedby={undefined}>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reg\u00e9n\u00e9rer le brouillon ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Le contenu actuel du proc\u00e8s-verbal sera remplac\u00e9 par un nouveau brouillon
                    g\u00e9n\u00e9r\u00e9 \u00e0 partir des donn\u00e9es actuelles de la s\u00e9ance.
                    Toutes les modifications manuelles seront perdues.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={onGenerate}>
                    Reg\u00e9n\u00e9rer le brouillon
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {/* Manual save */}
          {canEdit && isEditable && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onManualSave}
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
                {isDirty ? 'Sauvegarder les modifications' : 'Aucune modification \u00e0 sauvegarder'}
              </TooltipContent>
            </Tooltip>
          )}

          {/* Print */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={onPrint} className="min-h-[36px]">
                <Printer className="h-4 w-4" />
                <span className="hidden sm:inline ml-1.5">Imprimer</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Imprimer le proc\u00e8s-verbal</TooltipContent>
          </Tooltip>

          {/* Export PDF */}
          {pdfUrl && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" asChild className="min-h-[36px]">
                  <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline ml-1.5">T\u00e9l\u00e9charger PDF</span>
                  </a>
                </Button>
              </TooltipTrigger>
              <TooltipContent>T\u00e9l\u00e9charger le proc\u00e8s-verbal en PDF</TooltipContent>
            </Tooltip>
          )}

          <Separator orientation="vertical" className="h-6 hidden sm:block" />

          {/* Primary action */}
          {pvStatut === 'BROUILLON' && canSignPV && !bothSigned && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" disabled={isPending} className="min-h-[36px] gap-1.5">
                  <PenLine className="h-4 w-4" />
                  Finaliser et signer
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent aria-describedby={undefined}>
                <AlertDialogHeader>
                  <AlertDialogTitle>Signer le proc\u00e8s-verbal ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    \u00cates-vous s\u00fbr(e) de vouloir signer ce proc\u00e8s-verbal ? Cette action est d\u00e9finitive \u2014 le PV sera verrouill\u00e9.
                    {isCurrentUserPresident && !presidentSignature && (
                      <span className="block mt-2 font-medium text-foreground">
                        Vous signez en tant que Pr\u00e9sident(e).
                      </span>
                    )}
                    {isCurrentUserSecretaire && !secretaireSignature && (
                      <span className="block mt-2 font-medium text-foreground">
                        Vous signez en tant que Secr\u00e9taire de s\u00e9ance.
                      </span>
                    )}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={onSign}>
                    Signer d\u00e9finitivement
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
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
                  <AlertDialogTitle>Publier le proc\u00e8s-verbal ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Le proc\u00e8s-verbal sign\u00e9 sera publi\u00e9 et accessible \u00e0 tous les membres.
                    Cette action est d\u00e9finitive.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={onPublish}>
                    Publier d\u00e9finitivement
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {pvStatut === 'PUBLIE' && pdfUrl && (
            <Button size="sm" asChild className="min-h-[36px] gap-1.5">
              <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                <Download className="h-4 w-4" />
                T\u00e9l\u00e9charger le PDF
              </a>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Signatures Sub-component ───────────────────────────────────────────────

function SignaturesSection({
  bureau,
  presidentSignature,
  secretaireSignature,
  bothSigned,
  canSignPV,
  isPending,
  isCurrentUserPresident,
  isCurrentUserSecretaire,
  onSign,
}: {
  bureau: PVContenu['bureau']
  presidentSignature: PVSignatureRecord | undefined
  secretaireSignature: PVSignatureRecord | undefined
  bothSigned: boolean
  canSignPV: boolean
  isPending: boolean
  isCurrentUserPresident: boolean
  isCurrentUserSecretaire: boolean
  onSign: () => void
}) {
  return (
    <div>
      <h2 className="text-lg font-bold uppercase tracking-wider font-sans mb-4">Signatures</h2>

      {/* Both signed banner */}
      {bothSigned && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 mb-4">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-emerald-600" />
            <div>
              <p className="text-sm font-semibold text-emerald-700 font-sans">
                Proc\u00e8s-verbal sign\u00e9 et verrouill\u00e9
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Signature cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-sans">
        {/* President */}
        <Card className={presidentSignature ? 'border-emerald-200 bg-emerald-50/50' : ''}>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">
              Le/La Pr\u00e9sident(e)
            </p>
            <p className="font-medium text-sm mb-3">
              {bureau.president || '...'}
            </p>
            {presidentSignature ? (
              <div className="flex items-center justify-center gap-1.5 text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-xs" suppressHydrationWarning>
                  Sign\u00e9 le{' '}
                  {new Date(presidentSignature.timestamp).toLocaleDateString('fr-FR', {
                    day: 'numeric', month: 'long', year: 'numeric',
                  })}
                  {' '}\u00e0{' '}
                  {new Date(presidentSignature.timestamp).toLocaleTimeString('fr-FR', {
                    hour: '2-digit', minute: '2-digit',
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

        {/* Secretary */}
        <Card className={secretaireSignature ? 'border-emerald-200 bg-emerald-50/50' : ''}>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">
              Le/La Secr\u00e9taire
            </p>
            <p className="font-medium text-sm mb-3">
              {bureau.secretaire || '...'}
            </p>
            {secretaireSignature ? (
              <div className="flex items-center justify-center gap-1.5 text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-xs" suppressHydrationWarning>
                  Sign\u00e9 le{' '}
                  {new Date(secretaireSignature.timestamp).toLocaleDateString('fr-FR', {
                    day: 'numeric', month: 'long', year: 'numeric',
                  })}
                  {' '}\u00e0{' '}
                  {new Date(secretaireSignature.timestamp).toLocaleTimeString('fr-FR', {
                    hour: '2-digit', minute: '2-digit',
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

      {/* Sign button */}
      {canSignPV && !bothSigned && (
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
                  <><PenLine className="h-5 w-5" /> Signer le proc\u00e8s-verbal</>
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent aria-describedby={undefined}>
              <AlertDialogHeader>
                <AlertDialogTitle>Signer le proc\u00e8s-verbal ?</AlertDialogTitle>
                <AlertDialogDescription>
                  \u00cates-vous s\u00fbr(e) de vouloir signer ce proc\u00e8s-verbal ? Cette action est d\u00e9finitive \u2014 le PV sera verrouill\u00e9.
                  {isCurrentUserPresident && !presidentSignature && (
                    <span className="block mt-2 font-medium text-foreground">
                      Vous signez en tant que Pr\u00e9sident(e).
                    </span>
                  )}
                  {isCurrentUserSecretaire && !secretaireSignature && (
                    <span className="block mt-2 font-medium text-foreground">
                      Vous signez en tant que Secr\u00e9taire de s\u00e9ance.
                    </span>
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={onSign}>
                  Signer d\u00e9finitivement
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  )
}
