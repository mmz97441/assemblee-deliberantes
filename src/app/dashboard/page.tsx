export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ROUTES } from '@/lib/constants'
import { ROLE_LABELS } from '@/lib/auth/helpers'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'
import { PageHeader } from '@/components/layout/page-header'
import { EluDashboard } from '@/components/dashboard/elu-dashboard'
import { PresidentDashboard } from '@/components/dashboard/president-dashboard'
import {
  CalendarDays,
  Users,
  FileText,
  Settings,
  Clock,
  ArrowRight,
  CalendarCheck,
  UserCheck,
  Sparkles,
  Plus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
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
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon apres-midi' : 'Bonsoir'

  const supabase = await createServerSupabaseClient()

  // ─── Elu / Preparateur dashboard ──────────────────────────────────────────
  if (['elu', 'preparateur'].includes(role)) {
    // Get member record for this user
    const { data: memberRecord } = await supabase
      .from('members')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    let eluSeances: { id: string; titre: string; date_seance: string; statut: string | null; instance_nom: string | null; lieu: string | null }[] = []

    if (memberRecord) {
      // Get seance IDs where this member is convoque
      const { data: convocataires } = await supabase
        .from('convocataires')
        .select('seance_id')
        .eq('member_id', memberRecord.id)

      const seanceIds = (convocataires || []).map(c => c.seance_id)

      if (seanceIds.length > 0) {
        const { data: seancesData } = await supabase
          .from('seances')
          .select('id, titre, date_seance, statut, lieu, instance_config (nom)')
          .in('id', seanceIds)
          .order('date_seance', { ascending: true })

        eluSeances = (seancesData || []).map(s => ({
          id: s.id,
          titre: s.titre,
          date_seance: s.date_seance,
          statut: s.statut,
          instance_nom: (s.instance_config as { nom: string } | null)?.nom || null,
          lieu: s.lieu,
        }))
      }
    }

    return (
      <AuthenticatedLayout>
        <PageHeader
          title={`${greeting}, ${firstName}`}
          description={`${ROLE_LABELS[role]} — Voici un resume de votre espace`}
        />
        <main className="px-4 sm:px-8 py-8 page-enter">
          <EluDashboard
            firstName={firstName}
            greeting={greeting}
            seances={eluSeances}
          />
        </main>
      </AuthenticatedLayout>
    )
  }

  // ─── President dashboard ──────────────────────────────────────────────────
  if (role === 'president') {
    // Get member record for this user
    const { data: memberRecord } = await supabase
      .from('members')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    let presidentSeances: { id: string; titre: string; date_seance: string; statut: string | null; instance_nom: string | null; lieu: string | null }[] = []
    let pvEnAttente: { seance_id: string; seance_titre: string; pv_statut: string | null }[] = []

    if (memberRecord) {
      // Get seances where this member is president_effectif OR convoque
      const { data: seancesPresidees } = await supabase
        .from('seances')
        .select('id, titre, date_seance, statut, lieu, instance_config (nom)')
        .eq('president_effectif_seance_id', memberRecord.id)
        .order('date_seance', { ascending: true })

      presidentSeances = (seancesPresidees || []).map(s => ({
        id: s.id,
        titre: s.titre,
        date_seance: s.date_seance,
        statut: s.statut,
        instance_nom: (s.instance_config as { nom: string } | null)?.nom || null,
        lieu: s.lieu,
      }))

      // Get PV en attente for seances this user presides
      const seanceIds = presidentSeances.map(s => s.id)
      if (seanceIds.length > 0) {
        const { data: pvData } = await supabase
          .from('pv')
          .select('seance_id, statut')
          .in('seance_id', seanceIds)
          .in('statut', ['BROUILLON', 'EN_RELECTURE'])

        if (pvData && pvData.length > 0) {
          pvEnAttente = pvData.map(pv => {
            const seance = presidentSeances.find(s => s.id === pv.seance_id)
            return {
              seance_id: pv.seance_id,
              seance_titre: seance?.titre || 'Seance',
              pv_statut: pv.statut,
            }
          })
        }
      }
    }

    return (
      <AuthenticatedLayout>
        <PageHeader
          title={`${greeting}, ${firstName}`}
          description={`${ROLE_LABELS[role]} — Voici un resume de votre espace`}
        />
        <main className="px-4 sm:px-8 py-8 page-enter">
          <PresidentDashboard
            firstName={firstName}
            greeting={greeting}
            seances={presidentSeances}
            pvEnAttente={pvEnAttente}
          />
        </main>
      </AuthenticatedLayout>
    )
  }

  // ─── Gestionnaire / Super Admin dashboard (existing) ──────────────────────
  let isConfigured = false
  let seancesCount = 0
  let membersCount = 0

  try {
    const { data: configData } = await supabase
      .from('institution_config')
      .select('id')
      .limit(1)
      .maybeSingle()
    isConfigured = !!configData

    const { count: sCount } = await supabase
      .from('seances')
      .select('id', { count: 'exact', head: true })
    seancesCount = sCount || 0

    const { count: mCount } = await supabase
      .from('members')
      .select('id', { count: 'exact', head: true })
      .eq('statut', 'ACTIF')
    membersCount = mCount || 0
  } catch {
    // Continue with defaults
  }

  return (
    <AuthenticatedLayout>
      <PageHeader
        title={`${greeting}, ${firstName}`}
        description={`${ROLE_LABELS[role]} — Voici un resume de votre espace`}
      />

      <main className="px-4 sm:px-8 py-8 page-enter">
        {/* Welcome card — institution not configured */}
        {!isConfigured && role === 'super_admin' && (
          <div className="mb-8 rounded-xl border-2 border-dashed border-institutional-blue/30 bg-blue-50/50 p-8 text-center">
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

        {/* Quick stats */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 stagger-in mb-10">
          <div className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-institutional-blue">
                <CalendarDays className="h-5 w-5" />
              </div>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold text-foreground font-sans">{seancesCount}</p>
            <p className="text-sm text-muted-foreground mt-0.5">Seances a venir</p>
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <CalendarCheck className="h-5 w-5" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground font-sans">0</p>
            <p className="text-sm text-muted-foreground mt-0.5">Deliberations ce mois</p>
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                <UserCheck className="h-5 w-5" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground font-sans">{membersCount}</p>
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

        {/* Empty state for seances */}
        {seancesCount === 0 && (
          <div className="mb-10 rounded-xl border bg-card p-8 text-center">
            <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-muted mb-3">
              <CalendarDays className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-1">Aucune seance prevue</h3>
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
        )}

        {/* Action cards */}
        <h2 className="text-lg font-semibold text-foreground mb-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          Acces rapide
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 stagger-in">
          {/* Seances */}
          <Link href={ROUTES.SEANCES} className="block group">
            <div className="relative rounded-xl border bg-card p-6 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 hover:border-institutional-blue/30">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-institutional-blue">
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Seances</h3>
                  <p className="text-xs text-muted-foreground">Gestion des seances deliberantes</p>
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

          {/* Membres */}
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
                    <p className="text-xs text-muted-foreground">Parametrage de l&apos;institution</p>
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
      </main>
    </AuthenticatedLayout>
  )
}
