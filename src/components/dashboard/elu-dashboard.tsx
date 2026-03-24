'use client'

import Link from 'next/link'
import {
  CalendarDays,
  Clock,
  User,
  FileText,
  Vote,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Star,
  Lock,
  MapPin,
  Monitor,
  Users,
  Download,
  BarChart3,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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

interface NextSeanceInfo {
  id: string
  titre: string
  date_seance: string
  statut: string | null
  instance_nom: string | null
  lieu: string | null
  mode: string | null
  convocation_statut: string | null
  odj_points: { position: number; titre: string }[]
}

interface VoteSummary {
  id: string
  question: string | null
  resultat: string | null
  clos_at: string | null
  type_vote: string | null
  choix: string | null // null for secret votes
  is_secret: boolean
}

interface PVDocument {
  seance_id: string
  seance_titre: string
  seance_date: string
  pdf_url: string | null
}

interface EluStats {
  seancesParticipees: number
  seancesConvoquees: number
  votesEffectues: number
  procurationsGiven: number
  procurationsReceived: number
}

export interface EluDashboardProps {
  firstName: string
  greeting: string
  nextSeance: NextSeanceInfo | null
  stats: EluStats
  recentVotes: VoteSummary[]
  recentPV: PVDocument[]
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

function getCountdown(dateStr: string): { label: string; urgent: boolean } {
  const now = new Date()
  const target = new Date(dateStr)
  const diffMs = target.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  const diffHours = Math.ceil(diffMs / (1000 * 60 * 60))

  if (diffMs < 0) return { label: 'Maintenant', urgent: true }
  if (diffDays === 0) {
    if (diffHours <= 1) return { label: "Dans moins d'1 heure", urgent: true }
    return { label: `Aujourd'hui a ${formatTime(dateStr)}`, urgent: true }
  }
  if (diffDays === 1) return { label: `Demain a ${formatTime(dateStr)}`, urgent: false }
  if (diffDays <= 7) return { label: `Dans ${diffDays} jours`, urgent: false }
  return { label: `Dans ${diffDays} jours`, urgent: false }
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

const CONVOCATION_CONFIG: Record<string, { label: string; color: string }> = {
  CONFIRME_PRESENT: { label: 'Presence confirmee', color: 'bg-emerald-100 text-emerald-700' },
  ENVOYE: { label: 'Convocation envoyee', color: 'bg-blue-100 text-blue-700' },
  LU: { label: 'Convocation lue', color: 'bg-sky-100 text-sky-700' },
  NON_ENVOYE: { label: 'Non envoyee', color: 'bg-slate-100 text-slate-600' },
  ABSENT_PROCURATION: { label: 'Procuration', color: 'bg-amber-100 text-amber-700' },
  ERREUR_EMAIL: { label: 'Erreur d\'envoi', color: 'bg-red-100 text-red-700' },
}

const MODE_ICONS: Record<string, React.ReactNode> = {
  PRESENTIEL: <MapPin className="h-3.5 w-3.5" />,
  HYBRIDE: <Users className="h-3.5 w-3.5" />,
  VISIO: <Monitor className="h-3.5 w-3.5" />,
}

const MODE_LABELS: Record<string, string> = {
  PRESENTIEL: 'Presentiel',
  HYBRIDE: 'Hybride',
  VISIO: 'Visioconference',
}

// ────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────

export function EluDashboard({
  firstName,
  greeting,
  nextSeance,
  stats,
  recentVotes,
  recentPV,
}: EluDashboardProps) {
  const participationPercent =
    stats.seancesConvoquees > 0
      ? Math.round((stats.seancesParticipees / stats.seancesConvoquees) * 100)
      : 0

  return (
    <TooltipProvider>
      <div className="space-y-8">
        {/* ─── Welcome ───────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-institutional-blue">
            <User className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {greeting}, {firstName}
            </h1>
            <p className="text-sm text-muted-foreground">Membre votant</p>
          </div>
        </div>

        {/* ─── Section A: Ma prochaine seance (hero) ─────────── */}
        <section>
          <h2 className="sr-only">Ma prochaine seance</h2>
          {nextSeance ? (
            <HeroSeanceCard seance={nextSeance} />
          ) : (
            <div className="rounded-xl border-2 border-dashed border-muted p-8 text-center">
              <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-muted mb-3">
                <CalendarDays className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1">
                Aucune seance a venir
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Vous serez notifie(e) par email lorsqu&apos;une seance sera programmee.
              </p>
            </div>
          )}
        </section>

        {/* ─── Section B: Mes statistiques ────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-institutional-blue" />
            Mes statistiques <span suppressHydrationWarning>{new Date().getFullYear()}</span>
          </h2>
          <div className="grid gap-4 sm:grid-cols-3 stagger-in">
            {/* Participation */}
            <Link href={ROUTES.SEANCES} className="block group" title="Voir toutes les séances">
              <div className="stat-card cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] transition-all hover:border-institutional-blue/30">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-institutional-blue">
                    <CalendarDays className="h-5 w-5" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-xs text-muted-foreground cursor-help">
                          {participationPercent}%
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        Taux de participation aux séances cette année
                      </TooltipContent>
                    </Tooltip>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {stats.seancesParticipees}{' '}
                  <span className="text-sm font-normal text-muted-foreground">
                    / {stats.seancesConvoquees}
                  </span>
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">Séances participées</p>
                <Progress
                  value={participationPercent}
                  className="mt-2 h-1.5"
                />
              </div>
            </Link>

            {/* Votes */}
            <Link href={ROUTES.DELIBERATIONS} className="block group" title="Voir toutes les délibérations">
              <div className="stat-card cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] transition-all hover:border-emerald-300">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                    <Vote className="h-5 w-5" />
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-2xl font-bold text-foreground">{stats.votesEffectues}</p>
                <p className="text-sm text-muted-foreground mt-0.5">Votes effectués</p>
              </div>
            </Link>

            {/* Procurations */}
            <Link href={ROUTES.SEANCES} className="block group" title="Voir les séances">
              <div className="stat-card cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] transition-all hover:border-amber-300">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                    <Users className="h-5 w-5" />
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {stats.procurationsGiven + stats.procurationsReceived}
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {stats.procurationsGiven} donnée(s), {stats.procurationsReceived} reçue(s)
                </p>
              </div>
            </Link>
          </div>
        </section>

        {/* ─── Section C: Mes derniers votes ──────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Vote className="h-5 w-5 text-emerald-600" />
              Mes derniers votes
            </h2>
            <Link
              href={ROUTES.DELIBERATIONS}
              className="text-sm text-institutional-blue hover:underline flex items-center gap-1"
            >
              Voir toutes les deliberations
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {recentVotes.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-muted p-6 text-center">
              <p className="text-sm text-muted-foreground">
                Aucun vote enregistre pour le moment.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentVotes.map((vote) => {
                const resultConfig = vote.resultat
                  ? RESULTAT_CONFIG[vote.resultat]
                  : null
                return (
                  <div
                    key={vote.id}
                    className="rounded-lg border bg-card p-4 flex items-center justify-between gap-3 card-interactive"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {vote.question || 'Vote'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {vote.clos_at ? formatShortDate(vote.clos_at) : ''}
                        {vote.is_secret && (
                          <span className="inline-flex items-center gap-1 ml-2">
                            <Lock className="h-3 w-3" />
                            Vote secret
                          </span>
                        )}
                      </p>
                    </div>
                    {resultConfig && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge
                            className={`${resultConfig.color} border-0 text-xs font-medium flex items-center gap-1 shrink-0`}
                          >
                            {resultConfig.icon}
                            {resultConfig.label}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          Resultat du vote : {resultConfig.label.toLowerCase()}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* ─── Section D: Documents recents ───────────────────── */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-purple-600" />
            Documents recents
          </h2>

          {recentPV.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-muted p-6 text-center">
              <p className="text-sm text-muted-foreground">
                Aucun proces-verbal publie pour le moment.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentPV.map((pv) => (
                <div
                  key={pv.seance_id}
                  className="rounded-lg border bg-card p-4 flex items-center justify-between gap-3 card-interactive"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      PV — {pv.seance_titre}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatShortDate(pv.seance_date)}
                    </p>
                  </div>
                  {pv.pdf_url ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" asChild>
                          <a
                            href={pv.pdf_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Download className="h-3.5 w-3.5 mr-1.5" />
                            PDF
                          </a>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Telecharger le proces-verbal en PDF</TooltipContent>
                    </Tooltip>
                  ) : (
                    <Link href={`/seances/${pv.seance_id}/pv`}>
                      <Button variant="outline" size="sm">
                        Consulter
                      </Button>
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ─── Quick access ──────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4">Acces rapide</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Link href={ROUTES.SEANCES} className="block group">
              <div className="rounded-xl border bg-card p-5 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-institutional-blue/30">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-institutional-blue">
                    <CalendarDays className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Mes seances</h3>
                    <p className="text-xs text-muted-foreground">Consulter vos seances</p>
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
                    <p className="text-xs text-muted-foreground">Consulter les deliberations</p>
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
// Hero Seance Card
// ────────────────────────────────────────────────────────────────

function HeroSeanceCard({ seance }: { seance: NextSeanceInfo }) {
  const isEnCours = seance.statut === 'EN_COURS'
  const countdown = getCountdown(seance.date_seance)
  const convocConfig = seance.convocation_statut
    ? CONVOCATION_CONFIG[seance.convocation_statut]
    : null
  const isConfirmed = seance.convocation_statut === 'CONFIRME_PRESENT'
  const modeIcon = seance.mode ? MODE_ICONS[seance.mode] : null
  const modeLabel = seance.mode ? MODE_LABELS[seance.mode] : null

  return (
    <div
      className={`rounded-2xl border p-6 sm:p-8 ${
        isEnCours
          ? 'bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200'
          : 'bg-gradient-to-br from-blue-50 to-indigo-50/50 border-blue-200/60'
      }`}
    >
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
        {/* Left: date + countdown */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            {isEnCours ? (
              <Badge className="bg-emerald-600 text-white border-0 text-xs font-semibold animate-pulse">
                EN COURS
              </Badge>
            ) : (
              <Badge
                className={`border-0 text-xs font-semibold ${
                  countdown.urgent
                    ? 'bg-amber-500 text-white'
                    : 'bg-blue-600 text-white'
                }`}
                suppressHydrationWarning
              >
                {countdown.label}
              </Badge>
            )}
            {convocConfig && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge className={`${convocConfig.color} border-0 text-xs`}>
                    {isConfirmed && <CheckCircle2 className="h-3 w-3 mr-1" />}
                    {convocConfig.label}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>Statut de votre convocation</TooltipContent>
              </Tooltip>
            )}
          </div>

          <h3 className="text-xl font-bold text-foreground mb-1">{seance.titre}</h3>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground mb-4">
            {seance.instance_nom && (
              <span className="font-medium text-foreground/80">{seance.instance_nom}</span>
            )}
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              {formatDate(seance.date_seance)}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {formatTime(seance.date_seance)}
            </span>
            {seance.lieu && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                {seance.lieu}
              </span>
            )}
            {modeLabel && (
              <span className="flex items-center gap-1.5">
                {modeIcon}
                {modeLabel}
              </span>
            )}
          </div>

          {/* ODJ preview */}
          {seance.odj_points.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Ordre du jour
              </p>
              <ol className="space-y-1">
                {seance.odj_points.slice(0, 5).map((point) => (
                  <li
                    key={point.position}
                    className="text-sm text-foreground/80 flex items-start gap-2"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/80 text-xs font-semibold text-muted-foreground border">
                      {point.position}
                    </span>
                    <span className="truncate">{point.titre}</span>
                  </li>
                ))}
                {seance.odj_points.length > 5 && (
                  <li className="text-xs text-muted-foreground ml-7">
                    + {seance.odj_points.length - 5} autres points
                  </li>
                )}
              </ol>
            </div>
          )}
        </div>

        {/* Right: CTA */}
        <div className="flex flex-col items-start lg:items-end gap-3 shrink-0">
          {isEnCours ? (
            <Button
              asChild
              size="lg"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-lg"
            >
              <Link href={`/seances/${seance.id}/en-cours`}>
                Rejoindre la seance
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          ) : !isConfirmed && seance.convocation_statut !== 'NON_ENVOYE' ? (
            <Button asChild size="lg">
              <Link href={`/seances/${seance.id}`}>
                Confirmer ma presence
              </Link>
            </Button>
          ) : (
            <Button asChild variant="outline" size="lg">
              <Link href={`/seances/${seance.id}`}>
                Voir les details
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
