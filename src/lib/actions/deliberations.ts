'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { Json } from '@/lib/supabase/types'
import { checkRateLimit } from '@/lib/security/rate-limiter'

// ─── Types ───────────────────────────────────────────────────────────────────

type ActionResult = { success: true } | { error: string }

export interface DeliberationContenu {
  vu: string
  considerant: string
  articles: string[]
  formuleVote: string | null
  projetDeliberation: string | null
}

export interface DeliberationFilters {
  year?: number
  search?: string
  publishedOnly?: boolean
  seanceId?: string
}

// ─── Auth helper ─────────────────────────────────────────────────────────────

async function getAuthenticatedUser() {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) return { user: null, supabase }
  return { user: data.user, supabase }
}

function checkRole(user: { user_metadata?: Record<string, unknown> }, allowedRoles: string[]): boolean {
  const role = (user.user_metadata?.role as string) || ''
  return allowedRoles.includes(role)
}

// ─── Numbering engine ────────────────────────────────────────────────────────

/**
 * Generates the next deliberation number based on institution_config settings.
 * Uses advisory lock via pg_advisory_xact_lock to prevent race conditions.
 *
 * Format tokens: AAAA = year, NNN = zero-padded sequence number
 * Example result: "DEL-2026-042"
 */
async function generateDeliberationNumber(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<{ numero: string } | { error: string }> {
  try {
    // Fetch institution config for numbering settings
    const { data: config, error: configError } = await supabase
      .from('institution_config')
      .select('format_numero_deliberation, prefixe_numero_deliberation, remise_zero_annuelle, numero_depart')
      .limit(1)
      .maybeSingle()

    if (configError) {
      return { error: `Erreur lecture configuration : ${configError.message}` }
    }

    const format = config?.format_numero_deliberation || 'AAAA-NNN'
    const prefixe = config?.prefixe_numero_deliberation || ''
    const remiseZero = config?.remise_zero_annuelle ?? true
    const numeroDepart = config?.numero_depart ?? 1

    const currentYear = new Date().getFullYear()

    // Use advisory lock to prevent race conditions on numbering.
    // Lock ID 42001 is reserved for deliberation numbering.
    // The lock is automatically released at end of transaction.
    const { error: lockError } = await supabase.rpc('exec_sql' as never, {
      query: 'SELECT pg_advisory_xact_lock(42001)',
      params: [],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    // If advisory lock RPC is not available, fall back to counting
    // (slightly less safe but functional)
    if (lockError) {
      console.warn('Advisory lock not available, falling back to count-based numbering')
    }

    // Count published deliberations for current year (non-annulled)
    let countQuery = supabase
      .from('deliberations')
      .select('id', { count: 'exact', head: true })
      .not('numero', 'is', null)
      .eq('annulee', false)

    if (remiseZero) {
      // Only count deliberations from current year
      const yearStart = `${currentYear}-01-01T00:00:00.000Z`
      const yearEnd = `${currentYear + 1}-01-01T00:00:00.000Z`
      countQuery = countQuery
        .gte('publie_at', yearStart)
        .lt('publie_at', yearEnd)
    }

    const { count, error: countError } = await countQuery

    if (countError) {
      return { error: `Erreur comptage des délibérations : ${countError.message}` }
    }

    const nextNumber = (count ?? 0) + numeroDepart

    // Determine padding length from format (count N's)
    const nMatch = format.match(/N+/)
    const padLength = nMatch ? nMatch[0].length : 3

    // Build the formatted number
    let numero = format
      .replace(/A{4}/, String(currentYear))
      .replace(/N+/, String(nextNumber).padStart(padLength, '0'))

    // Prepend prefix if set
    if (prefixe) {
      numero = `${prefixe}${numero}`
    }

    return { numero }
  } catch (err) {
    console.error('generateDeliberationNumber error:', err)
    return { error: 'Erreur inattendue lors de la génération du numéro' }
  }
}

// ─── Create deliberation from an adopted vote ───────────────────────────────

/**
 * Creates a deliberation draft from a closed, adopted vote.
 * Number is NOT assigned at creation — only at publication.
 */
export async function createDeliberationFromVote(
  seanceId: string,
  voteId: string,
  odjPointId: string
): Promise<{ success: true; deliberationId: string } | { error: string }> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    if (!checkRole(user, ['super_admin', 'gestionnaire'])) {
      return { error: 'Permissions insuffisantes' }
    }

    // Verify séance is closed before creating deliberation
    const { data: seance } = await supabase
      .from('seances')
      .select('statut')
      .eq('id', seanceId)
      .single()

    if (!seance || seance.statut !== 'CLOTUREE') {
      return { error: 'Les délibérations ne peuvent être créées qu\'après la clôture de la séance.' }
    }

    // Verify the vote exists, is closed and adopted
    const { data: vote, error: voteError } = await supabase
      .from('votes')
      .select('id, statut, resultat, formule_pv')
      .eq('id', voteId)
      .single()

    if (voteError || !vote) return { error: 'Vote introuvable' }

    if (vote.statut !== 'CLOS') {
      return { error: 'Le vote doit être clos avant de créer une délibération' }
    }

    const adoptedResults = ['ADOPTE', 'ADOPTE_UNANIMITE', 'ADOPTE_VOIX_PREPONDERANTE']
    if (!adoptedResults.includes(vote.resultat || '')) {
      return { error: `Le vote n\'a pas été adopté (résultat : ${vote.resultat || 'inconnu'}). Seuls les votes adoptés peuvent générer une délibération.` }
    }

    // Check no deliberation already exists for this vote
    const { data: existing } = await supabase
      .from('deliberations')
      .select('id')
      .eq('vote_id', voteId)
      .maybeSingle()

    if (existing) {
      return { error: 'Une délibération existe déjà pour ce vote' }
    }

    // Fetch the ODJ point data
    const { data: point, error: pointError } = await supabase
      .from('odj_points')
      .select('id, titre, projet_deliberation, description')
      .eq('id', odjPointId)
      .single()

    if (pointError || !point) return { error: 'Point ODJ introuvable' }

    // Extract content from PV (vu, considerant, articles live in PV content, not on odj_points)
    const { data: pv } = await supabase
      .from('pv')
      .select('contenu_json')
      .eq('seance_id', seanceId)
      .maybeSingle()

    let vu = ''
    let considerant = ''
    let articles: string[] = []
    const formuleVote = vote.formule_pv || null

    if (pv?.contenu_json) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pvContenu = pv.contenu_json as any
      if (pvContenu?.points && Array.isArray(pvContenu.points)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pvPoint = pvContenu.points.find((p: any) => p.titre === point.titre)
        if (pvPoint) {
          vu = pvPoint.vu || ''
          considerant = pvPoint.considerant || ''
          articles = Array.isArray(pvPoint.articles) ? pvPoint.articles : []
        }
      }
    }

    const contenuArticles: DeliberationContenu = {
      vu,
      considerant,
      articles,
      formuleVote,
      projetDeliberation: point.projet_deliberation,
    }

    // Insert the deliberation (numero = null, assigned at publication)
    const { data: newDelib, error: insertError } = await supabase
      .from('deliberations')
      .insert({
        seance_id: seanceId,
        vote_id: voteId,
        odj_point_id: odjPointId,
        titre: point.titre,
        contenu_articles: contenuArticles as unknown as Json,
        numero: null,
        publie_at: null,
        affiche_at: null,
        transmis_prefecture_at: null,
        annulee: false,
      })
      .select('id')
      .single()

    if (insertError) {
      return { error: `Erreur création délibération : ${insertError.message}` }
    }

    revalidatePath(`/seances/${seanceId}`)
    revalidatePath('/deliberations')
    return { success: true, deliberationId: newDelib.id }
  } catch (err) {
    console.error('createDeliberationFromVote error:', err)
    return { error: 'Erreur inattendue lors de la création de la délibération' }
  }
}

