'use client'

import Link from 'next/link'
import {
  CalendarDays,
  Clock,
  FileText,
  PenLine,
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Star,
  ArrowRight,
  Users,
  BarChart3,
  TrendingUp,
  MapPin,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ROUTES } from '@/lib/constants'

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

interface UrgentAction {
  id: string
  severity: 'red' | 'amber'
  label: string
  href: string
  count?: number
}

interface PresidentStats {
  seancesPresidees: number
  deliberationsPubliees: number
  tauxParticipationMoyen: number
  pvEnAttente: number
}

interface QuorumPrediction {
  seance_id: string
  seance_titre: string
  seance_date: string
  confirmes: number
  totalConvocataires: number
  quorumRequis: number
}

interface DelibSummary {
  id: string
  numero: string | null
  titre: string
  publie_at: string | null
  resultat: string | null
}

interface SeanceSummary {
  id: string
  titre: string
  date_seance: string
  statut: string | null
  instance_nom: string | null
  lieu: string | null
}

export interface PresidentDashboardProps {
  firstName: string
  greeting: string
  urgentActions: UrgentAction[]
  stats: PresidentStats
  quorumPrediction: QuorumPrediction | null
  recentDelibs: DelibSummary[]
  seances: SeanceSummary[]
}

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function formatShortDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

function formatTime(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

const STATUT_CONFIG: Record<string, { label: string; color: string }> = {
  BROUILLON: { label: 'Brouillon', color: 'bg-slate-100 text-slate-700' },
  CONVOQUEE: { label: 'Convoquee', color: 'bg-blue-100 text-blue-700' },
  EN_COURS: { label: 'En cours', color: 'bg-emerald-100 text-emerald-700' },
  SUSPENDUE: { label: 'Suspendue', color: 'bg-amber-100 text-amber-700' },
  CLOTUREE: { label: 'Cloturee', color: 'bg-purple-100 text-purple-700' },
  ARCHIVEE: { label: 'Archivee', color: 'bg-gray-100 text-gray-500' },
}

const RESULTAT_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  ADOPTE: {
    label: 'Adopte',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    color: 'bg-emerald-100 text-emerald-700',
  },
  ADOPTE_UNANIMITE: {
    label: 'Unanimite',
    icon: <Star className="h-3.5 w-3.5" />,
    color: 'bg-amber-100 text-amber-700',
  },
  ADOPTE_VOIX_PREPONDERANTE: {
    label: 'Voix prep.',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    color: 'bg-emerald-100 text-emerald-700',
  },
  REJETE: {
    label: 'Rejete',
    icon: <XCircle className="h-3.5 w-3.5" />,
    color: 'bg-red-100 text-red-700',
  },
  NUL: {
    label: 'Nul',
    icon: <XCircle className="h-3.5 w-3.5" />,
    color: 'bg-slate-100 text-slate-600',
  },
}

// ────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────

