'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  FileText,
  Download,
  Printer,
  Plus,
  X,
  CheckCircle2,
  HelpCircle,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  CalendarDays,
  Clock,
  MapPin,
  Monitor,
  Paperclip,
  ExternalLink,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { toast } from 'sonner'
import { getDocumentUrl } from '@/lib/actions/documents'
import { formatDate, formatTime } from '@/lib/utils/format-date'
import type { DocumentInfo } from '@/lib/actions/documents'
import type { ODJPointRow } from '@/lib/supabase/types'

// ─── Types ───────────────────────────────────────────────────────────────────

interface PointPreparation {
  notes: string
  questions: string[]
  avis: 'pour' | 'reserve' | 'contre' | null
  updatedAt: string
}

interface EluPreparationProps {
  seanceId: string
  seanceTitre: string
  dateSeance: string
  instanceNom: string
  lieu: string | null
  mode: string | null
  points: ODJPointRow[]
  rapporteurs: Record<string, string>
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  DELIBERATION: { label: 'Délibération', color: 'bg-blue-50 text-blue-700' },
  INFORMATION: { label: 'Information', color: 'bg-slate-50 text-slate-600' },
  QUESTION_DIVERSE: { label: 'Question diverse', color: 'bg-amber-50 text-amber-700' },
  ELECTION: { label: 'Élection', color: 'bg-purple-50 text-purple-700' },
  APPROBATION_PV: { label: 'Approbation PV', color: 'bg-emerald-50 text-emerald-700' },
}

const MODE_LABELS: Record<string, string> = {
  PRESENTIEL: 'Présentiel',
  HYBRIDE: 'Hybride',
  VISIO: 'Visioconférence',
  VISIOCONFERENCE: 'Visioconférence',
  MIXTE: 'Mixte',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getStorageKey(seanceId: string, pointId: string): string {
  return `prep_${seanceId}_${pointId}`
}

function loadPreparation(seanceId: string, pointId: string): PointPreparation {
  if (typeof window === 'undefined') {
    return { notes: '', questions: [''], avis: null, updatedAt: '' }
  }
  try {
    const stored = localStorage.getItem(getStorageKey(seanceId, pointId))
    if (stored) {
      const parsed = JSON.parse(stored)
      // Ensure questions has at least one entry
      if (!parsed.questions || parsed.questions.length === 0) {
        parsed.questions = ['']
      }
      return parsed
    }
  } catch {
    // Ignore parse errors
  }
  return { notes: '', questions: [''], avis: null, updatedAt: '' }
}

function savePreparation(seanceId: string, pointId: string, data: PointPreparation) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(
      getStorageKey(seanceId, pointId),
      JSON.stringify({ ...data, updatedAt: new Date().toISOString() })
    )
  } catch {
    // localStorage full or unavailable
  }
}

