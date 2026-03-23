'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import {
  CalendarDays,
  Plus,
  Search,
  MoreHorizontal,
  MapPin,
  Users,
  FileText,
  Eye,
  Pencil,
  Trash2,
  Clock,
  Video,
  Monitor,
  Building2,
} from 'lucide-react'
import { SeanceFormDialog } from './seance-form'
import { deleteSeance } from '@/lib/actions/seances'
import type { InstanceConfigRow, SeanceRow } from '@/lib/supabase/types'

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

interface SeancesListProps {
  seances: SeanceListItem[]
  instances: InstanceConfigRow[]
  members: MemberOption[]
  canManage: boolean
}

const STATUT_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; color: string }> = {
  BROUILLON: { label: 'Brouillon', variant: 'secondary', color: 'bg-slate-100 text-slate-700' },
  CONVOQUEE: { label: 'Convoquée', variant: 'default', color: 'bg-blue-100 text-blue-700' },
  EN_COURS: { label: 'En cours', variant: 'default', color: 'bg-emerald-100 text-emerald-700' },
  SUSPENDUE: { label: 'Suspendue', variant: 'outline', color: 'bg-amber-100 text-amber-700' },
  CLOTUREE: { label: 'Clôturée', variant: 'secondary', color: 'bg-purple-100 text-purple-700' },
  ARCHIVEE: { label: 'Archivée', variant: 'secondary', color: 'bg-gray-100 text-gray-500' },
}

