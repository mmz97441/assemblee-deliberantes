'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/security/rate-limiter'
import {
  generateVuConsiderantArticles,
  improveSection,
  type GenerateVCAResult,
  type ImproveSectionParams,
} from '@/lib/ai/pv-assistant'

// ─── Auth helper ─────────────────────────────────────────────────────────────

async function getAuthenticatedUser() {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    return { user: null, supabase }
  }
  return { user: data.user, supabase }
}

// ─── Generate Vu / Considerant / Articles for a point ───────────────────────

type GeneratePointContentResult =
  | { success: true; content: GenerateVCAResult }
  | { error: string }

/**
 * Genere les sections Vu, Considerant et Articles pour un point d'ODJ
 * via l'IA Anthropic Claude.
 */
export async function generatePointContent(
  seanceId: string,
  pointId: string
): Promise<GeneratePointContentResult> {
  try {
    // Check API key
    if (!process.env.ANTHROPIC_API_KEY) {
      return {
        error:
          "La clé API Anthropic n'est pas configurée. Contactez l'administrateur.",
      }
    }

    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    const role = (user.user_metadata?.role as string) || ''
    if (!['super_admin', 'gestionnaire'].includes(role)) {
      return { error: 'Permissions insuffisantes' }
    }

    // Rate limit: 10 per hour
    const rateCheck = await checkRateLimit(supabase, user.id, {
      actionKey: 'ai_pv_generation',
      maxAttempts: 10,
      windowMinutes: 60,
    })
    if (!rateCheck.allowed) {
      return {
        error: `Limite atteinte : vous avez utilisé toutes vos générations IA pour cette heure. Réessayez dans quelques minutes.`,
      }
    }

    // Load the ODJ point
    const { data: point, error: pointError } = await supabase
      .from('odj_points')
      .select('id, titre, description, projet_deliberation, seance_id')
      .eq('id', pointId)
      .eq('seance_id', seanceId)
      .single()

    if (pointError || !point) {
      return { error: 'Point introuvable dans cette séance' }
    }

    // Load institution config
    const { data: institution } = await supabase
      .from('institution_config')
      .select('nom_officiel, type_institution')
      .limit(1)
      .maybeSingle()

    if (!institution) {
      return { error: "Configuration de l'institution introuvable" }
    }

    // Load vote result if exists
    const { data: vote } = await supabase
      .from('votes')
      .select('resultat')
      .eq('odj_point_id', pointId)
      .eq('statut', 'CLOS')
      .maybeSingle()

    // Load member names from convocataires
    const { data: convocataires } = await supabase
      .from('convocataires')
      .select('member:members (prenom, nom)')
      .eq('seance_id', seanceId)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase join types
    const memberNames = (convocataires || [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((c: any) => {
        const m = c.member
        if (!m) return ''
        return `${m.prenom} ${m.nom}`.trim()
      })
      .filter((n: string) => n.length > 0)

    // Call AI generation
    const content = await generateVuConsiderantArticles({
      pointTitle: point.titre,
      pointDescription: point.description,
      projetDeliberation: point.projet_deliberation,
      voteResultat: vote?.resultat || null,
      institutionType: institution.type_institution,
      memberNames,
      institutionName: institution.nom_officiel,
    })

    return { success: true, content }
  } catch (err) {
    console.error('generatePointContent error:', err)
    const message =
      err instanceof Error ? err.message : 'Erreur inattendue'
    // Provide user-friendly messages
    if (message.includes('ANTHROPIC_API_KEY')) {
      return {
        error:
          "La clé API Anthropic n'est pas configurée. Contactez l'administrateur.",
      }
    }
    if (message.includes('rate_limit') || message.includes('429')) {
      return {
        error:
          "L'API IA est temporairement surchargée. Veuillez réessayer dans quelques instants.",
      }
    }
    return {
      error: `Erreur lors de la génération IA : ${message}`,
    }
  }
}

// ─── Improve a PV section ───────────────────────────────────────────────────

type ImproveSectionResult =
  | { success: true; improvedText: string }
  | { error: string }

/**
 * Ameliore une section de PV existante via l'IA.
 * Ne sauvegarde PAS le resultat — l'utilisateur doit valider avant.
 */
export async function improvePVSection(
  seanceId: string,
  pointId: string,
  sectionType: ImproveSectionParams['sectionType'],
  currentText: string
): Promise<ImproveSectionResult> {
  try {
    // Check API key
    if (!process.env.ANTHROPIC_API_KEY) {
      return {
        error:
          "La clé API Anthropic n'est pas configurée. Contactez l'administrateur.",
      }
    }

    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    const role = (user.user_metadata?.role as string) || ''
    if (!['super_admin', 'gestionnaire'].includes(role)) {
      return { error: 'Permissions insuffisantes' }
    }

    // Rate limit: 10 per hour (same pool as generation)
    const rateCheck = await checkRateLimit(supabase, user.id, {
      actionKey: 'ai_pv_generation',
      maxAttempts: 10,
      windowMinutes: 60,
    })
    if (!rateCheck.allowed) {
      return {
        error: `Limite atteinte : vous avez utilisé toutes vos améliorations IA pour cette heure. Réessayez dans quelques minutes.`,
      }
    }

    // Load the point for context
    const { data: point, error: pointError } = await supabase
      .from('odj_points')
      .select('titre, description')
      .eq('id', pointId)
      .eq('seance_id', seanceId)
      .single()

    if (pointError || !point) {
      return { error: 'Point introuvable dans cette séance' }
    }

    // Load institution config
    const { data: institution } = await supabase
      .from('institution_config')
      .select('nom_officiel')
      .limit(1)
      .maybeSingle()

    // Load member names
    const { data: convocataires } = await supabase
      .from('convocataires')
      .select('member:members (prenom, nom)')
      .eq('seance_id', seanceId)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase join types
    const memberNames = (convocataires || [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((c: any) => {
        const m = c.member
        if (!m) return ''
        return `${m.prenom} ${m.nom}`.trim()
      })
      .filter((n: string) => n.length > 0)

    const context = [point.titre, point.description || '']
      .filter(Boolean)
      .join(' — ')

    const improvedText = await improveSection({
      sectionType,
      currentText,
      context,
      memberNames,
      institutionName: institution?.nom_officiel || '',
    })

    return { success: true, improvedText }
  } catch (err) {
    console.error('improvePVSection error:', err)
    const message =
      err instanceof Error ? err.message : 'Erreur inattendue'
    if (message.includes('ANTHROPIC_API_KEY')) {
      return {
        error:
          "La clé API Anthropic n'est pas configurée. Contactez l'administrateur.",
      }
    }
    if (message.includes('rate_limit') || message.includes('429')) {
      return {
        error:
          "L'API IA est temporairement surchargée. Veuillez réessayer dans quelques instants.",
      }
    }
    return {
      error: `Erreur lors de l'amélioration IA : ${message}`,
    }
  }
}
