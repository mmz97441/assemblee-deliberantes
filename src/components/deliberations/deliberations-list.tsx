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
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Search,
  FileText,
  Eye,
  Download,
  Ban,
  CheckCircle2,
  Clock,
  Send,
  Megaphone,
} from 'lucide-react'
import {
  publishDeliberation,
  markAffichage,
  markTransmissionPrefecture,
  annulDeliberation,
} from '@/lib/actions/deliberations'
import type { InstanceConfigRow } from '@/lib/supabase/types'

// ─── Types ──────────────────────────────────────────────────────────────────

interface DeliberationSeance {
  id: string
  titre: string
  date_seance: string
  instance_id: string
  instance_config: Pick<InstanceConfigRow, 'id' | 'nom'> | null
}

interface DeliberationVote {
  id: string
  resultat: string | null
  formule_pv: string | null
}

interface DeliberationItem {
  id: string
  numero: string | null
  titre: string
  publie_at: string | null
  affiche_at: string | null
  transmis_prefecture_at: string | null
  annulee: boolean | null
  motif_annulation: string | null
  created_at: string | null
  updated_at: string | null
  seance_id: string
  vote_id: string | null
  odj_point_id: string | null
  seances: DeliberationSeance | null
  votes: DeliberationVote | null
}

interface DeliberationsListProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deliberations: any[]
  instances: InstanceConfigRow[]
  canManage: boolean
  isSuperAdmin: boolean
}

// ─── Status helpers ─────────────────────────────────────────────────────────

type DelibStatus = 'BROUILLON' | 'PUBLIEE' | 'AFFICHEE' | 'TRANSMISE' | 'ANNULEE'

function getDelibStatus(d: DeliberationItem): DelibStatus {
  if (d.annulee) return 'ANNULEE'
  if (d.transmis_prefecture_at) return 'TRANSMISE'
  if (d.affiche_at) return 'AFFICHEE'
  if (d.publie_at) return 'PUBLIEE'
  return 'BROUILLON'
}

const STATUS_CONFIG: Record<DelibStatus, { label: string; color: string; description: string }> = {
  BROUILLON: {
    label: 'Brouillon',
    color: 'bg-slate-100 text-slate-700 border-slate-200',
    description: 'En attente de publication',
  },
  PUBLIEE: {
    label: 'Publiee',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    description: 'Publiee et numerotee',
  },
  AFFICHEE: {
    label: 'Affichee',
    color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    description: 'Affichee en mairie',
  },
  TRANSMISE: {
    label: 'Transmise',
    color: 'bg-purple-100 text-purple-700 border-purple-200',
    description: 'Transmise a la prefecture',
  },
  ANNULEE: {
    label: 'Annulee',
    color: 'bg-red-100 text-red-700 border-red-200',
    description: 'Deliberation annulee',
  },
}

const RESULTAT_CONFIG: Record<string, { label: string; color: string }> = {
  ADOPTE: { label: 'Adopte', color: 'bg-green-100 text-green-700' },
  ADOPTE_UNANIMITE: { label: 'Adopte a l\'unanimite', color: 'bg-green-100 text-green-800' },
  ADOPTE_VOIX_PREPONDERANTE: { label: 'Adopte (voix preponderante)', color: 'bg-amber-100 text-amber-800' },
  REJETE: { label: 'Rejete', color: 'bg-red-100 text-red-700' },
  NUL: { label: 'Nul', color: 'bg-gray-100 text-gray-700' },
}

// ─── Date formatters ────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function formatDateShort(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

// ─── Main component ─────────────────────────────────────────────────────────

