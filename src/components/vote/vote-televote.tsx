'use client'

import { useState, useTransition, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
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
  CheckCircle2,
  Loader2,
  Smartphone,
  Send,
  RefreshCw,
  AlertTriangle,
  Clock,
  Ban,
  Phone,
  XCircle,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Square,
} from 'lucide-react'
import {
  openVoteTelevote,
  closeVoteTelevote,
  getTelevoteProgress,
  resendTelevoteOTP,
  cancelVote,
} from '@/lib/actions/votes'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MemberForTelevote {
  id: string
  prenom: string
  nom: string
  telephone: string | null
}

interface VoteTelevoteProps {
  seanceId: string
  odjPointId: string
  odjPointTitre: string
  odjPointMajorite: string
  totalPresents: number
  voixPreponderante: boolean
  members: MemberForTelevote[]
  existingVote: {
    id: string
    statut: string | null
    type_vote: string | null
    pour: number | null
    contre: number | null
    abstention: number | null
    total_votants: number | null
    resultat: string | null
    formule_pv: string | null
  } | null
  onVoteComplete: () => void
}

interface ProgressMember {
  memberId: string
  nom: string
  prenom: string
  maskedPhone: string | null
  hasVoted: boolean
  otpExpired: boolean
  resendCount: number
}

// ─── Component ────────────────────────────────────────────────────────────────

