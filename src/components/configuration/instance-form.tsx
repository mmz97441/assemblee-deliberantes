'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { saveInstanceConfig } from '@/lib/actions/configuration'
import type { InstanceConfigRow } from '@/lib/supabase/types'

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
  STRICT: 'Strict (refus après ouverture)',
  SOUPLE: 'Souple (entrée possible)',
  SUSPENDU: 'Suspendu (ajournement)',
}

interface InstanceFormProps {
  data: InstanceConfigRow | null
  onSuccess: () => void
}

function ToggleSwitch({
  checked,
  onCheckedChange,
  label,
}: {
  checked: boolean
  onCheckedChange: (v: boolean) => void
  label: string
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onCheckedChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
          checked ? 'bg-primary' : 'bg-input'
        }`}
      >
        <span
          className={`pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}

export function InstanceForm({ data, onSuccess }: InstanceFormProps) {
  const [isPending, startTransition] = useTransition()
  const [quorumType, setQuorumType] = useState<string>(data?.quorum_type || 'MAJORITE_MEMBRES')
  const [majoriteDefaut, setMajoriteDefaut] = useState<string>(data?.majorite_defaut || 'SIMPLE')
  const [modeArrivee, setModeArrivee] = useState<string>(data?.mode_arrivee_tardive || 'SOUPLE')
  const [voixPreponderante, setVoixPreponderante] = useState(data?.voix_preponderante ?? false)
  const [voteSecretNominations, setVoteSecretNominations] = useState(data?.vote_secret_nominations ?? true)
  const [seancesPubliques, setSeancesPubliques] = useState(data?.seances_publiques_defaut ?? true)
  const [votesQd, setVotesQd] = useState(data?.votes_qd_autorises ?? false)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)

    // State-managed fields
    formData.set('quorum_type', quorumType)
    formData.set('majorite_defaut', majoriteDefaut)
    formData.set('mode_arrivee_tardive', modeArrivee)
    formData.set('voix_preponderante', String(voixPreponderante))
    formData.set('vote_secret_nominations', String(voteSecretNominations))
    formData.set('seances_publiques_defaut', String(seancesPubliques))
    formData.set('votes_qd_autorises', String(votesQd))

    if (data?.id) {
      formData.set('id', data.id)
    }

    startTransition(async () => {
      const result = await saveInstanceConfig(formData)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success(data ? 'Instance mise à jour' : 'Instance créée')
        onSuccess()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Informations générales */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-muted-foreground">Informations générales</h4>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="instance_nom">
              Nom <span className="text-destructive">*</span>
            </Label>
            <Input
              id="instance_nom"
              name="nom"
              required
              defaultValue={data?.nom || ''}
              placeholder="Conseil municipal"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="instance_type_legal">
              Type légal <span className="text-destructive">*</span>
            </Label>
            <Input
              id="instance_type_legal"
              name="type_legal"
              required
              defaultValue={data?.type_legal || ''}
              placeholder="Conseil municipal, Bureau, Commission..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="instance_composition_max">Composition maximale</Label>
            <Input
              id="instance_composition_max"
              name="composition_max"
              type="number"
              min={1}
              defaultValue={data?.composition_max ?? ''}
              placeholder="33"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="instance_delai_convocation">Délai de convocation (jours)</Label>
            <Input
              id="instance_delai_convocation"
              name="delai_convocation_jours"
              type="number"
              min={1}
              defaultValue={data?.delai_convocation_jours ?? 5}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Quorum */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-muted-foreground">Quorum</h4>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="instance_quorum_type">Type de quorum</Label>
            <Select value={quorumType} onValueChange={setQuorumType}>
              <SelectTrigger id="instance_quorum_type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(QUORUM_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {quorumType === 'STATUTS' && (
            <>
              <div className="space-y-2">
                <Label>Fraction du quorum</Label>
                <div className="flex items-center gap-2">
                  <Input
                    name="quorum_fraction_numerateur"
                    type="number"
                    min={1}
                    defaultValue={data?.quorum_fraction_numerateur ?? 1}
                    className="w-20"
                  />
                  <span className="text-muted-foreground">/</span>
                  <Input
                    name="quorum_fraction_denominateur"
                    type="number"
                    min={1}
                    defaultValue={data?.quorum_fraction_denominateur ?? 2}
                    className="w-20"
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <Separator />

      {/* Votes et règles */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-muted-foreground">Votes et règles</h4>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="instance_majorite">Majorité par défaut</Label>
            <Select value={majoriteDefaut} onValueChange={setMajoriteDefaut}>
              <SelectTrigger id="instance_majorite">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(MAJORITE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="instance_arrivee">Mode d&apos;arrivée tardive</Label>
            <Select value={modeArrivee} onValueChange={setModeArrivee}>
              <SelectTrigger id="instance_arrivee">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(LATE_ARRIVAL_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <ToggleSwitch
            checked={voixPreponderante}
            onCheckedChange={setVoixPreponderante}
            label="Voix prépondérante du président"
          />
          <ToggleSwitch
            checked={voteSecretNominations}
            onCheckedChange={setVoteSecretNominations}
            label="Vote secret obligatoire pour les nominations"
          />
          <ToggleSwitch
            checked={seancesPubliques}
            onCheckedChange={setSeancesPubliques}
            label="Séances publiques par défaut"
          />
          <ToggleSwitch
            checked={votesQd}
            onCheckedChange={setVotesQd}
            label="Questions diverses autorisées au vote"
          />
        </div>
      </div>

      <Separator />

      <div className="flex justify-end gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Enregistrement...' : data ? 'Mettre à jour' : 'Créer l\'instance'}
        </Button>
      </div>
    </form>
  )
}
