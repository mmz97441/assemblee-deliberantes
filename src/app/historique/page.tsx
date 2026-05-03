export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ROUTES } from '@/lib/constants'
import { getEffectiveRole } from '@/lib/auth/get-effective-role'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'
import { PageHeader } from '@/components/layout/page-header'
import { searchAuditLog, listAuditTables } from '@/lib/actions/audit'
import { HistoriqueClient } from '@/components/historique/historique-client'

export default async function HistoriquePage() {
  const supabase = await createServerSupabaseClient()
  const { data: userData, error: authError } = await supabase.auth.getUser()
  if (authError || !userData?.user) redirect(ROUTES.LOGIN)

  const role = await getEffectiveRole(supabase, userData.user.id)
  // Page accessible aux 4 rôles privilégiés uniquement.
  if (!['super_admin', 'dgs', 'directeur_cabinet', 'gestionnaire'].includes(role)) {
    redirect(ROUTES.DASHBOARD)
  }

  // Premier chargement : 50 entrées les plus récentes, sans filtre.
  const initialResult = await searchAuditLog({ page: 1, page_size: 50 })

  // Liste des tables présentes dans le log (pour le Select de filtre)
  const availableTables = await listAuditTables()

  // Liste des membres ayant déjà fait au moins une action (pour combobox)
  // On charge tous les membres actifs — pour les institutions < 1000 membres
  // c'est fluide. Au-delà, prévoir un fetch paginé via combobox.
  const { data: members } = await supabase
    .from('members')
    .select('id, prenom, nom')
    .order('nom', { ascending: true })

  return (
    <AuthenticatedLayout>
      <PageHeader
        title="Historique des modifications"
        description="Toutes les actions sur les données métier — traçabilité préfectorale et conformité RGPD."
        breadcrumbs={[
          { label: 'Tableau de bord', href: ROUTES.DASHBOARD },
          { label: 'Historique' },
        ]}
      />
      <main className="px-4 sm:px-8 py-6 page-enter">
        <HistoriqueClient
          initial={'error' in initialResult ? null : initialResult}
          availableTables={availableTables}
          allMembers={(members || []).map(m => ({ id: m.id, label: `${m.prenom} ${m.nom}`.trim() }))}
          isSuperAdmin={role === 'super_admin'}
        />
      </main>
    </AuthenticatedLayout>
  )
}
