'use client'

/**
 * Liste + gestion des invités externes (préfet, trésorier-payeur,
 * journaliste, partenaire associatif…).
 *
 * UX volontairement légère par rapport à la liste membres : pas de filtres
 * sophistiqués, pas d'instances à gérer, pas de photo. Juste l'essentiel
 * pour pouvoir convoquer rapidement quelqu'un d'extérieur à la collectivité.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  createExternalInvitee,
  updateExternalInvitee,
  archiveExternalInvitee,
  unarchiveExternalInvitee,
} from '@/lib/actions/external-invitees'
import type { ExternalInviteeRow } from '@/lib/supabase/types'
import { CIVILITE_LABELS, type Civilite } from '@/lib/protocole/appellation'
import { Plus, Pencil, Archive, ArchiveRestore, Loader2, UserCircle, Building2 } from 'lucide-react'

interface Props {
  invitees: ExternalInviteeRow[]
  canManage: boolean
}

export function ExternalInviteesList({ invitees, canManage }: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'actifs' | 'archives'>('actifs')
  const [search, setSearch] = useState('')
  const [editTarget, setEditTarget] = useState<ExternalInviteeRow | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [archiveTarget, setArchiveTarget] = useState<ExternalInviteeRow | null>(null)
  const [isPending, startTransition] = useTransition()

  const actifs = invitees.filter(i => !i.archived_at)
  const archives = invitees.filter(i => i.archived_at)
  const sourceList = activeTab === 'actifs' ? actifs : archives
  const filtered = sourceList.filter(i => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      i.nom.toLowerCase().includes(q) ||
      i.prenom.toLowerCase().includes(q) ||
      i.email.toLowerCase().includes(q) ||
      (i.organisation?.toLowerCase() || '').includes(q) ||
      (i.qualite_officielle?.toLowerCase() || '').includes(q)
    )
  })

  function handleArchive() {
    if (!archiveTarget) return
    startTransition(async () => {
      const result = await archiveExternalInvitee(archiveTarget.id)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success('Invité externe archivé')
        router.refresh()
      }
      setArchiveTarget(null)
    })
  }

  function handleUnarchive(id: string) {
    startTransition(async () => {
      const result = await unarchiveExternalInvitee(id)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success('Invité restauré')
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'actifs' | 'archives')}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <TabsList>
            <TabsTrigger value="actifs" className="min-h-[40px]">
              Actifs ({actifs.length})
            </TabsTrigger>
            <TabsTrigger value="archives" className="min-h-[40px]">
              <Archive className="h-3.5 w-3.5 mr-1.5" />
              Archives ({archives.length})
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2 flex-1 justify-end">
            <Input
              placeholder="Rechercher (nom, organisation…)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            {canManage && (
              <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
                <Plus className="h-4 w-4" />
                Ajouter un invité
              </Button>
            )}
          </div>
        </div>

        <TabsContent value="actifs" className="mt-4" />
        <TabsContent value="archives" className="mt-4" />
      </Tabs>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <UserCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {activeTab === 'actifs'
              ? 'Aucun invité externe enregistré.'
              : 'Aucun invité archivé.'}
          </p>
          {activeTab === 'actifs' && canManage && (
            <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              Ajouter le premier
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Identité</TableHead>
                <TableHead>Organisation</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-right" aria-label="Actions" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">
                        {CIVILITE_LABELS[inv.civilite]} {inv.prenom} {inv.nom}
                      </span>
                      {inv.qualite_officielle && (
                        <span className="text-xs text-muted-foreground">{inv.qualite_officielle}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {inv.organisation ? (
                      <span className="text-sm flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        {inv.organisation}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{inv.email}</span>
                    {inv.telephone && (
                      <span className="text-xs text-muted-foreground block">{inv.telephone}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {canManage && (
                      <div className="flex items-center justify-end gap-1">
                        {activeTab === 'actifs' ? (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditTarget(inv)}
                              title="Modifier"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setArchiveTarget(inv)}
                              title="Archiver"
                            >
                              <Archive className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleUnarchive(inv.id)}
                            disabled={isPending}
                            title="Désarchiver"
                          >
                            <ArchiveRestore className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Formulaire création */}
      <ExternalInviteeFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        invitee={null}
      />

      {/* Formulaire édition */}
      <ExternalInviteeFormDialog
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        invitee={editTarget}
      />

      {/* Confirmation archivage */}
      <AlertDialog open={!!archiveTarget} onOpenChange={(open) => { if (!open) setArchiveTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archiver cet invité ?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{archiveTarget?.prenom} {archiveTarget?.nom}</strong> ne pourra plus
              être ajouté(e) comme convocataire de nouvelles séances. Les convocations
              déjà envoyées restent valides. Réversible à tout moment depuis l&apos;onglet Archives.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive} disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Archiver
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bandeau info juridique */}
      <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 text-xs text-blue-900 mt-6">
        <p className="font-medium mb-1">À propos des invités externes</p>
        <p>
          Personnes extérieures à la collectivité (préfet, trésorier-payeur, journaliste,
          représentant d&apos;association…). Elles reçoivent une convocation officielle et
          peuvent émarger leur présence, mais <strong>n&apos;entrent pas dans le calcul du quorum</strong> et
          <strong> ne peuvent pas voter</strong>.
        </p>
      </div>
    </div>
  )
}

