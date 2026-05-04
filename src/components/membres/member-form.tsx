'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
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
import { createMember, updateMember, assignMemberToInstances, uploadMemberPhoto, removeMemberPhoto } from '@/lib/actions/members'
import type { MemberWithInstances } from '@/lib/actions/members'
import type { InstanceConfigRow, UserRole } from '@/lib/supabase/types'
import { CIVILITE_LABELS, type Civilite } from '@/lib/protocole/appellation'
import { User, Briefcase, CalendarDays, Building2, Loader2, Check, ChevronsUpDown } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { PhoneInput } from '@/components/ui/phone-input'
import { QUALITES_OFFICIELLES, FONCTIONS_INSTANCE } from '@/lib/constants/membre-roles'
import { isValidEmail } from '@/lib/validators/email'

// Liste complète des rôles assignables. Le filtrage selon ce que le caller
// peut réellement attribuer est fait côté serveur dans `assertAllowedRoleAssignment`
// (cf. src/lib/actions/members.ts) basé sur INVITABLE_ROLES de helpers.ts.
// Si vous voulez aussi filtrer côté UI, prenez la liste d'INVITABLE_ROLES[callerRole].
const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'super_admin', label: 'Super-administrateur' },
  { value: 'dgs', label: 'DGS (Directeur Général des Services)' },
  { value: 'directeur_cabinet', label: 'Directeur de cabinet' },
  { value: 'president', label: 'Président(e)' },
  { value: 'gestionnaire', label: 'Gestionnaire' },
  { value: 'secretaire_seance', label: 'Secrétaire de séance' },
  { value: 'elu', label: 'Élu(e)' },
  { value: 'preparateur', label: 'Préparateur' },
]

interface InstanceAssignment {
  instanceId: string
  checked: boolean
  fonction: string
}

interface MemberFormDialogProps {
  open: boolean
  onClose: () => void
  member: MemberWithInstances | null
  instances: InstanceConfigRow[]
}

