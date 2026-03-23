'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  AlertTriangle,
  Check,
  ChevronsUpDown,
  Loader2,
  UserCheck,
  Vote,
  PenLine,
  Info,
} from 'lucide-react'
import { designateSecretary } from '@/lib/actions/phase2-features'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MemberInfo {
  id: string
  prenom: string
  nom: string
}

interface SecretaryDesignationProps {
  seanceId: string
  seanceStatut: string | null
  secretaireSeance: MemberInfo | null
  designationMode: string | null
  presentMembers: MemberInfo[]
  onRefresh: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SecretaryDesignation({
  seanceId,
  seanceStatut,
  secretaireSeance,
  designationMode,
  presentMembers,
  onRefresh,
}: SecretaryDesignationProps) {
  const [isPending, startTransition] = useTransition()
  const [showDesignation, setShowDesignation] = useState(false)
  const [selectedMemberId, setSelectedMemberId] = useState<string>('')
  const [comboboxOpen, setComboboxOpen] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState<'DIRECT' | 'VOTE' | null>(null)

  const selectedMember = selectedMemberId
    ? presentMembers.find(m => m.id === selectedMemberId) || null
    : null

  // Already designated — show info
  if (secretaireSeance) {
    return (
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Secrétaire</span>
        <span className="font-medium flex items-center gap-1">
          <UserCheck className="h-3 w-3 text-emerald-600" />
          {secretaireSeance.prenom} {secretaireSeance.nom}
          {designationMode && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="outline" className="text-[10px] px-1 py-0 ml-1">
                    {designationMode === 'VOTE' ? 'Vote' : 'Direct'}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">
                    {designationMode === 'VOTE'
                      ? 'Désigné(e) par vote en séance'
                      : 'Désigné(e) directement par le/la Président(e)'}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </span>
      </div>
    )
  }

  // Not designated — show warning + action
  if (seanceStatut !== 'EN_COURS' && seanceStatut !== 'CONVOQUEE') return null

  function handleDesignateDirect() {
    if (!selectedMemberId) {
      toast.error('Veuillez sélectionner un membre')
      return
    }
    setConfirmDialog('DIRECT')
  }

  function handleDesignateByVote() {
    if (!selectedMemberId) {
      toast.error('Veuillez sélectionner un membre')
      return
    }
    setConfirmDialog('VOTE')
  }

  function confirmDesignation() {
    if (!selectedMemberId || !confirmDialog) return
    startTransition(async () => {
      const result = await designateSecretary(seanceId, selectedMemberId, confirmDialog)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        const modeLabel = confirmDialog === 'DIRECT' ? 'directement' : 'par vote'
        toast.success(`${selectedMember?.prenom} ${selectedMember?.nom} désigné(e) secrétaire de séance (${modeLabel})`)
        onRefresh()
      }
      setConfirmDialog(null)
      setShowDesignation(false)
      setSelectedMemberId('')
    })
  }

  return (
    <>
      {/* Warning banner */}
      {!showDesignation ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-amber-800">
                  Secrétaire de séance non désigné(e)
                </p>
                <p className="text-[10px] text-amber-600 mt-0.5">
                  Non bloquant — la séance peut continuer.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-100 shrink-0"
                onClick={() => setShowDesignation(true)}
              >
                <PenLine className="h-3 w-3 mr-1" />
                Désigner
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-blue-800 flex items-center gap-1.5">
                <UserCheck className="h-4 w-4" />
                Désignation du secrétaire
              </h4>
              <button
                onClick={() => { setShowDesignation(false); setSelectedMemberId('') }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Annuler
              </button>
            </div>

            {/* Member selection combobox */}
            <div>
              <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={comboboxOpen}
                    className="w-full justify-between font-normal bg-white text-sm h-9"
                  >
                    {selectedMember ? (
                      <span>{selectedMember.prenom} {selectedMember.nom}</span>
                    ) : (
                      <span className="text-muted-foreground">Rechercher un membre...</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Rechercher..." />
                    <CommandList>
                      <CommandEmpty>Aucun membre trouvé.</CommandEmpty>
                      <CommandGroup>
                        {presentMembers.map(member => (
                          <CommandItem
                            key={member.id}
                            value={`${member.prenom} ${member.nom}`}
                            onSelect={() => {
                              setSelectedMemberId(member.id)
                              setComboboxOpen(false)
                            }}
                          >
                            <Check className={`mr-2 h-4 w-4 ${selectedMemberId === member.id ? 'opacity-100' : 'opacity-0'}`} />
                            {member.prenom} {member.nom}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Two action buttons */}
            <div className="grid grid-cols-2 gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 text-xs"
                      onClick={handleDesignateDirect}
                      disabled={!selectedMemberId || isPending}
                    >
                      <PenLine className="h-3.5 w-3.5 mr-1" />
                      Désigner directement
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Le/la Président(e) désigne directement le secrétaire</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      className="h-9 text-xs bg-blue-600 hover:bg-blue-700"
                      onClick={handleDesignateByVote}
                      disabled={!selectedMemberId || isPending}
                    >
                      <Vote className="h-3.5 w-3.5 mr-1" />
                      Vote formel
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Le conseil vote pour désigner le secrétaire</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <div className="flex items-start gap-1.5 text-[10px] text-blue-600">
              <Info className="h-3 w-3 mt-0.5 shrink-0" />
              <span>Le secrétaire de séance co-signe le procès-verbal avec le/la Président(e).</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirmation dialog */}
      <AlertDialog open={!!confirmDialog} onOpenChange={() => setConfirmDialog(null)}>
        <AlertDialogContent aria-describedby={undefined}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Confirmer la désignation du secrétaire de séance ?
            </AlertDialogTitle>
            <div className="space-y-2 mt-2">
              <p className="text-sm text-muted-foreground">
                <strong>{selectedMember?.prenom} {selectedMember?.nom}</strong> sera désigné(e) secrétaire de séance.
              </p>
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
                <p className="text-xs text-blue-700">
                  {confirmDialog === 'DIRECT' ? (
                    <>
                      <PenLine className="h-3 w-3 inline mr-1" />
                      <strong>Désignation directe</strong> — le/la Président(e) désigne le secrétaire. Sera mentionné dans le PV comme : « M./Mme X est désigné(e) secrétaire de séance par le/la Président(e). »
                    </>
                  ) : (
                    <>
                      <Vote className="h-3 w-3 inline mr-1" />
                      <strong>Vote formel</strong> — le conseil a voté. Sera mentionné dans le PV comme : « M./Mme X est désigné(e) secrétaire de séance par vote. »
                    </>
                  )}
                </p>
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDesignation} disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