export function VoteTelevote({
  seanceId,
  odjPointId,
  odjPointTitre,
  members,
  existingVote,
  onVoteComplete,
}: VoteTelevoteProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set())
  const [confirmDialog, setConfirmDialog] = useState<'open' | 'close' | 'cancel' | null>(null)
  const [voteId, setVoteId] = useState<string | null>(existingVote?.id || null)
  const [progress, setProgress] = useState<ProgressMember[]>([])
  const [votedCount, setVotedCount] = useState(0)
  const [totalVotants, setTotalVotants] = useState(existingVote?.total_votants || 0)
  const [smsSending, setSMSSending] = useState(false)
  const [resendingMemberId, setResendingMemberId] = useState<string | null>(null)

  const isVoteOpen = existingVote?.statut === 'OUVERT' && existingVote?.type_vote === 'TELEVOTE'
  const isVoteClosed = existingVote?.statut === 'CLOS'

  // Members with phone numbers
  const membersWithPhone = members.filter(m => m.telephone)
  const membersWithoutPhone = members.filter(m => !m.telephone)

  // Select all with phone
  function handleSelectAll() {
    if (selectedMemberIds.size === membersWithPhone.length) {
      setSelectedMemberIds(new Set())
    } else {
      setSelectedMemberIds(new Set(membersWithPhone.map(m => m.id)))
    }
  }

  function toggleMember(id: string) {
    setSelectedMemberIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Mask phone number for display
  function maskPhone(phone: string): string {
    const cleaned = phone.replace(/\s/g, '')
    if (cleaned.startsWith('+33') && cleaned.length >= 12) {
      return `+33 6 ** ** ** ${cleaned.slice(-2)}`
    }
    if (cleaned.startsWith('0') && cleaned.length >= 10) {
      return `${cleaned.slice(0, 2)} ** ** ** ${cleaned.slice(-2)}`
    }
    return cleaned.slice(0, 2) + '****' + cleaned.slice(-2)
  }

  // Poll progress when vote is open
  const refreshProgress = useCallback(async () => {
    if (!voteId) return
    const result = await getTelevoteProgress(voteId)
    if ('error' in result) return
    setProgress(result.members)
    setVotedCount(result.votedCount)
    setTotalVotants(result.totalVotants)
  }, [voteId])

  useEffect(() => {
    if (!isVoteOpen || !voteId) return
    refreshProgress()
    const interval = setInterval(refreshProgress, 5000) // Poll every 5s
    return () => clearInterval(interval)
  }, [isVoteOpen, voteId, refreshProgress])

  // ─── Open Televote ─────────────────────────────────────────────────────

  function handleOpenVote() {
    if (selectedMemberIds.size === 0) {
      toast.error('Sélectionnez au moins un membre pour le télévote')
      return
    }
    setConfirmDialog('open')
  }

  function confirmOpenVote() {
    setConfirmDialog(null)
    setSMSSending(true)
    startTransition(async () => {
      const result = await openVoteTelevote(
        seanceId,
        odjPointId,
        Array.from(selectedMemberIds)
      )

      setSMSSending(false)

      if ('error' in result) {
        toast.error(result.error)
        return
      }

      setVoteId(result.voteId)
      setTotalVotants(result.totalVotants)

      // Show SMS status
      const sentCount = result.smsStatuses.filter(s => s.sent).length
      const failCount = result.smsStatuses.filter(s => !s.sent).length

      if (failCount > 0) {
        toast.warning(`${sentCount} SMS envoyé${sentCount > 1 ? 's' : ''}, ${failCount} échec${failCount > 1 ? 's' : ''}`)
      } else {
        toast.success(`${sentCount} SMS envoyé${sentCount > 1 ? 's' : ''} avec succès`)
      }

      router.refresh()
    })
  }

  // ─── Close Televote ────────────────────────────────────────────────────

  function confirmCloseVote() {
    setConfirmDialog(null)
    if (!voteId && !existingVote?.id) return
    startTransition(async () => {
      const result = await closeVoteTelevote(voteId || existingVote!.id)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success('Télévote clôturé')
      onVoteComplete()
      router.refresh()
    })
  }

  // ─── Cancel ────────────────────────────────────────────────────────────

  function confirmCancelVote() {
    setConfirmDialog(null)
    if (!voteId && !existingVote?.id) return
    startTransition(async () => {
      const result = await cancelVote(voteId || existingVote!.id)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success('Télévote annulé')
      onVoteComplete()
      router.refresh()
    })
  }

  // ─── Resend OTP ────────────────────────────────────────────────────────

  async function handleResend(memberId: string) {
    if (!voteId && !existingVote?.id) return
    setResendingMemberId(memberId)
    const result = await resendTelevoteOTP(voteId || existingVote!.id, memberId)
    setResendingMemberId(null)
    if ('error' in result) {
      toast.error(result.error)
      return
    }
    toast.success('Nouveau code SMS envoyé')
    refreshProgress()
  }

  // ─── Render: Vote closed ──────────────────────────────────────────────

  if (isVoteClosed && existingVote) {
    const r = existingVote.resultat
    const isAdopted = r === 'ADOPTE' || r === 'ADOPTE_UNANIMITE' || r === 'ADOPTE_VOIX_PREPONDERANTE'
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge variant={isAdopted ? 'default' : 'destructive'} className="text-sm">
            {r === 'ADOPTE_UNANIMITE' ? 'Adopté à l\'unanimité' :
             r === 'ADOPTE_VOIX_PREPONDERANTE' ? 'Adopté (voix prépondérante)' :
             r === 'ADOPTE' ? 'Adopté' :
             r === 'REJETE' ? 'Rejeté' : 'Nul'}
          </Badge>
          <Badge variant="outline" className="text-xs">
            <Smartphone className="h-3 w-3 mr-1" /> Télévote
          </Badge>
        </div>
        <div className="text-sm text-muted-foreground grid grid-cols-3 gap-2">
          <div className="text-center">
            <span className="font-bold text-emerald-600">{existingVote.pour ?? 0}</span>
            <span className="block text-xs">Pour</span>
          </div>
          <div className="text-center">
            <span className="font-bold text-red-600">{existingVote.contre ?? 0}</span>
            <span className="block text-xs">Contre</span>
          </div>
          <div className="text-center">
            <span className="font-bold text-gray-500">{existingVote.abstention ?? 0}</span>
            <span className="block text-xs">Abstention</span>
          </div>
        </div>
        {existingVote.formule_pv && (
          <p className="text-xs text-muted-foreground italic border-l-2 pl-3">
            {existingVote.formule_pv}
          </p>
        )}
      </div>
    )
  }

  // ─── Render: Vote in progress ─────────────────────────────────────────

  if (isVoteOpen) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge className="bg-orange-100 text-orange-700 animate-pulse">
            <Smartphone className="h-3 w-3 mr-1" /> Télévote en cours
          </Badge>
          <span className="text-sm text-muted-foreground">
            {votedCount}/{totalVotants} ont voté
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div
            className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
            style={{ width: `${totalVotants > 0 ? (votedCount / totalVotants) * 100 : 0}%` }}
          />
        </div>

        {/* Member status list */}
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {progress.map(member => (
            <div
              key={member.memberId}
              className="flex items-center justify-between p-2 rounded-lg bg-muted/50 text-sm"
            >
              <div className="flex items-center gap-2">
                {member.hasVoted ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : member.otpExpired ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                      </TooltipTrigger>
                      <TooltipContent>Code expiré</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  <Clock className="h-4 w-4 text-gray-400" />
                )}
                <span>{member.prenom} {member.nom}</span>
                <span className="text-xs text-muted-foreground">{member.maskedPhone}</span>
              </div>
              {!member.hasVoted && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        disabled={resendingMemberId === member.memberId || member.resendCount >= 3}
                        onClick={() => handleResend(member.memberId)}
                      >
                        {resendingMemberId === member.memberId ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3" />
                        )}
                        <span className="ml-1 text-xs">
                          {member.resendCount >= 3 ? 'Max atteint' : 'Renvoyer'}
                        </span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {member.resendCount >= 3
                        ? 'Nombre maximum de renvois atteint (3)'
                        : `Renvoyer le code SMS (${member.resendCount}/3 renvois)`}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          ))}
        </div>

        <Separator />

        {/* Actions */}
        <div className="flex gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => setConfirmDialog('close')}
                  disabled={isPending || votedCount === 0}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Clôturer le vote
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {votedCount === 0
                  ? 'Attendez qu\'au moins un membre ait voté'
                  : `Clôturer avec ${votedCount} vote${votedCount > 1 ? 's' : ''} sur ${totalVotants}`}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  onClick={() => setConfirmDialog('cancel')}
                  disabled={isPending}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Ban className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Annuler le télévote</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Confirm dialogs */}
        <AlertDialog open={confirmDialog === 'close'} onOpenChange={() => setConfirmDialog(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clôturer le télévote ?</AlertDialogTitle>
            </AlertDialogHeader>
            <p className="text-sm text-muted-foreground">
              {votedCount} vote{votedCount > 1 ? 's' : ''} sur {totalVotants} enregistré{votedCount > 1 ? 's' : ''}.
              {votedCount < totalVotants && (
                <span className="text-orange-600 block mt-1">
                  {totalVotants - votedCount} membre{totalVotants - votedCount > 1 ? 's' : ''} n&apos;{totalVotants - votedCount > 1 ? 'ont' : 'a'} pas encore voté.
                </span>
              )}
            </p>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={confirmCloseVote}>Clôturer</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={confirmDialog === 'cancel'} onOpenChange={() => setConfirmDialog(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Annuler le télévote ?</AlertDialogTitle>
            </AlertDialogHeader>
            <p className="text-sm text-muted-foreground">
              Cette action est irréversible. Les {votedCount} vote{votedCount > 1 ? 's' : ''} déjà enregistré{votedCount > 1 ? 's' : ''} seront perdus.
            </p>
            <AlertDialogFooter>
              <AlertDialogCancel>Retour</AlertDialogCancel>
              <AlertDialogAction onClick={confirmCancelVote} className="bg-red-600 hover:bg-red-700">
                Annuler le vote
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    )
  }

  // ─── Render: Member selection (pre-vote) ──────────────────────────────

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Smartphone className="h-5 w-5 text-blue-600" />
        <h3 className="font-medium text-sm">Télévote par SMS</h3>
      </div>

      <p className="text-xs text-muted-foreground">
        Sélectionnez les membres qui voteront à distance. Un code à usage unique sera envoyé par SMS.
      </p>

      {/* Select all */}
      {membersWithPhone.length > 1 && (
        <div className="flex items-center gap-2 py-1">
          <Checkbox
            id="select-all-televote"
            checked={selectedMemberIds.size === membersWithPhone.length}
            onCheckedChange={handleSelectAll}
          />
          <label htmlFor="select-all-televote" className="text-sm cursor-pointer">
            Tout sélectionner ({membersWithPhone.length} membre{membersWithPhone.length > 1 ? 's' : ''})
          </label>
        </div>
      )}

      {/* Member list */}
      <div className="space-y-1 max-h-52 overflow-y-auto">
        {membersWithPhone.map(member => (
          <div
            key={member.id}
            className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
              selectedMemberIds.has(member.id) ? 'bg-blue-50 border border-blue-200' : 'hover:bg-muted/50'
            }`}
            onClick={() => toggleMember(member.id)}
          >
            <Checkbox
              checked={selectedMemberIds.has(member.id)}
              onCheckedChange={() => toggleMember(member.id)}
            />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium">{member.prenom} {member.nom}</span>
            </div>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {maskPhone(member.telephone!)}
            </span>
          </div>
        ))}
      </div>

      {/* Members without phone warning */}
      {membersWithoutPhone.length > 0 && (
        <div className="flex items-start gap-2 p-2 rounded-lg bg-orange-50 text-orange-700 text-xs">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-medium">Sans numéro de téléphone :</span>{' '}
            {membersWithoutPhone.map(m => `${m.prenom} ${m.nom}`).join(', ')}
          </div>
        </div>
      )}

      {membersWithPhone.length === 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
          <XCircle className="h-5 w-5" />
          <span>Aucun membre n&apos;a de numéro de téléphone. Mettez à jour les fiches membres.</span>
        </div>
      )}

      {/* Open vote button */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="block">
              <Button
                onClick={handleOpenVote}
                disabled={isPending || smsSending || selectedMemberIds.size === 0 || membersWithPhone.length === 0}
                className="w-full bg-blue-600 hover:bg-blue-700 h-12"
              >
                {(isPending || smsSending) ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Envoi des SMS...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Ouvrir le télévote ({selectedMemberIds.size} membre{selectedMemberIds.size > 1 ? 's' : ''})
                  </>
                )}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {selectedMemberIds.size === 0
              ? 'Sélectionnez au moins un membre'
              : `Envoyer un code de vote par SMS à ${selectedMemberIds.size} membre${selectedMemberIds.size > 1 ? 's' : ''}`}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Confirm open dialog */}
      <AlertDialog open={confirmDialog === 'open'} onOpenChange={() => setConfirmDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ouvrir le télévote ?</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              Un code à usage unique sera envoyé par SMS à {selectedMemberIds.size} membre{selectedMemberIds.size > 1 ? 's' : ''}.
            </p>
            <p className="font-medium text-foreground">
              &laquo; {odjPointTitre} &raquo;
            </p>
            <p className="text-xs">
              Les codes expireront après 8 minutes.
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmOpenVote} className="bg-blue-600 hover:bg-blue-700">
              <Send className="h-4 w-4 mr-2" />
              Envoyer les SMS
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
