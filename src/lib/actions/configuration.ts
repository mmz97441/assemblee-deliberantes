'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ROUTES } from '@/lib/constants'

type ActionResult = { success: true } | { error: string }

async function getAuthenticatedUser() {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    return { user: null, supabase }
  }
  return { user: data.user, supabase }
}

function requireRole(user: { user_metadata?: Record<string, unknown> } | null, roles: string[]): string | null {
  if (!user) return 'Non authentifié'
  const role = (user.user_metadata?.role as string) || ''
  if (!roles.includes(role)) return 'Permissions insuffisantes'
  return null
}

export async function saveInstitutionConfig(formData: FormData): Promise<ActionResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    const roleError = requireRole(user, ['super_admin'])
    if (roleError) return { error: roleError }

    const nom_officiel = formData.get('nom_officiel') as string
    const type_institution = formData.get('type_institution') as string

    if (!nom_officiel?.trim()) {
      return { error: 'Le nom officiel est requis' }
    }
    if (!type_institution) {
      return { error: 'Le type d\'institution est requis' }
    }

    const payload = {
      nom_officiel: nom_officiel.trim(),
      type_institution: type_institution as 'commune' | 'syndicat' | 'cc' | 'departement' | 'asso',
      siren: (formData.get('siren') as string)?.trim() || null,
      siret: (formData.get('siret') as string)?.trim() || null,
      adresse_siege: (formData.get('adresse_siege') as string)?.trim() || null,
      email_secretariat: (formData.get('email_secretariat') as string)?.trim() || null,
      telephone: (formData.get('telephone') as string)?.trim() || null,
      dpo_nom: (formData.get('dpo_nom') as string)?.trim() || null,
      dpo_email: (formData.get('dpo_email') as string)?.trim() || null,
      prefecture_rattachement: (formData.get('prefecture_rattachement') as string)?.trim() || null,
      url_portail_public: (formData.get('url_portail_public') as string)?.trim() || null,
      format_numero_deliberation: (formData.get('format_numero_deliberation') as string)?.trim() || 'AAAA-NNN',
      prefixe_numero_deliberation: (formData.get('prefixe_numero_deliberation') as string)?.trim() || null,
      remise_zero_annuelle: formData.get('remise_zero_annuelle') === 'true',
      numero_depart: parseInt(formData.get('numero_depart') as string) || 1,

    }

    const existingId = formData.get('id') as string

    if (existingId) {
      const { error } = await supabase
        .from('institution_config')
        .update(payload)
        .eq('id', existingId)
      if (error) return { error: `Erreur de mise à jour : ${error.message}` }
    } else {
      const { error } = await supabase
        .from('institution_config')
        .insert(payload)
      if (error) return { error: `Erreur de création : ${error.message}` }
    }

    revalidatePath(ROUTES.CONFIGURATION)
    return { success: true }
  } catch (err) {
    console.error('saveInstitutionConfig error:', err)
    return { error: 'Erreur inattendue lors de la sauvegarde' }
  }
}

export async function saveInstanceConfig(formData: FormData): Promise<ActionResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    const roleError = requireRole(user, ['super_admin', 'gestionnaire'])
    if (roleError) return { error: roleError }

    const nom = formData.get('nom') as string
    const type_legal = formData.get('type_legal') as string

    if (!nom?.trim()) {
      return { error: 'Le nom est requis' }
    }
    if (!type_legal?.trim()) {
      return { error: 'Le type légal est requis' }
    }

    type QT = 'MAJORITE_MEMBRES' | 'TIERS_MEMBRES' | 'DEUX_TIERS' | 'STATUTS'
    type MR = 'SIMPLE' | 'ABSOLUE' | 'QUALIFIEE' | 'UNANIMITE'
    type LAM = 'STRICT' | 'SOUPLE' | 'SUSPENDU'

    const payload = {
      nom: nom.trim(),
      type_legal: type_legal.trim(),
      composition_max: parseInt(formData.get('composition_max') as string) || null,
      delai_convocation_jours: parseInt(formData.get('delai_convocation_jours') as string) || 5,
      quorum_type: ((formData.get('quorum_type') as string) || 'MAJORITE_MEMBRES') as QT,
      quorum_fraction_numerateur: parseInt(formData.get('quorum_fraction_numerateur') as string) || 1,
      quorum_fraction_denominateur: parseInt(formData.get('quorum_fraction_denominateur') as string) || 2,
      voix_preponderante: formData.get('voix_preponderante') === 'true',
      vote_secret_nominations: formData.get('vote_secret_nominations') !== 'false',
      mode_arrivee_tardive: ((formData.get('mode_arrivee_tardive') as string) || 'SOUPLE') as LAM,
      seances_publiques_defaut: formData.get('seances_publiques_defaut') !== 'false',
      votes_qd_autorises: formData.get('votes_qd_autorises') === 'true',
      majorite_defaut: ((formData.get('majorite_defaut') as string) || 'SIMPLE') as MR,

    }

    const id = formData.get('id') as string

    if (id) {
      const { error } = await supabase
        .from('instance_config')
        .update(payload)
        .eq('id', id)
      if (error) return { error: `Erreur de mise à jour : ${error.message}` }
    } else {
      const { error } = await supabase
        .from('instance_config')
        .insert({ ...payload, actif: true })
      if (error) return { error: `Erreur de création : ${error.message}` }
    }

    revalidatePath(ROUTES.CONFIGURATION)
    return { success: true }
  } catch (err) {
    console.error('saveInstanceConfig error:', err)
    return { error: 'Erreur inattendue lors de la sauvegarde' }
  }
}

export async function toggleInstanceActive(id: string, actif: boolean): Promise<ActionResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    const roleError = requireRole(user, ['super_admin', 'gestionnaire'])
    if (roleError) return { error: roleError }

    if (!id) return { error: 'ID manquant' }

    const { error } = await supabase
      .from('instance_config')
      .update({ actif })
      .eq('id', id)

    if (error) return { error: `Erreur : ${error.message}` }

    revalidatePath(ROUTES.CONFIGURATION)
    return { success: true }
  } catch (err) {
    console.error('toggleInstanceActive error:', err)
    return { error: 'Erreur inattendue' }
  }
}
