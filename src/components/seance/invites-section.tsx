'use client'

import { useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Mail, Plus, Trash2, RefreshCw, CheckCircle2, XCircle, AlertTriangle, Loader2, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  createInvite,
  updateInvite,
  deleteInvite,
  resendInvitationEmail,
  sendInvitationsEmails,
  listInvitesForSeance,
  type InviteListItem,
} from '@/lib/actions/invites'

interface Props {
  seanceId: string
  seanceStatut: string
  canEdit: boolean
}

type Civilite = 'MADAME' | 'MONSIEUR' | 'AUTRE' | ''

interface FormState {
  prenom: string
  nom: string
  email: string
  civilite: Civilite
  qualite: string
  organisation: string
}

const EMPTY_FORM: FormState = {
  prenom: '',
  nom: '',
  email: '',
  civilite: '',
  qualite: '',
  organisation: '',
}

function statutVisuel(s: string): { label: string; className: string; help: string } {
  switch (s) {
    case 'NON_ENVOYE':
      return { label: 'Non envoyé', className: 'bg-slate-100 text-slate-700', help: 'L\'invitation n\'a pas encore été envoyée par email.' }
    case 'ENVOYE':
      return { label: 'Envoyé', className: 'bg-blue-100 text-blue-700', help: 'L\'invitation a été envoyée. En attente de réponse.' }
    case 'LU':
      return { label: 'Lu', className: 'bg-indigo-100 text-indigo-700', help: 'L\'invité a ouvert l\'email.' }
    case 'CONFIRME':
      return { label: 'Confirmé', className: 'bg-emerald-100 text-emerald-700', help: 'L\'invité a confirmé sa présence.' }
    case 'DECLINE':
      return { label: 'Décliné', className: 'bg-amber-100 text-amber-700', help: 'L\'invité ne pourra pas être présent.' }
    case 'ERREUR_EMAIL':
      return { label: 'Erreur', className: 'bg-red-100 text-red-700', help: 'L\'email n\'a pas pu être envoyé. Vérifiez l\'adresse.' }
    default:
      return { label: s, className: 'bg-slate-100 text-slate-700', help: '' }
  }
}

