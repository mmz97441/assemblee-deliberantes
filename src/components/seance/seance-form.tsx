'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { createSeance, updateSeance } from '@/lib/actions/seances'
import type { InstanceConfigRow, SeanceRow } from '@/lib/supabase/types'
import { CalendarDays, MapPin, Settings2, Loader2, Check, ChevronsUpDown } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'

interface SeanceListItem extends SeanceRow {
  instance_config: Pick<InstanceConfigRow, 'id' | 'nom'> | null
  _count_odj: number
  _count_convocataires: number
}

interface MemberOption {
  id: string
  prenom: string
  nom: string
  role: string
  qualite_officielle: string | null
}

interface SeanceFormDialogProps {
  open: boolean
  onClose: () => void
  seance: SeanceListItem | null
  instances: InstanceConfigRow[]
  members: MemberOption[]
}

// Inline validation error component
function FieldError({ message }: { message: string | null }) {
  if (!message) return null
  return <p className="text-xs text-red-600 mt-1">{message}</p>
}

export function SeanceFormDialog({ open, onClose, seance, instances, members }: SeanceFormDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const isEditing = !!seance

  // Smart defaults for new séance
  const defaultDate = new Date().toISOString().split('T')[0]
  const defaultTime = '14:00'

  // Form state
  const [titre, setTitre] = useState(seance?.titre || '')
  const [instanceId, setInstanceId] = useState(seance?.instance_id || '')
  const [dateSeance, setDateSeance] = useState(seance?.date_seance?.split('T')[0] || (!seance ? defaultDate : ''))
  const [heureSeance, setHeureSeance] = useState(
    seance?.date_seance?.includes('T')
      ? seance.date_seance.split('T')[1]?.substring(0, 5) || ''
      : (!seance ? defaultTime : '')
  )
  const [mode, setMode] = useState<string>(seance?.mode || 'PRESENTIEL')
  const [lieu, setLieu] = useState(seance?.lieu || '')
  const [publique, setPublique] = useState(seance?.publique !== false)
  const [notes, setNotes] = useState(seance?.notes || '')
  const [presidentId, setPresidentId] = useState(seance?.president_effectif_seance_id || '')
  const [secretaireId, setSecretaireId] = useState(seance?.secretaire_seance_id || '')
  const [autoConvoque, setAutoConvoque] = useState(true)

  // Inline validation errors (shown on blur)
  const [errors, setErrors] = useState<Record<string, string | null>>({})

  function setFieldError(field: string, message: string | null) {
    setErrors(prev => ({ ...prev, [field]: message }))
  }

  function validateField(field: string, value: string) {
    switch (field) {
      case 'titre':
        setFieldError('titre', value.trim() ? null : 'Le titre est requis')
        break
      case 'instanceId':
        setFieldError('instanceId', value ? null : "L'instance délibérante est requise")
        break
      case 'dateSeance':
        setFieldError('dateSeance', value ? null : 'La date est requise')
        break
    }
  }

  // Reset form when seance changes or dialog re-opens
  const resetKey = `${seance?.id || 'new'}-${open}`
  const [lastResetKey, setLastResetKey] = useState(resetKey)
  if (resetKey !== lastResetKey) {
    setLastResetKey(resetKey)
    setTitre(seance?.titre || '')
    setInstanceId(seance?.instance_id || '')
    setDateSeance(seance?.date_seance?.split('T')[0] || (!seance ? defaultDate : ''))
    setHeureSeance(
      seance?.date_seance?.includes('T')
        ? seance.date_seance.split('T')[1]?.substring(0, 5) || ''
        : (!seance ? defaultTime : '')
    )
    setMode(seance?.mode || 'PRESENTIEL')
    setLieu(seance?.lieu || '')
    setPublique(seance?.publique !== false)
    setNotes(seance?.notes || '')
    setPresidentId(seance?.president_effectif_seance_id || '')
    setSecretaireId(seance?.secretaire_seance_id || '')
    setAutoConvoque(true)
    setErrors({})
  }

  // Auto-generate title from instance
  function handleInstanceChange(value: string) {
    setInstanceId(value)
    if (!titre || titre === generateTitle(instanceId)) {
      setTitre(generateTitle(value))
    }
  }

  function generateTitle(instId: string): string {
    const inst = instances.find(i => i.id === instId)
    if (!inst) return ''
    const date = dateSeance
      ? new Date(dateSeance).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
      : ''
    return `${inst.nom}${date ? ` du ${date}` : ''}`
  }

  function handleDateChange(value: string) {
    setDateSeance(value)
    // Update title if it was auto-generated
    if (instanceId && (!titre || titre === generateTitle(instanceId))) {
      const inst = instances.find(i => i.id === instanceId)
      if (inst && value) {
        const date = new Date(value).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
        setTitre(`${inst.nom} du ${date}`)
      }
    }
  }

  function handleSubmit() {
    // Validate all required fields
    const newErrors: Record<string, string | null> = {}
    if (!titre.trim()) newErrors.titre = 'Le titre est requis'
    if (!instanceId) newErrors.instanceId = "L'instance délibérante est requise"
    if (!dateSeance) newErrors.dateSeance = 'La date est requise'

    const hasErrors = Object.values(newErrors).some(Boolean)
    if (hasErrors) {
      setErrors(prev => ({ ...prev, ...newErrors }))
      return
    }

    startTransition(async () => {
      const formData = new FormData()
      if (seance?.id) formData.set('id', seance.id)
      formData.set('titre', titre.trim())
      formData.set('instance_id', instanceId)

      // Combine date + time
      const fullDate = heureSeance
        ? `${dateSeance}T${heureSeance}:00`
        : `${dateSeance}T00:00:00`
      formData.set('date_seance', fullDate)

      formData.set('mode', mode)
      formData.set('lieu', lieu.trim())
      formData.set('publique', publique ? 'true' : 'false')
      formData.set('notes', notes.trim())
      if (presidentId && presidentId !== '_none') formData.set('president_effectif_seance_id', presidentId)
      if (secretaireId && secretaireId !== '_none') formData.set('secretaire_seance_id', secretaireId)
      formData.set('auto_convoque', autoConvoque ? 'true' : 'false')

      const result = isEditing
        ? await updateSeance(formData)
        : await createSeance(formData)

      if ('error' in result) {
        toast.error(result.error)
        return
      }

      toast.success(isEditing ? 'Séance mise à jour' : 'Séance créée avec succès')

      // If created, redirect to detail
      if (!isEditing && 'id' in result) {
        router.push(`/seances/${result.id}`)
      } else {
        router.refresh()
      }
      onClose()
    })
  }

  // Filter members for president/secretaire
  const presidentOptions = members.filter(m =>
    ['president', 'super_admin'].includes(m.role)
  )
  const secretaireOptions = members.filter(m =>
    ['secretaire_seance', 'gestionnaire', 'super_admin'].includes(m.role)
  )

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Modifier la séance' : 'Nouvelle séance'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Modifiez les informations de la séance.'
              : 'Planifiez une nouvelle séance délibérante.'}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="general" className="mt-2">
          <TabsList className="grid w-full grid-cols-3 h-10">
            <TabsTrigger value="general" className="gap-1.5 text-xs">
              <CalendarDays className="h-3.5 w-3.5" />
              Général
            </TabsTrigger>
            <TabsTrigger value="lieu" className="gap-1.5 text-xs">
              <MapPin className="h-3.5 w-3.5" />
              Lieu & Mode
            </TabsTrigger>
            <TabsTrigger value="options" className="gap-1.5 text-xs">
              <Settings2 className="h-3.5 w-3.5" />
              Options
            </TabsTrigger>
          </TabsList>

          {/* Tab: General */}
          <TabsContent value="general" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="instance_id">Instance délibérante *</Label>
              <Select
                value={instanceId}
                onValueChange={(v) => {
                  handleInstanceChange(v)
                  setFieldError('instanceId', v ? null : "L'instance délibérante est requise")
                }}
              >
                <SelectTrigger id="instance_id" className={errors.instanceId ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Choisir une instance..." />
                </SelectTrigger>
                <SelectContent>
                  {instances.map(inst => (
                    <SelectItem key={inst.id} value={inst.id}>
                      {inst.nom} ({inst.type_legal})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError message={errors.instanceId ?? null} />
              {instances.length === 0 && (
                <p className="text-xs text-amber-600">
                  Aucune instance configurée. Allez dans Configuration pour en créer.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date_seance">Date *</Label>
                <Input
                  id="date_seance"
                  type="date"
                  value={dateSeance}
                  onChange={e => handleDateChange(e.target.value)}
                  onBlur={() => validateField('dateSeance', dateSeance)}
                  className={errors.dateSeance ? 'border-red-500' : ''}
                />
                <FieldError message={errors.dateSeance ?? null} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="heure_seance">Heure</Label>
                <Input
                  id="heure_seance"
                  type="time"
                  value={heureSeance}
                  onChange={e => setHeureSeance(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="titre">Titre de la séance *</Label>
              <Input
                id="titre"
                value={titre}
                onChange={e => {
                  setTitre(e.target.value)
                  if (errors.titre && e.target.value.trim()) setFieldError('titre', null)
                }}
                onBlur={() => validateField('titre', titre)}
                placeholder="Conseil municipal du 15 avril 2026"
                className={errors.titre ? 'border-red-500' : ''}
              />
              <FieldError message={errors.titre ?? null} />
              <p className="text-xs text-muted-foreground">
                Le titre est généré automatiquement à partir de l&apos;instance et de la date.
              </p>
            </div>
          </TabsContent>

          {/* Tab: Lieu & Mode */}
          <TabsContent value="lieu" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="mode">Mode de la séance</Label>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger id="mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRESENTIEL">Présentiel</SelectItem>
                  <SelectItem value="HYBRIDE">Hybride (présentiel + visio)</SelectItem>
                  <SelectItem value="VISIO">Visioconférence</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lieu">Lieu</Label>
              <Input
                id="lieu"
                value={lieu}
                onChange={e => setLieu(e.target.value)}
                placeholder="Salle du conseil, Hôtel de ville"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes / Observations</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Informations complémentaires..."
                rows={3}
              />
            </div>
          </TabsContent>

          {/* Tab: Options */}
          <TabsContent value="options" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Président(e) de séance</Label>
              <MemberCombobox
                members={presidentOptions.length > 0 ? presidentOptions : members}
                value={presidentId}
                onChange={setPresidentId}
                placeholder="Rechercher le/la président(e)..."
                emptyLabel="Non désigné"
                showQualite
              />
            </div>

            <div className="space-y-2">
              <Label>Secrétaire de séance</Label>
              <MemberCombobox
                members={secretaireOptions.length > 0 ? secretaireOptions : members}
                value={secretaireId}
                onChange={setSecretaireId}
                placeholder="Rechercher le/la secrétaire..."
                emptyLabel="Non désigné"
              />
              <p className="text-xs text-muted-foreground">
                Non bloquant — un avertissement s&apos;affichera si non désigné à l&apos;ouverture.
              </p>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label className="font-medium">Séance publique</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Le public peut assister à la séance
                </p>
              </div>
              <Switch checked={publique} onCheckedChange={setPublique} />
            </div>

            {!isEditing && (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label className="font-medium">Convoquer automatiquement</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Ajouter tous les membres de l&apos;instance comme convocataires
                  </p>
                </div>
                <Switch checked={autoConvoque} onCheckedChange={setAutoConvoque} />
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEditing ? 'Enregistrer' : 'Créer la séance'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Member Combobox (searchable) ────────────────────────────────────────────

function MemberCombobox({
  members,
  value,
  onChange,
  placeholder = 'Rechercher un membre...',
  emptyLabel = 'Aucun',
  showQualite = false,
}: {
  members: MemberOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  emptyLabel?: string
  showQualite?: boolean
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
          className="w-full justify-between font-normal"
        >
          {selected ? (
            <span>
              {selected.prenom} {selected.nom}
              {showQualite && selected.qualite_officielle && (
                <span className="text-muted-foreground ml-1">({selected.qualite_officielle})</span>
              )}
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
                  value={`${m.prenom} ${m.nom} ${m.qualite_officielle || ''}`}
                  onSelect={() => { onChange(m.id); setOpen(false) }}
                >
                  <Check className={`mr-2 h-4 w-4 ${value === m.id ? 'opacity-100' : 'opacity-0'}`} />
                  <span>{m.prenom} {m.nom}</span>
                  {showQualite && m.qualite_officielle && (
                    <span className="text-xs text-muted-foreground ml-1">({m.qualite_officielle})</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
