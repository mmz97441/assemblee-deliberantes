'use client'

import { useState, useMemo, useTransition } from 'react'
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
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
  Copy,
  Archive,
  ArchiveRestore,
} from 'lucide-react'
import { SeanceFormDialog } from './seance-form'
import { deleteSeance, duplicateSeance, archiveSeance, unarchiveSeance } from '@/lib/actions/seances'
import type { InstanceConfigRow, SeanceRow } from '@/lib/supabase/types'
import { formatDate, formatTime } from '@/lib/utils/format-date'

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
  archivedSeances: SeanceListItem[]
  instances: InstanceConfigRow[]
  members: MemberOption[]
  canManage: boolean
  /** When true, shows elu-specific empty states and hides filter controls */
  isEluView?: boolean
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

function getYear(dateStr: string): number {
  try {
    return new Date(dateStr).getFullYear()
  } catch {
    return new Date().getFullYear()
  }
}

export function SeancesList({ seances, archivedSeances, instances, members, canManage, isEluView = false }: SeancesListProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState('')
  const [statutFilter, setStatutFilter] = useState<string>('all')
  const [instanceFilter, setInstanceFilter] = useState<string>('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editingSeance, setEditingSeance] = useState<SeanceListItem | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingSeance, setDeletingSeance] = useState<SeanceListItem | null>(null)
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false)
  const [duplicatingSeance, setDuplicatingSeance] = useState<SeanceListItem | null>(null)
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false)
  const [archivingSeance, setArchivingSeance] = useState<SeanceListItem | null>(null)
  const [unarchiveDialogOpen, setUnarchiveDialogOpen] = useState(false)
  const [unarchivingSeance, setUnarchivingSeance] = useState<SeanceListItem | null>(null)

  // Archive tab filters
  const [archiveSearch, setArchiveSearch] = useState('')
  const [archiveInstanceFilter, setArchiveInstanceFilter] = useState<string>('all')
  const [archiveDateFrom, setArchiveDateFrom] = useState('')
  const [archiveDateTo, setArchiveDateTo] = useState('')
  const [archiveYearFilter, setArchiveYearFilter] = useState<string>('all')

  // Active tab filters
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

  // Archive years for quick filter
  const archiveYears = useMemo(() => {
    const years = new Set(archivedSeances.map(s => getYear(s.date_seance)))
    return Array.from(years).sort((a, b) => b - a)
  }, [archivedSeances])

  // Filtered archived seances
  const filteredArchived = useMemo(() => {
    return archivedSeances.filter(s => {
      if (archiveSearch) {
        const q = archiveSearch.toLowerCase()
        const matchTitle = s.titre.toLowerCase().includes(q)
        const matchInstance = s.instance_config?.nom?.toLowerCase().includes(q)
        if (!matchTitle && !matchInstance) return false
      }
      if (archiveInstanceFilter !== 'all' && s.instance_id !== archiveInstanceFilter) return false
      if (archiveYearFilter !== 'all' && getYear(s.date_seance).toString() !== archiveYearFilter) return false
      if (archiveDateFrom) {
        const from = new Date(archiveDateFrom)
        if (new Date(s.date_seance) < from) return false
      }
      if (archiveDateTo) {
        const to = new Date(archiveDateTo)
        to.setHours(23, 59, 59, 999)
        if (new Date(s.date_seance) > to) return false
      }
      return true
    })
  }, [archivedSeances, archiveSearch, archiveInstanceFilter, archiveYearFilter, archiveDateFrom, archiveDateTo])

  function handleDelete() {
    if (!deletingSeance) return
    startTransition(async () => {
      const result = await deleteSeance(deletingSeance.id)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success('Brouillon supprimé')
        router.refresh()
      }
      setDeleteDialogOpen(false)
      setDeletingSeance(null)
    })
  }

  function handleDuplicate() {
    if (!duplicatingSeance) return
    startTransition(async () => {
      const result = await duplicateSeance(duplicatingSeance.id)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success('Séance dupliquée', {
          action: {
            label: 'Voir la copie',
            onClick: () => router.push(`/seances/${result.newSeanceId}`),
          },
        })
        router.push(`/seances/${result.newSeanceId}`)
      }
      setDuplicateDialogOpen(false)
      setDuplicatingSeance(null)
    })
  }

  function handleArchive() {
    if (!archivingSeance) return
    startTransition(async () => {
      const result = await archiveSeance(archivingSeance.id)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success('Séance archivée')
        router.refresh()
      }
      setArchiveDialogOpen(false)
      setArchivingSeance(null)
    })
  }

  function handleUnarchive() {
    if (!unarchivingSeance) return
    startTransition(async () => {
      const result = await unarchiveSeance(unarchivingSeance.id)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success('Séance désarchivée — restaurée en « Clôturée »')
        router.refresh()
      }
      setUnarchiveDialogOpen(false)
      setUnarchivingSeance(null)
    })
  }

  // Group active by upcoming vs past
  const now = new Date()
  const upcoming = filtered.filter(s => new Date(s.date_seance) >= now || s.statut === 'EN_COURS')
  const past = filtered.filter(s => new Date(s.date_seance) < now && s.statut !== 'EN_COURS')

  return (
    <TooltipProvider>
      <Tabs defaultValue="actives" className="w-full">
        {/* Tabs header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
          <TabsList className="shrink-0">
            <TabsTrigger value="actives" className="min-h-[44px] px-4">
              Actives ({seances.length})
            </TabsTrigger>
            <TabsTrigger value="archives" className="min-h-[44px] px-4">
              Archives ({archivedSeances.length})
            </TabsTrigger>
          </TabsList>
          <div className="flex-1" />
          {canManage && (
            <Button asChild className="min-h-[44px]">
              <Link href="/seances/new">
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle séance
              </Link>
            </Button>
          )}
        </div>

        {/* ─── Active tab ─── */}
        <TabsContent value="actives" className="mt-0">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher une séance..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 min-h-[44px]"
              />
            </div>
            {!isEluView && (
              <>
                <Select value={statutFilter} onValueChange={setStatutFilter}>
                  <SelectTrigger className="w-[160px] min-h-[44px]">
                    <SelectValue placeholder="Statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    {Object.entries(STATUT_CONFIG)
                      .filter(([key]) => key !== 'ARCHIVEE')
                      .map(([value, { label }]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Select value={instanceFilter} onValueChange={setInstanceFilter}>
                  <SelectTrigger className="w-[180px] min-h-[44px]">
                    <SelectValue placeholder="Instance" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les instances</SelectItem>
                    {instances.map(inst => (
                      <SelectItem key={inst.id} value={inst.id}>{inst.nom}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
          </div>

          {/* Empty state */}
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <CalendarDays className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">
                {isEluView ? 'Aucune séance prévue' : 'Aucune séance'}
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm mb-4">
                {seances.length === 0
                  ? isEluView
                    ? "Vous n'avez aucune séance à venir pour le moment. Vous serez convoqué par email lorsqu'une séance sera programmée."
                    : "Créez votre première séance pour commencer à gérer vos assemblées délibérantes."
                  : "Aucune séance ne correspond aux filtres sélectionnés. Essayez de modifier vos critères de recherche."}
              </p>
              {canManage && seances.length === 0 && (
                <Button asChild>
                  <Link href="/seances/new">
                    <Plus className="h-4 w-4 mr-2" />
                    Nouvelle séance
                  </Link>
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
                À venir ({upcoming.length})
              </h2>
              <div className="space-y-3">
                {upcoming.map(seance => (
                  <SeanceCard
                    key={seance.id}
                    seance={seance}
                    canManage={canManage}
                    onEdit={() => { setEditingSeance(seance); setFormOpen(true) }}
                    onDelete={() => { setDeletingSeance(seance); setDeleteDialogOpen(true) }}
                    onDuplicate={() => { setDuplicatingSeance(seance); setDuplicateDialogOpen(true) }}
                    onArchive={() => { setArchivingSeance(seance); setArchiveDialogOpen(true) }}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Past seances */}
          {past.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Passées ({past.length})
              </h2>
              <div className="space-y-3">
                {past.map(seance => (
                  <SeanceCard
                    key={seance.id}
                    seance={seance}
                    canManage={canManage}
                    onEdit={() => { setEditingSeance(seance); setFormOpen(true) }}
                    onDelete={() => { setDeletingSeance(seance); setDeleteDialogOpen(true) }}
                    onDuplicate={() => { setDuplicatingSeance(seance); setDuplicateDialogOpen(true) }}
                    onArchive={() => { setArchivingSeance(seance); setArchiveDialogOpen(true) }}
                  />
                ))}
              </div>
            </section>
          )}
        </TabsContent>

        {/* ─── Archives tab ─── */}
        <TabsContent value="archives" className="mt-0">
          {/* Archive filters */}
          <div className="flex flex-col gap-3 mb-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher dans les archives..."
                  value={archiveSearch}
                  onChange={e => setArchiveSearch(e.target.value)}
                  className="pl-9 min-h-[44px]"
                />
              </div>
              <Select value={archiveInstanceFilter} onValueChange={setArchiveInstanceFilter}>
                <SelectTrigger className="w-[180px] min-h-[44px]">
                  <SelectValue placeholder="Instance" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les instances</SelectItem>
                  {instances.map(inst => (
                    <SelectItem key={inst.id} value={inst.id}>{inst.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              {/* Date range */}
              <div className="flex items-center gap-2">
                <label htmlFor="archive-date-from" className="text-sm text-muted-foreground whitespace-nowrap">Du</label>
                <Input
                  id="archive-date-from"
                  type="date"
                  value={archiveDateFrom}
                  onChange={e => setArchiveDateFrom(e.target.value)}
                  className="w-[160px] min-h-[44px]"
                />
                <label htmlFor="archive-date-to" className="text-sm text-muted-foreground whitespace-nowrap">au</label>
                <Input
                  id="archive-date-to"
                  type="date"
                  value={archiveDateTo}
                  onChange={e => setArchiveDateTo(e.target.value)}
                  className="w-[160px] min-h-[44px]"
                />
              </div>

              {/* Year quick filters */}
              {archiveYears.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm text-muted-foreground mr-1">Année :</span>
                  <Button
                    variant={archiveYearFilter === 'all' ? 'default' : 'outline'}
                    size="sm"
                    className="min-h-[36px]"
                    onClick={() => setArchiveYearFilter('all')}
                  >
                    Toutes
                  </Button>
                  {archiveYears.map(year => (
                    <Button
                      key={year}
                      variant={archiveYearFilter === year.toString() ? 'default' : 'outline'}
                      size="sm"
                      className="min-h-[36px]"
                      onClick={() => setArchiveYearFilter(year.toString())}
                    >
                      {year}
                    </Button>
                  ))}
                </div>
              )}

              {/* Reset filters */}
              {(archiveSearch || archiveInstanceFilter !== 'all' || archiveDateFrom || archiveDateTo || archiveYearFilter !== 'all') && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-h-[36px] text-muted-foreground"
                  onClick={() => {
                    setArchiveSearch('')
                    setArchiveInstanceFilter('all')
                    setArchiveDateFrom('')
                    setArchiveDateTo('')
                    setArchiveYearFilter('all')
                  }}
                >
                  Réinitialiser
                </Button>
              )}
            </div>
          </div>

          {/* Empty archive state */}
          {filteredArchived.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <Archive className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">
                Aucune séance archivée
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm mb-4">
                {archivedSeances.length === 0
                  ? "Les séances clôturées peuvent être archivées pour les retirer de la liste active tout en conservant l'historique."
                  : "Aucune séance archivée ne correspond aux filtres sélectionnés."}
              </p>
              {archivedSeances.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setArchiveSearch('')
                    setArchiveInstanceFilter('all')
                    setArchiveDateFrom('')
                    setArchiveDateTo('')
                    setArchiveYearFilter('all')
                  }}
                >
                  Réinitialiser les filtres
                </Button>
              )}
            </div>
          )}

          {/* Archived seances list */}
          {filteredArchived.length > 0 && (
            <div className="space-y-3">
              {filteredArchived.map(seance => (
                <ArchivedSeanceCard
                  key={seance.id}
                  seance={seance}
                  canManage={canManage}
                  onUnarchive={() => { setUnarchivingSeance(seance); setUnarchiveDialogOpen(true) }}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Form dialog */}
      <SeanceFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingSeance(null) }}
        seance={editingSeance}
        instances={instances}
        members={members}
      />

      {/* Delete confirmation — BROUILLON only */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce brouillon ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette séance n&apos;a pas encore été convoquée — aucun membre n&apos;a été notifié.
              Le brouillon « {deletingSeance?.titre} » et ses {deletingSeance?._count_odj ?? 0} point{(deletingSeance?._count_odj ?? 0) !== 1 ? 's' : ''} d&apos;ordre du jour seront définitivement supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? 'Suppression...' : 'Supprimer le brouillon'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Archive confirmation */}
      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archiver cette séance ?</AlertDialogTitle>
            <AlertDialogDescription>
              La séance « {archivingSeance?.titre} » sera déplacée dans les archives et n&apos;apparaîtra plus dans la liste active.
              Vous pourrez la retrouver à tout moment dans l&apos;onglet Archives et la désarchiver si nécessaire.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchive}
              disabled={isPending}
              className="bg-amber-600 text-white hover:bg-amber-700"
            >
              {isPending ? 'Archivage...' : 'Archiver'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unarchive confirmation */}
      <AlertDialog open={unarchiveDialogOpen} onOpenChange={setUnarchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Désarchiver cette séance ?</AlertDialogTitle>
            <AlertDialogDescription>
              La séance « {unarchivingSeance?.titre} » sera restaurée avec le statut « Clôturée » et réapparaîtra dans la liste active.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnarchive}
              disabled={isPending}
            >
              {isPending ? 'Désarchivage...' : 'Désarchiver'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Duplicate confirmation */}
      <AlertDialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dupliquer cette séance ?</AlertDialogTitle>
            <AlertDialogDescription>
              L&apos;ordre du jour ({duplicatingSeance?._count_odj} point{(duplicatingSeance?._count_odj ?? 0) !== 1 ? 's' : ''}) et les convocataires ({duplicatingSeance?._count_convocataires} membre{(duplicatingSeance?._count_convocataires ?? 0) !== 1 ? 's' : ''}) seront copiés.
              La date sera fixée à 7 jours après aujourd&apos;hui.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDuplicate}
              disabled={isPending}
            >
              {isPending ? 'Duplication...' : 'Dupliquer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  )
}

// ─── Active Seance Card ─────────────────────────────────────────────────────

function SeanceCard({
  seance,
  canManage,
  onEdit,
  onDelete,
  onDuplicate,
  onArchive,
}: {
  seance: SeanceListItem
  canManage: boolean
  onEdit: () => void
  onDelete: () => void
  onDuplicate: () => void
  onArchive: () => void
}) {
  const statutConfig = STATUT_CONFIG[seance.statut || 'BROUILLON']
  const ModeIcon = MODE_ICONS[seance.mode || 'PRESENTIEL'] || Building2
  const isBrouillon = seance.statut === 'BROUILLON'
  const canArchive = ['CONVOQUEE', 'CLOTUREE'].includes(seance.statut || '')

  return (
    <div className="group relative rounded-xl border bg-card card-interactive">
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
                  <> à {formatTime(seance.date_seance)}</>
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
                {seance._count_convocataires} convoqué{seance._count_convocataires !== 1 ? 's' : ''}
              </span>
              {seance.heure_ouverture && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Ouverte à {formatTime(seance.heure_ouverture)}
                </span>
              )}
            </div>
          </div>

          {/* Right: actions */}
          {canManage && (
            <div className="shrink-0" onClick={e => e.preventDefault()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9 min-h-[44px] min-w-[44px]" title="Plus d'options">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href={`/seances/${seance.id}`}>
                      <Eye className="h-4 w-4 mr-2" />
                      Voir le détail
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onDuplicate}>
                    <Copy className="h-4 w-4 mr-2" />
                    Dupliquer
                  </DropdownMenuItem>
                  {isBrouillon && (
                    <DropdownMenuItem onClick={onEdit}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Modifier
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  {isBrouillon && (
                    <DropdownMenuItem
                      onClick={onDelete}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Supprimer le brouillon
                    </DropdownMenuItem>
                  )}
                  {canArchive && (
                    <DropdownMenuItem
                      onClick={onArchive}
                      className="text-amber-700 focus:text-amber-700"
                    >
                      <Archive className="h-4 w-4 mr-2" />
                      Archiver
                    </DropdownMenuItem>
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

// ─── Archived Seance Card ───────────────────────────────────────────────────

function ArchivedSeanceCard({
  seance,
  canManage,
  onUnarchive,
}: {
  seance: SeanceListItem
  canManage: boolean
  onUnarchive: () => void
}) {
  const ModeIcon = MODE_ICONS[seance.mode || 'PRESENTIEL'] || Building2

  return (
    <div className="group relative rounded-xl border bg-card/50 border-dashed">
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          {/* Left: info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <Badge className="bg-gray-100 text-gray-500 border-0 text-xs font-medium">
                Archivée
              </Badge>
              {seance.instance_config && (
                <Badge variant="outline" className="text-xs">
                  {seance.instance_config.nom}
                </Badge>
              )}
            </div>

            <h3 className="text-base font-semibold text-muted-foreground truncate">
              {seance.titre}
            </h3>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" />
                {formatDate(seance.date_seance)}
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
                {seance._count_convocataires} convoqué{seance._count_convocataires !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Right: actions */}
          <div className="shrink-0 flex items-center gap-2" onClick={e => e.preventDefault()}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" className="min-h-[44px]" asChild>
                  <Link href={`/seances/${seance.id}`}>
                    <Eye className="h-4 w-4 mr-2" />
                    Voir
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Voir le détail de cette séance archivée</TooltipContent>
            </Tooltip>

            {canManage && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-[44px]"
                    onClick={onUnarchive}
                  >
                    <ArchiveRestore className="h-4 w-4 mr-2" />
                    Désarchiver
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Restaurer cette séance dans la liste active (statut « Clôturée »)</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
