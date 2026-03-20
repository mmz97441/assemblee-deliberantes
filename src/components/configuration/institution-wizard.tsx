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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { saveInstitutionConfig } from '@/lib/actions/configuration'
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
  CircleDot,
  Circle,
  PartyPopper,
} from 'lucide-react'
import type { InstitutionConfigRow } from '@/lib/supabase/types'

const INSTITUTION_TYPE_LABELS: Record<string, string> = {
  commune: 'Commune',
  syndicat: 'Syndicat intercommunal',
  cc: 'Communauté de communes',
  departement: 'Conseil départemental',
  asso: 'Association loi 1901',
}

interface InstitutionWizardProps {
  data: InstitutionConfigRow | null
}

// Define steps
const STEPS = [
  {
    id: 'identite',
    title: 'Identité',
    description: 'Nom et type de votre institution',
    icon: Building2,
    requiredFields: ['nom_officiel', 'type_institution'],
  },
  {
    id: 'coordonnees',
    title: 'Coordonnées',
    description: 'Adresse et contact du secrétariat',
    icon: MapPin,
    requiredFields: [] as string[],
  },
  {
    id: 'legal',
    title: 'Informations légales',
    description: 'DPO, préfecture, portail public',
    icon: Scale,
    requiredFields: [] as string[],
  },
  {
    id: 'numerotation',
    title: 'Numérotation',
    description: 'Format des numéros de délibération',
    icon: Hash,
    requiredFields: [] as string[],
  },
] as const

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

// Compute completion per step
function computeStepCompletion(values: FormValues, stepId: string): number {
  switch (stepId) {
    case 'identite': {
      const fields = [values.nom_officiel, values.type_institution, values.siren, values.siret]
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
      // remise_zero and numero_depart always have defaults, count as filled
      return Math.round(((filled + 2) / 4) * 100)
    }
    default:
      return 0
  }
}

