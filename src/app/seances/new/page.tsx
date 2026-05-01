export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ROUTES } from '@/lib/constants'
import { getEffectiveRole } from '@/lib/auth/get-effective-role'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'
import { PageHeader } from '@/components/layout/page-header'
import { SeanceCreationWizard } from '@/components/seance/seance-creation-wizard'

interface PageProps {
  searchParams: { seanceId?: string }
}

export default async function NewSeancePage({ searchParams }: PageProps) {
  const supabase = await createServerSupabaseClient()
  const { data: userData, error: authError } = await supabase.auth.getUser()

  if (authError || !userData?.user) {
    redirect(ROUTES.LOGIN)
  }

  const userRole = await getEffectiveRole(supabase, userData.user.id)

  if (!['super_admin', 'gestionnaire', 'president', 'secretaire_seance'].includes(userRole)) {
    redirect(ROUTES.SEANCES)
  }

  // Hydrate le brouillon si ?seanceId=X dans l'URL (reprise après fermeture
  // d'onglet ou navigation latérale).
  let existingDraft: {
    id: string
    titre: string
    instance_id: string
    date_seance: string
    lieu: string | null
    mode: string | null
    publique: boolean | null
    president_effectif_seance_id: string | null
    secretaire_seance_id: string | null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    odj_points: { id: string; titre: string; description: string | null; type_traitement: string | null; majorite_requise: string | null; rapporteur_id: string | null; huis_clos: boolean | null; votes_interdits: boolean | null; position: number; documents: any[] | null }[]
    convocataire_member_ids: string[]
  } | null = null

  if (searchParams.seanceId) {
    const { data: draft } = await supabase
      .from('seances')
      .select(`
        id, titre, instance_id, date_seance, lieu, mode, publique, statut,
        president_effectif_seance_id, secretaire_seance_id,
        odj_points!odj_points_seance_id_fkey (id, titre, description, type_traitement, majorite_requise, rapporteur_id, huis_clos, votes_interdits, position, documents),
        convocataires (member_id)
      `)
      .eq('id', searchParams.seanceId)
      .eq('statut', 'BROUILLON')
      .maybeSingle()

    if (draft) {
      existingDraft = {
        id: draft.id,
        titre: draft.titre,
        instance_id: draft.instance_id,
        date_seance: draft.date_seance,
        lieu: draft.lieu,
        mode: draft.mode,
        publique: draft.publique,
        president_effectif_seance_id: draft.president_effectif_seance_id,
        secretaire_seance_id: draft.secretaire_seance_id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        odj_points: ((draft.odj_points as any[]) || [])
          .slice()
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .sort((a: any, b: any) => (a.position || 0) - (b.position || 0)),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        convocataire_member_ids: ((draft.convocataires as any[]) || []).map((c: any) => c.member_id),
      }
    }
  }

  // Fetch active instances with member counts
  const { data: instancesData } = await supabase
    .from('instance_config')
    .select('*')
    .eq('actif', true)
    .order('nom', { ascending: true })

  const instances = instancesData || []

  // Fetch all active members
  const { data: membersData } = await supabase
    .from('members')
    .select('id, prenom, nom, email, role, qualite_officielle, statut')
    .eq('statut', 'ACTIF')
    .order('nom', { ascending: true })

  const members = membersData || []

  // Fetch instance members (who belongs to which instance)
  const { data: instanceMembersData } = await supabase
    .from('instance_members')
    .select('instance_config_id, member_id, bureau_role, actif')
    .eq('actif', true)

  const instanceMembers = instanceMembersData || []

  // Fetch the last séance per instance (for "copier depuis la dernière séance")
  const { data: lastSeances } = await supabase
    .from('seances')
    .select('id, instance_id, date_seance, titre')
    .order('date_seance', { ascending: false })

  // Group: keep only the most recent per instance
  const lastSeanceByInstance: Record<string, { id: string; date_seance: string; titre: string }> = {}
  for (const s of lastSeances || []) {
    if (!lastSeanceByInstance[s.instance_id]) {
      lastSeanceByInstance[s.instance_id] = {
        id: s.id,
        date_seance: s.date_seance,
        titre: s.titre,
      }
    }
  }

  return (
    <AuthenticatedLayout>
      <PageHeader
        title="Nouvelle séance"
        description="Assistant de création en 5 étapes"
        breadcrumbs={[
          { label: 'Tableau de bord', href: ROUTES.DASHBOARD },
          { label: 'Séances', href: ROUTES.SEANCES },
          { label: 'Nouvelle séance' },
        ]}
      />

      <main className="px-4 sm:px-8 py-6 page-enter">
        <SeanceCreationWizard
          instances={instances}
          members={members}
          instanceMembers={instanceMembers}
          lastSeanceByInstance={lastSeanceByInstance}
          existingDraft={existingDraft}
        />
      </main>
    </AuthenticatedLayout>
  )
}