export function InvitesSection({ seanceId, seanceStatut, canEdit }: Props) {
  const [invites, setInvites] = useState<InviteListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)

  const isArchivee = seanceStatut === 'ARCHIVEE'
  const canMutate = canEdit && !isArchivee

  async function refresh() {
    const res = await listInvitesForSeance(seanceId)
    if ('error' in res) {
      toast.error(res.error)
      return
    }
    setInvites(res.data)
  }

  useEffect(() => {
    setLoading(true)
    refresh().finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seanceId])

  function resetForm() {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setFormError(null)
  }

  function openCreate() {
    resetForm()
    setDialogOpen(true)
  }

  function openEdit(invite: InviteListItem) {
    setForm({
      prenom: invite.prenom,
      nom: invite.nom,
      email: invite.email,
      civilite: (invite.civilite as Civilite) || '',
      qualite: invite.qualite ?? '',
      organisation: invite.organisation ?? '',
    })
    setEditingId(invite.id)
    setFormError(null)
    setDialogOpen(true)
  }

  function submitForm() {
    setFormError(null)
    if (!form.prenom.trim()) { setFormError('Le prénom est requis'); return }
    if (!form.nom.trim()) { setFormError('Le nom est requis'); return }
    if (!form.email.trim()) { setFormError('L\'adresse email est requise'); return }

    startTransition(async () => {
      const payload = {
        prenom: form.prenom,
        nom: form.nom,
        email: form.email,
        civilite: form.civilite || null,
        qualite: form.qualite || null,
        organisation: form.organisation || null,
      }
      const res = editingId
        ? await updateInvite(editingId, payload)
        : await createInvite({ seanceId, ...payload })

      if ('error' in res) {
        setFormError(res.error)
        return
      }
      toast.success(editingId ? 'Invité modifié' : 'Invité ajouté')
      setDialogOpen(false)
      resetForm()
      refresh()
    })
  }

  function handleDelete(invite: InviteListItem) {
    startTransition(async () => {
      const res = await deleteInvite(invite.id)
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      toast.success(`${invite.prenom} ${invite.nom} a été retiré de la liste`)
      refresh()
    })
  }

  function handleResend(invite: InviteListItem) {
    startTransition(async () => {
      const res = await resendInvitationEmail(invite.id)
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      toast.success(`Invitation renvoyée à ${invite.prenom} ${invite.nom}`)
      refresh()
    })
  }

  function handleSendAll() {
    startTransition(async () => {
      const res = await sendInvitationsEmails(seanceId)
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      if (res.total === 0) {
        toast.info('Aucune invitation à envoyer (toutes déjà envoyées).')
      } else if (res.errors.length === 0) {
        toast.success(`${res.sent} invitation${res.sent > 1 ? 's' : ''} envoyée${res.sent > 1 ? 's' : ''}`)
      } else {
        toast.warning(`${res.sent}/${res.total} invitations envoyées. ${res.errors.length} en erreur.`)
      }
      refresh()
    })
  }

  const nonEnvoyes = invites.filter(i => i.statut_invitation === 'NON_ENVOYE')

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-base font-semibold flex items-center gap-2">
              <Mail className="h-4 w-4 text-slate-500" />
              Invités externes
              <Badge variant="secondary" className="text-[10px] font-normal">{invites.length}</Badge>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Personnes non-membres invitées à assister à la séance (sans droit de vote).
            </p>
          </div>

          {canMutate && (
            <div className="flex items-center gap-2">
              {nonEnvoyes.length > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSendAll}
                      disabled={isPending}
                    >
                      {isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Mail className="h-4 w-4 mr-1.5" />}
                      Envoyer toutes les invitations ({nonEnvoyes.length})
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Envoyer les emails d&apos;invitation aux destinataires non encore notifiés.</TooltipContent>
                </Tooltip>
              )}

              <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm() }}>
                <DialogTrigger asChild>
                  <Button size="sm" onClick={openCreate}>
                    <Plus className="h-4 w-4 mr-1.5" />
                    Ajouter un invité
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>{editingId ? 'Modifier l\'invité' : 'Ajouter un invité'}</DialogTitle>
                    <DialogDescription>
                      Personne externe à l&apos;institution, invitée à assister à la séance sans droit de vote.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-3 py-2">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <Label htmlFor="civilite" className="text-xs">Civilité</Label>
                        <Select value={form.civilite || '_none'} onValueChange={(v) => setForm({ ...form, civilite: v === '_none' ? '' : v as Civilite })}>
                          <SelectTrigger id="civilite" className="h-9">
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">Non précisée</SelectItem>
                            <SelectItem value="MADAME">Madame</SelectItem>
                            <SelectItem value="MONSIEUR">Monsieur</SelectItem>
                            <SelectItem value="AUTRE">Autre</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="sm:col-span-2">
                        <Label htmlFor="prenom" className="text-xs">Prénom *</Label>
                        <Input id="prenom" value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} className="h-9" />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="nom" className="text-xs">Nom *</Label>
                      <Input id="nom" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} className="h-9" />
                    </div>

                    <div>
                      <Label htmlFor="email" className="text-xs">Adresse email *</Label>
                      <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-9" />
                    </div>

                    <div>
                      <Label htmlFor="qualite" className="text-xs">Qualité</Label>
                      <Input
                        id="qualite"
                        value={form.qualite}
                        onChange={(e) => setForm({ ...form, qualite: e.target.value })}
                        placeholder="Ex : Directeur des services techniques"
                        className="h-9"
                      />
                    </div>

                    <div>
                      <Label htmlFor="organisation" className="text-xs">Organisation</Label>
                      <Input
                        id="organisation"
                        value={form.organisation}
                        onChange={(e) => setForm({ ...form, organisation: e.target.value })}
                        placeholder="Ex : Communauté de communes du Var"
                        className="h-9"
                      />
                    </div>

                    {formError && (
                      <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-800">
                        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        <span>{formError}</span>
                      </div>
                    )}
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm() }} disabled={isPending}>
                      Annuler
                    </Button>
                    <Button onClick={submitForm} disabled={isPending}>
                      {isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
                      {editingId ? 'Enregistrer' : 'Ajouter'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : invites.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-slate-200 px-6 py-10 text-center">
            <Mail className="h-8 w-8 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-medium text-slate-700">Aucun invité</p>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              Vous pouvez inviter des personnes externes à l&apos;institution (DGS, experts, représentants...).
            </p>
            {canMutate && (
              <Button size="sm" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-1.5" />
                Ajouter le premier invité
              </Button>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 bg-white">
            {invites.map((invite) => {
              const visuel = statutVisuel(invite.statut_invitation)
              const civiliteLabel = invite.civilite === 'MADAME' ? 'Madame' : invite.civilite === 'MONSIEUR' ? 'Monsieur' : ''
              return (
                <div key={invite.id} className="flex items-start gap-3 px-4 py-3 flex-wrap sm:flex-nowrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-slate-900">
                        {civiliteLabel} {invite.prenom} {invite.nom}
                      </span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>
                            <Badge variant="secondary" className={`text-[10px] font-normal ${visuel.className}`}>
                              {visuel.label}
                            </Badge>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>{visuel.help}</TooltipContent>
                      </Tooltip>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{invite.email}</p>
                    {(invite.qualite || invite.organisation) && (
                      <p className="text-xs text-slate-500 italic mt-0.5">
                        {[invite.qualite, invite.organisation].filter(Boolean).join(' — ')}
                      </p>
                    )}
                    {invite.statut_invitation === 'ERREUR_EMAIL' && invite.erreur_detail && (
                      <p className="text-xs text-red-700 mt-1">{invite.erreur_detail}</p>
                    )}
                  </div>

                  {canMutate && (
                    <div className="flex items-center gap-1 shrink-0">
                      {invite.statut_invitation !== 'NON_ENVOYE' && invite.statut_invitation !== 'DECLINE' && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleResend(invite)}
                              disabled={isPending}
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Renvoyer l&apos;invitation</TooltipContent>
                        </Tooltip>
                      )}
                      {invite.statut_invitation === 'NON_ENVOYE' && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleResend(invite)}
                              disabled={isPending}
                            >
                              <Mail className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Envoyer l&apos;invitation</TooltipContent>
                        </Tooltip>
                      )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="sm" onClick={() => openEdit(invite)} disabled={isPending}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Modifier</TooltipContent>
                      </Tooltip>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" disabled={isPending}>
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Retirer cet invité ?</AlertDialogTitle>
                            <AlertDialogDescription>
                              <strong>{invite.prenom} {invite.nom}</strong> sera retiré de la liste des invités.
                              {(invite.statut_invitation === 'ENVOYE' || invite.statut_invitation === 'LU' || invite.statut_invitation === 'CONFIRME') && (
                                <> Il ne pourra plus confirmer sa présence via le lien reçu par email.</>
                              )}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(invite)} className="bg-red-600 hover:bg-red-700">
                              Retirer
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}

                  {/* Indicateurs visuels confirmation/décline pour les non-gérants */}
                  {!canMutate && (
                    <div className="shrink-0">
                      {invite.statut_invitation === 'CONFIRME' && <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
                      {invite.statut_invitation === 'DECLINE' && <XCircle className="h-5 w-5 text-amber-600" />}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {isArchivee && (
          <p className="text-xs text-slate-500 italic">
            La séance est archivée — la liste des invités est consultable mais ne peut plus être modifiée.
          </p>
        )}
      </div>
    </TooltipProvider>
  )
}
