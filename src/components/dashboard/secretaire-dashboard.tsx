'use client'

import Link from 'next/link'
import {
  CalendarDays,
  Clock,
  FileText,
  PenLine,
  MapPin,
  Sparkles,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ROUTES, SEANCE_STATUT_CONFIG } from '@/lib/constants'
import { formatDate, formatTime, formatShortDate } from '@/lib/utils/format-date'

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

interface PVToRedact {
  seance_id: string
  seance_titre: string
  seance_date: string
  pv_statut: string | null // null = PV not created yet
  pv_id: string | null
}

interface SeanceSummary {
  id: string
  titre: string
  date_seance: string
  statut: string | null
  instance_nom: string | null
  lieu: string | null
}

export interface SecretaireDashboardProps {
  firstName: string
  greeting: string
  pvToRedact: PVToRedact[]
  upcomingSeances: SeanceSummary[]
}

// ────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────

export function SecretaireDashboard({
  firstName,
  greeting,
  pvToRedact,
  upcomingSeances,
}: SecretaireDashboardProps) {
  return (
      <div className="space-y-8">
        {/* ─── Welcome ───────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-50 text-purple-700">
            <PenLine className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {greeting}, {firstName}
            </h1>
            <p className="text-sm text-muted-foreground">Secrétaire de séance</p>
          </div>
        </div>

        {/* ─── Section A: PV a rediger (hero) ─────────────────── */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-purple-600" />
            Procès-verbaux à rédiger
            {pvToRedact.length > 0 && (
              <Badge className="bg-red-500 text-white border-0 text-xs font-bold ml-1">
                {pvToRedact.length}
              </Badge>
            )}
          </h2>

          {pvToRedact.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-muted p-8 text-center">
              <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-emerald-50 mb-3">
                <Sparkles className="h-6 w-6 text-emerald-600" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1">
                Aucun PV en attente
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Tous les proces-verbaux sont a jour. Excellent travail !
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pvToRedact.map((pv) => {
                const isNew = pv.pv_statut === null
                const isBrouillon = pv.pv_statut === 'BROUILLON'
                return (
                  <div
                    key={pv.seance_id}
                    className={`rounded-xl border p-5 transition-all duration-200 ${
                      isNew
                        ? 'bg-gradient-to-r from-red-50 to-amber-50/50 border-red-200'
                        : 'bg-gradient-to-r from-amber-50 to-yellow-50/50 border-amber-200'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge
                            className={`border-0 text-xs font-semibold ${
                              isNew
                                ? 'bg-red-100 text-red-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {isNew ? 'À créer' : isBrouillon ? 'Brouillon' : pv.pv_statut}
                          </Badge>
                        </div>
                        <h3 className="text-base font-semibold text-foreground">
                          {pv.seance_titre}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          Séance du {formatShortDate(pv.seance_date)}
                        </p>
                      </div>
                      <Button
                        asChild
                        className={`shrink-0 font-semibold ${
                          isNew
                            ? 'bg-red-600 hover:bg-red-700 text-white'
                            : 'bg-amber-600 hover:bg-amber-700 text-white'
                        }`}
                      >
                        <Link href={`/seances/${pv.seance_id}/pv`}>
                          {isNew ? (
                            <>
                              <Sparkles className="h-4 w-4 mr-1.5" />
                              Generer le brouillon
                            </>
                          ) : (
                            <>
                              <PenLine className="h-4 w-4 mr-1.5" />
                              Continuer le PV
                            </>
                          )}
                        </Link>
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* ─── Section B: Mes prochaines séances ──────────────── */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-institutional-blue" />
            Mes prochaines séances
          </h2>

          {upcomingSeances.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-muted p-8 text-center">
              <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-muted mb-3">
                <CalendarDays className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1">
                Aucune séance à venir
              </h3>
              <p className="text-sm text-muted-foreground">
                Vous n&apos;avez aucune séance assignée pour le moment.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingSeances.map((seance) => {
                const statut = SEANCE_STATUT_CONFIG[seance.statut || 'BROUILLON']
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
                          title={statut?.description}
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
                    <h3 className="font-semibold text-foreground">Délibérations</h3>
                    <p className="text-xs text-muted-foreground">Consulter les délibérations</p>
                  </div>
                </div>
              </div>
            </Link>
            <Link href={ROUTES.SEANCES} className="block group">
              <div className="rounded-xl border bg-card p-5 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-institutional-blue/30">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                    <PenLine className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Mes PV</h3>
                    <p className="text-xs text-muted-foreground">Procès-verbaux à gérer</p>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </section>
      </div>
  )
}
