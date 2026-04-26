'use client'

import { useState } from 'react'
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ROUTES } from '@/lib/constants'
import { formatDate, formatTime, formatShortDate } from '@/lib/utils/format-date'

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

interface SeanceParticipation {
  id: string
  titre: string
  date_seance: string
  participated: boolean
}

interface ProcurationDetail {
  id: string
  seance_titre: string
  seance_date: string
  autre_membre_nom: string
  type: 'donnee' | 'recue'
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
  allSeancesParticipation?: SeanceParticipation[]
  allVotes?: VoteSummary[]
  procurationDetails?: ProcurationDetail[]
}

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

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

const CHOIX_CONFIG: Record<string, { label: string; color: string }> = {
  POUR: { label: 'Pour', color: 'bg-emerald-100 text-emerald-700' },
  CONTRE: { label: 'Contre', color: 'bg-red-100 text-red-700' },
  ABSTENTION: { label: 'Abstention', color: 'bg-slate-100 text-slate-600' },
  NPPV: { label: 'NPPV', color: 'bg-amber-100 text-amber-700' },
}

const CONVOCATION_CONFIG: Record<string, { label: string; color: string }> = {
  CONFIRME_PRESENT: { label: 'Présence confirmée', color: 'bg-emerald-100 text-emerald-700' },
  ENVOYE: { label: 'Convocation envoyée', color: 'bg-blue-100 text-blue-700' },
  LU: { label: 'Convocation lue', color: 'bg-sky-100 text-sky-700' },
  NON_ENVOYE: { label: 'Non envoyée', color: 'bg-slate-100 text-slate-600' },
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
  allSeancesParticipation,
  allVotes,
  procurationDetails,
}: EluDashboardProps) {
  const [detailDialog, setDetailDialog] = useState<string | null>(null)

  const participationPercent =
    stats.seancesConvoquees > 0
      ? Math.round((stats.seancesParticipees / stats.seancesConvoquees) * 100)
      : 0

  const currentYear = new Date().getFullYear()

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

        {/* ─── Section A: Ma prochaine séance (hero) ─────────── */}
        <section>
          <h2 className="sr-only">Ma prochaine séance</h2>
          {nextSeance ? (
            <HeroSeanceCard seance={nextSeance} />
          ) : (
            <div className="rounded-xl border-2 border-dashed border-muted p-8 text-center">
              <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-muted mb-3">
                <CalendarDays className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1">
                Aucune séance à venir
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Vous serez notifié(e) par email lorsqu&apos;une séance sera programmée.
              </p>
            </div>
          )}
        </section>

        {/* ─── Section B: Mes statistiques ────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-institutional-blue" />
            Mes statistiques <span suppressHydrationWarning>{currentYear}</span>
          </h2>
          <div className="grid gap-4 sm:grid-cols-3 stagger-in">
            {/* Participation */}
            <button
              type="button"
              onClick={() => setDetailDialog('seances')}
              className="block w-full text-left group"
              title="Voir le detail de mes seances"
            >
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
                        Taux de participation aux seances cette annee
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
            </button>

            {/* Votes */}
            <button
              type="button"
              onClick={() => setDetailDialog('votes')}
              className="block w-full text-left group"
              title="Voir le detail de mes votes"
            >
              <div className="stat-card cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] transition-all hover:border-emerald-300">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                    <Vote className="h-5 w-5" />
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-2xl font-bold text-foreground">{stats.votesEffectues}</p>
                <p className="text-sm text-muted-foreground mt-0.5">Votes effectues</p>
              </div>
            </button>

            {/* Procurations */}
            <button
              type="button"
              onClick={() => setDetailDialog('procurations')}
              className="block w-full text-left group"
              title="Voir le detail de mes procurations"
            >
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
                  {stats.procurationsGiven} donnee(s), {stats.procurationsReceived} recue(s)
                </p>
              </div>
            </button>
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
              Voir toutes les délibérations
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
                    <h3 className="font-semibold text-foreground">Délibérations</h3>
                    <p className="text-xs text-muted-foreground">Consulter les délibérations</p>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </section>
      </div>

      {/* ─── Detail Dialogs ──────────────────────────────────── */}

      {/* Seances participation dialog */}
      <Dialog open={detailDialog === 'seances'} onOpenChange={(open) => !open && setDetailDialog(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-institutional-blue" />
              Mes seances ({currentYear})
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 mt-2">
            {allSeancesParticipation && allSeancesParticipation.length > 0 ? (
              allSeancesParticipation.map((seance) => (
                <div
                  key={seance.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    seance.participated
                      ? 'border-emerald-200 bg-emerald-50'
                      : 'border-muted bg-muted/30'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{seance.titre}</p>
                    <p className="text-xs text-muted-foreground">{formatShortDate(seance.date_seance)}</p>
                  </div>
                  {seance.participated ? (
                    <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs shrink-0 ml-2">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Present(e)
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground text-xs shrink-0 ml-2">
                      Absent(e)
                    </Badge>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-6">
                <CalendarDays className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Aucune séance enregistrée cette année.
                </p>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between mt-4 pt-3 border-t">
            <Link
              href={ROUTES.SEANCES}
              className="text-sm text-institutional-blue hover:underline flex items-center gap-1"
            >
              Voir toutes les seances
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Button variant="outline" size="sm" onClick={() => setDetailDialog(null)}>
              Fermer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Votes detail dialog */}
      <Dialog open={detailDialog === 'votes'} onOpenChange={(open) => !open && setDetailDialog(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Vote className="h-5 w-5 text-emerald-600" />
              Mes votes ({currentYear})
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 mt-2">
            {(allVotes && allVotes.length > 0 ? allVotes : recentVotes).length > 0 ? (
              (allVotes && allVotes.length > 0 ? allVotes : recentVotes).map((vote) => {
                const resultConfig = vote.resultat ? RESULTAT_CONFIG[vote.resultat] : null
                const choixConfig = vote.choix ? CHOIX_CONFIG[vote.choix] : null
                return (
                  <div
                    key={vote.id}
                    className="rounded-lg border bg-card p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">
                          {vote.question || 'Vote'}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs text-muted-foreground">
                            {vote.clos_at ? formatShortDate(vote.clos_at) : ''}
                          </span>
                          {vote.type_vote && (
                            <Badge variant="outline" className="text-xs">
                              {vote.type_vote === 'MAIN_LEVEE'
                                ? 'Main levee'
                                : vote.type_vote === 'BULLETIN_SECRET'
                                  ? 'Bulletin secret'
                                  : vote.type_vote === 'NOMINAL'
                                    ? 'Nominal'
                                    : vote.type_vote}
                            </Badge>
                          )}
                        </div>
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
                    <div className="mt-2 pt-2 border-t">
                      {vote.is_secret ? (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Lock className="h-3 w-3" />
                          Vote enregistre (bulletin secret)
                        </span>
                      ) : choixConfig ? (
                        <span className="text-xs flex items-center gap-1">
                          Mon choix :
                          <Badge className={`${choixConfig.color} border-0 text-xs ml-1`}>
                            {choixConfig.label}
                          </Badge>
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Choix non renseigne
                        </span>
                      )}
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="text-center py-6">
                <Vote className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Vous n&apos;avez participe a aucun vote pour le moment.
                </p>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between mt-4 pt-3 border-t">
            <Link
              href={ROUTES.DELIBERATIONS}
              className="text-sm text-institutional-blue hover:underline flex items-center gap-1"
            >
              Voir toutes les délibérations
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Button variant="outline" size="sm" onClick={() => setDetailDialog(null)}>
              Fermer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Procurations detail dialog */}
      <Dialog open={detailDialog === 'procurations'} onOpenChange={(open) => !open && setDetailDialog(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-amber-600" />
              Mes procurations
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {procurationDetails && procurationDetails.length > 0 ? (
              <>
                {/* Procurations recues */}
                {procurationDetails.filter((p) => p.type === 'recue').length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      Procurations recues
                    </h4>
                    <div className="space-y-2">
                      {procurationDetails
                        .filter((p) => p.type === 'recue')
                        .map((proc) => (
                          <div key={proc.id} className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                            <p className="text-sm font-medium text-foreground">
                              De {proc.autre_membre_nom}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {proc.seance_titre} - {formatShortDate(proc.seance_date)}
                            </p>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Procurations donnees */}
                {procurationDetails.filter((p) => p.type === 'donnee').length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                      <ArrowRight className="h-4 w-4 text-amber-600" />
                      Procurations donnees
                    </h4>
                    <div className="space-y-2">
                      {procurationDetails
                        .filter((p) => p.type === 'donnee')
                        .map((proc) => (
                          <div key={proc.id} className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                            <p className="text-sm font-medium text-foreground">
                              A {proc.autre_membre_nom}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {proc.seance_titre} - {formatShortDate(proc.seance_date)}
                            </p>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-6">
                <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Aucune procuration enregistree.
                </p>
              </div>
            )}
          </div>
          <div className="flex items-center justify-end mt-4 pt-3 border-t">
            <Button variant="outline" size="sm" onClick={() => setDetailDialog(null)}>
              Fermer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
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
