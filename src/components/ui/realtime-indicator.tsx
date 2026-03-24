'use client'

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface RealtimeIndicatorProps {
  /** Connexion Realtime active */
  isConnected: boolean
  /** Fallback polling actif */
  isPolling?: boolean
}

/**
 * Petit indicateur visuel de l'état de connexion temps réel.
 * - Vert : Supabase Realtime connecté (mises à jour instantanées)
 * - Ambre : polling en fallback (rafraîchissement périodique)
 * - Gris : aucune mise à jour automatique
 */
export function RealtimeIndicator({ isConnected, isPolling }: RealtimeIndicatorProps) {
  if (isConnected) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="flex items-center gap-1.5 text-[10px] text-emerald-600 cursor-default">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Temps réel
          </span>
        </TooltipTrigger>
        <TooltipContent>
          Données en temps réel — mises à jour instantanées via Supabase Realtime
        </TooltipContent>
      </Tooltip>
    )
  }

  if (isPolling) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="flex items-center gap-1.5 text-[10px] text-amber-600 cursor-default">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            Rafraîchissement
          </span>
        </TooltipTrigger>
        <TooltipContent>
          Rafraîchissement automatique toutes les quelques secondes (connexion temps réel indisponible)
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-default">
          <span className="h-2 w-2 rounded-full bg-muted-foreground/50" />
          Hors ligne
        </span>
      </TooltipTrigger>
      <TooltipContent>
        Pas de mise à jour automatique
      </TooltipContent>
    </Tooltip>
  )
}
