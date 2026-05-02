'use client'

import { useState, useTransition, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Landmark,
  QrCode,
  Camera,
  Keyboard,
  CheckCircle2,
  Loader2,
  Fingerprint,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react'
import { authenticateTablet } from '@/lib/actions/presences'
import { startRegistration } from '@simplewebauthn/browser'
import { getRegistrationOptions, verifyRegistration } from '@/lib/actions/webauthn'

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
  // Mode d'entrée : caméra par défaut, texte en fallback (caméra refusée /
  // capteur cassé / utilisateur préfère taper).
  const [inputMode, setInputMode] = useState<'camera' | 'text'>('camera')
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Évite de retraiter plusieurs fois le même QR (le scan tourne en boucle
  // toutes les 300ms tant que la caméra est active).
  const lastScannedTokenRef = useRef<string | null>(null)

  // Check WebAuthn availability
  useEffect(() => {
    if (typeof window !== 'undefined' && window.PublicKeyCredential) {
      setWebauthnAvailable(true)
    }
  }, [])

  // Soumet un token (depuis caméra ou champ texte) — version paramétrée
  // pour éviter les closures obsolètes lors d'un scan automatique.
  const submitToken = useCallback(
    (token: string) => {
      const cleaned = token.trim()
      if (!cleaned) {
        setError('Veuillez entrer votre code de convocation')
        return
      }
      setError(null)
      startTransition(async () => {
        const fingerprint = getDeviceFingerprint()
        const result = await authenticateTablet(seanceId, cleaned, fingerprint)
        if ('error' in result) {
          setError(result.error)
          // Reset le scan pour permettre de rescanner après correction
          lastScannedTokenRef.current = null
          return
        }
        setAuthenticatedName(result.memberName)
        setAuthenticatedMemberId(result.memberId)
        try {
          localStorage.setItem(`device_session_${seanceId}`, result.memberId)
        } catch {
          /* localStorage indisponible */
        }
        if (webauthnAvailable) {
          setState('enrolling')
        } else {
          setState('authenticated')
          setTimeout(() => onAuthenticated(result.memberId), 1200)
        }
      })
    },
    [seanceId, webauthnAvailable, onAuthenticated]
  )

  const handleSubmitToken = useCallback(() => {
    submitToken(tokenInput)
  }, [submitToken, tokenInput])

  // ─── Caméra : démarrage / arrêt / scan de frame ─────────────────────
  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current)
      scanIntervalRef.current = null
    }
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach((t) => t.stop())
      videoRef.current.srcObject = null
    }
    setCameraActive(false)
  }, [])

  const scanFrame = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return
    if (isPending) return
    const video = videoRef.current
    const canvas = canvasRef.current
    if (video.readyState !== video.HAVE_ENOUGH_DATA) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const jsQR = (await import('jsqr')).default
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    })
    if (code?.data) {
      const token = code.data.trim()
      if (token === lastScannedTokenRef.current) return
      lastScannedTokenRef.current = token
      // Vibration légère si supportée (feedback tactile sur tablette)
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate(80) } catch { /* ignore */ }
      }
      stopCamera()
      submitToken(token)
    }
  }, [isPending, submitToken, stopCamera])

  const startCamera = useCallback(async () => {
    setCameraError(null)
    try {
      // Caméra frontale (selfie) : la tablette est posée à la place de
      // l'élu, qui présente son QR (téléphone ou papier) face à l'écran.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setCameraActive(true)
        scanIntervalRef.current = setInterval(() => {
          void scanFrame()
        }, 300)
      }
    } catch {
      setCameraError(
        'Caméra indisponible (permission refusée ou capteur introuvable). Saisissez votre code manuellement.'
      )
      setCameraActive(false)
      setInputMode('text')
    }
  }, [scanFrame])

  // Démarrer / arrêter la caméra selon le mode actif
  useEffect(() => {
    if (state !== 'scan') {
      stopCamera()
      return
    }
    if (inputMode === 'camera') {
      void startCamera()
    } else {
      stopCamera()
    }
    return () => {
      stopCamera()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, inputMode])

  const handleSkipWebAuthn = useCallback(() => {
    setState('authenticated')
    const memberId = authenticatedMemberId
    if (memberId) {
      setTimeout(() => onAuthenticated(memberId), 1200)
    }
  }, [authenticatedMemberId, onAuthenticated])

  const handleEnrollWebAuthn = useCallback(async () => {
    // SÉCURITÉ (audit #13) : enrôlement WebAuthn RÉEL.
    // 1) demande au serveur les options + challenge
    // 2) déclenche navigator.credentials.create() via SimpleWebAuthn
    // 3) renvoie l'attestation au serveur qui vérifie cryptographiquement
    //    et stocke la credential.
    const memberId = authenticatedMemberId
    if (!memberId) {
      toast.error('Aucun membre identifié — refaites le scan QR')
      return
    }

    try {
      const optsResult = await getRegistrationOptions(memberId)
      if ('error' in optsResult) {
        toast.error(optsResult.error)
        return
      }

      const attestation = await startRegistration({ optionsJSON: optsResult.options })

      const verifyResult = await verifyRegistration(memberId, attestation, 'Tablette de séance')
      if ('error' in verifyResult) {
        toast.error(verifyResult.error)
        return
      }

      toast.success('Empreinte enregistrée — vous pourrez vous identifier rapidement à la prochaine séance')
      setState('authenticated')
      setTimeout(() => onAuthenticated(memberId), 1200)
    } catch (err) {
      // L'utilisateur a annulé la demande système, ou navigator.credentials indisponible
      const message = err instanceof Error ? err.message : 'Inconnu'
      if (/cancel|not allowed/i.test(message)) {
        toast.info('Enrôlement annulé — vous pouvez continuer sans empreinte')
      } else {
        console.error('WebAuthn enrollment error:', err)
        toast.error(`Impossible d'enrôler l'empreinte : ${message}`)
      }
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

          {/* ─── Mode caméra : preview + scanner automatique ─── */}
          {inputMode === 'camera' && (
            <div className="space-y-4">
              <div className="relative aspect-square w-full max-w-sm mx-auto rounded-3xl overflow-hidden bg-slate-900 border-2 border-slate-300 shadow-lg">
                {/* Vidéo */}
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  style={{ transform: 'scaleX(-1)' }}
                  playsInline
                  muted
                />
                {/* Cadre de visée */}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div
                    className={`h-3/5 w-3/5 rounded-2xl border-4 transition-colors ${
                      isPending
                        ? 'border-emerald-400 shadow-[0_0_30px_rgba(52,211,153,0.5)]'
                        : 'border-white/80'
                    }`}
                  />
                </div>
                {/* État caméra */}
                {!cameraActive && !cameraError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 text-white gap-3">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <p className="text-sm">Activation de la caméra…</p>
                  </div>
                )}
                {isPending && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-emerald-900/80 text-white gap-3">
                    <CheckCircle2 className="h-12 w-12" />
                    <p className="text-base font-medium">QR code détecté</p>
                    <p className="text-xs text-emerald-200">Vérification…</p>
                  </div>
                )}
                {/* Canvas off-screen pour l'extraction des frames */}
                <canvas ref={canvasRef} className="hidden" />
              </div>
              <p className="text-center text-sm text-slate-700">
                <Camera className="inline h-4 w-4 mr-1" />
                Cadrez le QR code de votre convocation dans le carré.
              </p>

              {/* Erreur caméra */}
              {cameraError && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                  <p className="text-sm text-amber-800">{cameraError}</p>
                </div>
              )}

              {/* Erreur d'auth */}
              {error && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-4 flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* Fallback texte */}
              <button
                type="button"
                onClick={() => {
                  setError(null)
                  lastScannedTokenRef.current = null
                  setInputMode('text')
                }}
                className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline inline-flex items-center justify-center gap-1.5"
              >
                <Keyboard className="h-4 w-4" />
                Saisir le code manuellement
              </button>
            </div>
          )}

          {/* ─── Mode texte (fallback) ─── */}
          {inputMode === 'text' && (
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="h-24 w-24 rounded-3xl bg-white border-2 border-dashed border-slate-300 flex items-center justify-center">
                  <QrCode className="h-12 w-12 text-slate-400" />
                </div>
              </div>

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

              {error && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-4 flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

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

              {/* Retour au scan caméra */}
              <button
                type="button"
                onClick={() => {
                  setError(null)
                  setCameraError(null)
                  lastScannedTokenRef.current = null
                  setInputMode('camera')
                }}
                className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline inline-flex items-center justify-center gap-1.5"
              >
                <Camera className="h-4 w-4" />
                Scanner avec la caméra
              </button>
            </div>
          )}
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
