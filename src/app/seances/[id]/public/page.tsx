export const dynamic = 'force-dynamic'

import type { ReactNode } from 'react'
import { Lock, Landmark, Clock, EyeOff, FileQuestion } from 'lucide-react'
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
 *
 * En cas d'indisponibilité (huis clos, brouillon, écran désactivé), on
 * affiche une vue d'explication plutôt qu'un 404 — pour qu'un citoyen
 * comprenne pourquoi il ne voit rien.
 */
export default async function PublicSessionPage({ params }: Props) {
  const { id } = params

  const supabase = await createServiceRoleClient()

  const { data: seance } = await supabase
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

  // ─── Nom de l'institution (header commun à toutes les vues) ─────────
  const { data: institution } = await supabase
    .from('institution_config')
    .select('nom_officiel')
    .limit(1)
    .maybeSingle()
  const institutionName =
    institution?.nom_officiel || process.env.NEXT_PUBLIC_INSTITUTION_NAME || 'Institution'

  // ─── Séance introuvable ─────────────────────────────────────────────
  if (!seance) {
    return (
      <PublicUnavailable
        institutionName={institutionName}
        icon={<FileQuestion className="h-20 w-20 sm:h-24 sm:w-24 text-white/60" />}
        title="Séance introuvable"
        message="Le lien que vous avez utilisé ne correspond à aucune séance. Vérifiez l'URL ou contactez l'institution."
      />
    )
  }

  // Normalisation : le service role client (non typé) peut retourner les
  // relations FK en objet ou en tableau selon la configuration PostgREST.
  const rawInstanceConfig = seance.instance_config
  const instanceConfig = Array.isArray(rawInstanceConfig)
    ? (rawInstanceConfig[0] as { id: string; nom: string; type_legal: string; ecran_public_active?: boolean | null } | undefined) ?? null
    : (rawInstanceConfig as { id: string; nom: string; type_legal: string; ecran_public_active?: boolean | null } | null)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const odjPoints = (Array.isArray(seance.odj_points) ? seance.odj_points : []) as any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const votes = (Array.isArray(seance.votes) ? seance.votes : []) as any[]

  // ─── Séance à huis clos ─────────────────────────────────────────────
  if (seance.publique === false) {
    return (
      <PublicUnavailable
        institutionName={institutionName}
        icon={<Lock className="h-20 w-20 sm:h-24 sm:w-24 text-amber-300" />}
        title="Séance à huis clos"
        message="Cette séance se déroule à huis clos et n'est pas diffusée publiquement. Le procès-verbal sera publié à l'issue de la séance, conformément au CGCT."
      />
    )
  }

  // ─── Statut non publiable (BROUILLON, etc.) ─────────────────────────
  const ALLOWED_PUBLIC_STATUTS = ['CONVOQUEE', 'EN_COURS', 'SUSPENDUE', 'CLOTUREE', 'ARCHIVEE']
  if (!seance.statut || !ALLOWED_PUBLIC_STATUTS.includes(seance.statut as string)) {
    return (
      <PublicUnavailable
        institutionName={institutionName}
        icon={<Clock className="h-20 w-20 sm:h-24 sm:w-24 text-white/60" />}
        title="Séance pas encore disponible"
        message="Cette séance n'a pas encore été convoquée. Elle sera accessible publiquement une fois les convocations envoyées."
      />
    )
  }

  // ─── Écran public désactivé pour cette instance ─────────────────────
  if (instanceConfig?.ecran_public_active === false) {
    return (
      <PublicUnavailable
        institutionName={institutionName}
        icon={<EyeOff className="h-20 w-20 sm:h-24 sm:w-24 text-white/60" />}
        title="Diffusion publique désactivée"
        message="L'écran public n'est pas activé pour cette instance. Contactez l'institution pour plus d'informations."
      />
    )
  }

  // ─── Sanitization : masquer les descriptions des points à huis clos ──
  const sanitizedSeance = {
    id: seance.id as string,
    titre: seance.titre as string,
    date_seance: seance.date_seance as string,
    statut: seance.statut as string | null,
    lieu: seance.lieu as string | null,
    heure_ouverture: seance.heure_ouverture as string | null,
    heure_cloture: seance.heure_cloture as string | null,
    publique: seance.publique as boolean | null,
    instance_config: instanceConfig
      ? { id: instanceConfig.id, nom: instanceConfig.nom, type_legal: instanceConfig.type_legal }
      : null,
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

  return (
    <PublicSessionView
      seance={sanitizedSeance}
      institutionName={institutionName}
      presenceCount={presenceCount || 0}
      totalConvocataires={totalConvocataires || 0}
    />
  )
}

// ─── Vue d'indisponibilité (huis clos, brouillon, etc.) ──────────────
function PublicUnavailable(props: {
  institutionName: string
  icon: ReactNode
  title: string
  message: string
}) {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white px-6 py-12">
      <div className="flex items-center gap-4 sm:gap-6 mb-12 sm:mb-16">
        <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl bg-white/10 border border-white/20 shrink-0">
          <Landmark className="h-10 w-10 sm:h-12 sm:w-12 text-white/80" />
        </div>
        <h1 className="text-2xl sm:text-4xl font-bold tracking-tight">{props.institutionName}</h1>
      </div>
      <div className="mb-8">{props.icon}</div>
      <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-center mb-6 max-w-3xl">
        {props.title}
      </h2>
      <p className="text-lg sm:text-xl text-white/70 text-center max-w-2xl leading-relaxed">
        {props.message}
      </p>
    </div>
  )
}
