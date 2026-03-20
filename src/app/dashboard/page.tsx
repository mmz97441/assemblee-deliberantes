export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { redirect } from 'next/navigation'
import { logoutAction } from '@/lib/auth/actions'
import { ROLE_LABELS } from '@/lib/auth/helpers'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { UserRole } from '@/lib/supabase/types'

async function getUser() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return null
  }

  const cookieStore = await cookies()

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll() {
          // Read-only in Server Components
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export default async function DashboardPage() {
  const user = await getUser()

  if (!user) {
    redirect('/login')
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
          <Card>
            <CardHeader>
              <CardTitle className="text-institutional-navy">Seances</CardTitle>
              <CardDescription>Gestion des seances deliberantes</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Etape 6 — En construction</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-institutional-navy">Membres</CardTitle>
              <CardDescription>Gestion des elus et agents</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Etape 5 — En construction</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-institutional-navy">Configuration</CardTitle>
              <CardDescription>Parametrage de l&apos;institution</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Etape 4 — En construction</p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
