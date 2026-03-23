'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
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
import { Clock, AlertTriangle, Info, Loader2, UserPlus, Play } from 'lucide-react'
import { handleLateArrival } from '@/lib/actions/phase2-features'
import { updateSeanceStatut } from '@/lib/actions/seances'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MemberInfo {
  id: string
  prenom: string
  nom: string
}

interface PresenceItem {
  member_id: string
  statut: string | null
  heure_arrivee: string | null
  arrivee_tardive?: boolean | null
}

interface LateArrivalBannerProps {
  seanceId: string
  lateArrivalMode: 'STRICT' | 'SOUPLE' | 'SUSPENDU'
  presences: PresenceItem[]
  convocataires: { member_id: string; member: MemberInfo | null }[]
  seanceStatut: string | null
  onRefresh: () => void
}

// ─── Mode labels and descriptions ────────────────────────────────────────────

const MODE_INFO: Record<string, { label: string; description: string; color: string }> = {
  STRICT: {
    label: 'Strict',
    description: 'Les retardataires sont marqués présents mais ne participent pas aux votes en cours.',
    color: 'bg-red-100 text-red-700 border-red-200',
  },
  SOUPLE: {
    label: 'Souple',
    description: 'Les retardataires sont acceptés normalement. Le quorum est recalculé.',
    color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  },
  SUSPENDU: {
    label: 'Suspendu',
    description: 'La séance est automatiquement suspendue à l\'arrivée d\'un retardataire.',
    color: 'bg-amber-100 text-amber-700 border-amber-200',
  },
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LateArrivalBanner({
  seanceId,
  lateArrivalMode,
  presences,
  convocataires,
  seanceStatut,
  onRefresh,
}: LateArrivalBannerProps) {
  const [isPending, startTransition] = useTransition()
  const [selectedMember, setSelectedMember] = useState<MemberInfo | null>(null)
  const [resumeDialog, setResumeDialog] = useState(false)

  const modeInfo = MODE_INFO[lateArrivalMode] || MODE_INFO.SOUPLE

  // Find absent members (convoqués but not present)
  const presentMemberIds = new Set(
    presences.filter(p => p.statut === 'PRESENT' || p.statut === 'PROCURATION').map(p => p.member_id)
  )
  const absentMembers = convocataires
    .filter(c => c.member && !presentMemberIds.has(c.member_id))
    .map(c => c.member!)

  // Count late arrivals
  const lateArrivals = presences.filter(p => p.arrivee_tardive)

  // Handle marking a member as late arrival
  function handleMarkLateArrival(member: MemberInfo) {
    setSelectedMember(member)
  }

  function confirmLateArrival() {
    if (!selectedMember) return
    startTransition(async () => {
      const result = await handleLateArrival(seanceId, selectedMember.id)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success(result.message)
        if (result.mode === 'SUSPENDU') {
          setResumeDialog(true)
        }
        onRefresh()
      }
      setSelectedMember(null)
    })
  }

  function handleResume() {
    startTransition(async () => {
      const result = await updateSeanceStatut(seanceId, 'EN_COURS')
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success('Séance reprise')
        onRefresh()
      }
      setResumeDialog(false)
    })
  }

  // Only show when séance is EN_COURS or SUSPENDUE
  if (seanceStatut !== 'EN_COURS' && seanceStatut !== 'SUSPENDUE') return null

  return (
    <>
      {/* Mode indicator in sidebar */}
      <div className="rounded-xl border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Arrivées tardives
          </h3>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge className={`text-xs border ${modeInfo.color}`}>
                  {modeInfo.label}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-[250px]">
                <p className="text-xs">{modeInfo.description}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Late arrivals count */}
        {lateArrivals.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            {lateArrivals.length} arrivée{lateArrivals.length > 1 ? 's' : ''} tardive{lateArrivals.length > 1 ? 's' : ''}
            {lateArrivalMode === 'STRICT' && (
              <span className="text-red-600 ml-1">(vote limité)</span>
            )}
          </div>
        )}

        {/* Absent members who could arrive late */}
        {absentMembers.length > 0 ? (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">
              {absentMembers.length} membre{absentMembers.length > 1 ? 's' : ''} absent{absentMembers.length > 1 ? 's' : ''} :
            </p>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {absentMembers.map(member => (
                <div
                  key={member.id}
                  className="flex items-center justify-between text-xs rounded-lg px-2 py-1.5 hover:bg-muted/50 transition-colors"
                >
                  <span className="truncate">{member.prenom} {member.nom}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs shrink-0"
                    onClick={() => handleMarkLateArrival(member)}
                    disabled={isPending}
                    title={`Marquer ${member.prenom} ${member.nom} comme arrivé(e) en retard`}
                  >
                    <UserPlus className="h-3.5 w-3.5 mr-1" />
                    Arrivé(e)
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-1">
            Tous les membres sont présents
          </p>
        )}
      </div>

      {/* Confirmation dialog for late arrival */}
      <AlertDialog open={!!selectedMember} onOpenChange={() => setSelectedMember(null)}>
        <AlertDialogContent aria-describedby={undefined}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Enregistrer une arrivée tardive ?
            </AlertDialogTitle>
            <div className="space-y-3 mt-2">
              <p className="text-sm text-muted-foreground">
                <strong>{selectedMember?.prenom} {selectedMember?.nom}</strong> est arrivé(e) en retard.
              </p>

              <div className={`rounded-lg border p-3 ${
                lateArrivalMode === 'STRICT' ? 'bg-red-50 border-red-200' :
                lateArrivalMode === 'SUSPENDU' ? 'bg-amber-50 border-amber-200' :
                'bg-emerald-50 border-emerald-200'
              }`}>
                <div className="flex items-start gap-2">
                  {lateArrivalMode === 'STRICT' ? (
                    <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                  ) : (
                    <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  )}
                  <div className="text-xs">
                    <p className="font-medium mb-1">Mode : {modeInfo.label}</p>
                    <p>{modeInfo.description}</p>
                  </div>
                </div>
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmLateArrival} disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirmer l&apos;arrivée
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Resume dialog after SUSPENDU mode */}
      <AlertDialog open={resumeDialog} onOpenChange={setResumeDialog}>
        <AlertDialogContent aria-describedby={undefined}>
          <AlertDialogHeader>
            <AlertDialogTitle>Séance suspendue</AlertDialogTitle>
            <div className="space-y-2 mt-2">
              <p className="text-sm text-muted-foreground">
                La séance a été suspendue suite à l&apos;arrivée tardive d&apos;un membre (mode SUSPENDU).
              </p>
              <p className="text-sm text-muted-foreground">
                Voulez-vous reprendre la séance maintenant ?
              </p>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Rester en pause</AlertDialogCancel>
            <AlertDialogAction onClick={handleResume} disabled={isPending} className="bg-emerald-600 hover:bg-emerald-700">
              {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              <Play className="h-4 w-4 mr-1.5" />
              Reprendre la séance
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