export function MemberFormDialog({ open, onClose, member, instances }: MemberFormDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const isEditing = !!member

  // Form state
  const [civilite, setCivilite] = useState<Civilite | ''>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((member as any)?.civilite as Civilite | null) || ''
  )
  const [prenom, setPrenom] = useState(member?.prenom || '')
  const [nom, setNom] = useState(member?.nom || '')
  const [email, setEmail] = useState(member?.email || '')
  const [telephone, setTelephone] = useState(member?.telephone || '')
  const [role, setRole] = useState<UserRole>(member?.role || 'elu')
  const [qualiteOfficielle, setQualiteOfficielle] = useState(member?.qualite_officielle || '')
  const [groupePolitique, setGroupePolitique] = useState(member?.groupe_politique || '')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [photoUrl, setPhotoUrl] = useState<string | null>((member as any)?.photo_url || null)
  const [mandatDebut, setMandatDebut] = useState(member?.mandat_debut || '')
  const [mandatFin, setMandatFin] = useState(member?.mandat_fin || '')
  // Toggle « Envoyer l'invitation » — uniquement pertinent à la création.
  // Par défaut coché : le gestionnaire qui crée un membre veut presque
  // toujours qu'il puisse se connecter.
  const [sendInvitation, setSendInvitation] = useState(true)

  // Instance assignments
  const [instanceAssignments, setInstanceAssignments] = useState<InstanceAssignment[]>(() => {
    return instances.map(inst => {
      const existing = member?.instance_members?.find(
        im => im.instance_config_id === inst.id && im.actif !== false
      )
      return {
        instanceId: inst.id,
        checked: !!existing,
        fonction: existing?.fonction_dans_instance || '',
      }
    })
  })

  // Reset form when member changes OR when dialog re-opens
  const resetKey = `${member?.id || 'new'}-${open}`
  const [lastResetKey, setLastResetKey] = useState(resetKey)
  if (resetKey !== lastResetKey) {
    setLastResetKey(resetKey)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setCivilite(((member as any)?.civilite as Civilite | null) || '')
    setPrenom(member?.prenom || '')
    setNom(member?.nom || '')
    setEmail(member?.email || '')
    setTelephone(member?.telephone || '')
    setRole(member?.role || 'elu')
    setQualiteOfficielle(member?.qualite_officielle || '')
    setGroupePolitique(member?.groupe_politique || '')
    setMandatDebut(member?.mandat_debut || '')
    setMandatFin(member?.mandat_fin || '')
    setInstanceAssignments(
      instances.map(inst => {
        const existing = member?.instance_members?.find(
          im => im.instance_config_id === inst.id && im.actif !== false
        )
        return {
          instanceId: inst.id,
          checked: !!existing,
          fonction: existing?.fonction_dans_instance || '',
        }
      })
    )
  }

  function toggleInstance(instanceId: string, checked: boolean) {
    setInstanceAssignments(prev =>
      prev.map(a => a.instanceId === instanceId ? { ...a, checked } : a)
    )
  }

  function updateInstanceFonction(instanceId: string, fonction: string) {
    setInstanceAssignments(prev =>
      prev.map(a => a.instanceId === instanceId ? { ...a, fonction } : a)
    )
  }

  // Inline validation errors
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  function validateField(field: string, value: string): string {
    if (field === 'civilite' && !value) return 'La civilité est requise'
    if (field === 'prenom' && !value.trim()) return 'Le prénom est requis'
    if (field === 'nom' && !value.trim()) return 'Le nom est requis'
    if (field === 'email' && !value.trim()) return 'L\'adresse email est requise'
    if (field === 'email' && value.trim() && !isValidEmail(value)) return 'Adresse email invalide'
    return ''
  }

  function handleBlur(field: string, value: string) {
    setTouched(prev => ({ ...prev, [field]: true }))
    const error = validateField(field, value)
    setErrors(prev => ({ ...prev, [field]: error }))
  }

  function handleSubmit() {
    // Validate all required fields
    const newErrors: Record<string, string> = {
      civilite: validateField('civilite', civilite),
      prenom: validateField('prenom', prenom),
      nom: validateField('nom', nom),
      email: validateField('email', email),
    }
    setErrors(newErrors)
    setTouched({ civilite: true, prenom: true, nom: true, email: true })

    const hasErrors = Object.values(newErrors).some(e => e !== '')
    if (hasErrors) return

    startTransition(async () => {
      const formData = new FormData()
      if (member?.id) formData.set('id', member.id)
      formData.set('civilite', civilite)
      formData.set('prenom', prenom.trim())
      formData.set('nom', nom.trim())
      formData.set('email', email.trim())
      formData.set('telephone', telephone.trim())
      formData.set('role', role)
      formData.set('qualite_officielle', qualiteOfficielle.trim())
      formData.set('groupe_politique', groupePolitique.trim())
      formData.set('mandat_debut', mandatDebut)
      formData.set('mandat_fin', mandatFin)
      // Le serveur lit cette valeur uniquement à la création (ignorée en update)
      formData.set('send_invitation', sendInvitation ? 'true' : 'false')

      // Add instance assignments to formData (for create)
      const selectedInstances = instanceAssignments.filter(a => a.checked)
      selectedInstances.forEach(a => {
        formData.append('instance_ids', a.instanceId)
        formData.set(`fonction_instance_${a.instanceId}`, a.fonction)
      })

      const result = isEditing
        ? await updateMember(formData)
        : await createMember(formData)

      if ('error' in result) {
        toast.error(result.error)
        return
      }

      // For editing, also update instance assignments separately
      let instanceError = false
      if (isEditing && member?.id) {
        const assignments = selectedInstances.map(a => ({
          instanceId: a.instanceId,
          fonction: a.fonction || null,
        }))
        const assignResult = await assignMemberToInstances(member.id, assignments)
        if ('error' in assignResult) {
          toast.error(`Membre sauvé, mais erreur instances : ${assignResult.error}`)
          instanceError = true
        }
      }

      if (!instanceError) {
        toast.success(isEditing ? 'Membre mis à jour' : 'Membre créé avec succès')
      }
      router.refresh()
      onClose()
    })
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Modifier le membre' : 'Ajouter un membre'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Modifiez les informations du membre.'
              : 'Remplissez les informations pour ajouter un nouveau membre.'}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="identite" className="mt-2">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto sm:h-10 gap-1 sm:gap-0">
            <TabsTrigger value="identite" className="gap-1.5 text-xs">
              <User className="h-3.5 w-3.5" />
              Identité
            </TabsTrigger>
            <TabsTrigger value="fonction" className="gap-1.5 text-xs">
              <Briefcase className="h-3.5 w-3.5" />
              Fonction
            </TabsTrigger>
            <TabsTrigger value="mandat" className="gap-1.5 text-xs">
              <CalendarDays className="h-3.5 w-3.5" />
              Mandat
            </TabsTrigger>
            <TabsTrigger value="instances" className="gap-1.5 text-xs">
              <Building2 className="h-3.5 w-3.5" />
              Instances
            </TabsTrigger>
          </TabsList>

          {/* Tab: Identite */}
          <TabsContent value="identite" className="space-y-4 mt-4">
            {/* Photo de profil — disponible uniquement après création */}
            <MemberPhotoUploader
              memberId={member?.id || null}
              currentUrl={photoUrl}
              memberInitials={`${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase() || '?'}
              onChange={setPhotoUrl}
            />
            <div className="space-y-2">
              <Label htmlFor="civilite">Civilité *</Label>
              <Select
                value={civilite}
                onValueChange={(v) => {
                  const next = v as Civilite
                  setCivilite(next)
                  if (touched.civilite) setErrors(prev => ({ ...prev, civilite: validateField('civilite', next) }))
                }}
              >
                <SelectTrigger
                  id="civilite"
                  className={touched.civilite && errors.civilite ? 'border-red-500' : ''}
                  onBlur={() => handleBlur('civilite', civilite)}
                >
                  <SelectValue placeholder="Sélectionner…" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(CIVILITE_LABELS) as [Civilite, string][]).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {touched.civilite && errors.civilite && <p className="text-xs text-red-500">{errors.civilite}</p>}
              <p className="text-xs text-muted-foreground">
                Utilisée pour les appellations protocolaires (« Madame la Maire », « Monsieur le Conseiller »…).
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="prenom">Prénom *</Label>
                <Input
                  id="prenom"
                  value={prenom}
                  onChange={e => { setPrenom(e.target.value); if (touched.prenom) setErrors(prev => ({ ...prev, prenom: validateField('prenom', e.target.value) })) }}
                  onBlur={() => handleBlur('prenom', prenom)}
                  placeholder="Jean"
                  className={touched.prenom && errors.prenom ? 'border-red-500' : ''}
                />
                {touched.prenom && errors.prenom && <p className="text-xs text-red-500">{errors.prenom}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="nom">Nom *</Label>
                <Input
                  id="nom"
                  value={nom}
                  onChange={e => { setNom(e.target.value); if (touched.nom) setErrors(prev => ({ ...prev, nom: validateField('nom', e.target.value) })) }}
                  onBlur={() => handleBlur('nom', nom)}
                  placeholder="Dupont"
                  className={touched.nom && errors.nom ? 'border-red-500' : ''}
                />
                {touched.nom && errors.nom && <p className="text-xs text-red-500">{errors.nom}</p>}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Adresse email *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); if (touched.email) setErrors(prev => ({ ...prev, email: validateField('email', e.target.value) })) }}
                onBlur={() => handleBlur('email', email)}
                placeholder="jean.dupont@mairie.fr"
                className={touched.email && errors.email ? 'border-red-500' : ''}
              />
              {touched.email && errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="telephone">Téléphone</Label>
              <PhoneInput
                value={telephone}
                onChange={setTelephone}
                defaultCountry="RE"
              />
              <p className="text-xs text-muted-foreground">
                Indicatif par défaut : +262 (Réunion / Mayotte). Pour un autre
                pays, tapez l&apos;indicatif (ex : +33 pour la France).
              </p>
            </div>
          </TabsContent>

          {/* Tab: Fonction */}
          <TabsContent value="fonction" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="role">Rôle dans l&apos;application *</Label>
              <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Qualité officielle</Label>
              <RoleCombobox
                value={qualiteOfficielle}
                onChange={setQualiteOfficielle}
                options={QUALITES_OFFICIELLES}
                placeholder="Choisir une qualité…"
                searchPlaceholder="Rechercher (Maire, Adjoint, Président…)"
                emptyLabel="Aucune qualité (laisser vide)"
                noMatchLabel="Aucune qualité trouvée."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="groupe_politique">Groupe politique</Label>
              <Input
                id="groupe_politique"
                value={groupePolitique}
                onChange={e => setGroupePolitique(e.target.value)}
                placeholder="Majorité, Opposition..."
              />
            </div>
          </TabsContent>

          {/* Tab: Mandat */}
          <TabsContent value="mandat" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mandat_debut">Début de mandat</Label>
                <Input
                  id="mandat_debut"
                  type="date"
                  value={mandatDebut}
                  onChange={e => setMandatDebut(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mandat_fin">Fin de mandat</Label>
                <Input
                  id="mandat_fin"
                  type="date"
                  value={mandatFin}
                  onChange={e => setMandatFin(e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Les dates de mandat sont indicatives et permettent de suivre les renouvellements.
            </p>

            {/* Toggle invitation — uniquement à la création (pas en édition) */}
            {!isEditing && (
              <div className="mt-6 pt-4 border-t">
                <div className="flex items-start gap-3 p-3 rounded-lg border bg-blue-50/50 border-blue-100">
                  <Checkbox
                    id="send_invitation"
                    checked={sendInvitation}
                    onCheckedChange={(v) => setSendInvitation(v === true)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="send_invitation" className="text-sm font-medium cursor-pointer">
                      Envoyer l&apos;invitation par email maintenant
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Le membre recevra un email pour activer son compte et choisir son mot de passe.
                      Décochez si vous voulez juste créer la fiche pour l&apos;instant — vous pourrez
                      envoyer l&apos;invitation plus tard depuis la liste.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Tab: Instances */}
          <TabsContent value="instances" className="space-y-4 mt-4">
            {instances.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Aucune instance configurée. Créez d&apos;abord des instances dans la page Configuration.
              </p>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Sélectionnez les instances dont ce membre fait partie.
                </p>
                {instanceAssignments.map((assignment) => {
                  const instance = instances.find(i => i.id === assignment.instanceId)
                  if (!instance) return null

                  return (
                    <div key={assignment.instanceId} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id={`instance-${assignment.instanceId}`}
                          checked={assignment.checked}
                          onCheckedChange={(checked) =>
                            toggleInstance(assignment.instanceId, checked === true)
                          }
                        />
                        <Label
                          htmlFor={`instance-${assignment.instanceId}`}
                          className="font-medium cursor-pointer"
                        >
                          {instance.nom}
                        </Label>
                      </div>
                      {assignment.checked && (
                        <>
                          <Separator />
                          <div className="space-y-1.5 pl-7">
                            <Label className="text-xs text-muted-foreground">
                              Fonction dans cette instance
                            </Label>
                            <RoleCombobox
                              value={assignment.fonction}
                              onChange={(v) => updateInstanceFonction(assignment.instanceId, v)}
                              options={FONCTIONS_INSTANCE}
                              placeholder="Choisir une fonction…"
                              searchPlaceholder="Rechercher (Membre, Président…)"
                              emptyLabel="Aucune (par défaut : Membre)"
                              noMatchLabel="Aucune fonction trouvée."
                              size="sm"
                            />
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}
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
            {isEditing ? 'Enregistrer' : 'Créer le membre'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Combobox de sélection de rôle (qualité officielle, fonction instance) ──
// Empêche la saisie libre pour garantir une cohérence des libellés sur le PV
// et le dossier de contrôle préfectoral. Permet de vider la valeur via une
// option dédiée (« Aucune »).

function RoleCombobox({
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
  emptyLabel,
  noMatchLabel,
  size = 'md',
}: {
  value: string
  onChange: (value: string) => void
  options: readonly string[]
  placeholder: string
  searchPlaceholder: string
  emptyLabel: string
  noMatchLabel: string
  size?: 'sm' | 'md'
}) {
  const [open, setOpen] = useState(false)
  const heightClass = size === 'sm' ? 'h-8 text-sm' : 'min-h-[40px]'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={`w-full justify-between font-normal ${heightClass}`}
        >
          {value ? (
            <span className="truncate">{value}</span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{noMatchLabel}</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value=""
                onSelect={() => { onChange(''); setOpen(false) }}
              >
                <Check className={`mr-2 h-4 w-4 ${!value ? 'opacity-100' : 'opacity-0'}`} />
                <span className="text-muted-foreground italic">{emptyLabel}</span>
              </CommandItem>
              {options.map((opt) => (
                <CommandItem
                  key={opt}
                  value={opt}
                  onSelect={() => { onChange(opt); setOpen(false) }}
                >
                  <Check className={`mr-2 h-4 w-4 ${value === opt ? 'opacity-100' : 'opacity-0'}`} />
                  <span>{opt}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

// ─── Uploader de photo de profil membre ─────────────────────────────────────
// Disponible uniquement après création (un memberId est nécessaire pour le
// chemin Storage). Les modifications sont appliquées immédiatement via les
// server actions uploadMemberPhoto / removeMemberPhoto.

function MemberPhotoUploader({
  memberId,
  currentUrl,
  memberInitials,
  onChange,
}: {
  memberId: string | null
  currentUrl: string | null
  memberInitials: string
  onChange: (url: string | null) => void
}) {
  const [isUploading, setIsUploading] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!memberId) {
      toast.error('Créez d\'abord le membre, puis ajoutez sa photo')
      e.target.value = ''
      return
    }
    setIsUploading(true)
    try {
      const fd = new FormData()
      fd.set('member_id', memberId)
      fd.set('file', file)
      const result = await uploadMemberPhoto(fd)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        onChange(result.url)
        toast.success('Photo mise à jour')
      }
    } catch {
      toast.error('Erreur lors de l\'upload')
    } finally {
      setIsUploading(false)
      e.target.value = ''
    }
  }

  async function handleRemove() {
    if (!memberId) return
    setIsRemoving(true)
    try {
      const result = await removeMemberPhoto(memberId)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        onChange(null)
        toast.success('Photo retirée')
      }
    } catch {
      toast.error('Erreur lors de la suppression')
    } finally {
      setIsRemoving(false)
    }
  }

  return (
    <div className="flex items-center gap-4 p-4 rounded-lg border bg-muted/30">
      <div
        className="h-20 w-20 rounded-full bg-muted overflow-hidden border-2 border-background shadow-sm flex items-center justify-center text-xl font-semibold text-muted-foreground shrink-0"
        title={currentUrl ? 'Photo de profil' : 'Pas de photo'}
      >
        {currentUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={currentUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span>{memberInitials}</span>
        )}
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        <p className="text-sm font-medium">Photo de profil</p>
        <p className="text-xs text-muted-foreground">
          {memberId
            ? 'Format PNG, JPEG ou WebP — 5 Mo max. Visible dans le trombinoscope.'
            : 'Disponible après création du membre.'}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <label
            className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border cursor-pointer transition-colors ${
              memberId && !isUploading
                ? 'bg-background hover:bg-muted'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            }`}
          >
            {isUploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <User className="h-3.5 w-3.5" />
            )}
            {isUploading ? 'Upload…' : currentUrl ? 'Changer la photo' : 'Téléverser une photo'}
            <input
              type="file"
              className="hidden"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileChange}
              disabled={!memberId || isUploading}
            />
          </label>
          {currentUrl && memberId && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleRemove}
              disabled={isRemoving}
              className="h-7 px-2 text-xs text-destructive hover:text-destructive"
            >
              {isRemoving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Retirer'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
