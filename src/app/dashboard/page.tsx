export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ROUTES } from '@/lib/constants'
import { ROLE_LABELS } from '@/lib/auth/helpers'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'
import { PageHeader } from '@/components/layout/page-header'
import {
  CalendarDays,
  Users,
  FileText,
  Settings,
  Clock,
  ArrowRight,
  CalendarCheck,
  UserCheck,
} from 'lucide-react'
import type { UserRole } from '@/lib/supabase/types'

export default async function DashboardPage() {
  let user = null

  try {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase.auth.getUser()
    if (!error && data?.user) {
      user = data.user
    }
  } catch {
    // Supabase indisponible
  }

  if (!user) {
    redirect(ROUTES.LOGIN)
  }

  const role = (user.user_metadata?.role as UserRole) || 'elu'
  const fullName = user.user_metadata?.full_name || user.email
  const firstName = fullName?.split(' ')[0] || ''

  // Determine greeting based on time
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir'

  return (
    <AuthenticatedLayout>
      <PageHeader
        title={`${greeting}, ${firstName}`}
        description={`${ROLE_LABELS[role]} — Voici un résumé de votre espace`}
      />

      <main className="px-8 py-8 page-enter">
        {/* Quick stats */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 stagger-in mb-10">
          <div className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-institutional-blue">
                <CalendarDays className="h-5 w-5" />
              </div>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold text-foreground font-sans">0</p>
            <p className="text-sm text-muted-foreground mt-0.5">Séances à venir</p>
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <CalendarCheck className="h-5 w-5" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground font-sans">0</p>
            <p className="text-sm text-muted-foreground mt-0.5">Délibérations ce mois</p>
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                <UserCheck className="h-5 w-5" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground font-sans">0</p>
            <p className="text-sm text-muted-foreground mt-0.5">Membres actifs</p>
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 text-purple-700">
                <FileText className="h-5 w-5" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground font-sans">0</p>
            <p className="text-sm text-muted-foreground mt-0.5">PV en attente</p>
          </div>
        </div>

        {/* Action cards */}
        <h2 className="text-lg font-semibold text-foreground mb-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          Accès rapide
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 stagger-in">
          {/* Séances */}
          <div className="group relative rounded-xl border bg-card p-6 opacity-50 cursor-not-allowed">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-institutional-blue">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Séances</h3>
                <p className="text-xs text-muted-foreground">Gestion des séances délibérantes</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Créez et gérez vos séances, ordres du jour, convocations et procès-verbaux.
            </p>
            <div className="mt-4 flex items-center text-sm text-muted-foreground">
              <span>Prochainement</span>
            </div>
          </div>

          {/* Membres */}
          <div className="group relative rounded-xl border bg-card p-6 opacity-50 cursor-not-allowed">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Membres</h3>
                <p className="text-xs text-muted-foreground">Élus et agents</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Gérez les membres de vos instances, leurs rôles et mandats.
            </p>
            <div className="mt-4 flex items-center text-sm text-muted-foreground">
              <span>Prochainement</span>
            </div>
          </div>

          {/* Configuration — super_admin only */}
          {role === 'super_admin' && (
            <Link href={ROUTES.CONFIGURATION} className="block group">
              <div className="relative rounded-xl border bg-card p-6 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 hover:border-institutional-blue/30">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-institutional-navy">
                    <Settings className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Configuration</h3>
                    <p className="text-xs text-muted-foreground">Paramétrage de l&apos;institution</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Identité légale, instances délibérantes, numérotation des délibérations.
                </p>
                <div className="mt-4 flex items-center text-sm font-medium text-institutional-blue group-hover:gap-2 transition-all">
                  <span>Configurer</span>
                  <ArrowRight className="h-4 w-4 ml-1 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </Link>
          )}
        </div>
      </main>
    </AuthenticatedLayout>
  )
}
