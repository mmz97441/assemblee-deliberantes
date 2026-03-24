'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { MemberFormDialog } from './member-form'
import { MemberImportDialog } from './member-import'
import { toggleMemberStatus, sendMemberInvitation } from '@/lib/actions/members'
import type { MemberWithInstances } from '@/lib/actions/members'
import type { InstanceConfigRow, UserRole, MemberStatut } from '@/lib/supabase/types'
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Mail,
  UserX,
  UserCheck,
  Users,
  FileSpreadsheet,
} from 'lucide-react'

// --- Labels & colors ---

const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super-administrateur',
  president: 'Président(e)',
  gestionnaire: 'Gestionnaire',
  secretaire_seance: 'Secrétaire de séance',
  elu: 'Élu(e)',
  preparateur: 'Préparateur',
}

const ROLE_COLORS: Record<UserRole, string> = {
  super_admin: 'bg-red-100 text-red-800 border-red-200',
  president: 'bg-purple-100 text-purple-800 border-purple-200',
  gestionnaire: 'bg-blue-100 text-blue-800 border-blue-200',
  secretaire_seance: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  elu: 'bg-slate-100 text-slate-800 border-slate-200',
  preparateur: 'bg-orange-100 text-orange-800 border-orange-200',
}

const STATUT_LABELS: Record<MemberStatut, string> = {
  ACTIF: 'Actif',
  SUSPENDU: 'Suspendu',
  FIN_DE_MANDAT: 'Fin de mandat',
  DECEDE: 'Décédé',
}

const STATUT_COLORS: Record<MemberStatut, string> = {
  ACTIF: 'bg-green-100 text-green-800 border-green-200',
  SUSPENDU: 'bg-amber-100 text-amber-800 border-amber-200',
  FIN_DE_MANDAT: 'bg-gray-100 text-gray-600 border-gray-200',
  DECEDE: 'bg-red-100 text-red-800 border-red-200',
}

const ALL_ROLES: UserRole[] = ['super_admin', 'president', 'gestionnaire', 'secretaire_seance', 'elu', 'preparateur']
const ALL_STATUTS: MemberStatut[] = ['ACTIF', 'SUSPENDU', 'FIN_DE_MANDAT', 'DECEDE']

// --- Component ---

interface MembersListProps {
  members: MemberWithInstances[]
  instances: InstanceConfigRow[]
  canManage: boolean
}

