'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Switch } from '@/components/ui/switch'
import {
  CalendarDays,
  MapPin,
  Users,
  FileText,
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  MoreHorizontal,
  AlertTriangle,
  CheckCircle2,
  Clock,
  UserPlus,
  UserMinus,
  Video,
  Building2,
  Monitor,
  Loader2,
  Info,
  Shield,
  Send,
  RefreshCw,
} from 'lucide-react'
import {
  addODJPoint,
  updateODJPoint,
  deleteODJPoint,
  reorderODJPoints,
  updateSeanceStatut,
  addConvocataire,
  removeConvocataire,
} from '@/lib/actions/seances'
import { sendConvocations, resendConvocation } from '@/lib/actions/convocations'
import type { ODJPointRow } from '@/lib/supabase/types'

// ─── Types ───────────────────────────────────────────────────────────────────

interface MemberOption {
  id: string
  prenom: string
  nom: string
  email: string
  role: string
  qualite_officielle: string | null
}

interface ConvocataireItem {
  id: string
  member_id: string
  statut_convocation: string | null
  envoye_at: string | null
  confirme_at: string | null
  member: MemberOption | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface SeanceData extends Record<string, any> {
  id: string
  titre: string
  date_seance: string
  statut: string | null
  mode: string | null
  lieu: string | null
  publique: boolean | null
  notes: string | null
  instance_id: string
  heure_ouverture: string | null
  heure_cloture: string | null
  reconvocation: boolean | null
  instance_config: {
    id: string
    nom: string
    type_legal: string
    delai_convocation_jours: number | null
    quorum_type: string | null
    quorum_fraction_numerateur: number | null
    quorum_fraction_denominateur: number | null
    composition_max: number | null
    majorite_defaut: string | null
  } | null
  odj_points: ODJPointRow[]
  convocataires: ConvocataireItem[]
  president_effectif: { id: string; prenom: string; nom: string } | null
  secretaire_seance: { id: string; prenom: string; nom: string } | null
}

interface SeanceDetailProps {
  seance: SeanceData
  allMembers: MemberOption[]
  instanceMemberIds: string[]
  canManage: boolean
}

const STATUT_CONFIG: Record<string, { label: string; color: string }> = {
  BROUILLON: { label: 'Brouillon', color: 'bg-slate-100 text-slate-700' },
  CONVOQUEE: { label: 'Convoquee', color: 'bg-blue-100 text-blue-700' },
  EN_COURS: { label: 'En cours', color: 'bg-emerald-100 text-emerald-700' },
  SUSPENDUE: { label: 'Suspendue', color: 'bg-amber-100 text-amber-700' },
  CLOTUREE: { label: 'Cloturee', color: 'bg-purple-100 text-purple-700' },
  ARCHIVEE: { label: 'Archivee', color: 'bg-gray-100 text-gray-500' },
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  DELIBERATION: { label: 'Deliberation', color: 'bg-blue-50 text-blue-700' },
  INFORMATION: { label: 'Information', color: 'bg-slate-50 text-slate-600' },
  QUESTION_DIVERSE: { label: 'Question diverse', color: 'bg-amber-50 text-amber-700' },
  ELECTION: { label: 'Election', color: 'bg-purple-50 text-purple-700' },
  APPROBATION_PV: { label: 'Approbation PV', color: 'bg-emerald-50 text-emerald-700' },
}

const CONVOCATION_LABELS: Record<string, { label: string; color: string }> = {
  NON_ENVOYE: { label: 'Non envoye', color: 'bg-slate-100 text-slate-600' },
  ENVOYE: { label: 'Envoye', color: 'bg-blue-100 text-blue-700' },
  LU: { label: 'Lu', color: 'bg-cyan-100 text-cyan-700' },
  CONFIRME_PRESENT: { label: 'Confirme', color: 'bg-emerald-100 text-emerald-700' },
  ABSENT_PROCURATION: { label: 'Procuration', color: 'bg-amber-100 text-amber-700' },
  ERREUR_EMAIL: { label: 'Erreur', color: 'bg-red-100 text-red-700' },
  ENVOYE_COURRIER: { label: 'Courrier', color: 'bg-indigo-100 text-indigo-700' },
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })
  } catch { return dateStr }
}

