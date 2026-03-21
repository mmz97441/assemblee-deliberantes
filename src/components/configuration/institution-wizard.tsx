'use client'

import { useState, useTransition, useCallback, useMemo, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { saveInstitutionConfig, saveInstanceConfig } from '@/lib/actions/configuration'
import {
  Building2,
  MapPin,
  Scale,
  Hash,
  Loader2,
  Save,
  ChevronLeft,
  ChevronRight,
  Check,
  PartyPopper,
  Landmark,
  Sparkles,
  CheckCircle2,
  Users,
  Clock,
  Shield,
  Plus,
  Pencil,
  Vote,
} from 'lucide-react'
import type { InstitutionConfigRow, InstanceConfigRow } from '@/lib/supabase/types'
import {
  INSTITUTION_TYPES,
  type InstitutionType,
  type InstanceTemplate,
} from '@/lib/constants/institution-templates'

// ─── Constants ───────────────────────────────────────────────────────────────

const QUORUM_TYPE_LABELS: Record<string, string> = {
  MAJORITE_MEMBRES: 'Majorité des membres',
  TIERS_MEMBRES: 'Tiers des membres',
  DEUX_TIERS: 'Deux tiers',
  STATUTS: 'Selon les statuts',
}

const MAJORITE_LABELS: Record<string, string> = {
  SIMPLE: 'Majorité simple',
  ABSOLUE: 'Majorité absolue',
  QUALIFIEE: 'Majorité qualifiée',
  UNANIMITE: 'Unanimité',
}

const LATE_ARRIVAL_LABELS: Record<string, string> = {
  STRICT: 'Strict — refus après ouverture',
  SOUPLE: 'Souple — entrée possible',
  SUSPENDU: 'Suspendu — ajournement',
}

// ─── Steps ───────────────────────────────────────────────────────────────────

const STEPS = [
  { id: 'type', title: 'Type', description: 'Quel type de structure ?', icon: Sparkles, requiredFields: ['type_institution'], savesInstitution: false },
  { id: 'identite', title: 'Identité', description: 'Nom et identifiants', icon: Building2, requiredFields: ['nom_officiel'], savesInstitution: true },
  { id: 'coordonnees', title: 'Contact', description: 'Adresse et contact', icon: MapPin, requiredFields: ['adresse_siege', 'email_secretariat'], savesInstitution: true },
  { id: 'legal', title: 'Légal', description: 'DPO et préfecture', icon: Scale, requiredFields: ['dpo_nom', 'dpo_email'], savesInstitution: true },
  { id: 'numerotation', title: 'Numéros', description: 'Format délibérations', icon: Hash, requiredFields: ['format_numero_deliberation'], savesInstitution: true },
  { id: 'instances', title: 'Instances', description: 'Vos assemblées', icon: Landmark, requiredFields: [] as string[], savesInstitution: false },
] as const

// ─── Types ───────────────────────────────────────────────────────────────────

type FormValues = {
  nom_officiel: string
  type_institution: string
  siren: string
  siret: string
  adresse_siege: string
  email_secretariat: string
  telephone: string
  dpo_nom: string
  dpo_email: string
  prefecture_rattachement: string
  url_portail_public: string
  format_numero_deliberation: string
  prefixe_numero_deliberation: string
  remise_zero_annuelle: boolean
  numero_depart: number
}

// Instance being edited (local state, not yet saved)
type EditableInstance = {
  id?: string // existing DB id
  nom: string
  type_legal: string
  composition_max: number | null
  delai_convocation_jours: number
  quorum_type: string
  majorite_defaut: string
  voix_preponderante: boolean
  vote_secret_nominations: boolean
  seances_publiques_defaut: boolean
  votes_qd_autorises: boolean
  mode_arrivee_tardive: string
  description: string
  isNew: boolean // true if not saved yet
  isSaved: boolean // true if successfully saved to DB
}

interface InstitutionWizardProps {
  data: InstitutionConfigRow | null
  existingInstances: InstanceConfigRow[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitialValues(data: InstitutionConfigRow | null): FormValues {
  return {
    nom_officiel: data?.nom_officiel || '',
    type_institution: data?.type_institution || '',
    siren: data?.siren || '',
    siret: data?.siret || '',
    adresse_siege: data?.adresse_siege || '',
    email_secretariat: data?.email_secretariat || '',
    telephone: data?.telephone || '',
    dpo_nom: data?.dpo_nom || '',
    dpo_email: data?.dpo_email || '',
    prefecture_rattachement: data?.prefecture_rattachement || '',
    url_portail_public: data?.url_portail_public || '',
    format_numero_deliberation: data?.format_numero_deliberation || 'AAAA-NNN',
    prefixe_numero_deliberation: data?.prefixe_numero_deliberation || '',
    remise_zero_annuelle: data?.remise_zero_annuelle ?? true,
    numero_depart: data?.numero_depart ?? 1,
  }
}

function templateToEditable(t: InstanceTemplate, existingId?: string): EditableInstance {
  return {
    id: existingId,
    nom: t.nom,
    type_legal: t.type_legal,
    composition_max: t.composition_max,
    delai_convocation_jours: t.delai_convocation_jours,
    quorum_type: t.quorum_type,
    majorite_defaut: t.majorite_defaut,
    voix_preponderante: t.voix_preponderante,
    vote_secret_nominations: t.vote_secret_nominations,
    seances_publiques_defaut: t.seances_publiques_defaut,
    votes_qd_autorises: t.votes_qd_autorises,
    mode_arrivee_tardive: t.mode_arrivee_tardive,
    description: t.description,
    isNew: !existingId,
    isSaved: !!existingId,
  }
}

function existingToEditable(row: InstanceConfigRow): EditableInstance {
  return {
    id: row.id,
    nom: row.nom,
    type_legal: row.type_legal,
    composition_max: row.composition_max,
    delai_convocation_jours: row.delai_convocation_jours ?? 5,
    quorum_type: row.quorum_type ?? 'MAJORITE_MEMBRES',
    majorite_defaut: row.majorite_defaut ?? 'SIMPLE',
    voix_preponderante: row.voix_preponderante ?? false,
    vote_secret_nominations: row.vote_secret_nominations ?? true,
    seances_publiques_defaut: row.seances_publiques_defaut ?? false,
    votes_qd_autorises: row.votes_qd_autorises ?? false,
    mode_arrivee_tardive: row.mode_arrivee_tardive ?? 'SOUPLE',
    description: '',
    isNew: false,
    isSaved: true,
  }
}

function newEmptyInstance(): EditableInstance {
  return {
    nom: '',
    type_legal: '',
    composition_max: null,
    delai_convocation_jours: 5,
    quorum_type: 'MAJORITE_MEMBRES',
    majorite_defaut: 'SIMPLE',
    voix_preponderante: false,
    vote_secret_nominations: true,
    seances_publiques_defaut: false,
    votes_qd_autorises: false,
    mode_arrivee_tardive: 'SOUPLE',
    description: '',
    isNew: true,
    isSaved: false,
  }
}

function computeStepCompletion(values: FormValues, stepId: string, instances: EditableInstance[]): number {
  switch (stepId) {
    case 'type':
      return values.type_institution ? 100 : 0
    case 'identite': {
      const fields = [values.nom_officiel, values.siren, values.siret]
      return Math.round((fields.filter((f) => f?.trim()).length / fields.length) * 100)
    }
    case 'coordonnees': {
      const fields = [values.adresse_siege, values.email_secretariat, values.telephone]
      return Math.round((fields.filter((f) => f?.trim()).length / fields.length) * 100)
    }
    case 'legal': {
      const fields = [values.dpo_nom, values.dpo_email, values.prefecture_rattachement, values.url_portail_public]
      return Math.round((fields.filter((f) => f?.trim()).length / fields.length) * 100)
    }
    case 'numerotation': {
      const fields = [values.format_numero_deliberation, values.prefixe_numero_deliberation]
      return Math.round(((fields.filter((f) => f?.trim()).length + 2) / 4) * 100)
    }
    case 'instances':
      return instances.filter((i) => i.isSaved).length > 0 ? 100 : 0
    default:
      return 0
  }
}

// Check if a step has all its required fields filled
function isStepComplete(values: FormValues, stepIndex: number, instances: EditableInstance[]): boolean {
  const step = STEPS[stepIndex]
  if (step.id === 'instances') return instances.filter((i) => i.isSaved).length > 0
  return step.requiredFields.every((field) => {
    const val = values[field as keyof FormValues]
    return typeof val === 'string' ? val.trim().length > 0 : val != null
  })
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SwitchRow({ label, description, checked, onCheckedChange, id }: {
  label: string
  description?: string
  checked: boolean
  onCheckedChange: (v: boolean) => void
  id: string
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="space-y-0.5">
        <Label htmlFor={id} className="text-sm font-normal cursor-pointer">{label}</Label>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}

// ─── Instance Edit Dialog ────────────────────────────────────────────────────

function InstanceEditDialog({
  instance,
  open,
  onOpenChange,
  onSave,
  isSaving,
}: {
  instance: EditableInstance
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (updated: EditableInstance) => void
  isSaving: boolean
}) {
  const [local, setLocal] = useState<EditableInstance>(instance)

  // Reset when instance changes
  useEffect(() => {
    setLocal(instance)
  }, [instance])

  const update = <K extends keyof EditableInstance>(key: K, val: EditableInstance[K]) => {
    setLocal((prev) => ({ ...prev, [key]: val }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Landmark className="h-5 w-5 text-institutional-blue" />
            {local.id ? `Modifier : ${local.nom}` : 'Nouvelle instance'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* General */}
          <div className="space-y-4">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Informations générales
            </h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Nom <span className="text-destructive">*</span></Label>
                <Input
                  value={local.nom}
                  onChange={(e) => update('nom', e.target.value)}
                  placeholder="Conseil municipal"
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label>Type légal <span className="text-destructive">*</span></Label>
                <Input
                  value={local.type_legal}
                  onChange={(e) => update('type_legal', e.target.value)}
                  placeholder="Conseil municipal, Bureau..."
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label>Composition maximale</Label>
                <Input
                  type="number"
                  min={1}
                  value={local.composition_max ?? ''}
                  onChange={(e) => update('composition_max', e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="Illimité"
                  className="h-10"
                />
                <p className="text-xs text-muted-foreground">Laisser vide = sans limite</p>
              </div>
              <div className="space-y-2">
                <Label>Délai de convocation (jours)</Label>
                <Input
                  type="number"
                  min={1}
                  value={local.delai_convocation_jours}
                  onChange={(e) => update('delai_convocation_jours', parseInt(e.target.value) || 5)}
                  className="h-10"
                />
                <p className="text-xs text-muted-foreground">Nombre de jours francs avant la séance</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Quorum & Vote */}
          <div className="space-y-4">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Quorum et votes
            </h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Type de quorum</Label>
                <Select value={local.quorum_type} onValueChange={(v) => update('quorum_type', v)}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(QUORUM_TYPE_LABELS).map(([val, label]) => (
                      <SelectItem key={val} value={val}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Majorité par défaut</Label>
                <Select value={local.majorite_defaut} onValueChange={(v) => update('majorite_defaut', v)}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(MAJORITE_LABELS).map(([val, label]) => (
                      <SelectItem key={val} value={val}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 col-span-full">
                <Label>Mode d&apos;arrivée tardive</Label>
                <Select value={local.mode_arrivee_tardive} onValueChange={(v) => update('mode_arrivee_tardive', v)}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(LATE_ARRIVAL_LABELS).map(([val, label]) => (
                      <SelectItem key={val} value={val}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          {/* Toggles */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Options
            </h4>
            <div className="rounded-lg border bg-muted/30 p-4 space-y-1">
              <SwitchRow
                id="dlg_voix"
                label="Voix prépondérante du président"
                description="En cas d'égalité, le président départage"
                checked={local.voix_preponderante}
                onCheckedChange={(v) => update('voix_preponderante', v)}
              />
              <Separator className="my-1" />
              <SwitchRow
                id="dlg_secret"
                label="Vote secret pour les nominations"
                description="Obligatoire pour les nominations individuelles"
                checked={local.vote_secret_nominations}
                onCheckedChange={(v) => update('vote_secret_nominations', v)}
              />
              <Separator className="my-1" />
              <SwitchRow
                id="dlg_public"
                label="Séances publiques par défaut"
                checked={local.seances_publiques_defaut}
                onCheckedChange={(v) => update('seances_publiques_defaut', v)}
              />
              <Separator className="my-1" />
              <SwitchRow
                id="dlg_qd"
                label="Questions diverses autorisées au vote"
                checked={local.votes_qd_autorises}
                onCheckedChange={(v) => update('votes_qd_autorises', v)}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2 border-t">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            type="button"
            onClick={() => onSave(local)}
            disabled={!local.nom.trim() || !local.type_legal.trim() || isSaving}
            className="gap-2 px-6"
          >
            {isSaving ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Enregistrement...</>
            ) : (
              <><Save className="h-4 w-4" /> {local.id ? 'Mettre à jour' : 'Créer et enregistrer'}</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Wizard ─────────────────────────────────────────────────────────────

export function InstitutionWizard({ data, existingInstances }: InstitutionWizardProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Restore step: URL param > auto-detect from saved data > step 0
  const initialStep = useMemo(() => {
    // URL param takes priority (user navigated directly)
    const s = parseInt(searchParams.get('step') || '')
    if (!isNaN(s) && s >= 0 && s < STEPS.length) return s

    // Auto-detect: find the first incomplete step based on saved data
    if (!data?.type_institution) return 0
    const vals = getInitialValues(data)
    for (let i = 0; i < STEPS.length; i++) {
      const step = STEPS[i]
      const incomplete = step.requiredFields.some((field) => {
        const val = vals[field as keyof FormValues]
        return typeof val === 'string' ? !val.trim() : val == null
      })
      if (incomplete) return i
    }
    // All steps complete — go to instances (last step)
    return STEPS.length - 1
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [isPending, startTransition] = useTransition()
  const [currentStep, setCurrentStep] = useState(initialStep)
  const [values, setValues] = useState<FormValues>(() => getInitialValues(data))
  const [editingInstance, setEditingInstance] = useState<EditableInstance | null>(null)
  const [isSavingInstance, setIsSavingInstance] = useState(false)

  // Build editable instances from existing DB rows + templates
  const [instances, setInstances] = useState<EditableInstance[]>(() => {
    return existingInstances.map(existingToEditable)
  })

  // Sync instances when existingInstances prop changes (e.g. after router.refresh())
  const [lastInstanceIds, setLastInstanceIds] = useState(() =>
    existingInstances.map(i => i.id).sort().join(',')
  )
  const currentInstanceIds = existingInstances.map(i => i.id).sort().join(',')
  if (currentInstanceIds !== lastInstanceIds) {
    setLastInstanceIds(currentInstanceIds)
    setInstances(existingInstances.map(existingToEditable))
  }

  // Persist step to URL
  useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.set('step', String(currentStep))
    window.history.replaceState({}, '', url.toString())
  }, [currentStep])

  const updateField = useCallback(<K extends keyof FormValues>(field: K, value: FormValues[K]) => {
    setValues((prev) => ({ ...prev, [field]: value }))
  }, [])

  const typeConfig = useMemo(() => {
    return values.type_institution ? INSTITUTION_TYPES[values.type_institution as InstitutionType] : null
  }, [values.type_institution])

  const ph = typeConfig?.placeholders

  const stepCompletions = useMemo(() => {
    return STEPS.map((step) => computeStepCompletion(values, step.id, instances))
  }, [values, instances])

  const globalCompletion = useMemo(() => {
    return Math.round(stepCompletions.reduce((a, b) => a + b, 0) / STEPS.length)
  }, [stepCompletions])

  const canProceed = useMemo(() => {
    const step = STEPS[currentStep]
    return step.requiredFields.every((field) => {
      const val = values[field as keyof FormValues]
      return typeof val === 'string' ? val.trim().length > 0 : val != null
    })
  }, [currentStep, values])

  // Templates not yet added
  const availableTemplates = useMemo(() => {
    if (!typeConfig) return []
    const existingNames = instances.map((i) => i.nom.toLowerCase())
    return typeConfig.instances.filter((t) => !existingNames.includes(t.nom.toLowerCase()))
  }, [typeConfig, instances])

  // ─── Actions ───────────────────────────────────────────────────────────────

  async function handleSaveInstance(inst: EditableInstance) {
    setIsSavingInstance(true)
    try {
      const fd = new FormData()
      if (inst.id) fd.set('id', inst.id)
      fd.set('nom', inst.nom)
      fd.set('type_legal', inst.type_legal)
      if (inst.composition_max) fd.set('composition_max', String(inst.composition_max))
      fd.set('delai_convocation_jours', String(inst.delai_convocation_jours))
      fd.set('quorum_type', inst.quorum_type)
      fd.set('majorite_defaut', inst.majorite_defaut)
      fd.set('voix_preponderante', String(inst.voix_preponderante))
      fd.set('vote_secret_nominations', String(inst.vote_secret_nominations))
      fd.set('seances_publiques_defaut', String(inst.seances_publiques_defaut))
      fd.set('votes_qd_autorises', String(inst.votes_qd_autorises))
      fd.set('mode_arrivee_tardive', inst.mode_arrivee_tardive)

      const result = await saveInstanceConfig(fd)
      if ('error' in result) {
        toast.error(result.error)
        return
      }

      // Get the ID from the result
      const savedId = 'id' in result ? (result as { id: string }).id : inst.id

      // Update local state with the DB-generated ID
      const saved = { ...inst, id: savedId, isNew: false, isSaved: true }
      setInstances((prev) => {
        const idx = prev.findIndex((i) =>
          i.id === inst.id || (i.nom === inst.nom && !i.id)
        )
        if (idx >= 0) {
          const updated = [...prev]
          updated[idx] = saved
          return updated
        }
        return [...prev, saved]
      })

      setEditingInstance(null)
      toast.success(inst.id ? 'Instance mise à jour' : 'Instance créée avec succès !')
      router.refresh()
    } finally {
      setIsSavingInstance(false)
    }
  }

  function addTemplateInstance(template: InstanceTemplate) {
    const editable = templateToEditable(template)
    setEditingInstance(editable)
  }

  function addCustomInstance() {
    setEditingInstance(newEmptyInstance())
  }

  function editInstance(inst: EditableInstance) {
    setEditingInstance(inst)
  }

  // Save institution and advance to next step
  function goNext() {
    if (currentStep >= STEPS.length - 1) return

    const step = STEPS[currentStep]

    // Steps 1-4 save institution data automatically
    if (step.savesInstitution) {
      const formData = new FormData()
      Object.entries(values).forEach(([key, value]) => {
        formData.set(key, String(value))
      })
      if (data?.id) formData.set('id', data.id)

      startTransition(async () => {
        const result = await saveInstitutionConfig(formData)
        if ('error' in result) {
          toast.error(result.error)
          return
        }
        toast.success('Enregistré ✓', { duration: 1500 })
        setCurrentStep((s) => s + 1)
        router.refresh()
      })
    } else {
      // Step 0 (type) — no save needed, just advance
      setCurrentStep((s) => s + 1)
    }
  }

  function goPrev() {
    if (currentStep > 0) setCurrentStep((s) => s - 1)
  }

  // Compute the highest step we can reach (all previous steps must be complete)
  const maxReachableStep = useMemo(() => {
    for (let i = 0; i < STEPS.length; i++) {
      if (!isStepComplete(values, i, instances)) return i
    }
    return STEPS.length - 1
  }, [values, instances])

  function goToStep(index: number) {
    if (index > 0 && !values.type_institution) return
    // Can go back to any step, or forward only up to maxReachableStep
    if (index > maxReachableStep) return
    setCurrentStep(index)
  }

  function selectType(type: string) {
    updateField('type_institution', type)
    const config = INSTITUTION_TYPES[type as InstitutionType]
    if (config && !values.prefixe_numero_deliberation) {
      updateField('prefixe_numero_deliberation', config.placeholders.prefixe_delib)
    }
    // Auto-advance after selection (step 0 doesn't need save)
    setTimeout(() => setCurrentStep(1), 300)
  }

  const StepIcon = STEPS[currentStep].icon
  const isLastStep = currentStep === STEPS.length - 1

  return (
    <div className="max-w-3xl space-y-6">
      {/* ── Progress ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <p className="text-sm font-medium text-muted-foreground">
              Configuration {typeConfig ? `— ${typeConfig.icon} ${typeConfig.shortLabel}` : ''}
            </p>
          </div>
          <span className="text-2xl font-bold tabular-nums text-institutional-blue">
            {globalCompletion}%
          </span>
        </div>
        <Progress value={globalCompletion} className="h-2" />
        {globalCompletion === 100 && (
          <p className="text-sm text-emerald-600 flex items-center gap-1.5 font-medium">
            <PartyPopper className="h-4 w-4" />
            Configuration complète !
          </p>
        )}
      </div>

      {/* ── Step indicators ── */}
      <nav className="flex items-center gap-0.5 overflow-x-auto pb-1">
        {STEPS.map((step, index) => {
          const isActive = index === currentStep
          const completion = stepCompletions[index]
          const isComplete = completion === 100
          const isLocked = index > maxReachableStep || (index > 0 && !values.type_institution)
          const Icon = step.icon

          return (
            <button
              key={step.id}
              type="button"
              onClick={() => !isLocked && goToStep(index)}
              disabled={isLocked}
              className={`
                flex-1 min-w-[60px] relative flex flex-col items-center gap-1 py-2 px-1 rounded-xl transition-all duration-200
                ${isLocked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                ${isActive ? 'bg-institutional-blue/5 ring-2 ring-institutional-blue/20' : 'hover:bg-muted/50'}
              `}
            >
              <div className={`
                flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300
                ${isActive ? 'bg-institutional-blue text-white shadow-md shadow-institutional-blue/25'
                  : isComplete ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground'}
              `}>
                {isComplete && !isActive ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
              </div>
              <p className={`text-[10px] font-medium text-center leading-tight ${
                isActive ? 'text-institutional-blue' : 'text-muted-foreground'
              }`}>
                {step.title}
              </p>
              <div className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${isComplete ? 'bg-emerald-500' : 'bg-institutional-blue/60'}`}
                  style={{ width: `${completion}%` }}
                />
              </div>
            </button>
          )
        })}
      </nav>

      {/* ── Step content ── */}
      <Card className="shadow-md">
        <CardContent className="p-6 sm:p-8">
          {currentStep > 0 && (
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-institutional-blue/10">
                <StepIcon className="h-5 w-5 text-institutional-blue" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{STEPS[currentStep].title}</h3>
                <p className="text-sm text-muted-foreground">{STEPS[currentStep].description}</p>
              </div>
              <span className="text-sm font-medium tabular-nums text-muted-foreground">
                {stepCompletions[currentStep]}%
              </span>
            </div>
          )}

          {/* ─── Step 0: Type ─── */}
          {currentStep === 0 && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="text-center space-y-2 pb-2">
                <h3 className="text-xl font-semibold">Quel type de structure gérez-vous ?</h3>
                <p className="text-muted-foreground text-sm max-w-lg mx-auto">
                  Les instances et les règles seront pré-configurées pour vous. Vous pourrez tout personnaliser ensuite.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {Object.entries(INSTITUTION_TYPES).map(([type, config]) => {
                  const isSelected = values.type_institution === type
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => selectType(type)}
                      className={`
                        relative text-left p-5 rounded-xl border-2 transition-all duration-200
                        ${isSelected
                          ? 'border-institutional-blue bg-institutional-blue/5 ring-2 ring-institutional-blue/20'
                          : 'border-muted hover:border-institutional-blue/30 hover:bg-muted/30'}
                      `}
                    >
                      {isSelected && (
                        <div className="absolute top-3 right-3">
                          <CheckCircle2 className="h-5 w-5 text-institutional-blue" />
                        </div>
                      )}
                      <span className="text-3xl mb-3 block">{config.icon}</span>
                      <p className="font-semibold text-base mb-1">{config.label}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed mb-3">{config.description}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {config.instances.slice(0, 3).map((inst) => (
                          <Badge key={inst.nom} variant="secondary" className="text-[10px] font-normal">{inst.nom}</Badge>
                        ))}
                        {config.instances.length > 3 && (
                          <Badge variant="secondary" className="text-[10px] font-normal">+{config.instances.length - 3}</Badge>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* ─── Step 1: Identité ─── */}
          {currentStep === 1 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="col-span-full space-y-2">
                  <Label htmlFor="nom_officiel">Nom officiel <span className="text-destructive">*</span></Label>
                  <Input
                    id="nom_officiel"
                    value={values.nom_officiel}
                    onChange={(e) => updateField('nom_officiel', e.target.value)}
                    placeholder={ph?.nom || 'Nom de votre institution'}
                    className="h-12 text-base"
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">
                    Apparaîtra sur les convocations et procès-verbaux
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="siren">SIREN</Label>
                  <Input id="siren" value={values.siren} onChange={(e) => updateField('siren', e.target.value)} placeholder="123456789" maxLength={9} className="h-11 font-mono" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="siret">SIRET</Label>
                  <Input id="siret" value={values.siret} onChange={(e) => updateField('siret', e.target.value)} placeholder="12345678900014" maxLength={14} className="h-11 font-mono" />
                </div>
              </div>
            </div>
          )}

          {/* ─── Step 2: Coordonnées ─── */}
          {currentStep === 2 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="space-y-2">
                <Label htmlFor="adresse_siege">Adresse du siège <span className="text-destructive">*</span></Label>
                <Textarea id="adresse_siege" value={values.adresse_siege} onChange={(e) => updateField('adresse_siege', e.target.value)} placeholder={ph?.adresse || '1 place de la Mairie\n12345 Ville'} rows={3} className="resize-none" />
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email_secretariat">Email du secrétariat <span className="text-destructive">*</span></Label>
                  <Input id="email_secretariat" type="email" value={values.email_secretariat} onChange={(e) => updateField('email_secretariat', e.target.value)} placeholder={ph?.email || 'secretariat@institution.fr'} className="h-11" />
                  <p className="text-xs text-muted-foreground">Expéditeur pour les convocations</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telephone">Téléphone</Label>
                  <Input id="telephone" type="tel" value={values.telephone} onChange={(e) => updateField('telephone', e.target.value)} placeholder={ph?.telephone || '01 23 45 67 89'} className="h-11" />
                </div>
              </div>
            </div>
          )}

          {/* ─── Step 3: Legal ─── */}
          {currentStep === 3 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="dpo_nom">Nom du DPO <span className="text-destructive">*</span></Label>
                  <Input id="dpo_nom" value={values.dpo_nom} onChange={(e) => updateField('dpo_nom', e.target.value)} placeholder="Jean Dupont" className="h-11" />
                  <p className="text-xs text-muted-foreground">Délégué à la Protection des Données</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dpo_email">Email du DPO <span className="text-destructive">*</span></Label>
                  <Input id="dpo_email" type="email" value={values.dpo_email} onChange={(e) => updateField('dpo_email', e.target.value)} placeholder="dpo@institution.fr" className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prefecture_rattachement">Préfecture de rattachement</Label>
                  <Input id="prefecture_rattachement" value={values.prefecture_rattachement} onChange={(e) => updateField('prefecture_rattachement', e.target.value)} placeholder={ph?.prefecture || "Préfecture de l'Hérault"} className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="url_portail_public">URL du portail public</Label>
                  <Input id="url_portail_public" type="url" value={values.url_portail_public} onChange={(e) => updateField('url_portail_public', e.target.value)} placeholder={ph?.portail || 'https://votre-site.fr'} className="h-11" />
                </div>
              </div>
            </div>
          )}

          {/* ─── Step 4: Numérotation ─── */}
          {currentStep === 4 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="format_numero">Format <span className="text-destructive">*</span></Label>
                  <Input id="format_numero" value={values.format_numero_deliberation} onChange={(e) => updateField('format_numero_deliberation', e.target.value)} placeholder="AAAA-NNN" className="h-11 font-mono" />
                  <p className="text-xs text-muted-foreground">AAAA = année, NNN = numéro</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prefixe">Préfixe</Label>
                  <Input id="prefixe" value={values.prefixe_numero_deliberation} onChange={(e) => updateField('prefixe_numero_deliberation', e.target.value)} placeholder={ph?.prefixe_delib || 'DEL'} className="h-11 font-mono" />
                </div>
              </div>
              <div className="rounded-xl border bg-muted/30 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="raz" className="text-sm cursor-pointer">Remise à zéro annuelle</Label>
                    <p className="text-xs text-muted-foreground">
                      {values.remise_zero_annuelle ? 'Repart de 1 chaque 1er janvier' : 'Numérotation continue'}
                    </p>
                  </div>
                  <Switch id="raz" checked={values.remise_zero_annuelle} onCheckedChange={(v) => updateField('remise_zero_annuelle', v)} />
                </div>
                <Separator />
                <div className="space-y-2 max-w-[200px]">
                  <Label htmlFor="num_depart">Numéro de départ</Label>
                  <Input id="num_depart" type="number" min={1} value={values.numero_depart} onChange={(e) => updateField('numero_depart', parseInt(e.target.value) || 1)} className="h-11 font-mono" />
                </div>
              </div>
              <div className="rounded-xl border bg-institutional-blue/5 p-4">
                <p className="text-xs font-medium text-muted-foreground mb-1">Aperçu :</p>
                <p className="font-mono text-lg font-semibold text-institutional-blue">
                  {values.prefixe_numero_deliberation ? `${values.prefixe_numero_deliberation}-` : ''}
                  {values.format_numero_deliberation.replace('AAAA', '2026').replace('NNN', String(values.numero_depart).padStart(3, '0'))}
                </p>
              </div>
            </div>
          )}

          {/* ─── Step 5: Instances ─── */}
          {currentStep === 5 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">

              {/* Existing / saved instances */}
              {instances.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Vos instances ({instances.filter(i => i.isSaved).length} enregistrée{instances.filter(i => i.isSaved).length > 1 ? 's' : ''})
                  </p>
                  {instances.map((inst, idx) => (
                    <div
                      key={inst.id || `new-${idx}`}
                      className={`
                        group p-4 rounded-xl border-2 transition-all
                        ${inst.isSaved
                          ? 'border-emerald-200 bg-emerald-50/30'
                          : 'border-amber-200 bg-amber-50/30'
                        }
                      `}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`
                          flex items-center justify-center w-9 h-9 rounded-lg mt-0.5 flex-shrink-0
                          ${inst.isSaved ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}
                        `}>
                          {inst.isSaved ? <Check className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-sm">{inst.nom || 'Sans nom'}</p>
                            <Badge variant="outline" className="text-[10px]">{inst.type_legal}</Badge>
                            {inst.isSaved ? (
                              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">Enregistrée</Badge>
                            ) : (
                              <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">Non enregistrée</Badge>
                            )}
                          </div>
                          {/* Key settings summary */}
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <Users className="h-3 w-3" />
                              {inst.composition_max ? `${inst.composition_max} membres` : 'Sans limite'}
                            </span>
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {inst.delai_convocation_jours}j convocation
                            </span>
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <Vote className="h-3 w-3" />
                              {MAJORITE_LABELS[inst.majorite_defaut] || inst.majorite_defaut}
                            </span>
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <Shield className="h-3 w-3" />
                              {QUORUM_TYPE_LABELS[inst.quorum_type] || inst.quorum_type}
                            </span>
                            {inst.seances_publiques_defaut && (
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                <Users className="h-3 w-3" /> Publique
                              </span>
                            )}
                            {inst.voix_preponderante && (
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                ⚖️ Voix prépondérante
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Edit button */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => editInstance(inst)}
                          className="h-8 w-8 p-0 opacity-60 hover:opacity-100"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add from templates */}
              {availableTemplates.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Ajouter depuis les modèles {typeConfig?.shortLabel}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {availableTemplates.map((template) => (
                      <button
                        key={template.nom}
                        type="button"
                        onClick={() => addTemplateInstance(template)}
                        className="text-left p-3 rounded-xl border-2 border-dashed border-muted hover:border-institutional-blue/40 hover:bg-institutional-blue/5 transition-all group"
                      >
                        <div className="flex items-center gap-2">
                          <Plus className="h-4 w-4 text-muted-foreground group-hover:text-institutional-blue transition-colors" />
                          <div>
                            <p className="font-medium text-sm">{template.nom}</p>
                            <p className="text-[11px] text-muted-foreground">{template.description}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Add custom */}
              <Separator />
              <Button
                type="button"
                variant="outline"
                onClick={addCustomInstance}
                className="w-full h-12 gap-2 border-dashed border-2 hover:border-institutional-blue/40 hover:bg-institutional-blue/5"
              >
                <Plus className="h-4 w-4" />
                Créer une instance personnalisée
              </Button>

              {/* Features */}
              {typeConfig && (
                <div className="rounded-xl bg-muted/30 p-4 mt-2">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Fonctionnalités {typeConfig.shortLabel} :
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {typeConfig.features.map((f) => (
                      <p key={f} className="text-xs text-muted-foreground flex items-start gap-1.5">
                        <Check className="h-3 w-3 text-emerald-500 mt-0.5 flex-shrink-0" />
                        {f}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Navigation ── */}
      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" onClick={goPrev} disabled={currentStep === 0 || isPending} className="gap-2 h-11">
          <ChevronLeft className="h-4 w-4" /> Précédent
        </Button>

        <span className="text-sm text-muted-foreground">
          Étape {currentStep + 1} / {STEPS.length}
        </span>

        {!isLastStep ? (
          <Button type="button" onClick={goNext} disabled={!canProceed || isPending} className="gap-2 h-11 px-6">
            {isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Enregistrement...</>
            ) : (
              <>Suivant <ChevronRight className="h-4 w-4" /></>
            )}
          </Button>
        ) : (
          /* Last step (instances) — just shows completion */
          <div className="flex items-center gap-2">
            {instances.filter(i => i.isSaved).length > 0 ? (
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
                <span className="text-sm font-medium">Configuration terminée</span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Ajoutez au moins une instance pour terminer
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Instance Edit Dialog ── */}
      {editingInstance && (
        <InstanceEditDialog
          instance={editingInstance}
          open={!!editingInstance}
          onOpenChange={(open) => { if (!open) setEditingInstance(null) }}
          onSave={handleSaveInstance}
          isSaving={isSavingInstance}
        />
      )}
    </div>
  )
}
