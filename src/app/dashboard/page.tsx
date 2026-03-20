export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { logoutAction } from '@/lib/auth/actions'
import { ROLE_LABELS } from '@/lib/auth/helpers'
import { ROUTES } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
    // Supabase indisponible ou erreur reseau — on redirige vers login
  }

  if (!user) {
    redirect(ROUTES.LOGIN)
  }

  const role = (user.user_metadata?.role as UserRole) || 'elu'
  const fullName = user.user_metadata?.full_name || user.email

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card shadow-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <h1 className="text-lg font-bold text-institutional-navy">
            Assemblees Deliberantes
          </h1>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-foreground">{fullName}</p>
              <Badge variant="secondary" className="text-xs">
                {ROLE_LABELS[role] || role}
              </Badge>
            </div>
            <form action={logoutAction}>
              <Button variant="outline" size="sm" type="submit">
                Deconnexion
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-institutional-navy">
            Tableau de bord
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Bienvenue, {fullName}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="opacity-60">
            <CardHeader>
              <CardTitle className="text-institutional-navy">Seances</CardTitle>
              <CardDescription>Gestion des seances deliberantes</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Prochainement</p>
            </CardContent>
          </Card>
          <Card className="opacity-60">
            <CardHeader>
              <CardTitle className="text-institutional-navy">Membres</CardTitle>
              <CardDescription>Gestion des elus et agents</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Prochainement</p>
            </CardContent>
          </Card>
          {(role === 'super_admin') && (
            <Link href={ROUTES.CONFIGURATION} className="block">
              <Card className="transition-shadow hover:shadow-md cursor-pointer">
                <CardHeader>
                  <CardTitle className="text-institutional-navy">Configuration</CardTitle>
                  <CardDescription>Parametrage de l&apos;institution</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-institutional-blue">Configurer →</p>
                </CardContent>
              </Card>
            </Link>
          )}
        </div>
      </main>
    </div>
  )
}
