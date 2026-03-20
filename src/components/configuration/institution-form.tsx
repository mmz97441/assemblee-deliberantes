'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { saveInstitutionConfig } from '@/lib/actions/configuration'
import type { InstitutionConfigRow } from '@/lib/supabase/types'

const INSTITUTION_TYPE_LABELS: Record<string, string> = {
  commune: 'Commune',
  syndicat: 'Syndicat intercommunal',
  cc: 'Communauté de communes',
  departement: 'Conseil départemental',
  asso: 'Association loi 1901',
}

interface InstitutionFormProps {
  data: InstitutionConfigRow | null
}

export function InstitutionForm({ data }: InstitutionFormProps) {
  const [isPending, startTransition] = useTransition()
  const [typeInstitution, setTypeInstitution] = useState(data?.type_institution || '')
  const [remiseZero, setRemiseZero] = useState(data?.remise_zero_annuelle ?? true)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)

    // Add fields managed by state
    formData.set('type_institution', typeInstitution)
    formData.set('remise_zero_annuelle', String(remiseZero))

    if (data?.id) {
      formData.set('id', data.id)
    }

    startTransition(async () => {
      const result = await saveInstitutionConfig(formData)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success('Configuration enregistrée')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Section Identité */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Identité</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="nom_officiel">
              Nom officiel <span className="text-destructive">*</span>
            </Label>
            <Input
              id="nom_officiel"
              name="nom_officiel"
              required
              defaultValue={data?.nom_officiel || ''}
              placeholder="Commune de Saint-Martin"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="type_institution">
              Type d&apos;institution <span className="text-destructive">*</span>
            </Label>
            <Select value={typeInstitution} onValueChange={setTypeInstitution} required>
              <SelectTrigger id="type_institution">
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
          </div>
          <div className="space-y-2">
            <Label htmlFor="siren">SIREN</Label>
            <Input
              id="siren"
              name="siren"
              defaultValue={data?.siren || ''}
              placeholder="123456789"
              maxLength={9}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="siret">SIRET</Label>
            <Input
              id="siret"
              name="siret"
              defaultValue={data?.siret || ''}
              placeholder="12345678900014"
              maxLength={14}
            />
          </div>
        </CardContent>
      </Card>

      {/* Section Coordonnées */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Coordonnées</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="col-span-full space-y-2">
            <Label htmlFor="adresse_siege">Adresse du siège</Label>
            <Textarea
              id="adresse_siege"
              name="adresse_siege"
              defaultValue={data?.adresse_siege || ''}
              placeholder="1 place de la Mairie&#10;12345 Saint-Martin"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email_secretariat">Email du secrétariat</Label>
            <Input
              id="email_secretariat"
              name="email_secretariat"
              type="email"
              defaultValue={data?.email_secretariat || ''}
              placeholder="secretariat@mairie.fr"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="telephone">Téléphone</Label>
            <Input
              id="telephone"
              name="telephone"
              type="tel"
              defaultValue={data?.telephone || ''}
              placeholder="01 23 45 67 89"
            />
          </div>
        </CardContent>
      </Card>

      {/* Section Légal */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Informations légales</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="dpo_nom">Nom du DPO</Label>
            <Input
              id="dpo_nom"
              name="dpo_nom"
              defaultValue={data?.dpo_nom || ''}
              placeholder="Jean Dupont"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dpo_email">Email du DPO</Label>
            <Input
              id="dpo_email"
              name="dpo_email"
              type="email"
              defaultValue={data?.dpo_email || ''}
              placeholder="dpo@mairie.fr"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="prefecture_rattachement">Préfecture de rattachement</Label>
            <Input
              id="prefecture_rattachement"
              name="prefecture_rattachement"
              defaultValue={data?.prefecture_rattachement || ''}
              placeholder="Préfecture de l'Hérault"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="url_portail_public">URL du portail public</Label>
            <Input
              id="url_portail_public"
              name="url_portail_public"
              type="url"
              defaultValue={data?.url_portail_public || ''}
              placeholder="https://mairie-saint-martin.fr"
            />
          </div>
        </CardContent>
      </Card>

      {/* Section Numérotation */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Numérotation des délibérations</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="format_numero_deliberation">Format de numérotation</Label>
            <Input
              id="format_numero_deliberation"
              name="format_numero_deliberation"
              defaultValue={data?.format_numero_deliberation || 'AAAA-NNN'}
              placeholder="AAAA-NNN"
            />
            <p className="text-xs text-muted-foreground">
              AAAA = année, NNN = numéro séquentiel
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="prefixe_numero_deliberation">Préfixe</Label>
            <Input
              id="prefixe_numero_deliberation"
              name="prefixe_numero_deliberation"
              defaultValue={data?.prefixe_numero_deliberation || ''}
              placeholder="DEL"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="remise_zero_annuelle">Remise à zéro annuelle</Label>
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                role="switch"
                aria-checked={remiseZero}
                onClick={() => setRemiseZero(!remiseZero)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                  remiseZero ? 'bg-primary' : 'bg-input'
                }`}
              >
                <span
                  className={`pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform ${
                    remiseZero ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className="text-sm text-muted-foreground">
                {remiseZero ? 'Oui' : 'Non'}
              </span>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="numero_depart">Numéro de départ</Label>
            <Input
              id="numero_depart"
              name="numero_depart"
              type="number"
              min={1}
              defaultValue={data?.numero_depart ?? 1}
            />
          </div>
        </CardContent>
      </Card>

      <Separator />

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Enregistrement...' : data ? 'Mettre à jour' : 'Enregistrer'}
        </Button>
      </div>
    </form>
  )
}