export function PresidentDashboard({
  firstName,
  greeting,
  urgentActions,
  stats,
  quorumPrediction,
  recentDelibs,
  seances,
}: PresidentDashboardProps) {
  const upcoming = seances.filter(
    (s) => new Date(s.date_seance) >= new Date() || s.statut === 'EN_COURS'
  )

  return (
    <TooltipProvider>
      <div className="space-y-8">
        {/* ─── Welcome ───────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-institutional-blue/10 text-institutional-blue">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {greeting}, {firstName}
            </h1>
            <p className="text-sm text-muted-foreground">President(e) de seance</p>
          </div>
        </div>

        {/* ─── Section A: Actions urgentes ────────────────────── */}
        <section>
          {urgentActions.length === 0 ? (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <p className="text-sm font-medium text-emerald-800">
                Tout est a jour — aucune action requise.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {urgentActions.map((action) => (
                <Link key={action.id} href={action.href} className="block group">
                  <div
                    className={`rounded-xl border p-4 flex items-center justify-between gap-3 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${
                      action.severity === 'red'
                        ? 'bg-red-50 border-red-200 hover:border-red-300'
                        : 'bg-amber-50 border-amber-200 hover:border-amber-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <AlertTriangle
                        className={`h-5 w-5 shrink-0 ${
                          action.severity === 'red'
                            ? 'text-red-600'
                            : 'text-amber-600'
                        }`}
                      />
                      <p
                        className={`text-sm font-medium ${
                          action.severity === 'red'
                            ? 'text-red-800'
                            : 'text-amber-800'
                        }`}
                      >
                        {action.label}
                      </p>
                    </div>
                    <ArrowRight
                      className={`h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1 ${
                        action.severity === 'red'
                          ? 'text-red-500'
                          : 'text-amber-500'
                      }`}
                    />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* ─── Section B: Indicateurs ─────────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-institutional-blue" />
            Indicateurs {new Date().getFullYear()}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 stagger-in">
            <Link href={ROUTES.SEANCES} className="block group" title="Voir toutes les séances présidées">
              <div className="stat-card cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] transition-all hover:border-institutional-blue/30">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-institutional-blue">
                    <CalendarDays className="h-5 w-5" />
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-2xl font-bold text-foreground">{stats.seancesPresidees}</p>
                <p className="text-sm text-muted-foreground mt-0.5">Séances présidées</p>
              </div>
            </Link>

            <Link href={ROUTES.DELIBERATIONS} className="block group" title="Voir toutes les délibérations publiées">
              <div className="stat-card cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] transition-all hover:border-emerald-300">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                    <FileText className="h-5 w-5" />
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {stats.deliberationsPubliees}
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">Délibérations publiées</p>
              </div>
            </Link>

            <Link href={ROUTES.SEANCES} className="block group" title="Voir le détail de participation aux séances">
              <div className="stat-card cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] transition-all hover:border-sky-300">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-xs text-muted-foreground cursor-help">
                          {stats.tauxParticipationMoyen}%
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        Taux moyen de présence des membres lors de vos séances
                      </TooltipContent>
                    </Tooltip>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {stats.tauxParticipationMoyen}%
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Taux de participation moyen
                </p>
                <Progress value={stats.tauxParticipationMoyen} className="mt-2 h-1.5" />
              </div>
            </Link>

            <Link href={ROUTES.SEANCES} className="block group" title="Voir les PV en attente de signature">
              <div className="stat-card cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] transition-all hover:border-amber-300">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                    <PenLine className="h-5 w-5" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    {stats.pvEnAttente > 0 && (
                      <Badge className="bg-red-500 text-white border-0 text-xs font-bold">
                        {stats.pvEnAttente}
                      </Badge>
                    )}
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-foreground">{stats.pvEnAttente}</p>
                <p className="text-sm text-muted-foreground mt-0.5">PV en attente</p>
              </div>
            </Link>
          </div>
        </section>

        {/* ─── Section C: Prediction quorum ───────────────────── */}
        {quorumPrediction && (
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-institutional-blue" />
              Prediction quorum
            </h2>
            <QuorumCard prediction={quorumPrediction} />
          </section>
        )}

        {/* ─── Section D: Dernieres deliberations ─────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <FileText className="h-5 w-5 text-purple-600" />
              Dernieres deliberations
            </h2>
            <Link
              href={ROUTES.DELIBERATIONS}
              className="text-sm text-institutional-blue hover:underline flex items-center gap-1"
            >
              Toutes les deliberations
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {recentDelibs.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-muted p-6 text-center">
              <p className="text-sm text-muted-foreground">
                Aucune deliberation publiee pour le moment.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentDelibs.map((delib) => {
                const resultConfig = delib.resultat
                  ? RESULTAT_CONFIG[delib.resultat]
                  : null
                return (
                  <div
                    key={delib.id}
                    className="rounded-lg border bg-card p-4 flex items-center justify-between gap-3 card-interactive"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {delib.numero && (
                          <Badge variant="outline" className="text-xs shrink-0">
                            {delib.numero}
                          </Badge>
                        )}
                        <p className="text-sm font-medium text-foreground truncate">
                          {delib.titre}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {delib.publie_at ? formatShortDate(delib.publie_at) : ''}
                      </p>
                    </div>
                    {resultConfig && (
                      <Badge
                        className={`${resultConfig.color} border-0 text-xs font-medium flex items-center gap-1 shrink-0`}
                      >
                        {resultConfig.icon}
                        {resultConfig.label}
                      </Badge>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* ─── Section E: Mes seances (timeline) ──────────────── */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-institutional-blue" />
            Mes seances
          </h2>

          {upcoming.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-muted p-8 text-center">
              <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-muted mb-3">
                <CalendarDays className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1">
                Aucune seance a venir
              </h3>
              <p className="text-sm text-muted-foreground">
                Vous n&apos;avez aucune seance a presider pour le moment.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcoming.map((seance) => {
                const statut = STATUT_CONFIG[seance.statut || 'BROUILLON']
                return (
                  <Link
                    key={seance.id}
                    href={`/seances/${seance.id}`}
                    className="block group"
                  >
                    <div className="rounded-xl border bg-card p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-institutional-blue/30">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Badge
                          className={`${statut?.color || 'bg-slate-100 text-slate-700'} border-0 text-xs font-medium`}
                        >
                          {statut?.label || seance.statut}
                        </Badge>
                        {seance.instance_nom && (
                          <Badge variant="outline" className="text-xs">
                            {seance.instance_nom}
                          </Badge>
                        )}
                      </div>
                      <h3 className="text-sm font-semibold text-foreground truncate group-hover:text-institutional-blue transition-colors">
                        {seance.titre}
                      </h3>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" />
                          {formatDate(seance.date_seance)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTime(seance.date_seance)}
                        </span>
                        {seance.lieu && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {seance.lieu}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </section>

        {/* ─── Quick access ──────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4">Acces rapide</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Link href={ROUTES.SEANCES} className="block group">
              <div className="rounded-xl border bg-card p-5 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-institutional-blue/30">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-institutional-blue">
                    <CalendarDays className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Seances</h3>
                    <p className="text-xs text-muted-foreground">Toutes les seances</p>
                  </div>
                </div>
              </div>
            </Link>
            <Link href={ROUTES.DELIBERATIONS} className="block group">
              <div className="rounded-xl border bg-card p-5 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-institutional-blue/30">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 text-purple-700">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Deliberations</h3>
                    <p className="text-xs text-muted-foreground">Deliberations recentes</p>
                  </div>
                </div>
              </div>
            </Link>
            <Link href={ROUTES.MEMBRES} className="block group">
              <div className="rounded-xl border bg-card p-5 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-institutional-blue/30">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Membres</h3>
                    <p className="text-xs text-muted-foreground">Elus et agents</p>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </section>
      </div>
    </TooltipProvider>
  )
}

// ────────────────────────────────────────────────────────────────
// Quorum Card
// ────────────────────────────────────────────────────────────────

function QuorumCard({ prediction }: { prediction: QuorumPrediction }) {
  const percent =
    prediction.totalConvocataires > 0
      ? Math.round((prediction.confirmes / prediction.totalConvocataires) * 100)
      : 0
  const quorumPercent =
    prediction.totalConvocataires > 0
      ? Math.round((prediction.quorumRequis / prediction.totalConvocataires) * 100)
      : 0
  const isQuorumMet = prediction.confirmes >= prediction.quorumRequis
  const isClose =
    !isQuorumMet && prediction.confirmes >= prediction.quorumRequis - 2

  let colorClass: string
  let bgClass: string
  if (isQuorumMet) {
    colorClass = 'text-emerald-700'
    bgClass = 'bg-emerald-50 border-emerald-200'
  } else if (isClose) {
    colorClass = 'text-amber-700'
    bgClass = 'bg-amber-50 border-amber-200'
  } else {
    colorClass = 'text-red-700'
    bgClass = 'bg-red-50 border-red-200'
  }

  return (
    <div className={`rounded-xl border p-5 ${bgClass}`}>
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <p className="text-sm font-medium text-foreground">{prediction.seance_titre}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatDate(prediction.seance_date)}
          </p>
        </div>
        <Badge
          className={`${
            isQuorumMet
              ? 'bg-emerald-600 text-white'
              : isClose
                ? 'bg-amber-500 text-white'
                : 'bg-red-500 text-white'
          } border-0 text-xs font-semibold`}
        >
          {isQuorumMet ? 'Quorum atteint' : isClose ? 'Quorum proche' : 'Quorum non atteint'}
        </Badge>
      </div>

      <div className="flex items-end justify-between mb-2">
        <p className={`text-lg font-bold ${colorClass}`}>
          {prediction.confirmes} / {prediction.totalConvocataires} confirmes
        </p>
        <Tooltip>
          <TooltipTrigger asChild>
            <p className="text-xs text-muted-foreground cursor-help">
              Quorum requis : {prediction.quorumRequis} membres
            </p>
          </TooltipTrigger>
          <TooltipContent>
            Nombre minimum de membres presents requis pour que la seance puisse deliberer valablement
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="relative">
        <Progress value={percent} className="h-3" />
        {/* Quorum marker */}
        <div
          className="absolute top-0 h-3 w-0.5 bg-foreground/60 rounded-full"
          style={{ left: `${Math.min(quorumPercent, 100)}%` }}
        />
      </div>

      <div className="flex justify-between mt-1.5 text-xs text-muted-foreground">
        <span>0</span>
        <span className="font-medium">
          Seuil: {prediction.quorumRequis}
        </span>
        <span>{prediction.totalConvocataires}</span>
      </div>
    </div>
  )
}
