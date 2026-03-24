'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Prérequis Supabase :
 * - L'extension `realtime` doit être activée sur le projet Supabase.
 * - Les tables écoutées doivent avoir Realtime activé dans le dashboard Supabase
 *   (Database → Replication → supabase_realtime publication → ajouter les tables).
 * - Les politiques RLS doivent autoriser SELECT pour l'utilisateur connecté.
 */

interface UseRealtimeOptions {
  /** Nom unique du channel Supabase Realtime */
  channel: string
  /** Tables PostgreSQL à écouter (schéma public) */
  tables: string[]
  /** Filtre optionnel, ex: 'seance_id=eq.xxx' */
  filter?: string
  /** Active/désactive l'écoute */
  enabled?: boolean
  /** Callback personnalisé au lieu de router.refresh() */
  onUpdate?: () => void
}

interface UseRealtimeReturn {
  /** true quand la connexion Realtime est établie */
  isConnected: boolean
  /** Date du dernier événement reçu */
  lastUpdate: Date | null
}

/**
 * Hook qui souscrit aux changements Supabase Realtime sur une ou plusieurs tables.
 * Quand un changement est détecté, il appelle router.refresh() (ou un callback custom).
 * Retourne l'état de connexion pour permettre un fallback vers le polling.
 */
export function useRealtime({
  channel,
  tables,
  filter,
  enabled = true,
  onUpdate,
}: UseRealtimeOptions): UseRealtimeReturn {
  const router = useRouter()
  const [isConnected, setIsConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  useEffect(() => {
    if (!enabled || tables.length === 0) {
      setIsConnected(false)
      return
    }

    const supabase = createClient()
    const channelInstance = supabase.channel(channel)

    for (const table of tables) {
      channelInstance.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          ...(filter ? { filter } : {}),
        },
        () => {
          setLastUpdate(new Date())
          if (onUpdate) {
            onUpdate()
          } else {
            router.refresh()
          }
        }
      )
    }

    channelInstance.subscribe((status) => {
      setIsConnected(status === 'SUBSCRIBED')
    })

    return () => {
      supabase.removeChannel(channelInstance)
    }
  }, [channel, enabled, tables.join(','), filter]) // eslint-disable-line react-hooks/exhaustive-deps

  return { isConnected, lastUpdate }
}
