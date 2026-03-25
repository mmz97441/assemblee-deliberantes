'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ROUTES } from '@/lib/constants'
import type { Json } from '@/lib/supabase/types'

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

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DocumentInfo {
  name: string
  path: string
  size: number
  type: string
  uploaded_at: string
  uploaded_by: string | null
}

// ─── Upload document to an ODJ point ─────────────────────────────────────────

export async function uploadODJDocument(
  formData: FormData
): Promise<{ success: true; document: DocumentInfo } | { error: string }> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    const roleError = requireRole(user, ['super_admin', 'gestionnaire', 'president', 'secretaire_seance'])
    if (roleError) return { error: roleError }

    const file = formData.get('file') as File | null
    const pointId = formData.get('point_id') as string
    const seanceId = formData.get('seance_id') as string

    if (!file || !pointId || !seanceId) {
      return { error: 'Fichier, point et séance requis' }
    }

    // Validate file size (20 MB)
    if (file.size > 20 * 1024 * 1024) {
      return { error: 'Le fichier ne doit pas depasser 20 Mo' }
    }

    // Generate unique path
    const ext = file.name.split('.').pop() || 'pdf'
    const safeName = file.name
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_+/g, '_')
    const storagePath = `seances/${seanceId}/odj/${pointId}/${Date.now()}_${safeName}`

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return { error: `Erreur upload: ${uploadError.message}` }
    }

    // Create document info
    const docInfo: DocumentInfo = {
      name: file.name,
      path: storagePath,
      size: file.size,
      type: ext,
      uploaded_at: new Date().toISOString(),
      uploaded_by: user?.id ?? null,
    }

    // Get existing documents for this point
    const { data: point } = await supabase
      .from('odj_points')
      .select('documents')
      .eq('id', pointId)
      .single()

    const existingDocs: DocumentInfo[] = Array.isArray(point?.documents)
      ? (point.documents as unknown as DocumentInfo[])
      : []

    // Add new document
    const updatedDocs = [...existingDocs, docInfo]

    const { error: updateError } = await supabase
      .from('odj_points')
      .update({ documents: updatedDocs as unknown as Json })
      .eq('id', pointId)

    if (updateError) {
      // Try to clean up uploaded file
      await supabase.storage.from('documents').remove([storagePath])
      return { error: `Erreur mise à jour : ${updateError.message}` }
    }

    revalidatePath(`${ROUTES.SEANCES}/${seanceId}`)
    return { success: true, document: docInfo }
  } catch (err) {
    console.error('uploadODJDocument error:', err)
    return { error: 'Erreur inattendue lors de l\'upload' }
  }
}

// ─── Remove document from an ODJ point ───────────────────────────────────────

export async function removeODJDocument(
  pointId: string,
  seanceId: string,
  documentPath: string
): Promise<ActionResult> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    const roleError = requireRole(user, ['super_admin', 'gestionnaire'])
    if (roleError) return { error: roleError }

    // Get current documents
    const { data: point } = await supabase
      .from('odj_points')
      .select('documents')
      .eq('id', pointId)
      .single()

    const existingDocs: DocumentInfo[] = Array.isArray(point?.documents)
      ? (point.documents as unknown as DocumentInfo[])
      : []

    // Filter out the removed document
    const updatedDocs = existingDocs.filter(d => d.path !== documentPath)

    // Update the point
    const { error: updateError } = await supabase
      .from('odj_points')
      .update({ documents: updatedDocs as unknown as Json })
      .eq('id', pointId)

    if (updateError) {
      return { error: `Erreur: ${updateError.message}` }
    }

    // Delete from storage
    await supabase.storage.from('documents').remove([documentPath])

    revalidatePath(`${ROUTES.SEANCES}/${seanceId}`)
    return { success: true }
  } catch (err) {
    console.error('removeODJDocument error:', err)
    return { error: 'Erreur inattendue' }
  }
}

// ─── Get signed URL for a document ───────────────────────────────────────────

export async function getDocumentUrl(
  documentPath: string
): Promise<{ url: string } | { error: string }> {
  try {
    const { user, supabase } = await getAuthenticatedUser()
    if (!user) return { error: 'Non authentifié' }

    // Extract seanceId from the document path (format: seances/{seanceId}/odj/...)
    const pathParts = documentPath.split('/')
    const seanceId = pathParts[0] === 'seances' ? pathParts[1] : null

    if (seanceId) {
      const role = (user.user_metadata?.role as string) || ''
      const isManager = ['super_admin', 'gestionnaire'].includes(role)

      if (!isManager) {
        // Check user is convoqué to this séance
        const { data: memberRecord } = await supabase
          .from('members')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle()

        if (memberRecord) {
          const { data: conv } = await supabase
            .from('convocataires')
            .select('id')
            .eq('seance_id', seanceId)
            .eq('member_id', memberRecord.id)
            .maybeSingle()

          if (!conv) {
            return { error: 'Vous n\'êtes pas convoqué(e) à cette séance.' }
          }
        }
      }
    }

    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(documentPath, 3600) // 1 hour

    if (error || !data?.signedUrl) {
      return { error: 'Document introuvable' }
    }

    return { url: data.signedUrl }
  } catch (err) {
    console.error('getDocumentUrl error:', err)
    return { error: 'Erreur inattendue' }
  }
}
