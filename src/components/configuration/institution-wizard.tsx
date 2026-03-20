'use client'

import { useState, useTransition, useCallback, useMemo } from 'react'
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
  Circle,
  Users,
  Vote,
  Clock,
  Shield,
} from 'lucide-react'
import type { InstitutionConfigRow, InstanceConfigRow } from '@/lib/supabase/types'
import {
  INSTITUTION_TYPES,
  type InstitutionType,
} from '@/lib/constants/institution-templates'

// ─── Steps ───────────────────────────────────────────────────────────────────

const STEPS = [
  {
    id: 'type',
    title: 'Type',
    description: 'Quel type de structure êtes-vous ?',
    icon: Sparkles,
    requiredFields: ['type_institution'],
  },
  {
    id: 'identite',
    title: 'Identité',
    description: 'Nom et identifiants officiels',
    icon: Building2,
    requiredFields: ['nom_officiel'],
  },
  {
    id: 'coordonnees',
    title: 'Coordonnées',
    description: 'Adresse et contact',
    icon: MapPin,
    requiredFields: [] as string[],
  },
  {
    id: 'legal',
    title: 'Infos légales',
    description: 'DPO et préfecture',
    icon: Scale,
    requiredFields: [] as string[],
  },
  {
    id: 'numerotation',
    title: 'Numérotation',
    description: 'Format des délibérations',
    icon: Hash,
    requiredFields: [] as string[],
  },
  {
    id: 'instances',
    title: 'Instances',
    description: 'Vos assemblées délibérantes',
    icon: Landmark,
    requiredFields: [] as string[],
  },
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

function computeStepCompletion(values: FormValues, stepId: string, selectedInstances: string[]): number {
  switch (stepId) {
    case 'type':
      return values.type_institution ? 100 : 0
    case 'identite': {
      const fields = [values.nom_officiel, values.siren, values.siret]
      const filled = fields.filter((f) => f?.trim()).length
      return Math.round((filled / fields.length) * 100)
    }
    case 'coordonnees': {
      const fields = [values.adresse_siege, values.email_secretariat, values.telephone]
      const filled = fields.filter((f) => f?.trim()).length
      return Math.round((filled / fields.length) * 100)
    }
    case 'legal': {
      const fields = [values.dpo_nom, values.dpo_email, values.prefecture_rattachement, values.url_portail_public]
      const filled = fields.filter((f) => f?.trim()).length
      return Math.round((filled / fields.length) * 100)
    }
    case 'numerotation': {
      const fields = [values.format_numero_deliberation, values.prefixe_numero_deliberation]
      const filled = fields.filter((f) => f?.trim()).length
      return Math.round(((filled + 2) / 4) * 100) // +2 for defaults
    }
    case 'instances':
      return selectedInstances.length > 0 ? 100 : 0
    default:
      return 0
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export function InstitutionWizard({ data, existingInstances }: InstitutionWizardProps) {
  const [isPending, startTransition] = useTransition()
  const [currentStep, setCurrentStep] = useState(data?.type_institution ? 1 : 0)
  const [values, setValues] = useState<FormValues>(() => getInitialValues(data))
  const [savedOnce, setSavedOnce] = useState(!!data?.id)
  const [selectedInstances, setSelectedInstances] = useState<string[]>(() => {
    // Pre-select all existing instances by name
    return existingInstances.map((i) => i.nom)
  })
  const [createdInstances, setCreatedInstances] = useState<string[]>(() => {
    return existingInstances.map((i) => i.nom)
  })

  const updateField = useCallback(<K extends keyof FormValues>(field: K, value: FormValues[K]) => {
    setValues((prev) => ({ ...prev, [field]: value }))
  }, [])

  // Current type config
  const typeConfig = useMemo(() => {
    return values.type_institution ? INSTITUTION_TYPES[values.type_institution as InstitutionType] : null
  }, [values.type_institution])

  // Placeholders adapt to type
  const ph = typeConfig?.placeholders

  // Completions
  const stepCompletions = useMemo(() => {
    return STEPS.map((step) => computeStepCompletion(values, step.id, selectedInstances))
  }, [values, selectedInstances])

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

  // ─── Actions ─────────────────────────────────────────────────────────────

  function handleSaveInstitution() {
    const formData = new FormData()
    Object.entries(values).forEach(([key, value]) => {
      formData.set(key, String(value))
    })
    if (data?.id) {
      formData.set('id', data.id)
    }

    startTransition(async () => {
      const result = await saveInstitutionConfig(formData)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      setSavedOnce(true)

      // Also create selected instances that don't exist yet
      const templatesToCreate = (typeConfig?.instances || []).filter(
        (t) => selectedInstances.includes(t.nom) && !createdInstances.includes(t.nom)
      )

      let createdCount = 0
      for (const template of templatesToCreate) {
        const fd = new FormData()
        fd.set('nom', template.nom)
        fd.set('type_legal', template.type_legal)
        if (template.composition_max) fd.set('composition_max', String(template.composition_max))
        fd.set('delai_convocation_jours', String(template.delai_convocation_jours))
        fd.set('quorum_type', template.quorum_type)
        fd.set('majorite_defaut', template.majorite_defaut)
        fd.set('voix_preponderante', String(template.voix_preponderante))
        fd.set('vote_secret_nominations', String(template.vote_secret_nominations))
        fd.set('seances_publiques_defaut', String(template.seances_publiques_defaut))
        fd.set('votes_qd_autorises', String(template.votes_qd_autorises))
        fd.set('mode_arrivee_tardive', template.mode_arrivee_tardive)

        const instanceResult = await saveInstanceConfig(fd)
        if (!('error' in instanceResult)) {
          createdCount++
          setCreatedInstances((prev) => [...prev, template.nom])
        }
      }

      if (createdCount > 0) {
        toast.success(`Configuration enregistrée + ${createdCount} instance${createdCount > 1 ? 's' : ''} créée${createdCount > 1 ? 's' : ''} !`)
      } else {
        toast.success('Configuration enregistrée avec succès !')
      }
    })
  }

  function goNext() {
    if (currentStep < STEPS.length - 1) setCurrentStep((s) => s + 1)
  }

  function goPrev() {
    if (currentStep > 0) setCurrentStep((s) => s - 1)
  }

  function goToStep(index: number) {
    // Can only go forward if type is selected
    if (index > 0 && !values.type_institution) return
    setCurrentStep(index)
  }

  function selectType(type: string) {
    updateField('type_institution', type)
    const config = INSTITUTION_TYPES[type as InstitutionType]
    if (config) {
      // Auto-fill prefix if empty
      if (!values.prefixe_numero_deliberation) {
        updateField('prefixe_numero_deliberation', config.placeholders.prefixe_delib)
      }
      // Pre-select all default instances
      if (selectedInstances.length === 0 || existingInstances.length === 0) {
        setSelectedInstances(config.instances.map((i) => i.nom))
      }
    }
    // Auto-advance
    setTimeout(() => setCurrentStep(1), 300)
  }

  function toggleInstance(name: string) {
    setSelectedInstances((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    )
  }

  const StepIcon = STEPS[currentStep].icon

  return (
    <div className="max-w-3xl space-y-8">
      {/* ── Global progress ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <p className="text-sm font-medium text-muted-foreground">
              Configuration de votre {typeConfig?.shortLabel || 'institution'}
            </p>
            {typeConfig && (
              <Badge variant="outline" className="text-xs">
                {typeConfig.icon} {typeConfig.shortLabel}
              </Badge>
            )}
          </div>
          <span className="text-2xl font-bold tabular-nums text-institutional-blue">
            {globalCompletion}%
          </span>
        </div>
        <Progress value={globalCompletion} className="h-2.5" />
        {globalCompletion === 100 && (
          <p className="text-sm text-emerald-600 flex items-center gap-1.5 font-medium">
            <PartyPopper className="h-4 w-4" />
            Configuration complète — vous êtes prêt !
          </p>
        )}
      </div>

      {/* ── Step indicators ── */}
      <nav className="flex items-center gap-0.5 overflow-x-auto pb-1">
        {STEPS.map((step, index) => {
          const isActive = index === currentStep
          const completion = stepCompletions[index]
          const isComplete = completion === 100
          const isLocked = index > 0 && !values.type_institution
          const Icon = step.icon

          return (
            <button
              key={step.id}
              type="button"
              onClick={() => !isLocked && goToStep(index)}
              disabled={isLocked}
              className={`
                flex-1 min-w-[70px] group relative flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-xl transition-all duration-200
                ${isLocked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                ${isActive
                  ? 'bg-institutional-blue/5 ring-2 ring-institutional-blue/20'
                  : 'hover:bg-muted/50'
                }
              `}
            >
              <div
                className={`
                  flex items-center justify-center w-9 h-9 rounded-full transition-all duration-300
                  ${isActive
                    ? 'bg-institutional-blue text-white shadow-md shadow-institutional-blue/25'
                    : isComplete
                      ? 'bg-emerald-500 text-white'
                      : 'bg-muted text-muted-foreground'
                  }
                `}
              >
                {isComplete && !isActive ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </div>
              <p className={`text-[11px] font-medium transition-colors text-center leading-tight ${
                isActive ? 'text-institutional-blue' : 'text-muted-foreground'
              }`}>
                {step.title}
              </p>
              <div className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isComplete ? 'bg-emerald-500' : 'bg-institutional-blue/60'
                  }`}
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
          {/* Step header */}
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

          {/* ────────────── Step 0: Type selection ────────────── */}
          {currentStep === 0 && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="text-center space-y-2 pb-2">
                <h3 className="text-xl font-semibold">Bienvenue ! Quel type de structure gérez-vous ?</h3>
                <p className="text-muted-foreground text-sm max-w-lg mx-auto">
                  Choisissez votre type d&apos;institution. Les instances, les règles et les paramètres
                  seront automatiquement pré-configurés pour vous.
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
                          : 'border-muted hover:border-institutional-blue/30 hover:bg-muted/30'
                        }
                      `}
                    >
                      {isSelected && (
                        <div className="absolute top-3 right-3">
                          <CheckCircle2 className="h-5 w-5 text-institutional-blue" />
                        </div>
                      )}
                      <span className="text-3xl mb-3 block">{config.icon}</span>
                      <p className="font-semibold text-base mb-1">{config.label}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                        {config.description}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {config.instances.slice(0, 3).map((inst) => (
                          <Badge key={inst.nom} variant="secondary" className="text-[10px] font-normal">
                            {inst.nom}
                          </Badge>
                        ))}
                        {config.instances.length > 3 && (
                          <Badge variant="secondary" className="text-[10px] font-normal">
                            +{config.instances.length - 3}
                          </Badge>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* ────────────── Step 1: Identité ────────────── */}
          {currentStep === 1 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="col-span-full space-y-2">
                  <Label htmlFor="nom_officiel">
                    Nom officiel <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="nom_officiel"
                    value={values.nom_officiel}
                    onChange={(e) => updateField('nom_officiel', e.target.value)}
                    placeholder={ph?.nom || 'Nom de votre institution'}
                    className="h-12 text-base"
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">
                    Tel qu&apos;il apparaîtra sur les convocations et procès-verbaux
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="siren">SIREN</Label>
                  <Input
                    id="siren"
                    value={values.siren}
                    onChange={(e) => updateField('siren', e.target.value)}
                    placeholder="123456789"
                    maxLength={9}
                    className="h-11 font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="siret">SIRET</Label>
                  <Input
                    id="siret"
                    value={values.siret}
                    onChange={(e) => updateField('siret', e.target.value)}
                    placeholder="12345678900014"
                    maxLength={14}
                    className="h-11 font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ────────────── Step 2: Coordonnées ────────────── */}
          {currentStep === 2 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="space-y-2">
                <Label htmlFor="adresse_siege">Adresse du siège</Label>
                <Textarea
                  id="adresse_siege"
                  value={values.adresse_siege}
                  onChange={(e) => updateField('adresse_siege', e.target.value)}
                  placeholder={ph?.adresse || '1 place de la Mairie\n12345 Ville'}
                  rows={3}
                  className="resize-none"
                />
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email_secretariat">Email du secrétariat</Label>
                  <Input
                    id="email_secretariat"
                    type="email"
                    value={values.email_secretariat}
                    onChange={(e) => updateField('email_secretariat', e.target.value)}
                    placeholder={ph?.email || 'secretariat@institution.fr'}
                    className="h-11"
                  />
                  <p className="text-xs text-muted-foreground">
                    Expéditeur pour les convocations par email
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telephone">Téléphone</Label>
                  <Input
                    id="telephone"
                    type="tel"
                    value={values.telephone}
                    onChange={(e) => updateField('telephone', e.target.value)}
                    placeholder={ph?.telephone || '01 23 45 67 89'}
                    className="h-11"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ────────────── Step 3: Informations légales ────────────── */}
          {currentStep === 3 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="dpo_nom">Nom du DPO</Label>
                  <Input
                    id="dpo_nom"
                    value={values.dpo_nom}
                    onChange={(e) => updateField('dpo_nom', e.target.value)}
                    placeholder="Jean Dupont"
                    className="h-11"
                  />
                  <p className="text-xs text-muted-foreground">
                    Délégué à la Protection des Données
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dpo_email">Email du DPO</Label>
                  <Input
                    id="dpo_email"
                    type="email"
                    value={values.dpo_email}
                    onChange={(e) => updateField('dpo_email', e.target.value)}
                    placeholder="dpo@institution.fr"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prefecture_rattachement">Préfecture de rattachement</Label>
                  <Input
                    id="prefecture_rattachement"
                    value={values.prefecture_rattachement}
                    onChange={(e) => updateField('prefecture_rattachement', e.target.value)}
                    placeholder={ph?.prefecture || "Préfecture de l'Hérault"}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="url_portail_public">URL du portail public</Label>
                  <Input
                    id="url_portail_public"
                    type="url"
                    value={values.url_portail_public}
                    onChange={(e) => updateField('url_portail_public', e.target.value)}
                    placeholder={ph?.portail || 'https://votre-site.fr'}
                    className="h-11"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ────────────── Step 4: Numérotation ────────────── */}
          {currentStep === 4 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="format_numero_deliberation">Format de numérotation</Label>
                  <Input
                    id="format_numero_deliberation"
                    value={values.format_numero_deliberation}
                    onChange={(e) => updateField('format_numero_deliberation', e.target.value)}
                    placeholder="AAAA-NNN"
                    className="h-11 font-mono"
                  />
                  <p className="text-xs text-muted-foreground">AAAA = année, NNN = numéro séquentiel</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prefixe_numero_deliberation">Préfixe</Label>
                  <Input
                    id="prefixe_numero_deliberation"
                    value={values.prefixe_numero_deliberation}
                    onChange={(e) => updateField('prefixe_numero_deliberation', e.target.value)}
                    placeholder={ph?.prefixe_delib || 'DEL'}
                    className="h-11 font-mono"
                  />
                </div>
              </div>

              <div className="rounded-xl border bg-muted/30 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="remise_zero_annuelle" className="text-sm cursor-pointer">
                      Remise à zéro annuelle
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {values.remise_zero_annuelle
                        ? 'Repart de 1 chaque 1er janvier'
                        : 'Numérotation continue'}
                    </p>
                  </div>
                  <Switch
                    id="remise_zero_annuelle"
                    checked={values.remise_zero_annuelle}
                    onCheckedChange={(v) => updateField('remise_zero_annuelle', v)}
                  />
                </div>
                <Separator />
                <div className="space-y-2 max-w-[200px]">
                  <Label htmlFor="numero_depart">Numéro de départ</Label>
                  <Input
                    id="numero_depart"
                    type="number"
                    min={1}
                    value={values.numero_depart}
                    onChange={(e) => updateField('numero_depart', parseInt(e.target.value) || 1)}
                    className="h-11 font-mono"
                  />
                </div>
              </div>

              {/* Preview */}
              <div className="rounded-xl border bg-institutional-blue/5 p-4">
                <p className="text-xs font-medium text-muted-foreground mb-1">Aperçu :</p>
                <p className="font-mono text-lg font-semibold text-institutional-blue">
                  {values.prefixe_numero_deliberation ? `${values.prefixe_numero_deliberation}-` : ''}
                  {values.format_numero_deliberation
                    .replace('AAAA', '2026')
                    .replace('NNN', String(values.numero_depart).padStart(3, '0'))}
                </p>
              </div>
            </div>
          )}

          {/* ────────────── Step 5: Instances ────────────── */}
          {currentStep === 5 && typeConfig && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="rounded-xl border bg-institutional-blue/5 p-4 mb-2">
                <p className="text-sm">
                  <span className="font-medium">Pré-configuration pour {typeConfig.label}</span>
                  <br />
                  <span className="text-muted-foreground text-xs">
                    Cochez les instances que vous souhaitez créer. Vous pourrez les modifier ensuite.
                  </span>
                </p>
              </div>

              <div className="space-y-3">
                {typeConfig.instances.map((template) => {
                  const isSelected = selectedInstances.includes(template.nom)
                  const isAlreadyCreated = createdInstances.includes(template.nom)

                  return (
                    <button
                      key={template.nom}
                      type="button"
                      onClick={() => !isAlreadyCreated && toggleInstance(template.nom)}
                      disabled={isAlreadyCreated}
                      className={`
                        w-full text-left p-4 rounded-xl border-2 transition-all duration-200
                        ${isAlreadyCreated
                          ? 'border-emerald-200 bg-emerald-50/50 cursor-default'
                          : isSelected
                            ? 'border-institutional-blue bg-institutional-blue/5'
                            : 'border-muted hover:border-muted-foreground/30'
                        }
                      `}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`
                          flex items-center justify-center w-8 h-8 rounded-lg mt-0.5 flex-shrink-0
                          ${isAlreadyCreated
                            ? 'bg-emerald-100 text-emerald-600'
                            : isSelected
                              ? 'bg-institutional-blue/10 text-institutional-blue'
                              : 'bg-muted text-muted-foreground'
                          }
                        `}>
                          {isAlreadyCreated ? (
                            <Check className="h-4 w-4" />
                          ) : isSelected ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : (
                            <Circle className="h-4 w-4" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-sm">{template.nom}</p>
                            {isAlreadyCreated && (
                              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">
                                Déjà créée
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">{template.description}</p>
                          <div className="flex flex-wrap gap-2">
                            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                              <Users className="h-3 w-3" />
                              {template.composition_max ? `${template.composition_max} membres max` : 'Sans limite'}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {template.delai_convocation_jours}j convoc.
                            </span>
                            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                              <Vote className="h-3 w-3" />
                              {template.majorite_defaut === 'SIMPLE' ? 'Maj. simple' : template.majorite_defaut === 'ABSOLUE' ? 'Maj. absolue' : template.majorite_defaut === 'QUALIFIEE' ? 'Maj. qualifiée' : 'Unanimité'}
                            </span>
                            {template.seances_publiques_defaut && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                                <Shield className="h-3 w-3" />
                                Publique
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Features summary */}
              <div className="rounded-xl bg-muted/30 p-4 mt-4">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Fonctionnalités disponibles pour {typeConfig.shortLabel} :
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {typeConfig.features.map((feature) => (
                    <p key={feature} className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <Check className="h-3 w-3 text-emerald-500 mt-0.5 flex-shrink-0" />
                      {feature}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Navigation ── */}
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={goPrev}
          disabled={currentStep === 0}
          className="gap-2 h-11"
        >
          <ChevronLeft className="h-4 w-4" />
          Précédent
        </Button>

        <span className="text-sm text-muted-foreground">
          Étape {currentStep + 1} sur {STEPS.length}
        </span>

        {currentStep < STEPS.length - 1 ? (
          <Button
            type="button"
            onClick={goNext}
            disabled={!canProceed}
            className="gap-2 h-11"
          >
            Suivant
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handleSaveInstitution}
            disabled={isPending}
            className="gap-2 h-11 px-6"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enregistrement...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                {savedOnce ? 'Mettre à jour' : 'Tout enregistrer'}
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}
