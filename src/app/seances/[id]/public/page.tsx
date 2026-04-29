export const dynamic = 'force-dynamic'

import { createServiceRoleClient } from '@/lib/supabase/server'
import { PublicSessionView } from '@/components/seance/public-session-view'

// DEBUG temporaire : panneau d'erreur verbeux à la place de notFound()
function DebugPanel(props: { title: string; data: Record<string, unknown> }) {
  return (
    <div style={{ padding: '2rem', fontFamily: 'monospace', maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ color: '#b91c1c' }}>DEBUG — {props.title}</h1>
      <pre style={{ background: '#f3f4f6', padding: '1rem', borderRadius: 8, whiteSpace: 'pre-wrap' }}>
        {JSON.stringify(props.data, null, 2)}
      </pre>
      <p style={{ color: '#6b7280', marginTop: '1rem' }}>
        Cette page de debug est temporaire. Retire-la quand le bug est résolu.
      </p>
    </div>
  )
}

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
  let step = 'init'
  try {
  step = 'createServiceRoleClient'
  // Service role nécessaire : les visiteurs publics n'ont pas de session,
  // et les RLS bloquent les SELECT anonymes. Les gardes de sécurité
  // sont assurées dans le code (publique, statut, ecran_public_active).
  const supabase = await createServiceRoleClient()

  // Charger la séance avec les données nécessaires (pas de données personnelles)
  step = 'query seances'
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
    return <DebugPanel title="Bloqué — seance.publique === false" data={{
      id, publique: seance.publique, statut: seance.statut, titre: seance.titre,
    }} />
  }
  if (!seance.statut || !ALLOWED_PUBLIC_STATUTS.includes(seance.statut as string)) {
    return <DebugPanel title="Bloqué — statut non autorisé" data={{
      id, statut: seance.statut, allowed: ALLOWED_PUBLIC_STATUTS,
      publique: seance.publique, titre: seance.titre,
    }} />
  }

  // ─── SÉCURITÉ : vérifier que l'écran public est activé pour cette instance ──
  if (instanceConfig?.ecran_public_active === false) {
    return <DebugPanel title="Bloqué — ecran_public_active === false" data={{
      id, instance: instanceConfig, statut: seance.statut, publique: seance.publique,
    }} />
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
  step = 'count presences'
  const { count: presenceCount, error: presenceError } = await supabase
    .from('presences')
    .select('*', { count: 'exact', head: true })
    .eq('seance_id', id)
    .in('statut', ['PRESENT', 'PROCURATION'])
  if (presenceError) throw new Error(`presences: ${presenceError.message} (code=${presenceError.code})`)

  // Compter le total de convocataires
  step = 'count convocataires'
  const { count: totalConvocataires, error: convocError } = await supabase
    .from('convocataires')
    .select('*', { count: 'exact', head: true })
    .eq('seance_id', id)
  if (convocError) throw new Error(`convocataires: ${convocError.message} (code=${convocError.code})`)

  // Nom de l'institution
  step = 'query institution_config'
  const { data: institution, error: institutionError } = await supabase
    .from('institution_config')
    .select('nom_officiel')
    .limit(1)
    .maybeSingle()
  if (institutionError) throw new Error(`institution_config: ${institutionError.message} (code=${institutionError.code})`)

  step = 'render PublicSessionView'
  return (
    <PublicSessionView
      seance={sanitizedSeance}
      institutionName={institution?.nom_officiel || process.env.NEXT_PUBLIC_INSTITUTION_NAME || 'Institution'}
      presenceCount={presenceCount || 0}
      totalConvocataires={totalConvocataires || 0}
    />
  )
  } catch (e) {
    const err = e as Error
    return <DebugPanel title={`Exception @ ${step}`} data={{
      id,
      step,
      message: err?.message ?? String(err),
      name: err?.name,
      stack: err?.stack?.split('\n').slice(0, 25),
    }} />
  }
}