export function MembersList({ members, instances, canManage }: MembersListProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [statutFilter, setStatutFilter] = useState<string>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<MemberWithInstances | null>(null)
  const [statusChangeConfirm, setStatusChangeConfirm] = useState<{
    memberId: string
    newStatut: MemberStatut
    memberName: string
  } | null>(null)
  const [invitationConfirm, setInvitationConfirm] = useState<{
    memberId: string
    memberName: string
    memberEmail: string
  } | null>(null)

  const filteredMembers = useMemo(() => {
    return members.filter(m => {
      // Search filter
      if (search) {
        const q = search.toLowerCase()
        const fullName = `${m.prenom} ${m.nom}`.toLowerCase()
        const emailLower = m.email.toLowerCase()
        if (!fullName.includes(q) && !emailLower.includes(q)) return false
      }
      // Role filter
      if (roleFilter !== 'all' && m.role !== roleFilter) return false
      // Statut filter
      if (statutFilter !== 'all' && m.statut !== statutFilter) return false
      return true
    })
  }, [members, search, roleFilter, statutFilter])

  function handleCreate() {
    setEditingMember(null)
    setDialogOpen(true)
  }

  function handleEdit(member: MemberWithInstances) {
    setEditingMember(member)
    setDialogOpen(true)
  }

  function handleDialogClose() {
    setDialogOpen(false)
    setEditingMember(null)
  }

  function handleToggleStatus(memberId: string, newStatut: MemberStatut) {
    // Require confirmation for destructive status changes
    if (newStatut === 'SUSPENDU' || newStatut === 'FIN_DE_MANDAT' || newStatut === 'DECEDE') {
      const member = members.find(m => m.id === memberId)
      setStatusChangeConfirm({
        memberId,
        newStatut,
        memberName: member ? `${member.prenom} ${member.nom}` : 'ce membre',
      })
      return
    }
    executeStatusChange(memberId, newStatut)
  }

  function executeStatusChange(memberId: string, newStatut: MemberStatut) {
    startTransition(async () => {
      const result = await toggleMemberStatus(memberId, newStatut)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success(`Statut mis à jour : ${STATUT_LABELS[newStatut]}`)
        router.refresh()
      }
    })
  }

  function handleSendInvitation(memberId: string) {
    const member = members.find(m => m.id === memberId)
    if (member) {
      setInvitationConfirm({
        memberId,
        memberName: `${member.prenom} ${member.nom}`,
        memberEmail: member.email,
      })
    }
  }

  function executeSendInvitation(memberId: string) {
    startTransition(async () => {
      const result = await sendMemberInvitation(memberId)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success('Invitation créée avec succès')
        router.refresh()
      }
    })
  }

  function getInitials(prenom: string, nom: string): string {
    return `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase()
  }

  return (
    <div className="space-y-6">
      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Tous les rôles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les rôles</SelectItem>
            {ALL_ROLES.map(role => (
              <SelectItem key={role} value={role}>{ROLE_LABELS[role]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statutFilter} onValueChange={setStatutFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Tous les statuts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {ALL_STATUTS.map(s => (
              <SelectItem key={s} value={s}>{STATUT_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {canManage && (
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)} className="gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Importer CSV
            </Button>
            <Button onClick={handleCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              Ajouter un membre
            </Button>
          </div>
        )}
      </div>

      {/* Count */}
      <p className="text-sm text-muted-foreground">
        {filteredMembers.length} membre{filteredMembers.length !== 1 ? 's' : ''}
        {filteredMembers.length !== members.length && ` sur ${members.length}`}
      </p>

      {/* Table or empty state */}
      {filteredMembers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
            <Users className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">Aucun membre</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            {members.length === 0
              ? "Ajoutez vos premiers membres ou importez-les depuis un fichier CSV pour commencer."
              : "Aucun membre ne correspond aux filtres sélectionnés. Essayez de modifier vos critères de recherche."}
          </p>
          {canManage && members.length === 0 && (
            <div className="flex items-center gap-3 mt-4">
              <Button onClick={handleCreate} className="gap-2">
                <Plus className="h-4 w-4" />
                Ajouter un membre
              </Button>
              <Button variant="outline" onClick={() => setImportOpen(true)} className="gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                Importer CSV
              </Button>
            </div>
          )}
          {members.length > 0 && (
            <Button variant="outline" className="mt-4" onClick={() => { setSearch(''); setRoleFilter('all'); setStatutFilter('all') }}>
              Réinitialiser les filtres
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[280px]">Membre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Instances</TableHead>
                {canManage && <TableHead className="w-[50px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMembers.map((member) => {
                const statut = member.statut || 'ACTIF'
                const activeInstances = member.instance_members?.filter(im => im.actif !== false) || []

                return (
                  <TableRow
                    key={member.id}
                    className={canManage ? 'cursor-pointer hover:bg-muted/50 row-hover' : 'row-hover'}
                    onClick={canManage ? () => handleEdit(member) : undefined}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                          {getInitials(member.prenom, member.nom)}
                        </div>
                        <div>
                          <p className="font-medium">{member.prenom} {member.nom}</p>
                          {member.qualite_officielle && (
                            <p className="text-xs text-muted-foreground">{member.qualite_officielle}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {member.email}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={ROLE_COLORS[member.role]}>
                        {ROLE_LABELS[member.role]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUT_COLORS[statut]}>
                        {STATUT_LABELS[statut]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {activeInstances.length > 0 ? (
                          activeInstances.map(im => (
                            <Badge key={im.id} variant="secondary" className="text-xs">
                              {im.instance_config?.nom || 'Instance'}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">Aucune</span>
                        )}
                      </div>
                    </TableCell>
                    {canManage && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-11 w-11" disabled={isPending} title="Plus d'options">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(member)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Modifier
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleSendInvitation(member.id)}>
                              <Mail className="h-4 w-4 mr-2" />
                              Envoyer une invitation
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {statut === 'ACTIF' ? (
                              <DropdownMenuItem onClick={() => handleToggleStatus(member.id, 'SUSPENDU')}>
                                <UserX className="h-4 w-4 mr-2" />
                                Suspendre
                              </DropdownMenuItem>
                            ) : statut === 'SUSPENDU' ? (
                              <DropdownMenuItem onClick={() => handleToggleStatus(member.id, 'ACTIF')}>
                                <UserCheck className="h-4 w-4 mr-2" />
                                Réactiver
                              </DropdownMenuItem>
                            ) : null}
                            <DropdownMenuItem onClick={() => handleToggleStatus(member.id, 'FIN_DE_MANDAT')}>
                              <UserX className="h-4 w-4 mr-2" />
                              Fin de mandat
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Form dialog */}
      <MemberFormDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        member={editingMember}
        instances={instances}
      />

      {/* Import dialog */}
      {canManage && (
        <MemberImportDialog
          open={importOpen}
          onClose={() => setImportOpen(false)}
        />
      )}

      {/* Status change confirmation dialog */}
      <AlertDialog open={!!statusChangeConfirm} onOpenChange={(open) => { if (!open) setStatusChangeConfirm(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer le changement de statut</AlertDialogTitle>
            <AlertDialogDescription>
              {statusChangeConfirm && (
                <>
                  Vous allez passer <strong>{statusChangeConfirm.memberName}</strong> au statut{' '}
                  <strong>{STATUT_LABELS[statusChangeConfirm.newStatut]}</strong>.
                  {statusChangeConfirm.newStatut === 'SUSPENDU' && (
                    <> Ce membre ne pourra plus participer aux séances tant qu&apos;il ne sera pas réactivé.</>
                  )}
                  {statusChangeConfirm.newStatut === 'FIN_DE_MANDAT' && (
                    <> Ce membre sera retiré des futures convocations.</>
                  )}
                  {statusChangeConfirm.newStatut === 'DECEDE' && (
                    <> Ce membre sera définitivement retiré de toutes les instances.</>
                  )}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (statusChangeConfirm) {
                  executeStatusChange(statusChangeConfirm.memberId, statusChangeConfirm.newStatut)
                  setStatusChangeConfirm(null)
                }
              }}
              className={
                statusChangeConfirm?.newStatut === 'DECEDE'
                  ? 'bg-red-600 hover:bg-red-700'
                  : statusChangeConfirm?.newStatut === 'FIN_DE_MANDAT'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : ''
              }
            >
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Invitation confirmation dialog */}
      <AlertDialog open={!!invitationConfirm} onOpenChange={(open) => { if (!open) setInvitationConfirm(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Envoyer une invitation</AlertDialogTitle>
            <AlertDialogDescription>
              {invitationConfirm && (
                <>
                  Envoyer une invitation à <strong>{invitationConfirm.memberName}</strong> ({invitationConfirm.memberEmail}) ?
                  Un email contenant un lien de connexion lui sera envoyé.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (invitationConfirm) {
                  executeSendInvitation(invitationConfirm.memberId)
                  setInvitationConfirm(null)
                }
              }}
            >
              <Mail className="h-4 w-4 mr-2" />
              Envoyer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
