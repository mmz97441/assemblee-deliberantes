'use client'

import { useMemo, useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Landmark, Clock, FileText, Vote, Shield, Eye, Lock, Maximize } from 'lucide-react'
import type { ODJPointRow } from '@/lib/supabase/types'

// ─── Types ────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface SeanceData extends Record<string, any> {
  id: string
  titre: string
  date_seance: string
  statut: string | null
  lieu: string | null
  heure_ouverture: string | null
  instance_config: { id: string; nom: string; type_legal: string } | null
  odj_points: ODJPointRow[]
}

interface GrandeSceneProps {
  seance: SeanceData
  institutionName: string
}

// ─── Main Component ───────────────────────────────────────────────────────────
// Target: 1920×1080, text readable at 10m (60px minimum)
// This is a FULLSCREEN display for a projector in the session room.

export function GrandeScene({ seance, institutionName }: GrandeSceneProps) {
  const router = useRouter()
  const [fullscreenFailed, setFullscreenFailed] = useState(false)

  // Auto-refresh every 3 seconds to stay in sync
  useEffect(() => {
    const interval = setInterval(() => router.refresh(), 3000)
    return () => clearInterval(interval)
  }, [router])

  // Track fullscreen state changes
  useEffect(() => {
    const onFullscreenChange = () => {
      if (document.fullscreenElement) {
        setFullscreenFailed(false)
      }
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  // Auto-fullscreen on load (try once)
  useEffect(() => {
    const tryFullscreen = async () => {
      try {
        if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
          await document.documentElement.requestFullscreen()
          setFullscreenFailed(false)
        }
      } catch {
        setFullscreenFailed(true)
      }
    }
    // Attempt fullscreen after a short delay
    const timer = setTimeout(tryFullscreen, 1000)
    return () => clearTimeout(timer)
  }, [])

  const handleClickFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen()
        setFullscreenFailed(false)
      }
    } catch { /* ignore */ }
  }, [])

  // Sort points
  const sortedPoints = useMemo(() =>
    [...seance.odj_points].sort((a, b) => (a.position || 0) - (b.position || 0)),
    [seance.odj_points]
  )

  // Determine current mode based on session state
  // In Phase 1, we detect from session statut. Later, Realtime will push vote state.
  const isEnCours = seance.statut === 'EN_COURS'
  const isSuspendue = seance.statut === 'SUSPENDUE'
  const isCloturee = seance.statut === 'CLOTUREE'

  // Find current active point (first non-treated, or last)
  const currentPoint = sortedPoints.find(p => p.statut === 'EN_DISCUSSION' || p.statut === 'A_TRAITER') || sortedPoints[sortedPoints.length - 1]
  const currentIndex = currentPoint ? sortedPoints.indexOf(currentPoint) : -1

  // Format date
  const dateStr = (() => {
    try {
      return new Date(seance.date_seance).toLocaleDateString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      })
    } catch { return seance.date_seance }
  })()

  const timeStr = seance.heure_ouverture
    ? new Date(seance.heure_ouverture).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : seance.date_seance.includes('T')
      ? new Date(seance.date_seance).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      : ''

  // ─── Render: Waiting mode (before session or between points) ────────

  if (!isEnCours && !isCloturee) {
    return (
      <div
        className="min-h-screen bg-[#0D2B55] flex flex-col items-center justify-center text-white p-12 cursor-pointer"
        onClick={handleClickFullscreen}
        title="Cliquez pour passer en plein écran"
      >
        {/* Fullscreen banner */}
        {fullscreenFailed && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-white/10 border border-white/20 rounded-xl px-8 py-3 flex items-center gap-3 animate-pulse">
            <Maximize className="h-6 w-6 text-white/70" />
            <span className="text-xl text-white/70">Cliquez n&apos;importe où pour passer en plein écran</span>
          </div>
        )}

        {/* Institution */}
        <div className="flex items-center gap-6 mb-12">
          <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-white/10 border border-white/20">
            <Landmark className="h-14 w-14 text-white/80" />
          </div>
          <div>
            <h1 className="text-6xl font-bold tracking-tight">{institutionName}</h1>
            <p className="text-3xl text-white/80 mt-2">{seance.instance_config?.nom}</p>
          </div>
        </div>

        {/* Session title */}
        <h2 className="text-5xl font-semibold text-center max-w-4xl leading-tight mb-8">
          {seance.titre}
        </h2>

        {/* Date & location */}
        <div className="flex items-center gap-8 text-3xl text-white/80">
          <span className="flex items-center gap-3">
            <Clock className="h-8 w-8" />
            {dateStr}{timeStr ? ` — ${timeStr}` : ''}
          </span>
          {seance.lieu && (
            <span>{seance.lieu}</span>
          )}
        </div>

        {/* Status */}
        <div className="mt-16">
          {isSuspendue ? (
            <div className="bg-amber-500/20 border-2 border-amber-400 rounded-2xl px-12 py-6">
              <p className="text-5xl font-bold text-amber-300 animate-pulse">
                SÉANCE SUSPENDUE
              </p>
            </div>
          ) : (
            <div className="bg-white/10 border border-white/20 rounded-2xl px-12 py-6">
              <p className="text-3xl text-white/70">
                La séance va bientôt commencer...
              </p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─── Render: Session closed ─────────────────────────────────────────

  if (isCloturee) {
    return (
      <div className="min-h-screen bg-[#0D2B55] flex flex-col items-center justify-center text-white p-12">
        <div className="flex items-center gap-6 mb-12">
          <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-white/10 border border-white/20">
            <Landmark className="h-14 w-14 text-white/80" />
          </div>
          <h1 className="text-6xl font-bold">{institutionName}</h1>
        </div>

        <div className="bg-purple-500/20 border-2 border-purple-400 rounded-2xl px-16 py-8 mb-8">
          <p className="text-6xl font-bold text-purple-300">
            SÉANCE CLÔTURÉE
          </p>
        </div>

        <p className="text-3xl text-white/70">
          Merci de votre participation
        </p>
      </div>
    )
  }

  // ─── Render: Session in progress — show current point ───────────────

  const isVotable = currentPoint && !currentPoint.votes_interdits && (
    currentPoint.type_traitement === 'DELIBERATION' ||
    currentPoint.type_traitement === 'ELECTION' ||
    currentPoint.type_traitement === 'APPROBATION_PV'
  )

  return (
    <div className="min-h-screen bg-[#0D2B55] flex flex-col text-white" onClick={handleClickFullscreen}>

      {/* Fullscreen banner */}
      {fullscreenFailed && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-10 bg-white/10 border border-white/20 rounded-xl px-8 py-3 flex items-center gap-3 animate-pulse cursor-pointer">
          <Maximize className="h-6 w-6 text-white/70" />
          <span className="text-xl text-white/70">Cliquez n&apos;importe où pour passer en plein écran</span>
        </div>
      )}

      {/* Top bar */}
      <header className="flex items-center justify-between px-12 py-6 border-b border-white/10">
        <div className="flex items-center gap-4">
          <Landmark className="h-8 w-8 text-white/80" />
          <span className="text-2xl font-semibold text-white/90">{institutionName}</span>
          <span className="text-2xl text-white/40">—</span>
          <span className="text-2xl text-white/80">{seance.instance_config?.nom}</span>
        </div>
        <div className="flex items-center gap-6 text-xl text-white/70">
          <span>{dateStr}</span>
          <div className="flex items-center gap-2 text-emerald-400">
            <span className="h-3 w-3 rounded-full bg-emerald-400 animate-pulse" />
            En cours
          </div>
        </div>
      </header>

      {/* Main: current point */}
      <main className="flex-1 flex flex-col items-center justify-center px-16 py-12">

        {/* Progress dots */}
        <div className="flex items-center gap-3 mb-10">
          {sortedPoints.map((p, idx) => (
            <div
              key={p.id}
              className={`h-4 w-4 rounded-full transition-all ${
                idx === currentIndex
                  ? 'bg-white scale-150'
                  : idx < currentIndex
                    ? 'bg-emerald-400'
                    : 'bg-white/20'
              }`}
            />
          ))}
        </div>

        {/* Point number */}
        {currentPoint && (
          <>
            <div className="flex items-center gap-4 mb-6">
              <span className="flex h-24 w-24 items-center justify-center rounded-2xl text-5xl font-bold bg-white/10 border border-white/20">
                {currentPoint.position}
              </span>
              <div className="flex items-center gap-3">
                {isVotable ? (
                  <span className="flex items-center gap-2 bg-blue-500/20 border border-blue-400/40 rounded-xl px-6 py-3 text-3xl text-blue-300">
                    <Vote className="h-8 w-8" />
                    Soumis au vote
                  </span>
                ) : (
                  <span className="flex items-center gap-2 bg-white/10 rounded-xl px-6 py-3 text-3xl text-white/70">
                    <Eye className="h-8 w-8" />
                    Information
                  </span>
                )}
                {currentPoint.huis_clos && (
                  <span className="flex items-center gap-2 bg-red-500/20 border border-red-400/40 rounded-xl px-6 py-3 text-3xl text-red-300">
                    <Lock className="h-8 w-8" />
                    Huis clos
                  </span>
                )}
              </div>
            </div>

            {/* Title — THE BIG TEXT */}
            <h2 className="text-7xl font-bold text-center max-w-5xl leading-tight mb-8">
              {currentPoint.titre}
            </h2>

            {/* Description */}
            {currentPoint.description && (
              <p className="text-3xl text-white/80 text-center max-w-4xl leading-relaxed mb-6">
                {currentPoint.description}
              </p>
            )}

            {/* Note: rapporteur name not loaded here to keep query light.
                The gestionnaire sees the name on their screen. */}

            {/* Majority info */}
            {isVotable && currentPoint.majorite_requise && currentPoint.majorite_requise !== 'SIMPLE' && (
              <div className="mt-4 bg-amber-500/20 border border-amber-400/40 rounded-xl px-8 py-4">
                <p className="text-3xl text-amber-300 flex items-center gap-3">
                  <Shield className="h-8 w-8" />
                  {currentPoint.majorite_requise === 'ABSOLUE' ? 'Majorité absolue requise' :
                   currentPoint.majorite_requise === 'QUALIFIEE' ? 'Majorité qualifiée (2/3) requise' :
                   currentPoint.majorite_requise === 'UNANIMITE' ? 'Unanimité requise' :
                   currentPoint.majorite_requise}
                </p>
              </div>
            )}

            {/* Next point preview */}
            {currentIndex < sortedPoints.length - 1 && (
              <div className="mt-auto pt-12 text-center">
                <p className="text-xl text-white/50">
                  Point suivant : {sortedPoints[currentIndex + 1]?.titre}
                </p>
              </div>
            )}
          </>
        )}

        {!currentPoint && (
          <div className="text-center">
            <FileText className="h-20 w-20 text-white/30 mx-auto mb-6" />
            <p className="text-3xl text-white/60">Aucun point à l&apos;ordre du jour</p>
          </div>
        )}
      </main>

      {/* Bottom bar */}
      <footer className="px-12 py-4 border-t border-white/10 flex items-center justify-between text-white/50 text-xl">
        <span>Point {currentIndex + 1} / {sortedPoints.length}</span>
        <span>{seance.titre}</span>
      </footer>
    </div>
  )
}