const MODE_ICONS: Record<string, React.ElementType> = {
  PRESENTIEL: Building2,
  HYBRIDE: Monitor,
  VISIO: Video,
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function formatTime(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

export function SeancesList({ seances, instances, members, canManage }: SeancesListProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState('')
  const [statutFilter, setStatutFilter] = useState<string>('all')
  const [instanceFilter, setInstanceFilter] = useState<string>('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editingSeance, setEditingSeance] = useState<SeanceListItem | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingSeance, setDeletingSeance] = useState<SeanceListItem | null>(null)

  // Filters
  const filtered = seances.filter(s => {
    if (search) {
      const q = search.toLowerCase()
      const matchTitle = s.titre.toLowerCase().includes(q)
      const matchInstance = s.instance_config?.nom?.toLowerCase().includes(q)
      if (!matchTitle && !matchInstance) return false
    }
    if (statutFilter !== 'all' && s.statut !== statutFilter) return false
    if (instanceFilter !== 'all' && s.instance_id !== instanceFilter) return false
    return true
  })

  function handleDelete() {
    if (!deletingSeance) return
    startTransition(async () => {
      const result = await deleteSeance(deletingSeance.id)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success('Séance supprimée')
        router.refresh()
      }
      setDeleteDialogOpen(false)
      setDeletingSeance(null)
    })
  }

  // Group by upcoming vs past
  const now = new Date()
  const upcoming = filtered.filter(s => new Date(s.date_seance) >= now || s.statut === 'EN_COURS')
  const past = filtered.filter(s => new Date(s.date_seance) < now && s.statut !== 'EN_COURS')

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher une seance..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statutFilter} onValueChange={setStatutFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {Object.entries(STATUT_CONFIG).map(([value, { label }]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={instanceFilter} onValueChange={setInstanceFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Instance" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les instances</SelectItem>
            {instances.map(inst => (
              <SelectItem key={inst.id} value={inst.id}>{inst.nom}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {canManage && (
          <Button onClick={() => { setEditingSeance(null); setFormOpen(true) }}>
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle seance
          </Button>
        )}
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
            <CalendarDays className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1">Aucune séance</h3>
          <p className="text-sm text-muted-foreground max-w-sm mb-4">
            {seances.length === 0
              ? "Créez votre première séance pour commencer à gérer vos assemblées délibérantes."
              : "Aucune séance ne correspond aux filtres sélectionnés. Essayez de modifier vos critères de recherche."}
          </p>
          {canManage && seances.length === 0 && (
            <Button onClick={() => { setEditingSeance(null); setFormOpen(true) }}>
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle séance
            </Button>
          )}
          {seances.length > 0 && (
            <Button variant="outline" onClick={() => { setSearch(''); setStatutFilter('all'); setInstanceFilter('all') }}>
              Réinitialiser les filtres
            </Button>
          )}
        </div>
      )}

      {/* Upcoming seances */}
      {upcoming.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            A venir ({upcoming.length})
          </h2>
          <div className="space-y-3">
            {upcoming.map(seance => (
              <SeanceCard
                key={seance.id}
                seance={seance}
                canManage={canManage}
                onEdit={() => { setEditingSeance(seance); setFormOpen(true) }}
                onDelete={() => { setDeletingSeance(seance); setDeleteDialogOpen(true) }}
              />
            ))}
          </div>
        </section>
      )}

      {/* Past seances */}
      {past.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Passees ({past.length})
          </h2>
          <div className="space-y-3">
            {past.map(seance => (
              <SeanceCard
                key={seance.id}
                seance={seance}
                canManage={canManage}
                onEdit={() => { setEditingSeance(seance); setFormOpen(true) }}
                onDelete={() => { setDeletingSeance(seance); setDeleteDialogOpen(true) }}
              />
            ))}
          </div>
        </section>
      )}

      {/* Form dialog */}
      <SeanceFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingSeance(null) }}
        seance={editingSeance}
        instances={instances}
        members={members}
      />

      {/* Delete confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette seance ?</AlertDialogTitle>
            <AlertDialogDescription>
              La seance &quot;{deletingSeance?.titre}&quot; et tous ses points d&apos;ordre du jour seront supprimes.
              Cette action est irreversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? 'Suppression...' : 'Supprimer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// ─── Seance Card ─────────────────────────────────────────────────────────────

function SeanceCard({
  seance,
  canManage,
  onEdit,
  onDelete,
}: {
  seance: SeanceListItem
  canManage: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const statutConfig = STATUT_CONFIG[seance.statut || 'BROUILLON']
  const ModeIcon = MODE_ICONS[seance.mode || 'PRESENTIEL'] || Building2

  return (
    <div className="group relative rounded-xl border bg-card hover:shadow-md transition-all duration-200">
      <Link href={`/seances/${seance.id}`} className="block p-5">
        <div className="flex items-start justify-between gap-4">
          {/* Left: info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <Badge className={`${statutConfig.color} border-0 text-xs font-medium`}>
                {statutConfig.label}
              </Badge>
              {seance.instance_config && (
                <Badge variant="outline" className="text-xs">
                  {seance.instance_config.nom}
                </Badge>
              )}
              {seance.reconvocation && (
                <Badge variant="outline" className="text-xs border-amber-300 text-amber-700">
                  Reconvocation
                </Badge>
              )}
            </div>

            <h3 className="text-base font-semibold text-foreground truncate group-hover:text-institutional-blue transition-colors">
              {seance.titre}
            </h3>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" />
                {formatDate(seance.date_seance)}
                {seance.heure_ouverture && (
                  <> a {formatTime(seance.date_seance)}</>
                )}
              </span>
              {seance.lieu && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {seance.lieu}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <ModeIcon className="h-3.5 w-3.5" />
                {seance.mode === 'PRESENTIEL' ? 'Présentiel' : seance.mode === 'HYBRIDE' ? 'Hybride' : 'Visio'}
              </span>
            </div>

            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                {seance._count_odj} point{seance._count_odj !== 1 ? 's' : ''} ODJ
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {seance._count_convocataires} convoque{seance._count_convocataires !== 1 ? 's' : ''}
              </span>
              {seance.heure_ouverture && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Ouverte a {formatTime(seance.heure_ouverture)}
                </span>
              )}
            </div>
          </div>

          {/* Right: actions */}
          {canManage && (
            <div className="shrink-0" onClick={e => e.preventDefault()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href={`/seances/${seance.id}`}>
                      <Eye className="h-4 w-4 mr-2" />
                      Voir le detail
                    </Link>
                  </DropdownMenuItem>
                  {seance.statut === 'BROUILLON' && (
                    <>
                      <DropdownMenuItem onClick={onEdit}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Modifier
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={onDelete}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Supprimer
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </Link>
    </div>
  )
}
