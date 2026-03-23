'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { FileText, CheckCircle2, XCircle, Loader2, ExternalLink, Info } from 'lucide-react'
import { handlePVApprovalResult } from '@/lib/actions/phase2-features'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PVApprovalInfo {
  pvId: string
  seanceId: string
  seanceTitre: string
  seanceDate: string
  pvStatut: string
  pdfUrl: string | null
}

interface VoteItem {
  id: string
  odj_point_id: string
  statut: string | null
  resultat: string | null
}

interface ODJPoint {
  id: string
  type_traitement: string
  pv_precedent_seance_id?: string | null
}

interface PVApprovalBannerProps {
  pvApprovalInfo: PVApprovalInfo | null
  seanceId: string
  currentPoint: ODJPoint | null
  votes: VoteItem[]
  onRefresh: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PVApprovalBanner({
  pvApprovalInfo,
  seanceId,
  currentPoint,
  votes,
  onRefresh,
}: PVApprovalBannerProps) {
  const [isPending, startTransition] = useTransition()

  if (!pvApprovalInfo) return null

  const pvDate = new Date(pvApprovalInfo.seanceDate).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  // Check if we're on the APPROBATION_PV point
  const isOnApprovalPoint = currentPoint?.type_traitement === 'APPROBATION_PV'

  // Check if vote has been completed for this point
  const approvalVote = isOnApprovalPoint
    ? votes.find(v => v.odj_point_id === currentPoint?.id && v.statut === 'CLOS')
    : null

  // Auto-handle PV status after vote
  function handleApprovalVoteResult(result: 'ADOPTE' | 'REJETE') {
    if (!currentPoint) return
    startTransition(async () => {
      const res = await handlePVApprovalResult(currentPoint.id, seanceId, result)
      if ('error' in res) {
        toast.error(res.error)
      } else {
        if (result === 'ADOPTE') {
          toast.success(`Le procès-verbal de la séance du ${pvDate} est approuvé.`)
        } else {
          toast.info('Le procès-verbal est rejeté. Des modifications sont nécessaires.')
        }
        onRefresh()
      }
    })
  }

  // If vote was completed and has a result, show post-vote action
  if (approvalVote && approvalVote.resultat) {
    const isAdopted = approvalVote.resultat === 'ADOPTE'
    return (
      <Card className={`border ${isAdopted ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
        <CardContent className="p-3">
          <div className="flex items-start gap-2">
            {isAdopted ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-medium ${isAdopted ? 'text-emerald-800' : 'text-red-800'}`}>
                {isAdopted
                  ? `Procès-verbal du ${pvDate} approuvé`
                  : `Procès-verbal du ${pvDate} rejeté`}
              </p>
              <p className={`text-[10px] mt-0.5 ${isAdopted ? 'text-emerald-600' : 'text-red-600'}`}>
                {isAdopted
                  ? 'Le PV sera marqué comme approuvé en séance.'
                  : 'Le PV reste en relecture — des modifications sont nécessaires.'}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs shrink-0"
              onClick={() => handleApprovalVoteResult(isAdopted ? 'ADOPTE' : 'REJETE')}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                'Valider'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // General info banner (shown in sidebar or when not on the approval point)
  if (!isOnApprovalPoint) {
    return (
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-3">
          <div className="flex items-start gap-2">
            <FileText className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-blue-800">
                PV à approuver
              </p>
              <p className="text-[10px] text-blue-600 mt-0.5">
                Séance du {pvDate}
              </p>
              <div className="flex items-center gap-2 mt-1.5">
                <Badge variant="outline" className="text-[10px] border-blue-200 text-blue-700">
                  {pvApprovalInfo.pvStatut === 'SIGNE' ? 'Signé' : pvApprovalInfo.pvStatut}
                </Badge>
                {pvApprovalInfo.pdfUrl && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <a
                          href={pvApprovalInfo.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-blue-600 hover:text-blue-800 flex items-center gap-0.5"
                        >
                          <ExternalLink className="h-2.5 w-2.5" />
                          Voir le PDF
                        </a>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">Ouvrir le procès-verbal en PDF</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-start gap-1.5 mt-2 text-[10px] text-blue-600">
            <Info className="h-3 w-3 mt-0.5 shrink-0" />
            <span>Ce PV sera soumis au vote au point n°1 de l&apos;ordre du jour.</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return null
}
