'use client'

import { useState, useTransition } from 'react'
import { Lock, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { toggleSeancePublique } from '@/lib/actions/seances'

interface Props {
  seanceId: string
  initialValue: boolean
  statut: string | null
}

const LOCKED_STATUTS = ['CLOTUREE', 'ARCHIVEE']

export function PublicVisibilityToggle({ seanceId, initialValue, statut }: Props) {
  const [publique, setPublique] = useState(initialValue)
  const [isPending, startTransition] = useTransition()
  const isLocked = LOCKED_STATUTS.includes(statut || '')

  function handleChange(next: boolean) {
    const previous = publique
    setPublique(next)
    startTransition(async () => {
      const result = await toggleSeancePublique(seanceId, next)
      if ('error' in result) {
        setPublique(previous)
        toast.error(result.error)
        return
      }
      toast.success(
        next
          ? 'Séance désormais publique — diffusion en ligne activée'
          : 'Séance désormais à huis clos — diffusion en ligne masquée'
      )
    })
  }

  const switchEl = (
    <div className="flex items-center gap-2">
      <Switch
        checked={publique}
        onCheckedChange={handleChange}
        disabled={isLocked || isPending}
        aria-label="Basculer la visibilité publique de la séance"
      />
      <span className="text-sm font-medium flex items-center gap-1.5">
        {publique ? (
          <>
            <Eye className="h-3.5 w-3.5 text-emerald-600" />
            Publique
          </>
        ) : (
          <>
            <Lock className="h-3.5 w-3.5 text-amber-600" />
            Huis clos
          </>
        )}
      </span>
    </div>
  )

  if (!isLocked) return switchEl

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span>{switchEl}</span>
        </TooltipTrigger>
        <TooltipContent>
          La visibilité ne peut plus être modifiée sur une séance clôturée ou archivée.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