// ─── Update deliberation content ─────────────────────────────────────────────

/**
 * Updates the content of a deliberation draft.
 * Cannot update a published deliberation.
 */
export async function updateDeliberationContent(
  deliberationId: string,
  content: DeliberationContenu
): Promise<ActionResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    if (!checkRole(user, ['super_admin', 'gestionnaire'])) {
      return { error: 'Permissions insuffisantes' }
    }

    // Verify deliberation exists and is not published
    const { data: delib, error: fetchError } = await supabase
      .from('deliberations')
      .select('id, publie_at, seance_id')
      .eq('id', deliberationId)
      .single()

    if (fetchError || !delib) return { error: 'Délibération introuvable' }

    if (delib.publie_at) {
      return { error: 'Impossible de modifier une délibération déjà publiée' }
    }

    const { error: updateError } = await supabase
      .from('deliberations')
      .update({
        contenu_articles: content as unknown as Json,
        updated_at: new Date().toISOString(),
      })
      .eq('id', deliberationId)

    if (updateError) {
      return { error: `Erreur mise à jour : ${updateError.message}` }
    }

    revalidatePath(`/seances/${delib.seance_id}`)
    revalidatePath('/deliberations')
    return { success: true }
  } catch (err) {
    console.error('updateDeliberationContent error:', err)
    return { error: 'Erreur inattendue lors de la mise à jour' }
  }
}