export function InstitutionWizard({ data }: InstitutionWizardProps) {
  const [isPending, startTransition] = useTransition()
  const [currentStep, setCurrentStep] = useState(0)
  const [values, setValues] = useState<FormValues>(() => getInitialValues(data))
  const [savedOnce, setSavedOnce] = useState(!!data?.id)

  const updateField = useCallback(<K extends keyof FormValues>(field: K, value: FormValues[K]) => {
    setValues((prev) => ({ ...prev, [field]: value }))
  }, [])

  // Compute global completion
  const stepCompletions = useMemo(() => {
    return STEPS.map((step) => computeStepCompletion(values, step.id))
  }, [values])

  const globalCompletion = useMemo(() => {
    return Math.round(stepCompletions.reduce((a, b) => a + b, 0) / STEPS.length)
  }, [stepCompletions])

  // Check if required fields for current step are filled
  const canProceed = useMemo(() => {
    const step = STEPS[currentStep]
    return step.requiredFields.every((field) => {
      const val = values[field as keyof FormValues]
      return typeof val === 'string' ? val.trim().length > 0 : val != null
    })
  }, [currentStep, values])

  function handleSave() {
    const formData = new FormData()

    // Set all values
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
      } else {
        toast.success('Configuration enregistrée avec succès !')
        setSavedOnce(true)
      }
    })
  }

  function goNext() {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((s) => s + 1)
    }
  }

  function goPrev() {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1)
    }
  }

  function goToStep(index: number) {
    // Allow going to any step (no strict lock)
    setCurrentStep(index)
  }

  const StepIcon = STEPS[currentStep].icon

  return (
    <div className="max-w-3xl space-y-8">
      {/* Global progress bar */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">
            Progression de la configuration
          </p>
          <span className="text-2xl font-bold tabular-nums text-institutional-blue">
            {globalCompletion}%
          </span>
        </div>
        <Progress value={globalCompletion} className="h-2" />
        {globalCompletion === 100 && (
          <p className="text-sm text-emerald-600 flex items-center gap-1.5 font-medium">
            <PartyPopper className="h-4 w-4" />
            Toutes les informations sont renseignées !
          </p>
        )}
      </div>

      {/* Step indicators */}
      <nav className="flex items-center gap-1">
        {STEPS.map((step, index) => {
          const isActive = index === currentStep
          const completion = stepCompletions[index]
          const isComplete = completion === 100
          const Icon = step.icon

          return (
            <button
              key={step.id}
              type="button"
              onClick={() => goToStep(index)}
              className={`
                flex-1 group relative flex flex-col items-center gap-2 py-3 px-2 rounded-xl transition-all duration-200
                ${isActive
                  ? 'bg-institutional-blue/5 ring-2 ring-institutional-blue/20'
                  : 'hover:bg-muted/50'
                }
              `}
            >
              {/* Step circle */}
              <div
                className={`
                  relative flex items-center justify-center w-10 h-10 rounded-full transition-all duration-300
                  ${isActive
                    ? 'bg-institutional-blue text-white shadow-md shadow-institutional-blue/25'
                    : isComplete
                      ? 'bg-emerald-500 text-white'
                      : 'bg-muted text-muted-foreground'
                  }
                `}
              >
                {isComplete && !isActive ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <Icon className="h-5 w-5" />
                )}
              </div>

              {/* Step label */}
              <div className="text-center">
                <p
                  className={`text-xs font-medium transition-colors ${
                    isActive ? 'text-institutional-blue' : 'text-muted-foreground'
                  }`}
                >
                  {step.title}
                </p>
                {isActive && (
                  <p className="text-[10px] text-muted-foreground mt-0.5 hidden sm:block">
                    {step.description}
                  </p>
                )}
              </div>

              {/* Completion mini-bar */}
              <div className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-muted overflow-hidden">
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

      {/* Step content */}
      <Card className="shadow-sm border-0 shadow-md">
        <CardContent className="p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-institutional-blue/10">
              <StepIcon className="h-5 w-5 text-institutional-blue" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">{STEPS[currentStep].title}</h3>
              <p className="text-sm text-muted-foreground">{STEPS[currentStep].description}</p>
            </div>
            <div className="ml-auto">
              <span className="text-sm font-medium tabular-nums text-muted-foreground">
                {stepCompletions[currentStep]}% complété
              </span>
            </div>
          </div>

          {/* Step 1: Identité */}
          {currentStep === 0 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="nom_officiel">
                    Nom officiel <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="nom_officiel"
                    value={values.nom_officiel}
                    onChange={(e) => updateField('nom_officiel', e.target.value)}
                    placeholder="Commune de Saint-Martin"
                    className="h-11"
                  />
                  <p className="text-xs text-muted-foreground">
                    Le nom tel qu&apos;il apparaîtra sur les documents officiels
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type_institution">
                    Type d&apos;institution <span className="text-destructive">*</span>
                  </Label>
                  <Select value={values.type_institution} onValueChange={(v) => updateField('type_institution', v)}>
                    <SelectTrigger id="type_institution" className="h-11">
                      <SelectValue placeholder="Sélectionner un type" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(INSTITUTION_TYPE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Détermine les règles par défaut applicables
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

          {/* Step 2: Coordonnées */}
          {currentStep === 1 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="space-y-2">
                <Label htmlFor="adresse_siege">Adresse du siège</Label>
                <Textarea
                  id="adresse_siege"
                  value={values.adresse_siege}
                  onChange={(e) => updateField('adresse_siege', e.target.value)}
                  placeholder={"1 place de la Mairie\n12345 Saint-Martin"}
                  rows={3}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  Adresse complète avec code postal et ville
                </p>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email_secretariat">Email du secrétariat</Label>
                  <Input
                    id="email_secretariat"
                    type="email"
                    value={values.email_secretariat}
                    onChange={(e) => updateField('email_secretariat', e.target.value)}
                    placeholder="secretariat@mairie.fr"
                    className="h-11"
                  />
                  <p className="text-xs text-muted-foreground">
                    Utilisé comme expéditeur pour les convocations
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telephone">Téléphone</Label>
                  <Input
                    id="telephone"
                    type="tel"
                    value={values.telephone}
                    onChange={(e) => updateField('telephone', e.target.value)}
                    placeholder="01 23 45 67 89"
                    className="h-11"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Informations légales */}
          {currentStep === 2 && (
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
                    placeholder="dpo@mairie.fr"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prefecture_rattachement">Préfecture de rattachement</Label>
                  <Input
                    id="prefecture_rattachement"
                    value={values.prefecture_rattachement}
                    onChange={(e) => updateField('prefecture_rattachement', e.target.value)}
                    placeholder="Préfecture de l'Hérault"
                    className="h-11"
                  />
                  <p className="text-xs text-muted-foreground">
                    Pour la transmission des actes réglementaires
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="url_portail_public">URL du portail public</Label>
                  <Input
                    id="url_portail_public"
                    type="url"
                    value={values.url_portail_public}
                    onChange={(e) => updateField('url_portail_public', e.target.value)}
                    placeholder="https://mairie-saint-martin.fr"
                    className="h-11"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Numérotation */}
          {currentStep === 3 && (
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
                  <p className="text-xs text-muted-foreground">
                    AAAA = année, NNN = numéro séquentiel
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prefixe_numero_deliberation">Préfixe</Label>
                  <Input
                    id="prefixe_numero_deliberation"
                    value={values.prefixe_numero_deliberation}
                    onChange={(e) => updateField('prefixe_numero_deliberation', e.target.value)}
                    placeholder="DEL"
                    className="h-11 font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Ex: DEL-2026-001 si préfixe = &quot;DEL&quot;
                  </p>
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
                        ? 'La numérotation repart de 1 chaque 1er janvier'
                        : 'La numérotation continue sans interruption'}
                    </p>
                  </div>
                  <Switch
                    id="remise_zero_annuelle"
                    checked={values.remise_zero_annuelle}
                    onCheckedChange={(v) => updateField('remise_zero_annuelle', v)}
                  />
                </div>

                <div className="border-t pt-4">
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
              </div>

              {/* Preview */}
              <div className="rounded-xl border bg-institutional-blue/5 p-4">
                <p className="text-xs font-medium text-muted-foreground mb-2">Aperçu du prochain numéro :</p>
                <p className="font-mono text-lg font-semibold text-institutional-blue">
                  {values.prefixe_numero_deliberation ? `${values.prefixe_numero_deliberation}-` : ''}
                  {values.format_numero_deliberation
                    .replace('AAAA', '2026')
                    .replace('NNN', String(values.numero_depart).padStart(3, '0'))}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
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

        <div className="flex items-center gap-2">
          {/* Step dots for mobile */}
          <div className="flex items-center gap-1.5 sm:hidden">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === currentStep
                    ? 'bg-institutional-blue'
                    : stepCompletions[i] === 100
                      ? 'bg-emerald-500'
                      : 'bg-muted-foreground/30'
                }`}
              />
            ))}
          </div>

          <span className="text-sm text-muted-foreground hidden sm:block">
            Étape {currentStep + 1} sur {STEPS.length}
          </span>
        </div>

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
            onClick={handleSave}
            disabled={isPending || !canProceed}
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
                {savedOnce ? 'Mettre à jour' : 'Enregistrer'}
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}
