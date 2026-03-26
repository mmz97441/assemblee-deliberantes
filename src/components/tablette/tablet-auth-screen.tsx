'use client'

import { useState, useTransition, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Landmark,
  QrCode,
  CheckCircle2,
  Loader2,
  Fingerprint,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react'
import { authenticateTablet } from '@/lib/actions/presences'

// ─── Types ───────────────────────────────────────────────────────────────────

interface TabletAuthScreenProps {
  seanceId: string
  seanceTitre: string
  onAuthenticated: (memberId: string) => void
}

type AuthState = 'scan' | 'enrolling' | 'authenticated'

// ─── Device fingerprint (simple, deterministic) ─────────────────────────────

function getDeviceFingerprint(): string {
  if (typeof window === 'undefined') return 'ssr'
  const nav = window.navigator
  const parts = [
    nav.userAgent,
    nav.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
  ]
  // Simple hash
  let hash = 0
  const str = parts.join('|')
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return `tablet_${Math.abs(hash).toString(36)}`
}

// ─── Component ───────────────────────────────────────────────────────────────

export function TabletAuthScreen({
  seanceId,
  seanceTitre,
  onAuthenticated,
}: TabletAuthScreenProps) {
  const [isPending, startTransition] = useTransition()
  const [state, setState] = useState<AuthState>('scan')
  const [tokenInput, setTokenInput] = useState('')
  const [authenticatedName, setAuthenticatedName] = useState('')
  const [authenticatedMemberId, setAuthenticatedMemberId] = useState<string | null>(null)
  const [webauthnAvailable, setWebauthnAvailable] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Check WebAuthn availability
  useEffect(() => {
    if (typeof window !== 'undefined' && window.PublicKeyCredential) {
      setWebauthnAvailable(true)
    }
  }, [])

  const handleSubmitToken = useCallback(() => {
    if (!tokenInput.trim()) {
      setError('Veuillez entrer votre code de convocation')
      return
    }

    setError(null)
    startTransition(async () => {
      const fingerprint = getDeviceFingerprint()
      const result = await authenticateTablet(seanceId, tokenInput.trim(), fingerprint)

      if ('error' in result) {
        setError(result.error)
        return
      }

      setAuthenticatedName(result.memberName)
      setAuthenticatedMemberId(result.memberId)

      // Always save memberId to localStorage so enrollment/skip handlers can use it
      try {
        localStorage.setItem(`device_session_${seanceId}`, result.memberId)
      } catch { /* localStorage not available */ }

      if (webauthnAvailable) {
        // Show WebAuthn enrollment option
        setState('enrolling')
      } else {
        // Go straight to authenticated
        setState('authenticated')
        setTimeout(() => onAuthenticated(result.memberId), 1200)
      }
    })
  }, [tokenInput, seanceId, webauthnAvailable, onAuthenticated])

  const handleSkipWebAuthn = useCallback(() => {
    setState('authenticated')
    const memberId = authenticatedMemberId
    if (memberId) {
      setTimeout(() => onAuthenticated(memberId), 1200)
    }
  }, [authenticatedMemberId, onAuthenticated])

  const handleEnrollWebAuthn = useCallback(async () => {
    // TODO: Implement actual WebAuthn enrollment with server-side challenge
    // For Phase 2 MVP, we skip actual WebAuthn and just note that it's available
    toast.success('Empreinte biométrique — disponible dans une prochaine version')
    setState('authenticated')
    const memberId = authenticatedMemberId
    if (memberId) {
      setTimeout(() => onAuthenticated(memberId), 1200)
    }
  }, [authenticatedMemberId, onAuthenticated])

  // ─── Render: SCAN state ─────────────────────────────────────────────────

  if (state === 'scan') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-blue-50 flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center">
              <div className="h-20 w-20 rounded-2xl bg-institutional-blue/10 border border-institutional-blue/20 flex items-center justify-center">
                <Landmark className="h-12 w-12 text-institutional-blue" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">
                Identifiez-vous
              </h1>
              <p className="text-base text-muted-foreground mt-1">
                {seanceTitre}
              </p>
            </div>
          </div>

          {/* QR code icon */}
          <div className="flex justify-center">
            <div className="h-32 w-32 rounded-3xl bg-white border-2 border-dashed border-slate-300 flex items-center justify-center">
              <QrCode className="h-16 w-16 text-slate-400" />
            </div>
          </div>

          {/* Token input */}
          <div className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="token-input"
                className="text-sm font-medium text-slate-700"
              >
                Code de convocation
              </label>
              <Input
                id="token-input"
                value={tokenInput}
                onChange={(e) => {
                  setTokenInput(e.target.value)
                  setError(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSubmitToken()
                }}
                placeholder="Entrez le code de votre convocation"
                className="h-14 text-lg text-center tracking-wider font-mono"
                autoFocus
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground text-center">
                Vous trouverez ce code dans votre email de convocation
              </p>
            </div>

            {/* Error message */}
            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-4 flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Submit button */}
            <Button
              onClick={handleSubmitToken}
              disabled={isPending || !tokenInput.trim()}
              className="w-full h-14 text-lg font-semibold bg-institutional-blue hover:bg-institutional-blue/90 text-white rounded-xl"
              style={{ minHeight: '64px' }}
            >
              {isPending ? (
                <>
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  Vérification...
                </>
              ) : (
                <>
                  <ShieldCheck className="h-6 w-6 mr-2" />
                  Valider
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ─── Render: ENROLLING state (WebAuthn available) ───────────────────────

  if (state === 'enrolling') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-emerald-50 flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          {/* Welcome */}
          <div className="text-center space-y-3">
            <CheckCircle2 className="h-16 w-16 text-emerald-600 mx-auto" />
            <h1 className="text-2xl font-bold text-emerald-800">
              Bienvenue {authenticatedName} !
            </h1>
            <p className="text-base text-muted-foreground">
              Enregistrez votre empreinte pour les prochaines séances
            </p>
          </div>

          {/* Enroll button */}
          <Button
            onClick={handleEnrollWebAuthn}
            className="w-full h-16 text-xl font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
            style={{ minHeight: '64px' }}
          >
            <Fingerprint className="h-7 w-7 mr-3" />
            Enregistrer mon empreinte
          </Button>

          {/* Skip */}
          <div className="text-center">
            <button
              onClick={handleSkipWebAuthn}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline"
            >
              Passer cette étape
            </button>
          </div>

          {/* Info */}
          <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
            <p className="text-xs text-blue-700 text-center">
              <Fingerprint className="h-3.5 w-3.5 inline mr-1" />
              La biométrie permet de vous identifier rapidement aux prochaines séances, sans code.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ─── Render: AUTHENTICATED state ────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-emerald-100 flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="rounded-3xl bg-emerald-100 border-2 border-emerald-300 p-10 space-y-4">
          <CheckCircle2 className="h-20 w-20 text-emerald-600 mx-auto animate-in zoom-in-50 duration-300" />
          <h1 className="text-3xl font-bold text-emerald-800">
            Session verrouillée
          </h1>
          <p className="text-xl text-emerald-700">
            {authenticatedName}
          </p>
          <Badge className="bg-emerald-200 text-emerald-800 border-0 text-base px-4 py-1.5">
            <ShieldCheck className="h-4 w-4 mr-1.5" />
            Tablette identifiée
          </Badge>
        </div>
        <Loader2 className="h-6 w-6 animate-spin text-emerald-500 mx-auto" />
        <p className="text-sm text-emerald-600">Chargement de la séance...</p>
      </div>
    </div>
  )
}
