export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ROUTES } from '@/lib/constants'
import { getEffectiveRole } from '@/lib/auth/get-effective-role'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'
import { PageHeader } from '@/components/layout/page-header'
import { DocsExplorer } from '@/components/aide/docs-explorer'
import type { UserRole } from '@/lib/supabase/types'

export default async function AidePage() {
  const supabase = await createServerSupabaseClient()
  const { data: userData, error: authError } = await supabase.auth.getUser()
  if (authError || !userData?.user) {
    redirect(ROUTES.LOGIN)
  }

  // Récupère le rôle réel pour personnaliser le contenu affiché.
  // Par défaut, l'utilisateur ne voit que les articles pertinents pour son rôle.
  // Un toggle « Tout voir » permet aux curieux d'explorer toute la doc.
  const role = await getEffectiveRole(supabase, userData.user.id)

  return (
    <AuthenticatedLayout>
      <PageHeader
        title="Aide & Documentation"
        description="Documentation utilisateur personnalisée selon votre rôle. Utilisez la recherche pour trouver rapidement une réponse."
        breadcrumbs={[
          { label: 'Tableau de bord', href: ROUTES.DASHBOARD },
          { label: 'Aide' },
        ]}
      />
      <main className="px-4 sm:px-8 py-6 page-enter">
        <DocsExplorer userRole={role as UserRole | null} />
      </main>
    </AuthenticatedLayout>
  )
}
