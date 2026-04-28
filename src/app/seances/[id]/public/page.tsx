export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { PublicSessionView } from '@/components/seance/public-session-view'

interface Props {
  params: { id: string }
}

/**
 * Page PUBLIQUE — aucune authentification requise.
 * Affiche l'avancement de la séance en temps réel pour :
 * - Un écran dans la salle des délibérations
 * - Un citoyen qui suit la séance depuis son téléphone
 * - Un embed sur un site web
 *
 * Utilise le service role car les visiteurs non authentifiés
 * n'ont pas de session Supabase. La sécurité est assurée par
 * les gardes applicatives ci-dessous (publique, statut, ecran_public_active).
 */
export default async function PublicSessionPage({ params }: Props) {
  const { id } = params

  // Service role nécessaire : les visiteurs publics n'ont pas de session,
  // et les RLS bloquent les SELECT anonymes. Les gardes de sécurité
  // sont assurées dans le code (publique, statut, ecran_public_active).
  const supabase = await createServiceRoleClient()

  // Charger la séance avec les données nécessaires (pas de données personnelles)
  const { data: seance, error: seanceError } = await supabase
    .from('seances')
    .select(`
      id,
      titre,
      date_seance,
      statut,
      lieu,
      heure_ouverture,
      heure_cloture,
      publique,
      instance_config (
        id,
        nom,
        type_legal,
        ecran_public_active
      ),
      odj_points!odj_points_seance_id_fkey (
        id,
        titre,
        position,
        type_traitement,
        statut,
        huis_clos,
        huis_clos_active,
        majorite_requise,
        votes_interdits,
        description
      ),
      votes (
        id,
        odj_point_id,
        type_vote,
        statut,
        resultat,
        pour,
        contre,
        abstention,
        total_votants,
        ouvert_at,
        clos_at,
        question
      )
    `)
    .eq('id', id)
    .single()

  if (seanceError || !seance) {
    // DEBUG temporaire — afficher l'erreur au lieu de 404
    return (
      <div style={{ padding: '2rem', fontFamily: 'monospace' }}>
        <h1 style={{ color: 'red' }}>DEBUG — Erreur page publique</h1>
        <p><strong>ID :</strong> {id}</p>
        <p><strong>Erreur :</strong> {seanceError?.message || 'Aucune donnée retournée'}</p>
        <p><strong>Code :</strong> {seanceError?.code || 'null'}</p>
        <p><strong>Details :</strong> {JSON.stringify(seanceError, null, 2)}</p>
      </div>
    )
  }

  // ─── Normalisation des données ───────────────────────────────────────
  // Le service role client (non typé) peut retourner les relations FK
  // sous forme d'objet ou de tableau selon la configuration PostgREST.
  // On normalise pour garantir le bon type.
  const rawInstanceConfig = seance.instance_config
  const instanceConfig = Array.isArray(rawInstanceConfig)
    ? (rawInstanceConfig[0] as { id: string; nom: string; type_legal: string; ecran_public_active?: boolean | null } | undefined) ?? null
    : (rawInstanceConfig as { id: string; nom: string; type_legal: string; ecran_public_active?: boolean | null } | null)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const odjPoints = (Array.isArray(seance.odj_points) ? seance.odj_points : []) as any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const votes = (Array.isArray(seance.votes) ? seance.votes : []) as any[]

  // ─── SÉCURITÉ : bloquer l'accès aux séances non publiques ───────────
  // Les séances à huis clos (publique === false) ne doivent pas être accessibles
  // Les séances en BROUILLON ne doivent pas être visibles publiquement
  const ALLOWED_PUBLIC_STATUTS = ['CONVOQUEE', 'EN_COURS', 'SUSPENDUE', 'CLOTUREE', 'ARCHIVEE']
  if (seance.publique === false) {
    notFound()
  }
  if (!seance.statut || !ALLOWED_PUBLIC_STATUTS.includes(seance.statut)) {
    notFound()
  }

  // ─── SÉCURITÉ : vérifier que l'écran public est activé pour cette instance ──
  if (instanceConfig?.ecran_public_active === false) {
    notFound()
  }

  // ─── SÉCURITÉ : masquer les descriptions des points à huis clos ──────
  // Le public ne doit pas voir le contenu des points marqués huis clos
  const sanitizedSeance = {
    id: seance.id as string,
    titre: seance.titre as string,
    date_seance: seance.date_seance as string,
    statut: seance.statut as string | null,
    lieu: seance.lieu as string | null,
    heure_ouverture: seance.heure_ouverture as string | null,
    heure_cloture: seance.heure_cloture as string | null,
    publique: seance.publique as boolean | null,
    instance_config: instanceConfig ? { id: instanceConfig.id, nom: instanceConfig.nom, type_legal: instanceConfig.type_legal } : null,
    odj_points: odjPoints.map((point) => ({
      ...point,
      description: point.huis_clos ? null : point.description,
    })),
    votes,
  }

  // Compter les présences (pas les noms — vie privée)
  const { count: presenceCount } = await supabase
    .from('presences')
    .select('*', { count: 'exact', head: true })
    .eq('seance_id', id)
    .in('statut', ['PRESENT', 'PROCURATION'])

  // Compter le total de convocataires
  const { count: totalConvocataires } = await supabase
    .from('convocataires')
    .select('*', { count: 'exact', head: true })
    .eq('seance_id', id)

  // Nom de l'institution
  const { data: institution } = await supabase
    .from('institution_config')
    .select('nom_officiel')
    .limit(1)
    .maybeSingle()

  return (
    <PublicSessionView
      seance={sanitizedSeance}
      institutionName={institution?.nom_officiel || process.env.NEXT_PUBLIC_INSTITUTION_NAME || 'Institution'}
      presenceCount={presenceCount || 0}
      totalConvocataires={totalConvocataires || 0}
    />
  )
}
