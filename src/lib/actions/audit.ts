'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server'
import { requireVerifiedRole } from '@/lib/auth/require-role'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AuditEntry {
  id: string
  user_id: string | null
  action: string // INSERT | UPDATE | DELETE
  table_name: string
  record_id: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  old_values: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  new_values: any
  ip: string | null
  user_agent: string | null
  created_at: string
  // Enrichi côté serveur pour l'affichage
  user_label: string | null // "Prénom Nom" ou null si user inconnu
  is_redacted: boolean // true si une entrée audit_log_redactions y fait référence
}

export interface AuditFilters {
  /** ID du membre qui a effectué l'action (croisé avec auth.users.id) */
  user_member_id?: string | null
  /** Nom exact de la table affectée (members, seances, votes, etc.) */
  table_name?: string | null
  /** Type d'action (INSERT, UPDATE, DELETE) */
  action?: string | null
  /** ISO date YYYY-MM-DD inclusif */
  from_date?: string | null
  to_date?: string | null
  /** Recherche libre dans les valeurs (limitée à 100 chars) */
  search?: string | null
  /** Pagination */
  page?: number
  page_size?: number
}

export interface AuditSearchResult {
  data: AuditEntry[]
  total: number
  page: number
  page_size: number
}

// ─── List & filter audit entries ────────────────────────────────────────────
//
// Accessible aux 4 rôles privilégiés (RLS audit_log les autorise déjà).
// Cette server action enrichit chaque ligne avec le nom de l'utilisateur
// (jointure auth.users → members en batch) et le flag is_redacted.

export async function searchAuditLog(
  filters: AuditFilters = {}
): Promise<AuditSearchResult | { error: string }> {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Non authentifié' }

    // Vérification rôle (RLS le ferait aussi mais on échoue tôt avec un msg clair)
    const roleError = await requireVerifiedRole(supabase, user, [
      'super_admin', 'dgs', 'directeur_cabinet', 'gestionnaire',
    ])
    if (roleError) return { error: roleError }

    const page = Math.max(1, filters.page || 1)
    const pageSize = Math.min(100, Math.max(10, filters.page_size || 50))
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = supabase.from('audit_log').select('*', { count: 'exact' })

    if (filters.table_name) query = query.eq('table_name', filters.table_name)
    if (filters.action) query = query.eq('action', filters.action)
    if (filters.from_date) query = query.gte('created_at', `${filters.from_date}T00:00:00Z`)
    if (filters.to_date) query = query.lte('created_at', `${filters.to_date}T23:59:59Z`)

    // Filtre par utilisateur : on a un member_id, on doit retrouver son user_id
    if (filters.user_member_id) {
      const { data: m } = await supabase
        .from('members')
        .select('user_id')
        .eq('id', filters.user_member_id)
        .maybeSingle()
      if (m?.user_id) query = query.eq('user_id', m.user_id)
      else query = query.eq('user_id', '00000000-0000-0000-0000-000000000000') // pas de match
    }

    // Recherche libre : on cherche dans new_values OU old_values (JSON contient)
    // SECURITY : on tronque l'input à 100 chars + on échappe les ' (PostgREST le fait déjà)
    if (filters.search && filters.search.trim()) {
      const safe = filters.search.trim().slice(0, 100)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      query = (query as any).or(
        `new_values::text.ilike.%${safe}%,old_values::text.ilike.%${safe}%,record_id::text.ilike.%${safe}%`
      )
    }

    query = query.order('created_at', { ascending: false }).range(from, to)

    const { data, error, count } = await query
    if (error) return { error: `Erreur de chargement : ${error.message}` }

    const entries = (data || []) as Omit<AuditEntry, 'user_label' | 'is_redacted'>[]

    // Enrichir avec les noms d'utilisateur en batch (1 requête members)
    const userIds = Array.from(new Set(entries.map(e => e.user_id).filter((x): x is string => !!x)))
    const userLabelMap = new Map<string, string>()
    if (userIds.length > 0) {
      const { data: members } = await supabase
        .from('members')
        .select('user_id, prenom, nom')
        .in('user_id', userIds)
      for (const m of (members || [])) {
        if (m.user_id) {
          userLabelMap.set(m.user_id, `${m.prenom} ${m.nom}`.trim())
        }
      }
    }

    // Récupérer les ID redacted (si SA, sinon vide → pas de marquage particulier)
    const entryIds = entries.map(e => e.id)
    const redactedIds = new Set<string>()
    if (entryIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: redactions } = await ((supabase as any).from('audit_log_redactions'))
        .select('audit_log_id')
        .in('audit_log_id', entryIds)
      for (const r of (redactions || [])) {
        redactedIds.add(r.audit_log_id)
      }
    }

    const enriched: AuditEntry[] = entries.map(e => ({
      ...e,
      user_label: e.user_id ? (userLabelMap.get(e.user_id) || null) : null,
      is_redacted: redactedIds.has(e.id),
    }))

    return { data: enriched, total: count || 0, page, page_size: pageSize }
  } catch (err) {
    console.error('searchAuditLog error:', err)
    return { error: 'Erreur inattendue lors du chargement de l\'historique' }
  }
}

