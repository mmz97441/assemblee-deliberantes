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
import { createMember, updateMember, assignMemberToInstances } from '@/lib/actions/members'
import type { MemberWithInstances } from '@/lib/actions/members'
import type { InstanceConfigRow, UserRole } from '@/lib/supabase/types'
import { User, Briefcase, CalendarDays, Building2, Loader2 } from 'lucide-react'

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'super_admin', label: 'Super-administrateur' },
  { value: 'president', label: 'President(e)' },
  { value: 'gestionnaire', label: 'Gestionnaire' },
  { value: 'secretaire_seance', label: 'Secretaire de seance' },
  { value: 'elu', label: 'Elu(e)' },
  { value: 'preparateur', label: 'Preparateur' },
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
  const [prenom, setPrenom] = useState(member?.prenom || '')
  const [nom, setNom] = useState(member?.nom || '')
  const [email, setEmail] = useState(member?.email || '')
  const [telephone, setTelephone] = useState(member?.telephone || '')
  const [role, setRole] = useState<UserRole>(member?.role || 'elu')
  const [qualiteOfficielle, setQualiteOfficielle] = useState(member?.qualite_officielle || '')
  const [groupePolitique, setGroupePolitique] = useState(member?.groupe_politique || '')
  const [mandatDebut, setMandatDebut] = useState(member?.mandat_debut || '')
  const [mandatFin, setMandatFin] = useState(member?.mandat_fin || '')

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

  // Reset form when member changes
  // We handle this by using key prop on Dialog or re-initializing
  // Since Dialog re-renders, state is managed via useState defaults above
  // We need to sync when `open` changes with a new member
  // Using a simple approach: reset state when dialog opens
  const [lastMemberId, setLastMemberId] = useState<string | null>(member?.id || null)
  if ((member?.id || null) !== lastMemberId) {
    setLastMemberId(member?.id || null)
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

  function handleSubmit() {
    // Basic validation
    if (!prenom.trim()) { toast.error('Le prenom est requis'); return }
    if (!nom.trim()) { toast.error('Le nom est requis'); return }
    if (!email.trim()) { toast.error('L\'email est requis'); return }

    startTransition(async () => {
      const formData = new FormData()
      if (member?.id) formData.set('id', member.id)
      formData.set('prenom', prenom.trim())
      formData.set('nom', nom.trim())
      formData.set('email', email.trim())
      formData.set('telephone', telephone.trim())
      formData.set('role', role)
      formData.set('qualite_officielle', qualiteOfficielle.trim())
      formData.set('groupe_politique', groupePolitique.trim())
      formData.set('mandat_debut', mandatDebut)
      formData.set('mandat_fin', mandatFin)

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
      if (isEditing && member?.id) {
        const assignments = selectedInstances.map(a => ({
          instanceId: a.instanceId,
          fonction: a.fonction || null,
        }))
        const assignResult = await assignMemberToInstances(member.id, assignments)
        if ('error' in assignResult) {
          toast.error(assignResult.error)
          // Member was saved but instances failed - still close
        }
      }

      toast.success(isEditing ? 'Membre mis a jour' : 'Membre cree avec succes')
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
          <TabsList className="grid w-full grid-cols-4 h-10">
            <TabsTrigger value="identite" className="gap-1.5 text-xs">
              <User className="h-3.5 w-3.5" />
              Identite
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="prenom">Prenom *</Label>
                <Input
                  id="prenom"
                  value={prenom}
                  onChange={e => setPrenom(e.target.value)}
                  placeholder="Jean"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nom">Nom *</Label>
                <Input
                  id="nom"
                  value={nom}
                  onChange={e => setNom(e.target.value)}
                  placeholder="Dupont"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Adresse email *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="jean.dupont@mairie.fr"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telephone">Telephone</Label>
              <Input
                id="telephone"
                type="tel"
                value={telephone}
                onChange={e => setTelephone(e.target.value)}
                placeholder="06 12 34 56 78"
              />
            </div>
          </TabsContent>

          {/* Tab: Fonction */}
          <TabsContent value="fonction" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="role">Role dans l&apos;application *</Label>
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
              <Label htmlFor="qualite_officielle">Qualite officielle</Label>
              <Input
                id="qualite_officielle"
                value={qualiteOfficielle}
                onChange={e => setQualiteOfficielle(e.target.value)}
                placeholder="Adjoint au maire, Vice-president..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="groupe_politique">Groupe politique</Label>
              <Input
                id="groupe_politique"
                value={groupePolitique}
                onChange={e => setGroupePolitique(e.target.value)}
                placeholder="Majorite, Opposition..."
              />
            </div>
          </TabsContent>

          {/* Tab: Mandat */}
          <TabsContent value="mandat" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mandat_debut">Debut de mandat</Label>
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
          </TabsContent>

          {/* Tab: Instances */}
          <TabsContent value="instances" className="space-y-4 mt-4">
            {instances.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Aucune instance configuree. Creez d&apos;abord des instances dans la page Configuration.
              </p>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Selectionnez les instances dont ce membre fait partie.
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
                            <Label
                              htmlFor={`fonction-${assignment.instanceId}`}
                              className="text-xs text-muted-foreground"
                            >
                              Fonction dans cette instance
                            </Label>
                            <Input
                              id={`fonction-${assignment.instanceId}`}
                              value={assignment.fonction}
                              onChange={e => updateInstanceFonction(assignment.instanceId, e.target.value)}
                              placeholder="Membre, President, Rapporteur..."
                              className="h-8 text-sm"
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
            {isEditing ? 'Enregistrer' : 'Creer le membre'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