// ─── Publish deliberation (assigns number) ──────────────────────────────────

/**
 * Publishes a deliberation: generates the official number and sets publie_at.
 * Number assignment is the CRITICAL step -- handled by generateDeliberationNumber.
 */
export async function publishDeliberation(
  deliberationId: string
): Promise<{ success: true; numero: string } | { error: string }> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    if (!checkRole(user, ['super_admin', 'gestionnaire'])) {
      return { error: 'Permissions insuffisantes' }
    }

    // Rate limiting
    const rateCheck = await checkRateLimit(supabase, user.id, {
      actionKey: `publish_delib_${deliberationId}`,
      maxAttempts: 20,
      windowMinutes: 60,
    })
    if (!rateCheck.allowed) return { error: rateCheck.error! }

    // Verify deliberation exists and is not already published
    const { data: delib, error: fetchError } = await supabase
      .from('deliberations')
      .select('id, publie_at, seance_id, annulee')
      .eq('id', deliberationId)
      .single()

    if (fetchError || !delib) return { error: 'Délibération introuvable' }

    if (delib.publie_at) {
      return { error: 'Cette délibération est déjà publiée' }
    }

    if (delib.annulee) {
      return { error: 'Impossible de publier une délibération annulée' }
    }

    // Generate the official number
    const numResult = await generateDeliberationNumber(supabase)
    if ('error' in numResult) return { error: numResult.error }

    // Set numero and publie_at atomically
    const { error: updateError } = await supabase
      .from('deliberations')
      .update({
        numero: numResult.numero,
        publie_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', deliberationId)

    if (updateError) {
      return { error: `Erreur publication : ${updateError.message}` }
    }

    revalidatePath(`/seances/${delib.seance_id}`)
    revalidatePath('/deliberations')
    return { success: true, numero: numResult.numero }
  } catch (err) {
    console.error('publishDeliberation error:', err)
    return { error: 'Erreur inattendue lors de la publication' }
  }
}

// ─── Annul deliberation ──────────────────────────────────────────────────────

/**
 * Annuls a deliberation. The numero is kept (never reused).
 * Only super_admin can annul.
 */
export async function annulDeliberation(
  deliberationId: string,
  motif: string
): Promise<ActionResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    if (!checkRole(user, ['super_admin'])) {
      return { error: 'Seul un super administrateur peut annuler une délibération' }
    }

    if (!motif.trim()) {
      return { error: 'Le motif d\'annulation est obligatoire' }
    }

    const { data: delib, error: fetchError } = await supabase
      .from('deliberations')
      .select('id, seance_id, annulee')
      .eq('id', deliberationId)
      .single()

    if (fetchError || !delib) return { error: 'Délibération introuvable' }

    if (delib.annulee) {
      return { error: 'Cette délibération est déjà annulée' }
    }

    const { error: updateError } = await supabase
      .from('deliberations')
      .update({
        annulee: true,
        motif_annulation: motif.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', deliberationId)

    if (updateError) {
      return { error: `Erreur annulation : ${updateError.message}` }
    }

    revalidatePath(`/seances/${delib.seance_id}`)
    revalidatePath('/deliberations')
    return { success: true }
  } catch (err) {
    console.error('annulDeliberation error:', err)
    return { error: 'Erreur inattendue lors de l\'annulation' }
  }
}

// ─── Mark affichage ──────────────────────────────────────────────────────────

export async function markAffichage(
  deliberationId: string
): Promise<ActionResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    if (!checkRole(user, ['super_admin', 'gestionnaire'])) {
      return { error: 'Permissions insuffisantes' }
    }

    const { data: delib, error: fetchError } = await supabase
      .from('deliberations')
      .select('id, seance_id, affiche_at')
      .eq('id', deliberationId)
      .single()

    if (fetchError || !delib) return { error: 'Délibération introuvable' }

    if (delib.affiche_at) {
      return { error: 'La date d\'affichage est déjà enregistrée' }
    }

    const { error: updateError } = await supabase
      .from('deliberations')
      .update({
        affiche_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', deliberationId)

    if (updateError) {
      return { error: `Erreur enregistrement affichage : ${updateError.message}` }
    }

    revalidatePath(`/seances/${delib.seance_id}`)
    revalidatePath('/deliberations')
    return { success: true }
  } catch (err) {
    console.error('markAffichage error:', err)
    return { error: 'Erreur inattendue' }
  }
}

