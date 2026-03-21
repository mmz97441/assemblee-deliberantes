'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  CalendarDays,
  MapPin,
  Users,
  FileText,
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  AlertTriangle,
  CheckCircle2,
  Clock,
  UserPlus,
  UserMinus,
  Video,
  Building2,
  Monitor,
  Loader2,
  Info,
  Shield,
  Send,
  RefreshCw,
  Upload,
  Paperclip,
  X,
  Vote,
  MessageSquare,
  Eye,
  Mail,
  MailCheck,
  MailX,
  MailWarning,
  ListPlus,
  AlertOctagon,
  Circle,
  Sparkles,
  ArrowRight,
  CircleCheck,
  CircleDot,
} from 'lucide-react'
import {
  addODJPoint,
  updateODJPoint,
  deleteODJPoint,
  reorderODJPoints,
  updateSeanceStatut,
  addConvocataire,
  removeConvocataire,
  addStandardODJPoints,
} from '@/lib/actions/seances'
import { sendConvocations, resendConvocation } from '@/lib/actions/convocations'
import { uploadODJDocument, removeODJDocument, getDocumentUrl, type DocumentInfo } from '@/lib/actions/documents'
import type { ODJPointRow } from '@/lib/supabase/types'

// ─── Types ───────────────────────────────────────────────────────────────────

interface MemberOption {
  id: string
  prenom: string
  nom: string
  email: string
  role: string
  qualite_officielle: string | null
}

interface ConvocataireItem {
  id: string
  member_id: string
  statut_convocation: string | null
  envoye_at: string | null
  confirme_at: string | null
  member: MemberOption | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface SeanceData extends Record<string, any> {
  id: string
  titre: string
  date_seance: string
  statut: string | null
  mode: string | null
  lieu: string | null
  publique: boolean | null
  notes: string | null
  instance_id: string
  heure_ouverture: string | null
  heure_cloture: string | null
  reconvocation: boolean | null
  instance_config: {
    id: string
    nom: string
    type_legal: string
    delai_convocation_jours: number | null
    quorum_type: string | null
    quorum_fraction_numerateur: number | null
    quorum_fraction_denominateur: number | null
    composition_max: number | null
    majorite_defaut: string | null
  } | null
  odj_points: ODJPointRow[]
  convocataires: ConvocataireItem[]
  president_effectif: { id: string; prenom: string; nom: string } | null
  secretaire_seance: { id: string; prenom: string; nom: string } | null
}

interface SeanceDetailProps {
  seance: SeanceData
  allMembers: MemberOption[]
  instanceMemberIds: string[]
  canManage: boolean
}

const STATUT_CONFIG: Record<string, { label: string; color: string }> = {
  BROUILLON: { label: 'Brouillon', color: 'bg-slate-100 text-slate-700' },
  CONVOQUEE: { label: 'Convoquee', color: 'bg-blue-100 text-blue-700' },
  EN_COURS: { label: 'En cours', color: 'bg-emerald-100 text-emerald-700' },
  SUSPENDUE: { label: 'Suspendue', color: 'bg-amber-100 text-amber-700' },
  CLOTUREE: { label: 'Cloturee', color: 'bg-purple-100 text-purple-700' },
  ARCHIVEE: { label: 'Archivee', color: 'bg-gray-100 text-gray-500' },
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  DELIBERATION: { label: 'Deliberation', color: 'bg-blue-50 text-blue-700' },
  INFORMATION: { label: 'Information', color: 'bg-slate-50 text-slate-600' },
  QUESTION_DIVERSE: { label: 'Question diverse', color: 'bg-amber-50 text-amber-700' },
  ELECTION: { label: 'Election', color: 'bg-purple-50 text-purple-700' },
  APPROBATION_PV: { label: 'Approbation PV', color: 'bg-emerald-50 text-emerald-700' },
}

const CONVOCATION_LABELS: Record<string, { label: string; color: string }> = {
  NON_ENVOYE: { label: 'Non envoye', color: 'bg-slate-100 text-slate-600' },
  ENVOYE: { label: 'Envoye', color: 'bg-blue-100 text-blue-700' },
  LU: { label: 'Lu', color: 'bg-cyan-100 text-cyan-700' },
  CONFIRME_PRESENT: { label: 'Confirme', color: 'bg-emerald-100 text-emerald-700' },
  ABSENT_PROCURATION: { label: 'Procuration', color: 'bg-amber-100 text-amber-700' },
  ERREUR_EMAIL: { label: 'Erreur', color: 'bg-red-100 text-red-700' },
  ENVOYE_COURRIER: { label: 'Courrier', color: 'bg-indigo-100 text-indigo-700' },
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })
  } catch { return dateStr }
}