function isPointPrepared(prep: PointPreparation): boolean {
  return (
    prep.notes.trim().length > 0 ||
    prep.questions.some(q => q.trim().length > 0) ||
    prep.avis !== null
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function EluPreparation({
  seanceId,
  seanceTitre,
  dateSeance,
  instanceNom,
  lieu,
  mode,
  points,
  rapporteurs,
}: EluPreparationProps) {
  // Track preparation data per point
  const [preparations, setPreparations] = useState<Record<string, PointPreparation>>({})
  const [expandedPoints, setExpandedPoints] = useState<Set<string>>(new Set())
  const [loaded, setLoaded] = useState(false)
  const saveTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map())

  // Load from localStorage on mount
  useEffect(() => {
    const preps: Record<string, PointPreparation> = {}
    for (const point of points) {
      preps[point.id] = loadPreparation(seanceId, point.id)
    }
    setPreparations(preps)
    // Expand all points by default
    setExpandedPoints(new Set(points.map(p => p.id)))
    setLoaded(true)
  }, [seanceId, points])

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      saveTimersRef.current.forEach(timer => clearTimeout(timer))
    }
  }, [])

  // Debounced save per point (each point has its own timer)
  const debouncedSave = useCallback(
    (pointId: string, data: PointPreparation) => {
      const existing = saveTimersRef.current.get(pointId)
      if (existing) {
        clearTimeout(existing)
      }
      saveTimersRef.current.set(pointId, setTimeout(() => {
        savePreparation(seanceId, pointId, data)
        saveTimersRef.current.delete(pointId)
      }, 1500))
    },
    [seanceId]
  )

  // Update a point's preparation
  const updatePrep = useCallback(
    (pointId: string, updates: Partial<PointPreparation>) => {
      setPreparations(prev => {
        const current = prev[pointId] || { notes: '', questions: [''], avis: null, updatedAt: '' }
        const updated = { ...current, ...updates }
        debouncedSave(pointId, updated)
        return { ...prev, [pointId]: updated }
      })
    },
    [debouncedSave]
  )

  // Toggle point expand
  const togglePoint = useCallback((pointId: string) => {
    setExpandedPoints(prev => {
      const next = new Set(prev)
      if (next.has(pointId)) {
        next.delete(pointId)
      } else {
        next.add(pointId)
      }
      return next
    })
  }, [])

  // Progress
  const totalPoints = points.length
  const preparedCount = loaded
    ? points.filter(p => {
        const prep = preparations[p.id]
        return prep && isPointPrepared(prep)
      }).length
    : 0
  const progressPercent = totalPoints > 0 ? Math.round((preparedCount / totalPoints) * 100) : 0

  // Print
  const handlePrint = () => {
    window.print()
  }

  // Open document
  const handleOpenDocument = async (doc: DocumentInfo) => {
    try {
      const result = await getDocumentUrl(doc.path)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      window.open(result.url, '_blank')
    } catch {
      toast.error('Impossible d\'ouvrir le document')
    }
  }

  if (!loaded) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 mx-auto animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          <p className="text-sm text-muted-foreground">Chargement de votre préparation...</p>
        </div>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* ─── Header with séance info ───────────────────────────── */}
        <div className="rounded-xl border bg-card p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-foreground">{seanceTitre}</h2>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {instanceNom && (
                  <span className="font-medium text-foreground/80">{instanceNom}</span>
                )}
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {formatDate(dateSeance)}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {formatTime(dateSeance)}
                </span>
                {lieu && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    {lieu}
                  </span>
                )}
                {mode && MODE_LABELS[mode] && (
                  <span className="flex items-center gap-1.5">
                    <Monitor className="h-3.5 w-3.5" />
                    {MODE_LABELS[mode]}
                  </span>
                )}
              </div>
            </div>

            {/* Print button */}
            <div className="flex items-center gap-2 shrink-0 print:hidden">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={handlePrint}>
                    <Printer className="h-4 w-4 mr-2" />
                    Imprimer mes notes
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Imprimer cette page avec toutes vos notes et questions</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="font-medium text-foreground">
                {preparedCount}/{totalPoints} point{totalPoints > 1 ? 's' : ''} préparé{preparedCount > 1 ? 's' : ''}
              </span>
              <span className="text-muted-foreground">{progressPercent}%</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
            {preparedCount === totalPoints && totalPoints > 0 && (
              <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Tous les points sont préparés. Vous êtes prêt(e) pour la séance !
              </p>
            )}
          </div>
        </div>

        {/* ─── Points list ───────────────────────────────────────── */}
        {points.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-muted p-8 text-center">
            <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-base font-semibold text-foreground mb-1">
              Aucun point à l&apos;ordre du jour
            </h3>
            <p className="text-sm text-muted-foreground">
              L&apos;ordre du jour n&apos;a pas encore été défini pour cette séance.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {points.map((point) => {
              const prep = preparations[point.id] || { notes: '', questions: [''], avis: null, updatedAt: '' }
              const isExpanded = expandedPoints.has(point.id)
              const isPrepared = isPointPrepared(prep)
              const typeConfig = TYPE_LABELS[point.type_traitement || 'INFORMATION']
              const rapporteurName = point.rapporteur_id ? rapporteurs[point.rapporteur_id] : null
              const documents: DocumentInfo[] = Array.isArray(point.documents)
                ? (point.documents as unknown as DocumentInfo[])
                : []

              return (
                <Collapsible
                  key={point.id}
                  open={isExpanded}
                  onOpenChange={() => togglePoint(point.id)}
                >
                  <div className={`rounded-xl border bg-card transition-all ${isExpanded ? 'shadow-sm' : ''}`}>
                    {/* ─── Point header (always visible) ─── */}
                    <CollapsibleTrigger asChild>
                      <button
                        className="w-full text-left p-4 sm:p-5 flex items-start gap-3 hover:bg-muted/30 transition-colors rounded-t-xl"
                        type="button"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground border mt-0.5">
                          {point.position}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-semibold text-foreground">
                              {point.titre}
                            </h3>
                            {isPrepared && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                                </TooltipTrigger>
                                <TooltipContent>Vous avez préparé ce point</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge className={`${typeConfig.color} border-0 text-xs`}>
                              {typeConfig.label}
                            </Badge>
                            {rapporteurName && (
                              <span className="text-xs text-muted-foreground">
                                Rapporteur : {rapporteurName}
                              </span>
                            )}
                            {point.huis_clos && (
                              <Badge variant="outline" className="text-xs">Huis clos</Badge>
                            )}
                          </div>
                        </div>
                        <div className="shrink-0 mt-1">
                          {isExpanded ? (
                            <ChevronUp className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                      </button>
                    </CollapsibleTrigger>

                    {/* ─── Point content (expanded) ─── */}
                    <CollapsibleContent>
                      <div className="px-4 sm:px-5 pb-5 space-y-5">
                        <Separator />

                        {/* Documents joints */}
                        {documents.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                              <Paperclip className="h-4 w-4 text-muted-foreground" />
                              Documents joints
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {documents.map((doc, i) => (
                                <Tooltip key={i}>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="text-xs h-8"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleOpenDocument(doc)
                                      }}
                                    >
                                      <Download className="h-3 w-3 mr-1.5" />
                                      {doc.name}
                                      <ExternalLink className="h-3 w-3 ml-1.5 text-muted-foreground" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Ouvrir dans un nouvel onglet</TooltipContent>
                                </Tooltip>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Projet de délibération */}
                        {point.projet_deliberation && (
                          <div>
                            <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              Projet de délibération
                            </h4>
                            <div className="rounded-lg bg-muted/40 border p-4">
                              <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
                                {point.projet_deliberation}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Description */}
                        {point.description && (
                          <div>
                            <h4 className="text-sm font-semibold text-foreground mb-2">
                              Description
                            </h4>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                              {point.description}
                            </p>
                          </div>
                        )}

                        <Separator className="print:hidden" />

                        {/* ─── Personal notes ─── */}
                        <div className="print:break-inside-avoid">
                          <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                            <span className="text-base">📝</span>
                            Mes notes personnelles
                          </h4>
                          <Textarea
                            value={prep.notes}
                            onChange={(e) => updatePrep(point.id, { notes: e.target.value })}
                            placeholder="Notez ici vos réflexions, observations ou points d'attention pour ce sujet..."
                            className="min-h-[100px] resize-y text-sm"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Sauvegardé automatiquement sur cet appareil
                          </p>
                        </div>

                        {/* ─── Questions ─── */}
                        <div className="print:break-inside-avoid">
                          <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                            <HelpCircle className="h-4 w-4 text-muted-foreground" />
                            Mes questions à poser
                          </h4>
                          <div className="space-y-2">
                            {prep.questions.map((q, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground w-5 text-right shrink-0">
                                  {idx + 1}.
                                </span>
                                <Input
                                  value={q}
                                  onChange={(e) => {
                                    const newQuestions = [...prep.questions]
                                    newQuestions[idx] = e.target.value
                                    updatePrep(point.id, { questions: newQuestions })
                                  }}
                                  placeholder="Votre question..."
                                  className="text-sm h-9"
                                />
                                {prep.questions.length > 1 && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive print:hidden"
                                        onClick={() => {
                                          const newQuestions = prep.questions.filter((_, i) => i !== idx)
                                          if (newQuestions.length === 0) newQuestions.push('')
                                          updatePrep(point.id, { questions: newQuestions })
                                        }}
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Supprimer cette question</TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            ))}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs text-muted-foreground hover:text-foreground print:hidden"
                              onClick={() => {
                                updatePrep(point.id, {
                                  questions: [...prep.questions, ''],
                                })
                              }}
                            >
                              <Plus className="h-3.5 w-3.5 mr-1" />
                              Ajouter une question
                            </Button>
                          </div>
                        </div>

                        {/* ─── Avis préliminaire ─── */}
                        <div className="print:break-inside-avoid">
                          <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                            <span className="text-base">🏷️</span>
                            Mon avis préliminaire
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-help">
                                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                Votre avis préliminaire est personnel et n&apos;est pas partagé.
                                Il vous aide à préparer votre position avant la discussion en séance.
                              </TooltipContent>
                            </Tooltip>
                          </h4>
                          <div className="flex items-center gap-2">
                            <Button
                              variant={prep.avis === 'pour' ? 'default' : 'outline'}
                              size="sm"
                              className={`text-xs ${
                                prep.avis === 'pour'
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                  : 'hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300'
                              }`}
                              onClick={() =>
                                updatePrep(point.id, {
                                  avis: prep.avis === 'pour' ? null : 'pour',
                                })
                              }
                            >
                              <ThumbsUp className="h-3.5 w-3.5 mr-1.5" />
                              Pour
                            </Button>
                            <Button
                              variant={prep.avis === 'reserve' ? 'default' : 'outline'}
                              size="sm"
                              className={`text-xs ${
                                prep.avis === 'reserve'
                                  ? 'bg-amber-500 hover:bg-amber-600 text-white'
                                  : 'hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300'
                              }`}
                              onClick={() =>
                                updatePrep(point.id, {
                                  avis: prep.avis === 'reserve' ? null : 'reserve',
                                })
                              }
                            >
                              <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
                              Réservé
                            </Button>
                            <Button
                              variant={prep.avis === 'contre' ? 'default' : 'outline'}
                              size="sm"
                              className={`text-xs ${
                                prep.avis === 'contre'
                                  ? 'bg-red-600 hover:bg-red-700 text-white'
                                  : 'hover:bg-red-50 hover:text-red-700 hover:border-red-300'
                              }`}
                              onClick={() =>
                                updatePrep(point.id, {
                                  avis: prep.avis === 'contre' ? null : 'contre',
                                })
                              }
                            >
                              <ThumbsDown className="h-3.5 w-3.5 mr-1.5" />
                              Contre
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              )
            })}
          </div>
        )}

        {/* ─── Footer tip ─────────────────────────────────────────── */}
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 print:hidden">
          <p className="text-sm text-blue-700 flex items-start gap-2">
            <HelpCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Vos notes et questions sont sauvegardées automatiquement sur cet appareil.
              Elles ne sont visibles que par vous et ne sont pas partagées avec les autres membres.
            </span>
          </p>
        </div>
      </div>
    </TooltipProvider>
  )
}
