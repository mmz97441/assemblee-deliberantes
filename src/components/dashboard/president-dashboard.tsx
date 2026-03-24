'use client'

import Link from 'next/link'
import { CalendarDays, Clock, FileText, PenLine, Shield } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/lib/constants'

interface SeanceSummary {
  id: string
  titre: string
  date_seance: string
  statut: string | null
  instance_nom: string | null
  lieu: string | null
}

interface PVSummary {
  seance_id: string
  seance_titre: string
  pv_statut: string | null
}

interface PresidentDashboardProps {
  firstName: string
  greeting: string
  seances: SeanceSummary[]
  pvEnAttente: PVSummary[]
}

const STATUT_CONFIG: Record<string, { label: string; color: string }> = {
  BROUILLON: { label: 'Brouillon', color: 'bg-slate-100 text-slate-700' },
  CONVOQUEE: { label: 'Convoquee', color: 'bg-blue-100 text-blue-700' },
  EN_COURS: { label: 'En cours', color: 'bg-emerald-100 text-emerald-700' },
  SUSPENDUE: { label: 'Suspendue', color: 'bg-amber-100 text-amber-700' },
  CLOTUREE: { label: 'Cloturee', color: 'bg-purple-100 text-purple-700' },
  ARCHIVEE: { label: 'Archivee', color: 'bg-gray-100 text-gray-500' },
}

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

export function PresidentDashboard({ firstName, greeting, seances, pvEnAttente }: PresidentDashboardProps) {
  const upcoming = seances.filter(
    s => new Date(s.date_seance) >= new Date() || s.statut === 'EN_COURS'
  )

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-institutional-blue/10 text-institutional-blue">
          <Shield className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{greeting}, {firstName}</h1>
          <p className="text-sm text-muted-foreground">President(e) de seance</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming seances to preside */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-institutional-blue" />
            Seances a presider
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
              {upcoming.map(seance => {
                const statut = STATUT_CONFIG[seance.statut || 'BROUILLON']
                return (
                  <Link key={seance.id} href={`/seances/${seance.id}`} className="block group">
                    <div className="rounded-xl border bg-card p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-institutional-blue/30">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Badge className={`${statut?.color || 'bg-slate-100 text-slate-700'} border-0 text-xs font-medium`}>
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
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </section>

        {/* PV awaiting signature */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <PenLine className="h-5 w-5 text-amber-600" />
            PV en attente de signature
          </h2>

          {pvEnAttente.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-muted p-8 text-center">
              <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-muted mb-3">
                <FileText className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1">
                Aucun PV en attente
              </h3>
              <p className="text-sm text-muted-foreground">
                Tous les proces-verbaux ont ete signes.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pvEnAttente.map(pv => (
                <Link key={pv.seance_id} href={`/seances/${pv.seance_id}/pv`} className="block group">
                  <div className="rounded-xl border bg-card p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-amber-300">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground group-hover:text-amber-700 transition-colors">
                          {pv.seance_titre}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          PV {pv.pv_statut === 'BROUILLON' ? 'en brouillon' : pv.pv_statut === 'EN_RELECTURE' ? 'en relecture - a signer' : pv.pv_statut?.toLowerCase() || 'en attente'}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" className="shrink-0" tabIndex={-1}>
                        Consulter
                      </Button>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Quick access */}
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
                  <Shield className="h-5 w-5" />
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
  )
}