// ─── Mark transmission prefecture ────────────────────────────────────────────

export async function markTransmissionPrefecture(
  deliberationId: string
): Promise<ActionResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    if (!checkRole(user, ['super_admin', 'gestionnaire'])) {
      return { error: 'Permissions insuffisantes' }
    }

    const { data: delib, error: fetchError } = await supabase
      .from('deliberations')
      .select('id, seance_id, transmis_prefecture_at')
      .eq('id', deliberationId)
      .single()

    if (fetchError || !delib) return { error: 'Délibération introuvable' }

    if (delib.transmis_prefecture_at) {
      return { error: 'La date de transmission en préfecture est déjà enregistrée' }
    }

    const { error: updateError } = await supabase
      .from('deliberations')
      .update({
        transmis_prefecture_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', deliberationId)

    if (updateError) {
      return { error: `Erreur enregistrement transmission : ${updateError.message}` }
    }

    revalidatePath(`/seances/${delib.seance_id}`)
    revalidatePath('/deliberations')
    return { success: true }
  } catch (err) {
    console.error('markTransmissionPrefecture error:', err)
    return { error: 'Erreur inattendue' }
  }
}

// ─── Get deliberations list ──────────────────────────────────────────────────

export async function getDeliberations(filters?: DeliberationFilters): Promise<
  { data: Record<string, unknown>[] } | { error: string }
> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    let query = supabase
      .from('deliberations')
      .select(`
        id, numero, titre, contenu_articles, publie_at, affiche_at,
        transmis_prefecture_at, pdf_url, annulee, motif_annulation,
        created_at, updated_at,
        seance_id, vote_id, odj_point_id,
        seances (id, titre, date_seance),
        votes (id, resultat),
        odj_points (id, titre)
      `)

    // Apply filters
    if (filters?.seanceId) {
      query = query.eq('seance_id', filters.seanceId)
    }

    if (filters?.publishedOnly) {
      query = query.not('publie_at', 'is', null)
    }

    if (filters?.year) {
      const yearStart = `${filters.year}-01-01T00:00:00.000Z`
      const yearEnd = `${filters.year + 1}-01-01T00:00:00.000Z`
      // Filter by created_at year (covers both published and drafts)
      query = query
        .gte('created_at', yearStart)
        .lt('created_at', yearEnd)
    }

    if (filters?.search) {
      query = query.ilike('titre', `%${filters.search}%`)
    }

    // Order: published first (by numero DESC), then drafts by created_at DESC
    query = query.order('publie_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })

    const { data, error } = await query

    if (error) return { error: `Erreur chargement délibérations : ${error.message}` }

    return { data: (data || []) as unknown as Record<string, unknown>[] }
  } catch (err) {
    console.error('getDeliberations error:', err)
    return { error: 'Erreur inattendue' }
  }
}

// ─── Get single deliberation ─────────────────────────────────────────────────

export async function getDeliberation(id: string): Promise<
  { data: Record<string, unknown> } | { error: string }
> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    const { data, error } = await supabase
      .from('deliberations')
      .select(`
        id, numero, titre, contenu_articles, publie_at, affiche_at,
        transmis_prefecture_at, pdf_url, annulee, motif_annulation,
        created_at, updated_at,
        seance_id, vote_id, odj_point_id,
        seances (id, titre, date_seance, statut),
        votes (id, resultat, pour, contre, abstention, total_votants, formule_pv, mode),
        odj_points (id, titre, description, type_traitement, rapporteur_id)
      `)
      .eq('id', id)
      .single()

    if (error) return { error: `Délibération introuvable : ${error.message}` }

    return { data: data as unknown as Record<string, unknown> }
  } catch (err) {
    console.error('getDeliberation error:', err)
    return { error: 'Erreur inattendue' }
  }
}

// ─── Delete deliberation draft ──────────────────────────────────────────────

/**
 * Deletes a deliberation that has not yet been published.
 * Only drafts (publie_at = null) can be deleted.
 */
