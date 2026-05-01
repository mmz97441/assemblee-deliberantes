'use client'

import { useState, useTransition, useMemo, useCallback, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import {
  Building2,
  CalendarDays,
  Users,
  FileText,
  Send,
  ChevronLeft,
  ChevronRight,
  Check,
  ChevronsUpDown,
  Plus,
  Trash2,
  GripVertical,
  Copy,
  Sparkles,
  Loader2,
  Upload,
  Paperclip,
  ExternalLink,
  X,
  Video,
  Monitor,
  Info,
  Search,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import type { InstanceConfigRow } from '@/lib/supabase/types'
import {
  createSeanceWizard,
  getLastSeanceODJ,
  createSeanceDraft,
  updateSeanceDraft,
  setSeanceODJ,
  setSeanceConvocataires,
  type WizardODJPoint,
  type CreateSeanceWizardInput,
} from '@/lib/actions/seances'
import { sendConvocations } from '@/lib/actions/convocations'
import { uploadODJDocument, removeODJDocument, getDocumentUrl, type DocumentInfo } from '@/lib/actions/documents'
import { HELP_TEXTS } from '@/lib/constants/help-texts'

// ─── Types ──────────────────────────────────────────────────────────────────

interface MemberOption {
  id: string
  prenom: string
  nom: string
  email: string | null
  role: string
  qualite_officielle: string | null
  statut: string | null
}

interface InstanceMember {
  instance_config_id: string
  member_id: string
  bureau_role: string | null
  actif: boolean | null
}

interface LastSeanceInfo {
  id: string
  date_seance: string
  titre: string
}

interface ExistingDraft {
  id: string
  titre: string
  instance_id: string
  date_seance: string
  lieu: string | null
  mode: string | null
  publique: boolean | null
  president_effectif_seance_id: string | null
  secretaire_seance_id: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  odj_points: { id: string; titre: string; description: string | null; type_traitement: string | null; majorite_requise: string | null; rapporteur_id: string | null; huis_clos: boolean | null; votes_interdits: boolean | null; position: number; documents: any[] | null }[]
  convocataire_member_ids: string[]
}

interface SeanceCreationWizardProps {
  instances: InstanceConfigRow[]
  members: MemberOption[]
  instanceMembers: InstanceMember[]
  lastSeanceByInstance: Record<string, LastSeanceInfo>
  existingDraft?: ExistingDraft | null
}

// ─── Step configuration ─────────────────────────────────────────────────────

const STEPS = [
  { key: 'instance', label: 'Instance', icon: Building2, description: 'Pour quelle instance ?' },
  { key: 'quand', label: 'Quand et où', icon: CalendarDays, description: 'Date, heure et lieu' },
  { key: 'odj', label: 'Ordre du jour', icon: FileText, description: 'Points à traiter' },
  { key: 'convocataires', label: 'Convocataires', icon: Users, description: 'Qui convoquer ?' },
  { key: 'recap', label: 'Récapitulatif', icon: Send, description: 'Vérification et envoi' },
] as const

const TYPE_LABELS: Record<string, string> = {
  DELIBERATION: 'Délibération',
  INFORMATION: 'Information',
  QUESTION_DIVERSE: 'Questions diverses',
  ELECTION: 'Élection',
  APPROBATION_PV: 'Approbation PV',
}

const MAJORITE_LABELS: Record<string, string> = {
  SIMPLE: 'Majorité simple',
  ABSOLUE: 'Majorité absolue',
  QUALIFIEE: 'Majorité qualifiée (2/3)',
  UNANIMITE: 'Unanimité requise',
}

// ─── Default ODJ point ─────────────────────────────────────────────────────

function createEmptyPoint(): WizardODJPoint {
  return {
    titre: '',
    type_traitement: 'DELIBERATION',
    majorite_requise: 'SIMPLE',
    rapporteur_id: null,
    description: null,
    huis_clos: false,
    votes_interdits: false,
  }
}

function getStandardPoints(): WizardODJPoint[] {
  return [
    {
      titre: 'Approbation du procès-verbal de la séance précédente',
      type_traitement: 'APPROBATION_PV',
      majorite_requise: 'SIMPLE',
      rapporteur_id: null,
      description: null,
      huis_clos: false,
      votes_interdits: false,
    },
    {
      titre: 'Questions diverses',
      type_traitement: 'QUESTION_DIVERSE',
      majorite_requise: 'SIMPLE',
      rapporteur_id: null,
      description: null,
      huis_clos: false,
      votes_interdits: true,
    },
  ]
}

// ═══════════════════════════════════════════════════════════════════════════
// WIZARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function SeanceCreationWizard({
  instances,
  members,
  instanceMembers,
  lastSeanceByInstance,
  existingDraft,
}: SeanceCreationWizardProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  // ─── Wizard state ─────────────────────────────────────────────────
  // ID du brouillon DB (créé dès la sortie de l'étape "Quand"). Si l'URL
  // contient ?seanceId=X et que le brouillon existe, on hydrate depuis la DB.
  const [seanceId, setSeanceId] = useState<string | null>(existingDraft?.id || searchParams.get('seanceId'))
  const [currentStep, setCurrentStep] = useState(() => {
    const s = parseInt(searchParams.get('step') || '0')
    if (Number.isFinite(s) && s >= 0 && s < STEPS.length) return s
    // Si on a un brouillon mais pas de step en URL : démarrer à l'étape ODJ
    // (les étapes 0-1 sont déjà renseignées dans le brouillon).
    if (existingDraft) return 2
    return 0
  })

  // Step 1: Instance
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>(
    existingDraft?.instance_id || (instances.length === 1 ? instances[0].id : '')
  )

  // Step 2: Quand et où
  const defaultDate = (() => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    return d.toISOString().split('T')[0]
  })()

  const draftDate = existingDraft?.date_seance ? new Date(existingDraft.date_seance) : null
  const [dateSeance, setDateSeance] = useState(
    draftDate ? draftDate.toISOString().split('T')[0] : defaultDate
  )
  const [heureSeance, setHeureSeance] = useState(
    draftDate
      ? `${String(draftDate.getHours()).padStart(2, '0')}:${String(draftDate.getMinutes()).padStart(2, '0')}`
      : '14:00'
  )
  const [lieu, setLieu] = useState(existingDraft?.lieu || '')
  const [mode, setMode] = useState<'PRESENTIEL' | 'HYBRIDE' | 'VISIO'>(
    (existingDraft?.mode as 'PRESENTIEL' | 'HYBRIDE' | 'VISIO') || 'PRESENTIEL'
  )
  const [publique, setPublique] = useState(existingDraft?.publique ?? true)
  const [urgence, setUrgence] = useState(false)
  const [presidentId, setPresidentId] = useState<string>(
    existingDraft?.president_effectif_seance_id || '_auto'
  )
  const [secretaireId, setSecretaireId] = useState<string>(
    existingDraft?.secretaire_seance_id || '_auto'
  )

  // Step 3: ODJ
  const [odjPoints, setOdjPoints] = useState<WizardODJPoint[]>(() => {
    if (existingDraft && existingDraft.odj_points.length > 0) {
      return existingDraft.odj_points.map((p) => ({
        id: p.id,
        titre: p.titre,
        description: p.description,
        type_traitement: (p.type_traitement || 'DELIBERATION') as WizardODJPoint['type_traitement'],
        majorite_requise: (p.majorite_requise || 'SIMPLE') as WizardODJPoint['majorite_requise'],
        rapporteur_id: p.rapporteur_id,
        huis_clos: p.huis_clos || false,
        votes_interdits: p.votes_interdits || false,
        documents: Array.isArray(p.documents) ? p.documents : [],
      }))
    }
    return getStandardPoints()
  })
  const [expandedPointIndex, setExpandedPointIndex] = useState<number | null>(null)

  // Step 4: Convocataires
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(
    new Set(existingDraft?.convocataire_member_ids || [])
  )
  const [convSearch, setConvSearch] = useState('')
  const [convocatairesInitialized, setConvocatairesInitialized] = useState(
    !!(existingDraft && existingDraft.convocataire_member_ids.length > 0)
  )

  // Step 5: Options
  const [sendConvocationsToggle, setSendConvocationsToggle] = useState(true)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)

  // ─── Persistance URL : ?seanceId=X&step=N ────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    if (seanceId) url.searchParams.set('seanceId', seanceId)
    else url.searchParams.delete('seanceId')
    url.searchParams.set('step', String(currentStep))
    window.history.replaceState({}, '', url.toString())
  }, [seanceId, currentStep])

  // ─── Persistance localStorage des étapes 3-4 (ODJ + convocataires) ───────
  // Ces étapes restent en mémoire locale jusqu'à la finalisation. On sauvegarde
  // en localStorage à chaque modification pour ne rien perdre si l'onglet ferme.
  const storageKey = seanceId ? `wizard_seance_${seanceId}` : null
  const hasHydratedLocalStorageRef = useRef(false)
  useEffect(() => {
    if (!storageKey) return
    if (hasHydratedLocalStorageRef.current) return
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const data = JSON.parse(raw)
        if (Array.isArray(data.odjPoints) && data.odjPoints.length > 0) {
          setOdjPoints(data.odjPoints)
        }
        if (Array.isArray(data.selectedMemberIds)) {
          setSelectedMemberIds(new Set(data.selectedMemberIds))
          setConvocatairesInitialized(true)
        }
      }
    } catch {
      // localStorage corrompu, on ignore
    }
    hasHydratedLocalStorageRef.current = true
  }, [storageKey])

  useEffect(() => {
    if (!storageKey) return
    if (!hasHydratedLocalStorageRef.current) return
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          odjPoints,
          selectedMemberIds: Array.from(selectedMemberIds),
          updatedAt: new Date().toISOString(),
        })
      )
    } catch {
      // Quota dépassé ou indisponible — on ignore silencieusement
    }
  }, [storageKey, odjPoints, selectedMemberIds])

  // ─── Derived data ─────────────────────────────────────────────────
  const selectedInstance = instances.find(i => i.id === selectedInstanceId)

  const instanceMemberIds = useMemo(() => {
    if (!selectedInstanceId) return new Set<string>()
    return new Set(
      instanceMembers
        .filter(im => im.instance_config_id === selectedInstanceId)
        .map(im => im.member_id)
    )
  }, [selectedInstanceId, instanceMembers])

  const instanceMembersList = useMemo(() => {
    const filtered = members.filter(m => instanceMemberIds.has(m.id))
    // Si aucun membre n'est assigné à l'instance, utiliser tous les membres
    return filtered.length > 0 ? filtered : members
  }, [members, instanceMemberIds])

  const nonInstanceMembers = useMemo(() => {
    if (instanceMemberIds.size === 0) return [] // Tous les membres sont déjà dans instanceMembersList
    return members.filter(m => !instanceMemberIds.has(m.id))
  }, [members, instanceMemberIds])

  const bureauPresident = useMemo(() => {
    if (!selectedInstanceId) return null
    const bp = instanceMembers.find(
      im => im.instance_config_id === selectedInstanceId && im.bureau_role === 'president'
    )
    if (!bp) return null
    return members.find(m => m.id === bp.member_id) || null
  }, [selectedInstanceId, instanceMembers, members])

  const bureauSecretaire = useMemo(() => {
    if (!selectedInstanceId) return null
    const bs = instanceMembers.find(
      im => im.instance_config_id === selectedInstanceId && im.bureau_role === 'secretaire'
    )
    if (!bs) return null
    return members.find(m => m.id === bs.member_id) || null
  }, [selectedInstanceId, instanceMembers, members])

  // Auto-generate title
  const generatedTitle = useMemo(() => {
    if (!selectedInstance || !dateSeance) return ''
    const dateFormatted = new Date(dateSeance).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    return `${selectedInstance.nom} du ${dateFormatted}`
  }, [selectedInstance, dateSeance])

  const lastSeance = selectedInstanceId ? lastSeanceByInstance[selectedInstanceId] : null

  const progress = ((currentStep + 1) / STEPS.length) * 100

  // ─── Initialize convocataires when switching to step 4 ────────────
  const initializeConvocataires = useCallback(() => {
    if (!convocatairesInitialized && instanceMemberIds.size > 0) {
      setSelectedMemberIds(new Set(instanceMemberIds))
      setConvocatairesInitialized(true)
    }
  }, [convocatairesInitialized, instanceMemberIds])

  // ─── Step validation ──────────────────────────────────────────────
  function canAdvance(): boolean {
    switch (currentStep) {
      case 0: return !!selectedInstanceId
      case 1: return !!dateSeance
      case 2: return odjPoints.filter(p => p.titre.trim()).length > 0
      case 3: return selectedMemberIds.size > 0
      case 4: return true
      default: return false
    }
  }

  function getStepError(): string | null {
    switch (currentStep) {
      case 0: return !selectedInstanceId ? 'Sélectionnez une instance pour continuer' : null
      case 1: return !dateSeance ? 'La date est requise' : null
      case 2: return odjPoints.filter(p => p.titre.trim()).length === 0 ? 'Ajoutez au moins un point à l\'ordre du jour' : null
      case 3: return selectedMemberIds.size === 0 ? 'Sélectionnez au moins un convocataire' : null
      default: return null
    }
  }

  // ─── Navigation ───────────────────────────────────────────────────
  function goToStep(step: number) {
    if (step < 0 || step >= STEPS.length) return
    // Can only go forward if current step is valid
    if (step > currentStep && !canAdvance()) return
    // Initialize convocataires when entering step 4
    if (step === 3) initializeConvocataires()
    setCurrentStep(step)
  }

  function goNext() {
    if (!canAdvance()) return
    if (currentStep >= STEPS.length - 1) return

    startTransition(async () => {
      // À la sortie de l'étape "Quand" (1), on crée le brouillon DB s'il
      // n'existe pas encore, sinon on met à jour ses métadonnées.
      if (currentStep === 1) {
        const draftInput = {
          titre: generatedTitle,
          instanceId: selectedInstanceId,
          dateSeance,
          heureSeance,
          lieu: lieu.trim() || undefined,
          mode,
          publique,
          presidentId: presidentId === '_auto' ? null : presidentId === '_none' ? null : presidentId,
          secretaireId: secretaireId === '_auto' ? null : secretaireId === '_none' ? null : secretaireId,
        }
        if (!seanceId) {
          const result = await createSeanceDraft(draftInput)
          if ('error' in result) { toast.error(result.error); return }
          setSeanceId(result.id)
        } else {
          const result = await updateSeanceDraft(seanceId, draftInput)
          if ('error' in result) { toast.error(result.error); return }
        }
      }

      // À la sortie de l'étape "ODJ" (2), on persiste l'ordre du jour en DB
      // et on récupère les IDs DB pour pouvoir y rattacher des documents.
      if (currentStep === 2 && seanceId) {
        const validPoints = odjPoints.filter(p => p.titre.trim())
        const result = await setSeanceODJ(seanceId, validPoints)
        if ('error' in result) { toast.error(result.error); return }
        // Réinjecter les IDs DB dans le state local pour permettre l'upload
        // de documents si l'utilisateur revient en arrière sur cette étape.
        setOdjPoints((prev) => {
          let dbIdx = 0
          return prev.map((p) => {
            if (!p.titre.trim()) return p
            const newId = result.ids[dbIdx++] || null
            return { ...p, id: newId }
          })
        })
      }

      // À la sortie de l'étape "Convocataires" (3), on persiste la liste.
      if (currentStep === 3) {
        if (seanceId) {
          const result = await setSeanceConvocataires(seanceId, Array.from(selectedMemberIds))
          if ('error' in result) { toast.error(result.error); return }
        }
        initializeConvocataires()
      }

      // Initialize convocataires when moving to step 3 (depuis 2)
      if (currentStep + 1 === 3) initializeConvocataires()

      setCurrentStep(s => s + 1)
    })
  }

  function goBack() {
    if (currentStep > 0) {
      setCurrentStep(s => s - 1)
    }
  }

  // ─── Instance selection (auto-advance) ────────────────────────────
  function handleInstanceSelect(instanceId: string) {
    setSelectedInstanceId(instanceId)
    setConvocatairesInitialized(false)
    // Reset convocataires when instance changes
    setSelectedMemberIds(new Set())
    // Auto-advance after a brief visual confirmation
    setTimeout(() => setCurrentStep(1), 200)
  }

  // ─── ODJ management ───────────────────────────────────────────────
  function addPoint() {
    setOdjPoints(prev => {
      // Insert before "Questions diverses" if it exists at the end
      const lastPoint = prev[prev.length - 1]
      if (lastPoint && lastPoint.type_traitement === 'QUESTION_DIVERSE') {
        return [...prev.slice(0, -1), createEmptyPoint(), lastPoint]
      }
      return [...prev, createEmptyPoint()]
    })
    // Expand the new point
    const newIndex = odjPoints.length > 0 && odjPoints[odjPoints.length - 1].type_traitement === 'QUESTION_DIVERSE'
      ? odjPoints.length - 1
      : odjPoints.length
    setExpandedPointIndex(newIndex)
  }

  function removePoint(index: number) {
    setOdjPoints(prev => prev.filter((_, i) => i !== index))
    if (expandedPointIndex === index) setExpandedPointIndex(null)
  }

  function updatePoint(index: number, updates: Partial<WizardODJPoint>) {
    setOdjPoints(prev =>
      prev.map((p, i) => (i === index ? { ...p, ...updates } : p))
    )
  }

  function movePoint(from: number, to: number) {
    if (to < 0 || to >= odjPoints.length) return
    setOdjPoints(prev => {
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  async function copyFromLastSeance() {
    if (!lastSeance) return
    const result = await getLastSeanceODJ(selectedInstanceId)
    if ('error' in result) {
      toast.error(result.error)
      return
    }
    if (result.data.length === 0) {
      toast.info('La dernière séance n\'avait pas de points à l\'ordre du jour')
      return
    }
    const copied: WizardODJPoint[] = result.data.map(p => ({
      titre: p.titre,
      type_traitement: (p.type_traitement || 'DELIBERATION') as WizardODJPoint['type_traitement'],
      majorite_requise: (p.majorite_requise || 'SIMPLE') as WizardODJPoint['majorite_requise'],
      rapporteur_id: p.rapporteur_id,
      description: p.description,
      huis_clos: p.huis_clos || false,
      votes_interdits: p.votes_interdits || false,
    }))
    setOdjPoints(copied)
    toast.success(`${copied.length} point(s) copiés depuis la dernière séance`)
  }

  // ─── Convocataires management ─────────────────────────────────────
  function toggleMember(memberId: string) {
    setSelectedMemberIds(prev => {
      const next = new Set(prev)
      if (next.has(memberId)) {
        next.delete(memberId)
      } else {
        next.add(memberId)
      }
      return next
    })
  }

  function selectAllInstanceMembers() {
    setSelectedMemberIds(new Set(instanceMemberIds))
  }

  function deselectAll() {
    setSelectedMemberIds(new Set())
  }

  // ─── Submit ───────────────────────────────────────────────────────
  function handleSubmit() {
    setConfirmDialogOpen(true)
  }

  function confirmSubmit() {
    setConfirmDialogOpen(false)

    startTransition(async () => {
      // Si le brouillon n'a jamais été créé en DB (cas exceptionnel : l'utilisateur
      // saute des étapes via le stepper), on tombe sur la création complète
      // legacy via createSeanceWizard.
      if (!seanceId) {
        const input: CreateSeanceWizardInput = {
          instanceId: selectedInstanceId,
          titre: generatedTitle,
          dateSeance,
          heureSeance,
          lieu,
          mode,
          publique,
          urgence,
          presidentId: presidentId === '_auto' ? null : presidentId === '_none' ? null : presidentId,
          secretaireId: secretaireId === '_auto' ? null : secretaireId === '_none' ? null : secretaireId,
          odjPoints: odjPoints.filter(p => p.titre.trim()),
          convocataireIds: Array.from(selectedMemberIds),
          sendConvocations: sendConvocationsToggle,
        }
        const result = await createSeanceWizard(input)
        if ('error' in result) { toast.error(result.error); return }
        if (storageKey) localStorage.removeItem(storageKey)
        if (result.convocationsSent > 0) {
          toast.success(`Séance créée — ${result.convocationsSent} convocation(s) envoyée(s)`, { duration: 5000 })
        } else {
          toast.success('Séance créée avec succès', { duration: 5000 })
        }
        router.push(`/seances/${result.id}?tab=odj`)
        return
      }

      // Cas standard : le brouillon existe déjà, ODJ et convocataires aussi
      // (sauvegardés à chaque "Suivant"). Reste juste à envoyer les
      // convocations si demandé.
      if (sendConvocationsToggle) {
        const result = await sendConvocations(seanceId)
        if ('error' in result) { toast.error(result.error); return }
        toast.success(`Séance convoquée — ${result.sent} convocation(s) envoyée(s)`, { duration: 5000 })
      } else {
        toast.success('Séance enregistrée en brouillon', { duration: 4000 })
      }

      if (storageKey) localStorage.removeItem(storageKey)

      const hasDocumentablePoints = odjPoints.some(p => p.type_traitement !== 'QUESTION_DIVERSE' && p.type_traitement !== 'INFORMATION')
      if (hasDocumentablePoints) {
        toast.info('💡 Pensez à ajouter les documents (rapports, budgets, annexes) à chaque point de l\'ordre du jour.', { duration: 8000 })
      }

      router.push(`/seances/${seanceId}?tab=odj`)
    })
  }

  // ─── Filtered members for convocataires search ────────────────────
  const filteredInstanceMembers = useMemo(() => {
    if (!convSearch) return instanceMembersList
    const q = convSearch.toLowerCase()
    return instanceMembersList.filter(
      m => `${m.prenom} ${m.nom}`.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q)
    )
  }, [instanceMembersList, convSearch])

  const filteredNonInstanceMembers = useMemo(() => {
    if (!convSearch) return nonInstanceMembers
    const q = convSearch.toLowerCase()
    return nonInstanceMembers.filter(
      m => `${m.prenom} ${m.nom}`.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q)
    )
  }, [nonInstanceMembers, convSearch])

  // ═══════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════

  return (
    <TooltipProvider>
      <div className="max-w-4xl mx-auto">
        {/* ─── Progress bar ─── */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            {STEPS.map((step, index) => {
              const StepIcon = step.icon
              const isActive = index === currentStep
              const isCompleted = index < currentStep
              const isClickable = index <= currentStep || (index === currentStep + 1 && canAdvance())

              return (
                <button
                  key={step.key}
                  onClick={() => isClickable ? goToStep(index) : undefined}
                  disabled={!isClickable}
                  className={`
                    flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all
                    ${isActive ? 'bg-primary text-primary-foreground shadow-sm' : ''}
                    ${isCompleted ? 'bg-emerald-50 text-emerald-700' : ''}
                    ${!isActive && !isCompleted ? 'text-muted-foreground' : ''}
                    ${isClickable && !isActive ? 'hover:bg-muted cursor-pointer' : ''}
                    ${!isClickable ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                  title={step.description}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <StepIcon className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">{step.label}</span>
                  <span className="sm:hidden">{index + 1}</span>
                </button>
              )
            })}
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>

        {/* ─── Step content ─── */}
        <div className="bg-white rounded-xl border shadow-sm p-6 sm:p-8 min-h-[400px]">
          {/* ═══ Step 1: Instance ═══ */}
          {currentStep === 0 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-1">Pour quelle instance ?</h2>
                <p className="text-muted-foreground text-sm">
                  Sélectionnez l&apos;assemblée délibérante concernée par cette séance.
                </p>
              </div>

              {instances.length === 0 ? (
                <div className="text-center py-12">
                  <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-medium mb-2">Aucune instance configurée</p>
                  <p className="text-muted-foreground mb-4">
                    Configurez au moins une instance dans les paramètres avant de créer une séance.
                  </p>
                  <Button onClick={() => router.push('/configuration')}>
                    Configurer une instance
                  </Button>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {instances.map(inst => {
                    const memberCount = instanceMembers.filter(
                      im => im.instance_config_id === inst.id
                    ).length
                    const lastS = lastSeanceByInstance[inst.id]
                    const isSelected = inst.id === selectedInstanceId

                    return (
                      <button
                        key={inst.id}
                        onClick={() => handleInstanceSelect(inst.id)}
                        className={`
                          relative flex flex-col items-start gap-2 rounded-xl border-2 p-5 text-left transition-all
                          ${isSelected ? 'border-primary bg-primary/5 shadow-md ring-2 ring-primary/20' : 'border-border hover:border-primary/40 hover:shadow-sm'}
                        `}
                      >
                        {isSelected && (
                          <div className="absolute top-3 right-3">
                            <CheckCircle2 className="h-5 w-5 text-primary" />
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Building2 className="h-5 w-5 text-primary" />
                          <span className="font-semibold text-base">{inst.nom}</span>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {inst.type_legal}
                        </Badge>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {memberCount} membre{memberCount !== 1 ? 's' : ''}
                          </span>
                          {lastS && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Dernière : {new Date(lastS.date_seance).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ═══ Step 2: Quand et où ═══ */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-1">Quand et où ?</h2>
                <p className="text-muted-foreground text-sm">
                  Définissez la date, l&apos;heure et le lieu de la séance.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date_seance">Date de la séance *</Label>
                  <Input
                    id="date_seance"
                    type="date"
                    value={dateSeance}
                    onChange={e => setDateSeance(e.target.value)}
                    className="min-h-[44px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="heure_seance">Heure</Label>
                  <Input
                    id="heure_seance"
                    type="time"
                    value={heureSeance}
                    onChange={e => setHeureSeance(e.target.value)}
                    className="min-h-[44px]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="lieu">Lieu</Label>
                <Input
                  id="lieu"
                  value={lieu}
                  onChange={e => setLieu(e.target.value)}
                  placeholder="Salle du conseil, Hôtel de ville"
                  className="min-h-[44px]"
                />
              </div>

              <div className="space-y-2">
                <Label>Mode de la séance</Label>
                <div className="grid grid-cols-3 gap-3">
                  {([
                    { value: 'PRESENTIEL' as const, label: 'Présentiel', icon: Building2 },
                    { value: 'HYBRIDE' as const, label: 'Hybride', icon: Monitor },
                    { value: 'VISIO' as const, label: 'Visioconférence', icon: Video },
                  ]).map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setMode(opt.value)}
                      className={`
                        flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all
                        ${mode === opt.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}
                      `}
                    >
                      <opt.icon className={`h-5 w-5 ${mode === opt.value ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className="text-sm font-medium">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <Label className="font-medium">Séance publique</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        {HELP_TEXTS.seance_publique}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Switch checked={publique} onCheckedChange={setPublique} />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <Label className="font-medium">Urgence</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        {HELP_TEXTS.convocation_urgence}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Switch checked={urgence} onCheckedChange={setUrgence} />
                </div>
              </div>

              <Separator />

              {/* Président et secrétaire */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Président(e) de séance</Label>
                  <MemberCombobox
                    members={instanceMembersList}
                    value={presidentId === '_auto' ? (bureauPresident?.id || '') : presidentId}
                    onChange={(v) => setPresidentId(v === '_none' ? '_none' : v)}
                    placeholder="Rechercher le/la président(e)..."
                    emptyLabel="Non désigné"
                  />
                  <p className="text-xs text-muted-foreground">
                    {presidentId === '_auto' && bureauPresident
                      ? `Hérité du bureau : ${bureauPresident.prenom} ${bureauPresident.nom}`
                      : presidentId === '_auto'
                        ? 'Aucun président dans le bureau — à désigner'
                        : 'Modifiable après la création'
                    }
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Secrétaire de séance</Label>
                  <MemberCombobox
                    members={instanceMembersList}
                    value={secretaireId === '_auto' ? (bureauSecretaire?.id || '') : secretaireId}
                    onChange={(v) => setSecretaireId(v === '_none' ? '_none' : v)}
                    placeholder="Rechercher le/la secrétaire..."
                    emptyLabel="Non désigné"
                  />
                  <p className="text-xs text-muted-foreground">
                    {secretaireId === '_auto' && bureauSecretaire
                      ? `Hérité du bureau : ${bureauSecretaire.prenom} ${bureauSecretaire.nom}`
                      : secretaireId === '_auto'
                        ? 'Aucun secrétaire dans le bureau — non bloquant'
                        : 'Non bloquant — modifiable après la création'
                    }
                  </p>
                </div>
              </div>

              {/* Auto-generated title preview */}
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="text-xs text-muted-foreground mb-1">Titre de la séance (généré automatiquement)</p>
                <p className="font-medium">{generatedTitle || 'Sélectionnez une instance et une date'}</p>
              </div>
            </div>
          )}

          {/* ═══ Step 3: Ordre du jour ═══ */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold mb-1">Ordre du jour</h2>
                  <p className="text-muted-foreground text-sm">
                    Ajoutez les points à traiter. Minimum 1 point requis.
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {lastSeance && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" onClick={copyFromLastSeance} className="min-h-[44px]">
                          <Copy className="h-4 w-4 mr-1.5" />
                          <span className="hidden sm:inline">Copier la dernière</span>
                          <span className="sm:hidden">Copier</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        {HELP_TEXTS.copier_derniere_seance} ({lastSeance.titre})
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>

              {/* ODJ Points list */}
              <div className="space-y-3">
                {odjPoints.map((point, index) => (
                  <div
                    key={index}
                    className={`
                      rounded-lg border transition-all
                      ${expandedPointIndex === index ? 'border-primary/40 shadow-sm' : 'border-border'}
                    `}
                  >
                    {/* Point header */}
                    <div className="flex items-center gap-2 p-3">
                      <button
                        className="text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing p-1"
                        title="Réordonner par glisser-déposer"
                        onMouseDown={e => e.preventDefault()}
                      >
                        <GripVertical className="h-4 w-4" />
                      </button>

                      <span className="text-sm font-medium text-muted-foreground w-6">
                        {index + 1}.
                      </span>

                      {expandedPointIndex === index ? (
                        <Input
                          value={point.titre}
                          onChange={e => updatePoint(index, { titre: e.target.value })}
                          placeholder="Titre du point..."
                          className="flex-1 min-h-[40px]"
                          autoFocus
                        />
                      ) : (
                        <button
                          className="flex-1 text-left text-sm font-medium truncate hover:text-primary transition-colors"
                          onClick={() => setExpandedPointIndex(index)}
                        >
                          {point.titre || <span className="text-muted-foreground italic">Titre du point...</span>}
                        </button>
                      )}

                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {TYPE_LABELS[point.type_traitement] || point.type_traitement}
                      </Badge>

                      {/* Move up/down buttons */}
                      <div className="flex flex-col">
                        <button
                          onClick={() => movePoint(index, index - 1)}
                          disabled={index === 0}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-30 p-0.5"
                          title="Monter"
                        >
                          <ChevronLeft className="h-3 w-3 rotate-90" />
                        </button>
                        <button
                          onClick={() => movePoint(index, index + 1)}
                          disabled={index === odjPoints.length - 1}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-30 p-0.5"
                          title="Descendre"
                        >
                          <ChevronRight className="h-3 w-3 rotate-90" />
                        </button>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-red-600"
                        onClick={() => removePoint(index)}
                        title="Supprimer ce point"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {/* Expanded details */}
                    {expandedPointIndex === index && (
                      <div className="px-3 pb-3 pt-0 space-y-3 border-t mx-3 mt-0 pt-3">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Type de traitement</Label>
                            <Select
                              value={point.type_traitement}
                              onValueChange={(v) =>
                                updatePoint(index, {
                                  type_traitement: v as WizardODJPoint['type_traitement'],
                                  votes_interdits: v === 'QUESTION_DIVERSE' || v === 'INFORMATION',
                                })
                              }
                            >
                              <SelectTrigger className="min-h-[40px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(TYPE_LABELS).map(([val, label]) => (
                                  <SelectItem key={val} value={val}>{label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center gap-1">
                              <Label className="text-xs">Majorité requise</Label>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  {HELP_TEXTS.majorite_simple}
                                </TooltipContent>
                              </Tooltip>
                            </div>
                            <Select
                              value={point.majorite_requise}
                              onValueChange={v => updatePoint(index, { majorite_requise: v as WizardODJPoint['majorite_requise'] })}
                            >
                              <SelectTrigger className="min-h-[40px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(MAJORITE_LABELS).map(([val, label]) => (
                                  <SelectItem key={val} value={val}>{label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs">Rapporteur</Label>
                            <MemberCombobox
                              members={instanceMembersList}
                              value={point.rapporteur_id || ''}
                              onChange={v => updatePoint(index, { rapporteur_id: v === '_none' ? null : v })}
                              placeholder="Rechercher..."
                              emptyLabel="Aucun"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs">Description (optionnelle)</Label>
                          <Textarea
                            value={point.description || ''}
                            onChange={e => updatePoint(index, { description: e.target.value })}
                            placeholder="Détails du point..."
                            rows={2}
                            className="text-sm"
                          />
                        </div>

                        <div className="flex items-center gap-6">
                          <label className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={point.huis_clos}
                              onCheckedChange={v => updatePoint(index, { huis_clos: !!v })}
                            />
                            <span>Huis clos</span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                {HELP_TEXTS.huis_clos}
                              </TooltipContent>
                            </Tooltip>
                          </label>

                          <label className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={point.votes_interdits}
                              onCheckedChange={v => updatePoint(index, { votes_interdits: !!v })}
                            />
                            <span>Sans vote</span>
                          </label>
                        </div>

                        {/* Documents joints — visible si le point est déjà persisté en DB
                            (les nouveaux points reçoivent leur ID au passage à l'étape 4) */}
                        <div className="space-y-1.5">
                          <Label className="text-xs">Pièces jointes</Label>
                          {point.id ? (
                            <WizardPointDocuments
                              seanceId={seanceId!}
                              pointId={point.id}
                              documents={Array.isArray(point.documents) ? point.documents : []}
                              onDocumentsChange={(docs) => updatePoint(index, { documents: docs })}
                            />
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              Cliquez sur « Suivant » pour enregistrer les points puis revenez
                              sur cette étape pour ajouter des pièces jointes.
                            </p>
                          )}
                        </div>

                        <div className="flex justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpandedPointIndex(null)}
                          >
                            Replier
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <Button variant="outline" onClick={addPoint} className="w-full min-h-[44px]">
                <Plus className="h-4 w-4 mr-2" />
                Ajouter un point
              </Button>

              {odjPoints.filter(p => p.titre.trim()).length === 0 && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Ajoutez au moins un point pour continuer
                </p>
              )}
            </div>
          )}

          {/* ═══ Step 4: Convocataires ═══ */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold mb-1">Qui convoquer ?</h2>
                  <p className="text-muted-foreground text-sm">
                    Les membres de l&apos;instance sont pré-sélectionnés. Ajustez si nécessaire.
                  </p>
                </div>
                <Badge variant="outline" className="text-sm shrink-0">
                  {selectedMemberIds.size} / {members.length} sélectionné{selectedMemberIds.size !== 1 ? 's' : ''}
                </Badge>
              </div>

              {/* Search + bulk actions */}
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher un membre..."
                    value={convSearch}
                    onChange={e => setConvSearch(e.target.value)}
                    className="pl-9 min-h-[44px]"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectAllInstanceMembers}
                  className="min-h-[44px] whitespace-nowrap"
                >
                  Tout sélectionner
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={deselectAll}
                  className="min-h-[44px] whitespace-nowrap"
                >
                  Tout désélectionner
                </Button>
              </div>

              {/* Instance members */}
              {filteredInstanceMembers.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Membres de l&apos;instance ({filteredInstanceMembers.length})
                  </p>
                  <div className="space-y-1">
                    {filteredInstanceMembers.map(m => (
                      <label
                        key={m.id}
                        className={`
                          flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-all
                          ${selectedMemberIds.has(m.id) ? 'bg-primary/5 border-primary/30' : 'hover:bg-muted/50'}
                        `}
                      >
                        <Checkbox
                          checked={selectedMemberIds.has(m.id)}
                          onCheckedChange={() => toggleMember(m.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-sm">
                            {m.prenom} {m.nom}
                          </span>
                          {m.qualite_officielle && (
                            <span className="text-xs text-muted-foreground ml-2">
                              ({m.qualite_officielle})
                            </span>
                          )}
                        </div>
                        {m.email && (
                          <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {m.email}
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Non-instance members */}
              {filteredNonInstanceMembers.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Autres membres ({filteredNonInstanceMembers.length})
                  </p>
                  <div className="space-y-1">
                    {filteredNonInstanceMembers.map(m => (
                      <label
                        key={m.id}
                        className={`
                          flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-all
                          ${selectedMemberIds.has(m.id) ? 'bg-primary/5 border-primary/30' : 'hover:bg-muted/50'}
                        `}
                      >
                        <Checkbox
                          checked={selectedMemberIds.has(m.id)}
                          onCheckedChange={() => toggleMember(m.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-sm">
                            {m.prenom} {m.nom}
                          </span>
                          {m.qualite_officielle && (
                            <span className="text-xs text-muted-foreground ml-2">
                              ({m.qualite_officielle})
                            </span>
                          )}
                        </div>
                        {m.email && (
                          <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {m.email}
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {filteredInstanceMembers.length === 0 && filteredNonInstanceMembers.length === 0 && (
                <div className="text-center py-8">
                  <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">
                    {convSearch ? 'Aucun membre ne correspond à votre recherche' : 'Aucun membre actif trouvé'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ═══ Step 5: Récapitulatif ═══ */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-1">Récapitulatif</h2>
                <p className="text-muted-foreground text-sm">
                  Vérifiez les informations avant de créer la séance.
                </p>
              </div>

              {/* Summary cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Instance & Date */}
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Building2 className="h-4 w-4 text-primary" />
                    Instance
                  </div>
                  <p className="text-base font-semibold">{selectedInstance?.nom || '-'}</p>
                  <p className="text-xs text-muted-foreground">{selectedInstance?.type_legal}</p>
                </div>

                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    Date et heure
                  </div>
                  <p className="text-base font-semibold">
                    {dateSeance
                      ? new Date(dateSeance).toLocaleDateString('fr-FR', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })
                      : '-'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {heureSeance || '-'} — {lieu || 'Lieu non précisé'}
                  </p>
                </div>
              </div>

              {/* Mode + options */}
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">
                  {mode === 'PRESENTIEL' ? 'Présentiel' : mode === 'HYBRIDE' ? 'Hybride' : 'Visioconférence'}
                </Badge>
                {publique ? (
                  <Badge variant="secondary">Séance publique</Badge>
                ) : (
                  <Badge variant="outline" className="text-amber-700">Huis clos</Badge>
                )}
                {urgence && (
                  <Badge variant="destructive">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Urgence
                  </Badge>
                )}
              </div>

              <Separator />

              {/* ODJ Summary */}
              <div>
                <div className="flex items-center gap-2 text-sm font-medium mb-3">
                  <FileText className="h-4 w-4 text-primary" />
                  Ordre du jour — {odjPoints.filter(p => p.titre.trim()).length} point(s)
                </div>
                <div className="space-y-1.5">
                  {odjPoints.filter(p => p.titre.trim()).map((p, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground w-5 text-right">{i + 1}.</span>
                      <span className="flex-1">{p.titre}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {TYPE_LABELS[p.type_traitement]}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Convocataires summary */}
              <div>
                <div className="flex items-center gap-2 text-sm font-medium mb-3">
                  <Users className="h-4 w-4 text-primary" />
                  {selectedMemberIds.size} convocataire(s)
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from(selectedMemberIds).map(id => {
                    const m = members.find(mb => mb.id === id)
                    return m ? (
                      <Badge key={id} variant="secondary" className="text-xs">
                        {m.prenom} {m.nom}
                      </Badge>
                    ) : null
                  })}
                </div>
              </div>

              <Separator />

              {/* Bureau */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Président(e) de séance</p>
                  <p className="text-sm font-medium">
                    {(() => {
                      const effectivePresidentId = presidentId === '_auto' ? bureauPresident?.id : presidentId === '_none' ? null : presidentId
                      if (!effectivePresidentId) return 'Non désigné'
                      const m = members.find(mb => mb.id === effectivePresidentId)
                      return m ? `${m.prenom} ${m.nom}` : 'Non désigné'
                    })()}
                  </p>
                  {presidentId === '_auto' && bureauPresident && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">Hérité du bureau</p>
                  )}
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Secrétaire de séance</p>
                  <p className="text-sm font-medium">
                    {(() => {
                      const effectiveSecretaireId = secretaireId === '_auto' ? bureauSecretaire?.id : secretaireId === '_none' ? null : secretaireId
                      if (!effectiveSecretaireId) return 'À désigner'
                      const m = members.find(mb => mb.id === effectiveSecretaireId)
                      return m ? `${m.prenom} ${m.nom}` : 'À désigner'
                    })()}
                  </p>
                  {secretaireId === '_auto' && bureauSecretaire && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">Hérité du bureau</p>
                  )}
                </div>
              </div>

              <Separator />

              {/* Send convocations toggle */}
              <div className="flex items-center justify-between rounded-lg border-2 border-primary/20 bg-primary/5 p-4">
                <div>
                  <Label className="font-medium text-base">Envoyer les convocations maintenant ?</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {sendConvocationsToggle
                      ? 'Les convocations seront envoyées par email immédiatement.'
                      : 'La séance sera créée en brouillon. Envoyez les convocations plus tard.'
                    }
                  </p>
                  {sendConvocationsToggle && (() => {
                    const effectivePresId = presidentId === '_auto' ? bureauPresident?.id : presidentId === '_none' ? null : presidentId
                    return !effectivePresId
                  })() && (
                    <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                      <AlertTriangle className="h-3 w-3" />
                      Aucun président désigné — les convocations ne pourront pas être envoyées automatiquement. Désignez un président à l&apos;étape 2.
                    </p>
                  )}
                </div>
                <Switch
                  checked={sendConvocationsToggle}
                  onCheckedChange={setSendConvocationsToggle}
                />
              </div>
            </div>
          )}
        </div>

        {/* ─── Navigation footer ─── */}
        <div className="flex items-center justify-between mt-6">
          <Button
            variant="outline"
            onClick={currentStep === 0 ? () => router.push('/seances') : goBack}
            className="min-h-[44px]"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            {currentStep === 0 ? 'Retour aux séances' : 'Précédent'}
          </Button>

          <div className="text-sm text-muted-foreground">
            Étape {currentStep + 1} / {STEPS.length}
          </div>

          {currentStep < STEPS.length - 1 ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    onClick={goNext}
                    disabled={!canAdvance()}
                    className="min-h-[44px]"
                  >
                    Suivant
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </span>
              </TooltipTrigger>
              {!canAdvance() && getStepError() && (
                <TooltipContent>
                  {getStepError()}
                </TooltipContent>
              )}
            </Tooltip>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={isPending}
              size="lg"
              className="min-h-[44px] bg-emerald-600 hover:bg-emerald-700"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Création en cours...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Créer la séance{sendConvocationsToggle ? ' et envoyer' : ''}
                </>
              )}
            </Button>
          )}
        </div>

        {/* ─── Confirmation dialog ─── */}
        <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmer la création</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3 text-sm">
                  <p>
                    Vous allez créer la séance <strong>{generatedTitle}</strong> avec :
                  </p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>{odjPoints.filter(p => p.titre.trim()).length} point(s) à l&apos;ordre du jour</li>
                    <li>{selectedMemberIds.size} convocataire(s)</li>
                    {sendConvocationsToggle && (
                      <li className="font-medium text-emerald-700">
                        Les convocations seront envoyées immédiatement
                      </li>
                    )}
                  </ul>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmSubmit}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {sendConvocationsToggle ? 'Créer et envoyer' : 'Créer la séance'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  )
}

// ─── Member Combobox (searchable) ────────────────────────────────────────────

function MemberCombobox({
  members,
  value,
  onChange,
  placeholder = 'Rechercher un membre...',
  emptyLabel = 'Aucun',
}: {
  members: { id: string; prenom: string; nom: string; qualite_officielle: string | null }[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  emptyLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const selected = value && value !== '_none' ? members.find(m => m.id === value) : null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal min-h-[40px]"
        >
          {selected ? (
            <span className="truncate">
              {selected.prenom} {selected.nom}
            </span>
          ) : (
            <span className="text-muted-foreground">{emptyLabel}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>Aucun membre trouvé.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="_none"
                onSelect={() => { onChange('_none'); setOpen(false) }}
              >
                <Check className={`mr-2 h-4 w-4 ${!value || value === '_none' ? 'opacity-100' : 'opacity-0'}`} />
                {emptyLabel}
              </CommandItem>
              {members.map(m => (
                <CommandItem
                  key={m.id}
                  value={`${m.prenom} ${m.nom}`}
                  onSelect={() => { onChange(m.id); setOpen(false) }}
                >
                  <Check className={`mr-2 h-4 w-4 ${value === m.id ? 'opacity-100' : 'opacity-0'}`} />
                  <span>{m.prenom} {m.nom}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

// ─── Documents joints à un point ODJ pendant le wizard ──────────────────────
// Réutilise les mêmes server actions que la fiche détail (uploadODJDocument /
// removeODJDocument). Le bouton n'est rendu que si le point a déjà un id DB.

function WizardPointDocuments({
  seanceId,
  pointId,
  documents,
  onDocumentsChange,
}: {
  seanceId: string
  pointId: string
  documents: DocumentInfo[]
  onDocumentsChange: (docs: DocumentInfo[]) => void
}) {
  const [isUploading, setIsUploading] = useState(false)
  const [removingPath, setRemovingPath] = useState<string | null>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.set('file', file)
      formData.set('point_id', pointId)
      formData.set('seance_id', seanceId)
      const result = await uploadODJDocument(formData)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        onDocumentsChange([...(documents || []), result.document])
        toast.success(`« ${result.document.name} » ajouté`)
      }
    } catch {
      toast.error('Erreur lors de l\'upload')
    } finally {
      setIsUploading(false)
      e.target.value = ''
    }
  }

  async function handleRemove(doc: DocumentInfo) {
    setRemovingPath(doc.path)
    try {
      const result = await removeODJDocument(pointId, seanceId, doc.path)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        onDocumentsChange((documents || []).filter((d) => d.path !== doc.path))
        toast.success('Document retiré')
      }
    } catch {
      toast.error('Erreur lors de la suppression')
    } finally {
      setRemovingPath(null)
    }
  }

  async function handleOpen(doc: DocumentInfo) {
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
  }

  return (
    <div className="space-y-2">
      {documents.length > 0 && (
        <ul className="space-y-1.5">
          {documents.map((doc) => (
            <li
              key={doc.path}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-muted/40 border"
            >
              <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs flex-1 truncate" title={doc.name}>
                {doc.name}
              </span>
              <button
                type="button"
                onClick={() => handleOpen(doc)}
                className="text-muted-foreground hover:text-foreground"
                title="Ouvrir le document dans un nouvel onglet"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleRemove(doc)}
                disabled={removingPath === doc.path}
                className="text-muted-foreground hover:text-destructive"
                title="Retirer ce document"
              >
                {removingPath === doc.path ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <X className="h-3.5 w-3.5" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
        {isUploading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Upload className="h-3.5 w-3.5" />
        )}
        {isUploading ? 'Upload en cours…' : 'Joindre un document'}
        <input
          type="file"
          className="hidden"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp,.txt"
          onChange={handleFileChange}
          disabled={isUploading}
        />
      </label>
    </div>
  )
}
