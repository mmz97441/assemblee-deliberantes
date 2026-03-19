import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { logoutAction } from '@/lib/auth/actions'
import { ROLE_LABELS } from '@/lib/auth/helpers'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { UserRole } from '@/lib/supabase/types'

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const role = (user.user_metadata?.role as UserRole) || 'elu'
  const fullName = user.user_metadata?.full_name || user.email

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      {/* Header */}
      <header className="border-b bg-white shadow-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <h1 className="text-lg font-bold text-[#0D2B55]">
            Assemblees Deliberantes
          </h1>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-[#212121]">{fullName}</p>
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

      {/* Contenu */}
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-[#0D2B55]">
            Tableau de bord
          </h2>
          <p className="mt-1 text-sm text-[#757575]">
            Bienvenue, {fullName}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#0D2B55]">Seances</CardTitle>
              <CardDescription>Gestion des seances deliberantes</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-[#757575]">
                Etape 6 — En construction
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-[#0D2B55]">Membres</CardTitle>
              <CardDescription>Gestion des elus et agents</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-[#757575]">
                Etape 5 — En construction
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-[#0D2B55]">Configuration</CardTitle>
              <CardDescription>Parametrage de l&apos;institution</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-[#757575]">
                Etape 4 — En construction
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