// ─── List of distinct tables actually present in the audit log ──────────
// Pour alimenter le filtre Select. On limite à un set raisonnable.

export async function listAuditTables(): Promise<string[]> {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const roleError = await requireVerifiedRole(supabase, user, [
      'super_admin', 'dgs', 'directeur_cabinet', 'gestionnaire',
    ])
    if (roleError) return []

    // Distinct des table_name. PostgREST ne supporte pas DISTINCT directement,
    // on récupère des entrées récentes et on dédupe en JS.
    const { data } = await supabase
      .from('audit_log')
      .select('table_name')
      .order('created_at', { ascending: false })
      .limit(2000)

    const unique = Array.from(new Set((data || []).map(d => d.table_name).filter((t): t is string => !!t)))
    return unique.sort()
  } catch (err) {
    console.error('listAuditTables error:', err)
    return []
  }
}

// ─── Redact (anonymiser) an audit entry — RGPD ───────────────────────────
//
// IMMUABILITÉ : on ne SUPPRIME jamais une entrée audit_log. Cette action,
// réservée au super_admin, remplace les valeurs sensibles par "[REDACTED]"
// et insère une trace dans audit_log_redactions (immuable elle aussi).
//
// Le motif légal est OBLIGATOIRE et stocké en clair pour audit RGPD.

export async function redactAuditEntry(
  auditLogId: string,
  motifLegal: string
): Promise<{ success: true } | { error: string }> {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Non authentifié' }

    // Vérification stricte : SUPER ADMIN UNIQUEMENT (pas même DGS / Dir cab)
    const { data: caller } = await supabase
      .from('members')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!caller || caller.role !== 'super_admin') {
      return { error: 'Action réservée au super-administrateur (conformité RGPD).' }
    }

    if (!motifLegal || motifLegal.trim().length < 10) {
      return { error: 'Le motif légal est obligatoire (minimum 10 caractères).' }
    }

    const motif = motifLegal.trim().slice(0, 1000)

    // On utilise service_role pour pouvoir insérer dans audit_log_redactions
    // ET pour modifier audit_log (les RLS bloquent UPDATE par défaut).
    const sb = await createServiceRoleClient()

    // 1. Vérifier que l'entrée existe et n'est pas déjà redactée
    const { data: entry } = await sb
      .from('audit_log')
      .select('id')
      .eq('id', auditLogId)
      .maybeSingle()
    if (!entry) return { error: 'Entrée d\'audit introuvable' }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await ((sb as any).from('audit_log_redactions'))
      .select('id')
      .eq('audit_log_id', auditLogId)
      .maybeSingle()
    if (existing) return { error: 'Cette entrée a déjà été anonymisée.' }

    // 2. Insérer la trace de l'anonymisation (immuable)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: traceError } = await ((sb as any).from('audit_log_redactions')).insert({
      audit_log_id: auditLogId,
      redacted_by: user.id,
      motif_legal: motif,
    })
    if (traceError) return { error: `Impossible d'enregistrer la trace : ${traceError.message}` }

    // 3. Anonymiser old_values + new_values dans audit_log (sans toucher
    //    user_id, action, table_name, ip, user_agent — données contextuelles
    //    qui doivent rester traçables). Seules les VALEURS de la donnée
    //    anonymisée (ex: prénom/nom/email/téléphone) sont remplacées.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (sb.from('audit_log') as any)
      .update({
        old_values: { _redacted: true, _at: new Date().toISOString() },
        new_values: { _redacted: true, _at: new Date().toISOString() },
      })
      .eq('id', auditLogId)
    if (updateError) return { error: `Erreur d'anonymisation : ${updateError.message}` }

    revalidatePath('/historique')
    return { success: true }
  } catch (err) {
    console.error('redactAuditEntry error:', err)
    return { error: 'Erreur inattendue' }
  }
}
