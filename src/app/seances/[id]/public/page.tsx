export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { PublicSessionView } from '@/components/seance/public-session-view'

interface Props {
  params: Promise<{ id: string }>
}

/**
 * Page PUBLIQUE — aucune authentification requise.
 * Affiche l'avancement de la séance en temps réel pour :
 * - Un écran dans la salle des délibérations
 * - Un citoyen qui suit la séance depuis son téléphone
 * - Un embed sur un site web
 */
export default async function PublicSessionPage({ params }: Props) {
  const { id } = await params

  // Utiliser le service role n'est pas nécessaire ici —
  // on crée un client anonyme (pas de session) pour lire les données publiques.
  // Les RLS doivent autoriser SELECT anonyme sur ces tables, OU on utilise le server client.
  const supabase = await createServerSupabaseClient()

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
        type_legal
      ),
      odj_points (
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
    notFound()
  }

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

  // ─── SÉCURITÉ : masquer les descriptions des points à huis clos ──────
  // Le public ne doit pas voir le contenu des points marqués huis clos
  const sanitizedSeance = {
    ...seance,
    odj_points: seance.odj_points.map((point) => ({
      ...point,
      description: point.huis_clos ? null : point.description,
    })),
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
