'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Clock, LogOut } from 'lucide-react'
import {
  INACTIVITY_TIMEOUT_MS,
  WARNING_BEFORE_TIMEOUT_MS,
} from '@/lib/constants'

/**
 * Composant invisible qui surveille l'activité utilisateur côté client et
 * affiche un popup d'avertissement avant la déconnexion automatique pour
 * inactivité.
 *
 * Politique :
 *  - Inactivité de 1h → déconnexion forcée (gérée par le middleware côté
 *    serveur — c'est le filet de sécurité réel).
 *  - À 1h - 2 min → popup côté client : « Vous serez déconnecté dans 2 min,
 *    bougez la souris pour rester connecté ».
 *  - Toute interaction (mousedown, keydown, scroll, touch) reset le timer
 *    ET appelle un ping silencieux au serveur pour rafraîchir le cookie
 *    last_activity_at (sinon le timer client serait reset mais le serveur
 *    nous déconnecterait quand même au prochain refresh de page).
 *
 * À monter dans le AuthenticatedLayout (rendu sur toutes les pages
 * protégées). N'a pas d'effet sur les pages publiques.
 */

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'mousedown',
  'keydown',
  'scroll',
  'touchstart',
]

// Throttling pour ne pas spammer le serveur de pings : on ping au max
// toutes les 5 minutes même si l'utilisateur bouge constamment.
const MIN_PING_INTERVAL_MS = 5 * 60 * 1000

export function SessionTimeoutWarning() {
  const router = useRouter()
  const [showWarning, setShowWarning] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(Math.floor(WARNING_BEFORE_TIMEOUT_MS / 1000))

  const lastActivityRef = useRef<number>(Date.now())
  const lastPingRef = useRef<number>(Date.now())
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Ping silencieux au serveur pour rafraîchir le cookie last_activity_at
  const pingServer = useCallback(async () => {
    try {
      await fetch('/api/session/ping', { method: 'POST', credentials: 'include' })
      lastPingRef.current = Date.now()
    } catch {
      // Silencieux — si le ping échoue, le middleware déconnectera au prochain refresh
    }
  }, [])

  // Reset le timer d'inactivité (et ping serveur si nécessaire)
  const resetTimer = useCallback(() => {
    const now = Date.now()
    lastActivityRef.current = now
    setShowWarning(false)
    setSecondsLeft(Math.floor(WARNING_BEFORE_TIMEOUT_MS / 1000))

    // Throttling : ping serveur seulement si > 5 min depuis dernier ping
    if (now - lastPingRef.current > MIN_PING_INTERVAL_MS) {
      pingServer()
    }
  }, [pingServer])

  // Click sur "Rester connecté" → reset complet + ping immédiat
  const handleStayConnected = useCallback(() => {
    lastActivityRef.current = Date.now()
    setShowWarning(false)
    setSecondsLeft(Math.floor(WARNING_BEFORE_TIMEOUT_MS / 1000))
    pingServer()
  }, [pingServer])

  // Click sur "Se déconnecter maintenant"
  const handleLogoutNow = useCallback(async () => {
    setShowWarning(false)
    // On force juste la redirection — l'auth action côté server gère le signOut
    router.push('/login?action=manual_logout')
  }, [router])

  useEffect(() => {
    // Listeners d'activité
    const onActivity = () => resetTimer()
    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, onActivity, { passive: true })
    }

    // Tick toutes les 10 secondes pour vérifier le délai écoulé
    checkIntervalRef.current = setInterval(() => {
      const now = Date.now()
      const elapsed = now - lastActivityRef.current
      const untilTimeout = INACTIVITY_TIMEOUT_MS - elapsed

      if (untilTimeout <= 0) {
        // Inactivité dépassée — le middleware va nous déconnecter au prochain
        // navigate. On force un refresh pour déclencher la déconnexion.
        window.location.href = '/login?error=session_inactivity'
        return
      }

      if (untilTimeout <= WARNING_BEFORE_TIMEOUT_MS) {
        setShowWarning(true)
        setSecondsLeft(Math.max(0, Math.floor(untilTimeout / 1000)))
      } else {
        setShowWarning(false)
      }
    }, 10000) // toutes les 10 secondes

    return () => {
      for (const ev of ACTIVITY_EVENTS) {
        window.removeEventListener(ev, onActivity)
      }
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current)
      }
    }
  }, [resetTimer])

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60

  return (
    <Dialog open={showWarning} onOpenChange={(o) => { if (!o) handleStayConnected() }}>
      <DialogContent aria-describedby={undefined} className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-600" />
            Votre session va expirer
          </DialogTitle>
          <DialogDescription>
            Vous serez déconnecté(e) automatiquement dans{' '}
            <strong className="text-foreground tabular-nums">
              {minutes > 0 ? `${minutes}min ${String(seconds).padStart(2, '0')}s` : `${seconds}s`}
            </strong>{' '}
            faute d&rsquo;activité. Cliquez ci-dessous ou bougez votre souris pour
            rester connecté(e).
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleLogoutNow}>
            <LogOut className="h-4 w-4 mr-2" />
            Me déconnecter
          </Button>
          <Button onClick={handleStayConnected}>
            Rester connecté(e)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
