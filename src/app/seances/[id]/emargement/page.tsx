export const dynamic = 'force-dynamic'

import { redirect, notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ROUTES } from '@/lib/constants'
import { getEffectiveRole } from '@/lib/auth/get-effective-role'
import { EmargementView } from '@/components/presence/emargement-view'

interface Props {
  params: { id: string }
}

export default async function EmargementPage({ params }: Props) {
  const { id } = params
  const supabase = await createServerSupabaseClient()

  const { data: userData, error: authError } = await supabase.auth.getUser()
  if (authError || !userData?.user) {
    redirect(ROUTES.LOGIN)
  }

  // Émargement (table d'entrée) : accessible aux 4 rôles privilégiés
  // + secrétaire de séance (qui peut être en charge de l'émargement physique).
  // Le président ne fait pas l'émargement (ce n'est pas son rôle).
  const role = await getEffectiveRole(supabase, userData.user.id)
  if (!['super_admin', 'dgs', 'directeur_cabinet', 'gestionnaire', 'secretaire_seance'].includes(role)) {
    redirect(`/seances/${id}`)
  }

  // Get seance with convocataires and existing presences
  const { data: seance, error: seanceError } = await supabase
    .from('seances')
    .select(`
      id,
      titre,
      date_seance,
      statut,
      instance_id,
      instance_config (
        id,
        nom,
        quorum_type,
        quorum_fraction_numerateur,
        quorum_fraction_denominateur,
        composition_max
      ),
      convocataires (
        id,
        member_id,
        member:members (id, prenom, nom, email, qualite_officielle)
      ),
      presences (
        id,
        member_id,
        statut,
        heure_arrivee,
        heure_depart,
        signature_svg,
        mode_authentification
      )
    `)
    .eq('id', id)
    .single()

  if (seanceError || !seance) {
    notFound()
  }

  // PHASE 1 invités externes : on ne garde que les convocataires « membres »
  // ici (cf. migration 00036). Les convocataires externes n'apparaissent pas
  // encore dans l'émargement — leur UI sera ajoutée en phase 3.
  const seanceForView = {
    ...seance,
    convocataires: (seance.convocataires || []).filter(
      (c): c is typeof c & { member_id: string } => c.member_id !== null,
    ),
  }

  // Count total instance members for quorum
  const { count: instanceMemberCount } = await supabase
    .from('instance_members')
    .select('*', { count: 'exact', head: true })
    .eq('instance_config_id', seance.instance_id)

  // Mode QR strict : si l'institution exige le scan QR pour toutes les
  // séances, le bouton "Marquer manuellement" exige un motif justificatif
  // (cas dégradé : QR perdu, caméra cassée, etc.).
  const { data: instConfig } = await supabase
    .from('institution_config')
    .select('emargement_qr_strict')
    .limit(1)
    .maybeSingle()
  const qrStrict = (instConfig as { emargement_qr_strict?: boolean | null } | null)?.emargement_qr_strict === true

  return (
    <EmargementView
      seance={seanceForView}
      instanceMemberCount={instanceMemberCount || 0}
      qrStrict={qrStrict}
    />
  )
}
