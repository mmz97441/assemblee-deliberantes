'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Vote,
  Eye,
  AlertTriangle,
  Lock,
  User,
  Landmark,
} from 'lucide-react'
import type { ODJPointRow } from '@/lib/supabase/types'
import type { DocumentInfo } from '@/lib/actions/documents'

// ─── Types ────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface SeanceData extends Record<string, any> {
  id: string
  titre: string
  date_seance: string
  statut: string | null
  lieu: string | null
  mode: string | null
  heure_ouverture: string | null
  instance_config: { id: string; nom: string; type_legal: string; voix_preponderante: boolean | null } | null
  odj_points: ODJPointRow[]
  president_effectif: { id: string; prenom: string; nom: string } | null
  secretaire_seance: { id: string; prenom: string; nom: string } | null
}

interface MemberInfo {
  id: string
  prenom: string
  nom: string
  email: string
  qualite_officielle: string | null
}

interface TabletteEluProps {
  seance: SeanceData
  currentMember: MemberInfo | null
}

const MAJORITE_LABELS: Record<string, string> = {
  SIMPLE: 'Majorité simple',
  ABSOLUE: 'Majorité absolue',
  QUALIFIEE: 'Majorité qualifiée (2/3)',
  UNANIMITE: 'Unanimité requise',
}

// ─── Main Component ───────────────────────────────────────────────────────────
// TABLET VIEW: Large text (22px base), big buttons (56px min), touch-friendly
// Used by elected officials during the session on their individual tablet.

