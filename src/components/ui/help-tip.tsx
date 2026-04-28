'use client'

import { Info } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

/**
 * Petit indicateur d'aide contextuelle (?).
 * Affiche un tooltip discret au survol avec un texte explicatif.
 *
 * Usage :
 *   <HelpTip text="Le quorum est le nombre minimum de membres..." />
 */
export function HelpTip({ text, className }: { text: string; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center justify-center h-4 w-4 rounded-full bg-muted text-muted-foreground hover:bg-blue-100 hover:text-blue-600 transition-colors ml-1 shrink-0 ${className ?? ''}`}
          title={text}
        >
          <Info className="h-3 w-3" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-sm">
        {text}
      </TooltipContent>
    </Tooltip>
  )
}