export function DeliberationsList({
  deliberations: rawDeliberations,
  instances,
  canManage,
  isSuperAdmin,
}: DeliberationsListProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState('')
  const [yearFilter, setYearFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [instanceFilter, setInstanceFilter] = useState<string>('all')

  // Dialog states
  const [publishDialogOpen, setPublishDialogOpen] = useState(false)
  const [publishingDelib, setPublishingDelib] = useState<DeliberationItem | null>(null)
  const [annulDialogOpen, setAnnulDialogOpen] = useState(false)
  const [annulingDelib, setAnnulingDelib] = useState<DeliberationItem | null>(null)
  const [annulMotif, setAnnulMotif] = useState('')

  const deliberations = rawDeliberations as DeliberationItem[]

  // Extract available years
  const availableYears = useMemo(() => {
    const years = new Set<number>()
    deliberations.forEach(d => {
      const date = d.publie_at || d.created_at
      if (date) {
        years.add(new Date(date).getFullYear())
      }
    })
    return Array.from(years).sort((a, b) => b - a)
  }, [deliberations])

  // Filtered list
  const filtered = useMemo(() => {
    return deliberations.filter(d => {
      // Search
      if (search) {
        const q = search.toLowerCase()
        const matchTitre = d.titre.toLowerCase().includes(q)
        const matchNumero = d.numero?.toLowerCase().includes(q)
        if (!matchTitre && !matchNumero) return false
      }

      // Year
      if (yearFilter !== 'all') {
        const date = d.publie_at || d.created_at
        if (!date) return false
        const year = new Date(date).getFullYear()
        if (year !== parseInt(yearFilter)) return false
      }

      // Status
      if (statusFilter !== 'all') {
        const status = getDelibStatus(d)
        if (statusFilter === 'PUBLIEE' && !['PUBLIEE', 'AFFICHEE', 'TRANSMISE'].includes(status)) return false
        if (statusFilter === 'BROUILLON' && status !== 'BROUILLON') return false
        if (statusFilter === 'ANNULEE' && status !== 'ANNULEE') return false
      }

      // Instance
      if (instanceFilter !== 'all') {
        const instanceId = d.seances?.instance_id
        if (instanceId !== instanceFilter) return false
      }

      return true
    })
  }, [deliberations, search, yearFilter, statusFilter, instanceFilter])

  // Sort: brouillons first (action needed), then by numero DESC, then by created_at DESC
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aIsDraft = !a.publie_at && !a.annulee
      const bIsDraft = !b.publie_at && !b.annulee
      if (aIsDraft && !bIsDraft) return -1
      if (!aIsDraft && bIsDraft) return 1

      // Both published or both draft: sort by date
      const aDate = a.publie_at || a.created_at || ''
      const bDate = b.publie_at || b.created_at || ''
      return bDate.localeCompare(aDate)
    })
  }, [filtered])

  // ─── Handlers ─────────────────────────────────────────────────────────────

  function handlePublish() {
    if (!publishingDelib) return
    startTransition(async () => {
      const result = await publishDeliberation(publishingDelib.id)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success(`Deliberation publiee sous le numero ${result.numero}`)
        router.refresh()
      }
      setPublishDialogOpen(false)
      setPublishingDelib(null)
    })
  }

  function handleAnnul() {
    if (!annulingDelib || !annulMotif.trim()) return
    startTransition(async () => {
      const result = await annulDeliberation(annulingDelib.id, annulMotif)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success('Deliberation annulee')
        router.refresh()
      }
      setAnnulDialogOpen(false)
      setAnnulingDelib(null)
      setAnnulMotif('')
    })
  }

  function handleAffichage(d: DeliberationItem) {
    startTransition(async () => {
      const result = await markAffichage(d.id)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success('Affichage enregistre')
        router.refresh()
      }
    })
  }

  function handleTransmission(d: DeliberationItem) {
    startTransition(async () => {
      const result = await markTransmissionPrefecture(d.id)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success('Transmission en prefecture enregistree')
        router.refresh()
      }
    })
  }

  // ─── Count badges ─────────────────────────────────────────────────────────

  const draftCount = deliberations.filter(d => !d.publie_at && !d.annulee).length

  return (
    <>
      {/* Stats summary */}
      {draftCount > 0 && canManage && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-center gap-2">
          <Clock className="h-4 w-4 shrink-0" />
          <span>
            <strong>{draftCount} deliberation{draftCount > 1 ? 's' : ''}</strong> en attente de publication
          </span>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par titre ou numero..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Annee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes</SelectItem>
            {availableYears.map(year => (
              <SelectItem key={year} value={String(year)}>{year}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="BROUILLON">Brouillons</SelectItem>
            <SelectItem value="PUBLIEE">Publiees</SelectItem>
            <SelectItem value="ANNULEE">Annulees</SelectItem>
          </SelectContent>
        </Select>
        {instances.length > 1 && (
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
        )}
      </div>

      {/* Empty state */}
      {sorted.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
            <FileText className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1">Aucune deliberation</h3>
          <p className="text-sm text-muted-foreground max-w-md mb-4">
            {deliberations.length === 0
              ? "Les deliberations sont creees automatiquement apres la cloture d'une seance avec des votes adoptes."
              : "Aucune deliberation ne correspond aux filtres selectionnes. Essayez de modifier vos criteres de recherche."}
          </p>
          {deliberations.length > 0 && (
            <Button
              variant="outline"
              onClick={() => {
                setSearch('')
                setYearFilter('all')
                setStatusFilter('all')
                setInstanceFilter('all')
              }}
            >
              Reinitialiser les filtres
            </Button>
          )}
        </div>
      )}

      {/* Results count */}
      {sorted.length > 0 && (
        <p className="text-sm text-muted-foreground mb-3">
          {sorted.length} deliberation{sorted.length > 1 ? 's' : ''}
          {search || yearFilter !== 'all' || statusFilter !== 'all' || instanceFilter !== 'all'
            ? ` (sur ${deliberations.length} au total)`
            : ''
          }
        </p>
      )}

      {/* List */}
      <div className="space-y-3">
        {sorted.map(delib => (
          <DeliberationCard
            key={delib.id}
            delib={delib}
            canManage={canManage}
            isSuperAdmin={isSuperAdmin}
            isPending={isPending}
            onPublish={() => {
              setPublishingDelib(delib)
              setPublishDialogOpen(true)
            }}
            onAnnul={() => {
              setAnnulingDelib(delib)
              setAnnulMotif('')
              setAnnulDialogOpen(true)
            }}
            onAffichage={() => handleAffichage(delib)}
            onTransmission={() => handleTransmission(delib)}
          />
        ))}
      </div>

      {/* Publish confirmation */}
      <AlertDialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
        <AlertDialogContent aria-describedby={undefined}>
          <AlertDialogHeader>
            <AlertDialogTitle>Publier cette deliberation ?</AlertDialogTitle>
            <AlertDialogDescription>
              La deliberation &laquo;&nbsp;{publishingDelib?.titre}&nbsp;&raquo; sera publiee et un numero officiel lui sera attribue automatiquement.
              <br /><br />
              <strong>Cette action est irreversible</strong> : le numero ne pourra pas etre change une fois attribue.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePublish}
              disabled={isPending}
            >
              {isPending ? 'Publication...' : 'Publier et attribuer le numero'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Annulation dialog */}
      <AlertDialog open={annulDialogOpen} onOpenChange={setAnnulDialogOpen}>
        <AlertDialogContent aria-describedby={undefined}>
          <AlertDialogHeader>
            <AlertDialogTitle>Annuler cette deliberation ?</AlertDialogTitle>
            <AlertDialogDescription>
              La deliberation n&deg;&nbsp;{annulingDelib?.numero || 'brouillon'} &laquo;&nbsp;{annulingDelib?.titre}&nbsp;&raquo; sera marquee comme annulee.
              Le numero ne sera pas reutilise.
              <br /><br />
              <strong>Motif d&apos;annulation (obligatoire)&nbsp;:</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            placeholder="Saisissez le motif d'annulation..."
            value={annulMotif}
            onChange={e => setAnnulMotif(e.target.value)}
            className="mt-2"
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Retour</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAnnul}
              disabled={isPending || !annulMotif.trim()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? 'Annulation...' : 'Confirmer l\'annulation'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// ─── Deliberation Card ──────────────────────────────────────────────────────

function DeliberationCard({
  delib,
  canManage,
  isSuperAdmin,
  isPending,
  onPublish,
  onAnnul,
  onAffichage,
  onTransmission,
}: {
  delib: DeliberationItem
  canManage: boolean
  isSuperAdmin: boolean
  isPending: boolean
  onPublish: () => void
  onAnnul: () => void
  onAffichage: () => void
  onTransmission: () => void
}) {
  const status = getDelibStatus(delib)
  const statusConfig = STATUS_CONFIG[status]
  const resultat = delib.votes?.resultat
  const resultatConfig = resultat ? RESULTAT_CONFIG[resultat] : null
  const instanceName = delib.seances?.instance_config?.nom
  const seanceDate = delib.seances?.date_seance

  // Warnings
  const now = new Date()
  const publishedDate = delib.publie_at ? new Date(delib.publie_at) : null
  const hoursPublished = publishedDate ? (now.getTime() - publishedDate.getTime()) / (1000 * 60 * 60) : 0
  const showAffichageWarning = status === 'PUBLIEE' && hoursPublished > 24
  const showTransmissionWarning = (status === 'PUBLIEE' || status === 'AFFICHEE') && hoursPublished > 10 * 24

  return (
    <div className={`group relative rounded-xl border bg-card card-interactive ${delib.annulee ? 'opacity-60' : ''}`}>
      <Link href={`/deliberations/${delib.id}`} className="block p-5">
        <div className="flex items-start justify-between gap-4">
          {/* Left: info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              {/* Numero or Brouillon */}
              {delib.numero ? (
                <span className="font-mono text-base font-bold text-blue-700">
                  n&deg;&nbsp;{delib.numero}
                </span>
              ) : (
                <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-xs">
                  Brouillon
                </Badge>
              )}

              {/* Status badge */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge className={`${statusConfig.color} border text-xs`}>
                    {statusConfig.label}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{statusConfig.description}</p>
                </TooltipContent>
              </Tooltip>

              {/* Vote result */}
              {resultatConfig && (
                <Badge className={`${resultatConfig.color} border-0 text-xs`}>
                  {resultatConfig.label}
                </Badge>
              )}

              {/* Instance */}
              {instanceName && (
                <Badge variant="outline" className="text-xs">
                  {instanceName}
                </Badge>
              )}
            </div>

            <h3 className="text-base font-semibold text-foreground truncate group-hover:text-institutional-blue transition-colors">
              {delib.titre}
            </h3>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
              {seanceDate && (
                <span>Seance du {formatDate(seanceDate)}</span>
              )}
              {delib.publie_at && (
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                  Publiee le {formatDateShort(delib.publie_at)}
                </span>
              )}
              {delib.affiche_at && (
                <span className="flex items-center gap-1">
                  <Megaphone className="h-3.5 w-3.5 text-emerald-600" />
                  Affichee le {formatDateShort(delib.affiche_at)}
                </span>
              )}
              {delib.transmis_prefecture_at && (
                <span className="flex items-center gap-1">
                  <Send className="h-3.5 w-3.5 text-purple-600" />
                  Transmise le {formatDateShort(delib.transmis_prefecture_at)}
                </span>
              )}
            </div>

            {/* Warnings */}
            {showAffichageWarning && (
              <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Affichage en attente depuis plus de 24h
              </div>
            )}
            {showTransmissionWarning && (
              <div className="mt-2 ml-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Transmission en attente depuis plus de 10 jours
              </div>
            )}

            {/* Annulation */}
            {delib.annulee && delib.motif_annulation && (
              <div className="mt-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
                Annulee : {delib.motif_annulation}
              </div>
            )}
          </div>

          {/* Right: actions */}
          {canManage && !delib.annulee && (
            <div className="shrink-0 flex items-center gap-1" onClick={e => e.preventDefault()}>
              {/* Draft actions */}
              {status === 'BROUILLON' && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      onClick={onPublish}
                      disabled={isPending}
                      className="h-9 px-3"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1.5" />
                      Publier
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Attribuer un numero officiel et publier</p>
                  </TooltipContent>
                </Tooltip>
              )}

              {/* Published: affichage */}
              {status === 'PUBLIEE' && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={onAffichage}
                      disabled={isPending}
                      className="h-9 px-3"
                    >
                      <Megaphone className="h-4 w-4 mr-1.5" />
                      Affichage
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Marquer comme affichee en mairie</p>
                  </TooltipContent>
                </Tooltip>
              )}

              {/* Published/Affichee: transmission */}
              {(status === 'PUBLIEE' || status === 'AFFICHEE') && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={onTransmission}
                      disabled={isPending}
                      className="h-9 px-3"
                    >
                      <Send className="h-4 w-4 mr-1.5" />
                      Prefecture
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Marquer la transmission a la prefecture</p>
                  </TooltipContent>
                </Tooltip>
              )}

              {/* View */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9"
                    asChild
                  >
                    <Link href={`/deliberations/${delib.id}`}>
                      <Eye className="h-4 w-4" />
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Voir le detail</p>
                </TooltipContent>
              </Tooltip>

              {/* PDF download */}
              {delib.publie_at && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9"
                      disabled
                      title="Generation PDF bientot disponible"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Telecharger le PDF (bientot disponible)</p>
                  </TooltipContent>
                </Tooltip>
              )}

              {/* Annul (super_admin only on published) */}
              {isSuperAdmin && delib.publie_at && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 text-destructive hover:text-destructive"
                      onClick={onAnnul}
                      disabled={isPending}
                    >
                      <Ban className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Annuler cette deliberation</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          )}
        </div>
      </Link>
    </div>
  )
}