function formatTime(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleTimeString('fr-FR', {
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return '' }
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function SeanceDetail({ seance, allMembers, instanceMemberIds, canManage }: SeanceDetailProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const statutConfig = STATUT_CONFIG[seance.statut || 'BROUILLON']
  const isBrouillon = seance.statut === 'BROUILLON'

  // ODJ state
  const [odjFormOpen, setOdjFormOpen] = useState(false)
  const [editingPoint, setEditingPoint] = useState<ODJPointRow | null>(null)
  const [deletePointDialog, setDeletePointDialog] = useState<ODJPointRow | null>(null)

  // Convocataire state
  const [addConvocataireOpen, setAddConvocataireOpen] = useState(false)
  // Standard points confirmation
  const [standardPointsDialog, setStandardPointsDialog] = useState(false)

  // Status change
  const [statusChangeDialog, setStatusChangeDialog] = useState<string | null>(null)
  // Confirmation dialogs
  const [sendConvocationsDialog, setSendConvocationsDialog] = useState(false)
  const [removeConvocataireDialog, setRemoveConvocataireDialog] = useState<string | null>(null)

  const ModeIcon = seance.mode === 'VISIO' ? Video : seance.mode === 'HYBRIDE' ? Monitor : Building2

  // Warnings
  const warnings: string[] = []
  if (!seance.secretaire_seance) warnings.push('Aucun secretaire de seance designe')
  if (seance.odj_points.length === 0) warnings.push("Aucun point a l'ordre du jour")
  if (seance.convocataires.length === 0) warnings.push('Aucun convocataire')

  // ─── Convocation stats ───────────────────────────────────────────────────
  const convocationStats = useMemo(() => {
    const total = seance.convocataires.length
    let envoyes = 0
    let confirmes = 0
    let erreurs = 0
    let nonEnvoyes = 0

    for (const conv of seance.convocataires) {
      const statut = conv.statut_convocation || 'NON_ENVOYE'
      if (statut === 'NON_ENVOYE') nonEnvoyes++
      else if (statut === 'ERREUR_EMAIL') erreurs++
      else if (statut === 'CONFIRME_PRESENT' || statut === 'ABSENT_PROCURATION') confirmes++
      else envoyes++ // ENVOYE, LU, ENVOYE_COURRIER
    }

    return { total, envoyes, confirmes, erreurs, nonEnvoyes }
  }, [seance.convocataires])

  // ─── Legal delay warning ─────────────────────────────────────────────────
  const legalDelayWarning = useMemo(() => {
    const delai = seance.instance_config?.delai_convocation_jours
    if (!delai || delai <= 0) return null

    const now = new Date()
    const dateSeance = new Date(seance.date_seance)
    const daysUntil = Math.ceil((dateSeance.getTime() - now.getTime()) / 86400000)

    // Check if convocations have been sent
    const allNonEnvoye = seance.convocataires.every(
      c => (c.statut_convocation || 'NON_ENVOYE') === 'NON_ENVOYE'
    )
    const hasConvocataires = seance.convocataires.length > 0

    if (daysUntil < delai && allNonEnvoye && hasConvocataires) {
      return {
        daysUntil,
        delai,
        critical: daysUntil <= 0,
      }
    }
    return null
  }, [seance.date_seance, seance.instance_config?.delai_convocation_jours, seance.convocataires])

  // ─── ODJ quick stats ─────────────────────────────────────────────────────
  const odjStats = useMemo(() => {
    const total = seance.odj_points.length
    const votables = seance.odj_points.filter(
      p => !p.votes_interdits && (p.type_traitement === 'DELIBERATION' || p.type_traitement === 'ELECTION' || p.type_traitement === 'APPROBATION_PV')
    ).length
    const documentsCount = seance.odj_points.reduce((acc, p) => {
      const docs: DocumentInfo[] = Array.isArray(p.documents)
        ? (p.documents as unknown as DocumentInfo[])
        : []
      return acc + docs.length
    }, 0)
    return { total, votables, documentsCount }
  }, [seance.odj_points])

  // ─── Preparation steps (stepper) ──────────────────────────────────────────
  const preparationSteps = useMemo(() => {
    const hasODJ = seance.odj_points.length > 0
    const hasConvocataires = seance.convocataires.length > 0
    const hasVotablePoints = seance.odj_points.some(
      p => !p.votes_interdits && (p.type_traitement === 'DELIBERATION' || p.type_traitement === 'ELECTION' || p.type_traitement === 'APPROBATION_PV')
    )
    const convocationsSent = seance.convocataires.some(
      c => c.statut_convocation && c.statut_convocation !== 'NON_ENVOYE'
    )
    const hasSecretaire = !!seance.secretaire_seance
    const isEnCours = seance.statut === 'EN_COURS'
    const isCloturee = seance.statut === 'CLOTUREE'

    const steps = [
      {
        id: 'odj',
        label: 'Ordre du jour',
        description: hasODJ
          ? `${seance.odj_points.length} point${seance.odj_points.length > 1 ? 's' : ''} dont ${odjStats.votables} soumis au vote`
          : 'Ajoutez au moins un point',
        done: hasODJ,
        warning: hasODJ && !hasVotablePoints ? 'Aucun point soumis au vote' : null,
        tab: 'odj',
      },
      {
        id: 'convocataires',
        label: 'Convocataires',
        description: hasConvocataires
          ? `${seance.convocataires.length} membre${seance.convocataires.length > 1 ? 's' : ''} convoque${seance.convocataires.length > 1 ? 's' : ''}`
          : 'Ajoutez les membres a convoquer',
        done: hasConvocataires,
        warning: null,
        tab: 'convocations',
      },
      {
        id: 'secretaire',
        label: 'Secretaire de seance',
        description: hasSecretaire
          ? `${seance.secretaire_seance!.prenom} ${seance.secretaire_seance!.nom}`
          : 'Recommande (non bloquant)',
        done: hasSecretaire,
        warning: !hasSecretaire ? 'Non designe — un avertissement sera affiche' : null,
        tab: null,
      },
      {
        id: 'convocations',
        label: 'Envoi des convocations',
        description: convocationsSent
          ? `${convocationStats.envoyes + convocationStats.confirmes} envoyee${(convocationStats.envoyes + convocationStats.confirmes) > 1 ? 's' : ''}`
          : 'Envoyez les convocations par email',
        done: convocationsSent,
        warning: null,
        tab: 'convocations',
      },
      {
        id: 'ouverture',
        label: 'Ouverture de la seance',
        description: isEnCours ? 'Seance en cours' : isCloturee ? 'Seance cloturee' : 'Ouvrez la seance le jour J',
        done: isEnCours || isCloturee || seance.statut === 'ARCHIVEE',
        warning: null,
        tab: null,
      },
    ]

    return steps
  }, [seance, odjStats, convocationStats])

  const completedSteps = preparationSteps.filter(s => s.done).length
  const totalSteps = preparationSteps.length
  const nextIncompleteStep = preparationSteps.find(s => !s.done)

  // Active tab state for navigation from stepper
  const [activeTab, setActiveTab] = useState('resume')

  // ─── Handlers ────────────────────────────────────────────────────────────

  function handleSendConvocationsConfirmed() {
    setSendConvocationsDialog(false)
    startTransition(async () => {
      const result = await sendConvocations(seance.id)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        if (result.sent > 0) {
          toast.success(`${result.sent} convocation${result.sent > 1 ? 's' : ''} envoyee${result.sent > 1 ? 's' : ''} avec succes !`)
        }
        if (result.errors.length > 0) {
          toast.error(`${result.errors.length} erreur${result.errors.length > 1 ? 's' : ''} d'envoi`)
        }
        router.refresh()
      }
    })
  }

  function handleResendConvocation(memberId: string) {
    startTransition(async () => {
      const result = await resendConvocation(seance.id, memberId)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success('Convocation renvoyee')
        router.refresh()
      }
    })
  }

  function handleStatusChange(newStatut: string) {
    startTransition(async () => {
      const result = await updateSeanceStatut(
        seance.id,
        newStatut as 'BROUILLON' | 'CONVOQUEE' | 'EN_COURS' | 'SUSPENDUE' | 'CLOTUREE' | 'ARCHIVEE'
      )
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success(`Statut mis a jour: ${STATUT_CONFIG[newStatut]?.label || newStatut}`)
        router.refresh()
      }
      setStatusChangeDialog(null)
    })
  }

  function handleMovePoint(pointId: string, direction: 'up' | 'down') {
    const points = [...seance.odj_points]
    const idx = points.findIndex(p => p.id === pointId)
    if (idx < 0) return
    if (direction === 'up' && idx === 0) return
    if (direction === 'down' && idx === points.length - 1) return

    const newIdx = direction === 'up' ? idx - 1 : idx + 1
    ;[points[idx], points[newIdx]] = [points[newIdx], points[idx]]

    startTransition(async () => {
      const result = await reorderODJPoints(seance.id, points.map(p => p.id))
      if ('error' in result) toast.error(result.error)
      else router.refresh()
    })
  }

  function handleDeletePoint() {
    if (!deletePointDialog) return
    startTransition(async () => {
      const result = await deleteODJPoint(deletePointDialog.id, seance.id)
      if ('error' in result) toast.error(result.error)
      else {
        toast.success('Point supprime')
        router.refresh()
      }
      setDeletePointDialog(null)
    })
  }

  function handleRemoveConvocataireConfirmed() {
    if (!removeConvocataireDialog) return
    const memberId = removeConvocataireDialog
    setRemoveConvocataireDialog(null)
    startTransition(async () => {
      const result = await removeConvocataire(seance.id, memberId)
      if ('error' in result) toast.error(result.error)
      else {
        toast.success('Convocataire retire avec succes')
        router.refresh()
      }
    })
  }

  function handleAddStandardPointsConfirmed() {
    setStandardPointsDialog(false)
    startTransition(async () => {
      const result = await addStandardODJPoints(seance.id)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success('Points standards ajoutes (Approbation PV + Questions diverses)')
        router.refresh()
      }
    })
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header: Tabs + Actions panel side by side */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left: Tabs content area */}
        <div className="flex-1 min-w-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="resume">Resume</TabsTrigger>
              <TabsTrigger value="odj">
                Ordre du jour
                {seance.odj_points.length > 0 && (
                  <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0 h-4">
                    {seance.odj_points.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="convocations">
                Convocations
                {seance.convocataires.length > 0 && (
                  <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0 h-4">
                    {seance.convocataires.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* TAB: Resume                                                    */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <TabsContent value="resume" className="space-y-4 mt-0">
              {/* Session info card */}
              <div className="rounded-xl border bg-card p-5">
                <div className="flex items-center gap-3 mb-4">
                  <Badge className={`${statutConfig.color} border-0 text-sm px-3 py-1`}>
                    {statutConfig.label}
                  </Badge>
                  <Badge variant="outline">{seance.instance_config?.nom}</Badge>
                  {seance.reconvocation && (
                    <Badge variant="outline" className="border-amber-300 text-amber-700">Reconvocation</Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs mb-0.5">Date</p>
                    <p className="font-medium flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                      {formatDate(seance.date_seance)}
                    </p>
                  </div>
                  {seance.date_seance.includes('T') && (
                    <div>
                      <p className="text-muted-foreground text-xs mb-0.5">Heure</p>
                      <p className="font-medium flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        {formatTime(seance.date_seance)}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-muted-foreground text-xs mb-0.5">Mode</p>
                    <p className="font-medium flex items-center gap-1.5">
                      <ModeIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      {seance.mode === 'PRESENTIEL' ? 'Presentiel' : seance.mode === 'HYBRIDE' ? 'Hybride' : 'Visio'}
                    </p>
                  </div>
                  {seance.lieu && (
                    <div>
                      <p className="text-muted-foreground text-xs mb-0.5">Lieu</p>
                      <p className="font-medium flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                        {seance.lieu}
                      </p>
                    </div>
                  )}
                </div>

                <Separator className="my-4" />

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs mb-0.5">President(e)</p>
                    <p className="font-medium">
                      {seance.president_effectif
                        ? `${seance.president_effectif.prenom} ${seance.president_effectif.nom}`
                        : 'Non designe'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-0.5">Secretaire</p>
                    <p className="font-medium">
                      {seance.secretaire_seance
                        ? `${seance.secretaire_seance.prenom} ${seance.secretaire_seance.nom}`
                        : 'Non designe'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-0.5">Publique</p>
                    <p className="font-medium">{seance.publique ? 'Oui' : 'Non (huis clos)'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-0.5">Instance</p>
                    <p className="font-medium">{seance.instance_config?.type_legal || '-'}</p>
                  </div>
                </div>

                {seance.notes && (
                  <>
                    <Separator className="my-4" />
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">Notes</p>
                      <p className="text-sm">{seance.notes}</p>
                    </div>
                  </>
                )}
              </div>

              {/* ─── Preparation Stepper ─── */}
              {(isBrouillon || seance.statut === 'CONVOQUEE') && canManage && (
                <div className="rounded-xl border bg-card p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-institutional-blue" />
                      Preparation de la seance
                    </h3>
                    <span className="text-xs text-muted-foreground font-medium">
                      {completedSteps}/{totalSteps} etapes
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-muted rounded-full h-2 mb-4">
                    <div
                      className="bg-institutional-blue h-2 rounded-full transition-all duration-500"
                      style={{ width: `${(completedSteps / totalSteps) * 100}%` }}
                    />
                  </div>

                  {/* Steps */}
                  <div className="space-y-2">
                    {preparationSteps.map((step) => (
                      <button
                        key={step.id}
                        onClick={() => {
                          if (step.tab) setActiveTab(step.tab)
                        }}
                        className={`w-full text-left flex items-start gap-3 rounded-lg p-2.5 transition-colors ${
                          step.tab ? 'hover:bg-muted/50 cursor-pointer' : 'cursor-default'
                        } ${!step.done && step === nextIncompleteStep ? 'bg-blue-50 border border-blue-200' : ''}`}
                      >
                        <div className="mt-0.5 shrink-0">
                          {step.done ? (
                            <CircleCheck className="h-5 w-5 text-emerald-500" />
                          ) : step === nextIncompleteStep ? (
                            <CircleDot className="h-5 w-5 text-blue-500 animate-pulse" />
                          ) : (
                            <Circle className="h-5 w-5 text-muted-foreground/40" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${step.done ? 'text-muted-foreground line-through' : ''}`}>
                            {step.label}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                          {step.warning && !step.done && (
                            <p className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              {step.warning}
                            </p>
                          )}
                        </div>
                        {step.tab && !step.done && (
                          <ChevronRight className="h-4 w-4 text-muted-foreground mt-1 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Next action suggestion */}
                  {nextIncompleteStep && (
                    <div className="mt-4 pt-3 border-t">
                      <p className="text-xs text-muted-foreground mb-2">Prochaine etape recommandee :</p>
                      {nextIncompleteStep.id === 'odj' && (
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() => setActiveTab('odj')}
                        >
                          <ListPlus className="h-4 w-4 mr-2" />
                          Completer l&apos;ordre du jour
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      )}
                      {nextIncompleteStep.id === 'convocataires' && (
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() => setActiveTab('convocations')}
                        >
                          <UserPlus className="h-4 w-4 mr-2" />
                          Ajouter des convocataires
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      )}
                      {nextIncompleteStep.id === 'secretaire' && (
                        <p className="text-xs text-amber-600 flex items-center gap-1.5 bg-amber-50 rounded-lg p-2.5">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          Modifiez la seance pour designer un secretaire (non bloquant)
                        </p>
                      )}
                      {nextIncompleteStep.id === 'convocations' && (
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() => setSendConvocationsDialog(true)}
                          disabled={isPending || seance.convocataires.length === 0}
                        >
                          <Send className="h-4 w-4 mr-2" />
                          Envoyer les convocations
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      )}
                      {nextIncompleteStep.id === 'ouverture' && (
                        <Button
                          size="sm"
                          className="w-full bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => setStatusChangeDialog('EN_COURS')}
                          disabled={isPending}
                        >
                          <Clock className="h-4 w-4 mr-2" />
                          Ouvrir la seance
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      )}
                    </div>
                  )}

                  {/* All done! */}
                  {completedSteps === totalSteps && (
                    <div className="mt-4 pt-3 border-t">
                      <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 rounded-lg p-3">
                        <CheckCircle2 className="h-5 w-5 shrink-0" />
                        <div>
                          <p className="text-sm font-medium">Preparation terminee !</p>
                          <p className="text-xs text-emerald-600/80">La seance est prete. Bonne deliberation !</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Warnings */}
              {warnings.length > 0 && isBrouillon && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <p className="text-sm font-medium text-amber-800">Points d&apos;attention</p>
                  </div>
                  <ul className="space-y-1">
                    {warnings.map((w, i) => (
                      <li key={i} className="text-sm text-amber-700 flex items-center gap-2">
                        <span className="h-1 w-1 rounded-full bg-amber-500 shrink-0" />
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Legal delay warning */}
              {legalDelayWarning && (
                <Alert variant="destructive">
                  <AlertOctagon className="h-4 w-4" />
                  <AlertTitle>Delai legal de convocation non respecte</AlertTitle>
                  <AlertDescription>
                    {legalDelayWarning.critical ? (
                      <>
                        La seance est prevue aujourd&apos;hui ou est deja passee et les convocations
                        n&apos;ont pas ete envoyees. Le delai legal est de{' '}
                        <strong>{legalDelayWarning.delai} jours</strong>.
                      </>
                    ) : (
                      <>
                        Il reste <strong>{legalDelayWarning.daysUntil} jour{legalDelayWarning.daysUntil > 1 ? 's' : ''}</strong>{' '}
                        avant la seance mais les convocations n&apos;ont pas ete envoyees.
                        Le delai legal de convocation est de{' '}
                        <strong>{legalDelayWarning.delai} jours</strong>.
                        Envoyez les convocations immediatement ou reportez la seance.
                      </>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {/* Convocation summary dashboard */}
              {seance.convocataires.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    Convocations
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Card>
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                          <Send className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{convocationStats.envoyes}</p>
                          <p className="text-xs text-muted-foreground">Envoyes</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                          <MailCheck className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{convocationStats.confirmes}</p>
                          <p className="text-xs text-muted-foreground">Confirmes</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                          <MailX className="h-5 w-5 text-red-600" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{convocationStats.erreurs}</p>
                          <p className="text-xs text-muted-foreground">Erreurs</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                          <MailWarning className="h-5 w-5 text-slate-500" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{convocationStats.nonEnvoyes}</p>
                          <p className="text-xs text-muted-foreground">Non envoyes</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}

              {/* Quick stats: ODJ */}
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  Ordre du jour
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold">{odjStats.total}</p>
                      <p className="text-xs text-muted-foreground">Point{odjStats.total !== 1 ? 's' : ''} ODJ</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-blue-600">{odjStats.votables}</p>
                      <p className="text-xs text-muted-foreground">Soumis au vote</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-amber-600">{odjStats.documentsCount}</p>
                      <p className="text-xs text-muted-foreground">Document{odjStats.documentsCount !== 1 ? 's' : ''} joint{odjStats.documentsCount !== 1 ? 's' : ''}</p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* TAB: Ordre du jour                                             */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <TabsContent value="odj" className="mt-0">
              <div className="rounded-xl border bg-card">
                <div className="flex items-center justify-between p-5 pb-3">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    Ordre du jour
                  </h2>
                  {canManage && isBrouillon && (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setStandardPointsDialog(true)}
                        disabled={isPending}
                      >
                        {isPending ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <ListPlus className="h-4 w-4 mr-1" />
                        )}
                        Points standards
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => { setEditingPoint(null); setOdjFormOpen(true) }}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Ajouter un point
                      </Button>
                    </div>
                  )}
                </div>

                {seance.odj_points.length === 0 ? (
                  <div className="px-5 pb-5">
                    <div className="text-center py-8 rounded-lg border border-dashed">
                      <FileText className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                      <p className="text-sm text-muted-foreground">Aucun point a l&apos;ordre du jour</p>
                      {canManage && isBrouillon && (
                        <div className="flex items-center justify-center gap-2 mt-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setStandardPointsDialog(true)}
                            disabled={isPending}
                          >
                            <ListPlus className="h-4 w-4 mr-1" />
                            Ajouter les points standards
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => { setEditingPoint(null); setOdjFormOpen(true) }}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Ajouter un point
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="px-5 pb-5 space-y-2">
                    {seance.odj_points.map((point, idx) => (
                      <ODJPointCard
                        key={point.id}
                        point={point}
                        idx={idx}
                        totalPoints={seance.odj_points.length}
                        allMembers={allMembers}
                        seanceId={seance.id}
                        canManage={canManage}
                        isBrouillon={isBrouillon}
                        isPending={isPending}
                        onMovePoint={handleMovePoint}
                        onEdit={(p) => { setEditingPoint(p); setOdjFormOpen(true) }}
                        onDelete={(p) => setDeletePointDialog(p)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* TAB: Convocations                                              */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <TabsContent value="convocations" className="mt-0">
              <div className="rounded-xl border bg-card">
                <div className="flex items-center justify-between p-5 pb-3">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    Convocataires ({seance.convocataires.length})
                  </h2>
                  {canManage && isBrouillon && (
                    <Button size="sm" variant="outline" onClick={() => setAddConvocataireOpen(true)}>
                      <UserPlus className="h-4 w-4 mr-1" />
                      Ajouter
                    </Button>
                  )}
                </div>

                {seance.convocataires.length === 0 ? (
                  <div className="px-5 pb-5">
                    <div className="text-center py-8 rounded-lg border border-dashed">
                      <Users className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                      <p className="text-sm text-muted-foreground">Aucun convocataire</p>
                    </div>
                  </div>
                ) : (
                  <div className="px-5 pb-5">
                    <div className="divide-y rounded-lg border">
                      {seance.convocataires.map(conv => {
                        const convConfig = CONVOCATION_LABELS[conv.statut_convocation || 'NON_ENVOYE']
                        return (
                          <div key={conv.id} className="flex items-center justify-between px-3 py-2.5">
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-bold">
                                {conv.member?.prenom?.[0]}{conv.member?.nom?.[0]}
                              </div>
                              <div>
                                <p className="text-sm font-medium">
                                  {conv.member?.prenom} {conv.member?.nom}
                                </p>
                                <p className="text-xs text-muted-foreground">{conv.member?.email}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={`${convConfig.color} border-0 text-[11px]`}>
                                {convConfig.label}
                              </Badge>
                              {canManage && (conv.statut_convocation === 'ENVOYE' || conv.statut_convocation === 'ERREUR_EMAIL') && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-blue-600"
                                  onClick={() => handleResendConvocation(conv.member_id)}
                                  disabled={isPending}
                                  title="Renvoyer la convocation"
                                >
                                  <RefreshCw className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {canManage && isBrouillon && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  onClick={() => setRemoveConvocataireDialog(conv.member_id)}
                                  disabled={isPending}
                                  title="Retirer ce convocataire"
                                >
                                  <UserMinus className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right: Actions panel (always visible, outside tabs) */}
        {canManage && (
          <div className="w-full lg:w-64 space-y-3 lg:shrink-0">
            <div className="rounded-xl border bg-card p-4 space-y-3 lg:sticky lg:top-6">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                Actions
                <Badge className={`${statutConfig.color} border-0 text-[10px] px-2 py-0`}>
                  {statutConfig.label}
                </Badge>
              </h3>

              {isBrouillon && (
                <Button
                  className="w-full"
                  onClick={() => setStatusChangeDialog('CONVOQUEE')}
                  disabled={isPending || seance.odj_points.length === 0 || seance.convocataires.length === 0}
                  title={
                    seance.odj_points.length === 0
                      ? 'Ajoutez d\'abord des points a l\'ordre du jour'
                      : seance.convocataires.length === 0
                        ? 'Ajoutez d\'abord des convocataires'
                        : undefined
                  }
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Convoquer
                </Button>
              )}

              {(isBrouillon || seance.statut === 'CONVOQUEE') && (
                <Button
                  className="w-full"
                  variant={isBrouillon ? 'outline' : 'default'}
                  onClick={() => setSendConvocationsDialog(true)}
                  disabled={isPending || seance.convocataires.length === 0}
                  title={seance.convocataires.length === 0 ? 'Ajoutez d\'abord des convocataires' : undefined}
                >
                  {isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Envoyer les convocations
                </Button>
              )}

              {seance.statut === 'CONVOQUEE' && (
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => setStatusChangeDialog('EN_COURS')}
                  disabled={isPending}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Ouvrir la seance
                </Button>
              )}

              {seance.statut === 'EN_COURS' && (
                <>
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => setStatusChangeDialog('SUSPENDUE')}
                    disabled={isPending}
                  >
                    Suspendre
                  </Button>
                  <Button
                    className="w-full bg-purple-600 hover:bg-purple-700"
                    onClick={() => setStatusChangeDialog('CLOTUREE')}
                    disabled={isPending}
                  >
                    Cloturer la seance
                  </Button>
                </>
              )}

              {seance.statut === 'SUSPENDUE' && (
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => setStatusChangeDialog('EN_COURS')}
                  disabled={isPending}
                >
                  Reprendre la seance
                </Button>
              )}

              <Separator />

              <div className="space-y-1.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <FileText className="h-3 w-3" />
                  {seance.odj_points.length} point{seance.odj_points.length !== 1 ? 's' : ''} ODJ
                  {odjStats.votables > 0 && (
                    <span className="text-blue-600">({odjStats.votables} vote{odjStats.votables > 1 ? 's' : ''})</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <Users className="h-3 w-3" />
                  {seance.convocataires.length} convocataire{seance.convocataires.length !== 1 ? 's' : ''}
                </div>
                {seance.instance_config?.composition_max && (
                  <div className="flex items-center gap-1.5">
                    <Shield className="h-3 w-3" />
                    Quorum: {Math.ceil((seance.instance_config.composition_max * (seance.instance_config.quorum_fraction_numerateur || 1)) / (seance.instance_config.quorum_fraction_denominateur || 2))} membres
                  </div>
                )}
              </div>

              {/* Contextual tips */}
              {isBrouillon && seance.odj_points.length === 0 && seance.convocataires.length === 0 && (
                <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
                  <p className="text-xs text-blue-700 flex items-start gap-1.5">
                    <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    Commencez par ajouter l&apos;ordre du jour et les convocataires dans les onglets ci-dessous.
                  </p>
                </div>
              )}
              {isBrouillon && seance.odj_points.length > 0 && seance.convocataires.length > 0 && !seance.secretaire_seance && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                  <p className="text-xs text-amber-700 flex items-start gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    Pensez a designer un secretaire de seance avant l&apos;ouverture.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Dialogs                                                            */}
      {/* ═══════════════════════════════════════════════════════════════════ */}

      {/* ODJ Form Dialog */}
      <ODJPointFormDialog
        open={odjFormOpen}
        onClose={() => { setOdjFormOpen(false); setEditingPoint(null) }}
        point={editingPoint}
        seanceId={seance.id}
        members={allMembers}
        defaultMajorite={seance.instance_config?.majorite_defaut || 'SIMPLE'}
      />

      {/* Delete point confirmation */}
      <AlertDialog open={!!deletePointDialog} onOpenChange={() => setDeletePointDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce point ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le point &quot;{deletePointDialog?.titre}&quot; sera supprime de l&apos;ordre du jour.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePoint}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Status change confirmation (enriched) ─── */}
      <AlertDialog open={!!statusChangeDialog} onOpenChange={() => setStatusChangeDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {statusChangeDialog === 'CONVOQUEE' && (
                <><CheckCircle2 className="h-5 w-5 text-blue-500" /> Passer la seance en &quot;Convoquee&quot; ?</>
              )}
              {statusChangeDialog === 'EN_COURS' && (
                <><Clock className="h-5 w-5 text-emerald-500" /> Ouvrir la seance ?</>
              )}
              {statusChangeDialog === 'SUSPENDUE' && (
                <><AlertTriangle className="h-5 w-5 text-amber-500" /> Suspendre la seance ?</>
              )}
              {statusChangeDialog === 'CLOTUREE' && (
                <><Shield className="h-5 w-5 text-purple-500" /> Cloturer la seance ?</>
              )}
            </AlertDialogTitle>
            <div className="space-y-3 mt-2">
              {statusChangeDialog === 'CONVOQUEE' && (
                <>
                  <p className="text-sm text-muted-foreground">
                    Les convocations pourront etre envoyees aux {seance.convocataires.length} membre{seance.convocataires.length > 1 ? 's' : ''} convoques.
                  </p>
                  {warnings.length > 0 && (
                    <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                      <p className="text-xs font-medium text-amber-800 mb-1">Points d&apos;attention :</p>
                      <ul className="space-y-1">
                        {warnings.map((w, i) => (
                          <li key={i} className="text-xs text-amber-700 flex items-center gap-1.5">
                            <AlertTriangle className="h-3 w-3 shrink-0" /> {w}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
              {statusChangeDialog === 'EN_COURS' && (
                <>
                  <p className="text-sm text-muted-foreground">
                    La seance sera officiellement ouverte. L&apos;heure d&apos;ouverture sera enregistree automatiquement.
                  </p>
                  <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 space-y-1.5">
                    <p className="text-xs font-medium text-blue-800">Ce qui va se passer :</p>
                    <ul className="space-y-1">
                      <li className="text-xs text-blue-700 flex items-center gap-1.5">
                        <CheckCircle2 className="h-3 w-3 shrink-0" /> L&apos;appel des presences sera possible
                      </li>
                      <li className="text-xs text-blue-700 flex items-center gap-1.5">
                        <CheckCircle2 className="h-3 w-3 shrink-0" /> Le quorum sera verifie
                      </li>
                      <li className="text-xs text-blue-700 flex items-center gap-1.5">
                        <CheckCircle2 className="h-3 w-3 shrink-0" /> Les votes pourront commencer
                      </li>
                    </ul>
                  </div>
                  {!seance.secretaire_seance && (
                    <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                      <p className="text-xs text-amber-700 flex items-center gap-1.5">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        Aucun secretaire de seance designe — pensez a en nommer un.
                      </p>
                    </div>
                  )}
                </>
              )}
              {statusChangeDialog === 'SUSPENDUE' && (
                <p className="text-sm text-muted-foreground">
                  La seance sera suspendue temporairement. Les votes en cours seront interrompus.
                  Vous pourrez reprendre la seance a tout moment.
                </p>
              )}
              {statusChangeDialog === 'CLOTUREE' && (
                <>
                  <p className="text-sm text-muted-foreground">
                    La seance sera definitivement cloturee. L&apos;heure de cloture sera enregistree.
                  </p>
                  <div className="rounded-lg bg-purple-50 border border-purple-200 p-3 space-y-1.5">
                    <p className="text-xs font-medium text-purple-800">Apres la cloture :</p>
                    <ul className="space-y-1">
                      <li className="text-xs text-purple-700 flex items-center gap-1.5">
                        <CheckCircle2 className="h-3 w-3 shrink-0" /> Le proces-verbal pourra etre redige
                      </li>
                      <li className="text-xs text-purple-700 flex items-center gap-1.5">
                        <CheckCircle2 className="h-3 w-3 shrink-0" /> Les deliberations seront numerotees
                      </li>
                      <li className="text-xs text-purple-700 flex items-center gap-1.5">
                        <AlertTriangle className="h-3 w-3 shrink-0" /> Plus aucun vote ne sera possible
                      </li>
                    </ul>
                  </div>
                </>
              )}
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => statusChangeDialog && handleStatusChange(statusChangeDialog)}
              disabled={isPending}
              className={
                statusChangeDialog === 'EN_COURS' ? 'bg-emerald-600 hover:bg-emerald-700' :
                statusChangeDialog === 'CLOTUREE' ? 'bg-purple-600 hover:bg-purple-700' :
                ''
              }
            >
              {isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> En cours...</>
              ) : (
                <>
                  {statusChangeDialog === 'CONVOQUEE' && 'Confirmer'}
                  {statusChangeDialog === 'EN_COURS' && 'Ouvrir la seance'}
                  {statusChangeDialog === 'SUSPENDUE' && 'Suspendre'}
                  {statusChangeDialog === 'CLOTUREE' && 'Cloturer definitivement'}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Standard points confirmation ─── */}
      <AlertDialog open={standardPointsDialog} onOpenChange={setStandardPointsDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ListPlus className="h-5 w-5 text-blue-500" />
              Ajouter les points standards ?
            </AlertDialogTitle>
            <div className="space-y-3 mt-2">
              <p className="text-sm text-muted-foreground">
                Deux points standards seront ajoutes a l&apos;ordre du jour :
              </p>
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">1</span>
                  <div>
                    <p className="text-sm font-medium text-blue-800">Approbation du PV precedent</p>
                    <p className="text-xs text-blue-600">Soumis au vote — en position 1</p>
                  </div>
                </div>
                <Separator className="bg-blue-200" />
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700">N</span>
                  <div>
                    <p className="text-sm font-medium text-amber-800">Questions diverses</p>
                    <p className="text-xs text-amber-600">Information — en derniere position</p>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Les points existants seront repositionnes automatiquement. Si ces points existent deja, ils ne seront pas dupliques.
              </p>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAddStandardPointsConfirmed}
              disabled={isPending}
            >
              {isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Ajout en cours...</>
              ) : (
                <><ListPlus className="h-4 w-4 mr-2" /> Ajouter les points</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Send convocations confirmation ─── */}
      <AlertDialog open={sendConvocationsDialog} onOpenChange={setSendConvocationsDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-blue-500" />
              Envoyer les convocations ?
            </AlertDialogTitle>
            <div className="space-y-3 mt-2">
              <p className="text-sm text-muted-foreground">
                Un email de convocation sera envoye a chaque membre qui n&apos;a pas encore ete convoque.
              </p>
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div>
                    <p className="text-lg font-bold text-blue-700">{convocationStats.nonEnvoyes}</p>
                    <p className="text-xs text-blue-600">A envoyer</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-emerald-600">{convocationStats.envoyes + convocationStats.confirmes}</p>
                    <p className="text-xs text-emerald-600">Deja envoyees</p>
                  </div>
                </div>
              </div>
              {convocationStats.erreurs > 0 && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                  <p className="text-xs text-red-700 flex items-center gap-1.5">
                    <MailX className="h-3 w-3 shrink-0" />
                    {convocationStats.erreurs} convocation{convocationStats.erreurs > 1 ? 's' : ''} en erreur — elles seront renvoyees.
                  </p>
                </div>
              )}
              {legalDelayWarning && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                  <p className="text-xs text-red-700 flex items-center gap-1.5">
                    <AlertOctagon className="h-3 w-3 shrink-0" />
                    Attention : le delai legal de convocation ({legalDelayWarning.delai} jours) n&apos;est pas respecte.
                  </p>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                L&apos;email contient le lien de confirmation de presence et l&apos;ordre du jour.
              </p>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSendConvocationsConfirmed}
              disabled={isPending}
            >
              {isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Envoi en cours...</>
              ) : (
                <><Send className="h-4 w-4 mr-2" /> Envoyer {convocationStats.nonEnvoyes > 0 ? `${convocationStats.nonEnvoyes} convocation${convocationStats.nonEnvoyes > 1 ? 's' : ''}` : 'les convocations'}</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Remove convocataire confirmation ─── */}
      <AlertDialog open={!!removeConvocataireDialog} onOpenChange={() => setRemoveConvocataireDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <UserMinus className="h-5 w-5 text-red-500" />
              Retirer ce convocataire ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                const member = seance.convocataires.find(c => c.member_id === removeConvocataireDialog)?.member
                return member ? (
                  <>
                    <strong>{member.prenom} {member.nom}</strong> ({member.email}) ne sera plus convoque pour cette seance.
                  </>
                ) : 'Ce membre ne sera plus convoque pour cette seance.'
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveConvocataireConfirmed}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? 'Suppression...' : 'Retirer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add convocataire dialog */}
      <AddConvocataireDialog
        open={addConvocataireOpen}
        onClose={() => setAddConvocataireOpen(false)}
        seanceId={seance.id}
        existingMemberIds={seance.convocataires.map(c => c.member_id)}
        allMembers={allMembers}
        instanceMemberIds={instanceMemberIds}
      />
    </div>
  )
}

// ─── ODJ Point Card (extracted for clarity) ─────────────────────────────────

function ODJPointCard({
  point,
  idx,
  totalPoints,
  allMembers,
  seanceId,
  canManage,
  isBrouillon,
  isPending,
  onMovePoint,
  onEdit,
  onDelete,
}: {
  point: ODJPointRow
  idx: number
  totalPoints: number
  allMembers: MemberOption[]
  seanceId: string
  canManage: boolean
  isBrouillon: boolean
  isPending: boolean
  onMovePoint: (pointId: string, direction: 'up' | 'down') => void
  onEdit: (point: ODJPointRow) => void
  onDelete: (point: ODJPointRow) => void
}) {
  const typeConfig = TYPE_LABELS[point.type_traitement || 'DELIBERATION']
  const isVotable = !point.votes_interdits && (point.type_traitement === 'DELIBERATION' || point.type_traitement === 'ELECTION' || point.type_traitement === 'APPROBATION_PV')
  const rapporteur = point.rapporteur_id
    ? allMembers.find(m => m.id === point.rapporteur_id)
    : null
  const documents: DocumentInfo[] = Array.isArray(point.documents)
    ? (point.documents as unknown as DocumentInfo[])
    : []

  return (
    <div
      className={`rounded-lg border p-3 hover:bg-muted/30 transition-colors ${
        isVotable ? 'border-l-4 border-l-blue-500' : 'border-l-4 border-l-slate-200'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Position & reorder */}
        <div className="flex flex-col items-center gap-1 pt-0.5">
          {canManage && isBrouillon && (
            <button
              onClick={() => onMovePoint(point.id, 'up')}
              disabled={idx === 0 || isPending}
              className="text-muted-foreground hover:text-foreground disabled:opacity-30"
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
          )}
          <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
            isVotable ? 'bg-blue-100 text-blue-700' : 'bg-muted'
          }`}>
            {point.position}
          </span>
          {canManage && isBrouillon && (
            <button
              onClick={() => onMovePoint(point.id, 'down')}
              disabled={idx === totalPoints - 1 || isPending}
              className="text-muted-foreground hover:text-foreground disabled:opacity-30"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Badges row */}
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
            <Badge className={`${typeConfig.color} border-0 text-[11px] px-2 py-0`}>
              {typeConfig.label}
            </Badge>
            {isVotable ? (
              <Badge className="bg-blue-50 text-blue-700 border-0 text-[11px] px-2 py-0">
                <Vote className="h-3 w-3 mr-0.5" />
                Soumis au vote
              </Badge>
            ) : (
              <Badge className="bg-slate-50 text-slate-500 border-0 text-[11px] px-2 py-0">
                <Eye className="h-3 w-3 mr-0.5" />
                Information
              </Badge>
            )}
            {point.huis_clos && (
              <Badge variant="outline" className="text-[11px] px-2 py-0 border-red-200 text-red-600">
                <Shield className="h-3 w-3 mr-0.5" />
                Huis clos
              </Badge>
            )}
            {point.majorite_requise && point.majorite_requise !== 'SIMPLE' && isVotable && (
              <Badge variant="outline" className="text-[11px] px-2 py-0">
                Maj. {point.majorite_requise.toLowerCase()}
              </Badge>
            )}
            {point.statut && point.statut !== 'A_TRAITER' && (
              <Badge className={`border-0 text-[11px] px-2 py-0 ${
                point.statut === 'ADOPTE' ? 'bg-emerald-100 text-emerald-700' :
                point.statut === 'REJETE' ? 'bg-red-100 text-red-700' :
                point.statut === 'EN_DISCUSSION' ? 'bg-amber-100 text-amber-700' :
                'bg-slate-100 text-slate-600'
              }`}>
                {point.statut === 'ADOPTE' ? 'Adopte' :
                 point.statut === 'REJETE' ? 'Rejete' :
                 point.statut === 'EN_DISCUSSION' ? 'En discussion' :
                 point.statut}
              </Badge>
            )}
          </div>

          {/* Title */}
          <h4 className="text-sm font-medium text-foreground">{point.titre}</h4>

          {/* Description */}
          {point.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{point.description}</p>
          )}

          {/* Projet de deliberation */}
          {point.projet_deliberation && (
            <div className="mt-1.5 rounded bg-blue-50 border border-blue-100 px-2.5 py-1.5">
              <p className="text-xs text-blue-700 font-medium mb-0.5">Resolution proposee :</p>
              <p className="text-xs text-blue-800 line-clamp-3 whitespace-pre-line">{point.projet_deliberation}</p>
            </div>
          )}

          {/* Rapporteur */}
          {rapporteur && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              Rapporteur : <span className="font-medium text-foreground">{rapporteur.prenom} {rapporteur.nom}</span>
            </p>
          )}

          {/* Documents */}
          {documents.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {documents.map((doc, i) => (
                <DocumentBadge
                  key={i}
                  doc={doc}
                  pointId={point.id}
                  seanceId={seanceId}
                  canRemove={canManage && isBrouillon}
                />
              ))}
            </div>
          )}

          {/* Upload button for brouillon */}
          {canManage && isBrouillon && (
            <div className="mt-2">
              <DocumentUploadButton pointId={point.id} seanceId={seanceId} />
            </div>
          )}

          {/* Notes de seance */}
          {point.notes_seance && (
            <div className="mt-2 rounded bg-amber-50 border border-amber-100 px-2.5 py-1.5">
              <p className="text-xs text-amber-800">
                <strong>Note :</strong> {point.notes_seance}
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        {canManage && isBrouillon && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(point)}>
                <Pencil className="h-4 w-4 mr-2" />
                Modifier
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(point)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  )
}

// ─── ODJ Point Form Dialog ───────────────────────────────────────────────────

function ODJPointFormDialog({
  open,
  onClose,
  point,
  seanceId,
  members,
  defaultMajorite,
}: {
  open: boolean
  onClose: () => void
  point: ODJPointRow | null
  seanceId: string
  members: MemberOption[]
  defaultMajorite: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const isEditing = !!point

  const [titre, setTitre] = useState(point?.titre || '')
  const [description, setDescription] = useState(point?.description || '')
  const [typeTraitement, setTypeTraitement] = useState<string>(point?.type_traitement || 'DELIBERATION')
  const [majoriteRequise, setMajoriteRequise] = useState<string>(point?.majorite_requise || defaultMajorite)
  const [rapporteurId, setRapporteurId] = useState(point?.rapporteur_id || '_none')
  const [huisClos, setHuisClos] = useState(point?.huis_clos || false)
  const [votesInterdits, setVotesInterdits] = useState(point?.votes_interdits || false)
  const [projetDeliberation, setProjetDeliberation] = useState(point?.projet_deliberation || '')

  // Reset
  const resetKey = `${point?.id || 'new'}-${open}`
  const [lastResetKey, setLastResetKey] = useState(resetKey)
  if (resetKey !== lastResetKey) {
    setLastResetKey(resetKey)
    setTitre(point?.titre || '')
    setDescription(point?.description || '')
    setTypeTraitement(point?.type_traitement || 'DELIBERATION')
    setMajoriteRequise(point?.majorite_requise || defaultMajorite)
    setRapporteurId(point?.rapporteur_id || '_none')
    setHuisClos(point?.huis_clos || false)
    setVotesInterdits(point?.votes_interdits || false)
    setProjetDeliberation(point?.projet_deliberation || '')
  }

  function handleSubmit() {
    if (!titre.trim()) { toast.error('Le titre est requis'); return }

    startTransition(async () => {
      const formData = new FormData()
      if (point?.id) formData.set('id', point.id)
      formData.set('seance_id', seanceId)
      formData.set('titre', titre.trim())
      formData.set('description', description.trim())
      formData.set('type_traitement', typeTraitement)
      formData.set('majorite_requise', majoriteRequise)
      if (rapporteurId && rapporteurId !== '_none') formData.set('rapporteur_id', rapporteurId)
      formData.set('huis_clos', huisClos ? 'true' : 'false')
      formData.set('votes_interdits', votesInterdits ? 'true' : 'false')
      if (projetDeliberation.trim()) formData.set('projet_deliberation', projetDeliberation.trim())

      const result = isEditing
        ? await updateODJPoint(formData)
        : await addODJPoint(formData)

      if ('error' in result) {
        toast.error(result.error)
        return
      }

      toast.success(isEditing ? 'Point mis a jour' : 'Point ajoute')
      router.refresh()
      onClose()
    })
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Modifier le point' : 'Nouveau point ODJ'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Modifiez ce point de l\'ordre du jour.' : 'Ajoutez un point a l\'ordre du jour.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="odj_titre">Titre *</Label>
            <Input
              id="odj_titre"
              value={titre}
              onChange={e => setTitre(e.target.value)}
              placeholder="Approbation du PV de la seance precedente"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="odj_description">Description</Label>
            <Textarea
              id="odj_description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Details du point..."
              rows={3}
            />
          </div>

          {/* Projet de deliberation — visible pour les types soumis au vote */}
          {!votesInterdits && (typeTraitement === 'DELIBERATION' || typeTraitement === 'ELECTION' || typeTraitement === 'APPROBATION_PV') && (
            <div className="space-y-2">
              <Label htmlFor="odj_projet">
                Projet de deliberation / Resolution
              </Label>
              <p className="text-xs text-muted-foreground -mt-1">
                Texte de la resolution qui sera soumise au vote des elus
              </p>
              <Textarea
                id="odj_projet"
                value={projetDeliberation}
                onChange={e => setProjetDeliberation(e.target.value)}
                placeholder="Le conseil / l'assemblee decide de... Apres en avoir delibere, il est propose de..."
                rows={5}
                className="font-mono text-sm"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={typeTraitement} onValueChange={setTypeTraitement}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DELIBERATION">Deliberation</SelectItem>
                  <SelectItem value="INFORMATION">Information</SelectItem>
                  <SelectItem value="QUESTION_DIVERSE">Question diverse</SelectItem>
                  <SelectItem value="ELECTION">Election</SelectItem>
                  <SelectItem value="APPROBATION_PV">Approbation PV</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Majorite requise</Label>
              <Select value={majoriteRequise} onValueChange={setMajoriteRequise}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SIMPLE">Simple</SelectItem>
                  <SelectItem value="ABSOLUE">Absolue</SelectItem>
                  <SelectItem value="QUALIFIEE">Qualifiee</SelectItem>
                  <SelectItem value="UNANIMITE">Unanimite</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Rapporteur</Label>
            <Select value={rapporteurId} onValueChange={setRapporteurId}>
              <SelectTrigger>
                <SelectValue placeholder="Aucun rapporteur" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Aucun</SelectItem>
                {members.map(m => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.prenom} {m.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label className="font-medium">Huis clos</Label>
                <p className="text-xs text-muted-foreground">Ce point se traite a huis clos</p>
              </div>
              <Switch checked={huisClos} onCheckedChange={setHuisClos} />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label className="font-medium">Sans vote</Label>
                <p className="text-xs text-muted-foreground">Point d&apos;information uniquement</p>
              </div>
              <Switch checked={votesInterdits} onCheckedChange={setVotesInterdits} />
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEditing ? 'Enregistrer' : 'Ajouter'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Add Convocataire Dialog ─────────────────────────────────────────────────

function AddConvocataireDialog({
  open,
  onClose,
  seanceId,
  existingMemberIds,
  allMembers,
  instanceMemberIds,
}: {
  open: boolean
  onClose: () => void
  seanceId: string
  existingMemberIds: string[]
  allMembers: MemberOption[]
  instanceMemberIds: string[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState('')

  const availableMembers = allMembers.filter(m => !existingMemberIds.includes(m.id))
  const filtered = availableMembers.filter(m => {
    if (!search) return true
    const q = search.toLowerCase()
    return `${m.prenom} ${m.nom}`.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
  })

  // Sort: instance members first
  const sorted = [...filtered].sort((a, b) => {
    const aInst = instanceMemberIds.includes(a.id) ? 0 : 1
    const bInst = instanceMemberIds.includes(b.id) ? 0 : 1
    if (aInst !== bInst) return aInst - bInst
    return a.nom.localeCompare(b.nom)
  })

  function handleAdd(memberId: string) {
    startTransition(async () => {
      const result = await addConvocataire(seanceId, memberId)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success('Convocataire ajoute')
        router.refresh()
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Ajouter un convocataire</DialogTitle>
          <DialogDescription>
            Selectionnez un membre a convoquer pour cette seance.
          </DialogDescription>
        </DialogHeader>

        <Input
          placeholder="Rechercher un membre..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="mt-2"
        />

        <div className="max-h-[300px] overflow-y-auto space-y-1 mt-2">
          {sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {availableMembers.length === 0
                ? 'Tous les membres sont deja convoques'
                : 'Aucun resultat'}
            </p>
          ) : (
            sorted.map(m => (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-lg border p-2.5 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-bold">
                    {m.prenom[0]}{m.nom[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {m.prenom} {m.nom}
                      {instanceMemberIds.includes(m.id) && (
                        <span className="text-xs text-muted-foreground ml-1">(membre instance)</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{m.email}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAdd(m.id)}
                  disabled={isPending}
                >
                  <UserPlus className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Document Badge ──────────────────────────────────────────────────────────

function DocumentBadge({
  doc,
  pointId,
  seanceId,
  canRemove,
}: {
  doc: DocumentInfo
  pointId: string
  seanceId: string
  canRemove: boolean
}) {
  const [isPending, startTransition] = useTransition()

  function handleDownload() {
    startTransition(async () => {
      const result = await getDocumentUrl(doc.path)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        window.open(result.url, '_blank')
      }
    })
  }

  function handleRemove() {
    startTransition(async () => {
      const result = await removeODJDocument(pointId, seanceId, doc.path)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success('Document supprime')
      }
    })
  }

  const sizeStr = doc.size < 1024
    ? `${doc.size} o`
    : doc.size < 1024 * 1024
      ? `${Math.round(doc.size / 1024)} Ko`
      : `${(doc.size / (1024 * 1024)).toFixed(1)} Mo`

  const iconColor = doc.type === 'pdf' ? 'text-red-500' : 'text-blue-500'

  return (
    <span className="inline-flex items-center gap-1 rounded-md border bg-muted/50 px-2 py-1 text-xs group">
      <Paperclip className={`h-3 w-3 ${iconColor}`} />
      <button
        onClick={handleDownload}
        disabled={isPending}
        className="hover:underline font-medium max-w-[150px] truncate"
        title={doc.name}
      >
        {doc.name}
      </button>
      <span className="text-muted-foreground">({sizeStr})</span>
      {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
      {canRemove && !isPending && (
        <button
          onClick={handleRemove}
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity ml-0.5"
          title="Supprimer"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  )
}

// ─── Document Upload Button ──────────────────────────────────────────────────

function DocumentUploadButton({
  pointId,
  seanceId,
}: {
  pointId: string
  seanceId: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    startTransition(async () => {
      const formData = new FormData()
      formData.set('file', file)
      formData.set('point_id', pointId)
      formData.set('seance_id', seanceId)

      const result = await uploadODJDocument(formData)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success(`"${result.document.name}" ajoute`)
        router.refresh()
      }
    })

    // Reset input
    e.target.value = ''
  }

  return (
    <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
      {isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Upload className="h-3.5 w-3.5" />
      )}
      {isPending ? 'Upload en cours...' : 'Joindre un document'}
      <input
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp,.txt"
        onChange={handleFileChange}
        disabled={isPending}
      />
    </label>
  )
}
