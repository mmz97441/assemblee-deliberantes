'use client'

import { useState, useTransition, useMemo, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useRealtime } from '@/lib/hooks/use-realtime'
import { RealtimeIndicator } from '@/components/ui/realtime-indicator'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  CheckCircle2,
  Clock,
  Users,
  Search,
  UserCheck,
  ArrowLeft,
  RefreshCw,
  Loader2,
  PenLine,
  Shield,
  AlertTriangle,
  Camera,
  CameraOff,
  MoreVertical,
  UserX,
  Ban,
} from 'lucide-react'
import { markPresence, markPresenceManual, scanQREmargement } from '@/lib/actions/presences'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MemberInfo {
  id: string
  prenom: string
  nom: string
  email: string
  qualite_officielle: string | null
}

interface ConvocataireItem {
  id: string
  member_id: string
  member: MemberInfo | null
}

interface PresenceItem {
  id: string
  member_id: string
  statut: string | null
  heure_arrivee: string | null
  heure_depart: string | null
  signature_svg: string | null
  mode_authentification: string | null
}

interface InstanceConfig {
  id: string
  nom: string
  quorum_type: string | null
  quorum_fraction_numerateur: number | null
  quorum_fraction_denominateur: number | null
  composition_max: number | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface SeanceData extends Record<string, any> {
  id: string
  titre: string
  date_seance: string
  statut: string | null
  instance_id: string
  instance_config: InstanceConfig | null
  convocataires: ConvocataireItem[]
  presences: PresenceItem[]
}

interface EmargementViewProps {
  seance: SeanceData
  instanceMemberCount: number
}

// ─── Quorum calculation ───────────────────────────────────────────────────────

function calculateQuorumLocal(
  presents: number,
  totalMembers: number,
  config: InstanceConfig | null
) {
  const total = config?.composition_max || totalMembers
  const quorumType = config?.quorum_type || 'MAJORITE_MEMBRES'
  const numerateur = config?.quorum_fraction_numerateur || 1
  const denominateur = config?.quorum_fraction_denominateur || 2

  let quorumRequired: number
  let fractionLabel: string

  switch (quorumType) {
    case 'MAJORITE_MEMBRES':
      quorumRequired = Math.floor(total / 2) + 1
      fractionLabel = 'Majorité des membres'
      break
    case 'TIERS_MEMBRES':
      quorumRequired = Math.ceil(total / 3)
      fractionLabel = 'Tiers des membres'
      break
    case 'DEUX_TIERS':
      quorumRequired = Math.ceil((total * 2) / 3)
      fractionLabel = 'Deux tiers des membres'
      break
    case 'STATUTS':
      quorumRequired = Math.ceil((total * numerateur) / denominateur)
      fractionLabel = `${numerateur}/${denominateur} des membres`
      break
    default:
      quorumRequired = Math.floor(total / 2) + 1
      fractionLabel = 'Majorité des membres'
  }

  return {
    quorumRequired,
    fractionLabel,
    quorumReached: presents >= quorumRequired,
    totalMembers: total,
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function EmargementView({ seance, instanceMemberCount }: EmargementViewProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState('')
  const [mode, setMode] = useState<'list' | 'scan'>('list')
  const [scanInput, setScanInput] = useState('')
  const [lastScanResult, setLastScanResult] = useState<{ success: boolean; message: string } | null>(null)

  // ─── Realtime subscription for live émargement updates ──────────────────
  const { isConnected: isRealtimeConnected } = useRealtime({
    channel: `emargement-${seance.id}`,
    tables: ['presences'],
    filter: `seance_id=eq.${seance.id}`,
    enabled: true,
  })

  // Build presence map: member_id -> presence
  const presenceMap = useMemo(() => {
    const map = new Map<string, PresenceItem>()
    for (const p of seance.presences) {
      map.set(p.member_id, p)
    }
    return map
  }, [seance.presences])

  // Members list with presence status
  const membersWithStatus = useMemo(() => {
    return seance.convocataires
      .filter(c => c.member)
      .map(c => ({
        member: c.member!,
        presence: presenceMap.get(c.member_id),
      }))
      .sort((a, b) => a.member.nom.localeCompare(b.member.nom))
  }, [seance.convocataires, presenceMap])

  // Filter by search
  const filteredMembers = useMemo(() => {
    if (!search.trim()) return membersWithStatus
    const q = search.toLowerCase()
    return membersWithStatus.filter(m =>
      `${m.member.prenom} ${m.member.nom}`.toLowerCase().includes(q)
    )
  }, [membersWithStatus, search])

  // Stats
  const presents = membersWithStatus.filter(m => m.presence?.statut === 'PRESENT').length
  const excuses = membersWithStatus.filter(m => m.presence?.statut === 'EXCUSE').length
  const procurations = membersWithStatus.filter(m => m.presence?.statut === 'PROCURATION').length
  const total = membersWithStatus.length

  // Quorum (presents + procurations count)
  const quorum = calculateQuorumLocal(
    presents + procurations,
    instanceMemberCount,
    seance.instance_config
  )

  const quorumPercent = quorum.totalMembers > 0
    ? Math.min(100, Math.round(((presents + procurations) / quorum.quorumRequired) * 100))
    : 0

  // ─── Handlers ─────────────────────────────────────────────────────────────

  // ─── QR Scan handler ───────────────────────────────────────────────────
  function handleQRScan(tokenOrData: string) {
    const token = tokenOrData.trim()
    if (!token) return

    // Clear previous result when a new scan starts
    setLastScanResult(null)

    startTransition(async () => {
      const result = await scanQREmargement(seance.id, token)
      if ('error' in result) {
        setLastScanResult({ success: false, message: result.error })
        toast.error(result.error)
      } else {
        setLastScanResult({ success: true, message: `${result.memberName} — Présence enregistrée !` })
        toast.success(`${result.memberName} — Présence enregistrée !`, {
          icon: '✅',
          duration: 3000,
        })
        router.refresh()
      }
      setScanInput('')
    })
  }

  // ─── Manual presence (gestionnaire checks in a member) ────────────────
  function handleManualCheckIn(member: MemberInfo) {
    const existing = presenceMap.get(member.id)
    // If already present, don't re-mark (use the dropdown for status changes)
    if (existing?.statut === 'PRESENT') {
      return
    }

    startTransition(async () => {
      const result = await markPresence(seance.id, member.id, null, 'PRESENT')
      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success(`${member.prenom} ${member.nom} — Présent(e) ✓`, { duration: 2000 })
        router.refresh()
      }
    })
  }

  // ─── Change presence status (undo / mark as absent or excused) ──────
  function handleChangeStatus(memberId: string, newStatut: 'PRESENT' | 'ABSENT' | 'EXCUSE', memberName: string) {
    startTransition(async () => {
      const result = await markPresenceManual(seance.id, memberId, newStatut)
      if ('error' in result) {
        toast.error(result.error)
      } else {
        const labels: Record<string, string> = { PRESENT: 'Présent(e)', ABSENT: 'Absent(e)', EXCUSE: 'Excusé(e)' }
        toast.success(`${memberName} — ${labels[newStatut] || newStatut}`, { duration: 2000 })
        router.refresh()
      }
    })
  }

  // ─── Camera QR scanner ──────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const startCamera = useCallback(async () => {
    try {
      setCameraError(null)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setCameraActive(true)

        // Start scanning frames
        scanIntervalRef.current = setInterval(() => {
          scanFrame()
        }, 300)
      }
    } catch {
      setCameraError('Impossible d\'accéder à la caméra. Vérifiez les permissions.')
      setCameraActive(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current)
      scanIntervalRef.current = null
    }
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach(track => track.stop())
      videoRef.current.srcObject = null
    }
    setCameraActive(false)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => { stopCamera() }
  }, [stopCamera])

  const scanFrame = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || isPending) return
    const video = videoRef.current
    const canvas = canvasRef.current
    if (video.readyState !== video.HAVE_ENOUGH_DATA) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

    // Dynamic import jsQR (lighter bundle)
    const jsQR = (await import('jsqr')).default
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    })

    if (code?.data) {
      // Found a QR code — process it
      handleQRScan(code.data)
    }
  }, [isPending]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleRefresh() {
    router.refresh()
  }

  const isSessionActive = seance.statut === 'EN_COURS' || seance.statut === 'CONVOQUEE'

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header — sticky */}
      <header className="sticky top-0 z-10 bg-white border-b shadow-sm">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push(`/seances/${seance.id}`)}
                title="Retour à la séance"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-lg font-bold leading-tight">{seance.titre}</h1>
                <p className="text-sm text-muted-foreground">
                  {seance.instance_config?.nom} — Émargement
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Mode toggle: Scan QR / Liste */}
              <div className="flex rounded-lg border overflow-hidden">
                <button
                  onClick={() => setMode('scan')}
                  className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors ${
                    mode === 'scan'
                      ? 'bg-institutional-blue text-white'
                      : 'bg-white text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <Search className="h-3.5 w-3.5" />
                  Scanner QR
                </button>
                <button
                  onClick={() => setMode('list')}
                  className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors ${
                    mode === 'list'
                      ? 'bg-institutional-blue text-white'
                      : 'bg-white text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <Users className="h-3.5 w-3.5" />
                  Liste
                </button>
              </div>
              <RealtimeIndicator isConnected={isRealtimeConnected} isPolling={false} />
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`/api/pdf/emargement/${seance.id}`, '_blank')}
                title="Imprimer la feuille d'émargement papier"
              >
                <PenLine className="h-4 w-4 mr-1.5" />
                <span className="hidden sm:inline">Feuille PDF</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                title="Rafraîchir la liste manuellement"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Badge className={`text-sm px-3 py-1 ${
                seance.statut === 'EN_COURS'
                  ? 'bg-emerald-100 text-emerald-700'
                  : seance.statut === 'CONVOQUEE'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-slate-100 text-slate-600'
              }`}>
                {seance.statut === 'EN_COURS' ? 'En cours' :
                 seance.statut === 'CONVOQUEE' ? 'Convoquée' :
                 seance.statut || 'Brouillon'}
              </Badge>
            </div>
          </div>

          {/* ─── Quorum gauge ─── */}
          <div className={`rounded-xl p-3 ${
            quorum.quorumReached
              ? 'bg-emerald-50 border border-emerald-200'
              : 'bg-amber-50 border border-amber-200'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Shield className={`h-5 w-5 ${quorum.quorumReached ? 'text-emerald-600' : 'text-amber-600'}`} />
                <span className="text-sm font-semibold">
                  Quorum : {presents + procurations} / {quorum.quorumRequired} requis
                </span>
                {quorum.quorumReached ? (
                  <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Atteint
                  </Badge>
                ) : (
                  <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Manque {quorum.quorumRequired - (presents + procurations)}
                  </Badge>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {quorum.fractionLabel}
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-white/60 rounded-full h-3 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  quorum.quorumReached ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
                style={{ width: `${Math.min(100, quorumPercent)}%` }}
              />
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-4 mt-2 text-xs">
              <span className="flex items-center gap-1 text-emerald-700">
                <UserCheck className="h-3.5 w-3.5" />
                {presents} présent{presents > 1 ? 's' : ''}
              </span>
              {excuses > 0 && (
                <span className="flex items-center gap-1 text-slate-500">
                  {excuses} excusé{excuses > 1 ? 's' : ''}
                </span>
              )}
              {procurations > 0 && (
                <span className="flex items-center gap-1 text-blue-600">
                  {procurations} procuration{procurations > 1 ? 's' : ''}
                </span>
              )}
              <span className="flex items-center gap-1 text-muted-foreground ml-auto">
                <Users className="h-3.5 w-3.5" />
                {total} convoqué{total > 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Search */}
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un membre..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-11"
            />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="p-4">

        {/* ─── Mode: QR Scan ─── */}
        {mode === 'scan' && (
          <div className="max-w-lg mx-auto space-y-6 py-4">

            {/* Camera scanner */}
            <div className="space-y-3">
              {!cameraActive ? (
                <div className="text-center">
                  <Button
                    onClick={startCamera}
                    size="lg"
                    className="h-16 px-8 text-lg gap-3"
                  >
                    <Camera className="h-6 w-6" />
                    Activer la caméra pour scanner
                  </Button>
                  {cameraError && (
                    <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-4 text-left">
                      <div className="flex items-start gap-3">
                        <CameraOff className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-amber-800">Accès à la caméra refusé</p>
                          <p className="text-xs text-amber-700 mt-1">
                            Autorisez l&apos;accès à la caméra dans les paramètres de votre navigateur, puis réessayez.
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={startCamera}
                            className="mt-3 border-amber-300 text-amber-800 hover:bg-amber-100"
                          >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Réessayer
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-3">
                    Pointez la caméra vers le QR code de la convocation du membre.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative rounded-xl overflow-hidden border-2 border-blue-300 bg-black">
                    <video
                      ref={videoRef}
                      className="w-full"
                      playsInline
                      muted
                      style={{ maxHeight: '300px', objectFit: 'cover' }}
                    />
                    <canvas ref={canvasRef} className="hidden" />
                    {/* Scanning overlay */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-48 h-48 border-2 border-white/70 rounded-xl" />
                    </div>
                    <div className="absolute top-2 left-2">
                      <Badge className="bg-red-500 text-white border-0 animate-pulse text-xs">
                        <Camera className="h-3 w-3 mr-1" />
                        Scan actif
                      </Badge>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={stopCamera}
                    className="w-full"
                  >
                    <CameraOff className="h-4 w-4 mr-2" />
                    Désactiver la caméra
                  </Button>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">ou saisir manuellement</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Manual token input (for barcode scanner or paste) */}
            <div className="space-y-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleQRScan(scanInput)
                }}
                className="flex gap-2"
              >
                <Input
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  placeholder="Collez le code ici..."
                  className="h-12 text-base font-mono"
                  disabled={isPending}
                />
                <Button
                  type="submit"
                  disabled={!scanInput.trim() || isPending}
                  className="h-12 px-6"
                >
                  {isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5" />
                  )}
                </Button>
              </form>
            </div>

            {/* Last scan result */}
            {lastScanResult && (
              <div className={`relative rounded-xl p-6 text-center animate-in fade-in zoom-in duration-300 ${
                lastScanResult.success
                  ? 'bg-emerald-50 border-2 border-emerald-300'
                  : 'bg-red-50 border-2 border-red-300'
              }`}>
                {lastScanResult.success ? (
                  <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
                ) : (
                  <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-3" />
                )}
                <p className={`text-lg font-semibold ${
                  lastScanResult.success ? 'text-emerald-800' : 'text-red-800'
                }`}>
                  {lastScanResult.message}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLastScanResult(null)}
                  className="mt-3 text-xs"
                >
                  Fermer
                </Button>
              </div>
            )}

            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-3 text-center pt-4">
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3">
                <p className="text-2xl font-bold text-emerald-700">{presents}</p>
                <p className="text-xs text-emerald-600">Présents</p>
              </div>
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                <p className="text-2xl font-bold text-slate-600">{total - presents - excuses - procurations}</p>
                <p className="text-xs text-slate-500">En attente</p>
              </div>
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
                <p className="text-2xl font-bold text-blue-600">{total}</p>
                <p className="text-xs text-blue-500">Total convoqués</p>
              </div>
            </div>
          </div>
        )}

        {/* ─── Mode: Member list (manual fallback) ─── */}
        {mode === 'list' && (
          <>
        {!isSessionActive && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 mb-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">Séance pas encore ouverte</p>
              <p className="text-xs text-amber-600">
                L&apos;émargement est possible mais la séance n&apos;a pas encore démarré.
                Les présences seront enregistrées.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filteredMembers.map(({ member, presence }) => {
            const isPresent = presence?.statut === 'PRESENT'
            const isExcuse = presence?.statut === 'EXCUSE'
            const isProcuration = presence?.statut === 'PROCURATION'
            const hasSigned = !!presence?.signature_svg
            const arrivalTime = presence?.heure_arrivee
              ? new Date(presence.heure_arrivee).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
              : null

            return (
              <div
                key={member.id}
                className={`
                  relative flex flex-col items-center gap-2 rounded-2xl border-2 p-4 transition-all
                  min-h-[130px] touch-manipulation
                  ${isPresent
                    ? 'border-emerald-300 bg-emerald-50 shadow-sm'
                    : isExcuse
                      ? 'border-slate-200 bg-slate-50 opacity-60'
                      : isProcuration
                        ? 'border-blue-200 bg-blue-50'
                        : 'border-slate-200 bg-white hover:border-blue-400 hover:bg-blue-50 hover:shadow-md'
                  }
                `}
              >
                {/* Click zone for check-in (only if not already present) */}
                {!isPresent && !isExcuse && !isProcuration ? (
                  <button
                    onClick={() => handleManualCheckIn(member)}
                    disabled={isPending}
                    className="flex flex-col items-center gap-2 w-full active:scale-95 transition-transform"
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold bg-slate-100 text-slate-600">
                      {member.prenom[0]}{member.nom[0]}
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold leading-tight">{member.prenom}</p>
                      <p className="text-sm font-semibold leading-tight">{member.nom}</p>
                      {member.qualite_officielle && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{member.qualite_officielle}</p>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground">Appuyez pour pointer</p>
                  </button>
                ) : (
                  <>
                    {/* Avatar */}
                    <div className={`flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold ${
                      isPresent ? 'bg-emerald-200 text-emerald-800'
                      : isExcuse ? 'bg-slate-200 text-slate-500'
                      : 'bg-blue-200 text-blue-700'
                    }`}>
                      {member.prenom[0]}{member.nom[0]}
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold leading-tight">{member.prenom}</p>
                      <p className="text-sm font-semibold leading-tight">{member.nom}</p>
                      {member.qualite_officielle && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{member.qualite_officielle}</p>
                      )}
                    </div>
                    {isPresent && arrivalTime && (
                      <p className="text-[10px] text-emerald-600 flex items-center gap-1" suppressHydrationWarning>
                        <Clock className="h-2.5 w-2.5" />
                        {arrivalTime}
                        {hasSigned && <PenLine className="h-2.5 w-2.5 ml-1" />}
                      </p>
                    )}
                  </>
                )}

                {/* Status badge + dropdown to change */}
                {(isPresent || isExcuse || isProcuration) && (
                  <div className="absolute top-1.5 right-1.5">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                            isPresent ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                            : isExcuse ? 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                            : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                          }`}
                          title="Modifier le statut"
                        >
                          {isPresent && <><CheckCircle2 className="h-4 w-4" /> Présent</>}
                          {isExcuse && <>Excusé</>}
                          {isProcuration && <>Procuration</>}
                          <MoreVertical className="h-4 w-4 ml-0.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {!isPresent && (
                          <DropdownMenuItem
                            className="min-h-[44px] text-sm"
                            onClick={() => handleChangeStatus(member.id, 'PRESENT', `${member.prenom} ${member.nom}`)}
                          >
                            <UserCheck className="h-5 w-5 mr-2 text-emerald-600" />
                            Marquer présent(e)
                          </DropdownMenuItem>
                        )}
                        {isPresent && (
                          <DropdownMenuItem
                            className="min-h-[44px] text-sm"
                            onClick={() => handleChangeStatus(member.id, 'ABSENT', `${member.prenom} ${member.nom}`)}
                          >
                            <UserX className="h-5 w-5 mr-2 text-red-500" />
                            Marquer absent(e)
                          </DropdownMenuItem>
                        )}
                        {!isExcuse && (
                          <DropdownMenuItem
                            className="min-h-[44px] text-sm"
                            onClick={() => handleChangeStatus(member.id, 'EXCUSE', `${member.prenom} ${member.nom}`)}
                          >
                            <Ban className="h-5 w-5 mr-2 text-amber-500" />
                            Marquer excusé(e)
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {filteredMembers.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">
              {search ? 'Aucun membre ne correspond à la recherche' : 'Aucun convocataire'}
            </p>
          </div>
        )}
          </>
        )}

        {/* Pending overlay */}
        {isPending && (
          <div className="fixed inset-0 bg-white/60 flex items-center justify-center z-50">
            <div className="flex items-center gap-3 bg-white rounded-xl shadow-lg px-6 py-4">
              <Loader2 className="h-6 w-6 animate-spin text-institutional-blue" />
              <p className="text-lg font-medium">Enregistrement en cours...</p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
