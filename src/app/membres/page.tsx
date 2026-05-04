export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ROUTES } from '@/lib/constants'
import { getEffectiveRole } from '@/lib/auth/get-effective-role'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'
import { PageHeader } from '@/components/layout/page-header'
import { MembersList } from '@/components/membres/members-list'
import type { MemberWithInstances } from '@/lib/actions/members'
import type { InstanceConfigRow } from '@/lib/supabase/types'

export default async function MembresPage() {
  const supabase = await createServerSupabaseClient()
  const { data: userData, error: authError } = await supabase.auth.getUser()

  if (authError || !userData?.user) {
    redirect(ROUTES.LOGIN)
  }

  const userRole = await getEffectiveRole(supabase, userData.user.id)
  const canManage = ['super_admin', 'dgs', 'directeur_cabinet', 'gestionnaire'].includes(userRole)

  let members: MemberWithInstances[] = []
  let instances: InstanceConfigRow[] = []

  try {
    // CLOISONNEMENT RGPD :
    // - Privilégiés : tous les champs (email, téléphone, adresse, date_naissance...)
    // - Non-privilégiés : annuaire public uniquement (nom, prénom, qualité,
    //   rôle, photo, groupe politique). Les coordonnées personnelles sont
    //   masquées (email, téléphone, adresse_postale, date_naissance,
    //   lieu_naissance).
    const selectFields = canManage
      ? '*'
      : `id, prenom, nom, role, qualite_officielle, groupe_politique,
         photo_url, statut, archived_at, mandat_debut, mandat_fin, created_at`

    const { data: membersData, error: membersError } = await supabase
      .from('members')
      .select(`
        ${selectFields},
        instance_members (
          id,
          instance_config_id,
          fonction_dans_instance,
          actif,
          instance_config (
            id,
            nom
          )
        )
      `)
      .order('nom', { ascending: true })
      .order('prenom', { ascending: true })

    if (membersError) {
      console.error('Erreur chargement membres:', membersError)
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      members = (membersData as any) || []
      // Pour les non-privilégiés : forcer email/téléphone/adresse à null
      // côté serveur pour qu'ils n'apparaissent pas dans le JSON envoyé au client.
      if (!canManage) {
        for (const m of members) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mAny = m as any
          mAny.email = null
          mAny.telephone = null
          mAny.adresse_postale = null
          mAny.date_naissance = null
          mAny.lieu_naissance = null
        }
      }

      // Calcul de l'account_state pour chaque membre (compte connexion).
      // Ce calcul nécessite service_role car auth.users n'est pas accessible
      // côté authenticated. On le fait UNIQUEMENT pour les privilégiés
      // (les non-privilégiés ne voient pas l'AccountStateBadge de toute façon).
      if (canManage && members.length > 0) {
        const memberUserIds = members
          .map(m => (m as { user_id?: string | null }).user_id)
          .filter((id): id is string => !!id)

        const confirmedMap = new Map<string, string | null>()
        if (memberUserIds.length > 0) {
          try {
            const { createServiceRoleClient } = await import('@/lib/supabase/server')
            const serviceClient = await createServiceRoleClient()
            const { data: usersResp } = await serviceClient.auth.admin.listUsers({
              page: 1, perPage: 1000,
            })
            for (const u of usersResp?.users || []) {
              if (memberUserIds.includes(u.id)) {
                confirmedMap.set(u.id, u.email_confirmed_at || null)
              }
            }
          } catch (err) {
            console.warn('membres/page: impossible de charger les états auth :', err)
          }
        }

        for (const m of members) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mAny = m as any
          if (!mAny.user_id) {
            mAny.account_state = 'NO_ACCOUNT'
            mAny.activated_at = null
          } else {
            const confirmedAt = confirmedMap.get(mAny.user_id)
            if (confirmedAt) {
              mAny.account_state = 'ACTIVE'
              mAny.activated_at = confirmedAt
            } else {
              mAny.account_state = 'PENDING_INVITE'
              mAny.activated_at = null
            }
          }
        }
      }
    }

    const { data: instancesData, error: instancesError } = await supabase
      .from('instance_config')
      .select('*')
      .eq('actif', true)
      .order('nom', { ascending: true })

    if (instancesError) {
      console.error('Erreur chargement instances:', instancesError)
    } else {
      instances = instancesData || []
    }
  } catch (err) {
    console.error('Erreur chargement membres:', err)
  }

  return (
    <AuthenticatedLayout>
      <PageHeader
        title="Membres"
        description="Gestion des élus et agents de l'institution"
        breadcrumbs={[
          { label: 'Tableau de bord', href: ROUTES.DASHBOARD },
          { label: 'Membres' },
        ]}
      />

      <main className="px-4 sm:px-8 py-6 page-enter">
        <MembersList
          members={members}
          instances={instances}
          canManage={canManage}
        />
      </main>
    </AuthenticatedLayout>
  )
}
