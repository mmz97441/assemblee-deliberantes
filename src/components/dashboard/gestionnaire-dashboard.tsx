'use client'

import Link from 'next/link'
import {
  CalendarDays,
  Users,
  FileText,
  Settings,
  Clock,
  ArrowRight,
  CalendarCheck,
  UserCheck,
  Plus,
  Sparkles,
  CheckCircle2,
  ClipboardList,
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

interface TaskItem {
  id: string
  severity: 'red' | 'amber' | 'blue'
  icon: React.ReactNode
  label: string
  action_label: string
  href: string
}

interface UpcomingSeanceCard {
  id: string
  titre: string
  date_seance: string
  instance_nom: string | null
  statut: string | null
  has_odj: boolean
  has_convocataires: boolean
  convocations_envoyees: boolean
  preparation_percent: number
}

interface GestionnaireStats {
  seancesCeMois: number
  deliberationsCeMois: number
  pvEnAttente: number
  membresActifs: number
}

export interface GestionnaireDashboardProps {
  firstName: string
  greeting: string
  isConfigured: boolean
  isSuperAdmin: boolean
  tasks: TaskItem[]
  upcomingSeances: UpcomingSeanceCard[]
  stats: GestionnaireStats
}

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

function formatShortDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
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

const SEVERITY_STYLES = {
  red: {
    bg: 'bg-red-50',
    border: 'border-red-200 hover:border-red-300',
    text: 'text-red-800',
    icon: 'text-red-600',
    button: 'bg-red-600 hover:bg-red-700 text-white',
  },
  amber: {
    bg: 'bg-amber-50',
    border: 'border-amber-200 hover:border-amber-300',
    text: 'text-amber-800',
    icon: 'text-amber-600',
    button: 'bg-amber-600 hover:bg-amber-700 text-white',
  },
  blue: {
    bg: 'bg-blue-50',
    border: 'border-blue-200 hover:border-blue-300',
    text: 'text-blue-800',
    icon: 'text-blue-600',
    button: 'bg-institutional-blue hover:bg-blue-700 text-white',
  },
}

// ────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────

export function GestionnaireDashboard({
  isConfigured,
  isSuperAdmin,
  tasks,
  upcomingSeances,
  stats,
}: GestionnaireDashboardProps) {
  return (
    <TooltipProvider>
      <div className="space-y-8">
        {/* ─── Welcome card — not configured (super_admin) ───── */}
        {!isConfigured && isSuperAdmin && (
          <div className="rounded-xl border-2 border-dashed border-institutional-blue/30 bg-blue-50/50 p-8 text-center">
            <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-full bg-institutional-blue/10 mb-4">
              <Sparkles className="h-7 w-7 text-institutional-blue" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Bienvenue !</h2>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">
              Commencez par configurer votre institution pour utiliser l&apos;application.
              Cette etape permet de personnaliser les parametres legaux et administratifs.
            </p>
            <Button asChild size="lg">
              <Link href={ROUTES.CONFIGURATION}>
                <Settings className="h-4 w-4 mr-2" />
                Configurer mon institution
              </Link>
            </Button>
          </div>
        )}

        {/* ─── Section A: A faire maintenant ──────────────────── */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-institutional-blue" />
            A faire maintenant
            {tasks.length > 0 && (
              <Badge className="bg-red-500 text-white border-0 text-xs font-bold ml-1">
                {tasks.length}
              </Badge>
            )}
          </h2>

          {tasks.length === 0 ? (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-5 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-800">
                  Rien d&apos;urgent — tout est a jour !
                </p>
                <p className="text-xs text-emerald-600 mt-0.5">
                  Profitez-en pour preparer vos prochaines seances.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => {
                const style = SEVERITY_STYLES[task.severity]
                return (
                  <div
                    key={task.id}
                    className={`rounded-xl border p-4 flex items-center justify-between gap-3 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${style.bg} ${style.border}`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`shrink-0 ${style.icon}`}>{task.icon}</div>
                      <p className={`text-sm font-medium ${style.text} truncate`}>
                        {task.label}
                      </p>
                    </div>
                    <Button asChild size="sm" className={`shrink-0 ${style.button}`}>
                      <Link href={task.href}>{task.action_label}</Link>
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* ─── Section B: Prochaines seances ──────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-institutional-blue" />
              Prochaines seances
            </h2>
            <Button asChild variant="outline" size="sm">
              <Link href={ROUTES.SEANCES}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Nouvelle seance
              </Link>
            </Button>
          </div>

          {upcomingSeances.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-muted p-8 text-center">
              <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-muted mb-3">
                <CalendarDays className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1">
                Aucune seance prevue
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-4">
                Planifiez votre premiere seance pour commencer a gerer vos assemblees deliberantes.
              </p>
              <Button asChild>
                <Link href={ROUTES.SEANCES}>
                  <Plus className="h-4 w-4 mr-2" />
                  Creer une seance
                </Link>
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 stagger-in">
              {upcomingSeances.map((seance) => (
                <Link
                  key={seance.id}
                  href={`/seances/${seance.id}`}
                  className="block group"
                >
                  <div className="rounded-xl border bg-card p-5 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-institutional-blue/30 h-full flex flex-col">
                    <div className="flex items-center gap-2 mb-2">
                      {seance.instance_nom && (
                        <Badge variant="outline" className="text-xs">
                          {seance.instance_nom}
                        </Badge>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-foreground group-hover:text-institutional-blue transition-colors truncate">
                      {seance.titre}
                    </h3>
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                      <CalendarDays className="h-3 w-3" />
                      <span>{formatShortDate(seance.date_seance)}</span>
                      <Clock className="h-3 w-3 ml-1" />
                      <span>{formatTime(seance.date_seance)}</span>
                    </div>

                    {/* Preparation progress */}
                    <div className="mt-auto pt-4">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-muted-foreground">
                          Preparation {seance.preparation_percent}%
                        </span>
                      </div>
                      <Progress
                        value={seance.preparation_percent}
                        className="h-1.5"
                      />
                      <div className="flex items-center gap-3 mt-2 text-xs">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              className={`flex items-center gap-1 ${
                                seance.has_odj
                                  ? 'text-emerald-600'
                                  : 'text-muted-foreground'
                              }`}
                            >
                              {seance.has_odj ? (
                                <CheckCircle2 className="h-3 w-3" />
                              ) : (
                                <Clock className="h-3 w-3" />
                              )}
                              ODJ
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {seance.has_odj
                              ? "Ordre du jour defini"
                              : "Ordre du jour a definir"}
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              className={`flex items-center gap-1 ${
                                seance.has_convocataires
                                  ? 'text-emerald-600'
                                  : 'text-muted-foreground'
                              }`}
                            >
                              {seance.has_convocataires ? (
                                <CheckCircle2 className="h-3 w-3" />
                              ) : (
                                <Clock className="h-3 w-3" />
                              )}
                              Conv.
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {seance.has_convocataires
                              ? "Convocataires ajoutes"
                              : "Convocataires a ajouter"}
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              className={`flex items-center gap-1 ${
                                seance.convocations_envoyees
                                  ? 'text-emerald-600'
                                  : 'text-muted-foreground'
                              }`}
                            >
                              {seance.convocations_envoyees ? (
                                <CheckCircle2 className="h-3 w-3" />
                              ) : (
                                <Clock className="h-3 w-3" />
                              )}
                              Envoi
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {seance.convocations_envoyees
                              ? "Convocations envoyees"
                              : "Convocations a envoyer"}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* ─── Section C: Stats ───────────────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-institutional-blue" />
            Vue d&apos;ensemble
          </h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 stagger-in">
            <Link href={ROUTES.SEANCES} className="block group" title="Voir toutes les séances">
              <div className="stat-card cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] transition-all hover:border-institutional-blue/30">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-institutional-blue">
                    <CalendarDays className="h-5 w-5" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Clock className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>Séances planifiées ce mois-ci</TooltipContent>
                    </Tooltip>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-foreground">{stats.seancesCeMois}</p>
                <p className="text-sm text-muted-foreground mt-0.5">Séances ce mois</p>
              </div>
            </Link>

            <Link href={ROUTES.DELIBERATIONS} className="block group" title="Voir toutes les délibérations">
              <div className="stat-card cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] transition-all hover:border-emerald-300">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                    <CalendarCheck className="h-5 w-5" />
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {stats.deliberationsCeMois}
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">Délibérations ce mois</p>
              </div>
            </Link>

            <Link href={ROUTES.MEMBRES} className="block group" title="Voir tous les membres">
              <div className="stat-card cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] transition-all hover:border-amber-300">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                    <UserCheck className="h-5 w-5" />
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-2xl font-bold text-foreground">{stats.membresActifs}</p>
                <p className="text-sm text-muted-foreground mt-0.5">Membres actifs</p>
              </div>
            </Link>

            <Link href={ROUTES.SEANCES} className="block group" title="Voir les séances avec PV en attente">
              <div className="stat-card cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] transition-all hover:border-purple-300">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 text-purple-700">
                    <FileText className="h-5 w-5" />
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

        {/* ─── Quick access ──────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4">Acces rapide</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 stagger-in">
            <Link href={ROUTES.SEANCES} className="block group">
              <div className="relative rounded-xl border bg-card p-6 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 hover:border-institutional-blue/30">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-institutional-blue">
                    <CalendarDays className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Seances</h3>
                    <p className="text-xs text-muted-foreground">
                      Gestion des seances deliberantes
                    </p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Creez et gerez vos seances, ordres du jour, convocations et proces-verbaux.
                </p>
                <div className="mt-4 flex items-center text-sm font-medium text-institutional-blue group-hover:gap-2 transition-all">
                  <span>Acceder</span>
                  <ArrowRight className="h-4 w-4 ml-1 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </Link>

            <Link href={ROUTES.MEMBRES} className="block group">
              <div className="relative rounded-xl border bg-card p-6 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 hover:border-emerald-500/30">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Membres</h3>
                    <p className="text-xs text-muted-foreground">Elus et agents</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Gerez les membres de vos instances, leurs roles et mandats.
                </p>
                <div className="mt-4 flex items-center text-sm font-medium text-emerald-700 group-hover:gap-2 transition-all">
                  <span>Acceder</span>
                  <ArrowRight className="h-4 w-4 ml-1 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </Link>

            {isSuperAdmin && (
              <Link href={ROUTES.CONFIGURATION} className="block group">
                <div className="relative rounded-xl border bg-card p-6 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 hover:border-institutional-blue/30">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-institutional-navy">
                      <Settings className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">Configuration</h3>
                      <p className="text-xs text-muted-foreground">
                        Parametrage de l&apos;institution
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Identite legale, instances deliberantes, numerotation des deliberations.
                  </p>
                  <div className="mt-4 flex items-center text-sm font-medium text-institutional-blue group-hover:gap-2 transition-all">
                    <span>Configurer</span>
                    <ArrowRight className="h-4 w-4 ml-1 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </Link>
            )}
          </div>
        </section>
      </div>
    </TooltipProvider>
  )
}