// ─── Formulaire de création/édition ─────────────────────────────────────────

function ExternalInviteeFormDialog({
  open,
  onClose,
  invitee,
}: {
  open: boolean
  onClose: () => void
  invitee: ExternalInviteeRow | null
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const isEditing = !!invitee

  const [civilite, setCivilite] = useState<Civilite | ''>(invitee?.civilite || '')
  const [prenom, setPrenom] = useState(invitee?.prenom || '')
  const [nom, setNom] = useState(invitee?.nom || '')
  const [email, setEmail] = useState(invitee?.email || '')
  const [organisation, setOrganisation] = useState(invitee?.organisation || '')
  const [qualite, setQualite] = useState(invitee?.qualite_officielle || '')
  const [telephone, setTelephone] = useState(invitee?.telephone || '')
  const [notes, setNotes] = useState(invitee?.notes || '')

  // Reset on open/target change
  const resetKey = `${invitee?.id || 'new'}-${open}`
  const [lastResetKey, setLastResetKey] = useState(resetKey)
  if (resetKey !== lastResetKey) {
    setLastResetKey(resetKey)
    setCivilite(invitee?.civilite || '')
    setPrenom(invitee?.prenom || '')
    setNom(invitee?.nom || '')
    setEmail(invitee?.email || '')
    setOrganisation(invitee?.organisation || '')
    setQualite(invitee?.qualite_officielle || '')
    setTelephone(invitee?.telephone || '')
    setNotes(invitee?.notes || '')
  }

  function handleSubmit() {
    if (!civilite) { toast.error('La civilité est requise'); return }
    if (!prenom.trim()) { toast.error('Le prénom est requis'); return }
    if (!nom.trim()) { toast.error('Le nom est requis'); return }
    if (!email.trim()) { toast.error('L\'email est requis'); return }

    startTransition(async () => {
      const formData = new FormData()
      if (invitee?.id) formData.set('id', invitee.id)
      formData.set('civilite', civilite)
      formData.set('prenom', prenom.trim())
      formData.set('nom', nom.trim())
      formData.set('email', email.trim())
      formData.set('organisation', organisation.trim())
      formData.set('qualite_officielle', qualite.trim())
      formData.set('telephone', telephone.trim())
      formData.set('notes', notes.trim())

      const result = isEditing
        ? await updateExternalInvitee(formData)
        : await createExternalInvitee(formData)

      if ('error' in result) {
        toast.error(result.error)
        return
      }

      toast.success(isEditing ? 'Invité mis à jour' : 'Invité externe créé')
      router.refresh()
      onClose()
    })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Modifier l\'invité' : 'Nouvel invité externe'}</DialogTitle>
          <DialogDescription>
            Personne extérieure à la collectivité — préfet, trésorier-payeur, journaliste,
            partenaire associatif, etc.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="ext-civilite">Civilité *</Label>
            <Select value={civilite} onValueChange={(v) => setCivilite(v as Civilite)}>
              <SelectTrigger id="ext-civilite">
                <SelectValue placeholder="Sélectionner…" />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(CIVILITE_LABELS) as [Civilite, string][]).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ext-prenom">Prénom *</Label>
              <Input id="ext-prenom" value={prenom} onChange={(e) => setPrenom(e.target.value)} placeholder="Jean" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ext-nom">Nom *</Label>
              <Input id="ext-nom" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Dupont" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ext-email">Email *</Label>
            <Input id="ext-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jean.dupont@prefecture.gouv.fr" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ext-organisation">Organisation</Label>
            <Input id="ext-organisation" value={organisation} onChange={(e) => setOrganisation(e.target.value)} placeholder="Préfecture de la Réunion" />
            <p className="text-xs text-muted-foreground">
              Affichée dans les listes pour identifier rapidement l&apos;invité.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ext-qualite">Qualité officielle</Label>
            <Input id="ext-qualite" value={qualite} onChange={(e) => setQualite(e.target.value)} placeholder="Préfet, Trésorier-payeur, Journaliste…" />
            <p className="text-xs text-muted-foreground">
              Sert à composer l&apos;appellation protocolaire dans la convocation (ex : « Monsieur le Préfet »).
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ext-tel">Téléphone</Label>
            <Input id="ext-tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="+33 …" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ext-notes">Notes</Label>
            <Textarea id="ext-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Contexte d'invitation, commentaires…" />
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose} disabled={isPending}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEditing ? 'Enregistrer' : 'Créer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