function formatTime(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleTimeString('fr-FR', {
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return '' }
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function SeanceDetail({ seance, allMembers, instanceMemberIds, canManage }: SeanceDetailProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const statutConfig = STATUT_CONFIG[seance.statut || 'BROUILLON']
  const isBrouillon = seance.statut === 'BROUILLON'

  // ODJ state
  const [odjFormOpen, setOdjFormOpen] = useState(false)
  const [editingPoint, setEditingPoint] = useState<ODJPointRow | null>(null)
  const [deletePointDialog, setDeletePointDialog] = useState<ODJPointRow | null>(null)

  // Convocataire state
  const [addConvocataireOpen, setAddConvocataireOpen] = useState(false)

  // Status change
  const [statusChangeDialog, setStatusChangeDialog] = useState<string | null>(null)

  const ModeIcon = seance.mode === 'VISIO' ? Video : seance.mode === 'HYBRIDE' ? Monitor : Building2

  // Warnings
  const warnings: string[] = []
  if (!seance.secretaire_seance) warnings.push('Aucun secretaire de seance designe')
  if (seance.odj_points.length === 0) warnings.push("Aucun point a l'ordre du jour")
  if (seance.convocataires.length === 0) warnings.push('Aucun convocataire')

  function handleSendConvocations() {
    startTransition(async () => {
      const result = await sendConvocations(seance.id)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        if (result.sent > 0) {
          toast.success(`${result.sent} convocation${result.sent > 1 ? 's' : ''} envoyee${result.sent > 1 ? 's' : ''}`)
        }
        if (result.errors.length > 0) {
          toast.error(`${result.errors.length} erreur${result.errors.length > 1 ? 's' : ''} d'envoi`)
        }
        router.refresh()
      }
    })
  }

  function handleResendConvocation(memberId: string) {
    startTransition(async () => {
      const result = await resendConvocation(seance.id, memberId)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success('Convocation renvoyee')
        router.refresh()
      }
    })
  }

  function handleStatusChange(newStatut: string) {
    startTransition(async () => {
      const result = await updateSeanceStatut(
        seance.id,
        newStatut as 'BROUILLON' | 'CONVOQUEE' | 'EN_COURS' | 'SUSPENDUE' | 'CLOTUREE' | 'ARCHIVEE'
      )
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success(`Statut mis a jour: ${STATUT_CONFIG[newStatut]?.label || newStatut}`)
        router.refresh()
      }
      setStatusChangeDialog(null)
    })
  }

  function handleMovePoint(pointId: string, direction: 'up' | 'down') {
    const points = [...seance.odj_points]
    const idx = points.findIndex(p => p.id === pointId)
    if (idx < 0) return
    if (direction === 'up' && idx === 0) return
    if (direction === 'down' && idx === points.length - 1) return

    const newIdx = direction === 'up' ? idx - 1 : idx + 1
    ;[points[idx], points[newIdx]] = [points[newIdx], points[idx]]

    startTransition(async () => {
      const result = await reorderODJPoints(seance.id, points.map(p => p.id))
      if ('error' in result) toast.error(result.error)
      else router.refresh()
    })
  }

  function handleDeletePoint() {
    if (!deletePointDialog) return
    startTransition(async () => {
      const result = await deleteODJPoint(deletePointDialog.id, seance.id)
      if ('error' in result) toast.error(result.error)
      else {
        toast.success('Point supprime')
        router.refresh()
      }
      setDeletePointDialog(null)
    })
  }

  function handleRemoveConvocataire(memberId: string) {
    startTransition(async () => {
      const result = await removeConvocataire(seance.id, memberId)
      if ('error' in result) toast.error(result.error)
      else {
        toast.success('Convocataire retire')
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Header info + actions */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left: Info cards */}
        <div className="flex-1 space-y-4">
          {/* Status + key info */}
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center gap-3 mb-4">
              <Badge className={`${statutConfig.color} border-0 text-sm px-3 py-1`}>
                {statutConfig.label}
              </Badge>
              <Badge variant="outline">{seance.instance_config?.nom}</Badge>
              {seance.reconvocation && (
                <Badge variant="outline" className="border-amber-300 text-amber-700">Reconvocation</Badge>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">Date</p>
                <p className="font-medium flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                  {formatDate(seance.date_seance)}
                </p>
              </div>
              {seance.date_seance.includes('T') && (
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Heure</p>
                  <p className="font-medium flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    {formatTime(seance.date_seance)}
                  </p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">Mode</p>
                <p className="font-medium flex items-center gap-1.5">
                  <ModeIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  {seance.mode === 'PRESENTIEL' ? 'Presentiel' : seance.mode === 'HYBRIDE' ? 'Hybride' : 'Visio'}
                </p>
              </div>
              {seance.lieu && (
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Lieu</p>
                  <p className="font-medium flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    {seance.lieu}
                  </p>
                </div>
              )}
            </div>

            <Separator className="my-4" />

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">President(e)</p>
                <p className="font-medium">
                  {seance.president_effectif
                    ? `${seance.president_effectif.prenom} ${seance.president_effectif.nom}`
                    : 'Non designe'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">Secretaire</p>
                <p className="font-medium">
                  {seance.secretaire_seance
                    ? `${seance.secretaire_seance.prenom} ${seance.secretaire_seance.nom}`
                    : 'Non designe'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">Publique</p>
                <p className="font-medium">{seance.publique ? 'Oui' : 'Non (huis clos)'}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">Instance</p>
                <p className="font-medium">{seance.instance_config?.type_legal || '-'}</p>
              </div>
            </div>

            {seance.notes && (
              <>
                <Separator className="my-4" />
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Notes</p>
                  <p className="text-sm">{seance.notes}</p>
                </div>
              </>
            )}
          </div>

          {/* Warnings */}
          {warnings.length > 0 && isBrouillon && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <p className="text-sm font-medium text-amber-800">Points d&apos;attention</p>
              </div>
              <ul className="space-y-1">
                {warnings.map((w, i) => (
                  <li key={i} className="text-sm text-amber-700 flex items-center gap-2">
                    <span className="h-1 w-1 rounded-full bg-amber-500 shrink-0" />
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Right: Actions panel */}
        {canManage && (
          <div className="w-full lg:w-64 space-y-3">
            <div className="rounded-xl border bg-card p-4 space-y-3">
              <h3 className="font-semibold text-sm">Actions</h3>

              {isBrouillon && (
                <Button
                  className="w-full"
                  onClick={() => setStatusChangeDialog('CONVOQUEE')}
                  disabled={isPending}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Convoquer
                </Button>
              )}

              {(isBrouillon || seance.statut === 'CONVOQUEE') && (
                <Button
                  className="w-full"
                  variant={isBrouillon ? 'outline' : 'default'}
                  onClick={handleSendConvocations}
                  disabled={isPending}
                >
                  {isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Envoyer les convocations
                </Button>
              )}

              {seance.statut === 'CONVOQUEE' && (
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => setStatusChangeDialog('EN_COURS')}
                  disabled={isPending}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Ouvrir la seance
                </Button>
              )}

              {seance.statut === 'EN_COURS' && (
                <>
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => setStatusChangeDialog('SUSPENDUE')}
                    disabled={isPending}
                  >
                    Suspendre
                  </Button>
                  <Button
                    className="w-full bg-purple-600 hover:bg-purple-700"
                    onClick={() => setStatusChangeDialog('CLOTUREE')}
                    disabled={isPending}
                  >
                    Cloturer la seance
                  </Button>
                </>
              )}

              {seance.statut === 'SUSPENDUE' && (
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => setStatusChangeDialog('EN_COURS')}
                  disabled={isPending}
                >
                  Reprendre la seance
                </Button>
              )}

              <div className="pt-2 space-y-1.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <FileText className="h-3 w-3" />
                  {seance.odj_points.length} point{seance.odj_points.length !== 1 ? 's' : ''} ODJ
                </div>
                <div className="flex items-center gap-1.5">
                  <Users className="h-3 w-3" />
                  {seance.convocataires.length} convocataire{seance.convocataires.length !== 1 ? 's' : ''}
                </div>
                {seance.instance_config?.composition_max && (
                  <div className="flex items-center gap-1.5">
                    <Info className="h-3 w-3" />
                    Quorum: {Math.ceil((seance.instance_config.composition_max * (seance.instance_config.quorum_fraction_numerateur || 1)) / (seance.instance_config.quorum_fraction_denominateur || 2))} membres
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ODJ Section */}
      <div className="rounded-xl border bg-card">
        <div className="flex items-center justify-between p-5 pb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            Ordre du jour
          </h2>
          {canManage && isBrouillon && (
            <Button
              size="sm"
              onClick={() => { setEditingPoint(null); setOdjFormOpen(true) }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Ajouter un point
            </Button>
          )}
        </div>

        {seance.odj_points.length === 0 ? (
          <div className="px-5 pb-5">
            <div className="text-center py-8 rounded-lg border border-dashed">
              <FileText className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">Aucun point a l&apos;ordre du jour</p>
              {canManage && isBrouillon && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => { setEditingPoint(null); setOdjFormOpen(true) }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Ajouter le premier point
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="px-5 pb-5 space-y-2">
            {seance.odj_points.map((point, idx) => {
              const typeConfig = TYPE_LABELS[point.type_traitement || 'DELIBERATION']
              return (
                <div
                  key={point.id}
                  className="flex items-start gap-3 rounded-lg border p-3 hover:bg-muted/30 transition-colors"
                >
                  {/* Position & drag */}
                  <div className="flex flex-col items-center gap-1 pt-0.5">
                    {canManage && isBrouillon && (
                      <button
                        onClick={() => handleMovePoint(point.id, 'up')}
                        disabled={idx === 0 || isPending}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-bold">
                      {point.position}
                    </span>
                    {canManage && isBrouillon && (
                      <button
                        onClick={() => handleMovePoint(point.id, 'down')}
                        disabled={idx === seance.odj_points.length - 1 || isPending}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={`${typeConfig.color} border-0 text-[11px] px-2 py-0`}>
                        {typeConfig.label}
                      </Badge>
                      {point.huis_clos && (
                        <Badge variant="outline" className="text-[11px] px-2 py-0 border-red-200 text-red-600">
                          <Shield className="h-3 w-3 mr-0.5" />
                          Huis clos
                        </Badge>
                      )}
                      {point.majorite_requise && point.majorite_requise !== 'SIMPLE' && (
                        <Badge variant="outline" className="text-[11px] px-2 py-0">
                          Majorite {point.majorite_requise.toLowerCase()}
                        </Badge>
                      )}
                    </div>
                    <h4 className="text-sm font-medium text-foreground">{point.titre}</h4>
                    {point.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{point.description}</p>
                    )}
                  </div>

                  {/* Actions */}
                  {canManage && isBrouillon && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setEditingPoint(point); setOdjFormOpen(true) }}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Modifier
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDeletePointDialog(point)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Convocataires Section */}
      <div className="rounded-xl border bg-card">
        <div className="flex items-center justify-between p-5 pb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            Convocataires ({seance.convocataires.length})
          </h2>
          {canManage && isBrouillon && (
            <Button size="sm" variant="outline" onClick={() => setAddConvocataireOpen(true)}>
              <UserPlus className="h-4 w-4 mr-1" />
              Ajouter
            </Button>
          )}
        </div>

        {seance.convocataires.length === 0 ? (
          <div className="px-5 pb-5">
            <div className="text-center py-8 rounded-lg border border-dashed">
              <Users className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">Aucun convocataire</p>
            </div>
          </div>
        ) : (
          <div className="px-5 pb-5">
            <div className="divide-y rounded-lg border">
              {seance.convocataires.map(conv => {
                const convConfig = CONVOCATION_LABELS[conv.statut_convocation || 'NON_ENVOYE']
                return (
                  <div key={conv.id} className="flex items-center justify-between px-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-bold">
                        {conv.member?.prenom?.[0]}{conv.member?.nom?.[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {conv.member?.prenom} {conv.member?.nom}
                        </p>
                        <p className="text-xs text-muted-foreground">{conv.member?.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={`${convConfig.color} border-0 text-[11px]`}>
                        {convConfig.label}
                      </Badge>
                      {canManage && (conv.statut_convocation === 'ENVOYE' || conv.statut_convocation === 'ERREUR_EMAIL') && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-blue-600"
                          onClick={() => handleResendConvocation(conv.member_id)}
                          disabled={isPending}
                          title="Renvoyer la convocation"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {canManage && isBrouillon && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemoveConvocataire(conv.member_id)}
                          disabled={isPending}
                        >
                          <UserMinus className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ODJ Form Dialog */}
      <ODJPointFormDialog
        open={odjFormOpen}
        onClose={() => { setOdjFormOpen(false); setEditingPoint(null) }}
        point={editingPoint}
        seanceId={seance.id}
        members={allMembers}
        defaultMajorite={seance.instance_config?.majorite_defaut || 'SIMPLE'}
      />

      {/* Delete point confirmation */}
      <AlertDialog open={!!deletePointDialog} onOpenChange={() => setDeletePointDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce point ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le point &quot;{deletePointDialog?.titre}&quot; sera supprime de l&apos;ordre du jour.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePoint}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Status change confirmation */}
      <AlertDialog open={!!statusChangeDialog} onOpenChange={() => setStatusChangeDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {statusChangeDialog === 'CONVOQUEE' && 'Convoquer la seance ?'}
              {statusChangeDialog === 'EN_COURS' && 'Ouvrir la seance ?'}
              {statusChangeDialog === 'SUSPENDUE' && 'Suspendre la seance ?'}
              {statusChangeDialog === 'CLOTUREE' && 'Cloturer la seance ?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {statusChangeDialog === 'CONVOQUEE' && (
                <>Les convocations pourront etre envoyees aux membres. {warnings.length > 0 && `Attention: ${warnings.join(', ')}`}</>
              )}
              {statusChangeDialog === 'EN_COURS' && 'La seance sera ouverte et les votes pourront commencer.'}
              {statusChangeDialog === 'SUSPENDUE' && 'La seance sera suspendue temporairement.'}
              {statusChangeDialog === 'CLOTUREE' && 'La seance sera cloturee. Le PV pourra etre redige.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => statusChangeDialog && handleStatusChange(statusChangeDialog)}
              disabled={isPending}
            >
              {isPending ? 'En cours...' : 'Confirmer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add convocataire dialog */}
      <AddConvocataireDialog
        open={addConvocataireOpen}
        onClose={() => setAddConvocataireOpen(false)}
        seanceId={seance.id}
        existingMemberIds={seance.convocataires.map(c => c.member_id)}
        allMembers={allMembers}
        instanceMemberIds={instanceMemberIds}
      />
    </div>
  )
}

// ─── ODJ Point Form Dialog ───────────────────────────────────────────────────

function ODJPointFormDialog({
  open,
  onClose,
  point,
  seanceId,
  members,
  defaultMajorite,
}: {
  open: boolean
  onClose: () => void
  point: ODJPointRow | null
  seanceId: string
  members: MemberOption[]
  defaultMajorite: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const isEditing = !!point

  const [titre, setTitre] = useState(point?.titre || '')
  const [description, setDescription] = useState(point?.description || '')
  const [typeTraitement, setTypeTraitement] = useState<string>(point?.type_traitement || 'DELIBERATION')
  const [majoriteRequise, setMajoriteRequise] = useState<string>(point?.majorite_requise || defaultMajorite)
  const [rapporteurId, setRapporteurId] = useState(point?.rapporteur_id || '')
  const [huisClos, setHuisClos] = useState(point?.huis_clos || false)
  const [votesInterdits, setVotesInterdits] = useState(point?.votes_interdits || false)

  // Reset
  const resetKey = `${point?.id || 'new'}-${open}`
  const [lastResetKey, setLastResetKey] = useState(resetKey)
  if (resetKey !== lastResetKey) {
    setLastResetKey(resetKey)
    setTitre(point?.titre || '')
    setDescription(point?.description || '')
    setTypeTraitement(point?.type_traitement || 'DELIBERATION')
    setMajoriteRequise(point?.majorite_requise || defaultMajorite)
    setRapporteurId(point?.rapporteur_id || '')
    setHuisClos(point?.huis_clos || false)
    setVotesInterdits(point?.votes_interdits || false)
  }

  function handleSubmit() {
    if (!titre.trim()) { toast.error('Le titre est requis'); return }

    startTransition(async () => {
      const formData = new FormData()
      if (point?.id) formData.set('id', point.id)
      formData.set('seance_id', seanceId)
      formData.set('titre', titre.trim())
      formData.set('description', description.trim())
      formData.set('type_traitement', typeTraitement)
      formData.set('majorite_requise', majoriteRequise)
      if (rapporteurId) formData.set('rapporteur_id', rapporteurId)
      formData.set('huis_clos', huisClos ? 'true' : 'false')
      formData.set('votes_interdits', votesInterdits ? 'true' : 'false')

      const result = isEditing
        ? await updateODJPoint(formData)
        : await addODJPoint(formData)

      if ('error' in result) {
        toast.error(result.error)
        return
      }

      toast.success(isEditing ? 'Point mis a jour' : 'Point ajoute')
      router.refresh()
      onClose()
    })
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Modifier le point' : 'Nouveau point ODJ'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Modifiez ce point de l\'ordre du jour.' : 'Ajoutez un point a l\'ordre du jour.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="odj_titre">Titre *</Label>
            <Input
              id="odj_titre"
              value={titre}
              onChange={e => setTitre(e.target.value)}
              placeholder="Approbation du PV de la seance precedente"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="odj_description">Description</Label>
            <Textarea
              id="odj_description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Details du point..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={typeTraitement} onValueChange={setTypeTraitement}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DELIBERATION">Deliberation</SelectItem>
                  <SelectItem value="INFORMATION">Information</SelectItem>
                  <SelectItem value="QUESTION_DIVERSE">Question diverse</SelectItem>
                  <SelectItem value="ELECTION">Election</SelectItem>
                  <SelectItem value="APPROBATION_PV">Approbation PV</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Majorite requise</Label>
              <Select value={majoriteRequise} onValueChange={setMajoriteRequise}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SIMPLE">Simple</SelectItem>
                  <SelectItem value="ABSOLUE">Absolue</SelectItem>
                  <SelectItem value="QUALIFIEE">Qualifiee</SelectItem>
                  <SelectItem value="UNANIMITE">Unanimite</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Rapporteur</Label>
            <Select value={rapporteurId} onValueChange={setRapporteurId}>
              <SelectTrigger>
                <SelectValue placeholder="Aucun rapporteur" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Aucun</SelectItem>
                {members.map(m => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.prenom} {m.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label className="font-medium">Huis clos</Label>
                <p className="text-xs text-muted-foreground">Ce point se traite a huis clos</p>
              </div>
              <Switch checked={huisClos} onCheckedChange={setHuisClos} />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label className="font-medium">Sans vote</Label>
                <p className="text-xs text-muted-foreground">Point d&apos;information uniquement</p>
              </div>
              <Switch checked={votesInterdits} onCheckedChange={setVotesInterdits} />
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEditing ? 'Enregistrer' : 'Ajouter'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Add Convocataire Dialog ─────────────────────────────────────────────────

function AddConvocataireDialog({
  open,
  onClose,
  seanceId,
  existingMemberIds,
  allMembers,
  instanceMemberIds,
}: {
  open: boolean
  onClose: () => void
  seanceId: string
  existingMemberIds: string[]
  allMembers: MemberOption[]
  instanceMemberIds: string[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState('')

  const availableMembers = allMembers.filter(m => !existingMemberIds.includes(m.id))
  const filtered = availableMembers.filter(m => {
    if (!search) return true
    const q = search.toLowerCase()
    return `${m.prenom} ${m.nom}`.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
  })

  // Sort: instance members first
  const sorted = [...filtered].sort((a, b) => {
    const aInst = instanceMemberIds.includes(a.id) ? 0 : 1
    const bInst = instanceMemberIds.includes(b.id) ? 0 : 1
    if (aInst !== bInst) return aInst - bInst
    return a.nom.localeCompare(b.nom)
  })

  function handleAdd(memberId: string) {
    startTransition(async () => {
      const result = await addConvocataire(seanceId, memberId)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success('Convocataire ajoute')
        router.refresh()
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Ajouter un convocataire</DialogTitle>
          <DialogDescription>
            Selectionnez un membre a convoquer pour cette seance.
          </DialogDescription>
        </DialogHeader>

        <Input
          placeholder="Rechercher un membre..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="mt-2"
        />

        <div className="max-h-[300px] overflow-y-auto space-y-1 mt-2">
          {sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {availableMembers.length === 0
                ? 'Tous les membres sont deja convoques'
                : 'Aucun resultat'}
            </p>
          ) : (
            sorted.map(m => (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-lg border p-2.5 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-bold">
                    {m.prenom[0]}{m.nom[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {m.prenom} {m.nom}
                      {instanceMemberIds.includes(m.id) && (
                        <span className="text-xs text-muted-foreground ml-1">(membre instance)</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{m.email}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAdd(m.id)}
                  disabled={isPending}
                >
                  <UserPlus className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