export function TabletteElu({ seance, currentMember }: TabletteEluProps) {
  const router = useRouter()
  const [currentPointIndex, setCurrentPointIndex] = useState(0)

  // Auto-refresh every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => router.refresh(), 3000)
    return () => clearInterval(interval)
  }, [router])

  // Screen Wake Lock — keep tablet awake during session
  useEffect(() => {
    let wakeLock: WakeLockSentinel | null = null

    async function requestWakeLock() {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await navigator.wakeLock.request('screen')
        }
      } catch {
        // Wake Lock API not supported or failed
      }
    }

    if (seance.statut === 'EN_COURS') {
      requestWakeLock()
    }

    return () => {
      wakeLock?.release()
    }
  }, [seance.statut])

  // Sort points
  const sortedPoints = useMemo(() =>
    [...seance.odj_points].sort((a, b) => (a.position || 0) - (b.position || 0)),
    [seance.odj_points]
  )

  const currentPoint = sortedPoints[currentPointIndex] || null
  const totalPoints = sortedPoints.length

  const isVotable = currentPoint && !currentPoint.votes_interdits && (
    currentPoint.type_traitement === 'DELIBERATION' ||
    currentPoint.type_traitement === 'ELECTION' ||
    currentPoint.type_traitement === 'APPROBATION_PV'
  )

  const documents: DocumentInfo[] = useMemo(() => {
    if (!currentPoint) return []
    return Array.isArray(currentPoint.documents)
      ? (currentPoint.documents as unknown as DocumentInfo[])
      : []
  }, [currentPoint])

  const isEnCours = seance.statut === 'EN_COURS'
  const isCloturee = seance.statut === 'CLOTUREE'
  const isSuspendue = seance.statut === 'SUSPENDUE'

  // ─── Render: Séance clôturée ──────────────────────────────────────────

  if (isCloturee) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8 text-center">
        <Landmark className="h-16 w-16 text-purple-400 mb-6" />
        <h1 className="text-3xl font-bold text-purple-800 mb-3">Séance clôturée</h1>
        <p className="text-lg text-muted-foreground mb-2">{seance.titre}</p>
        <p className="text-base text-muted-foreground">Merci de votre participation.</p>
      </div>
    )
  }

  // ─── Render: Séance suspendue ─────────────────────────────────────────

  if (isSuspendue) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8 text-center">
        <Landmark className="h-16 w-16 text-amber-400 mb-6" />
        <h1 className="text-3xl font-bold text-amber-800 mb-3 animate-pulse">Séance suspendue</h1>
        <p className="text-lg text-muted-foreground mb-2">{seance.titre}</p>
        <p className="text-base text-muted-foreground">La séance reprendra prochainement.</p>
      </div>
    )
  }

  // ─── Render: Active ───────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col" style={{ fontSize: '22px' }}>

      {/* Header */}
      <header className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Landmark className="h-7 w-7 text-institutional-blue" />
            <div>
              <h1 className="text-lg font-bold leading-tight">{seance.titre}</h1>
              <p className="text-sm text-muted-foreground">{seance.instance_config?.nom}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {currentMember && (
              <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5">
                <User className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {currentMember.prenom} {currentMember.nom}
                </span>
              </div>
            )}
            <Badge className={`text-sm px-3 py-1 ${
              isEnCours ? 'bg-emerald-100 text-emerald-700' :
              seance.statut === 'SUSPENDUE' ? 'bg-amber-100 text-amber-700' :
              'bg-slate-100 text-slate-600'
            }`}>
              {isEnCours ? '● En cours' :
               seance.statut === 'SUSPENDUE' ? '⏸ Suspendue' :
               seance.statut === 'CLOTUREE' ? 'Clôturée' :
               seance.statut || 'Attente'}
            </Badge>
          </div>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-2 mt-3">
          {sortedPoints.map((_, idx) => (
            <div
              key={idx}
              className={`h-2 flex-1 rounded-full transition-all ${
                idx === currentPointIndex
                  ? 'bg-institutional-blue'
                  : idx < currentPointIndex
                    ? 'bg-emerald-400'
                    : 'bg-slate-200'
              }`}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-1.5 text-center">
          Point {currentPointIndex + 1} / {totalPoints}
        </p>
      </header>

      {/* Main content: current point */}
      <main className="flex-1 p-6 overflow-y-auto">
        {currentPoint ? (
          <div className="max-w-2xl mx-auto space-y-6">

            {/* Point header */}
            <div className="flex items-start gap-4">
              <span className={`flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-bold shrink-0 ${
                isVotable ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
              }`}>
                {currentPoint.position}
              </span>
              <div>
                <h2 className="text-2xl font-bold leading-tight">{currentPoint.titre}</h2>
                <div className="flex items-center gap-2 mt-2">
                  {isVotable ? (
                    <Badge className="bg-blue-50 text-blue-700 border-0 text-base px-3 py-1">
                      <Vote className="h-4 w-4 mr-1" /> Soumis au vote
                    </Badge>
                  ) : (
                    <Badge className="bg-slate-50 text-slate-500 border-0 text-base px-3 py-1">
                      <Eye className="h-4 w-4 mr-1" /> Information
                    </Badge>
                  )}
                  {currentPoint.huis_clos && (
                    <Badge variant="outline" className="border-red-200 text-red-600 text-base px-3 py-1">
                      <Lock className="h-4 w-4 mr-1" /> Huis clos
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Majority warning */}
            {isVotable && currentPoint.majorite_requise && currentPoint.majorite_requise !== 'SIMPLE' && (
              <div className="rounded-xl bg-amber-50 border-2 border-amber-200 p-4 flex items-center gap-3">
                <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0" />
                <p className="text-base font-medium text-amber-800">
                  {MAJORITE_LABELS[currentPoint.majorite_requise] || currentPoint.majorite_requise}
                </p>
              </div>
            )}

            {/* Description */}
            {currentPoint.description && (
              <p className="text-base text-muted-foreground leading-relaxed">
                {currentPoint.description}
              </p>
            )}

            <Separator />

            {/* Projet de délibération */}
            {currentPoint.projet_deliberation && (
              <div className="rounded-xl bg-blue-50 border border-blue-200 p-5">
                <h3 className="text-base font-semibold text-blue-800 mb-3 flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Projet de délibération
                </h3>
                <div className="text-base text-blue-900 whitespace-pre-line leading-relaxed">
                  {currentPoint.projet_deliberation}
                </div>
              </div>
            )}

            {/* Documents */}
            {documents.length > 0 && (
              <div>
                <h3 className="text-base font-semibold mb-3">Documents</h3>
                <div className="grid gap-2">
                  {documents.map((doc, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-xl border p-4 bg-white"
                    >
                      <FileText className="h-6 w-6 text-red-500 shrink-0" />
                      <div>
                        <p className="text-base font-medium">{doc.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {doc.size < 1024 * 1024
                            ? `${Math.round(doc.size / 1024)} Ko`
                            : `${(doc.size / (1024 * 1024)).toFixed(1)} Mo`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {currentPoint.notes_seance && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
                <p className="text-base text-amber-800">
                  <strong>Note :</strong> {currentPoint.notes_seance}
                </p>
              </div>
            )}

            {/* Question diverse warning */}
            {currentPoint.type_traitement === 'QUESTION_DIVERSE' && (
              <div className="rounded-xl bg-amber-50 border-2 border-amber-200 p-4 flex items-center gap-3">
                <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0" />
                <p className="text-base text-amber-800">
                  Questions diverses — aucun vote autorisé
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-20 text-muted-foreground">
            <FileText className="h-16 w-16 mx-auto mb-4 opacity-40" />
            <p className="text-xl">Aucun point à l&apos;ordre du jour</p>
          </div>
        )}
      </main>

      {/* Bottom navigation — always visible, big touch targets */}
      <footer className="bg-white border-t px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => setCurrentPointIndex(i => i - 1)}
            disabled={currentPointIndex === 0}
            className="h-14 px-6 text-lg gap-2"
            style={{ minWidth: '56px', minHeight: '56px' }}
          >
            <ChevronLeft className="h-6 w-6" /> Précédent
          </Button>

          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              {currentPoint?.titre || '—'}
            </p>
          </div>

          <Button
            onClick={() => setCurrentPointIndex(i => i + 1)}
            disabled={currentPointIndex >= totalPoints - 1}
            className="h-14 px-6 text-lg gap-2"
            style={{ minWidth: '56px', minHeight: '56px' }}
          >
            Suivant <ChevronRight className="h-6 w-6" />
          </Button>
        </div>

        {/* Next point preview */}
        {currentPointIndex < totalPoints - 1 && (
          <p className="text-center text-sm text-muted-foreground mt-2">
            Prochain : {sortedPoints[currentPointIndex + 1]?.titre}
          </p>
        )}
      </footer>
    </div>
  )
}