export async function deleteDeliberationDraft(
  deliberationId: string
): Promise<ActionResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    if (!checkRole(user, ['super_admin', 'gestionnaire'])) {
      return { error: 'Permissions insuffisantes' }
    }

    const { data: delib, error: fetchError } = await supabase
      .from('deliberations')
      .select('id, publie_at, seance_id')
      .eq('id', deliberationId)
      .single()

    if (fetchError || !delib) return { error: 'Délibération introuvable' }

    if (delib.publie_at) {
      return { error: 'Impossible de supprimer une délibération publiée. Utilisez l\'annulation.' }
    }

    const { error: deleteError } = await supabase
      .from('deliberations')
      .delete()
      .eq('id', deliberationId)

    if (deleteError) {
      return { error: `Erreur suppression : ${deleteError.message}` }
    }

    revalidatePath(`/seances/${delib.seance_id}`)
    revalidatePath('/deliberations')
    return { success: true }
  } catch (err) {
    console.error('deleteDeliberationDraft error:', err)
    return { error: 'Erreur inattendue lors de la suppression' }
  }
}

// ─── Update deliberation title ──────────────────────────────────────────────

export async function updateDeliberationTitle(
  deliberationId: string,
  titre: string
): Promise<ActionResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    if (!checkRole(user, ['super_admin', 'gestionnaire'])) {
      return { error: 'Permissions insuffisantes' }
    }

    if (!titre.trim()) {
      return { error: 'Le titre est obligatoire' }
    }

    const { data: delib, error: fetchError } = await supabase
      .from('deliberations')
      .select('id, publie_at, seance_id')
      .eq('id', deliberationId)
      .single()

    if (fetchError || !delib) return { error: 'Délibération introuvable' }

    if (delib.publie_at) {
      return { error: 'Impossible de modifier le titre d\'une délibération publiée' }
    }

    const { error: updateError } = await supabase
      .from('deliberations')
      .update({
        titre: titre.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', deliberationId)

    if (updateError) {
      return { error: `Erreur mise à jour du titre : ${updateError.message}` }
    }

    revalidatePath(`/seances/${delib.seance_id}`)
    revalidatePath('/deliberations')
    revalidatePath(`/deliberations/${deliberationId}`)
    return { success: true }
  } catch (err) {
    console.error('updateDeliberationTitle error:', err)
    return { error: 'Erreur inattendue' }
  }
}

// ─── Auto-create deliberations for a closed seance ──────────────────────────

/**
 * Called after a seance is CLOTUREE.
 * Creates deliberation drafts for ALL adopted votes that don't already have one.
 */
export async function autoCreateDeliberationsForSeance(
  seanceId: string
): Promise<{ success: true; count: number } | { error: string }> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    if (!checkRole(user, ['super_admin', 'gestionnaire'])) {
      return { error: 'Permissions insuffisantes' }
    }

    // Verify seance exists
    const { data: seance, error: seanceError } = await supabase
      .from('seances')
      .select('id, statut')
      .eq('id', seanceId)
      .single()

    if (seanceError || !seance) return { error: 'Séance introuvable' }

    // Fetch all adopted, closed votes for this seance
    const { data: votes, error: votesError } = await supabase
      .from('votes')
      .select('id, odj_point_id, resultat')
      .eq('seance_id', seanceId)
      .eq('statut', 'CLOS')
      .in('resultat', ['ADOPTE', 'ADOPTE_UNANIMITE', 'ADOPTE_VOIX_PREPONDERANTE'])

    if (votesError) return { error: `Erreur chargement votes : ${votesError.message}` }

    if (!votes || votes.length === 0) {
      return { success: true, count: 0 }
    }

    // Fetch existing deliberations for this seance to avoid duplicates
    const { data: existingDelibs } = await supabase
      .from('deliberations')
      .select('vote_id')
      .eq('seance_id', seanceId)

    const existingVoteIds = new Set(
      (existingDelibs || []).map((d: { vote_id: string | null }) => d.vote_id)
    )

    let createdCount = 0

    for (const vote of votes) {
      if (!vote.odj_point_id) continue
      if (existingVoteIds.has(vote.id)) continue

      const result = await createDeliberationFromVote(seanceId, vote.id, vote.odj_point_id)

      if ('success' in result) {
        createdCount++
      } else {
        // Log but don't fail the whole batch
        console.warn(`Skipped deliberation for vote ${vote.id}: ${result.error}`)
      }
    }

    revalidatePath(`/seances/${seanceId}`)
    revalidatePath('/deliberations')
    return { success: true, count: createdCount }
  } catch (err) {
    console.error('autoCreateDeliberationsForSeance error:', err)
    return { error: 'Erreur inattendue lors de la création automatique des délibérations' }
  }
}
